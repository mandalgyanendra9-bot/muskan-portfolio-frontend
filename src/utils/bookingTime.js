export const DEFAULT_BOOKING_TIMEZONE = "Asia/Kolkata";
export const JOIN_WINDOW_EARLY_MINUTES = 30;

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
};

const getIdString = (value) => {
  if (!value) return "";
  return String(value?._id || value?.id || value);
};

const safeTimezone = (timezone) => {
  const cleanTimezone = timezone || DEFAULT_BOOKING_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-IN", { timeZone: cleanTimezone }).format(new Date());
    return cleanTimezone;
  } catch {
    return DEFAULT_BOOKING_TIMEZONE;
  }
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const formatDuration = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
};

export const getBookingDurationMinutes = (booking = {}) => Number(booking.durationMinutes || booking.duration || 0);

export const getBookingStartDate = (booking = {}) => (
  parseDate(booking.startAt) ||
  parseDate(booking.slotStart) ||
  parseDate(booking.date) ||
  parseDate(booking.createdAt)
);

export const getBookingEndDate = (booking = {}) => {
  const directEnd = parseDate(booking.endAt) || parseDate(booking.slotEnd);
  if (directEnd) return directEnd;
  const start = getBookingStartDate(booking);
  const durationMinutes = getBookingDurationMinutes(booking);
  return start && durationMinutes > 0 ? new Date(start.getTime() + durationMinutes * 60 * 1000) : null;
};

export const formatBookingTime = (startAt, timezone = DEFAULT_BOOKING_TIMEZONE) => {
  const start = parseDate(startAt);
  if (!start) return "Time not set";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: safeTimezone(timezone),
  }).format(start);
};

export const formatBookingClock = (value, timezone = DEFAULT_BOOKING_TIMEZONE) => {
  const date = parseDate(value);
  if (!date) return "Time not set";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: safeTimezone(timezone),
  }).format(date);
};

export const formatBookingRange = (booking = {}) => {
  const timezone = safeTimezone(booking.timezone || booking.expert?.timezone || booking.client?.timezone);
  const start = getBookingStartDate(booking);
  const end = getBookingEndDate(booking);
  if (start && end) return `${formatBookingTime(start, timezone)} - ${formatBookingClock(end, timezone)}`;
  return "Schedule not set";
};

export const getBookingJoinState = (booking = {}, currentUser = null, now = Date.now()) => {
  const bookingId = getIdString(booking?._id);
  const currentUserId = getIdString(currentUser?._id || currentUser?.id || (typeof currentUser === "string" ? currentUser : ""));
  const clientId = getIdString(booking?.clientId || booking?.client);
  const expertId = getIdString(booking?.expertId || booking?.expert);
  const isClient = Boolean(currentUserId && clientId && currentUserId === clientId);
  const isExpert = Boolean(currentUserId && expertId && currentUserId === expertId);
  const bookingStatus = normalizeStatus(booking.status || booking.bookingStatus);
  const paymentStatus = normalizeStatus(booking.paymentStatus);
  const isConfirmed = bookingStatus === "confirmed" || normalizeStatus(booking.bookingStatus) === "confirmed";
  const isCompleted = bookingStatus === "completed" || normalizeStatus(booking.bookingStatus) === "completed";
  const start = getBookingStartDate(booking);
  const end = getBookingEndDate(booking);
  const joinStart = start ? start.getTime() - JOIN_WINDOW_EARLY_MINUTES * 60 * 1000 : 0;
  const joinEnd = end ? end.getTime() : 0;
  const callAccess = booking.callAccess || {};

  let joinReasonBlocked = "";
  if (!isClient && !isExpert) joinReasonBlocked = "not_booking_participant";
  else if (isCompleted || (joinEnd > 0 && now >= joinEnd)) joinReasonBlocked = "session_ended";
  else if (paymentStatus !== "paid" || !isConfirmed) joinReasonBlocked = "waiting_payment";
  else if (!start || !end || now < joinStart) joinReasonBlocked = "before_join_window";

  const canJoin = !joinReasonBlocked;

  return {
    bookingId,
    bookingStatus,
    paymentStatus,
    isClient,
    isExpert,
    isConfirmed,
    canJoin,
    joinReasonBlocked,
    label: canJoin ? "Join Room" : joinReasonBlocked,
    countdownLabel: joinReasonBlocked === "before_join_window" && joinStart > now
      ? `Join opens in ${formatDuration(Math.ceil((joinStart - now) / 1000))}`
      : "",
    show: Boolean(isClient || isExpert),
    serverNow: callAccess.serverNow || null,
    startAt: start ? start.toISOString() : callAccess.startAt || callAccess.startsAt || null,
    endAt: end ? end.toISOString() : callAccess.endAt || callAccess.endsAt || null,
    joinStart: joinStart ? new Date(joinStart).toISOString() : callAccess.joinStart || callAccess.joinOpensAt || null,
    joinEnd: joinEnd ? new Date(joinEnd).toISOString() : callAccess.joinEnd || callAccess.graceEndsAt || null,
  };
};
