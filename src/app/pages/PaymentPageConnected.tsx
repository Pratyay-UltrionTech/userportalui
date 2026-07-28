import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { useBooking } from '../context/BookingContext';
import {
  createOnlineBooking,
  getFreeCoffeeCupsForLineItem,
  listApplicableDiscounts,
  listApplicablePromos,
} from '../lib/adminPortalBridge';

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function PaymentPageConnected() {
  const navigate = useNavigate();
  const {
    selectedBranch,
    selectedService,
    selectedAddOns,
    selectedDate,
    selectedTime,
    vehicleType,
    getTotalPrice,
    setConfirmedBooking,
  } = useBooking();
  const [promoCode, setPromoCode] = useState('');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dateISO = selectedDate ? isoDate(selectedDate) : '';

  const scheduleRules = useMemo(() => {
    if (!selectedBranch || !selectedService || !vehicleType || !dateISO || !selectedTime) return [];
    return listApplicableDiscounts(selectedBranch.id, dateISO, selectedTime, selectedService.id, vehicleType);
  }, [selectedBranch, selectedService, vehicleType, dateISO, selectedTime]);

  const promoOptions = useMemo(() => {
    if (!selectedBranch || !selectedService || !vehicleType || !dateISO) return [];
    return listApplicablePromos(selectedBranch.id, dateISO, selectedService.id, vehicleType);
  }, [selectedBranch, selectedService, vehicleType, dateISO]);

  const subtotal = getTotalPrice();
  const scheduleDiscount = scheduleRules
    .filter((r) => selectedRuleIds.includes(r.id))
    .reduce((sum, r) => sum + (r.discountType === 'percentage' ? (subtotal * r.discountValue) / 100 : r.discountValue), 0);
  const promo = promoOptions.find((p) => p.codeName.toUpperCase() === appliedPromoCode.toUpperCase());
  const promoDiscount = promo ? (promo.discountType === 'percentage' ? ((subtotal - scheduleDiscount) * promo.discountValue) / 100 : promo.discountValue) : 0;
  const servicesIncGst = Math.max(0, subtotal - scheduleDiscount - promoDiscount);
  const tax = 0;
  const total = servicesIncGst;

  const confirm = async () => {
    if (!selectedBranch || !selectedService || !selectedDate || !selectedTime || !vehicleType) return;
    setSubmitting(true);
    const write = await createOnlineBooking({
      branchId: selectedBranch.id,
      customerName: 'Online Customer',
      phone: '-',
      address: '-',
      vehicleType,
      serviceSummary: `${selectedService.name}${selectedAddOns.length ? ` + ${selectedAddOns.map((a) => a.name).join(', ')}` : ''}`,
      serviceId: selectedService.id,
      selectedAddonIds: selectedAddOns.map((a) => a.id),
      slotDate: dateISO,
      startTime: selectedTime,
      tipCents: 0,
      serviceChargedCents: Math.round(total * 100),
    });
    if (!write.ok) {
      setSubmitting(false);
      alert('Slot just became full. Please select another slot.');
      navigate('/datetime');
      return;
    }
    const b = write.booking;
    flushSync(() => {
      setConfirmedBooking({
        id: b.id,
        branchId: selectedBranch.id,
        status: b.status ?? 'scheduled',
        tipCents: typeof b.tip_cents === 'number' ? b.tip_cents : 0,
        subtotal,
        tax,
        discounts: scheduleDiscount + promoDiscount,
        total,
        createdAt: new Date().toISOString(),
        freeCoffeeCount: getFreeCoffeeCupsForLineItem(selectedBranch.id, vehicleType, selectedService.id),
      });
    });
    setSubmitting(false);
    navigate('/success', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Payment</h1>
      <div className="rounded-lg border p-4 space-y-2">
        <p className="font-medium">Day-time discounts</p>
        {!scheduleRules.length && <p className="text-sm text-gray-500">No day-time discounts available for this slot.</p>}
        {scheduleRules.map((rule) => (
          <label key={rule.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selectedRuleIds.includes(rule.id)} onChange={() => setSelectedRuleIds((prev) => prev.includes(rule.id) ? prev.filter((x) => x !== rule.id) : [...prev, rule.id])} />
            {rule.title} ({rule.discountType === 'percentage' ? `${rule.discountValue}%` : `$${rule.discountValue}`})
          </label>
        ))}
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="font-medium">Promo code</p>
        <div className="flex gap-2">
          <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="flex-1 rounded-md border px-3 py-2" placeholder="e.g. SAVE10" />
          <button type="button" onClick={() => setAppliedPromoCode(promoCode.trim())} className="rounded-md border px-3 py-2">Apply</button>
        </div>
        <p className="text-xs text-gray-500">Available: {promoOptions.map((p) => p.codeName).join(', ') || 'None'}</p>
      </div>

      <div className="rounded-lg border p-4 space-y-1 text-sm">
        <p>Service + add-ons (list): ${subtotal.toFixed(2)}</p>
        <p>Discounts: -${(scheduleDiscount + promoDiscount).toFixed(2)}</p>
        <p className="font-semibold">Total (inc GST): ${total.toFixed(2)}</p>
        <p className="text-xs text-gray-500">Catalog prices include GST.</p>
      </div>

      <button type="button" onClick={confirm} disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
        {submitting ? 'Processing...' : 'Confirm Booking'}
      </button>
    </div>
  );
}
