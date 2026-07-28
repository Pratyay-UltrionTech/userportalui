import { Award } from 'lucide-react';
import { BOOKING_NAVY_MID } from './bookingFlowSection';

/** Shared service-duration notice for service selection, date/time, and summary steps. */
export function BookingDisclaimerNotes() {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0">
        <Award className="h-4 w-4" style={{ color: BOOKING_NAVY_MID }} aria-hidden />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold text-gray-900">Service Duration</p>
        <p className="text-xs leading-relaxed text-gray-600">
          Core wash services take around 60 minutes, with an additional 30 minutes for each add-on service.
          Timing may vary during peak hours or same-day bookings.
        </p>
      </div>
    </div>
  );
}
