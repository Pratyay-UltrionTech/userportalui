import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { useBooking } from '../context/BookingContext';
import { estimateBranchBookingMinutes, listAvailableSlots } from '../lib/adminPortalBridge';

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DateTimePageConnected() {
  const navigate = useNavigate();
  const { selectedBranch, selectedService, selectedAddOns, setSelectedDate, setSelectedTime, setSelectedEndTime } =
    useBooking();
  const bookingDurationMinutes = useMemo(
    () => estimateBranchBookingMinutes(selectedService, selectedAddOns.length),
    [selectedService, selectedAddOns]
  );
  const [date, setDate] = useState<Date>(new Date());
  const [slotKey, setSlotKey] = useState('');
  const [slots, setSlots] = useState<Array<{ startTime: string; endTime: string; label: string; capacity: number; available: number }>>([]);
  const dateISO = isoDate(date);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!selectedBranch) {
        if (mounted) setSlots([]);
        return;
      }
      try {
        const next = await listAvailableSlots(selectedBranch.id, dateISO, bookingDurationMinutes);
        if (mounted) setSlots(next);
      } catch {
        if (mounted) setSlots([]);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [selectedBranch, dateISO, bookingDurationMinutes]);

  const continueNext = () => {
    const picked = slots.find((s) => `${s.startTime}|${s.endTime}` === slotKey);
    if (!picked) return;
    flushSync(() => {
      setSelectedDate(date);
      setSelectedTime(picked.startTime);
      setSelectedEndTime(picked.endTime);
    });
    navigate('/summary');
  };

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Date & Time</h1>
      <input
        type="date"
        value={dateISO}
        min={isoDate(new Date())}
        onChange={(e) => setDate(new Date(`${e.target.value}T00:00:00`))}
        className="rounded-md border px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-2">
        {slots.map((slot) => {
          const key = `${slot.startTime}|${slot.endTime}`;
          const selected = key === slotKey;
          const disabled = slot.available <= 0;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => setSlotKey(key)}
              className={`rounded-md border p-3 text-left ${selected ? 'border-indigo-600 bg-indigo-50' : ''} ${disabled ? 'opacity-50' : ''}`}
            >
              <p className="font-medium">{slot.label}</p>
              <p className="text-xs text-gray-500">Available: {slot.available} / {slot.capacity}</p>
            </button>
          );
        })}
      </div>
      {!slots.length && <p className="text-sm text-gray-500">No configured slots for this date. Check Branch Manager portal configuration.</p>}
      <button type="button" onClick={continueNext} disabled={!slotKey} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
        Continue
      </button>
    </div>
  );
}
