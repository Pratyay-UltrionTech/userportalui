import { useEffect, useState } from 'react';
import { listAllBookableVehicleTypes, syncAdminStateFromPortal } from '../lib/adminPortalBridge';
import { pruneCachedMobileSnapshotsToAllowedTypes } from '../lib/mobilePublicBridge';
import { subscribePublicCatalog } from '../lib/publicDataStore';

/**
 * Keeps USER portal catalog in sync with the API (database) while the app is open.
 * Re-renders when the in-memory public catalog updates; also polls on focus/interval.
 */
export function useAdminBridgeSync(intervalMs = 5000): number {
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    return subscribePublicCatalog(() => {
      setSeed((x) => x + 1);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    const runSync = async () => {
      const changed = await syncAdminStateFromPortal();
      if (!mounted) return;
      pruneCachedMobileSnapshotsToAllowedTypes(listAllBookableVehicleTypes());
      if (changed) setSeed((x) => x + 1);
    };

    void runSync();

    const onFocus = () => {
      void runSync();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void runSync();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void runSync();
    }, Math.max(15000, intervalMs));

    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return seed;
}
