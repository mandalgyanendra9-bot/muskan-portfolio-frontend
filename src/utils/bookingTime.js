export const DEFAULT_BOOKING_TIMEZONE = "Asia/Kolkata";
export const JOIN_WINDOW_EARLY_MINUTES = 5;

const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const safeTimezone = (timezone) => {
  const cleanTimezone = timezone || DEFAULT_BOOKING_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-IN", { timeZone: cleanTimezone }).format(new Date());
    return cleanTimezone;
  } catch {
    return DEFAULT_BOOKING_TIMEZONE;
  }
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
};

const normalizeStatus = (status) => String(status || "").trim().toLowerCase();

const normalizeClock = (value = "") => {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):([0-5]\d)(?:\s*(AM|PM))?$/i);
  if (!match) return text;
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3]?.toUpperCase();
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour !== 12) hour += 12;
  if (hour < 0 || hour > 23) return text;
  const displayPeriod = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${displayPeriod}`;
};

export const formatDuration = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
};

export const formatTimer = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const stampBookingReceivedAt = (booking, receivedAt = Date.now()) => (
  booking ? { ...booking, __receivedAt: receivedAt } : booking
);

export const stampBookingsReceivedAt = (bookings = [], receivedAt = Date.now()) => (
  Array.isArray(bookings) ? bookings.map((booking) => stampBookingReceivedAt(booking, receivedAt)) : []
);

const getJoinDiagnostics = (booking = {}) => booking.joinDiagnostics || booking.callAccess || {};

const getServerSyncedNow = (booking = {}, now = Date.now()) => {
  const localNow = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const diagnostics = getJoinDiagnostics(booking);
  const serverNow = parseDate(diagnostics.serverNow || booking.serverNow);
  const receivedAt = Number(booking.__receivedAt || diagnostics.receivedAt || 0);
  if (!serverNow || !Number.isFinite(receivedAt) || receivedAt <= 0) return localNow;
  return serverNow.getTime() + Math.max(0, localNow - receivedAt);
};

export const getBookingTimezone = (booking = {}) => safeTimezone(booking.timezone || booking.expert?.timezone || booking.client?.timezone);

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

export const getBookingDurationMinutes = (booking = {}) => Number(booking.durationMinutes || booking.duration || 0);

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
  const timezone = getBookingTimezone(booking);
  const start = getBookingStartDate(booking);
  const end = getBookingEndDate(booking);

  if (start && end) {
    return `${formatBookingTime(start, timezone)} - ${formatBookingClock(end, timezone)}`;
  }

  if (booking.date && booking.startTime) {
    const endText = booking.endTime ? ` - ${normalizeClock(booking.endTime)}` : "";
    return `${booking.date} ${normalizeClock(booking.startTime)}${endText}`;
  }

  return "Schedule not set";
};

export const getBookingJoinState = (booking = {}, now = Date.now()) => {
  const diagnostics = getJoinDiagnostics(booking);
  const effectiveNow = getServerSyncedNow(booking, now);
  const status = normalizeStatus(diagnostics.status || booking.status);
  const bookingStatus = normalizeStatus(diagnostics.bookingStatus || booking.bookingStatus || booking.status);
  const paymentStatus = normalizeStatus(diagnostics.paymentStatus || booking.paymentStatus);
  const isPaid = paymentStatus === "paid";
  const isConfirmed = status === "confirmed" || bookingStatus === "confirmed";
  const isCompleted = status === "completed" || bookingStatus === "completed";
  const shouldShow = isPaid && (isConfirmed || isCompleted);

  if (!shouldShow) {
    return {
      show: false,
      canJoin: false,
      state: "hidden",
      label: "Join Room",
      bookingId: booking._id || diagnostics.bookingId || "",
      status,
      bookingStatus,
      paymentStatus,
      joinReason: diagnostics.joinReason || "not_paid_confirmed",
      secondsUntilJoin: diagnostics.secondsUntilJoin ?? null,
      secondsUntilEnd: diagnostics.secondsUntilEnd ?? null,
      serverNow: diagnostics.serverNow || booking.serverNow || null,
    };
  }

  const start = parseDate(diagnostics.startsAt || diagnostics.startAt) || getBookingStartDate(booking);
  const end = parseDate(diagnostics.endsAt || diagnostics.endAt) || getBookingEndDate(booking);
  if (!start || !end) {
    return {
      show: true,
      canJoin: false,
      state: "invalid",
      label: "Join time unavailable",
      bookingId: booking._id || diagnostics.bookingId || "",
      status,
      bookingStatus,
      paymentStatus,
      joinReason: diagnostics.joinReason || "time_unavailable",
      secondsUntilJoin: null,
      secondsUntilEnd: null,
      serverNow: diagnostics.serverNow || booking.serverNow || null,
    };
  }

  const diagnosticJoinOpensAt = parseDate(diagnostics.joinOpensAt);
  const joinOpensAt = diagnosticJoinOpensAt
    ? diagnosticJoinOpensAt.getTime()
    : start.getTime() - JOIN_WINDOW_EARLY_MINUTES * 60 * 1000;
  const endAt = end.getTime();
  const secondsUntilJoin = Math.max(0, Math.ceil((joinOpensAt - effectiveNow) / 1000));
  const secondsUntilEnd = Math.max(0, Math.ceil((endAt - effectiveNow) / 1000));

  if (isCompleted || effectiveNow >= endAt) {
    return {
      show: true,
      canJoin: false,
      state: "ended",
      label: "Session ended",
      bookingId: booking._id || diagnostics.bookingId || "",
      status,
      bookingStatus,
      paymentStatus,
      joinReason: "session_ended",
      secondsUntilJoin,
      secondsUntilEnd,
      joinOpensAt,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      serverNow: diagnostics.serverNow || booking.serverNow || null,
    };
  }

  if (effectiveNow < joinOpensAt) {
    return {
      show: true,
      canJoin: false,
      state: "early",
      label: `Join opens in ${formatTimer(secondsUntilJoin)}`,
      bookingId: booking._id || diagnostics.bookingId || "",
      status,
      bookingStatus,
      paymentStatus,
      joinReason: "before_join_window",
      secondsUntilJoin,
      secondsUntilEnd,
      joinOpensAt,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      serverNow: diagnostics.serverNow || booking.serverNow || null,
    };
  }

  if (diagnostics.canJoin === false && diagnostics.joinReason && !["before_join_window", "join_open"].includes(diagnostics.joinReason)) {
    const blockedReason = diagnostics.joinReason === "session_ended" ? "session_ended" : diagnostics.joinReason;
    return {
      show: true,
      canJoin: false,
      state: blockedReason === "session_ended" ? "ended" : "blocked",
      label: blockedReason === "session_ended" ? "Session ended" : "Join unavailable",
      bookingId: booking._id || diagnostics.bookingId || "",
      status,
      bookingStatus,
      paymentStatus,
      joinReason: blockedReason,
      secondsUntilJoin,
      secondsUntilEnd,
      joinOpensAt,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      serverNow: diagnostics.serverNow || booking.serverNow || null,
    };
  }

  return {
    show: true,
    canJoin: true,
    state: "active",
    label: "Join Room",
    bookingId: booking._id || diagnostics.bookingId || "",
    status,
    bookingStatus,
    paymentStatus,
    joinReason: "join_open",
    secondsUntilJoin,
    secondsUntilEnd,
    joinOpensAt,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    serverNow: diagnostics.serverNow || booking.serverNow || null,
  };
};

export const maskTransactionId = (transactionId = "") => {
  const text = String(transactionId || "").trim();
  if (!text) return "Not provided";
  if (text.length <= 8) return `${text.slice(0, 2)}****${text.slice(-2)}`;
  return `${text.slice(0, 4)}****${text.slice(-4)}`;
};
