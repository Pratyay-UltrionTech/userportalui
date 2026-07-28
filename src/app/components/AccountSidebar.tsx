import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { CircleUser, History, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HEADING_FONT_FAMILY } from '../lib/branding';

const GOLD = '#c9a84c';
const NAVY = '#0c1d3a';

type Props = { open: boolean; onClose: () => void };

export function AccountSidebar({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const goProfile = () => { onClose(); navigate('/profile-setup'); };
  const goHistory = () => { onClose(); navigate('/service-history'); };
  const doLogout = () => { onClose(); signOut(); navigate('/login', { replace: true }); };

  /* initials avatar */
  const initials = session?.fullName
    ? session.fullName.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-sidebar-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-sm flex-col shadow-2xl"
            style={{ background: '#fff' }}
          >
            {/* header strip */}
            <div
              className="px-5 py-5 flex items-center gap-4"
              style={{ background: NAVY, borderBottom: `2px solid ${GOLD}` }}
            >
              {/* avatar */}
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ background: GOLD, color: NAVY }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="account-sidebar-title"
                  className="text-base font-bold leading-snug text-white truncate"
                  style={{ fontFamily: HEADING_FONT_FAMILY }}
                >
                  {session?.fullName || 'My Account'}
                </h2>
                {session?.email && (
                  <p className="text-xs truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    {session.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 transition hover:bg-white/10"
                style={{ color: 'rgba(255,255,255,0.7)' }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 p-3">
              {[
                { label: 'Profile', Icon: CircleUser, action: goProfile },
                { label: 'Service History', Icon: History, action: goHistory },
              ].map(({ label, Icon, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-gray-800 transition-all hover:bg-[#e8eef8]"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: '#e8eef8', color: NAVY }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-medium text-sm">{label}</span>
                </button>
              ))}
            </nav>

            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                onClick={doLogout}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium text-red-600 transition-all hover:bg-red-50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                  <LogOut className="h-5 w-5" />
                </span>
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
