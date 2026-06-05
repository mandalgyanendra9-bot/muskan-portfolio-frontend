/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { getInitials } from "../utils/profilePhoto";
import { clearPrivacyScope, setPrivacyScope } from "../utils/privacyMode";
import { useSignedMediaUrl, extractPrivateMediaPathFromValue } from "../utils/privateMedia";

const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:5000";
const WARNING_TEXT = "Session privacy protection is active for this consultation.";
const PRIVACY_SETTINGS_ENDPOINT = `${API_ROOT}/api/privacy/settings`;
const PRIVACY_SETTINGS_CACHE_KEY = "privacy-watermark-enabled-cache";
const PRIVACY_SETTINGS_TTL = 5 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hashString = (value = "") => {
  const text = String(value || "");
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) || 1;
};

const seededRandom = (seed = 1) => {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

const buildWatermarkTextVariants = (lines = []) => {
  const cleaned = lines.map((line) => String(line || "").trim()).filter(Boolean);
  if (!cleaned.length) return [WARNING_TEXT];

  const joined = cleaned.join(" | ");
  const reversed = [...cleaned].reverse().join(" | ");
  const rotated = cleaned.length > 2 ? `${cleaned[0]} | ${cleaned[cleaned.length - 1]} | ${cleaned.slice(1, -1).join(" | ")}` : joined;

  return [joined, reversed, rotated, ...cleaned];
};

const buildWatermarkItems = ({
  lines = [],
  seedText = "",
  frame = 0,
  density = "dense",
}) => {
  const variants = buildWatermarkTextVariants(lines);
  const seed = hashString(`${seedText}|${variants.join("|")}|${frame}`);
  const random = seededRandom(seed);
  const count = density === "sparse" ? 10 : density === "medium" ? 14 : 18;

  return Array.from({ length: count }, (_, index) => {
    const text = variants[index % variants.length];
    const top = clamp(Math.round(random() * 112 - 8), -8, 104);
    const left = clamp(Math.round(random() * 112 - 8), -8, 108);
    const scale = (0.86 + random() * 0.42).toFixed(2);
    const opacity = (0.12 + random() * 0.24).toFixed(2);
    const duration = (7.5 + random() * 6.5).toFixed(2);
    const delay = `-${(random() * 7.5).toFixed(2)}s`;
    const rotation = `${Math.round(-28 + random() * 56)}deg`;
    const x1 = `${Math.round((random() - 0.5) * 34)}px`;
    const y1 = `${Math.round((random() - 0.5) * 24)}px`;
    const x2 = `${Math.round((random() - 0.5) * 42)}px`;
    const y2 = `${Math.round((random() - 0.5) * 30)}px`;
    const x3 = `${Math.round((random() - 0.5) * 46)}px`;
    const y3 = `${Math.round((random() - 0.5) * 34)}px`;
    const blur = random() > 0.78 ? "0.25px" : "0px";

    return {
      text,
      style: {
        top: `${top}%`,
        left: `${left}%`,
        opacity,
        animationDelay: delay,
        animationDuration: `${duration}s`,
        "--wm-scale": scale,
        "--wm-rotation": rotation,
        "--wm-x1": x1,
        "--wm-y1": y1,
        "--wm-x2": x2,
        "--wm-y2": y2,
        "--wm-x3": x3,
        "--wm-y3": y3,
        "--wm-blur": blur,
        "--wm-z": String(10 + index),
      },
    };
  });
};

const getWatermarkToggleCache = () => {
  if (typeof window === "undefined") return { value: true, expiresAt: 0 };

  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRIVACY_SETTINGS_CACHE_KEY) || "{}");
    if (typeof parsed.value === "boolean" && Number(parsed.expiresAt) > Date.now()) {
      return { value: parsed.value, expiresAt: Number(parsed.expiresAt) };
    }
  } catch {
    // Ignore cache parse issues and fall back to the API.
  }

  return { value: true, expiresAt: 0 };
};

const setWatermarkToggleCache = (value) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PRIVACY_SETTINGS_CACHE_KEY,
      JSON.stringify({
        value: Boolean(value),
        expiresAt: Date.now() + PRIVACY_SETTINGS_TTL,
      })
    );
  } catch {
    // Cache is optional.
  }
};

export const useWatermarkProtectionEnabled = () => {
  const cached = useMemo(() => getWatermarkToggleCache(), []);
  const [enabled, setEnabled] = useState(Boolean(cached.value));
  const [loading, setLoading] = useState(!cached.expiresAt);

  useEffect(() => {
    let mounted = true;

    axios
      .get(PRIVACY_SETTINGS_ENDPOINT)
      .then((response) => {
        if (!mounted) return;
        const nextValue = response.data?.watermarkProtectionEnabled !== false;
        setEnabled(nextValue);
        setLoading(false);
        setWatermarkToggleCache(nextValue);
      })
      .catch(() => {
        if (!mounted) return;
        setEnabled(Boolean(cached.value));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [cached.value]);

  useEffect(() => {
    const onPrivacySettingsUpdate = () => {
      const next = getWatermarkToggleCache();
      setEnabled(Boolean(next.value));
    };

    window.addEventListener("storage", onPrivacySettingsUpdate);
    window.addEventListener("security-privacy-mode", onPrivacySettingsUpdate);
    window.addEventListener("security-watermark-settings", onPrivacySettingsUpdate);

    return () => {
      window.removeEventListener("storage", onPrivacySettingsUpdate);
      window.removeEventListener("security-privacy-mode", onPrivacySettingsUpdate);
      window.removeEventListener("security-watermark-settings", onPrivacySettingsUpdate);
    };
  }, []);

  return { enabled, loading };
};

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
      showWarning("right_click", "Right-click is disabled for protected consultation materials.");
    };

    const onDragStart = (event) => {
      event.preventDefault();
      showWarning("drag_attempt", "Dragging or saving protected consultation materials is disabled.");
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
      showWarning("screenshot_hotkey", "Session privacy protection is active for this consultation.");
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
        <h2 className="text-2xl font-extrabold text-white">Session privacy protection</h2>
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

const ConsentModalContent = ({
  bookingLabel = "this session",
  onAccept,
  onDecline,
  title = "Before joining, confirm the consultation privacy terms",
  description = "These protections help support secure professional communication and reduce unauthorized sharing.",
}) => {
  const [checked, setChecked] = useState({
    recording: false,
    screenshot: false,
    sharing: false,
  });

  const canProceed = checked.recording && checked.screenshot && checked.sharing;

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-slate-950/90 px-4 backdrop-blur-xl">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-primary-300">Privacy consent</p>
        <h2 className="mt-3 text-3xl font-extrabold text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-500">Session: {bookingLabel}</p>

        <div className="mt-6 space-y-3">
          {[
            ["recording", "I will not record this consultation."],
            ["screenshot", "I will respect session privacy protection requirements."],
            ["sharing", "I will not share consultation materials with others."],
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

export const ConsentModal = ({ open, ...props }) => {
  if (!open) return null;
  return <ConsentModalContent {...props} />;
};

export const PrivacyWatermark = ({
  lines = [],
  watermarkId = "",
  enabled = true,
  blurred = false,
  className = "",
  variant = "default",
  density = "dense",
}) => {
  const resolvedLines = useMemo(() => {
    const cleaned = lines.map((line) => String(line || "").trim()).filter(Boolean);
    return cleaned.length ? cleaned : [WARNING_TEXT];
  }, [lines]);

  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;

    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % 1000);
    }, variant === "call" || variant === "live" ? 1500 : 2200);

    return () => window.clearInterval(interval);
  }, [enabled, variant]);

  const items = useMemo(
    () => buildWatermarkItems({
      lines: resolvedLines,
      seedText: `${watermarkId || "watermark"}:${variant}`,
      frame,
      density,
    }),
    [density, frame, resolvedLines, variant, watermarkId]
  );

  if (!enabled && !blurred) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-black/10" />
      {enabled &&
        items.map((item, index) => (
          <div
            key={`${item.text}-${index}`}
            className={`absolute select-none whitespace-nowrap rounded-full border border-white/15 bg-slate-950/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.35em] text-white/75 shadow-lg shadow-black/25 backdrop-blur-md mix-blend-screen privacy-watermark-drift`}
            style={{
              top: item.top,
              left: item.left,
              opacity: item.style.opacity,
              animationDelay: item.style.animationDelay,
              animationDuration: item.style.animationDuration,
              "--wm-scale": item.style["--wm-scale"],
              "--wm-rotation": item.style["--wm-rotation"],
              "--wm-x1": item.style["--wm-x1"],
              "--wm-y1": item.style["--wm-y1"],
              "--wm-x2": item.style["--wm-x2"],
              "--wm-y2": item.style["--wm-y2"],
              "--wm-x3": item.style["--wm-x3"],
              "--wm-y3": item.style["--wm-y3"],
              "--wm-blur": item.style["--wm-blur"],
              "--wm-z": item.style["--wm-z"],
              filter: `blur(${item.style["--wm-blur"]})`,
              zIndex: Number(item.style["--wm-z"]),
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
  watermarkId = "",
  watermarkEnabled = true,
  signed = true,
  onClick,
  title,
  loading = "lazy",
  decoding = "async",
  fetchPriority,
}) => {
  const [brokenImage, setBrokenImage] = useState({ source: "", broken: false });
  const { signedUrl } = useSignedMediaUrl(source, { enabled: signed });
  const displayName = alt || user?.name || "Protected consultation material";
  const initials = getInitials(displayName);

  const sourceText = String(source || "").trim();
  const isPrivateSource = Boolean(extractPrivateMediaPathFromValue(sourceText));
  const safeDirectSource = !isPrivateSource && /^(https?:|data:|blob:)/i.test(sourceText) ? sourceText : "";
  const resolvedSource = signedUrl || safeDirectSource;
  const broken = brokenImage.broken && brokenImage.source === resolvedSource;

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
          loading={loading}
          decoding={decoding}
          fetchPriority={fetchPriority}
          onError={() => setBrokenImage({ source: resolvedSource, broken: true })}
        />
      )}
      {watermarkLines.length > 0 ? (
        <PrivacyWatermark
          lines={watermarkLines}
          watermarkId={watermarkId || displayName}
          enabled={watermarkEnabled}
          variant="media"
          density="medium"
        />
      ) : null}
    </div>
  );
};
