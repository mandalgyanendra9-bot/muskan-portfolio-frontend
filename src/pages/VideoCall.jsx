import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  ConsentModal,
  PrivacyWatermark,
  useWatermarkProtectionEnabled,
  useSensitiveContentProtection,
} from "../components/SensitiveContentProtection";

const API_URL = import.meta.env.VITE_API_URL || "";
const CALL_JOIN_EARLY_MINUTES = 10;
const CONSENT_STORAGE_PREFIX = "video-call-consent";

const formatDuration = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const meetingContainerRef = useRef(null);
  const zegoRef = useRef(null);
  const joinTimerRef = useRef(null);
  const autoEndTriggeredRef = useRef(false);
  const endingRef = useRef(false);
  const suppressLeaveCallbackRef = useRef(false);

  const [booking, setBooking] = useState(null);
  const [callAccess, setCallAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { enabled: watermarkEnabled } = useWatermarkProtectionEnabled();

  const bookingStart = booking?.slotStart ? new Date(booking.slotStart).getTime() : 0;
  const bookingEnd = booking?.slotEnd ? new Date(booking.slotEnd).getTime() : 0;
  const joinOpensAt = callAccess?.joinOpensAt ? new Date(callAccess.joinOpensAt).getTime() : bookingStart - CALL_JOIN_EARLY_MINUTES * 60 * 1000;
  const graceEndsAt = callAccess?.graceEndsAt ? new Date(callAccess.graceEndsAt).getTime() : bookingEnd;
  const canJoinNow = Boolean(
    booking &&
      booking.status === "confirmed" &&
      booking.paymentStatus === "paid" &&
      nowTick >= joinOpensAt &&
      nowTick < bookingEnd &&
      nowTick <= graceEndsAt
  );
  const joinCountdown = Math.max(0, Math.ceil((joinOpensAt - nowTick) / 1000));
  const callCountdown = Math.max(0, Math.ceil((bookingEnd - nowTick) / 1000));
  const isAfterBookedTime = bookingEnd > 0 && nowTick >= bookingEnd;
  const consentStorageKey = booking ? `${CONSENT_STORAGE_PREFIX}:${booking._id}` : "";
  const otherParticipant = booking
    ? String(booking.client?._id || booking.client) === String(user?._id)
      ? booking.expert
      : booking.client
    : null;
  const otherParticipantId = otherParticipant?._id || otherParticipant;
  const otherParticipantName = otherParticipant?.name || "Other participant";
  const otherParticipantEmail = otherParticipant?.email || "No email available";
  const otherParticipantContact =
    otherParticipant?.phone ||
    otherParticipant?.phoneNumber ||
    otherParticipant?.mobile ||
    otherParticipant?.contactNumber ||
    "Phone not available";
  const viewerContact = [user?.email, user?.phone || user?.phoneNumber].filter(Boolean).join(" | ") || "No email/phone";
  const watermarkLines = useMemo(
    () => [
      user?.name || "Viewer",
      viewerContact,
      booking?._id ? `Booking ${booking._id}` : "Session preview",
      new Date(nowTick).toLocaleString(),
    ],
    [booking?._id, nowTick, user?.email, user?.name, user?.phone, user?.phoneNumber, viewerContact]
  );
  const protectionScope = booking ? `video-call:${roomId}` : "video-call";
  const protection = useSensitiveContentProtection({
    enabled: Boolean(booking) && consentAccepted,
    scope: protectionScope,
    bookingId: booking?._id,
    targetUserId: otherParticipantId,
    page: "video-call",
    details: booking?.notes || booking?.expert?.name || "Booked consultation",
  });

  const meetingLabel = useMemo(() => {
    if (!booking) return "Loading meeting";
    return booking.notes || booking.expert?.name || "Booked consultation";
  }, [booking]);

  const handleLeaveRoom = useCallback(() => {
    if (suppressLeaveCallbackRef.current) {
      suppressLeaveCallbackRef.current = false;
      return;
    }
    if (zegoRef.current) {
      zegoRef.current.destroy();
      zegoRef.current = null;
    }
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const completeCall = useCallback(async () => {
    if (!roomId || endingRef.current || autoEndTriggeredRef.current) return;
    autoEndTriggeredRef.current = true;
    endingRef.current = true;
    setEnding(true);

    try {
      suppressLeaveCallbackRef.current = true;
      if (zegoRef.current) {
        zegoRef.current.destroy();
        zegoRef.current = null;
      }

      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        `${API_URL}/api/bookings/room/${roomId}/complete`,
        {},
        { headers: { Authorization: token } }
      );

      setBooking(data.booking);
      setCallAccess(data.callAccess);
      toast.success(data.message || "Booked call ended");
      navigate("/dashboard", {
        replace: true,
        state: { reviewBooking: data.booking },
      });
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Failed to end the call");
    } finally {
      setEnding(false);
      endingRef.current = false;
    }
  }, [navigate, roomId]);

  const acceptConsent = useCallback(() => {
    if (!consentStorageKey) return;
    window.sessionStorage.setItem(consentStorageKey, "true");
    setConsentAccepted(true);
    toast.success("Privacy consent saved for this session");
  }, [consentStorageKey]);

  const declineConsent = useCallback(() => {
    toast("You can join once you accept the privacy terms.", { icon: "info" });
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const markViolation = useCallback(
    async (action, details) => {
      if (!booking?._id) return false;
      try {
        const token = localStorage.getItem("token");
        await axios.post(
          `${API_URL}/api/privacy/violations`,
          {
            bookingId: booking._id,
            targetUserId: otherParticipantId || null,
            action,
            details: String(details || "").slice(0, 1000),
            page: "video-call",
            source: "web",
            timestamp: new Date().toISOString(),
          },
          { headers: token ? { Authorization: token } : {} }
        );
        return true;
      } catch (requestError) {
        console.error(requestError);
        return false;
      }
    },
    [booking?._id, otherParticipantId]
  );

  const handleReportUser = useCallback(async () => {
    if (!booking || !otherParticipantId) return;
    const reason = window.prompt("Describe the issue or violation:");
    if (reason === null) return;

    setReporting(true);
    try {
      const saved = await markViolation("report_user", reason || "User reported from secure session");
      if (saved) {
        toast.success(`${otherParticipantName} reported`);
      } else {
        toast.error("Failed to save the report");
      }
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Failed to report user");
    } finally {
      setReporting(false);
    }
  }, [booking, markViolation, otherParticipantId, otherParticipantName]);

  const handleBlockUser = useCallback(async () => {
    if (!booking || !otherParticipantId) return;
    const confirmBlock = window.confirm(`Block ${otherParticipantName} for this account and sensitive sessions?`);
    if (!confirmBlock) return;

    setReporting(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API_URL}/api/privacy/block-user`,
        {
          targetUserId: otherParticipantId,
          bookingId: booking._id,
          page: "video-call",
          reason: `Blocked from booking ${booking._id}`,
        },
        { headers: token ? { Authorization: token } : {} }
      );
      toast.success(data.message || `${otherParticipantName} blocked`);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Failed to block user");
    } finally {
      setReporting(false);
    }
  }, [booking, navigate, otherParticipantId, otherParticipantName]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchBooking = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get(`${API_URL}/api/bookings/room/${roomId}`, {
          headers: { Authorization: token },
        });

        setBooking(data.booking);
        setCallAccess(data.callAccess);
        setError("");
      } catch (requestError) {
        const message = requestError.response?.data?.message || "Failed to load booked call";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [navigate, roomId, user]);

  useEffect(() => {
    if (!consentStorageKey) return;
    setConsentAccepted(window.sessionStorage.getItem(consentStorageKey) === "true");
  }, [consentStorageKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading || !booking || !callAccess) return undefined;

    if (isAfterBookedTime && booking.status !== "completed" && !autoEndTriggeredRef.current) {
      completeCall();
      return undefined;
    }

    if (isAfterBookedTime || !canJoinNow || !consentAccepted || zegoRef.current || !meetingContainerRef.current) return undefined;

    let cancelled = false;

    const initializeCall = async () => {
      const { ZegoUIKitPrebuilt } = await import("@zegocloud/zego-uikit-prebuilt");
      if (cancelled) return;

      const appID = Number(import.meta.env.VITE_ZEGO_APP_ID) || 1618361093;
      const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET || "87245bdcc3539e0839e44ffc91bbfcb2";

      if (!import.meta.env.VITE_ZEGO_APP_ID) {
        toast("Running in Demo Mode. Set VITE_ZEGO_APP_ID in .env for production.", { icon: "info" });
      }

      try {
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomId,
          user?._id || Date.now().toString(),
          user?.name || "Anonymous User"
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoRef.current = zp;

        zp.joinRoom({
          container: meetingContainerRef.current,
          sharedLinks: [
            {
              name: "Copy Meeting Link",
              url: window.location.origin + `/video-call/${roomId}`,
            },
          ],
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          showScreenSharingButton: true,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showTextChat: true,
          showUserList: false,
          maxUsers: 2,
          layout: "Auto",
          onLeaveRoom: handleLeaveRoom,
        });
      } catch (meetingError) {
        console.error("ZegoCloud Initialization Error:", meetingError);
        toast.error("Failed to start video call. Check console for details.");
      }
    };

    initializeCall();

    return () => {
      cancelled = true;
      if (zegoRef.current) {
        zegoRef.current.destroy();
        zegoRef.current = null;
      }
    };
  }, [booking, callAccess, canJoinNow, completeCall, consentAccepted, handleLeaveRoom, isAfterBookedTime, loading, roomId, user?._id, user?.name]);

  useEffect(() => {
    if (!booking || !callAccess) return undefined;

    if (joinTimerRef.current) {
      window.clearTimeout(joinTimerRef.current);
      joinTimerRef.current = null;
    }

    if (nowTick < joinOpensAt) {
      joinTimerRef.current = window.setTimeout(() => {
        setNowTick(Date.now());
      }, Math.max(1000, joinOpensAt - nowTick));
    }

    return () => {
      if (joinTimerRef.current) {
        window.clearTimeout(joinTimerRef.current);
        joinTimerRef.current = null;
      }
    };
  }, [booking, callAccess, joinOpensAt, nowTick]);

  const statusCopy = useMemo(() => {
    if (!booking) return "Loading booked session...";
    if (booking.status === "completed") return "This booked session has already ended.";
    if (nowTick < joinOpensAt) {
      return `Your room opens in ${formatDuration(joinCountdown)}.`;
    }
    if (nowTick <= bookingEnd) {
      return `Time left in this call: ${formatDuration(callCountdown)}.`;
    }
    return "Booked time is over. Closing the room now.";
  }, [booking, bookingEnd, callCountdown, joinCountdown, joinOpensAt, nowTick]);

  if (loading) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Preparing room</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex items-center justify-center text-white px-6">
        <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-300">Meeting unavailable</p>
          <h1 className="mt-4 text-3xl font-extrabold">{error}</h1>
          <button
            type="button"
            onClick={() => navigate("/dashboard", { replace: true })}
            className="mt-6 rounded-2xl bg-primary-500 px-6 py-3 font-bold text-white transition-all hover:bg-primary-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!booking) return null;

  if (booking.status === "completed" && nowTick >= bookingEnd) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300">Session complete</p>
          <h1 className="mt-4 text-4xl font-extrabold">The booked call has ended</h1>
          <p className="mt-3 text-slate-400">{meetingLabel} is now closed. We will return you to the dashboard.</p>
          <button
            type="button"
            onClick={() => navigate("/dashboard", { replace: true })}
            className="mt-6 rounded-2xl bg-primary-500 px-6 py-3 font-bold text-white transition-all hover:bg-primary-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!canJoinNow && nowTick < joinOpensAt) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-10">
          <div className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-8">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-300">Booked session</p>
            <h1 className="mt-4 text-4xl font-extrabold">{meetingLabel}</h1>
            <p className="mt-3 max-w-2xl text-slate-400">{statusCopy}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Starts at</p>
                <p className="mt-2 font-bold text-white">
                  {new Date(booking.slotStart).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Ends at</p>
                <p className="mt-2 font-bold text-white">
                  {new Date(booking.slotEnd).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Countdown</p>
                <p className="mt-2 font-mono text-2xl font-extrabold text-amber-300">{formatDuration(joinCountdown)}</p>
              </div>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              The call will open automatically when the booking window begins.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!consentAccepted) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-10">
          <div className="grid w-full gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-300">Secure session check</p>
              <h1 className="mt-4 text-4xl font-extrabold">{meetingLabel}</h1>
              <p className="mt-3 text-slate-400">{statusCopy}</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Participant</p>
                  <p className="mt-2 font-bold text-white">{otherParticipantName}</p>
                  <p className="mt-1 text-xs text-slate-400">{otherParticipantEmail}</p>
                  <p className="mt-1 text-xs text-slate-400">{otherParticipantContact}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Booking</p>
                  <p className="mt-2 font-mono text-sm font-bold text-amber-300">{booking._id}</p>
                </div>
              </div>
              <p className="mt-6 text-sm text-slate-500">
                We will not join the room until you confirm the no-recording, no-screenshot, and no-sharing terms.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Call rules</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">No recording is allowed.</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">No screenshots or screen sharing are allowed.</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">No redistribution or sharing of protected content.</li>
              </ul>
              <p className="mt-6 text-xs uppercase tracking-[0.25em] text-slate-500">Select all terms to continue</p>
              <p className="mt-4 rounded-2xl border border-primary-400/20 bg-primary-500/10 px-4 py-3 text-sm text-slate-200">
                Use the consent modal to confirm the rules before the room opens.
              </p>
              <button
                type="button"
                onClick={declineConsent}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-slate-300 transition hover:bg-white/10"
              >
                Leave session
              </button>
            </div>
          </div>
        </div>
        <ConsentModal
          open={true}
          bookingLabel={booking._id}
          onAccept={acceptConsent}
          onDecline={declineConsent}
        />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden text-white">
      <div className="w-full bg-slate-900 border-b border-white/5 py-3 px-6 flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
          <span className="font-mono text-sm tracking-wider text-slate-400 truncate">
            SECURE MEETING ROOM: {roomId}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-sm text-amber-300">
            {nowTick <= bookingEnd ? `Time left ${formatDuration(callCountdown)}` : "Ending..."}
          </span>
          <button
            type="button"
            onClick={handleReportUser}
            disabled={reporting}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Report
          </button>
          <button
            type="button"
            onClick={handleBlockUser}
            disabled={reporting}
            className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-bold text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Block
          </button>
          <button
            onClick={handleLeaveRoom}
            className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-xs font-bold text-red-300 transition-all hover:bg-red-500/20"
          >
            Exit Room
          </button>
        </div>
      </div>

      <div className="w-full border-b border-white/10 bg-black/20 px-6 py-3 text-sm text-slate-300">
        {statusCopy}
      </div>

      <div className="relative w-full flex-grow" style={{ width: "100vw", height: "calc(100vh - 102px)" }}>
        <div
          ref={meetingContainerRef}
          className="privacy-sensitive-surface h-full w-full"
        />
        <PrivacyWatermark
          lines={watermarkLines}
          watermarkId={booking?._id || roomId}
          enabled={watermarkEnabled}
          blurred={protection.blurred}
          variant="call"
          density="dense"
        />
      </div>
      {ending && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
            <p className="text-sm font-semibold text-white">Ending call...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
