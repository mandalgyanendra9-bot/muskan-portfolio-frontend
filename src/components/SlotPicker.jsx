import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://muskan-portfolio-backend.onrender.com').replace(/\/+$/, '');
const DURATION_OPTIONS = [5, 7, 10, 15, 30, 60];

const getTodayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRatePerMinute = (expert = {}) => {
  const directRate = Number(expert.perMinuteRate) > 0
    ? Number(expert.perMinuteRate)
    : Number(expert.pricePerMinute) > 0
      ? Number(expert.pricePerMinute)
      : (Number(expert.hourlyRate) || 0) / 60;
  return Math.round(directRate * 100) / 100;
};

const formatMoney = (value = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  }).format(Number(value) || 0);

export default function SlotPicker({ expert, expertId, onSelect }) {
  const resolvedExpertId = expert?._id || expertId;
  const onSelectRef = useRef(onSelect);
  const ratePerMinute = getRatePerMinute(expert);
  const [date, setDate] = useState(getTodayInputValue());
  const [durationMode, setDurationMode] = useState('5');
  const [customDuration, setCustomDuration] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const durationMinutes = useMemo(() => {
    const value = durationMode === 'custom' ? Number(customDuration) : Number(durationMode);
    if (!Number.isInteger(value) || value < 1 || value > 240) return null;
    return value;
  }, [customDuration, durationMode]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      onSelectRef.current?.(null);
      setSelectedIdx(null);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [date, durationMinutes]);

  useEffect(() => {
    if (!resolvedExpertId) return;
    if (!durationMinutes) {
      const invalidTimer = window.setTimeout(() => {
        setSlots([]);
        setLoading(false);
        setError('Invalid duration selected.');
      }, 0);
      return () => window.clearTimeout(invalidTimer);
    }

    const fetchSlots = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(
          `${API_BASE}/api/slots/${encodeURIComponent(resolvedExpertId)}?date=${encodeURIComponent(date)}&durationMinutes=${encodeURIComponent(durationMinutes)}`
        );
        const rawArray = Array.isArray(data)
          ? data
          : Array.isArray(data?.slots) ? data.slots : [];
        const parsed = rawArray.map((slot) => ({
          start: new Date(slot.start),
          end: new Date(slot.end),
          date: slot.date || date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          durationMinutes: slot.durationMinutes || durationMinutes,
          displayStart: slot.displayStart,
          displayEnd: slot.displayEnd,
          ratePerMinute: Number(slot.ratePerMinute) || ratePerMinute,
          totalAmount: Number(slot.totalAmount) || Math.round(ratePerMinute * durationMinutes * 100) / 100,
        }));
        setSlots(parsed);
        setError(null);
      } catch (e) {
        console.error(e);
        const message = e.response?.data?.message || 'Unable to fetch available slots.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [date, durationMinutes, ratePerMinute, resolvedExpertId]);

  const handleSelect = (idx) => {
    setSelectedIdx(idx);
    onSelectRef.current?.(slots[idx]);
  };

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Select date
          </label>
          <input
            type="date"
            value={date}
            min={getTodayInputValue()}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:border-primary-500 text-text-main"
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Expert rate
          </label>
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white font-extrabold">
            {formatMoney(ratePerMinute)}<span className="text-sm text-slate-400 font-semibold">/min</span>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Duration
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {DURATION_OPTIONS.map((minutes) => (
            <button
              type="button"
              key={minutes}
              onClick={() => setDurationMode(String(minutes))}
              className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition-all ${
                durationMode === String(minutes)
                  ? 'border-primary-500 bg-primary-500/15 text-white'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              {minutes} min
            </button>
          ))}
        </div>
        <div className="mt-3 grid sm:grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={() => setDurationMode('custom')}
            className={`rounded-xl border px-4 py-2 text-xs font-extrabold transition-all ${
              durationMode === 'custom'
                ? 'border-primary-500 bg-primary-500/15 text-white'
                : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            Custom duration
          </button>
          {durationMode === 'custom' && (
            <input
              type="number"
              min="1"
              max="240"
              step="1"
              value={customDuration}
              placeholder="Enter minutes, e.g. 7"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
              onChange={(e) => setCustomDuration(e.target.value)}
            />
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading available start times...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && slots.length === 0 && (
        <p className="text-sm text-gray-500">No slots available for selected date.</p>
      )}

      {!loading && !error && slots.length > 0 && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Select start time
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {slots.map((slot, idx) => {
              const isSelected = idx === selectedIdx;
              return (
                <motion.button
                  key={`${slot.startTime}-${idx}`}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelect(idx)}
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    isSelected ? 'border-primary-500 bg-primary-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <span className="block font-extrabold text-gray-100">{slot.displayStart}</span>
                  <span className="block text-xs text-slate-500 mt-1">Ends {slot.displayEnd}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
