import { useState } from "react";
import API from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { GoogleLogin } from "@react-oauth/google";

const Spinner = () => (
  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [authMode, setAuthMode] = useState("password");
  const [otpRequested, setOtpRequested] = useState(false);

  const [form, setForm] = useState({ email: "", password: "" });
  const [otpForm, setOtpForm] = useState({ email: "", otp: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post("/auth/login", form);
      localStorage.setItem("token", res.data.token);
      login(res.data.user);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (error) {
      const errMsg = error.response?.data?.message || "Login failed";
      const needsVerification = error.response?.data?.needsVerification;
      if (needsVerification) {
        toast.error("Please verify your email first. Check your inbox!", { duration: 5000 });
      } else {
        toast.error(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setOtpLoading(true);
    try {
      const res = await API.post("/auth/request-otp", { email: otpForm.email });
      setOtpRequested(true);
      toast.success(res.data.message || "OTP sent if the email is registered.");
      if (res.data.debugOtp) {
        setOtpForm((prev) => ({ ...prev, otp: res.data.debugOtp }));
        toast.success(`Dev OTP: ${res.data.debugOtp}`, { duration: 8000 });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpLoading(true);
    try {
      const res = await API.post("/auth/verify-otp", otpForm);
      localStorage.setItem("token", res.data.token);
      login(res.data.user);
      toast.success("OTP login successful!");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "OTP verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoading(true);
    try {
      const res = await API.post("/auth/google-login", {
        credential: credentialResponse.credential,
      });
      localStorage.setItem("token", res.data.token);
      login(res.data.user);
      toast.success("Google login successful!");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Google login failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px] -z-10 animate-pulse delay-700" />

        <div className="w-full max-w-md glass p-10 rounded-[2rem] border-white/5 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/30">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-1">Welcome Back</h2>
            <p className="text-slate-400 text-sm">Sign in to access your dashboard</p>
          </div>

          <div className="mb-6">
            <div className="flex justify-center">
              {googleLoading ? (
                <div className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-xl py-3 px-5 text-slate-300">
                  <Spinner />
                  Signing in with Google...
                </div>
              ) : (
                <div className="w-full" style={{ colorScheme: "dark" }}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => toast.error("Google login failed")}
                    theme="filled_black"
                    shape="rectangular"
                    width="100%"
                    text="signin_with"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-slate-500 text-xs font-medium">OR</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6 rounded-2xl bg-white/5 border border-white/10 p-1">
            <button
              type="button"
              onClick={() => setAuthMode("password")}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                authMode === "password" ? "bg-primary-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("otp");
                setOtpForm((prev) => ({ ...prev, email: prev.email || form.email }));
              }}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                authMode === "otp" ? "bg-emerald-400 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
            >
              OTP Login
            </button>
          </div>

          {authMode === "password" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all placeholder-slate-600"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all placeholder-slate-600"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Spinner />
                    Signing in...
                  </>
                ) : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={otpRequested ? handleVerifyOtp : handleRequestOtp} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-emerald-400 transition-all placeholder-slate-600"
                  value={otpForm.email}
                  onChange={(e) => {
                    setOtpRequested(false);
                    setOtpForm({ ...otpForm, email: e.target.value, otp: "" });
                  }}
                  required
                />
              </div>

              {otpRequested ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300 ml-1">One-Time Password</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength="6"
                    placeholder="123456"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-emerald-400 transition-all placeholder-slate-600 tracking-[0.4em] font-bold"
                    value={otpForm.otp}
                    onChange={(e) => setOtpForm({ ...otpForm, otp: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    required
                  />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={otpLoading}
                className="w-full bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/10 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {otpLoading ? (
                  <>
                    <Spinner />
                    Processing...
                  </>
                ) : otpRequested ? "Verify OTP" : "Send OTP"}
              </button>

              {otpRequested ? (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={otpLoading}
                  className="w-full text-sm text-emerald-300 hover:text-emerald-200 font-bold disabled:opacity-50"
                >
                  Resend OTP
                </button>
              ) : null}
            </form>
          )}

          <p className="text-center mt-8 text-slate-400 text-sm">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary-400 hover:underline font-medium">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
