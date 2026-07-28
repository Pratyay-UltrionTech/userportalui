import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, ShieldCheck, Star, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { clearSignupProfilePending, setSignupProfilePending } from '../lib/signupProfileGate';
import {
  apiForgotPasswordCustomer,
  apiVerifyOtpCustomer,
  apiResetPasswordCustomer,
  apiSendSignupOtp,
  apiVerifySignupOtp,
} from '../lib/userApi';
import { BRAND_NAME, HEADING_FONT_FAMILY, TAGLINE } from '../lib/branding';
import { AppLogo } from '../components/AppLogo';

/* ─── design tokens (mirror landing-page palette) ─── */
const NAVY = '#0c1d3a';
const GOLD = '#c9a84c';
const GOLD2 = '#e8c97a';
const BTN_BG = '#c9a84c';       // gold — matches landing page CTA
const BTN_TEXT = '#0c1d3a';     // navy text on gold button
const INDIGO = '#4F46E5';       // used for focus rings & links only

/** Form panel titles — lighter weight & color (same typeface as page body) */
const AUTH_PAGE_TITLE_CLASS = 'text-2xl font-medium text-gray-900 mb-1';

const PHONE_DEFAULT = '+61';

/** Keep leading + and digits only; allow +61 plus nine digits or 0 plus nine digits. */
function sanitizePhoneInput(raw: string): string {
  let s = raw.replace(/[^\d+]/g, '');
  const hasPlus = s.startsWith('+');
  if (hasPlus) s = s.slice(1);
  s = s.replace(/\+/g, '');
  let digits = s.replace(/\D/g, '');
  if (digits.startsWith('61')) {
    digits = digits.slice(0, 12); // 61 + optional leading 0 + nine mobile digits
  } else {
    digits = digits.slice(0, 10); // up to 10 local
  }
  return hasPlus ? `+${digits}` : digits;
}

function extractAuLocalDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('61')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function hasPhoneLocalPart(value: string): boolean {
  return extractAuLocalDigits(value).length > 0;
}

function isValidAuMobileInput(value: string): boolean {
  const local = extractAuLocalDigits(value);
  return local.length === 9 && local.startsWith('4');
}

function toE164AuMobile(value: string): string {
  return `+61${extractAuLocalDigits(value)}`;
}

/* ─── Brand panel ─── */
function BrandPanel() {
  const trustPoints = [
    { icon: ShieldCheck, text: 'Secure, encrypted sign-in' },
    { icon: Star,        text: 'Earn loyalty rewards on selected washes' },
    { icon: Clock,       text: 'Book in under 2 minutes' },
  ];

  return (
    <div
      className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
      style={{ background: `linear-gradient(145deg, ${NAVY} 0%, #162e5a 100%)` }}
    >
      {/* decorative rings */}
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
        style={{ border: `60px solid ${GOLD}` }}
      />
      <div
        className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-10"
        style={{ border: `40px solid ${GOLD}` }}
      />

      {/* brand */}
      <div className="relative z-10 flex items-center gap-4">
        <AppLogo variant="auth" className="shrink-0 drop-shadow-lg" />
        <div>
          <h2
            className="text-2xl font-bold leading-snug mb-0.5"
            style={{ fontFamily: HEADING_FONT_FAMILY, color: '#fff' }}
          >
            {BRAND_NAME}
          </h2>
          <p className="text-xs tracking-widest uppercase" style={{ color: GOLD2 }}>
            {TAGLINE}
          </p>
        </div>
      </div>

      {/* mid quote */}
      <div className="relative z-10 my-8">
        <div className="w-8 h-0.5 mb-4 rounded-full" style={{ background: GOLD }} />
        <blockquote
          className="text-lg leading-relaxed italic"
          style={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'DM Sans', sans-serif" }}
        >
          "Your car deserves the best care — and so does your time."
        </blockquote>
      </div>

      {/* trust badges */}
      <div className="relative z-10 space-y-3">
        {trustPoints.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(201,168,76,0.15)', border: `1px solid rgba(201,168,76,0.3)` }}
            >
              <Icon className="w-4 h-4" style={{ color: GOLD }} />
            </div>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Password strength indicator ─── */
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['#ef4444', '#f59e0b', GOLD];
  const labels = ['Weak', 'Fair', 'Strong'];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score - 1] : '#e5e7eb' }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: score > 0 ? colors[score - 1] : '#9ca3af' }}>
          {score > 0 ? labels[score - 1] : ''}
        </span>
        <div className="flex gap-3">
          {checks.map(c => (
            <span
              key={c.label}
              className="text-xs flex items-center gap-1"
              style={{ color: c.ok ? INDIGO : '#9ca3af' }}
            >
              <CheckCircle2 className="w-3 h-3" />
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Forgot-password flow ─── */
type FpStep = 'phone' | 'otp' | 'reset' | 'done';

function ForgotPasswordFlow({
  onClose,
  onSignUp,
}: {
  onClose: () => void;
  onSignUp: (phone: string) => void;
}) {
  const [step, setStep] = useState<FpStep>('phone');
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const passRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setError('');
    setLoading(true);
    try {
      await apiForgotPasswordCustomer(identifier.trim());
      setAccountNotFound(false);
      setStep('otp');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('No account found')) {
        setAccountNotFound(true);
        setError('');
      } else {
        setError(msg || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setError('');
    setLoading(true);
    try {
      await apiVerifyOtpCustomer(identifier.trim(), otp.trim());
      setStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passRegex.test(newPassword)) {
      setError('Password must be at least 8 characters with 1 uppercase letter and 1 number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiResetPasswordCustomer(identifier.trim(), newPassword);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (accountNotFound) {
    return (
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-8">
          <h2 className={AUTH_PAGE_TITLE_CLASS}>Reset your password</h2>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-gray-700">No account found with this mobile number.</p>
          <p className="text-sm text-gray-500">Please sign up to continue.</p>
          <button
            type="button"
            onClick={() => onSignUp(identifier.trim())}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
            style={{ background: BTN_BG, color: BTN_TEXT, boxShadow: '0 4px 14px rgba(201,168,76,0.4)' }}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountNotFound(false);
              setError('');
            }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
          >
            ← Try a different mobile number
          </button>
          <button type="button" onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors">
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-8">
        <h2 className={AUTH_PAGE_TITLE_CLASS}>Reset your password</h2>
        <p className="text-sm text-gray-500">We'll send a verification code by SMS and to your verified email, if available.</p>
      </div>

      {step === 'phone' && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile number</label>
            <input
              type="text"
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="+61 432 361 875"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:border-transparent outline-none transition-all"
              style={{ ['--tw-ring-color' as any]: INDIGO }}
              required
            />
            <p className="mt-1.5 text-xs text-gray-400">
              Existing members without a mobile number may use their email.
            </p>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: BTN_BG, color: BTN_TEXT, boxShadow: '0 4px 14px rgba(201,168,76,0.4)' }}>
            {loading ? 'Sending…' : <><span>Send Verification Code</span><ArrowRight className="w-4 h-4" /></>}
          </button>
          <button type="button" onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors">
            ← Back to sign in
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#7a5c1e' }}>
            Code sent to <strong>{identifier}</strong>. Expires in 10 minutes.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">6-digit code</label>
            <input
              type="text"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:border-transparent outline-none transition-all"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading || otp.length !== 6} className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60" style={{ background: BTN_BG, color: BTN_TEXT, boxShadow: '0 4px 14px rgba(201,168,76,0.4)' }}>
            {loading ? 'Verifying…' : 'Verify Code'}
          </button>
          <button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors">
            Resend code
          </button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                autoFocus
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a strong password"
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:border-transparent outline-none transition-all"
                required
              />
              <button type="button" onClick={() => setShowPw(p => !p)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <PasswordStrength password={newPassword} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:border-transparent outline-none transition-all"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60" style={{ background: BTN_BG, color: BTN_TEXT, boxShadow: '0 4px 14px rgba(201,168,76,0.4)' }}>
            {loading ? 'Saving…' : 'Save New Password'}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(201,168,76,0.15)' }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: GOLD }} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Password updated!</h3>
          <p className="text-sm text-gray-500">You can now sign in with your new password.</p>
          <button type="button" onClick={onClose} className="w-full py-3 rounded-xl font-semibold text-sm transition-all" style={{ background: BTN_BG, color: BTN_TEXT, boxShadow: '0 4px 14px rgba(201,168,76,0.4)' }}>
            Back to Sign In
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Input field wrapper ─── */
function Field({
  id, label, type = 'text', value, onChange, onBlur,
  placeholder, error, touched, rightSlot, autoComplete, minLength, inputMode,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; onBlur?: () => void;
  placeholder?: string; error?: string; touched?: boolean;
  rightSlot?: React.ReactNode; autoComplete?: string; minLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          minLength={minLength}
          className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition-all focus:ring-2 focus:border-transparent ${
            touched && error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
          } ${rightSlot ? 'pr-12' : ''}`}
          required
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center px-3">{rightSlot}</div>
        )}
      </div>
      {touched && error && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">{error}</p>}
    </div>
  );
}

/* ─── Main Auth page ─── */
export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { customerLogin, customerRegister, isAuthenticated } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState(PHONE_DEFAULT);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // ── Signup OTP state ──────────────────────────────────────────────────────
  // When non-null, the user has submitted the signup form and we need to
  // verify their mobile number before creating the account.
  const [signupOtp, setSignupOtp] = useState<{
    phone: string;
    password: string;
    code: string;
    loading: boolean;
    error: string;
  } | null>(null);

  const passRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

  const getFieldError = (name: string, value: string) => {
    if (name === 'identifier') {
      if (!hasPhoneLocalPart(value)) return 'Mobile number is required';
      if (!isValidAuMobileInput(value)) {
        return 'Enter a valid Australian mobile number';
      }
    }
    if (name === 'password' && !isLogin) {
      if (!value) return 'Password is required';
      if (!passRegex.test(value)) return 'Min 8 characters, 1 uppercase, 1 number';
    }
    return '';
  };

  const identifierError = getFieldError('identifier', identifier);
  const passError = getFieldError('password', password);
  const isValid = isLogin ? (!identifierError && !!password) : (!identifierError && !passError);

  // If the user is already authenticated, send them straight to /home.
  // This handles the case where a logged-in user visits the landing page,
  // clicks "Book Your Service" (which links to #/login), and should NOT
  // be forced to log in again.
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (searchParams.get('signup') === '1') setIsLogin(false);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        clearSignupProfilePending();
        const { profileCompleted } = await customerLogin(toE164AuMobile(identifier), password);
        navigate(profileCompleted ? '/home' : '/profile-setup', { replace: true });
      } else {
        if (!passRegex.test(password)) {
          setError('Password must be at least 8 characters with 1 uppercase letter and 1 number.');
          setLoading(false);
          return;
        }
        const phone = toE164AuMobile(identifier);
        await apiSendSignupOtp(phone);
        setSignupOtp({ phone, password, code: '', loading: false, error: '' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Signup OTP handlers ───────────────────────────────────────────────────

  const handleSignupOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupOtp) return;
    setSignupOtp(p => p ? { ...p, loading: true, error: '' } : p);
    try {
      await apiVerifySignupOtp(signupOtp.phone, signupOtp.code);
      // OTP verified — create the account now.
      await customerRegister(signupOtp.phone, signupOtp.password);
      setSignupProfilePending();
      navigate('/profile-setup', { replace: true });
    } catch (err) {
      setSignupOtp(p => p ? { ...p, loading: false, error: err instanceof Error ? err.message : 'Verification failed.' } : p);
    }
  };

  const handleSignupOtpResend = async () => {
    if (!signupOtp) return;
    setSignupOtp(p => p ? { ...p, loading: true, error: '' } : p);
    try {
      await apiSendSignupOtp(signupOtp.phone);
      setSignupOtp(p => p ? { ...p, loading: false, code: '', error: '' } : p);
    } catch (err) {
      setSignupOtp(p => p ? { ...p, loading: false, error: err instanceof Error ? err.message : 'Could not resend code.' } : p);
    }
  };

  const switchMode = () => {
    setIsLogin(p => !p);
    setError('');
    setTouched({});
    setIdentifier(PHONE_DEFAULT);
    setPassword('');
  };

  return (
    /* full viewport minus the sticky navbar */
    <div className="min-h-[calc(100vh-65px)] flex flex-col" style={{ background: '#f7f6f3' }}>
      {/* thin gold accent bar at very top of page content */}
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD2} 50%, transparent 100%)` }} />

      <div className="flex-1 flex items-center justify-center p-4 py-10">
        <motion.div
          key={isLogin ? 'login' : 'signup'}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl grid lg:grid-cols-2"
          style={{ boxShadow: '0 24px 64px rgba(12,29,58,0.14)' }}
        >
          {/* left brand panel */}
          <BrandPanel />

          {/* right form panel */}
          <div className="bg-white flex flex-col justify-center px-8 py-10 sm:px-12">
            <AnimatePresence mode="wait">
              {/* ── Signup mobile OTP step ── */}
              {signupOtp ? (
                <motion.div key="signup-otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  <div className="w-full max-w-sm mx-auto">
                    <div className="mb-8">
                      <h2 className={AUTH_PAGE_TITLE_CLASS}>Verify your mobile</h2>
                      <p className="text-sm text-gray-500">We sent a 6-digit code by SMS.</p>
                    </div>
                    <div className="mb-5 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#7a5c1e' }}>
                      Code sent to <strong>{signupOtp.phone}</strong>. Expires in 10 minutes.
                    </div>
                    <form onSubmit={e => void handleSignupOtpVerify(e)} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">6-digit code</label>
                        <input
                          type="text"
                          autoFocus
                          inputMode="numeric"
                          maxLength={6}
                          value={signupOtp.code}
                          onChange={e => setSignupOtp(p => p ? { ...p, code: e.target.value.replace(/\D/g, '') } : p)}
                          placeholder="000000"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:border-transparent outline-none transition-all"
                          required
                        />
                      </div>
                      {signupOtp.error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{signupOtp.error}</p>
                      )}
                      <button
                        type="submit"
                        disabled={signupOtp.loading || signupOtp.code.length !== 6}
                        className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
                        style={{ background: BTN_BG, color: BTN_TEXT, boxShadow: '0 4px 14px rgba(201,168,76,0.4)' }}
                      >
                        {signupOtp.loading ? 'Verifying…' : 'Verify & Create Account'}
                      </button>
                      <button
                        type="button"
                        disabled={signupOtp.loading}
                        onClick={() => void handleSignupOtpResend()}
                        className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors disabled:opacity-50"
                      >
                        Resend code
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignupOtp(null)}
                        className="w-full text-sm text-gray-400 hover:text-gray-600 py-1 transition-colors"
                      >
                        ← Back to sign up
                      </button>
                    </form>
                  </div>
                </motion.div>
              ) : showForgotPassword ? (
                <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  <ForgotPasswordFlow
                    onClose={() => setShowForgotPassword(false)}
                    onSignUp={(signupPhone) => {
                      setShowForgotPassword(false);
                      setIsLogin(false);
                      setIdentifier(sanitizePhoneInput(signupPhone) || PHONE_DEFAULT);
                      setError('');
                      setPassword('');
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div key={isLogin ? 'login-form' : 'signup-form'} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  {/* mobile brand header */}
                  <div className="mb-8 lg:hidden flex items-center gap-3">
                    <AppLogo variant="mark" className="max-h-10 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-gray-900" style={{ fontFamily: HEADING_FONT_FAMILY }}>{BRAND_NAME}</p>
                      <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: GOLD, fontFamily: "'DM Sans', sans-serif" }}>{TAGLINE}</p>
                    </div>
                  </div>

                  {/* heading */}
                  <div className="mb-8">
                    <h1 className={AUTH_PAGE_TITLE_CLASS}>
                      {isLogin ? 'Welcome back' : 'Create your account'}
                    </h1>
                    <p className="text-sm text-gray-500">
                      {isLogin
                        ? 'Sign in to manage bookings and track rewards'
                        : 'Join thousands of customers enjoying premium car care'}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 mb-5">
                    <Field
                      id="auth-mobile"
                      label="Mobile number"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={identifier}
                      onChange={(value) => setIdentifier(sanitizePhoneInput(value))}
                      onBlur={() => setTouched(p => ({ ...p, identifier: true }))}
                      placeholder="+61 432 361 875"
                      error={identifierError}
                      touched={touched.identifier}
                    />
                    <div>
                      <Field
                        id="auth-password"
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={setPassword}
                        onBlur={() => setTouched(p => ({ ...p, password: true }))}
                        placeholder={isLogin ? 'Enter your password' : 'Create a strong password'}
                        error={passError}
                        touched={touched.password}
                        minLength={isLogin ? 1 : 8}
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowPassword(p => !p)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        }
                      />
                      {!isLogin && <PasswordStrength password={password} />}
                      {isLogin && (
                        <div className="flex justify-end mt-1.5">
                          <button
                            type="button"
                            onClick={() => setShowForgotPassword(true)}
                            className="text-xs font-medium transition-colors hover:underline"
                            style={{ color: GOLD }}
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || (!isLogin && !isValid)}
                      className="w-full text-white py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                      style={{
                        background: BTN_BG,
                        color: BTN_TEXT,
                        boxShadow: loading ? 'none' : '0 4px 14px rgba(201,168,76,0.45)',
                      }}
                    >
                      {loading ? (
                        <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : (
                        <>{isLogin ? 'Sign In' : 'Create Account'}<ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </form>

                  <p className="text-center text-sm text-gray-500 mt-5">
                    {isLogin ? "Don't have an account? " : 'Already have an account? '}
                    <button
                      type="button"
                      onClick={switchMode}
                      className="font-semibold transition-colors hover:underline"
                      style={{ color: GOLD }}
                    >
                      {isLogin ? 'Sign Up' : 'Sign In'}
                    </button>
                  </p>

                  {/* security footnote */}
                  <p className="text-center text-xs text-gray-400 mt-6 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Secured with 256-bit encryption
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
