import { useState } from "react";
import PaymentButton from "./PaymentButton";
import { motion, AnimatePresence } from "framer-motion";

const BookingModal = ({ expert, onClose }) => {
  const [bookingData, setBookingData] = useState({
    expert: expert._id,
    date: "",
    duration: 1,
    totalPrice: expert.hourlyRate,
    notes: ""
  });

  const handleDurationChange = (e) => {
    const duration = parseInt(e.target.value);
    setBookingData({
      ...bookingData,
      duration,
      totalPrice: duration * expert.hourlyRate
    });
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
          className="relative w-full max-w-lg glass p-10 rounded-[3rem] border-white/10 shadow-2xl overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-primary-500 to-accent" />
          
          <h2 className="text-3xl font-bold mb-2">Book <span className="text-primary-400">{expert.name}</span></h2>
          <p className="text-text-muted mb-8 italic">Secure your consultation now.</p>

          <div className="space-y-6 mb-10">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Select Date</label>
              <input 
                type="datetime-local" 
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all text-text-main"
                onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Duration (Hours)</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all text-text-main"
                  value={bookingData.duration}
                  onChange={handleDurationChange}
                >
                  {[1, 2, 3, 4, 5].map(h => <option key={h} value={h}>{h} Hour{h > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Total Amount</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-xl text-primary-400">
                  ₹{bookingData.totalPrice}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Notes for Expert</label>
              <textarea 
                placeholder="What do you want to discuss?"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all text-text-main"
                rows="3"
                onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
              />
            </div>
          </div>

          <PaymentButton 
            bookingData={bookingData} 
            onSuccess={() => {
              onClose();
            }}
          />
          
          <button 
            onClick={onClose}
            className="w-full mt-4 text-slate-500 hover:text-white text-sm font-medium transition-colors"
          >
            Cancel & Go Back
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BookingModal;
