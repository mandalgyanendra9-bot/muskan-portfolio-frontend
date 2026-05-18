import { useEffect, useState } from "react";
import API from "../services/api";
import { useParams, Link } from "react-router-dom";
import Navbar from "../components/Navbar";

const VerifyEmail = () => {
  const { token } = useParams();
  const [status, setStatus] = useState("loading"); // "loading" | "success" | "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await API.get(`/auth/verify-email/${token}`);
        setMessage(res.data.message);
        setStatus("success");
      } catch (error) {
        setMessage(
          error.response?.data?.message || "Verification failed. The link may be invalid or expired."
        );
        setStatus("error");
      }
    };
    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] -z-10 animate-pulse delay-700" />

        <div className="w-full max-w-md glass p-10 rounded-[2rem] border-white/5 shadow-2xl text-center">

          {/* ── Loading ─────────────────────────────────────────────────────── */}
          {status === "loading" && (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary-500/30">
                <svg className="animate-spin w-10 h-10 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3">Verifying Email...</h2>
              <p className="text-slate-400 text-sm">Please wait while we verify your email address.</p>
            </>
          )}

          {/* ── Success ─────────────────────────────────────────────────────── */}
          {status === "success" && (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30 animate-bounce">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-green-400">Email Verified!</h2>
              <p className="text-slate-400 text-sm mb-8">{message}</p>

              {/* Confetti-like dots */}
              <div className="flex justify-center gap-2 mb-8">
                {["bg-primary-500", "bg-purple-500", "bg-green-500", "bg-yellow-500", "bg-pink-500"].map((c, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${c} animate-bounce`}
                    style={{ animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>

              <Link
                to="/login"
                className="inline-block w-full text-center bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98]"
              >
                Sign In Now 🚀
              </Link>
            </>
          )}

          {/* ── Error ───────────────────────────────────────────────────────── */}
          {status === "error" && (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/30">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-3 text-red-400">Verification Failed</h2>
              <p className="text-slate-400 text-sm mb-8">{message}</p>
              <div className="space-y-3">
                <Link
                  to="/register"
                  className="inline-block w-full text-center bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98]"
                >
                  Register Again
                </Link>
                <Link
                  to="/login"
                  className="inline-block w-full text-center bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-medium py-3 rounded-xl transition-all"
                >
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
