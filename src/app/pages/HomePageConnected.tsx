import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Building2, Car, MapPin } from 'lucide-react';
import { listBranches, syncAdminStateFromPortal } from '../lib/adminPortalBridge';
import { useBooking } from '../context/BookingContext';

export function HomePageConnected() {
  const navigate = useNavigate();
  const { resetBooking, setSelectedBranch, setServiceType } = useBooking();
  const [mode, setMode] = useState<'branch' | 'mobile'>('branch');
  const [query, setQuery] = useState('');
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const changed = await syncAdminStateFromPortal();
      if (mounted && changed) setRefreshSeed((x) => x + 1);
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleBranches = useMemo(() => listBranches(query), [query, refreshSeed]);

  const pickBranch = (branch: { id: string; name: string; location: string }) => {
    resetBooking();
    setServiceType('branch');
    setSelectedBranch({ ...branch, rating: 0, image: '' });
    navigate(`/branch/${branch.id}?serviceType=branch`);
  };

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Book Car Wash</h1>
      </div>

      <div className="inline-flex rounded-lg border p-1">
        <button
          type="button"
          onClick={() => setMode('branch')}
          className={`px-3 py-2 rounded-md text-sm ${mode === 'branch' ? 'bg-indigo-600 text-white' : ''}`}
        >
          <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" /> Branch</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('mobile')}
          className={`px-3 py-2 rounded-md text-sm ${mode === 'mobile' ? 'bg-indigo-600 text-white' : ''}`}
        >
          <span className="inline-flex items-center gap-2"><Car className="h-4 w-4" /> Mobile</span>
        </button>
      </div>

      {mode === 'branch' ? (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Sydney or 2000"
            className="w-full rounded-lg border px-3 py-2"
          />
          <div className="grid gap-3 md:grid-cols-2">
            {visibleBranches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => pickBranch(branch)}
                className="rounded-lg border p-4 text-left hover:border-indigo-500"
              >
                <p className="font-medium">{branch.name}</p>
                <p className="text-sm text-gray-600 inline-flex items-center gap-1 mt-1">
                  <MapPin className="h-4 w-4" /> {branch.location}
                </p>
                <p className="text-xs text-gray-500 mt-2">Bays: {branch.bayCount} | {branch.openTime} - {branch.closeTime}</p>
              </button>
            ))}
          </div>
          {!visibleBranches.length && <p className="text-sm text-gray-500">No branches found. Create branches in Admin portal first.</p>}
        </>
      ) : (
        <p className="text-sm text-gray-600">Mobile service flow is unchanged in this update. Branch flow is now connected to Admin + Manager data.</p>
      )}
    </div>
  );
}
