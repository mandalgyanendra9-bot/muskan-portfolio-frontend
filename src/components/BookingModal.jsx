import { useState } from "react";
import PaymentButton from "./PaymentButton";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const BookingModal = ({ expert, onClose }) => {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [bookingData, setBookingData] = useState({
    expert: expert._id,
    date: "",
    duration: 1,
    totalPrice: expert.hourlyRate,
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
      totalPrice: duration * expert.hourlyRate
    });
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

            {/* Step 2: Choose Available Slot */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Step 2: Choose Time Slot</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {timeSlots.map(time => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleSlotSelect(time)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                      selectedTime === time 
                        ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/25' 
                        : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Duration (Hours)</label>
                <select 
                  className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-6 py-4.5 focus:border-primary-500 transition-all text-text-main text-sm"
                  value={bookingData.duration}
                  onChange={handleDurationChange}
                >
                  {[1, 2, 3, 4, 5].map(h => <option key={h} value={h}>{h} Hour{h > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Total Amount (₹)</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4.5 font-extrabold text-xl text-primary-400 flex items-center">
                  ₹{bookingData.totalPrice}
                </div>
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
