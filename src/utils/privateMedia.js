import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_ROOT = import.meta.env.VITE_API_URL || "http://localhost:5000";

const getBackendOrigin = () => API_ROOT.replace(/\/+$/, "");

const extractPrivateMediaPath = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(data:|blob:)/i.test(text)) return "";

  if (/^https?:\/\//i.test(text)) {
    try {
      new URL(text);
      const backendOrigin = getBackendOrigin();
      if (backendOrigin && text.startsWith(backendOrigin) && text.includes("/uploads/")) {
        return text.slice(text.indexOf("/uploads/"));
      }
    } catch {
      return "";
    }
    return "";
  }

  if (text.startsWith("/uploads/")) return text;
  if (text.startsWith("uploads/")) return `/${text}`;
  return "";
};

const getDirectSource = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^(https?:|data:|blob:)/i.test(text)) return text;
  if (!extractPrivateMediaPath(text)) return text;
  return "";
};

const mediaCache = new Map();

export const useSignedMediaUrl = (value, options = {}) => {
  const expiresIn = options.expiresIn || 10 * 60;
  const enabled = options.enabled !== false;
  const [mediaState, setMediaState] = useState({ key: "", loading: false, signedUrl: "" });

  const sourceKey = useMemo(() => String(value || ""), [value]);
  const directSource = useMemo(() => getDirectSource(sourceKey), [sourceKey]);
  const privatePath = useMemo(() => extractPrivateMediaPath(sourceKey), [sourceKey]);
  const cacheKey = privatePath ? `${privatePath}:${expiresIn}` : "";
  const activeMediaState = mediaState.key === cacheKey ? mediaState : { loading: false, signedUrl: "" };
  const signedUrl = activeMediaState.signedUrl;

  useEffect(() => {
    let mounted = true;

    if (!enabled || directSource || !privatePath) {
      return () => {
        mounted = false;
      };
    }

    const cached = mediaCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 1000) {
      Promise.resolve().then(() => {
        if (mounted) {
          setMediaState({ key: cacheKey, loading: false, signedUrl: cached.url });
        }
      });
      return () => {
        mounted = false;
      };
    }

    Promise.resolve()
      .then(() => {
        if (!mounted) return null;
        setMediaState({ key: cacheKey, loading: true, signedUrl: "" });
        return axios.get(`${getBackendOrigin()}/api/media/sign`, {
          params: {
            path: privatePath,
            expiresIn,
          },
        });
      })
      .then((response) => {
        if (!mounted || !response) return;
        const url = `${getBackendOrigin()}${response.data.url || ""}`;
        mediaCache.set(cacheKey, {
          url,
          expiresAt: Date.parse(response.data.expiresAt) || Date.now() + expiresIn * 1000,
        });
        setMediaState({ key: cacheKey, loading: false, signedUrl: url });
      })
      .catch(() => {
        if (!mounted) return;
        setMediaState({ key: cacheKey, loading: false, signedUrl: "" });
      });

    return () => {
      mounted = false;
    };
  }, [cacheKey, directSource, enabled, expiresIn, privatePath]);

  return {
    loading: activeMediaState.loading,
    privatePath,
    signedUrl: signedUrl || directSource || "",
  };
};

export const extractPrivateMediaPathFromValue = extractPrivateMediaPath;
