import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { clearSignupProfilePending } from '../lib/signupProfileGate';
import {
  apiCustomerLogin,
  apiCustomerRegister,
  apiGuestCheckoutRegister,
  apiGetCustomerMe,
  apiPatchCustomerProfile,
  type CustomerAuthResponse,
} from '../lib/userApi';

const STORAGE_KEY = 'carwash_customer_session_v1';

export type CustomerSession = {
  accessToken: string;
  memberId: string;
  email: string;
  profileCompleted: boolean;
  fullName: string;
  phone: string;
  address: string;
  vehicles: { type: string; number: string; model: string }[];
};

function mapVehicles(
  raw: { type: string; number?: string; model: string }[] | undefined | null
): CustomerSession['vehicles'] {
  return (raw ?? []).map(v => ({ type: v.type ?? '', number: v.number ?? '', model: v.model ?? '' }));
}

function authResponseToSession(r: CustomerAuthResponse): CustomerSession {
  return {
    accessToken: r.access_token,
    memberId: r.member_id ?? '',
    email: r.email,
    profileCompleted: r.profile_completed,
    fullName: r.full_name ?? '',
    phone: r.phone ?? '',
    address: r.address ?? '',
    vehicles: mapVehicles(r.vehicles),
  };
}

function readStored(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<CustomerSession>;
    if (!o?.accessToken || typeof o.email !== 'string') return null;
    return {
      accessToken: o.accessToken,
      memberId: typeof o.memberId === 'string' ? o.memberId : '',
      email: o.email,
      profileCompleted: !!o.profileCompleted,
      fullName: typeof o.fullName === 'string' ? o.fullName : '',
      phone: typeof o.phone === 'string' ? o.phone : '',
      address: typeof o.address === 'string' ? o.address : '',
      vehicles: Array.isArray(o.vehicles) ? o.vehicles : [],
    };
  } catch {
    return null;
  }
}

function persist(session: CustomerSession | null) {
  try {
    if (!session) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

interface AuthContextType {
  session: CustomerSession | null;
  /** Logged in and profile completed (ready for booking as identified customer). */
  isAuthenticated: boolean;
  /** Has a valid access token (profile may still be incomplete). */
  hasCustomerSession: boolean;
  customerLogin: (identifier: string, password: string) => Promise<{ profileCompleted: boolean }>;
  customerRegister: (phone: string, password: string) => Promise<void>;
  /**
   * Register from guest checkout — no OTP verification.
   * Throws `FieldValidationError` if email or phone is already taken so the
   * checkout UI can display per-field messages without creating duplicate records.
   */
  customerRegisterGuest: (email: string, password: string, phone?: string) => Promise<void>;
  refreshCustomerSession: () => Promise<void>;
  updateCustomerProfile: (body: {
    full_name: string;
    phone: string;
    address: string;
    vehicles: { type: string; number: string; model: string }[];
    email?: string;
    email_change_token?: string;
    phone_change_token?: string;
  }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CustomerSession | null>(readStored);

  const isAuthenticated = !!(session?.accessToken && session.profileCompleted);
  const hasCustomerSession = !!session?.accessToken;

  const signOut = useCallback(() => {
    clearSignupProfilePending();
    persist(null);
    setSession(null);
    // Discard any lingering guest vehicle draft so the next guest session
    // on this device starts clean and can't bleed into a future login.
    localStorage.removeItem('guestVehicle');
  }, []);

  /**
   * Migrate the guest vehicle draft into a brand-new account.
   * ONLY called from customerRegister — never from customerLogin.
   * New accounts are guaranteed to start with an empty vehicle list,
   * so there is no risk of overwriting existing data.
   */
  const migrateGuestVehicleToNewAccount = useCallback(async (newSession: CustomerSession) => {
    const raw = localStorage.getItem('guestVehicle');
    localStorage.removeItem('guestVehicle'); // always discard, even on failure
    if (!raw) return;
    try {
      const guestV = JSON.parse(raw) as { type?: string; model?: string };
      if (guestV.type && guestV.model) {
        await apiPatchCustomerProfile(newSession.accessToken, {
          full_name: newSession.fullName,
          phone: newSession.phone,
          address: newSession.address,
          email: newSession.email,
          vehicles: [{ type: guestV.type, model: guestV.model, number: '' }],
        });
      }
    } catch (e) {
      console.error('Failed to migrate guest vehicle to new account', e);
    }
  }, []);

  const customerLogin = useCallback(async (identifier: string, password: string) => {
    const r = await apiCustomerLogin(identifier, password);
    const next = authResponseToSession(r);
    persist(next);
    setSession(next);
    // Login = existing account. Discard any guest draft unconditionally.
    // The user's profile is the authoritative source — never merge guest data on login.
    localStorage.removeItem('guestVehicle');
    // Strip guest personal data (name, phone, address, vehicles) from the booking context
    // so an authenticated user never inherits a previous guest session's contact details.
    try {
      const BOOKING_KEY = 'carwash_user_booking_ctx_v3';
      const raw = localStorage.getItem(BOOKING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.user = null;
        parsed.vehicles = [];
        localStorage.setItem(BOOKING_KEY, JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
    // Clear stale mobile visit address from the sessionStorage booking context so the
    // home page mobile card always starts at the PIN step after a fresh login.
    try {
      const BOOKING_KEY = 'carwash_user_booking_ctx_v3';
      const raw = sessionStorage.getItem(BOOKING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.mobileVisitAddress = null;
        sessionStorage.setItem(BOOKING_KEY, JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
    return { profileCompleted: r.profile_completed };
  }, []);

  const customerRegister = useCallback(async (phone: string, password: string) => {
    const r = await apiCustomerRegister(phone, password);
    const next = authResponseToSession(r);
    persist(next);
    setSession(next);
    // Registration = new account with no vehicles yet. Safe to migrate the guest draft.
    await migrateGuestVehicleToNewAccount(next);
    // Strip guest personal data from the booking context so the new authenticated
    // user never inherits a previous guest session's contact details in the UI.
    try {
      const BOOKING_KEY = 'carwash_user_booking_ctx_v3';
      const raw = localStorage.getItem(BOOKING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.user = null;
        parsed.vehicles = [];
        localStorage.setItem(BOOKING_KEY, JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
    // Clear stale mobile visit address from sessionStorage so the home page mobile
    // card starts at the PIN step rather than showing a previous address.
    try {
      const BOOKING_KEY = 'carwash_user_booking_ctx_v3';
      const raw = sessionStorage.getItem(BOOKING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.mobileVisitAddress = null;
        sessionStorage.setItem(BOOKING_KEY, JSON.stringify(parsed));
      }
    } catch { /* ignore */ }
  }, [migrateGuestVehicleToNewAccount]);

  const customerRegisterGuest = useCallback(async (email: string, password: string, phone?: string) => {
    // apiGuestCheckoutRegister throws FieldValidationError on duplicate email/phone —
    // the caller (PaymentPage) catches that and shows per-field messages.
    const r = await apiGuestCheckoutRegister(email, password, phone);
    const next = authResponseToSession(r);
    persist(next);
    setSession(next);
    // Guest checkout → new account; no vehicle migration needed (no guestVehicle draft).
    localStorage.removeItem('guestVehicle');
  }, []);

  const refreshCustomerSession = useCallback(async () => {
    const s = readStored();
    if (!s?.accessToken) return;
    const me = await apiGetCustomerMe(s.accessToken);
    const next: CustomerSession = {
      accessToken: s.accessToken,
      memberId: me.id,
      email: me.email,
      profileCompleted: me.profile_completed,
      fullName: me.full_name ?? '',
      phone: me.phone ?? '',
      address: me.address ?? '',
      vehicles: me.vehicles?.length ? mapVehicles(me.vehicles) : (s.vehicles ?? []),
    };
    persist(next);
    setSession(next);
  }, []);

  const updateCustomerProfile = useCallback(
    async (body: {
      full_name: string;
      phone: string;
      address: string;
      vehicles: { type: string; number: string; model: string }[];
      email?: string;
      email_change_token?: string;
      phone_change_token?: string;
    }) => {
      const s = readStored();
      if (!s?.accessToken) throw new Error('Not signed in');
      const me = await apiPatchCustomerProfile(s.accessToken, body);
      const next: CustomerSession = {
        // When the email changed the backend issues a new access token — use it
        // so the session reflects the new identity and login with new email works.
        accessToken: me.new_access_token ?? s.accessToken,
        memberId: me.id,
        email: me.email,
        profileCompleted: me.profile_completed,
        fullName: me.full_name ?? '',
        phone: me.phone ?? '',
        address: me.address ?? '',
        // Always use what we sent — the user explicitly chose this vehicle list.
        // The PATCH response may return stale/old data from the backend, so we
        // never let it overwrite the authoritative list we just submitted.
        vehicles: body.vehicles,
      };
      persist(next);
      setSession(next);
    },
    []
  );

  const value = useMemo(
    () => ({
      session,
      isAuthenticated,
      hasCustomerSession,
      customerLogin,
      customerRegister,
      customerRegisterGuest,
      refreshCustomerSession,
      updateCustomerProfile,
      signOut,
    }),
    [
      session,
      isAuthenticated,
      hasCustomerSession,
      customerLogin,
      customerRegister,
      customerRegisterGuest,
      refreshCustomerSession,
      updateCustomerProfile,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
