import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "https://muskan-portfolio-backend.onrender.com";
const ZEGO_LOGIN_TIMEOUT_MS = 60000;
const ZEGO_WEB_SERVER = "wss://webliveroom384324702-api.zegocloud.com/ws";

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
    const payload = {
      publicDebug,
      tokenDebug,
      loginDebug,
      phase,
      message,
      roomState,
      loginElapsedMs,
      requestDebug,
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
      const tokenServerCandidates = Array.isArray(zegoAccess.serverCandidates) && zegoAccess.serverCandidates.length > 0
        ? zegoAccess.serverCandidates
            .map((server) => String(server || "").trim())
            .filter((server) => server.replace(/\/+$/, "").toLowerCase() === ZEGO_WEB_SERVER.toLowerCase())
        : [];
      const serverCandidates = tokenServerCandidates.length > 0 ? tokenServerCandidates : [ZEGO_WEB_SERVER];
      const tokenPrefix = zegoToken.slice(0, 12);

      const tokenSummary = {
        appId,
        appIdType: typeof appId,
        roomId: zegoRoomId,
        userId: zegoUserId,
        tokenLength: zegoToken.length,
        tokenPrefix,
        serverCandidates,
        generatedRoomId: zegoAccess.generatedRoomId || zegoRoomId,
        tokenPayloadRoomId: zegoAccess.tokenPayloadRoomId || zegoRoomId,
        tokenPayloadUserId: zegoAccess.tokenPayloadUserId || zegoUserId,
        tokenExpiresAt: zegoAccess.tokenExpiresAt || null,
      };
      setTokenDebug(tokenSummary);

      console.log("[Zego Smoke Test] loginRoom preflight", {
        appId,
        appIdType: typeof appId,
        roomId: zegoRoomId,
        userID: zegoUserId,
        tokenLength: zegoToken.length,
        tokenPrefix,
        serverCandidates,
      });

      const { ZegoExpressEngine } = await import("zego-express-engine-webrtc");
      const engine = new ZegoExpressEngine(appId, serverCandidates);
      engineRef.current = engine;
      cleanupRoomRef.current = zegoRoomId;
      joinedRoomRef.current = false;

      engine.on("roomStateUpdate", (updatedRoomID, state, errorCode, extendedData) => {
        setRoomState(String(state || "unknown").toUpperCase());
        console.log("[Zego Smoke Test] roomStateUpdate", {
          updatedRoomID,
          state,
          errorCode,
          extendedData,
        });
      });

      engine.on("roomStateChanged", (updatedRoomID, reason, errorCode, extendedData) => {
        setRoomState(String(reason || "unknown").toUpperCase());
        console.log("[Zego Smoke Test] roomStateChanged", {
          updatedRoomID,
          reason,
          errorCode,
          extendedData,
        });
      });

      setPhase("logging-in");
      setMessage("Calling loginRoom...");
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
      setLoginElapsedMs(elapsedMs);

      const loginSummary = {
        success: loginSuccess,
        elapsedMs,
        result: typeof loginResult === "object" ? loginResult : { value: loginResult },
        appId,
        appIdType: typeof appId,
        roomId: zegoRoomId,
        userId: zegoUserId,
        tokenLength: zegoToken.length,
        tokenPrefix,
        serverCandidates,
      };
      setLoginDebug(loginSummary);

      if (!loginSuccess) {
        const loginFailure = new Error("loginRoom returned unsuccessful result");
        loginFailure.loginElapsedMs = elapsedMs;
        loginFailure.loginResult = loginResult;
        throw loginFailure;
      }

      joinedRoomRef.current = true;
      setPhase("joined");
      setMessage("loginRoom succeeded. No stream was created or published.");
    } catch (error) {
      const loginError = getZegoSdkErrorDetails(error, "Unable to join video server.");
      const elapsedMs = error?.loginElapsedMs ?? loginElapsedMs ?? 0;
      setPhase("failed");
      setMessage(loginError.message);
      setLoginElapsedMs(elapsedMs);
      setLoginDebug((current) => ({
        ...(current || {}),
        success: false,
        elapsedMs,
        error: loginError,
        requestDebug,
      }));
      console.error("[Zego Smoke Test] login failed", {
        error: loginError,
        publicDebug,
        tokenDebug,
        requestDebug,
      });
      cleanupEngine();
    } finally {
      setRunning(false);
    }
  };

  const combinedDebug = {
    publicDebug,
    tokenDebug,
    loginDebug,
    requestDebug,
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["phase", phase],
              ["roomState", roomState],
              ["loginElapsedMs", loginElapsedMs],
              ["pinnedServer", ZEGO_WEB_SERVER],
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
