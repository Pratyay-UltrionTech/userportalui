import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ShieldCheck, Star, Clock, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { apiSendContinueOtp } from '../lib/userApi';
import { BRAND_NAME, HEADING_FONT_FAMILY, TAGLINE } from '../lib/branding';
import { AppLogo } from '../components/AppLogo';

/* ─── design tokens (mirror landing-page palette) ─── */
const NAVY = '#0c1d3a';
const GOLD = '#c9a84c';
const GOLD2 = '#e8c97a';
const BTN_BG = '#c9a84c';
const BTN_TEXT = '#0c1d3a';

/** Form panel titles — lighter weight & color (same typeface as page body) */
const AUTH_PAGE_TITLE_CLASS = 'text-2xl font-medium text-gray-900 mb-1';

const PHONE_PREFIX = '+61';

/** Digits only for the local AU mobile part (9 digits, typically starting with 4). */
function sanitizeLocalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  // If user pastes full number with country code, strip it.
  if (digits.startsWith('61')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 9);
}

function isValidAuLocalMobile(local: string): boolean {
  return local.length === 9 && local.startsWith('4');
}

function toE164AuMobile(local: string): string {
  return `${PHONE_PREFIX}${sanitizeLocalDigits(local)}`;
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
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10"
        style={{ border: `60px solid ${GOLD}` }}
      />
      <div
        className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-10"
        style={{ border: `40px solid ${GOLD}` }}
      />

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

      <div className="relative z-10 my-8">
        <div className="w-8 h-0.5 mb-4 rounded-full" style={{ background: GOLD }} />
        <blockquote
          className="text-lg leading-relaxed italic"
          style={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'DM Sans', sans-serif" }}
        >
          "Your car deserves the best care — and so does your time."
        </blockquote>
      </div>

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

/* ─── Main Auth page ─── */
export function AuthPage() {
  const navigate = useNavigate();
  const { customerContinue, isAuthenticated } = useAuth();
  const [localMobile, setLocalMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [touched, setTouched] = useState(false);

  const phoneError = (() => {
    if (!touched) return '';
    if (!localMobile) return 'Mobile number is required';
    if (!isValidAuLocalMobile(localMobile)) {
      return 'Enter a valid 9-digit Australian mobile (starts with 4)';
    }
    return '';
  })();

  const phoneValid = isValidAuLocalMobile(localMobile);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSendCode = async () => {
    setTouched(true);
    if (!phoneValid) return;
    setError('');
    setSending(true);
    const phone = toE164AuMobile(localMobile);
    try {
      await apiSendContinueOtp(phone);
      setOtpSent(true);
      setOtpCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!phoneValid) return;
    if (!otpSent) {
      setError('Send a verification code first.');
      return;
    }
    if (otpCode.length !== 6) {
      setError('Enter the 6-digit code sent to your mobile.');
      return;
    }
    setError('');
    setVerifying(true);
    const phone = toE164AuMobile(localMobile);
    try {
      const { profileCompleted } = await customerContinue(phone, otpCode);
      navigate(profileCompleted ? '/home' : '/profile-setup', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const busy = sending || verifying;

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col" style={{ background: '#f7f6f3' }}>
      <div className="h-0.5 w-full" style={{ background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD2} 50%, transparent 100%)` }} />

      <div className="flex-1 flex items-center justify-center p-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl grid lg:grid-cols-2"
          style={{ boxShadow: '0 24px 64px rgba(12,29,58,0.14)' }}
        >
          <BrandPanel />

          <div className="bg-white flex flex-col justify-center px-8 py-10 sm:px-12">
            <div className="mb-8 lg:hidden flex items-center gap-3">
              <AppLogo variant="mark" className="max-h-10 shrink-0" />
              <div>
                <p className="text-sm font-bold text-gray-900" style={{ fontFamily: HEADING_FONT_FAMILY }}>
                  {BRAND_NAME}
                </p>
                <p
                  className="text-[10px] tracking-widest uppercase mt-0.5"
                  style={{ color: GOLD, fontFamily: "'DM Sans', sans-serif" }}
                >
                  {TAGLINE}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h1 className={AUTH_PAGE_TITLE_CLASS}>Welcome</h1>
              <p className="text-sm text-gray-500">
                Enter your mobile number to receive a verification code
              </p>
            </div>

            <form onSubmit={e => void handleVerify(e)} className="space-y-4 mb-5">
              {/* Mobile number */}
              <div>
                <label htmlFor="auth-mobile" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mobile number
                </label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-xl border border-r-0 border-gray-300 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-500 select-none">
                    {PHONE_PREFIX}
                  </span>
                  <input
                    id="auth-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={localMobile}
                    onChange={e => {
                      setLocalMobile(sanitizeLocalDigits(e.target.value));
                      setOtpSent(false);
                      setOtpCode('');
                      setError('');
                    }}
                    onBlur={() => setTouched(true)}
                    placeholder="412 345 678"
                    className={`w-full px-4 py-3 border rounded-r-xl text-sm outline-none transition-all focus:ring-2 focus:border-transparent ${
                      phoneError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                    required
                  />
                </div>
                {phoneError && <p className="text-xs text-red-500 mt-1.5">{phoneError}</p>}
              </div>

              {/* OTP + Send on one row */}
              <div>
                <label htmlFor="auth-otp" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Verification code
                </label>
                <div className="flex gap-2">
                  <input
                    id="auth-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    disabled={!otpSent}
                    className={`min-w-0 flex-1 px-4 py-3 border rounded-xl text-sm font-mono tracking-[0.25em] outline-none transition-all focus:ring-2 focus:border-transparent ${
                      otpSent
                        ? 'border-gray-300 bg-white hover:border-gray-400'
                        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendCode()}
                    disabled={busy || !phoneValid}
                    className="shrink-0 px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: phoneValid && !busy ? BTN_BG : '#e5e7eb',
                      color: phoneValid && !busy ? BTN_TEXT : '#9ca3af',
                    }}
                  >
                    {sending ? 'Sending…' : otpSent ? 'Resend' : 'Send'}
                  </button>
                </div>
                {otpSent && (
                  <p className="text-xs text-gray-500 mt-1.5">
                    Code sent to <span className="font-medium">{toE164AuMobile(localMobile)}</span>. Expires in 10 minutes.
                  </p>
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
                disabled={busy || !phoneValid || otpCode.length !== 6}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                style={{
                  background: BTN_BG,
                  color: BTN_TEXT,
                  boxShadow: busy ? 'none' : '0 4px 14px rgba(201,168,76,0.45)',
                }}
              >
                {verifying ? (
                  <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secured with 256-bit encryption
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
