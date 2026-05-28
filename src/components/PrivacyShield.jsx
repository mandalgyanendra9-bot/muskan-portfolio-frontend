import { useEffect, useState } from "react";

const STORAGE_KEY = "securityPrivacyMode";

const readPrivacyMode = () => localStorage.getItem(STORAGE_KEY) === "true";

const PrivacyShield = () => {
  const [active, setActive] = useState(readPrivacyMode);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const sync = () => setActive(readPrivacyMode());
    window.addEventListener("storage", sync);
    window.addEventListener("security-privacy-mode", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("security-privacy-mode", sync);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("security-privacy-mode", active);
    if (!active) {
      return undefined;
    }

    const blockDefault = (event) => event.preventDefault();
    const flashOverlay = () => {
      setShowOverlay(true);
      window.setTimeout(() => setShowOverlay(false), 1800);
    };
    const handleKeyDown = (event) => {
      if (event.key === "PrintScreen") flashOverlay();
    };
    const handleBeforePrint = () => setShowOverlay(true);
    const handleAfterPrint = () => setShowOverlay(false);

    document.addEventListener("contextmenu", blockDefault);
    document.addEventListener("dragstart", blockDefault);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      document.body.classList.remove("security-privacy-mode");
      document.removeEventListener("contextmenu", blockDefault);
      document.removeEventListener("dragstart", blockDefault);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [active]);

  if (!active || !showOverlay) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center text-center px-6">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 h-14 w-14 rounded-full border border-emerald-300/40 bg-emerald-400/10 flex items-center justify-center text-2xl">
          <svg className="h-7 w-7 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
          </svg>
        </div>
        <p className="text-white text-2xl font-extrabold">Privacy shield active</p>
        <p className="text-slate-400 mt-2 text-sm">
          Sensitive content is hidden while capture or print actions are detected.
        </p>
      </div>
    </div>
  );
};

export default PrivacyShield;
