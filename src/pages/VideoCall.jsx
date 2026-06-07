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
const ZEGO_SLOW_LOGIN_MS = 10000;
const ZEGO_LOGIN_TIMEOUT_MS = 30000;
const UNCONFIGURED_ZEGO_SERVER_LABEL = "NO_CONFIGURED_ZEGO_SERVER";
const ZEGO_RETRY_MESSAGE = "Video server connection timed out. Retrying alternate server...";
const ZEGO_LEGACY_RTC_SERVER = "wss://rtc-api.zego.im/ws";
const getDefaultZegoWebServers = (appId = 0) => [
  Number.isSafeInteger(appId) && appId > 0 ? `wss://webliveroom${appId}-api.zegocloud.com/ws` : "",
  "wss://webliveroom-api.zegocloud.com/ws",
  "wss://webliveroom-api.zego.im/ws",
].filter(Boolean);
const FRONTEND_ZEGO_WEB_SERVER = import.meta.env.VITE_ZEGO_WEB_SERVER_URL || import.meta.env.VITE_ZEGO_SERVER || import.meta.env.VITE_ZEGO_SERVER_URL || "";

const CALL_STATES = {
  checking: "Checking camera/microphone...",
  joining: "Joining room...",
  publishing: "Publishing your video...",
  waiting: "Waiting for the other participant...",
  connected: "Connected",
  reconnecting: "Reconnecting...",
  retrying: ZEGO_RETRY_MESSAGE,
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

const getTrackDebugInfo = (track) => {
  if (!track) return null;
  return {
    id: track.id || "",
    kind: track.kind || "",
    label: track.label || "",
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState || "",
  };
};

const getMediaStreamDebugInfo = (stream) => {
  const tracks = stream?.getTracks?.() || [];
  const audioTracks = tracks.filter((track) => track.kind === "audio");
  const videoTracks = tracks.filter((track) => track.kind === "video");

  return {
    hasStream: Boolean(stream),
    streamId: stream?.id || "",
    trackCount: tracks.length,
    audioTrackCount: audioTracks.length,
    videoTrackCount: videoTracks.length,
    tracks: tracks.map(getTrackDebugInfo),
  };
};

const getElementBoxDebugInfo = (element) => {
  if (!element?.getBoundingClientRect) {
    return {
      elementAttached: false,
      clientWidth: 0,
      clientHeight: 0,
      renderedWidth: 0,
      renderedHeight: 0,
    };
  }

  const rect = element.getBoundingClientRect();
  return {
    elementAttached: element.isConnected,
    clientWidth: element.clientWidth || 0,
    clientHeight: element.clientHeight || 0,
    renderedWidth: Math.round(rect.width || 0),
    renderedHeight: Math.round(rect.height || 0),
  };
};

const getVideoElementDebugInfo = (video) => ({
  ...getElementBoxDebugInfo(video),
  autoplay: Boolean(video?.autoplay),
  playsInline: Boolean(video?.playsInline),
  muted: Boolean(video?.muted),
  paused: Boolean(video?.paused),
  readyState: video?.readyState ?? null,
  networkState: video?.networkState ?? null,
  srcObjectAttached: Boolean(video?.srcObject),
  videoWidth: video?.videoWidth || 0,
  videoHeight: video?.videoHeight || 0,
});

const getStreamListDebugInfo = (streamList = []) => streamList.map((stream) => ({
  streamID: getStreamID(stream),
  userID: String(stream?.user?.userID || stream?.user?.userId || stream?.userID || stream?.userId || ""),
  extraInfo: stream?.extraInfo || "",
}));

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

const isZegoLoginSuccess = (result) => {
  if (result === true) return true;
  if (!result) return false;
  if (typeof result === "object") {
    const code = result?.errorCode ?? result?.code ?? result?.errCode;
    if (code === undefined || code === null || code === "") return true;
    return Number(code) === 0 || String(code) === "0";
  }
  return Boolean(result);
};

const safeStringifyZegoError = (value) => {
  const hiddenKeys = new Set(["token", "serverSecret", "secret", "kitToken"]);
  const seen = new WeakSet();

  try {
    const text = JSON.stringify(value, (key, entry) => {
      if (hiddenKeys.has(key)) return "[redacted]";
      if (typeof entry === "bigint") return String(entry);
      if (typeof entry === "function") return `[Function ${entry.name || "anonymous"}]`;
      if (entry instanceof Error) {
        return {
          name: entry.name,
          message: entry.message,
          code: entry.code ?? entry.errorCode ?? entry.errCode ?? "",
          stack: entry.stack ? String(entry.stack).split("\n").slice(0, 6).join("\n") : "",
        };
      }
      if (entry && typeof entry === "object") {
        if (seen.has(entry)) return "[Circular]";
        seen.add(entry);
      }
      return entry;
    });
    return text || String(value || "");
  } catch (stringifyError) {
    try {
      return String(value);
    } catch {
      return `Unstringifiable Zego error: ${stringifyError?.message || "unknown"}`;
    }
  }
};

const getZegoAccessIds = (zegoAccess = {}) => ({
  appId: Number(zegoAccess.appId ?? zegoAccess.appID ?? 0),
  roomId: String(zegoAccess.roomId || ""),
  userId: String(zegoAccess.userId ?? zegoAccess.userID ?? ""),
  token: String(zegoAccess.token || ""),
  streamId: String(zegoAccess.streamId ?? zegoAccess.streamID ?? ""),
});

const normalizeZegoServers = (server) => {
  const normalizeOne = (value) => {
    const text = String(value || "").trim();
    if (!text) return [];
    const legacyServer = ZEGO_LEGACY_RTC_SERVER.replace(/\/+$/, "").toLowerCase();
    if (text.replace(/\/+$/, "").toLowerCase() === legacyServer) return [];
    return text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => /^(wss?|https?):\/\//i.test(item))
      .filter((item) => item.replace(/\/+$/, "").toLowerCase() !== legacyServer);
  };

  if (Array.isArray(server)) {
    return server.flatMap(normalizeOne);
  }

  return normalizeOne(server);
};

const getZegoServerKey = (server) => {
  if (Array.isArray(server)) {
    return server.map(getZegoServerKey).filter(Boolean).join("|");
  }
  return String(server || "").replace(/\/+$/, "").toLowerCase();
};

const uniqueZegoServers = (servers = []) => servers.filter((server, index, list) => {
  const normalized = getZegoServerKey(server);
  return normalized && list.findIndex((item) => getZegoServerKey(item) === normalized) === index;
});

const getZegoServerDebugList = (server) => {
  if (Array.isArray(server)) return server.map((item) => String(item || ""));
  const text = String(server || "").trim();
  return text ? [text] : [];
};

const getZegoServerLabel = (server) => {
  if (Array.isArray(server)) {
    return server.length > 0 ? `SERVER_ARRAY_${server.length}` : UNCONFIGURED_ZEGO_SERVER_LABEL;
  }
  return server || UNCONFIGURED_ZEGO_SERVER_LABEL;
};

const getZegoEngineServerCandidates = (zegoAccess = {}, appId = 0) => {
  const backendServers = uniqueZegoServers([
    ...normalizeZegoServers(zegoAccess.serverCandidates),
    ...normalizeZegoServers(zegoAccess.server),
  ]);
  const frontendServers = normalizeZegoServers(FRONTEND_ZEGO_WEB_SERVER);
  const defaultServers = getDefaultZegoWebServers(appId);
  const explicitServers = uniqueZegoServers([...backendServers, ...frontendServers, ...defaultServers]);
  const candidates = explicitServers.length > 0 ? [explicitServers] : [];
  const sources = [
    backendServers.length > 0 ? "backend" : "",
    frontendServers.length > 0 ? "frontend_env" : "",
    "documented_global_fallbacks",
  ].filter(Boolean);

  return {
    servers: candidates,
    source: sources.join("+"),
    explicitServerCount: explicitServers.length,
    explicitServers,
  };
};

const withLoginTimeout = (promise, { timeoutMs, slowMs, onSlow, createTimeoutError }) => {
  let timeoutTimerId;
  let slowTimerId;
  if (typeof onSlow === "function") {
    slowTimerId = window.setTimeout(onSlow, slowMs);
  }
  const timeoutPromise = new Promise((_, reject) => {
    timeoutTimerId = window.setTimeout(() => reject(createTimeoutError()), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutTimerId) window.clearTimeout(timeoutTimerId);
    if (slowTimerId) window.clearTimeout(slowTimerId);
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
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.style.display = "block";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.minWidth = "100%";
    video.style.minHeight = "100%";
    video.style.objectFit = "cover";
    video.style.background = "#020617";
  });
};

const attachMediaStreamToContainer = async (container, stream, {
  muted = false,
  streamID = "",
  mountLabel = "media",
  logDebug,
} = {}) => {
  if (!container || !stream) {
    logDebug?.("video element attach skipped", {
      mountLabel,
      remoteStreamID: streamID,
      hasContainer: Boolean(container),
      container: getElementBoxDebugInfo(container),
      ...getMediaStreamDebugInfo(stream),
    });
    return null;
  }

  container.innerHTML = "";

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.muted = muted;
  video.srcObject = stream;
  video.style.display = "block";
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.minWidth = "100%";
  video.style.minHeight = "100%";
  video.style.objectFit = "cover";
  video.style.background = "#020617";

  const logVideoState = (event) => {
    logDebug?.(event, {
      mountLabel,
      remoteStreamID: streamID,
      container: getElementBoxDebugInfo(container),
      video: getVideoElementDebugInfo(video),
      ...getMediaStreamDebugInfo(stream),
    });
  };

  video.addEventListener("loadedmetadata", () => logVideoState("video dimensions"));
  video.addEventListener("resize", () => logVideoState("video dimensions"));
  video.addEventListener("playing", () => logVideoState("stream playing"));

  container.appendChild(video);
  logVideoState("video element attached");

  try {
    await video.play();
    logVideoState("stream playing");
  } catch (playError) {
    logDebug?.("video play failed", {
      mountLabel,
      remoteStreamID: streamID,
      playError: summarizeZegoError(playError),
      video: getVideoElementDebugInfo(video),
      ...getMediaStreamDebugInfo(stream),
    });

    if (!muted) {
      try {
        video.muted = true;
        await video.play();
        logVideoState("stream playing");
      } catch (mutedPlayError) {
        logDebug?.("muted video play failed", {
          mountLabel,
          remoteStreamID: streamID,
          playError: summarizeZegoError(mutedPlayError),
          video: getVideoElementDebugInfo(video),
          ...getMediaStreamDebugInfo(stream),
        });
      }
    }
  }

  window.setTimeout(() => logVideoState("video dimensions"), 500);
  window.setTimeout(() => logVideoState("video dimensions"), 2000);

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
  const remoteDisplayStreamIdRef = useRef("");
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
    tokenLength: 0,
    tokenPrefix: "",
    loginStarted: false,
    loginSuccess: false,
    loginResolved: false,
    loginResolvedValue: "",
    loginRejected: false,
    loginRejectReason: "",
    loginError: "",
    lastLoginError: "",
    lastLoginRejectReason: "",
    rawLoginError: "",
    loginTimeout: false,
    loginSlow: false,
    loginElapsedMs: 0,
    joinedRoom: false,
    engineExists: false,
    appIdExists: false,
    roomIdExists: false,
    engineServerConfigured: false,
    engineServerSource: "",
    engineServerCount: 0,
    activeEngineServer: "",
    retryCount: 0,
    lastServerTried: "",
    localStreamCreated: false,
    localStreamPublished: false,
    localPublishError: "",
    roomState: "idle",
    roomStateErrorCode: "",
    roomStateErrorMessage: "",
    sdkErrorCode: "",
    sdkErrorMessage: "",
    sdkErrorRaw: "",
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
    setCallDiagnostics((current) => ({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));
  }, []);

  const cleanupZegoCall = useCallback(() => {
    const zg = zegoRef.current;

    remoteViewsRef.current.forEach((view) => {
      try {
        if (typeof view?.stop === "function") {
          view.stop();
        } else {
          view?.stopVideo?.();
          view?.stopAudio?.();
          view?.destroy?.();
        }
      } catch {
        // View cleanup is best effort; stream cleanup below is the source of truth.
      }
    });
    remoteViewsRef.current.clear();

    remoteStreamsRef.current.forEach(({ stream, videoElement }, streamID) => {
      try {
        zg?.stopPlayingStream?.(streamID);
      } catch {
        // The SDK may already be disconnected during teardown.
      }
      if (videoElement) videoElement.srcObject = null;
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
    remoteDisplayStreamIdRef.current = "";

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

    const renderRemoteStream = async (streamID, remoteStream) => {
      const container = remoteVideoRef.current;
      if (!container || !remoteStream || cancelled) {
        logZegoDebug("remote video render skipped", {
          remoteStreamID: streamID,
          hasContainer: Boolean(container),
          container: getElementBoxDebugInfo(container),
          ...getMediaStreamDebugInfo(remoteStream),
        });
        return null;
      }

      remoteDisplayStreamIdRef.current = streamID;
      const currentRecord = remoteStreamsRef.current.get(streamID) || {};
      if (currentRecord.videoElement && currentRecord.videoElement.srcObject !== remoteStream) {
        currentRecord.videoElement.srcObject = null;
      }

      const videoElement = await attachMediaStreamToContainer(container, remoteStream, {
        muted: false,
        streamID,
        mountLabel: "remote",
        logDebug: logZegoDebug,
      });

      remoteStreamsRef.current.set(streamID, {
        ...currentRecord,
        stream: remoteStream,
        videoElement,
      });

      return videoElement;
    };

    const removeRemoteStream = (zg, streamID) => {
      const remoteRecord = remoteStreamsRef.current.get(streamID);
      const remoteView = remoteViewsRef.current.get(streamID);

      try {
        if (typeof remoteView?.stop === "function") {
          remoteView.stop();
        } else {
          remoteView?.stopVideo?.();
          remoteView?.stopAudio?.();
          remoteView?.destroy?.();
        }
      } catch {
        // The view may already be detached.
      }

      try {
        zg.stopPlayingStream(streamID);
      } catch {
        // The stream may already be stopped.
      }

      if (remoteRecord?.videoElement) remoteRecord.videoElement.srcObject = null;
      stopMediaStreamTracks(remoteRecord?.stream);
      remoteViewsRef.current.delete(streamID);
      remoteStreamsRef.current.delete(streamID);

      const nextIds = Array.from(remoteStreamsRef.current.keys());
      if (remoteDisplayStreamIdRef.current === streamID) {
        remoteDisplayStreamIdRef.current = "";
        const nextDisplayStreamID = nextIds[0];
        const nextRecord = nextDisplayStreamID ? remoteStreamsRef.current.get(nextDisplayStreamID) : null;
        if (nextDisplayStreamID && nextRecord?.stream) {
          void renderRemoteStream(nextDisplayStreamID, nextRecord.stream);
        }
      }

      if (remoteVideoRef.current && nextIds.length === 0) {
        remoteVideoRef.current.innerHTML = "";
      }

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
        const remoteStream = await zg.startPlayingStream(streamID, { audio: true, video: true });
        if (cancelled) return;

        remoteStreamsRef.current.set(streamID, { stream: remoteStream });
        logZegoDebug("remote stream received", {
          remoteStreamID: streamID,
          retryCount,
          ...getMediaStreamDebugInfo(remoteStream),
        });

        await renderRemoteStream(streamID, remoteStream);

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
          displayedRemoteStreamID: remoteDisplayStreamIdRef.current,
          ...getMediaStreamDebugInfo(remoteStream),
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
        tokenLength: 0,
        tokenPrefix: "",
        loginStarted: false,
        loginSuccess: false,
        loginResolved: false,
        loginResolvedValue: "",
        loginRejected: false,
        loginRejectReason: "",
        loginError: "",
        lastLoginError: "",
        lastLoginRejectReason: "",
        rawLoginError: "",
        loginTimeout: false,
        loginSlow: false,
        loginElapsedMs: 0,
        joinedRoom: false,
        engineExists: false,
        appIdExists: false,
        roomIdExists: false,
        engineServerConfigured: false,
        engineServerSource: "",
        engineServerCount: 0,
        activeEngineServer: "",
        retryCount: 0,
        lastServerTried: "",
        localStreamCreated: false,
        localStreamPublished: false,
        localPublishError: "",
        roomState: "checking",
        roomStateErrorCode: "",
        roomStateErrorMessage: "",
        sdkErrorCode: "",
        sdkErrorMessage: "",
        sdkErrorRaw: "",
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
        streamId: zegoStreamId,
      } = getZegoAccessIds(zegoAccess);
      const serverCandidates = getZegoEngineServerCandidates(zegoAccess, zegoAppId);
      const engineServerConfigured = serverCandidates.explicitServerCount > 0;
      const engineServerSource = serverCandidates.source;
      const engineServerCount = serverCandidates.explicitServerCount || serverCandidates.servers.length;
      const tokenReceived = Boolean(zegoToken);
      const appIdExists = Number.isSafeInteger(zegoAppId) && zegoAppId > 0;
      const roomIdExists = Boolean(zegoRoomId);
      const tokenLength = zegoToken.length;
      const tokenPrefix = zegoToken.slice(0, 10);

      updateDiagnostics({
        tokenReceived,
        tokenLength,
        tokenPrefix,
        appIdExists,
        roomIdExists,
        engineServerConfigured,
        engineServerSource,
        engineServerCount,
        activeEngineServer: "",
        retryCount: 0,
        lastServerTried: "",
        zegoServers: serverCandidates.explicitServers,
        loginError: "",
        lastLoginError: "",
      });

      logZegoDebug("zego token response", {
        success: zegoAccess.success === true,
        appId: zegoAppId,
        roomId: zegoRoomId,
        userId: zegoUserId,
        tokenReceived,
        tokenLength,
        tokenPrefix,
        backendServerReceived: zegoAccess.server ?? null,
        backendServerCandidatesReceived: getZegoServerDebugList(zegoAccess.serverCandidates),
        backendServerArrayReceived: getZegoServerDebugList(zegoAccess.server),
        engineServerConfigured,
        engineServerSource,
        engineServerCount,
        engineServerCandidates: serverCandidates.servers,
        zegoServers: serverCandidates.explicitServers,
        streamID: zegoStreamId,
      });

      if (zegoAccess.success === false || !tokenReceived || !appIdExists || !roomIdExists || !zegoUserId || !zegoStreamId) {
        throw new Error("Unable to join video server.");
      }
      if (serverCandidates.explicitServerCount <= 0 || serverCandidates.servers.length <= 0) {
        throw new Error("Video server candidates are missing.");
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
        tokenLength,
        tokenPrefix,
        backendServerReceived: zegoAccess.server ?? null,
        backendServerCandidatesReceived: getZegoServerDebugList(zegoAccess.serverCandidates),
        backendServerArrayReceived: getZegoServerDebugList(zegoAccess.server),
        engineServerConfigured,
        engineServerSource,
        engineServerCount,
        engineServerCandidates: serverCandidates.servers,
        zegoServers: serverCandidates.explicitServers,
        tokenGeneratedForRoomId: zegoRoomId,
        tokenGeneratedForUserID: zegoUserId,
        streamID: zegoStreamId,
      });

      const { ZegoExpressEngine } = await import("zego-express-engine-webrtc");
      if (cancelled) return;

      const bindZegoEventHandlers = (zg, activeEngineServer) => {
        const onRoomStateUpdate = (updatedRoomID, state, errorCode, extendedData) => {
          const stateText = String(state || "unknown").toUpperCase();
          const roomStateErrorCode = errorCode ? String(errorCode) : "";
          const roomStateErrorMessage = errorCode ? String(extendedData || `SDK room error ${errorCode}`) : "";
          logZegoDebug("roomStateUpdate", {
            updatedRoomID,
            state: stateText,
            errorCode: roomStateErrorCode || "0",
            extendedData,
            activeEngineServer,
          });
          updateDiagnostics((current) => ({
            roomState: stateText,
            joinedRoom: joinedRoomRef.current,
            activeEngineServer,
            roomStateErrorCode: roomStateErrorCode || current.roomStateErrorCode,
            roomStateErrorMessage: roomStateErrorMessage || current.roomStateErrorMessage,
            sdkErrorCode: roomStateErrorCode || current.sdkErrorCode,
            sdkErrorMessage: roomStateErrorMessage || current.sdkErrorMessage,
            lastLoginError: !joinedRoomRef.current && roomStateErrorMessage ? roomStateErrorMessage : current.lastLoginError,
          }));
          if (stateText === "DISCONNECTED" || stateText === "CONNECTING") {
            setSafeCallState(CALL_STATES.reconnecting);
          }
          if (stateText === "CONNECTED" && remoteStreamsRef.current.size > 0) {
            setSafeCallState(CALL_STATES.connected);
          }
        };

        const onRoomStateChanged = (updatedRoomID, state, errorCode, extendedData) => {
          const stateText = String(state || "unknown").toUpperCase();
          const roomStateErrorCode = errorCode ? String(errorCode) : "";
          const roomStateErrorMessage = errorCode ? String(extendedData || `SDK room error ${errorCode}`) : "";
          logZegoDebug("roomStateChanged", {
            updatedRoomID,
            state: stateText,
            errorCode: roomStateErrorCode || "0",
            extendedData,
            activeEngineServer,
          });
          updateDiagnostics((current) => ({
            roomState: stateText || "unknown",
            joinedRoom: joinedRoomRef.current,
            activeEngineServer,
            roomStateErrorCode: roomStateErrorCode || current.roomStateErrorCode,
            roomStateErrorMessage: roomStateErrorMessage || current.roomStateErrorMessage,
            sdkErrorCode: roomStateErrorCode || current.sdkErrorCode,
            sdkErrorMessage: roomStateErrorMessage || current.sdkErrorMessage,
            lastLoginError: !joinedRoomRef.current && roomStateErrorMessage ? roomStateErrorMessage : current.lastLoginError,
          }));
          if (stateText.includes("RECONNECT") || stateText.includes("DISCONNECT") || stateText.includes("BROKEN")) {
            setSafeCallState(CALL_STATES.reconnecting);
          }
        };

        const onSdkError = (...args) => {
          const [errorCodeOrError, messageOrError, extendedData] = args;
          const sdkError = getZegoSdkErrorDetails(
            errorCodeOrError && typeof errorCodeOrError === "object"
              ? errorCodeOrError
              : { errorCode: errorCodeOrError, message: messageOrError || extendedData },
            "Zego SDK error"
          );
          const rawError = safeStringifyZegoError(args);
          logZegoDebug("sdk on error callback", {
            sdkError,
            rawError,
            activeEngineServer,
          });
          updateDiagnostics({
            activeEngineServer,
            sdkErrorCode: sdkError.code,
            sdkErrorMessage: sdkError.message,
            sdkErrorRaw: rawError,
            lastLoginError: !joinedRoomRef.current ? sdkError.message : "",
          });
        };

        zg.on("roomStateUpdate", onRoomStateUpdate);
        zg.on("roomStateChanged", onRoomStateChanged);
        try {
          zg.on("error", onSdkError);
        } catch (sdkErrorCallbackError) {
          logZegoDebug("sdk on error callback unavailable", {
            rawError: safeStringifyZegoError(sdkErrorCallbackError),
            activeEngineServer,
          });
        }
        zg.on("publisherStateUpdate", (result) => {
          logZegoDebug("publisherStateUpdate", { ...result, activeEngineServer });
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
          logZegoDebug("playerStateUpdate", { ...result, activeEngineServer });
          if (result?.errorCode) {
            const sdkError = getZegoSdkErrorDetails(result, `Player error ${result.errorCode}`);
            updateDiagnostics({
              playerError: `Player error ${result.errorCode}`,
              sdkErrorCode: sdkError.code,
              sdkErrorMessage: sdkError.message,
            });
          }
        });
        zg.on("playerVideoTrackUpdate", (streamID, track) => {
          const remoteRecord = remoteStreamsRef.current.get(streamID);
          const existingTrackIds = remoteRecord?.stream?.getTracks?.().map((item) => item.id) || [];
          if (remoteRecord?.stream?.addTrack && track && !existingTrackIds.includes(track.id)) {
            try {
              remoteRecord.stream.addTrack(track);
            } catch (trackError) {
              logZegoDebug("player video track attach failed", {
                remoteStreamID: streamID,
                track: getTrackDebugInfo(track),
                error: summarizeZegoError(trackError),
              });
            }
          }
          if (remoteRecord?.videoElement) {
            remoteRecord.videoElement.srcObject = remoteRecord.stream;
            remoteRecord.videoElement.play().catch(() => {});
          }
          logZegoDebug("player video track update", {
            remoteStreamID: streamID,
            track: getTrackDebugInfo(track),
            displayedRemoteStreamID: remoteDisplayStreamIdRef.current,
            ...getMediaStreamDebugInfo(remoteRecord?.stream),
          });
        });
        zg.on("playerAudioTrackUpdate", (streamID, track) => {
          const remoteRecord = remoteStreamsRef.current.get(streamID);
          const existingTrackIds = remoteRecord?.stream?.getTracks?.().map((item) => item.id) || [];
          if (remoteRecord?.stream?.addTrack && track && !existingTrackIds.includes(track.id)) {
            try {
              remoteRecord.stream.addTrack(track);
            } catch (trackError) {
              logZegoDebug("player audio track attach failed", {
                remoteStreamID: streamID,
                track: getTrackDebugInfo(track),
                error: summarizeZegoError(trackError),
              });
            }
          }
          logZegoDebug("player audio track update", {
            remoteStreamID: streamID,
            track: getTrackDebugInfo(track),
            ...getMediaStreamDebugInfo(remoteRecord?.stream),
          });
        });
        zg.on("playQualityUpdate", (streamID, stats) => {
          logZegoDebug("playQualityUpdate", {
            remoteStreamID: streamID,
            frameWidth: stats?.video?.frameWidth,
            frameHeight: stats?.video?.frameHeight,
            videoFPS: stats?.video?.videoFPS,
            videoRenderFPS: stats?.video?.videoRenderFPS,
            videoFramesDecoded: stats?.video?.videoFramesDecoded,
            videoMuteState: stats?.video?.muteState,
            audioFPS: stats?.audio?.audioFPS,
            audioMuteState: stats?.audio?.muteState,
          });
        });
        zg.on("roomStreamUpdate", (updatedRoomID, updateType, streamList = [], extendedData) => {
          const normalizedUpdateType = String(updateType || "").toUpperCase();
          const streamIDs = streamList.map(getStreamID).filter(Boolean);
          logZegoDebug("roomStreamUpdate", {
            updatedRoomID,
            updateType,
            streamIDs,
            streams: getStreamListDebugInfo(streamList),
            remoteStreamsCount: remoteStreamsRef.current.size,
            extendedData,
            activeEngineServer,
          });

          if (normalizedUpdateType === "ADD") {
            streamIDs.forEach((streamID) => {
              if (streamID !== localStreamIdRef.current) {
                logZegoDebug("remote stream added", {
                  remoteStreamID: streamID,
                  remoteStreamsCount: remoteStreamsRef.current.size,
                  activeEngineServer,
                });
                playRemoteStream(zg, streamID);
              }
            });
          }

          if (normalizedUpdateType === "DELETE") {
            streamIDs.forEach((streamID) => removeRemoteStream(zg, streamID));
          }
        });
      };

      let zg = null;
      let joined = false;
      for (let attemptIndex = 0; attemptIndex < serverCandidates.servers.length; attemptIndex += 1) {
        const engineServer = serverCandidates.servers[attemptIndex];
        const activeEngineServer = getZegoServerLabel(engineServer);
        const retryCount = attemptIndex;
        let loginStartedAt = 0;
        let lastLoginElapsedMs = 0;

        setSafeCallState(CALL_STATES.joining);
        updateDiagnostics({
          activeEngineServer,
          retryCount,
          lastServerTried: activeEngineServer,
          engineExists: false,
          loginStarted: false,
          loginSuccess: false,
          loginResolved: false,
          loginResolvedValue: "",
          loginRejected: false,
          loginRejectReason: "",
          loginError: "",
          lastLoginError: "",
          lastLoginRejectReason: "",
          rawLoginError: "",
          loginTimeout: false,
          loginSlow: false,
          loginElapsedMs: 0,
          roomState: "LOGINING",
          roomStateErrorCode: "",
          roomStateErrorMessage: "",
          sdkErrorCode: "",
          sdkErrorMessage: "",
        });

        try {
          zg = new ZegoExpressEngine(zegoAppId, engineServer);
        } catch (engineError) {
          const sdkError = getZegoSdkErrorDetails(engineError, "Zego engine initialization failed");
          logZegoDebug("engine init fail", {
            engineError: sdkError,
            activeEngineServer,
            retryCount,
            engineServerConfigured,
            engineServerSource,
            engineServerCount,
          });
          updateDiagnostics({
            engineExists: false,
            activeEngineServer,
            retryCount,
            lastServerTried: activeEngineServer,
            sdkErrorCode: sdkError.code,
            sdkErrorMessage: sdkError.message,
            lastLoginError: sdkError.message,
          });
          cleanupZegoCall();
          if (attemptIndex < serverCandidates.servers.length - 1) {
            await wait(300);
            continue;
          }
          throw new Error("Unable to join video server.", { cause: engineError });
        }

        zegoRef.current = zg;
        localStreamIdRef.current = zegoStreamId;
        bindZegoEventHandlers(zg, activeEngineServer);

        updateDiagnostics({
          engineExists: true,
          activeEngineServer,
          retryCount,
          lastServerTried: activeEngineServer,
        });
        logZegoDebug("engine initialized", {
          engineExists: Boolean(zg),
          activeEngineServer,
          retryCount,
          engineServerConfigured,
          engineServerSource,
          engineServerCount,
          engineServerList: Array.isArray(engineServer) ? engineServer : [],
          sdkVersion: ZegoExpressEngine.version || zg?.getVersion?.(),
        });

        try {
          loginStartedAt = Date.now();
          updateDiagnostics({
            loginStarted: true,
            loginSuccess: false,
            loginResolved: false,
            loginResolvedValue: "",
            loginRejected: false,
            loginRejectReason: "",
            loginError: "",
            lastLoginError: "",
            lastLoginRejectReason: "",
            rawLoginError: "",
            loginTimeout: false,
            loginSlow: false,
            loginElapsedMs: 0,
            roomState: "LOGINING",
            roomStateErrorCode: "",
            roomStateErrorMessage: "",
            activeEngineServer,
            retryCount,
            lastServerTried: activeEngineServer,
          });
          logZegoDebug("loginRoom start", {
            appId: zegoAppId,
            roomId: zegoRoomId,
            userId: zegoUserId,
            tokenReceived,
            tokenLength,
            tokenPrefix,
            engineExists: Boolean(zg),
            engineServerConfigured,
            engineServerSource,
            engineServerCount,
            activeEngineServer,
            retryCount,
            backendServerReceived: zegoAccess.server ?? null,
            backendServerCandidatesReceived: getZegoServerDebugList(zegoAccess.serverCandidates),
            backendServerArrayReceived: getZegoServerDebugList(zegoAccess.server),
            engineServerList: Array.isArray(engineServer) ? engineServer : [],
          });
          const loginPromise = zg.loginRoom(
            zegoRoomId,
            zegoToken,
            { userID: zegoUserId, userName: zegoAccess.userName || user?.name || zegoUserId },
            { userUpdate: true }
          )
            .then((result) => {
              lastLoginElapsedMs = Date.now() - loginStartedAt;
              const loginResolvedValue = typeof result === "boolean" ? String(result) : safeStringifyZegoError(result);
              updateDiagnostics({
                loginResolved: true,
                loginResolvedValue,
                loginRejected: false,
                loginRejectReason: "",
                loginElapsedMs: lastLoginElapsedMs,
                activeEngineServer,
                retryCount,
                lastServerTried: activeEngineServer,
              });
              logZegoDebug("loginRoom resolved", {
                result,
                loginResolvedValue,
                loginElapsedMs: lastLoginElapsedMs,
                activeEngineServer,
                retryCount,
              });
              return result;
            })
            .catch((loginReject) => {
              lastLoginElapsedMs = Date.now() - loginStartedAt;
              const loginError = getZegoSdkErrorDetails(loginReject, "loginRoom rejected");
              const rawLoginError = safeStringifyZegoError(loginReject);
              const loginRejectReason = loginError.message || rawLoginError || "loginRoom rejected";
              if (loginReject && typeof loginReject === "object") {
                loginReject.loginElapsedMs = lastLoginElapsedMs;
                loginReject.loginRejectReason = loginRejectReason;
                loginReject.rawLoginError = rawLoginError;
              }
              updateDiagnostics({
                loginRejected: true,
                loginRejectReason,
                lastLoginRejectReason: loginRejectReason,
                rawLoginError,
                loginElapsedMs: lastLoginElapsedMs,
                sdkErrorCode: loginError.code,
                sdkErrorMessage: loginError.message,
                activeEngineServer,
                retryCount,
                lastServerTried: activeEngineServer,
              });
              logZegoDebug("loginRoom rejected", {
                loginError,
                loginRejectReason,
                lastLoginRejectReason: loginRejectReason,
                rawLoginError,
                loginElapsedMs: lastLoginElapsedMs,
                activeEngineServer,
                retryCount,
              });
              throw loginReject;
            });
          const loginResult = await withLoginTimeout(
            loginPromise,
            {
              timeoutMs: ZEGO_LOGIN_TIMEOUT_MS,
              slowMs: ZEGO_SLOW_LOGIN_MS,
              onSlow: () => {
                const elapsedMs = Date.now() - loginStartedAt;
                updateDiagnostics({
                  loginSlow: true,
                  loginElapsedMs: elapsedMs,
                  activeEngineServer,
                  retryCount,
                  lastServerTried: activeEngineServer,
                });
                setSafeCallState(CALL_STATES.reconnecting);
                logZegoDebug("loginRoom slow", {
                  elapsedMs,
                  roomState: "LOGINING",
                  engineServerConfigured,
                  engineServerSource,
                  engineServerCount,
                  activeEngineServer,
                  retryCount,
                });
              },
              createTimeoutError: () => {
                const timeoutError = new Error(`loginRoom timed out after ${ZEGO_LOGIN_TIMEOUT_MS}ms`);
                timeoutError.code = "LOGIN_TIMEOUT";
                timeoutError.errorCode = "LOGIN_TIMEOUT";
                timeoutError.loginTimeout = true;
                timeoutError.loginElapsedMs = Date.now() - loginStartedAt;
                timeoutError.serverTried = activeEngineServer;
                return timeoutError;
              },
            }
          );
          joined = isZegoLoginSuccess(loginResult);

          if (!joined) {
            const falseReason = "loginRoom resolved false";
            const elapsedMs = lastLoginElapsedMs || (loginStartedAt ? Date.now() - loginStartedAt : 0);
            updateDiagnostics({
              loginSuccess: false,
              loginResolved: true,
              loginResolvedValue: safeStringifyZegoError(loginResult) || String(loginResult),
              loginRejectReason: falseReason,
              loginError: falseReason,
              lastLoginError: falseReason,
              lastLoginRejectReason: falseReason,
              loginElapsedMs: elapsedMs,
              activeEngineServer,
              retryCount,
              lastServerTried: activeEngineServer,
            });
            logZegoDebug("loginRoom fail", {
              reason: falseReason,
              lastLoginRejectReason: falseReason,
              loginElapsedMs: elapsedMs,
              activeEngineServer,
              retryCount,
            });
            cleanupZegoCall();
            throw new Error(falseReason);
          }

          joinedRoomRef.current = true;
          updateDiagnostics({
            joinedRoom: true,
            loginSuccess: true,
            loginError: "",
            lastLoginError: "",
            loginRejectReason: "",
            lastLoginRejectReason: "",
            rawLoginError: "",
            loginTimeout: false,
            loginSlow: false,
            loginElapsedMs: lastLoginElapsedMs || (loginStartedAt ? Date.now() - loginStartedAt : 0),
            roomState: "CONNECTED",
            activeEngineServer,
            retryCount,
            lastServerTried: activeEngineServer,
          });
          logZegoDebug("loginRoom success", {
            roomId: zegoRoomId,
            currentUserId: zegoUserId,
            currentUserRole: zegoAccess.currentUserRole,
            loginElapsedMs: lastLoginElapsedMs || (loginStartedAt ? Date.now() - loginStartedAt : 0),
            activeEngineServer,
            retryCount,
          });
          break;
        } catch (joinError) {
          const loginError = getZegoSdkErrorDetails(joinError, "loginRoom rejected");
          const rawLoginError = joinError?.rawLoginError || safeStringifyZegoError(joinError);
          const loginRejectReason = joinError?.loginRejectReason || loginError.message || rawLoginError || "loginRoom rejected";
          const elapsedMs = joinError?.loginElapsedMs || lastLoginElapsedMs || (loginStartedAt ? Date.now() - loginStartedAt : 0);
          const loginTimedOut = Boolean(joinError?.loginTimeout) || loginError.code === "LOGIN_TIMEOUT" || /timed out/i.test(loginError.message);
          const visibleMessage = loginTimedOut ? "Unable to join video server." : loginRejectReason || "loginRoom rejected without SDK reason";
          updateDiagnostics({
            loginSuccess: false,
            loginRejected: !joinError?.loginTimeout,
            loginRejectReason: visibleMessage,
            loginError: visibleMessage,
            lastLoginError: loginRejectReason,
            lastLoginRejectReason: loginRejectReason,
            rawLoginError,
            loginTimeout: loginTimedOut,
            loginSlow: Boolean(joinError?.loginTimeout),
            loginElapsedMs: elapsedMs,
            sdkErrorCode: loginTimedOut ? "LOGIN_TIMEOUT" : loginError.code,
            sdkErrorMessage: loginError.message,
            activeEngineServer,
            retryCount,
            lastServerTried: activeEngineServer,
            roomState: "LOGOUT",
          });
          logZegoDebug("loginRoom fail", {
            loginError,
            loginRejectReason: visibleMessage,
            lastLoginRejectReason: loginRejectReason,
            rawLoginError,
            loginTimeout: loginTimedOut,
            loginElapsedMs: elapsedMs,
            activeEngineServer,
            retryCount,
          });
          cleanupZegoCall();
          if (loginTimedOut && attemptIndex < serverCandidates.servers.length - 1) {
            setSafeCallState(CALL_STATES.retrying);
            toast(ZEGO_RETRY_MESSAGE, { icon: "info" });
            await wait(500);
            continue;
          }
          throw new Error(visibleMessage, { cause: joinError });
        }
      }

      if (!joined || !zg) {
        throw new Error("Unable to join video server.");
      }

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
      const publishRequestStarted = publishStarted !== false;
      updateDiagnostics({
        localStreamPublished: false,
        localPublishError: publishRequestStarted ? "" : "Unable to publish local stream.",
      });
      logZegoDebug("startPublishingStream", {
        streamID: zegoStreamId,
        localStreamPublished: false,
        publishRequestStarted,
      });
      if (!publishRequestStarted) {
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
    ["tokenLength", callDiagnostics.tokenLength || 0],
    ["tokenPrefix", callDiagnostics.tokenPrefix || "none"],
    ["loginStarted", callDiagnostics.loginStarted],
    ["loginResolved", callDiagnostics.loginResolved],
    ["loginResolvedValue", callDiagnostics.loginResolvedValue || "none"],
    ["loginRejected", callDiagnostics.loginRejected],
    ["loginRejectReason", callDiagnostics.loginRejectReason || "none"],
    ["lastLoginRejectReason", callDiagnostics.lastLoginRejectReason || "none"],
    ["loginSuccess", callDiagnostics.loginSuccess],
    ["loginTimeout", callDiagnostics.loginTimeout],
    ["loginSlow", callDiagnostics.loginSlow],
    ["loginElapsedMs", callDiagnostics.loginElapsedMs],
    ["joinedRoom", callDiagnostics.joinedRoom],
    ["engineServerConfigured", callDiagnostics.engineServerConfigured],
    ["engineServerSource", callDiagnostics.engineServerSource || "none"],
    ["engineServerCount", callDiagnostics.engineServerCount || 0],
    ["activeEngineServer", callDiagnostics.activeEngineServer || "none"],
    ["retryCount", callDiagnostics.retryCount || 0],
    ["lastServerTried", callDiagnostics.lastServerTried || "none"],
    ["localStreamCreated", callDiagnostics.localStreamCreated],
    ["localPublished", callDiagnostics.localStreamPublished],
    ["roomState", callDiagnostics.roomState],
    ["roomStateErrorCode", callDiagnostics.roomStateErrorCode || "none"],
    ["roomStateErrorMessage", callDiagnostics.roomStateErrorMessage || "none"],
    ["sdkErrorCode", callDiagnostics.sdkErrorCode || "none"],
  ];

  const zegoDebugPayload = useMemo(() => ({
    copiedAt: new Date().toISOString(),
    bookingId: booking?._id || roomId,
    roomId,
    currentUserId,
    currentUserRole,
    backendDebugUrl: `${API_URL}/api/debug/zego-token/${booking?._id || roomId}`,
    callAccess: callAccess
      ? {
          canJoin: callAccess.canJoin,
          joinReason: callAccess.joinReason,
          joinReasonBlocked: callAccess.joinReasonBlocked,
          secondsUntilJoin: callAccess.secondsUntilJoin,
          secondsUntilEnd: callAccess.secondsUntilEnd,
          serverNow: callAccess.serverNow,
          startsAt: callAccess.startsAt || callAccess.startAt,
          endsAt: callAccess.endsAt || callAccess.endAt,
          joinOpensAt: callAccess.joinOpensAt || callAccess.joinStart,
        }
      : null,
    diagnostics: callDiagnostics,
  }), [booking?._id, callAccess, callDiagnostics, currentUserId, currentUserRole, roomId]);

  const handleCopyZegoDebug = useCallback(async () => {
    const text = JSON.stringify(zegoDebugPayload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Zego debug copied");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast.success("Zego debug copied");
    }
  }, [zegoDebugPayload]);

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
              <button
                type="button"
                onClick={handleCopyZegoDebug}
                className="mt-3 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-100 transition-all hover:bg-cyan-300/20"
              >
                Copy Zego Debug
              </button>
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
              {callDiagnostics.loginRejectReason && (
                <p className="mt-2 text-xs font-semibold text-red-200">
                  loginRejectReason: {callDiagnostics.loginRejectReason}
                </p>
              )}
              {callDiagnostics.lastLoginRejectReason && (
                <p className="mt-2 text-xs font-semibold text-red-200">
                  lastLoginRejectReason: {callDiagnostics.lastLoginRejectReason}
                </p>
              )}
              {callDiagnostics.roomStateErrorCode && (
                <p className="mt-2 text-xs font-semibold text-red-200">
                  roomStateErrorCode: {callDiagnostics.roomStateErrorCode}
                </p>
              )}
              {callDiagnostics.roomStateErrorMessage && (
                <p className="mt-2 text-xs font-semibold text-red-200">
                  roomStateErrorMessage: {callDiagnostics.roomStateErrorMessage}
                </p>
              )}
              {callDiagnostics.rawLoginError && (
                <p className="mt-2 break-words text-xs font-semibold text-red-200">
                  rawLoginError: {callDiagnostics.rawLoginError}
                </p>
              )}
              {callDiagnostics.sdkErrorMessage && (
                <p className="mt-2 text-xs font-semibold text-red-200">
                  sdkErrorMessage: {callDiagnostics.sdkErrorMessage}
                </p>
              )}
              {callDiagnostics.sdkErrorRaw && (
                <p className="mt-2 break-words text-xs font-semibold text-red-200">
                  sdkErrorRaw: {callDiagnostics.sdkErrorRaw}
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
            <button
              type="button"
              onClick={handleCopyZegoDebug}
              className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-100 transition-all hover:bg-cyan-300/20"
            >
              Copy Zego Debug
            </button>
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
        {callDiagnostics.loginRejectReason && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            loginRejectReason: {callDiagnostics.loginRejectReason}
          </p>
        )}
        {callDiagnostics.lastLoginRejectReason && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            lastLoginRejectReason: {callDiagnostics.lastLoginRejectReason}
          </p>
        )}
        {callDiagnostics.roomStateErrorCode && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            roomStateErrorCode: {callDiagnostics.roomStateErrorCode}
          </p>
        )}
        {callDiagnostics.roomStateErrorMessage && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            roomStateErrorMessage: {callDiagnostics.roomStateErrorMessage}
          </p>
        )}
        {callDiagnostics.rawLoginError && (
          <p className="mt-2 break-words rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            rawLoginError: {callDiagnostics.rawLoginError}
          </p>
        )}
        {callDiagnostics.sdkErrorMessage && (
          <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            sdkErrorMessage: {callDiagnostics.sdkErrorMessage}
          </p>
        )}
        {callDiagnostics.sdkErrorRaw && (
          <p className="mt-2 break-words rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">
            sdkErrorRaw: {callDiagnostics.sdkErrorRaw}
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
