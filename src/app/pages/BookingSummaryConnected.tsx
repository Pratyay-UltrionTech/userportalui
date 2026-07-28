import { useNavigate } from 'react-router';
import { useBooking } from '../context/BookingContext';

export function BookingSummaryConnected() {
  const navigate = useNavigate();
  const { selectedBranch, selectedService, selectedAddOns, selectedDate, selectedTime, selectedEndTime, vehicleType, getTotalPrice } = useBooking();
  const subtotal = getTotalPrice();
  const total = subtotal;

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Booking Summary</h1>
      <div className="rounded-lg border p-4 space-y-2">
        <p><span className="font-medium">Branch:</span> {selectedBranch?.name}</p>
        <p><span className="font-medium">Location:</span> {selectedBranch?.location}</p>
        <p><span className="font-medium">Vehicle:</span> {vehicleType}</p>
        <p><span className="font-medium">Service:</span> {selectedService?.name} (${selectedService?.price.toFixed(2)})</p>
        <p><span className="font-medium">Date:</span> {selectedDate?.toDateString()}</p>
        <p><span className="font-medium">Time:</span> {selectedTime}{selectedEndTime ? ` - ${selectedEndTime}` : ''}</p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="font-medium mb-1">Add-ons</p>
        {!selectedAddOns.length && <p className="text-sm text-gray-500">No add-ons selected</p>}
        {selectedAddOns.map((addon) => (
          <p key={addon.id} className="text-sm">{addon.name} - ${addon.price.toFixed(2)}</p>
        ))}
      </div>
      <div className="rounded-lg border p-4 space-y-1 text-sm">
        <p>Total (inc GST): ${total.toFixed(2)}</p>
        <p className="text-xs text-gray-500">Service and add-on prices include GST.</p>
      </div>
      <button type="button" onClick={() => navigate('/payment')} className="rounded-md bg-indigo-600 px-4 py-2 text-white">
        Proceed to Payment
      </button>
    </div>
  );
}
