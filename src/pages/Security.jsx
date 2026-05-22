import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "securityPrivacyMode";

const securityFeatures = [
  {
    title: "OTP Login",
    detail: "Email one-time password flow with expiry, attempt tracking, and route-level throttling.",
  },
  {
    title: "End-to-End Encryption",
    detail: "AES-GCM demo keeps plaintext in the browser and only shares encrypted payloads.",
  },
  {
    title: "Session Protection",
    detail: "JWT sessions are bound to a protected session id and browser fingerprint.",
  },
  {
    title: "Anti-Screenshot (mobile apps)",
    detail: "Privacy shield disables copying, blocks print output, and is ready for mobile secure-screen controls.",
  },
  {
    title: "Rate Limiting",
    detail: "Sensitive auth, OTP, password reset, and API routes now return rate-limit headers.",
  },
];

const bytesToBase64 = (bytes) => {
  const chunkSize = 0x8000;
  let binary = "";
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let index = 0; index < source.length; index += chunkSize) {
    binary += String.fromCharCode(...source.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const deriveKey = async (passphrase, salt) => {
  const encoded = new TextEncoder().encode(passphrase);
  const keyMaterial = await window.crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"]);
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 120000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const Security = () => {
  const { user } = useAuth();
  const [sessionStatus, setSessionStatus] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [plainText, setPlainText] = useState("Private booking note for a premium consultation.");
  const [passphrase, setPassphrase] = useState("");
  const [cipherText, setCipherText] = useState("");
  const [decryptedText, setDecryptedText] = useState("");
  const [cryptoBusy, setCryptoBusy] = useState(false);

  const sessionCards = useMemo(() => {
    if (!sessionStatus) {
      return [
        { label: "Session", value: user ? "Checking" : "Login required" },
        { label: "Protection", value: user ? "Pending" : "Available after login" },
        { label: "Rate Limit", value: "Active" },
      ];
    }

    return [
      { label: "Session", value: sessionStatus.activeSession ? "Active" : "No active session" },
      { label: "Protection", value: sessionStatus.sessionProtectionEnabled ? "Enabled" : "Disabled" },
      {
        label: "Last Login",
        value: sessionStatus.lastLoginAt
          ? new Date(sessionStatus.lastLoginAt).toLocaleString()
          : "Not recorded",
      },
    ];
  }, [sessionStatus, user]);

  useEffect(() => {
    const fetchSessionStatus = async () => {
      if (!user) return;
      const token = localStorage.getItem("token");
      if (!token) return;

      setSessionLoading(true);
      try {
        const res = await API.get("/auth/session", {
          headers: { Authorization: token },
        });
        setSessionStatus(res.data);
      } catch {
        setSessionStatus(null);
      } finally {
        setSessionLoading(false);
      }
    };

    fetchSessionStatus();
  }, [user]);

  const updatePrivacyMode = () => {
    const next = !privacyMode;
    localStorage.setItem(STORAGE_KEY, String(next));
    setPrivacyMode(next);
    window.dispatchEvent(new Event("security-privacy-mode"));
    toast.success(next ? "Privacy shield enabled" : "Privacy shield disabled");
  };

  const handleEncrypt = async () => {
    if (!window.crypto?.subtle) {
      toast.error("Web Crypto is not available in this browser.");
      return;
    }
    if (!plainText.trim() || !passphrase.trim()) {
      toast.error("Message and passphrase are required.");
      return;
    }

    setCryptoBusy(true);
    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(passphrase, salt);
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(plainText)
      );

      setCipherText(JSON.stringify({
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(encrypted)),
      }));
      setDecryptedText("");
      toast.success("Message encrypted in browser");
    } catch {
      toast.error("Encryption failed");
    } finally {
      setCryptoBusy(false);
    }
  };

  const handleDecrypt = async () => {
    if (!cipherText.trim() || !passphrase.trim()) {
      toast.error("Encrypted payload and passphrase are required.");
      return;
    }

    setCryptoBusy(true);
    try {
      const payload = JSON.parse(cipherText);
      const salt = base64ToBytes(payload.salt);
      const iv = base64ToBytes(payload.iv);
      const encrypted = base64ToBytes(payload.ciphertext);
      const key = await deriveKey(passphrase, salt);
      const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
      setDecryptedText(new TextDecoder().decode(decrypted));
      toast.success("Message decrypted");
    } catch {
      toast.error("Could not decrypt. Check payload and passphrase.");
    } finally {
      setCryptoBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-text-main">
      <Navbar />

      <main className="pt-32 pb-20">
        <section className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-flex px-3 py-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 text-xs font-extrabold uppercase tracking-wider">
              Security Features
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mt-5 leading-tight">
              Safer login, protected sessions, and private content controls
            </h1>
            <p className="text-slate-400 text-lg mt-5 leading-relaxed">
              OTP Login, End-to-End Encryption, Session Protection, Anti-Screenshot controls, and Rate Limiting are now part of the platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mt-12">
            {securityFeatures.map((feature) => (
              <article key={feature.title} className="glass rounded-2xl p-5 border-white/5">
                <div className="h-10 w-10 rounded-xl border border-emerald-300/30 bg-emerald-400/10 flex items-center justify-center mb-5">
                  <svg className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z" />
                  </svg>
                </div>
                <h2 className="text-white font-bold">{feature.title}</h2>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed">{feature.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20 border-y border-white/5 bg-surface-variant/10">
          <div className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-[0.85fr_1.15fr] gap-8 items-start">
            <div>
              <span className="text-emerald-300 text-xs font-extrabold uppercase tracking-wider">
                End-to-End Encryption
              </span>
              <h2 className="text-3xl font-extrabold text-white mt-3">Encrypt a private message in the browser</h2>
              <p className="text-slate-400 mt-4 leading-relaxed">
                This uses Web Crypto with PBKDF2 and AES-GCM. The backend only needs to store or move ciphertext, while the passphrase stays with the user.
              </p>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-300">Plain message</span>
                <textarea
                  value={plainText}
                  onChange={(event) => setPlainText(event.target.value)}
                  className="min-h-28 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-400 text-sm"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-300">Passphrase</span>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  placeholder="Create a strong shared passphrase"
                  className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-400 text-sm"
                />
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleEncrypt}
                  disabled={cryptoBusy}
                  className="px-5 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold disabled:opacity-60 transition-all active:scale-[0.98]"
                >
                  Encrypt
                </button>
                <button
                  type="button"
                  onClick={handleDecrypt}
                  disabled={cryptoBusy || !cipherText}
                  className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold disabled:opacity-60 transition-all active:scale-[0.98]"
                >
                  Decrypt
                </button>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-300">Encrypted payload</span>
                <textarea
                  value={cipherText}
                  onChange={(event) => setCipherText(event.target.value)}
                  placeholder="Encrypted JSON payload appears here"
                  className="min-h-32 bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-emerald-400 text-xs text-emerald-100 font-mono"
                />
              </label>

              {decryptedText ? (
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
                  <p className="text-xs uppercase tracking-wider font-extrabold text-emerald-300">Decrypted text</p>
                  <p className="text-white mt-2">{decryptedText}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 mt-16 grid lg:grid-cols-2 gap-8">
          <div className="glass rounded-2xl p-6 border-white/5">
            <div className="flex items-start justify-between gap-5">
              <div>
                <span className="text-sky-300 text-xs font-extrabold uppercase tracking-wider">Session Protection</span>
                <h2 className="text-2xl font-extrabold text-white mt-2">Protected login sessions</h2>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                  New logins create a server-tracked session id and browser fingerprint, so older or mismatched tokens can be rejected.
                </p>
              </div>
              {sessionLoading ? (
                <div className="h-9 w-9 rounded-full border-2 border-sky-300 border-t-transparent animate-spin" />
              ) : null}
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              {sessionCards.map((item) => (
                <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{item.label}</p>
                  <p className="text-white font-bold mt-2 break-words">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border-white/5">
            <span className="text-rose-300 text-xs font-extrabold uppercase tracking-wider">
              Anti-Screenshot (mobile apps)
            </span>
            <h2 className="text-2xl font-extrabold text-white mt-2">Privacy shield</h2>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Turn on privacy mode to block selection, right-click, drag-copy, and print capture in the web app. Native mobile builds can map this to secure-screen APIs.
            </p>
            <button
              type="button"
              onClick={updatePrivacyMode}
              className={`mt-6 inline-flex items-center gap-3 rounded-xl px-5 py-3 font-extrabold transition-all active:scale-[0.98] ${
                privacyMode
                  ? "bg-rose-400 text-slate-950 hover:bg-rose-300"
                  : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
              }`}
            >
              <span className={`h-3 w-3 rounded-full ${privacyMode ? "bg-slate-950" : "bg-slate-500"}`} />
              {privacyMode ? "Disable Privacy Shield" : "Enable Privacy Shield"}
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Security;
