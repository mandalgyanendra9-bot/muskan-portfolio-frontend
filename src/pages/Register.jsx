import { useState } from "react";
import API from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const Register = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post("/auth/register", form);
      toast.success("Registration Successful");
      navigate("/login");
    } catch (error) {
      toast.error("Registration Failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px] -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] -z-10 animate-pulse delay-700" />
        
        <div className="w-full max-w-md glass p-10 rounded-[2rem] border-white/5 shadow-2xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">Join Us</h2>
            <p className="text-slate-400">Create your account to start building your portfolio</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 ml-1">Account Type</label>
              <select
                className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-5 py-3 focus:outline-none focus:border-primary-500 transition-all text-white"
                value={form.role || "user"}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="user">Regular User</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <button type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary-500/20 active:scale-[0.98]">
              Create Account
            </button>
          </form>

          <p className="text-center mt-8 text-slate-400 text-sm">
            Already have an account? <Link to="/login" className="text-primary-400 hover:underline font-medium">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;