const LOCAL_KEY = "securityPrivacyMode";
const SCOPE_KEY = "securityPrivacyScopes";

const readJSON = (value) => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const readPrivacyScopes = () => {
  if (typeof window === "undefined") return [];
  return readJSON(window.sessionStorage.getItem(SCOPE_KEY));
};

export const isPrivacyShieldEnabled = () => {
  if (typeof window === "undefined") return false;
  if (window.localStorage.getItem(LOCAL_KEY) === "true") return true;
  return readPrivacyScopes().length > 0;
};

export const setPrivacyScope = (scope, enabled = true) => {
  if (typeof window === "undefined" || !scope) return [];

  const scopes = new Set(readPrivacyScopes());
  if (enabled) {
    scopes.add(scope);
  } else {
    scopes.delete(scope);
  }

  window.sessionStorage.setItem(SCOPE_KEY, JSON.stringify([...scopes]));
  window.dispatchEvent(new Event("security-privacy-mode"));
  return [...scopes];
};

export const clearPrivacyScope = (scope) => setPrivacyScope(scope, false);
