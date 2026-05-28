/**
 * TimePicker - 12 hour format selector
 * Props:
 *   value: string (HH:MM AM/PM) optional initial value
 *   onChange: function(selectedTime: string) called with formatted time "HH:MM AM/PM"
 */
const TimePicker = ({ value = "", onChange }) => {
  const parse = (val) => {
    if (!val) return { hour: "01", minute: "00", period: "AM" };
    const [time, period] = val.split(" ");
    const [hour, minute] = time.split(":");
    return { hour, minute, period };
  };
  const { hour, minute, period } = parse(value);

  const hours = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0")
  );
  const minutes = ["00", "15", "30", "45"];
  const periods = ["AM", "PM"];

  const emitChange = (h, m, p) => {
    const formatted = `${h}:${m} ${p}`;
    onChange && onChange(formatted);
  };

  return (
    <div className="flex space-x-2 items-center">
      <select
        value={hour}
        onChange={(e) => emitChange(e.target.value, minute, period)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
      >
        {hours.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-white">:</span>
      <select
        value={minute}
        onChange={(e) => emitChange(hour, e.target.value, period)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={period}
        onChange={(e) => emitChange(hour, minute, e.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
      >
        {periods.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimePicker;
