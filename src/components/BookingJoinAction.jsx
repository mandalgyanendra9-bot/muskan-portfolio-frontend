import { useEffect, useMemo } from "react";
import { getBookingJoinState } from "../utils/bookingTime";

const BookingJoinAction = ({
  booking,
  user,
  now = 0,
  onJoin,
  className = "",
  showBlocked = true,
}) => {
  const joinState = useMemo(() => getBookingJoinState(booking, user, now), [booking, now, user]);

  useEffect(() => {
    if (!booking?._id) return;
    console.info("[Booking Join]", {
      bookingId: joinState.bookingId,
      paymentStatus: joinState.paymentStatus,
      bookingStatus: joinState.bookingStatus,
      isClient: joinState.isClient,
      isExpert: joinState.isExpert,
      canJoin: joinState.canJoin,
      joinReasonBlocked: joinState.joinReasonBlocked,
      serverNow: joinState.serverNow,
      startAt: joinState.startAt,
      endAt: joinState.endAt,
      joinStart: joinState.joinStart,
      joinEnd: joinState.joinEnd,
    });
  }, [
    booking?._id,
    joinState.bookingId,
    joinState.bookingStatus,
    joinState.canJoin,
    joinState.endAt,
    joinState.isClient,
    joinState.isExpert,
    joinState.joinEnd,
    joinState.joinReasonBlocked,
    joinState.joinStart,
    joinState.paymentStatus,
    joinState.serverNow,
    joinState.startAt,
  ]);

  if (!joinState.show || (!joinState.canJoin && !showBlocked)) return null;

  const label = joinState.canJoin
    ? "Join Room"
    : joinState.countdownLabel || joinState.joinReasonBlocked;

  return (
    <button
      type="button"
      disabled={!joinState.canJoin}
      onClick={() => joinState.canJoin && onJoin?.(booking)}
      title={joinState.canJoin ? "Join Room" : joinState.joinReasonBlocked}
      className={
        className ||
        `flex-1 rounded-xl px-4 py-3 text-xs font-bold transition-all ${
          joinState.canJoin
            ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20 hover:bg-primary-600 active:scale-95"
            : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-400"
        }`
      }
    >
      {label}
    </button>
  );
};

export default BookingJoinAction;
