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
const CALL_JOIN_EARLY_MINUTES = 30;
const CONSENT_STORAGE_PREFIX = "video-call-consent";
const ZEGO_LOGIN_TIMEOUT_MS = 10000;
const DEFAULT_ZEGO_WEB_SERVER = "wss://webliveroom-api.zegocloud.com/ws";
const FRONTEND_ZEGO_WEB_SERVER = import.meta.env.VITE_ZEGO_SERVER || import.meta.env.VITE_ZEGO_SERVER_URL || "";

const CALL_STATES = {
  checking: "Checking camera/microphone...",
  joining: "Joining room...",
  publishing: "Publishing your video...",
  waiting: "Waiting for the other participant...",
  connected: "Connected",
  reconnecting: "Reconnecting...",
  remoteFailed: "Remote video failed to play",
};

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

const getIdString = (value) => {
  if (!value) return "";
  return String(value?._id || value);
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getStreamID = (stream) => String(stream?.streamID || stream?.streamId || stream?.id || stream || "");

const summarizeZegoError = (error) => ({
  code: error?.code ?? error?.errorCode ?? null,
  message: error?.message || error?.msg || String(error || "Unknown Zego error"),
});

const getZegoSdkErrorDetails = (error, fallbackMessage = "") => {
  if (!error) return { code: "", message: fallbackMessage };
  const code = error?.code ?? error?.errorCode ?? error?.errCode ?? error?.error_code ?? "";
  const message = error?.message || error?.msg || error?.reason || fallbackMessage || String(error);
  return { code: code === null || code === undefined ? "" : String(code), message: message || "" };
};

const getZegoAccessIds = (zegoAccess = {}) => ({
  appId: Number(zegoAccess.appId ?? zegoAccess.appID ?? 0),
  roomId: String(zegoAccess.roomId || ""),
  userId: String(zegoAccess.userId ?? zegoAccess.userID ?? ""),
  token: String(zegoAccess.token || ""),
});

const normalizeZegoServer = (server) => {
  const normalizeOne = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    return /^(wss?|https?):\/\//i.test(text) ? text : "";
  };

  if (Array.isArray(server)) {
    const servers = server.map(normalizeOne).filter(Boolean);
    return servers.length > 0 ? servers : "";
  }

  return normalizeOne(server);
};

const getZegoEngineServer = (zegoAccess = {}) => {
  const backendServer = normalizeZegoServer(zegoAccess.server);
  if (Array.isArray(backendServer) ? backendServer.length > 0 : Boolean(backendServer)) {
    return { server: backendServer, source: "backend" };
  }

  const frontendServer = normalizeZegoServer(FRONTEND_ZEGO_WEB_SERVER);
  if (frontendServer) {
    return { server: frontendServer, source: "frontend_env" };
  }

  return { server: DEFAULT_ZEGO_WEB_SERVER, source: "default" };
};

const withTimeout = (promise, ms, createTimeoutError) => {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = window.setTimeout(() => reject(createTimeoutError()), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timerId) window.clearTimeout(timerId);
  });
};

const sanitizeZegoDetails = (details = {}) => {
  const hiddenKeys = new Set(["token", "serverSecret", "secret", "kitToken"]);
  return Object.entries(details).reduce((safe, [key, value]) => {
    if (!hiddenKeys.has(key)) safe[key] = value;
    return safe;
  }, {});
};

const stopMediaStreamTracks = (stream) => {
  if (!stream?.getTracks) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // SDK cleanup can stop a track first; duplicate stops are harmless.
    }
  });
};

const stopLocalMediaTracks = () => {
  if (typeof document === "undefined") return;
  document.querySelectorAll("video, audio").forEach((mediaElement) => {
    const stream = mediaElement.srcObject;
    if (stream?.getTracks) {
      stopMediaStreamTracks(stream);
      mediaElement.srcObject = null;
    }
  });
};

const styleVideoElements = (container) => {
  if (!container?.querySelectorAll) return;
  container.querySelectorAll("video").forEach((video) => {
    video.autoplay = true;
    video.playsInline = true;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.background = "#020617";
  });
};

const attachMediaStreamToContainer = async (container, stream, { muted = false } = {}) => {
  if (!container || !stream) return null;
  container.innerHTML = "";

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.muted = muted;
  video.srcObject = stream;
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "cover";
  video.style.background = "#020617";
  container.appendChild(video);

  try {
    await video.play();
  } catch {
    // Autoplay can be blocked on some mobile browsers; the stream remains attached.
  }

  return video;
};

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const localPreviewRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const zegoRef = useRef(null);
  const localStreamRef = useRef(null);
  const localStreamIdRef = useRef("");
  const localViewRef = useRef(null);
  const remoteStreamsRef = useRef(new Map());
  const remoteViewsRef = useRef(new Map());
  const joinedRoomRef = useRef(false);
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
  const [acceptedConsentKey, setAcceptedConsentKey] = useState("");
  const [reporting, setReporting] = useState(false);
  const [callState, setCallState] = useState(CALL_STATES.waiting);
  const [remoteStreamIds, setRemoteStreamIds] = useState([]);
  const [callDiagnostics, setCallDiagnostics] = useState({
    tokenReceived: false,
    loginStarted: false,
    loginSuccess: false,
    loginError: "",
    lastLoginError: "",
    loginTimeout: false,
    joinedRoom: false,
    engineExists: false,
    appIdExists: false,
    roomIdExists: false,
    engineServerConfigured: false,
    engineServerSource: "",
    localStreamCreated: false,
    localStreamPublished: false,
    localPublishError: "",
    roomState: "idle",
    sdkErrorCode: "",
    sdkErrorMessage: "",
    playerError: "",
  });
  const { enabled: watermarkEnabled } = useWatermarkProtectionEnabled();

  const currentUserId = getIdString(user?._id);
  const bookingClientId = getIdString(booking?.clientId || booking?.client);
  const bookingExpertId = getIdString(booking?.expertId || booking?.expert);
  const currentUserRole = useMemo(() => {
    if (!currentUserId) return "unknown";
    if (bookingClientId && currentUserId === bookingClientId) return "client";
    if (bookingExpertId && currentUserId === bookingExpertId) return "expert";
    return user?.role || "unknown";
  }, [bookingClientId, bookingExpertId, currentUserId, user?.role]);
  const remoteVideoMountId = useMemo(() => `zego-remote-${String(roomId || "").replace(/[^a-zA-Z0-9_-]/g, "")}`, [roomId]);
  const localVideoMountId = useMemo(() => `zego-local-${String(roomId || "").replace(/[^a-zA-Z0-9_-]/g, "")}`, [roomId]);

  const bookingStart = booking?.slotStart ? new Date(booking.slotStart).getTime() : 0;
  const bookingEnd = booking?.slotEnd ? new Date(booking.slotEnd).getTime() : 0;
  const joinOpensAt = callAccess?.joinOpensAt ? new Date(callAccess.joinOpensAt).getTime() : bookingStart - CALL_JOIN_EARLY_MINUTES * 60 * 1000;
  const graceEndsAt = callAccess?.graceEndsAt ? new Date(callAccess.graceEndsAt).getTime() : bookingEnd;
  const canJoinNow = Boolean(
    booking &&
      (booking.status === "confirmed" || booking.bookingStatus === "confirmed") &&
      booking.paymentStatus === "paid" &&
      nowTick >= joinOpensAt &&
      nowTick < bookingEnd &&
      nowTick <= graceEndsAt
  );
  const joinCountdown = Math.max(0, Math.ceil((joinOpensAt - nowTick) / 1000));
  const callCountdown = Math.max(0, Math.ceil((bookingEnd - nowTick) / 1000));
  const isAfterBookedTime = bookingEnd > 0 && nowTick >= bookingEnd;
  const consentStorageKey = booking ? `${CONSENT_STORAGE_PREFIX}:${booking._id}` : "";
  const consentAccepted = Boolean(
    consentStorageKey &&
      (
        acceptedConsentKey === consentStorageKey ||
        (typeof window !== "undefined" && window.sessionStorage.getItem(consentStorageKey) === "true")
      )
  );
  const otherParticipant = booking
    ? bookingClientId === currentUserId
      ? booking.expert
      : booking.client
    : null;
  const otherParticipantId = getIdString(otherParticipant);
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
    [booking?._id, nowTick, user?.name, viewerContact]
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
  const bookingId = booking?._id || "";

  const participantValidation = useMemo(() => {
    if (!booking) return { valid: false, message: "Loading meeting" };
    if (!currentUserId) return { valid: false, message: "Missing current user ID. Please log in again." };
    if (!bookingClientId || !bookingExpertId) return { valid: false, message: "Meeting participant IDs are missing." };
    if (bookingClientId === bookingExpertId) {
      return { valid: false, message: "Client and expert cannot share the same Zego user ID." };
    }
    if (currentUserRole !== "client" && currentUserRole !== "expert") {
      return { valid: false, message: "Current user is not a participant in this meeting." };
    }
    return { valid: true, message: "" };
  }, [booking, bookingClientId, bookingExpertId, currentUserId, currentUserRole]);
  const blockingError = error || (
    booking && !participantValidation.valid && participantValidation.message !== "Loading meeting"
      ? participantValidation.message
      : ""
  );

  const logZegoDebug = useCallback((event, details = {}) => {
    console.info("[Zego Video]", {
      event,
      roomId,
      currentUserId,
      currentUserRole,
      ...sanitizeZegoDetails(details),
    });
  }, [currentUserId, currentUserRole, roomId]);

  const updateDiagnostics = useCallback((patch) => {
    setCallDiagnostics((current) => ({ ...current, ...patch }));
  }, []);

  const cleanupZegoCall = useCallback(() => {
    const zg = zegoRef.current;

    remoteViewsRef.current.forEach((view) => {
      try {
        view?.destroy?.();
      } catch {
        // View cleanup is best effort; stream cleanup below is the source of truth.
      }
    });
    remoteViewsRef.current.clear();

    remoteStreamsRef.current.forEach(({ stream }, streamID) => {
      try {
        zg?.stopPlayingStream?.(streamID);
      } catch {
        // The SDK may already be disconnected during teardown.
      }
      stopMediaStreamTracks(stream);
    });
    remoteStreamsRef.current.clear();

    if (localStreamIdRef.current) {
      try {
        zg?.stopPublishingStream?.(localStreamIdRef.current);
      } catch {
        // Publishing may already be stopped.
      }
    }

    try {
      localViewRef.current?.destroy?.();
    } catch {
      // Local preview view may already be detached.
    }

    if (localStreamRef.current) {
      try {
        zg?.destroyStream?.(localStreamRef.current);
      } catch {
        stopMediaStreamTracks(localStreamRef.current);
      }
    }

    if (joinedRoomRef.current) {
      try {
        zg?.logoutRoom?.(roomId);
      } catch {
        // Logout can fail if the engine has already disconnected.
      }
    }

    try {
      zg?.destroyEngine?.();
    } catch {
      // Some SDK builds expose destroyEngine only after full initialization.
    }

    zegoRef.current = null;
    localStreamRef.current = null;
    localStreamIdRef.current = "";
    joinedRoomRef.current = false;
    localViewRef.current = null;

    if (localPreviewRef.current) localPreviewRef.current.innerHTML = "";
    if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";

    stopLocalMediaTracks();
  }, [roomId]);

  const handleLeaveRoom = useCallback(() => {
    if (suppressLeaveCallbackRef.current) {
      suppressLeaveCallbackRef.current = false;
      return;
    }
    cleanupZegoCall();
    navigate("/dashboard", { replace: true });
  }, [cleanupZegoCall, navigate]);

  const completeCall = useCallback(async () => {
    if (!roomId || endingRef.current || autoEndTriggeredRef.current) return;
    autoEndTriggeredRef.current = true;
    endingRef.current = true;
    setEnding(true);

    try {
      suppressLeaveCallbackRef.current = true;
      cleanupZegoCall();

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
  }, [cleanupZegoCall, navigate, roomId]);

  const acceptConsent = useCallback(() => {
    if (!consentStorageKey) return;
    window.sessionStorage.setItem(consentStorageKey, "true");
    setAcceptedConsentKey(consentStorageKey);
    toast.success("Privacy consent saved for this consultation");
  }, [consentStorageKey]);

  const declineConsent = useCallback(() => {
    toast("You can join once you accept the consultation privacy terms.", { icon: "info" });
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const markViolation = useCallback(
    async (action, details) => {
      if (!bookingId) return false;
      try {
        const token = localStorage.getItem("token");
        await axios.post(
          `${API_URL}/api/privacy/violations`,
          {
            bookingId,
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
    [bookingId, otherParticipantId]
  );

  const handleReportUser = useCallback(async () => {
    if (!booking || !otherParticipantId) return;
    const reason = window.prompt("Describe the issue:");
    if (reason === null) return;

    setReporting(true);
    try {
      const saved = await markViolation("report_user", reason || "User reported from secure consultation session");
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
    const confirmBlock = window.confirm(`Block ${otherParticipantName} for this account and secure consultation sessions?`);
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
    if (!booking || participantValidation.valid || participantValidation.message === "Loading meeting") return;
    logZegoDebug("userID validation failed", {
      bookingClientId,
      bookingExpertId,
      validationMessage: participantValidation.message,
    });
  }, [booking, bookingClientId, bookingExpertId, logZegoDebug, participantValidation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    cleanupZegoCall();
  }, [cleanupZegoCall]);

  useEffect(() => {
    if (loading || error || !booking || !callAccess) return undefined;

    if (isAfterBookedTime && booking.status !== "completed" && !autoEndTriggeredRef.current) {
      completeCall();
      return undefined;
    }

    if (
      isAfterBookedTime ||
      !canJoinNow ||
      !consentAccepted ||
      zegoRef.current ||
      !localPreviewRef.current ||
      !remoteVideoRef.current ||
      !participantValidation.valid
    ) {
      return undefined;
    }

    let cancelled = false;

    const setSafeCallState = (nextState) => {
      if (!cancelled) setCallState(nextState);
    };

    const setSafeRemoteStreamIds = () => {
      if (!cancelled) setRemoteStreamIds(Array.from(remoteStreamsRef.current.keys()));
    };

    const createLocalStream = async (zg) => {
      const streamOptions = {
        camera: {
          video: true,
          audio: true,
        },
      };
      if (typeof zg.createStream === "function") {
        return zg.createStream(streamOptions);
      }
      if (typeof zg.createZegoStream === "function") {
        return zg.createZegoStream(streamOptions);
      }
      throw new Error("Zego createStream API is unavailable");
    };

    const renderLocalPreview = async (zg, localStream) => {
      const container = localPreviewRef.current;
      if (!container) return;
      container.innerHTML = "";

      if (typeof localStream?.playVideo === "function") {
        await localStream.playVideo(container, { objectFit: "cover", mirror: true });
        styleVideoElements(container);
        return;
      }

      if (typeof zg.createLocalStreamView === "function") {
        const localView = zg.createLocalStreamView(localStream);
        localViewRef.current = localView;
        await localView.play(container, { objectFit: "cover" });
        styleVideoElements(container);
        return;
      }

      await attachMediaStreamToContainer(container, localStream, { muted: true });
    };

    const removeRemoteStream = (zg, streamID) => {
      const remoteRecord = remoteStreamsRef.current.get(streamID);
      const remoteView = remoteViewsRef.current.get(streamID);

      try {
        remoteView?.destroy?.();
      } catch {
        // The view may already be detached.
      }

      try {
        zg.stopPlayingStream(streamID);
      } catch {
        // The stream may already be stopped.
      }

      stopMediaStreamTracks(remoteRecord?.stream);
      remoteViewsRef.current.delete(streamID);
      remoteStreamsRef.current.delete(streamID);

      if (remoteVideoRef.current && remoteStreamsRef.current.size === 0) {
        remoteVideoRef.current.innerHTML = "";
      }

      const nextIds = Array.from(remoteStreamsRef.current.keys());
      updateDiagnostics({
        remoteStreamsCount: nextIds.length,
        remoteStreamIDs: nextIds,
      });
      setSafeRemoteStreamIds();
      if (nextIds.length === 0) {
        setSafeCallState(CALL_STATES.waiting);
      }
      logZegoDebug("remote stream removed", {
        remoteStreamID: streamID,
        remoteStreamsCount: nextIds.length,
      });
    };

    const playRemoteStream = async (zg, streamID, retryCount = 0) => {
      if (!streamID || streamID === localStreamIdRef.current || cancelled) return;
      if (remoteStreamsRef.current.has(streamID) && retryCount === 0) return;

      try {
        logZegoDebug("startPlayingStream", { remoteStreamID: streamID, retryCount });
        const remoteStream = await zg.startPlayingStream(streamID);
        if (cancelled) return;

        remoteStreamsRef.current.set(streamID, { stream: remoteStream });
        const container = remoteVideoRef.current;
        if (container) container.innerHTML = "";

        if (container && typeof remoteStream?.playVideo === "function") {
          remoteStream.playVideo(container, { objectFit: "cover" });
          styleVideoElements(container);
        } else if (container && typeof zg.createRemoteStreamView === "function") {
          const remoteView = zg.createRemoteStreamView(remoteStream);
          remoteViewsRef.current.set(streamID, remoteView);
          await remoteView.play(container, { objectFit: "cover" });
          styleVideoElements(container);
        } else if (container) {
          await attachMediaStreamToContainer(container, remoteStream);
        }

        const nextIds = Array.from(remoteStreamsRef.current.keys());
        updateDiagnostics({
          playerError: "",
          remoteStreamsCount: nextIds.length,
          remoteStreamIDs: nextIds,
        });
        setSafeRemoteStreamIds();
        setSafeCallState(CALL_STATES.connected);
        logZegoDebug("remote stream playing", {
          remoteStreamID: streamID,
          remoteStreamsCount: nextIds.length,
        });
      } catch (playError) {
        const playerError = summarizeZegoError(playError);
        logZegoDebug("player error", {
          remoteStreamID: streamID,
          playerError,
          retryCount,
        });

        if (retryCount < 1 && !cancelled) {
          await wait(1000);
          await playRemoteStream(zg, streamID, retryCount + 1);
          return;
        }

        if (!cancelled) {
          updateDiagnostics({ playerError: playerError.message });
          setSafeCallState(CALL_STATES.remoteFailed);
        }
      }
    };

    const initializeCall = async () => {
      updateDiagnostics({
        tokenReceived: false,
        loginStarted: false,
        loginSuccess: false,
        loginError: "",
        lastLoginError: "",
        loginTimeout: false,
        joinedRoom: false,
        engineExists: false,
        appIdExists: false,
        roomIdExists: false,
        engineServerConfigured: false,
        engineServerSource: "",
        localStreamCreated: false,
        localStreamPublished: false,
        localPublishError: "",
        roomState: "checking",
        sdkErrorCode: "",
        sdkErrorMessage: "",
        playerError: "",
        remoteStreamsCount: 0,
        remoteStreamIDs: [],
      });
      setRemoteStreamIds([]);

      logZegoDebug("initializing", {
        bookingClientId,
        bookingExpertId,
        userIDUnique: bookingClientId !== bookingExpertId,
      });

      setSafeCallState(CALL_STATES.checking);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera and microphone permission is required.");
      }

      let permissionStream = null;
      try {
        permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        throw new Error("Camera and microphone permission is required.");
      } finally {
        stopMediaStreamTracks(permissionStream);
      }

      const authToken = localStorage.getItem("token");
      const { data: zegoAccess } = await axios.get(`${API_URL}/api/bookings/room/${roomId}/zego-token`, {
        headers: { Authorization: authToken },
      });
      if (cancelled) return;

      const {
        appId: zegoAppId,
        roomId: zegoRoomId,
        userId: zegoUserId,
        token: zegoToken,
      } = getZegoAccessIds(zegoAccess);
      const zegoStreamId = String(zegoAccess.streamID || zegoAccess.streamId || "");
      const { server: engineServer, source: engineServerSource } = getZegoEngineServer(zegoAccess);
      const engineServerConfigured = Array.isArray(engineServer) ? engineServer.length > 0 : Boolean(engineServer);
      const tokenReceived = Boolean(zegoToken);
      const appIdExists = Number.isSafeInteger(zegoAppId) && zegoAppId > 0;
      const roomIdExists = Boolean(zegoRoomId);

      updateDiagnostics({
        tokenReceived,
        appIdExists,
        roomIdExists,
        engineServerConfigured,
        engineServerSource,
        loginError: "",
        lastLoginError: "",
      });

      logZegoDebug("zego token response", {
        success: zegoAccess.success === true,
        appId: zegoAppId,
        roomId: zegoRoomId,
        userId: zegoUserId,
        tokenReceived,
        engineServerConfigured,
        engineServerSource,
        streamID: zegoStreamId,
      });

      if (zegoAccess.success === false || !tokenReceived || !appIdExists || !roomIdExists || !zegoUserId || !zegoStreamId || !engineServerConfigured) {
        throw new Error("Unable to join video server.");
      }
      if (zegoUserId !== currentUserId) {
        throw new Error("Zego user ID does not match the current user.");
      }
      if (zegoRoomId !== roomId) {
        throw new Error("Zego room ID does not match this booking room.");
      }

      setSafeCallState(CALL_STATES.joining);
      logZegoDebug("zego config received", {
        appId: zegoAppId,
        appIdExists,
        roomIdExists,
        tokenReceived,
        engineServerConfigured,
        engineServerSource,
        tokenGeneratedForRoomId: zegoRoomId,
        tokenGeneratedForUserID: zegoUserId,
        streamID: zegoStreamId,
      });

      const { ZegoExpressEngine } = await import("zego-express-engine-webrtc");
      if (cancelled) return;

      let zg;
      try {
        zg = new ZegoExpressEngine(zegoAppId, engineServer);
      } catch (engineError) {
        const sdkError = getZegoSdkErrorDetails(engineError, "Zego engine initialization failed");
        logZegoDebug("engine init fail", {
          engineError: sdkError,
          engineServerConfigured,
          engineServerSource,
        });
        updateDiagnostics({
          engineExists: false,
          sdkErrorCode: sdkError.code,
          sdkErrorMessage: sdkError.message,
        });
        throw new Error("Unable to join video server.", { cause: engineError });
      }

      updateDiagnostics({ engineExists: Boolean(zg) });
      logZegoDebug("engine initialized", {
        engineExists: Boolean(zg),
        engineServerConfigured,
        engineServerSource,
        sdkVersion: ZegoExpressEngine.version || zg?.getVersion?.(),
      });
      zegoRef.current = zg;
      localStreamIdRef.current = zegoStreamId;

      const onRoomStateUpdate = (updatedRoomID, state, errorCode, extendedData) => {
        const stateText = String(state || "unknown").toUpperCase();
        logZegoDebug("roomStateUpdate", { updatedRoomID, state, errorCode, extendedData });
        updateDiagnostics({
          roomState: stateText,
          joinedRoom: joinedRoomRef.current,
          sdkErrorCode: errorCode ? String(errorCode) : "",
          sdkErrorMessage: errorCode ? String(extendedData || `SDK room error ${errorCode}`) : "",
          lastLoginError: !joinedRoomRef.current && errorCode ? String(extendedData || `SDK room error ${errorCode}`) : "",
        });
        if (stateText === "DISCONNECTED" || stateText === "CONNECTING") {
          setSafeCallState(CALL_STATES.reconnecting);
        }
        if (stateText === "CONNECTED" && remoteStreamsRef.current.size > 0) {
          setSafeCallState(CALL_STATES.connected);
        }
      };

      const onRoomStateChanged = (updatedRoomID, reason, errorCode, extendedData) => {
        const reasonText = String(reason || "").toUpperCase();
        logZegoDebug("roomStateChanged", { updatedRoomID, reason, errorCode, extendedData });
        updateDiagnostics({
          roomState: reasonText || "unknown",
          joinedRoom: joinedRoomRef.current,
          sdkErrorCode: errorCode ? String(errorCode) : "",
          sdkErrorMessage: errorCode ? String(extendedData || `SDK room error ${errorCode}`) : "",
          lastLoginError: !joinedRoomRef.current && errorCode ? String(extendedData || `SDK room error ${errorCode}`) : "",
        });
        if (reasonText.includes("RECONNECT") || reasonText.includes("DISCONNECT") || reasonText.includes("BROKEN")) {
          setSafeCallState(CALL_STATES.reconnecting);
        }
      };

      zg.on("roomStateUpdate", onRoomStateUpdate);
      zg.on("roomStateChanged", onRoomStateChanged);
      zg.on("publisherStateUpdate", (result) => {
        logZegoDebug("publisherStateUpdate", result);
        const publisherState = String(result?.state || "").toUpperCase();
        if (result?.errorCode) {
          const sdkError = getZegoSdkErrorDetails(result, `Publisher error ${result.errorCode}`);
          updateDiagnostics({
            localStreamPublished: false,
            localPublishError: "Unable to publish local stream.",
            sdkErrorCode: sdkError.code,
            sdkErrorMessage: sdkError.message,
          });
          setSafeCallState("Unable to publish local stream.");
          return;
        }
        if (["PUBLISHING", "PUBLISHED", "PUBLISH_SUCC", "PUBLISH_SUCCESS"].includes(publisherState)) {
          updateDiagnostics({ localStreamPublished: true, localPublishError: "" });
        }
      });
      zg.on("playerStateUpdate", (result) => {
        logZegoDebug("playerStateUpdate", result);
        if (result?.errorCode) {
          const sdkError = getZegoSdkErrorDetails(result, `Player error ${result.errorCode}`);
          updateDiagnostics({
            playerError: `Player error ${result.errorCode}`,
            sdkErrorCode: sdkError.code,
            sdkErrorMessage: sdkError.message,
          });
        }
      });
      zg.on("roomStreamUpdate", (updatedRoomID, updateType, streamList = [], extendedData) => {
        const streamIDs = streamList.map(getStreamID).filter(Boolean);
        logZegoDebug("roomStreamUpdate", {
          updatedRoomID,
          updateType,
          streamIDs,
          remoteStreamsCount: remoteStreamsRef.current.size,
          extendedData,
        });

        if (updateType === "ADD") {
          streamIDs.forEach((streamID) => {
            if (streamID !== localStreamIdRef.current) {
              playRemoteStream(zg, streamID);
            }
          });
        }

        if (updateType === "DELETE") {
          streamIDs.forEach((streamID) => removeRemoteStream(zg, streamID));
        }
      });

      let joined;
      try {
        updateDiagnostics({
          loginStarted: true,
          loginSuccess: false,
          loginError: "",
          lastLoginError: "",
          loginTimeout: false,
          roomState: "LOGINING",
        });
        logZegoDebug("loginRoom start", {
          appId: zegoAppId,
          roomId: zegoRoomId,
          userId: zegoUserId,
          tokenReceived,
          engineExists: Boolean(zg),
        });
        joined = await withTimeout(
          zg.loginRoom(
            zegoRoomId,
            zegoToken,
            { userID: zegoUserId, userName: zegoAccess.userName || user?.name || zegoUserId },
            { userUpdate: true }
          ),
          ZEGO_LOGIN_TIMEOUT_MS,
          () => {
            const timeoutError = new Error("Unable to join video server.");
            timeoutError.code = "LOGIN_TIMEOUT";
            timeoutError.loginTimeout = true;
            return timeoutError;
          }
        );
      } catch (joinError) {
        const loginError = getZegoSdkErrorDetails(joinError, "Unable to join video server.");
        const visibleMessage = joinError?.loginTimeout ? "Unable to join video server." : loginError.message || "Unable to join video server.";
        updateDiagnostics({
          loginSuccess: false,
          loginError: visibleMessage,
          lastLoginError: visibleMessage,
          loginTimeout: Boolean(joinError?.loginTimeout),
          sdkErrorCode: loginError.code,
          sdkErrorMessage: loginError.message,
        });
        logZegoDebug("loginRoom fail", {
          loginError,
          loginTimeout: Boolean(joinError?.loginTimeout),
        });
        throw new Error(visibleMessage, { cause: joinError });
      }

      if (!joined) {
        updateDiagnostics({
          loginSuccess: false,
          loginError: "Unable to join video server.",
          lastLoginError: "loginRoom returned false",
        });
        logZegoDebug("loginRoom fail", { reason: "loginRoom returned false" });
        throw new Error("Unable to join video server.");
      }

      joinedRoomRef.current = true;
      updateDiagnostics({
        joinedRoom: true,
        loginSuccess: true,
        loginError: "",
        lastLoginError: "",
        loginTimeout: false,
        roomState: "CONNECTED",
      });
      logZegoDebug("loginRoom success", {
        roomId: zegoRoomId,
        currentUserId: zegoUserId,
        currentUserRole: zegoAccess.currentUserRole,
      });

      setSafeCallState(CALL_STATES.publishing);
      let localStream;
      try {
        localStream = await createLocalStream(zg);
        localStreamRef.current = localStream;
        await renderLocalPreview(zg, localStream);
        updateDiagnostics({ localStreamCreated: true });
        logZegoDebug("createStream success", { localStreamCreated: true });
      } catch (streamError) {
        updateDiagnostics({ localStreamCreated: false });
        logZegoDebug("createStream fail", { streamError: summarizeZegoError(streamError), localStreamCreated: false });
        throw streamError;
      }

      const publishStarted = zg.startPublishingStream(zegoStreamId, localStream);
      updateDiagnostics({
        localStreamPublished: false,
        localPublishError: publishStarted ? "" : "Unable to publish local stream.",
      });
      logZegoDebug("startPublishingStream", {
        streamID: zegoStreamId,
        localStreamPublished: false,
        publishRequestStarted: Boolean(publishStarted),
      });
      if (!publishStarted) {
        updateDiagnostics({ localStreamPublished: false, localPublishError: "Unable to publish local stream." });
        throw new Error("Unable to publish local stream.");
      }

      setSafeCallState(remoteStreamsRef.current.size > 0 ? CALL_STATES.connected : CALL_STATES.waiting);
    };

    initializeCall().catch((callError) => {
      if (cancelled) return;
      const message = callError?.message === "Camera and microphone permission is required."
        ? "Camera and microphone permission is required."
        : callError.response?.data?.message || callError?.message || "Failed to start video call.";
      logZegoDebug("initialization failed", { error: summarizeZegoError(callError) });
      cleanupZegoCall();
      setError(message);
      toast.error(message);
    });

    return () => {
      cancelled = true;
      cleanupZegoCall();
    };
  }, [
    booking,
    bookingClientId,
    bookingExpertId,
    callAccess,
    canJoinNow,
    cleanupZegoCall,
    completeCall,
    consentAccepted,
    currentUserId,
    error,
    isAfterBookedTime,
    loading,
    logZegoDebug,
    participantValidation.valid,
    roomId,
    updateDiagnostics,
    user?.name,
  ]);

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
    if (!booking) return "Loading booked consultation...";
    if (booking.status === "completed") return "This booked consultation has already ended.";
    if (nowTick < joinOpensAt) {
      return `Your room opens in ${formatDuration(joinCountdown)}.`;
    }
    if (nowTick <= bookingEnd) {
      return `Time left in this call: ${formatDuration(callCountdown)}.`;
    }
    return "Booked time is over. Closing the room now.";
  }, [booking, bookingEnd, callCountdown, joinCountdown, joinOpensAt, nowTick]);

  const zegoDiagnosticItems = [
    ["tokenReceived", callDiagnostics.tokenReceived],
    ["loginStarted", callDiagnostics.loginStarted],
    ["loginSuccess", callDiagnostics.loginSuccess],
    ["loginTimeout", callDiagnostics.loginTimeout],
    ["joinedRoom", callDiagnostics.joinedRoom],
    ["engineServerConfigured", callDiagnostics.engineServerConfigured],
    ["engineServerSource", callDiagnostics.engineServerSource || "none"],
    ["localStreamCreated", callDiagnostics.localStreamCreated],
    ["localPublished", callDiagnostics.localStreamPublished],
    ["roomState", callDiagnostics.roomState],
    ["sdkErrorCode", callDiagnostics.sdkErrorCode || "none"],
  ];

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

  if (blockingError) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex items-center justify-center text-white px-6">
        <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-300">Meeting unavailable</p>
          <h1 className="mt-4 text-3xl font-extrabold">{blockingError}</h1>
          {(callDiagnostics.loginStarted || callDiagnostics.loginError || callDiagnostics.sdkErrorCode) && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-left">
              <div className="flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {zegoDiagnosticItems.map(([label, value]) => (
                  <span key={label} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {label} {String(value)}
                  </span>
                ))}
              </div>
              {callDiagnostics.lastLoginError && (
                <p className="mt-3 text-xs font-semibold text-red-200">
                  lastLoginError: {callDiagnostics.lastLoginError}
                </p>
              )}
              {callDiagnostics.loginError && (
                <p className="mt-2 text-xs font-semibold text-red-200">
                  loginError: {callDiagnostics.loginError}
                </p>
              )}
              {callDiagnostics.sdkErrorMessage && (
                <p className="mt-2 text-xs font-semibold text-red-200">
                  sdkErrorMessage: {callDiagnostics.sdkErrorMessage}
                </p>
              )}
            </div>
          )}
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
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-300">Consultation complete</p>
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
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-300">Booked consultation</p>
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
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary-300">Secure consultation check</p>
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
                We will not join the room until you confirm the secure consultation privacy terms.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-slate-950 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500">Call rules</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">No recording is allowed.</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Session privacy protection requirements must be followed.</li>
                <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">No unauthorized sharing of consultation materials.</li>
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
                Leave consultation
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
      <div className="relative z-40 w-full bg-slate-900 border-b border-white/5 py-3 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-3 w-3 rounded-full ${remoteStreamIds.length > 0 ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
          <span className="font-mono text-xs sm:text-sm tracking-wider text-slate-400 truncate">
            SECURE MEETING ROOM: {roomId}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs sm:text-sm text-amber-300">
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

      <div className="relative z-40 w-full border-b border-white/10 bg-black/30 px-4 py-3 text-sm text-slate-300 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-white">{callState}</p>
            <p className="mt-1 text-xs text-slate-500">{statusCopy}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {callDiagnostics.localStreamPublished ? "LOCAL_CONNECTED" : callDiagnostics.localStreamCreated ? "LOCAL_CREATED" : "LOCAL_PENDING"}
            </span>
            {zegoDiagnosticItems.map(([label, value]) => (
              <span key={label} className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {label} {String(value)}
              </span>
            ))}
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              remoteStreams {remoteStreamIds.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {currentUserRole}
            </span>
          </div>
        </div>
        {callDiagnostics.localPublishError && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            {callDiagnostics.localPublishError}
          </p>
        )}
        {callDiagnostics.playerError && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            Player error: {callDiagnostics.playerError}
          </p>
        )}
        {callDiagnostics.loginError && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            loginError: {callDiagnostics.loginError}
          </p>
        )}
        {callDiagnostics.lastLoginError && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            lastLoginError: {callDiagnostics.lastLoginError}
          </p>
        )}
        {callDiagnostics.sdkErrorMessage && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            sdkErrorMessage: {callDiagnostics.sdkErrorMessage}
          </p>
        )}
      </div>

      <div className="relative z-0 w-full flex-grow overflow-hidden bg-black" style={{ width: "100vw", height: "calc(100vh - 148px)" }}>
        <div className="privacy-sensitive-surface relative h-full min-h-[360px] w-full overflow-hidden bg-slate-950">
          <div
            ref={remoteVideoRef}
            id={remoteVideoMountId}
            className="absolute inset-0 z-0 h-full w-full overflow-hidden bg-slate-950 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
          />

          {remoteStreamIds.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
              <div className="max-w-sm rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-4 shadow-2xl backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">{callState}</p>
                <p className="mt-2 text-sm text-slate-300">
                  Waiting for participant to join and publish video.
                </p>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 right-4 z-30 h-36 w-40 overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl shadow-black/40 sm:h-40 sm:w-60">
            <div
              ref={localPreviewRef}
              id={localVideoMountId}
              className="h-full w-full bg-slate-900 [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            />
            {!callDiagnostics.localStreamCreated && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 px-3 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Local preview</p>
              </div>
            )}
          </div>

          <PrivacyWatermark
            lines={watermarkLines}
            watermarkId={booking?._id || roomId}
            enabled={watermarkEnabled}
            blurred={protection.blurred}
            variant="call"
            density="dense"
            className="z-20"
          />
        </div>
      </div>
      {ending && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
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
