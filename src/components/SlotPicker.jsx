import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

/**
 * SlotPicker
 * -------
 * Props:
 *   - expertId: string – the MongoDB _id of the expert whose slots we fetch.
 *   - onSelect: (slot: { start: Date; end: Date }) => void – callback when a slot is chosen.
 *
 * The component fetches slots from the backend endpoint `/api/slots/:expertId`.
 * Each slot returned by the API is expected to have `slotStart` and `slotEnd` ISO strings.
 * The UI displays the slots in a responsive grid. Selecting a slot highlights it
 * and informs the parent via `onSelect`.
 */
export default function SlotPicker({ expertId, onSelect }) {
  const [slots, setSlots] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!expertId) return;
    const fetchSlots = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/slots/${expertId}`);
        // Expected shape: [{ slotStart: '2026-05-30T09:00:00Z', slotEnd: '2026-05-30T09:30:00Z' }, ...]
        const parsed = data.map((s) => ({
          start: new Date(s.slotStart),
          end: new Date(s.slotEnd),
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
  }, [expertId]);

  const handleSelect = (idx) => {
    setSelectedIdx(idx);
    onSelect(slots[idx]);
  };

  if (loading) {
    return <p className="text-sm text-gray-400">Loading available slots…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (slots.length === 0) {
    return <p className="text-sm text-gray-500">No slots available for the selected expert.</p>;
  }

  return (
    <AnimatePresence>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {slots.map((slot, idx) => {
          const startStr = slot.start.toLocaleString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true });
          const endStr = slot.end.toLocaleString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true });
          const isSelected = idx === selectedIdx;
          return (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(idx)}
              className={`p-4 rounded-xl border ${isSelected ? 'border-primary-500 bg-primary-500/10' : 'border-gray-300'} transition-colors`}
            >
              <span className="block font-medium text-gray-200">{startStr} – {endStr}</span>
            </motion.button>
          );
        })}
      </div>
    </AnimatePresence>
  );
}
