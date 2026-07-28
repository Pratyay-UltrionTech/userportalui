/**
 * useInactivityLogout
 *
 * Automatically signs the customer out after INACTIVITY_MS milliseconds of
 * no user interaction (mouse, keyboard, scroll, touch).
 *
 * This is a standalone hook — it does NOT modify any existing auth or
 * routing logic. Simply mounting it inside the AuthProvider tree is enough.
 */
import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/** 15 minutes of inactivity triggers auto-logout */
const INACTIVITY_MS = 15 * 60 * 1000;

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

export function useInactivityLogout() {
  const { hasCustomerSession, signOut } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only arm the timer while a customer session is active.
    if (!hasCustomerSession) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut();
      }, INACTIVITY_MS);
    };

    // Attach listeners (passive for scroll / touch perf)
    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetTimer, { passive: true })
    );

    // Arm the initial timer
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, resetTimer)
      );
    };
  }, [hasCustomerSession, signOut]);
}
