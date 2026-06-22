import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "https://muskan-portfolio-backend.onrender.com";
const ZEGO_LOGIN_TIMEOUT_MS = 60000;
const ZEGO_SMOKE_SERVER_PRESETS = [
  "wss://webliveroom384324702-api.zegocloud.com/ws",
  "wss://webliveroom-api.zegocloud.com/ws",
  "wss://webliveroom-api.zego.im/ws",
  "wss://webliveroom-api.zego.im:443/ws",
];
const ZEGO_WEB_SERVER = ZEGO_SMOKE_SERVER_PRESETS[0];

const normalizeZegoServerUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^(wss?|https?):\/\//i.test(text)) return "";
  return text.replace(/\/+$/, "");
};

const dedupeServers = (servers = []) => {
  const seen = new Set();
  const result = [];

  servers.forEach((server) => {
    const normalized = normalizeZegoServerUrl(server);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result;
};

const buildSmokeServerSequence = ({ mode = "sequence", customServerUrl = "", selectedServerUrl = ZEGO_WEB_SERVER } = {}) => {
  const custom = normalizeZegoServerUrl(customServerUrl);
  const selected = normalizeZegoServerUrl(selectedServerUrl) || ZEGO_WEB_SERVER;

  if (mode === "single") {
    return dedupeServers([custom || selected]);
  }

  return dedupeServers([
    custom,
    selected,
    ...ZEGO_SMOKE_SERVER_PRESETS,
  ]);
};

const buildAllServerTimeoutMessage = () => (
  "All ZEGOCLOUD servers timed out. Verify AppID 384324702, project, server secret, service type, and region in the ZEGOCLOUD dashboard."
);

const buildApiUrl = (path, params = {}) => {
  const baseUrl = String(API_URL || "").replace(/\/+$/, "");
  const normalizedPath = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (text) query.set(key, text);
  });

  const queryString = query.toString();
  if (!queryString) return normalizedPath;
  return `${normalizedPath}${normalizedPath.includes("?") ? "&" : "?"}${queryString}`;
};

const formatResponseBody = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const summarizeAxiosError = (error, fallbackUrl = "") => ({
  url: error?.config?.url || error?.request?.responseURL || fallbackUrl || "",
  status: error?.response?.status ?? null,
  responseBody: error?.response?.data ?? null,
  message: error?.message || String(error || "Request failed"),
  code: error?.code ?? "",
  method: String(error?.config?.method || "GET").toUpperCase(),
});

const summarizeSmokeTokenResponse = (data = {}) => {
  const token = String(data?.token || "");
  return {
    appId: Number(data?.appId ?? 0),
    appIdType: data?.appIdType ?? typeof data?.appId,
    roomId: String(data?.roomId || ""),
    userId: String(data?.userId || ""),
    tokenLength: token.length,
    tokenPrefix: token.slice(0, 12),
    serverCandidates: Array.isArray(data?.serverCandidates) ? data.serverCandidates : [],
    tokenExpiresAt: data?.tokenExpiresAt || null,
    generatedRoomId: String(data?.generatedRoomId || data?.roomId || ""),
    tokenPayloadRoomId: String(data?.tokenPayloadRoomId || data?.roomId || ""),
    tokenPayloadUserId: String(data?.tokenPayloadUserId || data?.userId || ""),
  };
};

const summarizeRequestFailure = (stage, requestError, publicDebug = null) => ({
  success: false,
  stage,
  elapsedMs: 0,
  error: {
    code: requestError.status ? `HTTP_${requestError.status}` : requestError.code || "REQUEST_FAILED",
    message: requestError.status
      ? `${stage} failed with HTTP ${requestError.status}`
      : requestError.message || `${stage} failed`,
    url: requestError.url || "",
    status: requestError.status,
    responseBody: requestError.responseBody,
  },
  request: requestError,
  publicDebug,
});

const getIdString = (value) => {
  if (!value) return "";
  return String(value?._id || value);
};

const getInitialRoomId = (routeRoomId = "") => {
  if (routeRoomId) return String(routeRoomId);
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return String(params.get("roomId") || params.get("bookingId") || "").trim();
};

const summarizeZegoError = (error) => ({
  code: error?.code ?? error?.errorCode ?? error?.errCode ?? null,
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

const withLoginTimeout = (promise, timeoutMs) => {
  let timeoutTimerId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutTimerId = window.setTimeout(() => {
      const timeoutError = new Error(`loginRoom timed out after ${timeoutMs}ms`);
      timeoutError.code = "LOGIN_TIMEOUT";
      timeoutError.errorCode = "LOGIN_TIMEOUT";
      timeoutError.loginTimeout = true;
      timeoutError.loginElapsedMs = timeoutMs;
      reject(timeoutError);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutTimerId) window.clearTimeout(timeoutTimerId);
  });
};

const ZegoSmokeTest = () => {
  const { roomId: routeRoomId = "" } = useParams();
  const { user } = useAuth();
  const cleanupRoomRef = useRef("");
  const engineRef = useRef(null);
  const joinedRoomRef = useRef(false);
  const [roomId, setRoomId] = useState(() => getInitialRoomId(routeRoomId));
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("Ready to run loginRoom only.");
  const [roomState, setRoomState] = useState("idle");
  const [loginElapsedMs, setLoginElapsedMs] = useState(0);
  const [publicDebug, setPublicDebug] = useState(null);
  const [tokenDebug, setTokenDebug] = useState(null);
  const [loginDebug, setLoginDebug] = useState(null);
  const [requestDebug, setRequestDebug] = useState([]);
  const [serverAttemptDebug, setServerAttemptDebug] = useState([]);
  const [serverTestMode, setServerTestMode] = useState("single");
  const [selectedServerUrl, setSelectedServerUrl] = useState(ZEGO_WEB_SERVER);
  const [customServerUrl, setCustomServerUrl] = useState("");
  const [activeServerUrl, setActiveServerUrl] = useState(ZEGO_WEB_SERVER);
  const [copyState, setCopyState] = useState("Copy Zego Debug");

  const currentUserId = getIdString(user?._id) || String(user?.id || "").trim();
  const smokeUserId = currentUserId || "smoke-test-user";

  const cleanupEngine = () => {
    const engine = engineRef.current;
    const activeRoomId = cleanupRoomRef.current;

    if (engine) {
      try {
        if (joinedRoomRef.current && activeRoomId) {
          engine.logoutRoom?.(activeRoomId);
        }
      } catch {
        // Best-effort cleanup.
      }

      try {
        engine.destroyEngine?.();
      } catch {
        // Some SDK builds can already be torn down.
      }
    }

    engineRef.current = null;
    cleanupRoomRef.current = "";
    joinedRoomRef.current = false;
  };

  const appendRequestDebug = (record) => {
    setRequestDebug((current) => [...(current || []), record]);
  };

  const requestJson = async ({ label, path, params = {}, redactResponse }) => {
    const requestUrl = buildApiUrl(path, params);
    const startedAt = Date.now();

    try {
      const response = await axios.get(requestUrl, { timeout: 30000 });
      const responseBody = typeof redactResponse === "function" ? redactResponse(response.data) : response.data;
      const record = {
        label,
        ok: true,
        method: "GET",
        url: response.config?.url || requestUrl,
        status: response.status,
        responseBody,
        elapsedMs: Date.now() - startedAt,
      };
      appendRequestDebug(record);
      console.log(`[Zego Smoke Test] ${label} success`, record);
      return response.data;
    } catch (error) {
      const requestError = summarizeAxiosError(error, requestUrl);
      const record = {
        label,
        ok: false,
        ...requestError,
        elapsedMs: Date.now() - startedAt,
      };
      appendRequestDebug(record);
      console.error(`[Zego Smoke Test] ${label} failed`, record);
      const wrappedError = new Error(`${label} failed`);
      wrappedError.requestDebug = record;
      wrappedError.originalError = error;
      throw wrappedError;
    }
  };

  const formatRequestFailureMessage = (label, requestError) => {
    const statusText = requestError.status ? `HTTP ${requestError.status}` : requestError.code || "REQUEST_FAILED";
    const bodyText = requestError.responseBody ? ` body=${formatResponseBody(requestError.responseBody)}` : "";
    return `${label} failed: ${statusText} at ${requestError.url || "unknown URL"}${bodyText}`;
  };

  const runLoginAttempt = async ({
    appId,
    roomId: zegoRoomId,
    userId: zegoUserId,
    token: zegoToken,
    serverUrl,
    attemptIndex,
    attemptTotal,
  }) => {
    const selectedServer = normalizeZegoServerUrl(serverUrl);
    const attemptStartedAt = Date.now();
    const roomStateEvents = [];
    const attemptLogBase = {
      attemptIndex: attemptIndex + 1,
      attemptTotal,
      selectedServer,
      appId,
      appIdType: typeof appId,
      roomId: zegoRoomId,
      userId: zegoUserId,
      tokenLength: zegoToken.length,
      tokenPrefix: zegoToken.slice(0, 12),
    };

    if (!selectedServer) {
      const error = {
        code: "INVALID_SERVER",
        message: "Invalid server URL",
      };
      const summary = {
        ...attemptLogBase,
        success: false,
        elapsedMs: 0,
        error,
        roomStateEvents,
      };
      return { success: false, timeout: false, summary };
    }

    cleanupEngine();
    setActiveServerUrl(selectedServer);
    setRoomState("idle");
    setPhase("logging-in");
    setMessage(`Trying server ${attemptIndex + 1}/${attemptTotal}: ${selectedServer}`);
    console.log("[Zego Smoke Test] login attempt start", {
      ...attemptLogBase,
      serverCandidates: [selectedServer],
    });

    let engine;
    try {
      const { ZegoExpressEngine } = await import("zego-express-engine-webrtc");
      engine = new ZegoExpressEngine(appId, [selectedServer]);
      engineRef.current = engine;
      cleanupRoomRef.current = zegoRoomId;
      joinedRoomRef.current = false;

      const recordRoomStateEvent = (eventType, payload) => {
        const record = {
          ...attemptLogBase,
          eventType,
          ...payload,
          timestamp: new Date().toISOString(),
        };
        roomStateEvents.push(record);
        console.log("[Zego Smoke Test] roomState event", record);
      };

      engine.on("roomStateUpdate", (updatedRoomID, state, errorCode, extendedData) => {
        const normalizedState = String(state || "unknown").toUpperCase();
        setRoomState(normalizedState);
        recordRoomStateEvent("roomStateUpdate", {
          updatedRoomID,
          state: normalizedState,
          errorCode,
          extendedData,
        });
      });

      engine.on("roomStateChanged", (updatedRoomID, reason, errorCode, extendedData) => {
        const normalizedState = String(reason || "unknown").toUpperCase();
        setRoomState(normalizedState);
        recordRoomStateEvent("roomStateChanged", {
          updatedRoomID,
          reason: normalizedState,
          errorCode,
          extendedData,
        });
      });

      const loginStartedAt = Date.now();
      const loginResult = await withLoginTimeout(
        engine.loginRoom(
          zegoRoomId,
          zegoToken,
          { userID: zegoUserId, userName: user?.name || zegoUserId || "smoke-test" },
          { userUpdate: true }
        ),
        ZEGO_LOGIN_TIMEOUT_MS
      );

      const loginSuccess = isZegoLoginSuccess(loginResult);
      const elapsedMs = Date.now() - loginStartedAt;
      const summary = {
        ...attemptLogBase,
        success: loginSuccess,
        elapsedMs,
        result: typeof loginResult === "object" ? loginResult : { value: loginResult },
        roomStateEvents,
        serverCandidates: [selectedServer],
      };

      if (!loginSuccess) {
        const failure = new Error("loginRoom returned unsuccessful result");
        failure.code = "LOGIN_FAILED";
        failure.loginElapsedMs = elapsedMs;
        failure.loginResult = loginResult;
        failure.serverState = summary;
        return {
          success: false,
          timeout: false,
          summary,
          failure,
        };
      }

      joinedRoomRef.current = true;
      return {
        success: true,
        timeout: false,
        summary,
        loginResult,
      };
    } catch (error) {
      const loginError = getZegoSdkErrorDetails(error, "Unable to join video server.");
      const elapsedMs = error?.loginElapsedMs ?? (Date.now() - attemptStartedAt);
      const timeout = loginError.code === "LOGIN_TIMEOUT" || Boolean(error?.loginTimeout);
      const summary = {
        ...attemptLogBase,
        success: false,
        elapsedMs,
        error: loginError,
        timeout,
        roomStateEvents,
        serverCandidates: [selectedServer],
      };
      console.error("[Zego Smoke Test] login attempt failed", {
        ...summary,
        rawError: error,
      });
      return {
        success: false,
        timeout,
        summary,
        failure: error,
      };
    } finally {
      if (engine && !joinedRoomRef.current) {
        try {
          engine.destroyEngine?.();
        } catch {
          // Ignore cleanup failures.
        }
        engineRef.current = null;
        cleanupRoomRef.current = "";
      }
    }
  };

  useEffect(() => () => {
    const engine = engineRef.current;
    const activeRoomId = cleanupRoomRef.current;

    if (engine) {
      try {
        if (joinedRoomRef.current && activeRoomId) {
          engine.logoutRoom?.(activeRoomId);
        }
      } catch {
        // Best-effort cleanup.
      }

      try {
        engine.destroyEngine?.();
      } catch {
        // Some SDK builds can already be torn down.
      }
    }

    engineRef.current = null;
    cleanupRoomRef.current = "";
    joinedRoomRef.current = false;
  }, []);

  const copyDebug = async () => {
    const serverSequence = buildSmokeServerSequence({
      mode: serverTestMode,
      customServerUrl,
      selectedServerUrl,
    });
    const payload = {
      publicDebug,
      tokenDebug,
      loginDebug,
      phase,
      message,
      roomState,
      loginElapsedMs,
      requestDebug,
      serverAttemptDebug,
      serverTestMode,
      selectedServerUrl,
      customServerUrl,
      serverSequence,
      activeServerUrl,
      pinnedServer: ZEGO_WEB_SERVER,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyState("Copied");
      window.setTimeout(() => setCopyState("Copy Zego Debug"), 1500);
    } catch (error) {
      setCopyState("Copy failed");
      console.error("[Zego Smoke Test] copy failed", summarizeZegoError(error));
    }
  };

  const runSmokeTest = async () => {
    const normalizedRoomId = String(roomId || "").trim();
    if (!normalizedRoomId) {
      setPhase("idle");
      setMessage("Enter a room ID to run the smoke test.");
      return;
    }

    const normalizedUserId = smokeUserId;
    const publicDebugUrl = buildApiUrl("/api/debug/zego-public-safe", {
      roomId: normalizedRoomId,
      userId: normalizedUserId,
    });
    const smokeTokenUrl = buildApiUrl("/api/debug/zego-smoke-token", {
      roomId: normalizedRoomId,
      userId: normalizedUserId,
    });

    cleanupEngine();
    setRunning(true);
    setPhase("preparing");
    setMessage("Loading public debug payload...");
    setRoomState("idle");
    setLoginElapsedMs(0);
    setPublicDebug(null);
    setTokenDebug(null);
    setLoginDebug(null);
    setRequestDebug([]);
    setServerAttemptDebug([]);
    setActiveServerUrl(normalizeZegoServerUrl(selectedServerUrl) || ZEGO_WEB_SERVER);

    try {
      let publicData;
      try {
        publicData = await requestJson({
          label: "publicDebug",
          path: "/api/debug/zego-public-safe",
          params: {
            roomId: normalizedRoomId,
            userId: normalizedUserId,
          },
        });
        setPublicDebug(publicData);
      } catch (error) {
        const requestError = error?.requestDebug || summarizeAxiosError(error, publicDebugUrl);
        const failureSummary = summarizeRequestFailure("public-debug", requestError);
        setPhase("failed");
        setMessage(formatRequestFailureMessage("Public debug request", requestError));
        setPublicDebug({
          success: false,
          stage: "public-debug",
          request: requestError,
          error: requestError,
        });
        setTokenDebug(failureSummary);
        setLoginDebug(failureSummary);
        console.error("[Zego Smoke Test] public debug request failed", {
          requestError,
        });
        return;
      }

      let zegoAccess;
      try {
        setPhase("fetching");
        setMessage("Requesting public smoke token...");
        zegoAccess = await requestJson({
          label: "smokeToken",
          path: "/api/debug/zego-smoke-token",
          params: {
            roomId: normalizedRoomId,
            userId: normalizedUserId,
          },
          redactResponse: summarizeSmokeTokenResponse,
        });
      } catch (error) {
        const requestError = error?.requestDebug || summarizeAxiosError(error, smokeTokenUrl);
        const failureSummary = summarizeRequestFailure("smoke-token", requestError, publicData);
        setPhase("failed");
        setMessage(formatRequestFailureMessage("Smoke token request", requestError));
        setTokenDebug(failureSummary);
        setLoginDebug(failureSummary);
        console.error("[Zego Smoke Test] smoke token request failed", {
          requestError,
          publicDebug: publicData,
        });
        return;
      }

      const appId = Number(zegoAccess.appId ?? publicData.appId ?? 0);
      const zegoRoomId = String(zegoAccess.roomId || zegoAccess.generatedRoomId || normalizedRoomId || "");
      const zegoUserId = String(zegoAccess.userId ?? zegoAccess.tokenPayloadUserId ?? normalizedUserId ?? "");
      const zegoToken = String(zegoAccess.token || "");
      const smokeTokenServerCandidates = dedupeServers(
        Array.isArray(zegoAccess.serverCandidates) ? zegoAccess.serverCandidates : []
      );
      const serverSequence = buildSmokeServerSequence({
        mode: serverTestMode,
        customServerUrl,
        selectedServerUrl,
      });
      const tokenPrefix = zegoToken.slice(0, 12);
      const tokenSummary = {
        appId,
        appIdType: typeof appId,
        roomId: zegoRoomId,
        userId: zegoUserId,
        tokenLength: zegoToken.length,
        tokenPrefix,
        serverCandidates: smokeTokenServerCandidates,
        serverSequence,
        serverTestMode,
        selectedServerUrl: normalizeZegoServerUrl(selectedServerUrl) || ZEGO_WEB_SERVER,
        customServerUrl: normalizeZegoServerUrl(customServerUrl),
        generatedRoomId: zegoAccess.generatedRoomId || zegoRoomId,
        tokenPayloadRoomId: zegoAccess.tokenPayloadRoomId || zegoRoomId,
        tokenPayloadUserId: zegoAccess.tokenPayloadUserId || zegoUserId,
        tokenExpiresAt: zegoAccess.tokenExpiresAt || null,
      };
      setTokenDebug(tokenSummary);

      console.log("[Zego Smoke Test] loginRoom plan", {
        appId,
        appIdType: typeof appId,
        roomId: zegoRoomId,
        userID: zegoUserId,
        tokenLength: zegoToken.length,
        tokenPrefix,
        serverSequence,
        serverTestMode,
        selectedServerUrl: normalizeZegoServerUrl(selectedServerUrl) || ZEGO_WEB_SERVER,
        customServerUrl: normalizeZegoServerUrl(customServerUrl),
      });

      const attemptSummaries = [];
      let lastFailure = null;
      let lastElapsedMs = 0;

      setMessage(
        serverSequence.length > 1
          ? `Testing ${serverSequence.length} servers one by one...`
          : `Testing server ${serverSequence[0] || ZEGO_WEB_SERVER}...`
      );

      for (let index = 0; index < serverSequence.length; index += 1) {
        const serverUrl = serverSequence[index];
        const attemptResult = await runLoginAttempt({
          appId,
          roomId: zegoRoomId,
          userId: zegoUserId,
          token: zegoToken,
          serverUrl,
          attemptIndex: index,
          attemptTotal: serverSequence.length,
        });

        attemptSummaries.push(attemptResult.summary);
        setServerAttemptDebug([...attemptSummaries]);
        setLoginDebug({
          ...attemptResult.summary,
          serverSequence,
          serverTestMode,
          selectedServerUrl: normalizeZegoServerUrl(selectedServerUrl) || ZEGO_WEB_SERVER,
          customServerUrl: normalizeZegoServerUrl(customServerUrl),
          publicDebug,
          tokenDebug: tokenSummary,
        });
        setLoginElapsedMs(attemptResult.summary?.elapsedMs || 0);

        if (attemptResult.success) {
          const successSummary = {
            ...attemptResult.summary,
            attempts: attemptSummaries,
            serverSequence,
            serverTestMode,
            selectedServerUrl: normalizeZegoServerUrl(selectedServerUrl) || ZEGO_WEB_SERVER,
            customServerUrl: normalizeZegoServerUrl(customServerUrl),
            publicDebug,
            tokenDebug: tokenSummary,
          };
          setLoginDebug(successSummary);
          setPhase("joined");
          setMessage(`loginRoom succeeded on ${serverUrl}. No stream was created or published.`);
          return;
        }

        lastFailure = attemptResult.failure || new Error(attemptResult.summary?.error?.message || "loginRoom failed");
        lastElapsedMs = attemptResult.summary?.elapsedMs || lastElapsedMs;
      }

      const allTimedOut = attemptSummaries.length > 0
        && attemptSummaries.every((attempt) => attempt?.timeout || attempt?.error?.code === "LOGIN_TIMEOUT");
      const finalError = getZegoSdkErrorDetails(lastFailure, "Unable to join video server.");
      const finalSummary = {
        success: false,
        elapsedMs: lastElapsedMs,
        error: finalError,
        attempts: attemptSummaries,
        serverSequence,
        serverTestMode,
        selectedServerUrl: normalizeZegoServerUrl(selectedServerUrl) || ZEGO_WEB_SERVER,
        customServerUrl: normalizeZegoServerUrl(customServerUrl),
        publicDebug,
        tokenDebug: tokenSummary,
        allTimedOut,
      };

      setPhase("failed");
      setLoginDebug(finalSummary);
      setLoginElapsedMs(lastElapsedMs);
      setMessage(allTimedOut ? buildAllServerTimeoutMessage() : finalError.message || "Unable to join video server.");
      console.error("[Zego Smoke Test] all server attempts failed", {
        ...finalSummary,
        requestDebug,
      });
    } finally {
      setRunning(false);
    }
  };

  const combinedDebug = {
    publicDebug,
    tokenDebug,
    loginDebug,
    requestDebug,
    serverAttemptDebug,
    serverTestMode,
    selectedServerUrl,
    customServerUrl,
    activeServerUrl,
    serverSequence: buildSmokeServerSequence({
      mode: serverTestMode,
      customServerUrl,
      selectedServerUrl,
    }),
    phase,
    message,
    roomState,
    loginElapsedMs,
    pinnedServer: ZEGO_WEB_SERVER,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-10">
        <div className="w-full rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-300">Zego smoke test</p>
          <h1 className="mt-4 text-4xl font-extrabold">loginRoom only</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            This page does not create a local stream, does not publish video, and does not render remote media.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Room ID</span>
              <input
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="Paste the booking room ID"
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none ring-0 placeholder:text-slate-600 focus:border-cyan-400/60"
              />
            </label>
            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={runSmokeTest}
                disabled={running}
                className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {running ? "Running..." : "Run loginRoom"}
              </button>
              <button
                type="button"
                onClick={copyDebug}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                {copyState}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Server Test Mode</span>
                <select
                  value={serverTestMode}
                  onChange={(event) => setServerTestMode(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="single">Single server</option>
                  <option value="sequence">Try all servers one by one</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Custom Server URL</span>
                <input
                  value={customServerUrl}
                  onChange={(event) => setCustomServerUrl(event.target.value)}
                  placeholder="Paste a custom Zego server URL"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-sm text-white outline-none ring-0 placeholder:text-slate-600 focus:border-cyan-400/60"
                />
              </label>
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Preset servers</p>
              <div className="mt-3 grid gap-2 xl:grid-cols-2">
                {ZEGO_SMOKE_SERVER_PRESETS.map((server) => {
                  const isSelected = normalizeZegoServerUrl(selectedServerUrl) === normalizeZegoServerUrl(server);
                  return (
                    <button
                      key={server}
                      type="button"
                      onClick={() => setSelectedServerUrl(server)}
                      className={`rounded-2xl border px-4 py-3 text-left text-xs font-mono transition ${
                        isSelected
                          ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-50"
                          : "border-white/10 bg-slate-950 text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <span className="block text-[11px] uppercase tracking-[0.3em] text-slate-500">Selected</span>
                      <span className="mt-1 block break-all">{server}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Single server mode tests the selected preset or custom URL. Sequence mode tries the custom URL first, then the selected preset, then the full preset list one by one.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["phase", phase],
              ["roomState", roomState],
              ["loginElapsedMs", loginElapsedMs],
              ["activeServerUrl", activeServerUrl],
              ["serverTestMode", serverTestMode],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">{label}</p>
                <p className="mt-2 break-all font-mono text-sm text-white">{String(value)}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Status</p>
            <p className="mt-2 text-sm text-slate-200">{message}</p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Public debug</p>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-200">
                {JSON.stringify(publicDebug, null, 2)}
              </pre>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Token debug</p>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-200">
                {JSON.stringify(tokenDebug, null, 2)}
              </pre>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Login debug</p>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-200">
                {JSON.stringify(loginDebug, null, 2)}
              </pre>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Request debug</p>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-200">
                {JSON.stringify(requestDebug, null, 2)}
              </pre>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Server attempts</p>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-200">
              {JSON.stringify(serverAttemptDebug, null, 2)}
            </pre>
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200">Copy Zego Debug</p>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-cyan-50">
              {JSON.stringify(combinedDebug, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZegoSmokeTest;
