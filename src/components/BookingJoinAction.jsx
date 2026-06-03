import { useEffect, useMemo, useState } from "react";
import { isAdminUser } from "../utils/adminAccess";
import { getBookingJoinState } from "../utils/bookingTime";

const BookingJoinAction = ({
  booking,
  user,
  now = 0,
  onJoin,
  className = "",
  showBlocked = true,
  showDebug,
}) => {
  const [localNow, setLocalNow] = useState(() => Date.now());
  const currentNow = Number.isFinite(Number(now)) && Number(now) > 0 ? Number(now) : localNow;
  const joinState = useMemo(() => getBookingJoinState(booking, currentNow), [booking, currentNow]);
  const debugEnabled = showDebug ?? (import.meta.env.DEV || isAdminUser(user));

  useEffect(() => {
    if (Number.isFinite(Number(now)) && Number(now) > 0) return undefined;
    const timer = window.setInterval(() => setLocalNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [now]);

  if (!joinState.show) return null;
  if (!joinState.canJoin && !showBlocked) return null;

  return (
    <div className="flex-1 min-w-[10rem]">
      <button
        type="button"
        disabled={!joinState.canJoin}
        onClick={() => joinState.canJoin && onJoin?.(booking)}
        title={joinState.canJoin ? "Join Room" : joinState.joinReason}
        className={
          className ||
          `w-full rounded-xl px-4 py-3 text-xs font-bold transition-all ${
            joinState.canJoin
              ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 active:scale-95"
              : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-400"
          }`
        }
      >
        {joinState.label}
      </button>
      {debugEnabled && (
        <details className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left text-[10px] text-slate-400">
          <summary className="cursor-pointer font-bold uppercase tracking-wider text-slate-500">Join debug</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono">
            <dt>bookingId</dt>
            <dd className="truncate">{joinState.bookingId || booking?._id || "n/a"}</dd>
            <dt>status</dt>
            <dd>{joinState.status || "n/a"}</dd>
            <dt>paymentStatus</dt>
            <dd>{joinState.paymentStatus || "n/a"}</dd>
            <dt>canJoin</dt>
            <dd>{String(joinState.canJoin)}</dd>
            <dt>joinReason</dt>
            <dd>{joinState.joinReason || "n/a"}</dd>
            <dt>secondsUntilJoin</dt>
            <dd>{joinState.secondsUntilJoin ?? "n/a"}</dd>
            <dt>secondsUntilEnd</dt>
            <dd>{joinState.secondsUntilEnd ?? "n/a"}</dd>
          </dl>
        </details>
      )}
    </div>
  );
};

export default BookingJoinAction;
