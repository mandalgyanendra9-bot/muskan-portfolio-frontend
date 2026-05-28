import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// API base URL – can be set via Vite env variable VITE_API_BASE_URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://muskan-portfolio-backend.onrender.com' : 'http://localhost:5000');


/**
 * SlotPicker
 * -------
 * Props:
 *   - expertId: string – MongoDB _id of the expert whose slots we fetch.
 *   - onSelect: (slot: { start: Date; end: Date }) => void – callback when a slot is chosen.
 *
 * The component fetches slots from `/api/slots/:expertId?date=YYYY-MM-DD`.
 * Each slot returned should contain `slotStart` and `slotEnd` ISO strings.
 * Users can select a date, see available slots, and pick one.
 */
export default function SlotPicker({ expertId, onSelect }) {
  // Date selector – default to today in YYYY-MM-DD format
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch slots whenever expertId or selected date changes
  useEffect(() => {
    if (!expertId) return;
    const fetchSlots = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_BASE}/api/slots/${expertId}?date=${date}`);
        const rawArray = Array.isArray(data)
          ? data
          : Array.isArray(data?.slots) ? data.slots : [];
        const parsed = rawArray.map((s) => ({
          start: new Date(s.start),
          end: new Date(s.end),
          displayStart: s.displayStart,
          displayEnd: s.displayEnd,
        }));
        setSlots(parsed);
        setError(null);
      } catch (e) {
        console.error(e);
        setError('Failed to load slots. Please try again later.');
        toast.error('Unable to fetch available slots.');
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, [expertId, date]);

  const handleSelect = (idx) => {
    setSelectedIdx(idx);
    onSelect && onSelect(slots[idx]);
  };

  // UI rendering
  return (
    <AnimatePresence>
      {/* Date picker */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Select Date
        </label>
        <input
          type="date"
          value={date}
          min={new Date().toISOString().split('T')[0]}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus:border-primary-500 text-text-main"
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading && <p className="text-sm text-gray-400">Loading available slots…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && slots.length === 0 && (
        <p className="text-sm text-gray-500">No slots available for the selected date.</p>
      )}

      {!loading && !error && slots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {slots.map((slot, idx) => {
            const startStr = slot.start.toLocaleString(undefined, {
              hour: 'numeric',
              minute: 'numeric',
              hour12: true,
            });
            const endStr = slot.end.toLocaleString(undefined, {
              hour: 'numeric',
              minute: 'numeric',
              hour12: true,
            });
            const isSelected = idx === selectedIdx;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(idx)}
                className={`p-4 rounded-xl border ${
                  isSelected ? 'border-primary-500 bg-primary-500/10' : 'border-gray-300'
                } transition-colors`}
              >
                <span className="block font-medium text-gray-200">
                  {startStr} – {endStr}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
