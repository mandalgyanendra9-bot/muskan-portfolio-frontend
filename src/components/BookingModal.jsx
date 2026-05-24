import { useState } from "react";
import PaymentButton from "./PaymentButton";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import TimePicker from "./TimePicker";
import SlotPicker from "./SlotPicker";

const BookingModal = ({ expert, onClose }) => {
  const { user } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingData, setBookingData] = useState({
    expert: expert._id,
    duration: expert.slotDuration || 30,
    totalPrice: expert.pricePerMinute * (expert.slotDuration || 30),
    notes: "",
  });

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    // slot contains start and end Date objects
    setBookingData((prev) => ({
      ...prev,
      date: slot.start.toISOString(),
      slotStart: slot.start.toISOString(),
      slotEnd: slot.end.toISOString(),
    }));
  };

  const handleProceed = () => {
    // proceed to payment flow (existing PaymentButton expects bookingData)
    // PaymentButton will handle creating order with slot info.
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg glass p-10 rounded-[3rem] border-white/10 shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin"
        >
          <h2 className="text-3xl font-extrabold mb-1">
            Book <span className="text-primary-400">{expert.name}</span>
          </h2>
          {/* Slot Picker */}
          <SlotPicker expertId={expert._id} onSelect={handleSlotSelect} />
          {/* Optional Notes */}
          <div className="space-y-2 mt-4">
            <label className="text-xs font-bold uppercase text-slate-500">Notes for Expert (Optional)</label>
            <textarea
              rows="3"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all text-text-main text-sm"
              value={bookingData.notes}
              onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
            />
          </div>
          {selectedSlot ? (
            <PaymentButton
              bookingData={bookingData}
              onSuccess={() => {
                onClose();
                window.location.href = "/dashboard";
              }}
            />
          ) : (
            <button
              disabled
              className="w-full bg-slate-800 text-slate-500 font-bold py-4.5 rounded-2xl text-xs uppercase tracking-wider cursor-not-allowed"
            >
              Select a slot first
            </button>
          )}
          <button onClick={onClose} className="w-full mt-4 text-slate-500 hover:text-white text-sm font-medium transition-colors cursor-pointer">
            Cancel & Go Back
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BookingModal;
import TimePicker from "./TimePicker";

const BookingModal = ({ expert, onClose }) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const isPriorityBooking = user?.subscriptionPlan === "premium";
  const [bookingData, setBookingData] = useState({
    expert: expert._id,
    date: "",
    duration: 10, // default minutes
    totalPrice: 200, // default price in rupees
    notes: ""
  });

  const timeSlots = [
    "10:00 AM",
    "11:30 AM",
    "01:00 PM",
    "02:30 PM",
    "04:00 PM",
    "05:30 PM",
    "07:00 PM"
  ];

  const handleDurationChange = (e) => {
    const duration = parseInt(e.target.value);
    setBookingData({
      ...bookingData,
      duration,
    });
  };
const handlePriceChange = (e) => {
  const price = parseInt(e.target.value);
  setBookingData({ ...bookingData, totalPrice: price });
};

  const handleSlotSelect = (time) => {
    if (!selectedDate) {
      toast.error("Please pick a date from the calendar first!");
      return;
    }
    setSelectedTime(time);
    
    // Parse Date and Time into a combined datetime string
    // e.g. Date: "2026-05-18", Time: "02:30 PM"
    const [hoursMinutes, period] = time.split(" ");
    let [hours, minutes] = hoursMinutes.split(":");
    hours = parseInt(hours);
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    
    const combinedDate = new Date(selectedDate);
    combinedDate.setHours(hours);
    combinedDate.setMinutes(parseInt(minutes));
    
    setBookingData(prev => ({
      ...prev,
      date: combinedDate.toISOString()
    }));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg glass p-10 rounded-[3rem] border-white/10 shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-primary-500 to-accent" />
          
          <h2 className="text-3xl font-extrabold mb-1">Book <span className="text-primary-400">{expert.name}</span></h2>
          <p className="text-text-muted text-sm mb-6 italic">Select a slot to confirm your consultation session.</p>
          {isPriorityBooking && (
            <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">VIP Priority Booking</p>
              <p className="text-sm text-slate-300 mt-1">Your request will appear first in the expert's booking queue.</p>
            </div>
          )}

          <div className="space-y-6 mb-8">
            {/* Step 1: Select Date */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Step 1: Choose Date</label>
              <input 
                type="date" 
                min={new Date().toISOString().split("T")[0]}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all text-text-main text-sm"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTime(""); // Reset time on date change
                }}
                required
              />
            </div>

            {/* Step 2: Choose Start Time */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Select Start Time</label>
              <select
                className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4.5 focus:border-primary-500 transition-all text-text-main text-sm"
                value={selectedTime}
                onChange={(e) => handleSlotSelect(e.target.value)}
                required
              >
                <option value="">-- Choose Time --</option>
                {timeSlots.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Duration (Minutes)</label>
                <select 
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4.5 focus:border-primary-500 transition-all text-text-main text-sm"
                  value={bookingData.duration}
                  onChange={handleDurationChange}
                >
                  {[10, 20, 30, 40, 50].map(m => (
                    <option key={m} value={m}>{m} Minutes</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Total Amount (₹)</label>
                <select 
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4.5 focus:border-primary-500 transition-all text-text-main text-sm"
                  value={bookingData.totalPrice}
                  onChange={handlePriceChange}
                >
                  {[200, 400, 500, 600].map(p => (
                    <option key={p} value={p}>₹{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Notes for Expert (Optional)</label>
              <textarea 
                placeholder="What topics or technical blocks do you want to resolve during the call?"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all text-text-main text-sm"
                rows="3"
                value={bookingData.notes}
                onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
              />
            </div>
          </div>

          {bookingData.date ? (
            <PaymentButton 
              bookingData={bookingData} 
              onSuccess={() => {
                onClose();
                window.location.href = "/dashboard";
              }}
            />
          ) : (
            <button
              disabled
              className="w-full bg-slate-800 text-slate-500 font-bold py-4.5 rounded-2xl text-xs uppercase tracking-wider cursor-not-allowed"
            >
              Please pick date & slot first
            </button>
          )}
          
          <button 
            onClick={onClose}
            className="w-full mt-4 text-slate-500 hover:text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Cancel & Go Back
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BookingModal;
