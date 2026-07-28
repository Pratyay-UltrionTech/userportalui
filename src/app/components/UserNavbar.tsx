import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Award, X, CircleUser, LogIn, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiCustomerLoyaltyOverview } from '../lib/userApi';
import { AccountSidebar } from './AccountSidebar';
import {
  BRAND_NAME,
  LANDING_NAV_HEIGHT,
  TAGLINE,
  landingNavBrandNameStyle,
  landingNavTaglineStyle,
  landingNavTaglineLightColor,
} from '../lib/branding';
import { AppLogo } from './AppLogo';

const NAVY      = '#0c1d3a';
const NAVY_TINT = '#e8eef8';
const GOLD      = '#c9a84c';
const GOLD2     = '#e8c97a';

export function UserNavbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hasCustomerSession, session } = useAuth();
  const [showLoyaltyDropdown, setShowLoyaltyDropdown] = useState(false);
  const [loyaltyOverview, setLoyaltyOverview] = useState<any>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [accountSidebarOpen, setAccountSidebarOpen] = useState(false);

  const isHomePage = pathname === '/home';
  // Hide account controls only on login and during first-time profile setup (not when editing an existing profile)
  const isAuthPage = pathname === '/login' || (pathname.startsWith('/profile-setup') && !session?.profileCompleted);

  const refreshLoyaltyOverview = useCallback(async (token: string) => {
    setLoyaltyLoading(true);
    try {
      const o = await apiCustomerLoyaltyOverview(token);
      setLoyaltyOverview(o);
    } catch {
      setLoyaltyOverview({ has_any_loyalty: false, primary: null });
    } finally {
      setLoyaltyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasCustomerSession || !session?.accessToken) {
      setLoyaltyOverview(null);
      return;
    }
    void refreshLoyaltyOverview(session.accessToken);
  }, [hasCustomerSession, session?.accessToken, refreshLoyaltyOverview]);

  const loyaltyPrimary  = loyaltyOverview?.primary ?? null;
  const loyaltyLabel    = loyaltyPrimary?.window_progress_label ?? null;
  const loyaltyFraction = loyaltyPrimary ? Math.min(1, Math.max(0, loyaltyPrimary.progress_fraction)) : 0;

  const goToBookingsFromLoyalty = () => {
    setShowLoyaltyDropdown(false);
    navigate('/home');
    requestAnimationFrame(() => {
      document.getElementById('home-booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  /* initials helper */
  const initials = (name?: string | null) =>
    name
      ? name.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
      : '';

  return (
    <>
      {!isAuthPage && <AccountSidebar open={accountSidebarOpen} onClose={() => setAccountSidebarOpen(false)} />}

      <header
        className="sticky top-0 z-50 bg-white border-b"
        style={{ borderBottomColor: 'rgba(12,29,58,0.1)' }}
      >
        <div
          className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-3"
          style={{ minHeight: LANDING_NAV_HEIGHT }}
        >

          {/* ── left: back + logo (sizes match hero `.landing-page` navbar) ── */}
          <div className="flex min-w-0 flex-1 items-center gap-[clamp(10px,1.5vw,14px)] pr-2">
            {!isHomePage && (
              <button
                onClick={() => navigate(-1)}
                className="shrink-0 rounded-xl p-2 transition-colors hover:bg-gray-100"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/')}
              className="group flex min-w-0 max-w-full shrink items-center gap-[clamp(10px,1.5vw,14px)] text-left transition-opacity hover:opacity-90"
              aria-label="Go to home"
            >
              <AppLogo variant="landingNav" className="shrink-0" />
              <div className="min-w-0">
                <p
                  className="truncate whitespace-nowrap"
                  style={{ ...landingNavBrandNameStyle, color: NAVY }}
                >
                  {BRAND_NAME}
                </p>
                <p
                  className="hidden md:block"
                  style={{ ...landingNavTaglineStyle, color: landingNavTaglineLightColor }}
                >
                  {TAGLINE}
                </p>
              </div>
            </button>
          </div>

          {/* ── right: loyalty + account ── */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* loyalty pill — only when signed in and not on auth pages */}
            {hasCustomerSession && !isAuthPage && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    const nextOpen = !showLoyaltyDropdown;
                    setShowLoyaltyDropdown(nextOpen);
                    // Pull fresh overview whenever the panel is opened so progress
                    // reflects recent completion updates from manager/washer actions.
                    if (nextOpen && hasCustomerSession && session?.accessToken) {
                      void refreshLoyaltyOverview(session.accessToken);
                    }
                  }}
                  disabled={loyaltyLoading}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 disabled:opacity-60"
                  style={{
                    background: NAVY,
                    borderColor: 'rgba(201,168,76,0.4)',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(201,168,76,0.25)' }}
                  >
                    <Award className="w-3 h-3" style={{ color: GOLD }} />
                  </div>
                  <span className="text-xs font-semibold text-white hidden sm:block">
                    {loyaltyLoading ? '…' : loyaltyLabel ?? 'Rewards'}
                  </span>
                  {/* mini progress strip */}
                  <div className="w-12 h-1 rounded-full overflow-hidden hidden sm:block" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${loyaltyFraction * 100}%` }}
                      className="h-full rounded-full"
                      style={{ background: GOLD }}
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {showLoyaltyDropdown && (
                    <>
                      <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                        onClick={() => setShowLoyaltyDropdown(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        className="absolute right-0 mt-2 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl overflow-hidden shadow-2xl"
                        style={{
                          background: NAVY,
                          boxShadow: '0 20px 60px rgba(12,29,58,0.35)',
                          border: '1px solid rgba(201,168,76,0.2)',
                        }}
                      >
                        {/* header stripe */}
                        <div className="px-5 pt-5 pb-4 flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: 'rgba(201,168,76,0.2)' }}
                          >
                            <Award className="w-5 h-5" style={{ color: GOLD }} />
                          </div>
                          <div className="flex-1 pr-6">
                            <p
                              className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                              style={{ color: GOLD }}
                            >
                              Loyalty Rewards
                            </p>
                            <h3 className="text-base font-bold text-white leading-snug">
                              {loyaltyPrimary ? loyaltyPrimary.branch_name : 'Your Rewards Progress'}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowLoyaltyDropdown(false)}
                            className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* gold separator */}
                        <div className="h-px mx-5" style={{ background: 'rgba(201,168,76,0.2)' }} />

                        <div className="px-5 py-4">
                          {loyaltyPrimary ? (
                            <div className="space-y-4">
                              {/* progress bars */}
                              <div className="flex items-center gap-1">
                                {(() => {
                                  const n = Math.max(1, loyaltyPrimary.qualifying_service_count);
                                  const cap = Math.min(12, n);
                                  const filled = Math.min(cap, Math.floor((loyaltyPrimary.eligible_services_in_window / n) * cap));
                                  return Array.from({ length: cap }).map((_, i) => (
                                    <div
                                      key={i}
                                      className="flex-1 h-2 rounded-full transition-all duration-300"
                                      style={{
                                        background: i < filled
                                          ? `linear-gradient(90deg, ${GOLD} 0%, ${GOLD2} 100%)`
                                          : 'rgba(255,255,255,0.12)',
                                      }}
                                    >
                                      {i === cap - 1 && (
                                        <div className="relative -top-7 left-1/2 -translate-x-1/2">
                                          <div
                                            className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
                                            style={{ background: GOLD }}
                                          >
                                            <Award className="w-3.5 h-3.5" style={{ color: NAVY }} />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ));
                                })()}
                              </div>

                              <div
                                className="flex items-center justify-between pt-3 text-sm"
                                style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}
                              >
                                <div>
                                  <p className="text-xs mb-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Eligible washes in window</p>
                                  <p className="text-lg font-bold text-white">
                                    {loyaltyPrimary.eligible_services_in_window}
                                    <span className="text-sm font-normal ml-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                      / {loyaltyPrimary.qualifying_service_count}
                                    </span>
                                  </p>
                                </div>
                                <div
                                  className="text-right text-xs px-3 py-1.5 rounded-full"
                                  style={{ background: 'rgba(201,168,76,0.15)', color: GOLD2 }}
                                >
                                  {Math.round(loyaltyFraction * 100)}% complete
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                {`Complete eligible washes to earn loyalty points and unlock member rewards at ${BRAND_NAME}.`}
                              </p>
                              <button
                                type="button"
                                onClick={goToBookingsFromLoyalty}
                                className="w-full rounded-xl py-2.5 text-sm font-semibold text-center transition-all hover:brightness-105"
                                style={{ background: GOLD, color: NAVY, boxShadow: '0 2px 8px rgba(201,168,76,0.3)' }}
                              >
                                Book a Wash
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* sign-in / profile */}
            {isAuthPage ? null : !hasCustomerSession ? (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:opacity-90"
                style={{ background: NAVY, color: '#fff' }}
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAccountSidebarOpen(true)}
                className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border transition-all hover:shadow-sm"
                style={{
                  background: '#f8f9fc',
                  borderColor: 'rgba(12,29,58,0.15)',
                }}
                aria-label="Open account menu"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: NAVY, color: GOLD }}
                >
                  {initials(session?.fullName) || <CircleUser className="w-4 h-4 text-white" />}
                </div>
                <span className="text-sm font-medium hidden sm:block max-w-[90px] truncate" style={{ color: NAVY }}>
                  {session?.fullName?.split(' ')[0] ?? 'Account'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
