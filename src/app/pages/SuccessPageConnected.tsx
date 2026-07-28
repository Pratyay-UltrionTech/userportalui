import { useNavigate } from 'react-router';
import { useBooking } from '../context/BookingContext';

export function SuccessPageConnected() {
  const navigate = useNavigate();
  const { selectedBranch, selectedService, selectedDate, selectedTime, selectedEndTime, vehicleType, confirmedBooking, selectedAddOns } = useBooking();

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold text-green-700">Booking Confirmed</h1>
      <div className="rounded-lg border p-4 space-y-2">
        <p><span className="font-medium">Booking ID:</span> {confirmedBooking?.id}</p>
        <p><span className="font-medium">Branch:</span> {selectedBranch?.name}</p>
        <p><span className="font-medium">Location:</span> {selectedBranch?.location}</p>
        <p><span className="font-medium">Service:</span> {selectedService?.name}</p>
        {!!selectedAddOns.length && <p><span className="font-medium">Add-ons:</span> {selectedAddOns.map((a) => a.name).join(', ')}</p>}
        <p><span className="font-medium">Vehicle type:</span> {vehicleType}</p>
        <p><span className="font-medium">Date:</span> {selectedDate?.toDateString()}</p>
        <p><span className="font-medium">Time:</span> {selectedTime}{selectedEndTime ? ` - ${selectedEndTime}` : ''}</p>
        <p><span className="font-medium">Total:</span> ${confirmedBooking?.total.toFixed(2)}</p>
      </div>
      <button type="button" onClick={() => navigate('/home')} className="rounded-md bg-indigo-600 px-4 py-2 text-white">
        Back to Home
      </button>
    </div>
  );
}
