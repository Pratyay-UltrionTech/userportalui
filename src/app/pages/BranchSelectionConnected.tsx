import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useBooking } from '../context/BookingContext';
import { getBranchById, getCatalogForVehicle, listVehicleTypes } from '../lib/adminPortalBridge';

export function BranchSelectionConnected() {
  const navigate = useNavigate();
  const { branchId = '' } = useParams();
  const { setVehicleType, setSelectedService, selectedBranch, setSelectedBranch } = useBooking();
  const [vehicle, setVehicle] = useState('');
  const [serviceId, setServiceId] = useState('');

  const branch = getBranchById(branchId);
  const vehicles = useMemo(() => listVehicleTypes(branchId), [branchId]);
  const catalog = useMemo(() => (vehicle ? getCatalogForVehicle(branchId, vehicle) : { services: [], addons: [] }), [branchId, vehicle]);

  if (branch && (!selectedBranch || selectedBranch.id !== branch.id)) {
    setSelectedBranch({ id: branch.id, name: branch.name, location: branch.location, rating: 0, image: '', openTime: branch.openTime, closeTime: branch.closeTime });
  }

  const continueNext = () => {
    const service = catalog.services.find((s) => s.id === serviceId);
    if (!service || !vehicle) return;
    setVehicleType(vehicle);
    setSelectedService({
      id: service.id,
      name: service.name,
      price: service.price,
      features: service.descriptionPoints ?? [],
      recommended: service.recommended === true,
      freeCoffeeCount: Math.max(0, Math.floor(Number(service.freeCoffeeCount ?? 0))),
      eligibleForLoyaltyPoints: service.eligibleForLoyaltyPoints !== false,
      durationMinutes: service.durationMinutes ?? 60,
    });
    navigate('/addons');
  };

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">{branch?.name ?? 'Branch'}</h1>
      <p className="text-sm text-gray-600">{branch?.location}</p>

      <div className="space-y-2">
        <label className="text-sm font-medium">Vehicle type</label>
        <select value={vehicle} onChange={(e) => { setVehicle(e.target.value); setServiceId(''); }} className="w-full rounded-md border px-3 py-2">
          <option value="">Select vehicle</option>
          {vehicles.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Service</label>
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full rounded-md border px-3 py-2" disabled={!vehicle}>
          <option value="">Select service</option>
          {catalog.services.map((s) => <option key={s.id} value={s.id}>{s.name} - ${s.price.toFixed(2)}</option>)}
        </select>
      </div>

      <button type="button" onClick={continueNext} disabled={!vehicle || !serviceId} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
        Continue
      </button>
    </div>
  );
}
