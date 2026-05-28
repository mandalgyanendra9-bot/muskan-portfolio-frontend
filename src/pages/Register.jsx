import { useState } from "react";
import API from "../services/api";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    referralCode: (searchParams.get("ref") || "").toUpperCase(),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await API.post("/auth/register", form);
      setRegisteredEmail(form.email);
      setRegistered(true);
      toast.success("Account created! Check your email 📧");
    } catch (error) {
      toast.error(error.response?.data?.message || "Registration failed");
    } finally { setLoading(false); }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoading(true);
    try {
      const res = await API.post("/auth/google-login", {
        credential: credentialResponse.credential,
        referralCode: form.referralCode,
      });
      localStorage.setItem("token", res.data.token);
      login(res.data.user);
      toast.success("Account created with Google! 🎉");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Google sign-up failed");
    } finally { setGoogleLoading(false); }
  };

  if (registered) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-[100px] -z-10 animate-pulse" />
          <div className="w-full max-w-md glass p-10 rounded-[2rem] border-white/5 shadow-2xl text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Check Your Email!</h2>
            <p className="text-slate-400 mb-2 text-sm">We sent a verification link to:</p>
            <p className="text-primary-400 font-semibold mb-6 text-lg">{registeredEmail}</p>
            <p className="text-slate-500 text-sm mb-8">
              Click the link in the email to activate your account.<br /><br />
              Can't find it? Check your <strong className="text-slate-400">Spam</strong> folder.
            </p>
            <Link to="/login" className="inline-block w-full bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98] text-center">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px] -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] -z-10 animate-pulse delay-700" />
        <div className="w-full max-w-md glass p-10 rounded-[2rem] border-white/5 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/30">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold mb-1">Create Account</h2>
            <p className="text-slate-400 text-sm">Join us and start your journey</p>
          </div>

          <div className="mb-6">
            {googleLoading ? (
              <div className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-xl py-3 px-5 text-slate-300">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Signing up with Google...
              </div>
            ) : (
              <div className="w-full" style={{ colorScheme: "dark" }}>
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error("Google sign-up failed")} theme="filled_black" shape="rectangular" width="100%" text="signup_with" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-slate-500 text-xs font-medium">OR</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Full Name</label>
              <input type="text" placeholder="John Doe" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all placeholder-slate-600" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
              <input type="email" placeholder="name@example.com" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all placeholder-slate-600" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
              <input type="password" placeholder="Min. 6 characters" className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all placeholder-slate-600" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Referral Code (Optional)</label>
              <input
                type="text"
                placeholder="Enter referral code"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all placeholder-slate-600 uppercase"
                value={form.referralCode}
                onChange={(e) => setForm({ ...form, referralCode: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <label className="hidden">Account Type</label>
              <select className="hidden" value="client" onChange={() => {}}>
                <option value="client">Client — Hire & Book Experts</option>
                <option value="expert">Expert — Offer Services</option>
              </select>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? (<><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Creating...</>) : "Create Account"}
            </button>
          </form>

          <p className="text-center mt-8 text-slate-400 text-sm">
            Already have an account? <Link to="/login" className="text-primary-400 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
