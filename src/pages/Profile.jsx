import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const SKILL_SUGGESTIONS = ["React", "Node.js", "Python", "MongoDB", "TypeScript", "Next.js", "Vue", "Angular", "Django", "Laravel", "Flutter", "AWS", "Docker", "GraphQL", "SQL"];

const CATEGORIES = ["Web Development", "Mobile Development", "UI/UX Design", "Graphic Design", "Digital Marketing", "Content Writing", "Video Editing", "Consulting", "Data Science", "DevOps", "Other"];

const DEFAULT_SCHEDULE = [
  { day: "Monday", from: "09:00", to: "18:00", available: false },
  { day: "Tuesday", from: "09:00", to: "18:00", available: false },
  { day: "Wednesday", from: "09:00", to: "18:00", available: false },
  { day: "Thursday", from: "09:00", to: "18:00", available: false },
  { day: "Friday", from: "09:00", to: "18:00", available: false },
  { day: "Saturday", from: "10:00", to: "15:00", available: false },
  { day: "Sunday", from: "10:00", to: "15:00", available: false },
];

const StarRating = ({ rating }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(i => (
      <span key={i} className={`text-lg ${i <= rating ? "text-yellow-400" : "text-slate-700"}`}>★</span>
    ))}
  </div>
);

const Profile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();
  const skillInputRef = useRef();
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [skillInput, setSkillInput] = useState("");
  const [gallery, setGallery] = useState(user?.portfolioGallery || []);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [schedule, setSchedule] = useState(
    user?.availabilitySchedule?.length ? user.availabilitySchedule : DEFAULT_SCHEDULE
  );
  const [form, setForm] = useState({
    name: user?.name || "",
    title: user?.title || "",
    category: user?.category || "",
    bio: user?.bio || "",
    skills: user?.skills || [],
    hourlyRate: user?.hourlyRate || 0,
    pricePerMinute: user?.pricePerMinute || 0,
    location: user?.location || "",
    experience: user?.experience || "",
    github: user?.github || "",
    linkedin: user?.linkedin || "",
    portfolio: user?.portfolio || "",
    introVideo: user?.introVideo || "",
    exclusiveContent: user?.exclusiveContent || "",
    isAvailable: user?.isAvailable !== false,
    role: user?.role || "client",
  });

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (activeTab === "reviews") fetchReviews();
  }, [activeTab, user]);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const token = localStorage.getItem("token");
      const res = await API.get("/reviews/mine", { headers: { Authorization: token } });
      setReviews(res.data);
    } catch { setReviews([]); } finally { setLoadingReviews(false); }
  };

  const handleImageDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addSkill = (skill) => {
    const s = (skill || skillInput).trim();
    if (!s || form.skills.includes(s)) return;
    setForm(f => ({ ...f, skills: [...f.skills, s] }));
    setSkillInput("");
  };

  const removeSkill = (skill) => setForm(f => ({ ...f, skills: f.skills.filter(s => s !== skill) }));

  const handleToggleAvailability = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.put("/profiles/update", { isAvailable: !form.isAvailable }, { headers: { Authorization: token } });
      updateUser(res.data);
      setForm(f => ({ ...f, isAvailable: !f.isAvailable }));
      toast.success(`Status: ${!form.isAvailable ? "🟢 Online" : "⚫ Offline"}`);
    } catch { toast.error("Failed to update status"); }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setGalleryUploading(true);
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      files.forEach(f => fd.append("images", f));
      const res = await API.post("/profiles/gallery", fd, {
        headers: { Authorization: token, "Content-Type": "multipart/form-data" },
      });
      setGallery(res.data.portfolioGallery);
      toast.success(`${files.length} image(s) uploaded!`);
    } catch { toast.error("Gallery upload failed"); }
    finally { setGalleryUploading(false); }
  };

  const handleGalleryDelete = async (idx) => {
    try {
      const token = localStorage.getItem("token");
      const res = await API.delete(`/profiles/gallery/${idx}`, { headers: { Authorization: token } });
      setGallery(res.data.portfolioGallery);
      toast.success("Image removed");
    } catch { toast.error("Failed to remove image"); }
  };

  const updateSchedule = (idx, field, val) => {
    setSchedule(s => s.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      Object.keys(form).forEach(k => {
        if (k === "skills") fd.append("skills", form.skills.join(","));
        else fd.append(k, form[k]);
      });
      fd.append("availabilitySchedule", JSON.stringify(schedule));
      if (imageFile) fd.append("profileImage", imageFile);
      const res = await API.put("/profiles/update", fd, {
        headers: { Authorization: token, "Content-Type": "multipart/form-data" },
      });
      updateUser(res.data);
      setGallery(res.data.portfolioGallery || []);
      toast.success("Profile saved! ✅");
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally { setSaving(false); }
  };

  const avatarSrc = imagePreview || (user?.profileImage ? (user.profileImage.startsWith("http") ? user.profileImage : `${import.meta.env.VITE_API_URL}${user.profileImage}`) : null);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-grow pt-28 pb-20 px-4 max-w-4xl mx-auto w-full">

        {/* ── Hero Card ────────────────────────────────────────────────── */}
        <div className="glass rounded-[2.5rem] p-8 border-white/5 shadow-2xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary-500 via-purple-500 to-accent" />
          <div className="absolute top-1/3 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-[80px] -z-0" />

          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            {/* DP Upload */}
            <div
              className={`relative group cursor-pointer flex-shrink-0 ${dragOver ? "scale-105" : ""} transition-transform`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleImageDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className={`w-36 h-36 rounded-full border-4 ${dragOver ? "border-primary-500" : "border-white/10"} overflow-hidden shadow-2xl transition-all`}>
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center text-5xl font-bold text-primary-400">
                    {user?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-7 h-7 text-white mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-white text-xs font-bold">Change Photo</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageDrop} />
              {/* Online dot */}
              <span className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-[#0f172a] ${form.isAvailable ? "bg-emerald-500" : "bg-slate-500"}`} />
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-extrabold text-white">{user?.name}</h1>
              <p className="text-primary-400 font-semibold mt-1">{user?.title || "Set your title"}</p>
              <p className="text-slate-500 text-sm mt-1 capitalize">{user?.role} · {user?.location || "Location not set"}</p>
              {user?.role === "expert" && (
                <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                  <StarRating rating={Math.round(user?.rating || 5)} />
                  <span className="text-yellow-400 font-bold text-sm">{user?.rating || "5.0"}</span>
                  <span className="text-slate-500 text-xs">({user?.reviewsCount || 0} reviews)</span>
                </div>
              )}
              {user?.role === "expert" && (
                <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                  <span className="bg-white/5 border border-white/10 text-slate-300 px-3 py-1 rounded-full text-xs font-bold">
                    {user?.followers?.length || 0} followers
                  </span>
                  <span className="bg-primary-500/10 border border-primary-500/20 text-primary-300 px-3 py-1 rounded-full text-xs font-bold">
                    {user?.subscribers?.length || 0} subscribers
                  </span>
                  {user?.subscriptionPlan === "premium" && (
                    <span className="bg-amber-400/10 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-full text-xs font-bold">
                      VIP premium
                    </span>
                  )}
                </div>
              )}
              {/* Online/Offline Toggle */}
              {user?.role === "expert" && (
                <button
                  onClick={handleToggleAvailability}
                  className={`mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border font-bold text-sm transition-all active:scale-95 ${form.isAvailable ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" : "bg-slate-500/10 border-slate-500/30 text-slate-400 hover:bg-slate-500/20"}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${form.isAvailable ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`} />
                  {form.isAvailable ? "Online — Available for bookings" : "Offline — Not accepting bookings"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 border-b border-white/5 pb-4">
          {["profile", ...(user?.role === "expert" ? ["reviews"] : [])].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm capitalize transition-all ${activeTab === tab ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"}`}>
              {tab === "reviews" ? `⭐ My Reviews (${reviews.length || user?.reviewsCount || 0})` : "✏️ Edit Profile"}
            </button>
          ))}
        </div>

        {/* ── Edit Profile Tab ──────────────────────────────────────────── */}
        {activeTab === "profile" && (
          <form onSubmit={handleSave} className="space-y-6">

            {/* Role Switcher */}
            <div className="glass p-8 rounded-[2rem] border-emerald-500/20 bg-emerald-500/5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-emerald-300">Account Type: {form.role === "expert" ? "Expert / Creator" : "Client"}</h2>
                <p className="text-slate-400 text-sm mt-1">
                  {form.role === "expert" 
                    ? "You are an Expert! You can set your pricing, schedule, and receive bookings." 
                    : "Become an Expert to set pricing, upload a portfolio gallery, and receive bookings!"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, role: f.role === "expert" ? "client" : "expert" }))}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap ${
                  form.role === "expert" 
                    ? "bg-slate-700 hover:bg-slate-600 text-white" 
                    : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                }`}
              >
                {form.role === "expert" ? "Switch to Client" : "🚀 Become an Expert"}
              </button>
            </div>

            {/* Basic Info */}
            <div className="glass p-8 rounded-[2rem] border-white/5 space-y-5">
              <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">Basic Information</h2>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                  <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Professional Title</label>
                  <input placeholder="e.g. Full-Stack Developer" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm placeholder-slate-600" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Location</label>
                  <input placeholder="e.g. Mumbai, India" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm placeholder-slate-600" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Experience</label>
                  <input placeholder="e.g. 3+ Years" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm placeholder-slate-600" value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} />
                </div>
              </div>
              {form.role === "expert" && (
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Hourly Rate (₹/hr)</label>
                    <input type="number" min="0" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Price per Minute (₹/min)</label>
                    <input type="number" min="0" step="0.5" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm" value={form.pricePerMinute} onChange={e => setForm(f => ({ ...f, pricePerMinute: e.target.value }))} />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bio / About Me</label>
                  <span className="text-xs text-slate-600">{form.bio.length}/500</span>
                </div>
                <textarea
                  rows={4} maxLength={500}
                  placeholder="Tell us about yourself, your expertise, and what you bring to the table..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm placeholder-slate-600 resize-none"
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                />
              </div>
            </div>

            {/* ── Expert Settings ───────────────────────────────────────── */}
            {form.role === "expert" && (
              <div className="glass p-8 rounded-[2rem] border-white/5 space-y-5">
                <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">🎯 Expert Settings</h2>
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Category</label>
                    <select className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      <option value="">Select Category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">🎬 Intro Video URL</label>
                    <input type="url" placeholder="https://youtube.com/watch?v=..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm placeholder-slate-600" value={form.introVideo} onChange={e => setForm(f => ({ ...f, introVideo: e.target.value }))} />
                    <p className="text-xs text-slate-600 ml-1">Paste YouTube or Vimeo URL</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Exclusive Content for Subscribers</label>
                  <textarea
                    rows={5}
                    maxLength={1200}
                    placeholder="Share a premium note, resource, checklist, or private update for subscribers..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm placeholder-slate-600 resize-none"
                    value={form.exclusiveContent}
                    onChange={e => setForm(f => ({ ...f, exclusiveContent: e.target.value }))}
                  />
                  <p className="text-xs text-slate-600 ml-1">{form.exclusiveContent.length}/1200 characters</p>
                </div>
              </div>
            )}

            {/* Skills */}
            <div className="glass p-8 rounded-[2rem] border-white/5 space-y-4">
              <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">Skills & Expertise</h2>
              {/* Tag display */}
              <div className="flex flex-wrap gap-2 min-h-[40px]">
                {form.skills.map(skill => (
                  <span key={skill} className="flex items-center gap-1.5 bg-primary-500/10 border border-primary-500/20 text-primary-300 px-3 py-1.5 rounded-full text-xs font-bold">
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="text-primary-400 hover:text-red-400 transition-colors leading-none">✕</button>
                  </span>
                ))}
                {form.skills.length === 0 && <span className="text-slate-600 text-sm italic">No skills added yet</span>}
              </div>
              {/* Skill input */}
              <div className="flex gap-2">
                <input
                  ref={skillInputRef}
                  placeholder="Type a skill and press Enter..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500 transition-all text-sm placeholder-slate-600"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                />
                <button type="button" onClick={() => addSkill()} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95">Add</button>
              </div>
              {/* Suggestions */}
              <div className="flex flex-wrap gap-2">
                {SKILL_SUGGESTIONS.filter(s => !form.skills.includes(s)).slice(0, 8).map(s => (
                  <button key={s} type="button" onClick={() => addSkill(s)} className="text-xs bg-white/5 hover:bg-primary-500/10 hover:border-primary-500/30 hover:text-primary-300 border border-white/10 text-slate-400 px-3 py-1 rounded-full transition-all">
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Social Links */}
            <div className="glass p-8 rounded-[2rem] border-white/5 space-y-5">
              <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">Social & Portfolio Links</h2>
              <div className="space-y-4">
                {[
                  { key: "github", label: "GitHub", icon: "🐙", placeholder: "https://github.com/username" },
                  { key: "linkedin", label: "LinkedIn", icon: "💼", placeholder: "https://linkedin.com/in/username" },
                  { key: "portfolio", label: "Portfolio / Website", icon: "🌐", placeholder: "https://yoursite.com" },
                ].map(({ key, label, icon, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{icon} {label}</label>
                    <input
                      type="url" placeholder={placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 transition-all text-sm placeholder-slate-600"
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Availability Schedule ─────────────────────────────────── */}
            {form.role === "expert" && (
              <div className="glass p-8 rounded-[2rem] border-white/5 space-y-4">
                <h2 className="text-lg font-bold text-white border-b border-white/5 pb-3">📅 Availability Schedule</h2>
                <div className="space-y-3">
                  {schedule.map((day, idx) => (
                    <div key={day.day} className={`flex flex-wrap items-center gap-3 p-3 rounded-xl transition-all ${day.available ? "bg-emerald-500/5 border border-emerald-500/20" : "bg-white/3 border border-white/5"}`}>
                      <button type="button" onClick={() => updateSchedule(idx, "available", !day.available)}
                        className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${day.available ? "bg-emerald-500" : "bg-slate-700"}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${day.available ? "left-4" : "left-0.5"}`} />
                      </button>
                      <span className={`w-24 text-sm font-bold flex-shrink-0 ${day.available ? "text-emerald-300" : "text-slate-500"}`}>{day.day}</span>
                      {day.available && (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-primary-500" value={day.from} onChange={e => updateSchedule(idx, "from", e.target.value)} />
                          <span className="text-slate-500 text-xs">to</span>
                          <input type="time" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-primary-500" value={day.to} onChange={e => updateSchedule(idx, "to", e.target.value)} />
                        </div>
                      )}
                      {!day.available && <span className="text-slate-600 text-xs italic">Not available</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Portfolio Gallery ─────────────────────────────────────── */}
            <div className="glass p-8 rounded-[2rem] border-white/5 space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h2 className="text-lg font-bold text-white">🖼️ Portfolio Gallery</h2>
                <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${galleryUploading ? "bg-slate-700 text-slate-400" : "bg-primary-500 hover:bg-primary-600 text-white active:scale-95"}`}>
                  {galleryUploading ? "Uploading..." : "+ Add Images"}
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={galleryUploading} />
                </label>
              </div>
              {gallery.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-white/10 rounded-2xl">
                  <p className="text-4xl mb-2">🖼️</p>
                  <p className="text-slate-500 text-sm">No gallery images yet. Upload up to 10 images.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {gallery.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10">
                      <img src={img.startsWith("http") ? img : `${import.meta.env.VITE_API_URL}${img}`} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => handleGalleryDelete(idx)}
                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save */}
            <button
              type="submit" disabled={saving}
              className="w-full bg-gradient-to-r from-primary-500 to-purple-600 hover:from-primary-600 hover:to-purple-700 disabled:opacity-60 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-primary-500/20 active:scale-[0.98] flex items-center justify-center gap-2 text-base"
            >
              {saving ? (<><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving...</>) : "💾 Save Profile"}
            </button>
          </form>
        )}

        {/* ── Reviews Tab ───────────────────────────────────────────────── */}
        {activeTab === "reviews" && (
          <div className="space-y-5">
            {/* Stats bar */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="glass p-6 rounded-[1.5rem] border-white/5 text-center">
                <p className="text-3xl font-extrabold text-yellow-400">⭐ {user?.rating || "5.0"}</p>
                <p className="text-slate-400 text-xs mt-1">Average Rating</p>
              </div>
              <div className="glass p-6 rounded-[1.5rem] border-white/5 text-center">
                <p className="text-3xl font-extrabold text-white">{user?.reviewsCount || 0}</p>
                <p className="text-slate-400 text-xs mt-1">Total Reviews</p>
              </div>
            </div>

            {loadingReviews ? (
              <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : reviews.length === 0 ? (
              <div className="glass p-16 rounded-[2rem] border-white/5 text-center border-dashed">
                <p className="text-4xl mb-3">⭐</p>
                <p className="text-slate-400">No reviews yet. Complete sessions to receive client feedback.</p>
              </div>
            ) : (
              reviews.map(r => (
                <div key={r._id} className="glass p-6 rounded-[1.5rem] border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 flex-shrink-0">
                      {r.client?.profileImage ? (
                        <img src={r.client.profileImage.startsWith("http") ? r.client.profileImage : `${import.meta.env.VITE_API_URL}${r.client.profileImage}`} alt={r.client.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">{r.client?.name?.[0]?.toUpperCase()}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-white text-sm">{r.client?.name || "Client"}</p>
                      <StarRating rating={r.rating} />
                    </div>
                    <span className="text-slate-600 text-xs font-mono">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                  <p className="text-slate-300 text-sm italic leading-relaxed pl-16">"{r.reviewText}"</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
