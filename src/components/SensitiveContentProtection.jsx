import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { getInitials } from "../utils/profilePhoto";
import { clearPrivacyScope, setPrivacyScope } from "../utils/privacyMode";
import { useSignedMediaUrl, extractPrivateMediaPathFromValue } from "../utils/privateMedia";

const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:5000";
const WARNING_TEXT = "Screenshots/recording are prohibited and may lead to account ban.";

export const useSensitiveContentProtection = ({
  enabled = true,
  scope,
  bookingId = "",
  targetUserId = "",
  page = "sensitive",
  details = "",
} = {}) => {
  const [blurred, setBlurred] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [warningVisible, setWarningVisible] = useState(false);
  const warningTimerRef = useRef(null);

  const logViolation = useCallback(
    async (action, reason = "") => {
      if (!enabled) return;

      try {
        const token = localStorage.getItem("token");
        await axios.post(
          `${API_ROOT}/api/privacy/violations`,
          {
            bookingId: bookingId || null,
            targetUserId: targetUserId || null,
            action,
            details: String(reason || details || "").slice(0, 1000),
            page,
            source: "web",
            timestamp: new Date().toISOString(),
          },
          {
            headers: token ? { Authorization: token } : {},
          }
        );
      } catch {
        // Silent by design. Logging should never break the protected page.
      }
    },
    [bookingId, details, enabled, page, targetUserId]
  );

  const dismissWarning = useCallback(() => {
    setWarningVisible(false);
    setWarningMessage("");
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }, []);

  const showWarning = useCallback(
    async (action, reason = WARNING_TEXT) => {
      const message = String(reason || WARNING_TEXT);
      setWarningMessage(message);
      setWarningVisible(true);

      window.dispatchEvent(
        new CustomEvent("security-privacy-warning", {
          detail: { message },
        })
      );

      await logViolation(action, message);
      toast.error(message, { duration: 2200 });

      if (warningTimerRef.current) {
        window.clearTimeout(warningTimerRef.current);
      }
      warningTimerRef.current = window.setTimeout(() => {
        setWarningVisible(false);
      }, 2200);
    },
    [logViolation]
  );

  useEffect(() => {
    if (!enabled || !scope) return undefined;
    setPrivacyScope(scope, true);

    return () => {
      clearPrivacyScope(scope);
    };
  }, [enabled, scope]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onContextMenu = (event) => {
      event.preventDefault();
      showWarning("right_click", "Right-click is disabled on protected content.");
    };

    const onDragStart = (event) => {
      event.preventDefault();
      showWarning("drag_attempt", "Dragging or saving protected media is disabled.");
    };

    const onKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      const isScreenshotKey =
        event.key === "PrintScreen" ||
        (event.ctrlKey && event.shiftKey && key === "s") ||
        (event.metaKey && event.shiftKey && key === "s");

      if (!isScreenshotKey) return;

      event.preventDefault();
      event.stopPropagation();
      showWarning("screenshot_hotkey", "Screenshots/recording are prohibited and may lead to account ban.");
    };

    const onVisibilityChange = () => {
      setBlurred(Boolean(document.hidden));
      if (document.hidden) {
        void logViolation("page_hidden", "Tab lost focus or became hidden");
      }
    };

    const onBlur = () => setBlurred(true);
    const onFocus = () => setBlurred(false);

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, logViolation, showWarning]);

  return {
    blurred,
    dismissWarning,
    warningMessage,
    warningVisible,
    logViolation,
    showWarning,
    setBlurred,
  };
};

export const PrivacyWarningModal = ({ open, message = WARNING_TEXT, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/90 px-4 backdrop-blur-xl">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M10.29 3.86l-8.14 14.5A2 2 0 003.9 21h16.2a2 2 0 001.75-2.64l-8.14-14.5a2 2 0 00-3.52 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-extrabold text-white">Capture blocked</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-2xl bg-primary-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-primary-600"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
};

export const ConsentModal = ({
  open,
  bookingLabel = "this session",
  onAccept,
  onDecline,
  title = "Before joining, confirm the privacy terms",
  description = "These protections help reduce copying, recording, and accidental leakage.",
}) => {
  const [checked, setChecked] = useState({
    recording: false,
    screenshot: false,
    sharing: false,
  });

  useEffect(() => {
    if (open) {
      setChecked({ recording: false, screenshot: false, sharing: false });
    }
  }, [open]);

  const canProceed = checked.recording && checked.screenshot && checked.sharing;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/90 px-4 backdrop-blur-xl">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary-300">Privacy consent</p>
        <h2 className="mt-3 text-3xl font-extrabold text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-500">Session: {bookingLabel}</p>

        <div className="mt-6 space-y-3">
          {[
            ["recording", "I will not record this call or content."],
            ["screenshot", "I will not capture screenshots or screen grabs."],
            ["sharing", "I will not share the session content with others."],
          ].map(([key, label]) => (
            <label key={key} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={checked[key]}
                onChange={(event) => setChecked((current) => ({ ...current, [key]: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-primary-500 focus:ring-primary-500"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={!canProceed}
            className="rounded-2xl bg-primary-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            I Agree and Join
          </button>
        </div>
      </div>
    </div>
  );
};

export const PrivacyWatermark = ({
  lines = [],
  blurred = false,
  className = "",
  variant = "default",
}) => {
  const resolvedLines = useMemo(() => {
    const cleaned = lines.map((line) => String(line || "").trim()).filter(Boolean);
    return cleaned.length ? cleaned : [WARNING_TEXT];
  }, [lines]);

  const items = useMemo(() => {
    const base = resolvedLines.join(" | ");
    return new Array(8).fill(null).map((_, index) => ({
      text: base,
      top: `${(index * 13) % 82}%`,
      left: `${(index * 17) % 74}%`,
      delay: `${index * -1.7}s`,
      duration: `${13 + index}s`,
    }));
  }, [resolvedLines]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {items.map((item, index) => (
        <div
          key={`${item.text}-${index}`}
          className={`absolute select-none whitespace-nowrap rounded-full border border-white/15 bg-slate-950/35 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.35em] text-white/70 shadow-lg shadow-black/20 backdrop-blur-md ${variant === "default" ? "privacy-watermark-float" : "privacy-watermark-sweep"}`}
          style={{
            top: item.top,
            left: item.left,
            animationDelay: item.delay,
            animationDuration: item.duration,
          }}
        >
          {item.text}
        </div>
      ))}
      {blurred && <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[18px]" />}
    </div>
  );
};

export const SecureMediaImage = ({
  source,
  user,
  alt = "",
  className = "",
  imageClassName = "",
  fallbackClassName = "",
  watermarkLines = [],
  signed = true,
  onClick,
  title,
}) => {
  const [broken, setBroken] = useState(false);
  const { signedUrl } = useSignedMediaUrl(source, { enabled: signed });
  const displayName = alt || user?.name || "Protected media";
  const initials = getInitials(displayName);

  useEffect(() => {
    setBroken(false);
  }, [signedUrl, source]);

  const sourceText = String(source || "").trim();
  const isPrivateSource = Boolean(extractPrivateMediaPathFromValue(sourceText));
  const safeDirectSource = !isPrivateSource && /^(https?:|data:|blob:)/i.test(sourceText) ? sourceText : "";
  const resolvedSource = signedUrl || safeDirectSource;

  const handleContextMenu = (event) => event.preventDefault();
  const handleDragStart = (event) => event.preventDefault();

  return (
    <div
      className={`relative overflow-hidden privacy-sensitive-surface ${className}`}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart}
      onClick={onClick}
      title={title || displayName}
    >
      {!resolvedSource || broken ? (
        <div className={`flex h-full w-full items-center justify-center bg-white/5 ${fallbackClassName}`}>
          {initials}
        </div>
      ) : (
        <img
          src={resolvedSource}
          alt={displayName}
          title={title || displayName}
          className={`h-full w-full object-cover ${imageClassName}`}
          draggable={false}
          onError={() => setBroken(true)}
        />
      )}
      {watermarkLines.length > 0 ? <PrivacyWatermark lines={watermarkLines} /> : null}
    </div>
  );
};
