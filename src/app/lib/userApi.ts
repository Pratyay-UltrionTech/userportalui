import { API_BASE } from './apiBase';

export type CustomerAuthResponse = {
  access_token: string;
  token_type: string;
  member_id: string;
  email: string;
  profile_completed: boolean;
  full_name: string;
  phone: string;
  address: string;
  vehicles: { type: string; number?: string; model: string }[];
};

export type CustomerMeResponse = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  address: string;
  vehicles: { type: string; number?: string; model: string }[];
  profile_completed: boolean;
  /** Present only when email was changed — use this as the new accessToken. */
  new_access_token?: string;
};

// ── Structured field-level validation error ───────────────────────────────────
// Thrown when the backend returns a `field_errors` map so the UI can display
// errors under the specific input rather than as a single banner message.
export class FieldValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super(Object.values(fields).join('; '));
    this.name = 'FieldValidationError';
  }
}

function detailMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Request failed';
  const d = (data as { detail?: unknown }).detail;

  // FastAPI validation errors: detail is an array of {loc, msg, type}
  if (Array.isArray(d) && d.length > 0) {
    const msgs = d
      .map((e: unknown) => {
        if (!e || typeof e !== 'object') return null;
        const loc = (e as { loc?: unknown[] }).loc;
        const msg = (e as { msg?: unknown }).msg;
        if (typeof msg !== 'string') return null;
        const field = Array.isArray(loc)
          ? loc.filter((p) => p !== 'body').join(' › ')
          : '';
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (msgs.length > 0) return msgs.join('; ');
  }

  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && 'detail' in d) {
    const inner = (d as { detail?: unknown }).detail;
    if (typeof inner === 'string') return inner;
    if (inner && typeof inner === 'object' && 'detail' in inner) {
      const nested = (inner as { detail?: unknown }).detail;
      if (typeof nested === 'string') return nested;
    }
  }
  return 'Request failed';
}

function extractFieldErrors(data: unknown): Record<string, string> | null {
  if (!data || typeof data !== 'object') return null;
  const d = (data as { detail?: unknown }).detail;
  if (d && typeof d === 'object' && 'field_errors' in d) {
    const fe = (d as { field_errors?: unknown }).field_errors;
    if (fe && typeof fe === 'object' && !Array.isArray(fe)) {
      return fe as Record<string, string>;
    }
  }
  return null;
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(detailMessage(data));
  return data as T;
}

async function patchJson<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Prefer structured field-level errors so the UI can show them inline.
    const fields = extractFieldErrors(data);
    if (fields) throw new FieldValidationError(fields);
    throw new Error(detailMessage(data));
  }
  return data as T;
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(detailMessage(data));
  return data as T;
}

export function apiCustomerRegister(phone: string, password: string): Promise<CustomerAuthResponse> {
  return postJson<CustomerAuthResponse>('/auth/customer/register', { phone, password });
}

/**
 * Register from guest checkout — no OTP verification required.
 * Returns structured `field_errors` (via FieldValidationError) when email or
 * phone already belongs to an existing account.
 */
export async function apiGuestCheckoutRegister(
  email: string,
  password: string,
  phone?: string
): Promise<CustomerAuthResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const res = await fetch(`${API_BASE}/auth/customer/register-guest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, ...(phone ? { phone } : {}) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fields = extractFieldErrors(data);
    if (fields) throw new FieldValidationError(fields);
    throw new Error(detailMessage(data));
  }
  return data as CustomerAuthResponse;
}

export function apiCustomerLogin(identifier: string, password: string): Promise<CustomerAuthResponse> {
  return postJson<CustomerAuthResponse>('/auth/customer/login', { identifier, password });
}

export function apiGetCustomerMe(token: string): Promise<CustomerMeResponse> {
  return getJson<CustomerMeResponse>('/customer/me', token);
}

export function apiPatchCustomerProfile(
  token: string,
  body: {
    full_name: string;
    phone: string;
    address: string;
    vehicles: { type: string; number?: string; model: string }[];
    email?: string;
    /** Signed token from apiVerifyEmailChange — required when email changes. */
    email_change_token?: string;
    /** Signed token from apiVerifyPhoneChange — required when phone changes. */
    phone_change_token?: string;
  }
): Promise<CustomerMeResponse> {
  return patchJson<CustomerMeResponse>('/customer/me', body, token);
}

export type LoyaltyMatchedReward = {
  tier_id?: string;
  reward_service_id: string;
  reward_service_name: string | null;
} | null;

export type LoyaltyPrimaryPayload = {
  has_loyalty_activity: boolean;
  scope: 'branch' | 'mobile';
  branch_id: string | null;
  branch_name: string;
  city_pin_code: string | null;
  qualifying_service_count: number;
  eligible_services_in_window: number;
  spend_in_window: number;
  window_progress_label: string;
  remaining_eligible_slots_in_window: number;
  progress_fraction: number;
  matched_reward: LoyaltyMatchedReward;
  next_reward_message: string;
};

export type CustomerLoyaltyOverviewResponse = {
  has_any_loyalty: boolean;
  primary: LoyaltyPrimaryPayload | null;
};

export function apiCustomerLoyaltyOverview(token: string): Promise<CustomerLoyaltyOverviewResponse> {
  return getJson<CustomerLoyaltyOverviewResponse>('/customer/loyalty/overview', token);
}

export type ActiveLoyaltyReward = {
  id: string;
  channel: 'branch' | 'mobile';
  branch_id: string | null;
  city_pin_code: string | null;
  reward_service_id: string;
  reward_service_name: string | null;
  granted_at: string;
};

export function apiGetActiveLoyaltyRewards(token: string): Promise<ActiveLoyaltyReward[]> {
  return getJson<ActiveLoyaltyReward[]>('/customer/loyalty/active-rewards', token);
}

export type CustomerServiceHistoryItem = {
  id: string;
  channel: 'branch' | 'mobile';
  status: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  location_label: string;
  branch_id?: string;
  service_id?: string;
  selected_addon_ids?: string[];
  service_summary: string;
  vehicle_type: string;
  /** Service + add-ons − promo + tip (GST-inclusive), cents. */
  total_cents?: number;
  loyalty_points_earned?: number;
  created_at: string | null;
  /** Customer UUID — used to build the XXXXXX-CCCC display reference. */
  customer_id?: string | null;
  /** Phone number — used to derive the guest booking ID suffix when customer_id is absent. */
  phone?: string;
};

export type CustomerServiceHistoryResponse = {
  items: CustomerServiceHistoryItem[];
};

export function apiCustomerServiceHistory(token: string): Promise<CustomerServiceHistoryResponse> {
  return getJson<CustomerServiceHistoryResponse>('/customer/service-history', token);
}

export function apiCustomerRescheduleBooking(
  token: string,
  bookingId: string,
  body: { slot_date: string; start_time: string; end_time: string }
): Promise<void> {
  return patchJson<void>(`/customer/bookings/${bookingId}/reschedule`, body, token);
}

export function apiCustomerCancelBooking(token: string, bookingId: string): Promise<void> {
  return postJson<void>(`/customer/bookings/${bookingId}/cancel`, {}, token);
}


async function postJsonAnon<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as { detail?: unknown })?.detail;
    const msg = typeof d === 'string' ? d : typeof (d as any)?.detail === 'string' ? (d as any).detail : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export function apiCheckFieldAvailability(fields: {
  email?: string;
  phone?: string;
}): Promise<{ email_taken?: boolean; phone_taken?: boolean }> {
  return postJsonAnon('/auth/customer/check-availability', fields);
}

export function apiForgotPasswordCustomer(identifier: string): Promise<void> {
  return postJsonAnon('/auth/customer/forgot-password', { identifier });
}

export function apiVerifyOtpCustomer(identifier: string, otp: string): Promise<void> {
  return postJsonAnon('/auth/customer/verify-otp', { identifier, otp });
}

export function apiResetPasswordCustomer(identifier: string, newPassword: string): Promise<void> {
  return postJsonAnon('/auth/customer/reset-password', { identifier, new_password: newPassword });
}

// ── Signup mobile verification ────────────────────────────────────────────────

export function apiSendSignupOtp(phone: string): Promise<void> {
  return postJsonAnon('/auth/customer/send-signup-otp', { phone });
}

export function apiVerifySignupOtp(phone: string, otp: string): Promise<void> {
  return postJsonAnon('/auth/customer/verify-signup-otp', { identifier: phone, otp });
}

// ── Email change verification (authenticated) ─────────────────────────────────

export function apiRequestEmailChange(token: string, newEmail: string): Promise<void> {
  return postJson<void>('/auth/customer/request-email-change', { new_email: newEmail }, token);
}

export type EmailChangeVerifyResponse = {
  message: string;
  /** Short-lived signed JWT — pass as `email_change_token` in apiPatchCustomerProfile. */
  email_change_token: string;
};

export function apiVerifyEmailChange(
  token: string,
  newEmail: string,
  otp: string
): Promise<EmailChangeVerifyResponse> {
  return postJson<EmailChangeVerifyResponse>(
    '/auth/customer/verify-email-change',
    { identifier: newEmail, otp },
    token
  );
}

export function apiRequestPhoneChange(token: string, newPhone: string): Promise<void> {
  return postJson<void>('/auth/customer/request-phone-change', { new_phone: newPhone }, token);
}

export type PhoneChangeVerifyResponse = {
  message: string;
  phone_change_token: string;
};

export function apiVerifyPhoneChange(
  token: string,
  newPhone: string,
  otp: string
): Promise<PhoneChangeVerifyResponse> {
  return postJson<PhoneChangeVerifyResponse>(
    '/auth/customer/verify-phone-change',
    { identifier: newPhone, otp },
    token
  );
}

// ── Saved addresses ──────────────────────────────────────────────────────────

export type SavedAddress = {
  id: string;
  label: string;
  street_address: string;
  suburb: string;
  state: string;
  postcode: string;
  is_default: boolean;
};

export function apiListAddresses(token: string): Promise<{ addresses: SavedAddress[] }> {
  return getJson('/customer/addresses', token);
}

export function apiCreateAddress(
  token: string,
  body: Omit<SavedAddress, 'id'>
): Promise<SavedAddress> {
  return postJson('/customer/addresses', body, token);
}

export function apiUpdateAddress(
  token: string,
  id: string,
  body: Partial<Omit<SavedAddress, 'id'>>
): Promise<SavedAddress> {
  return patchJson(`/customer/addresses/${id}`, body, token);
}

async function deleteJson(path: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(detailMessage(data));
  }
}

export function apiDeleteAddress(token: string, id: string): Promise<void> {
  return deleteJson(`/customer/addresses/${id}`, token);
}

export function apiSetDefaultAddress(token: string, id: string): Promise<SavedAddress> {
  return patchJson(`/customer/addresses/${id}/set-default`, {}, token);
}
