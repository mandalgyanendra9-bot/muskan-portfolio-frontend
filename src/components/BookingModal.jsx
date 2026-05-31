import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import SlotPicker from "./SlotPicker";
import PaymentButton from "./PaymentButton";
import { motion, AnimatePresence } from "framer-motion";

const getDurationMinutes = (expert) => Number(expert?.slotDuration) || 30;

const getRatePerMinute = (expert) => {
  const directRate = Number(expert?.perMinuteRate) || Number(expert?.pricePerMinute) || 0;
  if (directRate > 0) return directRate;
  return (Number(expert?.hourlyRate) || 0) / 60;
};

const getTotalPrice = (expert, durationMinutes) =>
  Math.max(0, Math.round(getRatePerMinute(expert) * durationMinutes * 100) / 100);

const formatMoney = (value = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value) || 0);

const BookingModal = ({ expert, onClose }) => {
  const { user } = useAuth();
  const initialDuration = Math.min(getDurationMinutes(expert), 60) || 5;
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingData, setBookingData] = useState({
    expert: expert._id,
    duration: initialDuration,
    durationMinutes: initialDuration,
    totalPrice: getTotalPrice(expert, initialDuration),
    totalAmount: getTotalPrice(expert, initialDuration),
    notes: "",
    // date, slotStart, slotEnd will be set after slot selection
  });

  const handleSlotSelect = (slot) => {
    if (!slot) {
      setSelectedSlot(null);
      setBookingData((prev) => ({
        ...prev,
        date: undefined,
        startTime: undefined,
        endTime: undefined,
        slotStart: undefined,
        slotEnd: undefined,
      }));
      return;
    }

    const durationMinutes = Math.max(1, Math.round((slot.end.getTime() - slot.start.getTime()) / 60000));
    const totalAmount = slot.totalAmount ?? getTotalPrice(expert, durationMinutes);
    setSelectedSlot(slot);
    setBookingData((prev) => ({
      ...prev,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotStart: slot.start.toISOString(),
      slotEnd: slot.end.toISOString(),
      duration: durationMinutes,
      durationMinutes,
      perMinuteRate: slot.ratePerMinute ?? getRatePerMinute(expert),
      totalPrice: totalAmount,
      totalAmount,
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
          <p className="mb-5 text-sm leading-relaxed text-slate-400">
            Payments on Muskan Expert are collected only for professional consultation and expert booking services.
          </p>
          {isPriorityBooking && (
            <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                Professional Priority Booking
              </p>
              <p className="text-sm text-slate-300 mt-1">
                Your request will appear first in the expert's booking queue.
              </p>
            </div>
          )}
          <SlotPicker expert={expert} expertId={expert._id} onSelect={handleSlotSelect} />
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
            <div className="my-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400">Expert rate</span>
                <span className="font-bold text-white">{formatMoney(bookingData.perMinuteRate || getRatePerMinute(expert))}/min</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-400">Selected duration</span>
                <span className="font-bold text-white">{bookingData.duration} minutes</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-400">Start time</span>
                <span className="font-bold text-white">{selectedSlot.displayStart}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-slate-400">End time</span>
                <span className="font-bold text-white">{selectedSlot.displayEnd}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                <span className="text-slate-400">Total payable</span>
                <span className="font-extrabold text-emerald-300">{formatMoney(bookingData.totalPrice)}</span>
              </div>
            </div>
          ) : null}
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
