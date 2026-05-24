import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import SlotPicker from "./SlotPicker";
import PaymentButton from "./PaymentButton";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

const BookingModal = ({ expert, onClose }) => {
  const { user } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingData, setBookingData] = useState({
    expert: expert._id,
    duration: expert.slotDuration || 30,
    totalPrice: expert.pricePerMinute * (expert.slotDuration || 30),
    notes: "",
    // date, slotStart, slotEnd will be set after slot selection
  });

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    setBookingData((prev) => ({
      ...prev,
      date: slot.start.toISOString(),
      slotStart: slot.start.toISOString(),
      slotEnd: slot.end.toISOString(),
    }));
  };

  const isPriorityBooking = user?.subscriptionPlan === "premium";

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
          {isPriorityBooking && (
            <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                VIP Priority Booking
              </p>
              <p className="text-sm text-slate-300 mt-1">
                Your request will appear first in the expert's booking queue.
              </p>
            </div>
          )}
          <SlotPicker expertId={expert._id} onSelect={handleSlotSelect} />
          <div className="space-y-2 mt-4">
            <label className="text-xs font-bold uppercase text-slate-500">
              Notes for Expert (Optional)
            </label>
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
          <button
            onClick={onClose}
            className="w-full mt-4 text-slate-500 hover:text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Cancel &amp; Go Back
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BookingModal;
