import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import { resolveProfilePhotoUrl } from "../utils/profilePhoto";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const formatMoney = (value = 0) => money.format(Number(value) || 0);

const getBookingStart = (booking = {}) => booking.slotStart || booking.date || booking.createdAt;
const getBookingDurationMinutes = (booking = {}) => Number(booking.durationMinutes || booking.duration || 0);
const getBookingAmount = (booking = {}) => Number(booking.totalAmount || booking.totalPrice || 0);
const getExpertMinuteRate = (expert = {}) => Number(expert.perMinuteRate || expert.pricePerMinute || 0);
const JOIN_ROOM_EARLY_MINUTES = 30;
const JOIN_ROOM_GRACE_MINUTES = 5;
const getBookingEndTime = (booking = {}) => {
  if (booking.slotEnd) return new Date(booking.slotEnd).getTime();
  const start = new Date(getBookingStart(booking)).getTime();
  const durationMs = getBookingDurationMinutes(booking) * 60 * 1000;
  return Number.isFinite(start) ? start + durationMs : 0;
};
const canShowJoinRoom = (booking = {}, now = Date.now()) => {
  const start = new Date(getBookingStart(booking)).getTime();
  const end = getBookingEndTime(booking);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return (
    booking.status === "confirmed" &&
    booking.paymentStatus === "paid" &&
    now >= start - JOIN_ROOM_EARLY_MINUTES * 60 * 1000 &&
    now <= end + JOIN_ROOM_GRACE_MINUTES * 60 * 1000
  );
};

const getInitialPayoutForm = (user = {}) => ({
  upiId: user?.upiId || "",
  accountHolderName: user?.accountHolderName || "",
  bankAccountNumber: user?.bankDetails?.accountNumber || "",
  ifscCode: user?.bankDetails?.ifsc || "",
  payoutMethod: user?.payoutMethod || "upi",
});

const Dashboard = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const userRef = useRef(user);
  const updateUserRef = useRef(updateUser);
  const payoutFetchCountRef = useRef(0);
  const didInitialLoadRef = useRef(false);

  // Navigation states
  const [activeTab, setActiveTab] = useState("bookings"); // expert tabs: bookings, analytics, profile / client tabs: bookings, favorites, history
  const [bookingFilter, setBookingFilter] = useState("all"); // bookings filter: all, pending, confirmed, completed, cancelled
  
  // Dynamic API states
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [payoutData, setPayoutData] = useState(null);
  const [loadingPayout, setLoadingPayout] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  
  // Invoice states
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  // Review states
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, reviewText: "" });
  const [submittingReview, setSubmittingReview] = useState(false);

  // Profile onboarding state (for new users who haven't completed their setup)
  const [profileForm, setProfileForm] = useState({
    title: user?.title || "Professional Developer",
    bio: user?.bio || "",
    skills: user?.skills?.join(", ") || "",
    hourlyRate: user?.hourlyRate || 25,
    perMinuteRate: user?.perMinuteRate || user?.pricePerMinute || 10,
    location: user?.location || "",
    experience: user?.experience || "",
    github: user?.github || "",
    linkedin: user?.linkedin || "",
    portfolio: user?.portfolio || "",
    exclusiveContent: user?.exclusiveContent || "",
    isAvailable: user?.isAvailable !== false,
  });

  const [payoutForm, setPayoutForm] = useState(getInitialPayoutForm(user));

  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    updateUserRef.current = updateUser;
  }, [updateUser]);

  // Check if a review needs to be prompted from video call redirect
  useEffect(() => {
    if (routerLocation.state?.reviewBooking) {
      const timer = window.setTimeout(() => {
        setReviewBooking(routerLocation.state.reviewBooking);
        navigate(routerLocation.pathname, { replace: true, state: {} });
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [routerLocation, navigate]);

  const syncPayoutData = useCallback((data) => {
    setPayoutData(data);
    setPayoutForm({
      ...getInitialPayoutForm(userRef.current || {}),
      ...(data?.settings || {}),
    });
  }, []);

  // Fetch user profile and bookings
  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const [userRes, bookingsRes, referralRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/profiles/me`, {
          headers: { Authorization: token }
        }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/bookings/my-bookings`, {
          headers: { Authorization: token }
        }),
        axios.get(`${import.meta.env.VITE_API_URL}/api/referrals/me`, {
          headers: { Authorization: token }
        }),
      ]);
      updateUserRef.current({
        ...userRes.data,
        referralCode: referralRes.data.referralCode,
        referralCount: referralRes.data.stats?.referralCount,
        referralRewardCoins: referralRes.data.stats?.referralRewardCoins,
        coinBalance: referralRes.data.stats?.coinBalance ?? userRes.data.coinBalance,
      });
      console.info("[Client Dashboard Fetched Bookings]", bookingsRes.data);
      bookingsRes.data.forEach((booking) => {
        console.info("[Booking Client Compare]", {
          bookingId: booking._id,
          bookingClientId: booking.clientId || booking.client?._id || booking.client,
          loggedInUserId: userRes.data._id || userRef.current?._id,
          matches: String(booking.clientId || booking.client?._id || booking.client) === String(userRes.data._id || userRef.current?._id),
        });
      });
      setBookings(bookingsRes.data);

      if (userRes.data.role === "expert") {
        setLoadingPayout(true);
        try {
          payoutFetchCountRef.current += 1;
          console.info("[PayoutSettings] GET /api/payouts/me", {
            count: payoutFetchCountRef.current,
            userId: userRes.data._id || userRef.current?._id || null,
            role: userRes.data.role,
          });
          const payoutRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/payouts/me`, {
            headers: { Authorization: token }
          });
          syncPayoutData(payoutRes.data);
        } finally {
          setLoadingPayout(false);
        }
      }
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoadingBookings(false);
    }
  }, [syncPayoutData]);

  useEffect(() => {
    if (didInitialLoadRef.current) return undefined;
    didInitialLoadRef.current = true;

    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  // Profile Completion Wizard Submit
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSubmittingProfile(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      
      Object.keys(profileForm).forEach(key => {
        formData.append(key, profileForm[key]);
      });

      if (selectedFile) {
        formData.append("profileImage", selectedFile);
      }

      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/profiles/update`,
        formData,
        {
          headers: {
            Authorization: token,
            "Content-Type": "multipart/form-data"
          }
        }
      );

      updateUser(res.data);
      toast.success("Profile setup successfully completed & published!");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to complete profile");
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleSavePayoutSettings = async (e) => {
    e.preventDefault();
    setSavingPayout(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/payouts/settings`,
        payoutForm,
        { headers: { Authorization: token } }
      );
      syncPayoutData(res.data);
      toast.success("Payout details saved");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save payout details");
    } finally {
      setSavingPayout(false);
    }
  };

  const handleRequestPayout = async () => {
    setRequestingPayout(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/payouts/request`,
        { amount: payoutData?.wallet?.availableBalance },
        { headers: { Authorization: token } }
      );
      syncPayoutData(res.data);
      toast.success("Payout request sent to admin");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to request payout");
    } finally {
      setRequestingPayout(false);
    }
  };

  // Toggle availability status
  const handleToggleAvailability = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/profiles/update`,
        { isAvailable: !user.isAvailable },
        { headers: { Authorization: token } }
      );
      updateUser(res.data);
      toast.success(`Availability toggled: ${!user.isAvailable ? 'Available' : 'Unavailable'}`);
    } catch {
      toast.error("Failed to toggle availability");
    }
  };

  // Accept / Reject / Complete Bookings
  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/bookings/${bookingId}/status`,
        { status: newStatus },
        { headers: { Authorization: token } }
      );
      toast.success(`Booking status updated to ${newStatus}`);
      fetchData();
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Submit Review Flow
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/reviews`,
        {
          bookingId: reviewBooking._id,
          rating: reviewForm.rating,
          reviewText: reviewForm.reviewText
        },
        { headers: { Authorization: token } }
      );
      toast.success("Review submitted! Rating updated.");
      setReviewBooking(null);
      setReviewForm({ rating: 5, reviewText: "" });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Favorite toggle helper
  const handleToggleFavorite = async (expertId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/profiles/favorite/${expertId}`,
        {},
        { headers: { Authorization: token } }
      );
      updateUser(res.data);
      toast.success("Favorites updated!");
    } catch {
      toast.error("Failed to update favorites");
    }
  };

  // Join Call Helper
  const handleJoinCall = (b) => {
    navigate(`/video-call/${b._id}`, { state: { booking: b } });
  };

  // Calculations for analytics (Expert role)
  const earningsSum = bookings
    .filter(b => b.status === "completed" && b.paymentStatus === "paid")
    .reduce((sum, b) => sum + getBookingAmount(b), 0);

  const pendingCount = bookings.filter(b => b.status === "pending").length;
  const confirmedCount = bookings.filter(b => b.status === "confirmed").length;
  const priorityCount = bookings.filter(b => b.isPriority).length;
  const followersCount = user?.followers?.length || 0;
  const subscribersCount = user?.subscribers?.length || 0;
  const payoutWallet = payoutData?.wallet || {};
  const payoutRequests = payoutData?.requests || [];
  const canRequestPayout = (Number(payoutWallet.availableBalance) || 0) > 0 && payoutData?.settingsComplete;

  // Filtered Bookings for tabs
  const filteredBookings = bookings.filter(b => {
    if (bookingFilter === "all") return true;
    return b.status === bookingFilter;
  });
  const clientVisibleBookings = bookings.filter((b) => (
    b.status === "confirmed" &&
    b.paymentStatus === "paid" &&
    getBookingEndTime(b) >= nowTick
  ));

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SEO title="User Dashboard" description="Manage your booking sessions, profile details, and conference meetings." />
      <Navbar />

      <div className="flex-grow pt-32 pb-20 max-w-7xl mx-auto px-6 w-full">
        {/* Profile Onboarding Wizard for incomplete profiles */}
        {(!user?.isProfileComplete) ? (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="bg-primary-500/10 text-primary-400 border border-primary-500/20 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                Setup Required
              </span>
              <h1 className="text-4xl font-extrabold text-white mt-4 mb-2">Complete Your Profile Setup</h1>
              <p className="text-slate-400">Please provide your details below to activate your account and start using the platform.</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="glass p-10 rounded-[3rem] border-white/5 shadow-2xl space-y-8">
              <h2 className="text-2xl font-bold border-b border-white/5 pb-4 text-gradient">Professional Info</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Professional Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Full-Stack Engineer"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                    value={profileForm.title}
                    onChange={(e) => setProfileForm({ ...profileForm, title: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Profile Display Image (DP)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">About Me / Bio</label>
                <textarea
                  required
                  rows="4"
                  placeholder="Describe your expertise, experience, and what values you bring to bookings..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Skills (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="React, Node.js, Mongoose, Python"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                    value={profileForm.skills}
                    onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Location</label>
                  <input
                    type="text"
                          placeholder="e.g. Delhi, India"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                    value={profileForm.location}
                    onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                  />
                </div>
              </div>

              {user?.role === "expert" && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Hourly Consult Rate (INR / ₹)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                      value={profileForm.hourlyRate}
                      onChange={(e) => setProfileForm({ ...profileForm, hourlyRate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Per-minute Rate (INR / min)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.5"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                      value={profileForm.perMinuteRate}
                      onChange={(e) => setProfileForm({ ...profileForm, perMinuteRate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-300">Experience (Years/Text)</label>
                    <input
                      type="text"
                      placeholder="e.g. 5+ Years"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                      value={profileForm.experience}
                      onChange={(e) => setProfileForm({ ...profileForm, experience: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <h2 className="text-2xl font-bold border-b border-white/5 pb-4 text-gradient pt-4">Links & Social Profiles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">GitHub Link</label>
                  <input
                    type="url"
                    placeholder="https://github.com/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                    value={profileForm.github}
                    onChange={(e) => setProfileForm({ ...profileForm, github: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">LinkedIn Link</label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                    value={profileForm.linkedin}
                    onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300">Website / Portfolio</label>
                  <input
                    type="url"
                    placeholder="https://example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3.5 focus:border-primary-500 transition-all text-white text-sm"
                    value={profileForm.portfolio}
                    onChange={(e) => setProfileForm({ ...profileForm, portfolio: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingProfile}
                className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-primary-500/20 active:scale-[0.98] mt-6"
              >
                {submittingProfile ? "Saving Profile details..." : "Complete Setup & Publish"}
              </button>
            </form>
          </div>
        ) : (
          /* Main Completed Dashboard Flow */
          <div>
            {/* Dashboard Hero Header */}
            <div className="glass rounded-[3rem] p-10 border-white/5 relative overflow-hidden mb-12 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500 to-accent" />
              
              <div className="flex items-center gap-6 text-center md:text-left flex-col md:flex-row">
                <img
                  src={resolveProfilePhotoUrl(user) || "https://via.placeholder.com/150"}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-xl"
                  loading="eager"
                  decoding="async"
                />
                <div>
                  <h1 className="text-3xl font-extrabold text-white">Hello, {user.name}</h1>
                  <p className="text-primary-400 font-medium text-lg mt-1 capitalize">Role: {user.role}</p>
                  <p className="text-slate-400 text-sm mt-1">{user.title}</p>
                  {user.subscriptionPlan === "premium" && (
                    <span className="inline-flex mt-3 bg-amber-400/10 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      Premium professional member
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {user.role === "expert" && (
                  <button
                    onClick={handleToggleAvailability}
                    className={`px-6 py-3 rounded-2xl font-bold transition-all border ${
                      user.isAvailable 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    🟢 {user.isAvailable ? 'Available' : 'Offline'}
                  </button>
                )}
                <button
                  onClick={logout}
                  className="bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 border border-white/10 px-6 py-3 rounded-2xl text-white font-bold transition-all"
                >
                  Log Out
                </button>
              </div>
            </div>

            {/* EXPERT PROFILE VIEW */}
            {user.role === "expert" ? (
              <div className="space-y-12">
                {/* Stats row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-40 shadow-xl">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Total Earnings</span>
                    <h3 className="text-3xl font-extrabold text-white">₹{earningsSum}</h3>
                    <span className="text-xs text-emerald-400 font-medium">Completed & Paid Sessions</span>
                  </div>

                  <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-40 shadow-xl">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Total Bookings</span>
                    <h3 className="text-3xl font-extrabold text-white">{bookings.length}</h3>
                    <span className="text-xs text-slate-400 font-medium">Sessions requested</span>
                  </div>

                  <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-40 shadow-xl">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Average Rating</span>
                    <h3 className="text-3xl font-extrabold text-yellow-400">⭐ {user.rating} <span className="text-lg text-slate-400 font-medium">/ 5</span></h3>
                    <span className="text-xs text-slate-400 font-medium">{user.reviewsCount || 0} Client reviews</span>
                  </div>

                  <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-40 shadow-xl border-l-primary-500/20">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Active Tasks</span>
                    <h3 className="text-3xl font-extrabold text-primary-400">{confirmedCount} confirmed</h3>
                    <span className="text-xs text-slate-400 font-medium">{pendingCount} pending, {priorityCount} priority</span>
                  </div>

                  <div className="glass p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-40 shadow-xl border-l-amber-400/30">
                    <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Audience</span>
                    <h3 className="text-3xl font-extrabold text-white">{followersCount}</h3>
                    <span className="text-xs text-primary-400 font-medium">{subscribersCount} subscribers</span>
                  </div>
                </div>

                {/* Sub Tab Navigation */}
                <div className="flex gap-4 border-b border-white/5 pb-4 overflow-x-auto flex-nowrap scrollbar-none">
                  <button
                    onClick={() => setActiveTab("bookings")}
                    className={`pb-2 px-4 font-bold transition-all border-b-2 text-lg ${
                      activeTab === "bookings" ? "border-primary-500 text-white" : "border-transparent text-slate-400"
                    }`}
                  >
                    Sessions & Bookings
                  </button>
                  <button
                    onClick={() => setActiveTab("profile-settings")}
                    className={`pb-2 px-4 font-bold transition-all border-b-2 text-lg ${
                      activeTab === "profile-settings" ? "border-primary-500 text-white" : "border-transparent text-slate-400"
                    }`}
                  >
                    Professional Settings
                  </button>
                  <button
                    onClick={() => setActiveTab("payout-settings")}
                    className={`pb-2 px-4 font-bold transition-all border-b-2 text-lg ${
                      activeTab === "payout-settings" ? "border-primary-500 text-white" : "border-transparent text-slate-400"
                    }`}
                  >
                    Payout Settings
                  </button>
                </div>

                {/* Tab content 1: Bookings management */}
                {activeTab === "bookings" && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap gap-2">
                      {["all", "pending", "confirmed", "completed", "cancelled"].map(f => (
                        <button
                          key={f}
                          onClick={() => setBookingFilter(f)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                            bookingFilter === f 
                              ? "bg-primary-500 border-primary-500 text-white" 
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    {loadingBookings ? (
                      <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : filteredBookings.length === 0 ? (
                      <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/5">
                        <p className="text-slate-400 text-lg">No bookings found for the selected filter.</p>
                      </div>
                    ) : (
                      <div className="grid gap-6">
                        {filteredBookings.map((b) => (
                          <div key={b._id} className="glass p-8 rounded-[2rem] border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 hover:border-primary-500/20 transition-all">
                            <div className="flex items-center gap-4 flex-1">
                              <img
                                src={resolveProfilePhotoUrl(b.client) || "https://via.placeholder.com/100"}
                                alt={b.client?.name}
                                className="w-16 h-16 rounded-full object-cover border border-white/10"
                              />
                              <div>
                                <h4 className="text-xl font-bold text-white">{b.client?.name}</h4>
                                <p className="text-slate-400 text-sm">{b.client?.email}</p>
                                <p className="text-xs text-primary-400 font-mono mt-1">
                                  {new Date(getBookingStart(b)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} ({getBookingDurationMinutes(b)} min session)
                                </p>
                                {b.isPriority && (
                                  <span className="inline-flex mt-2 bg-amber-400/10 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                                    Priority booking
                                  </span>
                                )}
                                {b.notes && (
                                  <p className="text-slate-500 text-xs italic mt-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                    "{b.notes}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-center md:text-right space-y-2">
                              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Status</p>
                              <div className="flex gap-2 justify-center md:justify-end">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                  b.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                                  b.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400" :
                                  b.status === "completed" ? "bg-primary-500/20 text-primary-400" :
                                  "bg-red-500/20 text-red-400"
                                }`}>
                                  {b.status}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                  b.paymentStatus === "paid" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                }`}>
                                  {b.paymentStatus}
                                </span>
                              </div>
                              <p className="text-xl font-bold text-white mt-1">{formatMoney(getBookingAmount(b))}</p>
                            </div>

                            <div className="flex md:flex-col gap-2 w-full md:w-auto">
                              {b.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b._id, "confirmed")}
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95"
                                  >
                                    Accept Request
                                  </button>
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b._id, "cancelled")}
                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {canShowJoinRoom(b, nowTick) && (
                                <>
                                  <button
                                    onClick={() => handleJoinCall(b)}
                                    className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1 shadow-lg shadow-primary-500/20 animate-pulse"
                                  >
                                    📹 Join Room
                                  </button>
                                  <button
                                    onClick={() => handleUpdateBookingStatus(b._id, "completed")}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95"
                                  >
                                    Mark Session Complete
                                  </button>
                                </>
                              )}
                              
                              {b.paymentStatus === "paid" && (
                                <button
                                  onClick={() => setSelectedInvoice(b)}
                                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs border border-white/10"
                                >
                                  📄 View Receipt
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab content 2: Settings update */}
                {activeTab === "profile-settings" && (
                  <form onSubmit={handleProfileSubmit} className="glass p-10 rounded-[3rem] border-white/5 shadow-xl space-y-6">
                    <h3 className="text-xl font-bold text-white border-b border-white/5 pb-2">Update Consult Profile</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Hourly rate (INR / ₹)</label>
                        <input
                          type="number"
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                          value={profileForm.hourlyRate}
                          onChange={(e) => setProfileForm({ ...profileForm, hourlyRate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Per-minute rate (INR / min)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.5"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                          value={profileForm.perMinuteRate}
                          onChange={(e) => setProfileForm({ ...profileForm, perMinuteRate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Title</label>
                        <input
                          type="text"
                          required
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                          value={profileForm.title}
                          onChange={(e) => setProfileForm({ ...profileForm, title: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Bio</label>
                      <textarea
                        required
                        rows="4"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                        value={profileForm.bio}
                        onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Expert Resources for Subscribers</label>
                      <textarea
                        rows="5"
                        maxLength="1200"
                        placeholder="Share a professional note, checklist, or consultation resource for subscribers..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                        value={profileForm.exclusiveContent}
                        onChange={(e) => setProfileForm({ ...profileForm, exclusiveContent: e.target.value })}
                      />
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Github</label>
                        <input
                          type="url"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                          value={profileForm.github}
                          onChange={(e) => setProfileForm({ ...profileForm, github: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">LinkedIn</label>
                        <input
                          type="url"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                          value={profileForm.linkedin}
                          onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Website</label>
                        <input
                          type="url"
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                          value={profileForm.portfolio}
                          onChange={(e) => setProfileForm({ ...profileForm, portfolio: e.target.value })}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={submittingProfile}
                      className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-700 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-95 text-sm"
                    >
                      {submittingProfile ? "Saving changes..." : "Save Settings"}
                    </button>
                  </form>
                )}

                {activeTab === "payout-settings" && (
                  <div className="space-y-8">
                    {loadingPayout ? (
                      <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="glass p-6 rounded-[2rem] border-white/5">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Total Earnings</span>
                            <p className="text-2xl font-extrabold text-white mt-3">{formatMoney(payoutWallet.totalEarnings)}</p>
                          </div>
                          <div className="glass p-6 rounded-[2rem] border-white/5">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Pending Earnings</span>
                            <p className="text-2xl font-extrabold text-amber-300 mt-3">{formatMoney(payoutWallet.pendingEarnings)}</p>
                          </div>
                          <div className="glass p-6 rounded-[2rem] border-white/5">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Available Balance</span>
                            <p className="text-2xl font-extrabold text-emerald-300 mt-3">{formatMoney(payoutWallet.availableBalance)}</p>
                          </div>
                          <div className="glass p-6 rounded-[2rem] border-white/5">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Paid Out</span>
                            <p className="text-2xl font-extrabold text-white mt-3">{formatMoney(payoutWallet.paidOut)}</p>
                          </div>
                          <div className="glass p-6 rounded-[2rem] border-white/5">
                            <span className="text-slate-500 font-bold uppercase tracking-wider text-xs">Platform Commission %</span>
                            <p className="text-2xl font-extrabold text-primary-300 mt-3">{payoutWallet.platformCommissionPercent || 20}%</p>
                          </div>
                        </div>

                        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                          <form onSubmit={handleSavePayoutSettings} className="glass p-8 rounded-[2rem] border-white/5 shadow-xl space-y-6">
                            <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
                              <h3 className="text-xl font-bold text-white">Payout Settings</h3>
                              <p className="text-xs text-slate-500">Manual payouts are reviewed and processed by admin.</p>
                            </div>

                            <div className="space-y-3">
                              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Payout Method</label>
                              <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
                                {["upi", "bank"].map((method) => (
                                  <button
                                    type="button"
                                    key={method}
                                    onClick={() => setPayoutForm({ ...payoutForm, payoutMethod: method })}
                                    className={`rounded-lg px-4 py-3 text-sm font-bold uppercase transition ${
                                      payoutForm.payoutMethod === method ? "bg-primary-500 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                                    }`}
                                  >
                                    {method}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">UPI ID</label>
                                <input
                                  type="text"
                                  placeholder="name@upi"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                                  value={payoutForm.upiId}
                                  onChange={(e) => setPayoutForm({ ...payoutForm, upiId: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Account Holder Name</label>
                                <input
                                  type="text"
                                  required
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                                  value={payoutForm.accountHolderName}
                                  onChange={(e) => setPayoutForm({ ...payoutForm, accountHolderName: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Bank Account Number</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm"
                                  value={payoutForm.bankAccountNumber}
                                  onChange={(e) => setPayoutForm({ ...payoutForm, bankAccountNumber: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">IFSC Code</label>
                                <input
                                  type="text"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 focus:border-primary-500 text-white transition-all text-sm uppercase"
                                  value={payoutForm.ifscCode}
                                  onChange={(e) => setPayoutForm({ ...payoutForm, ifscCode: e.target.value.toUpperCase() })}
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={savingPayout}
                              className="w-full py-4 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-700 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-95 text-sm"
                            >
                              {savingPayout ? "Saving payout details..." : "Save Payout Details"}
                            </button>
                          </form>

                          <div className="space-y-6">
                            <div className="glass p-8 rounded-[2rem] border-white/5 shadow-xl">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Available Balance</p>
                                  <p className="mt-2 text-3xl font-extrabold text-white">{formatMoney(payoutWallet.availableBalance)}</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                  payoutData?.settingsComplete ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                                }`}>
                                  {payoutData?.settingsComplete ? "Ready" : "Details Needed"}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={handleRequestPayout}
                                disabled={!canRequestPayout || requestingPayout}
                                className="mt-6 w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-95 text-sm"
                              >
                                {requestingPayout ? "Requesting payout..." : "Request Payout"}
                              </button>
                            </div>

                            <div className="glass p-6 rounded-[2rem] border-white/5 shadow-xl">
                              <h3 className="text-lg font-bold text-white mb-4">Recent Payout Requests</h3>
                              <div className="space-y-3">
                                {payoutRequests.length === 0 ? (
                                  <p className="text-sm text-slate-500 py-6 text-center">No payout requests yet.</p>
                                ) : (
                                  payoutRequests.map((payout) => (
                                    <div key={payout._id} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/5 p-4">
                                      <div>
                                        <p className="font-bold text-white">{formatMoney(payout.amount || payout.netAmount)}</p>
                                        <p className="text-xs text-slate-500">{new Date(payout.createdAt).toLocaleDateString()}</p>
                                      </div>
                                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                        payout.status === "paid" ? "bg-emerald-500/15 text-emerald-300" :
                                        payout.status === "rejected" ? "bg-red-500/15 text-red-300" :
                                        payout.status === "approved" ? "bg-primary-500/15 text-primary-300" :
                                        "bg-amber-500/15 text-amber-300"
                                      }`}>
                                        {payout.status}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* CLIENT PROFILE VIEW */
              <div className="space-y-12">
                {/* Sub Tab Navigation */}
                <div className="flex gap-4 border-b border-white/5 pb-4 overflow-x-auto flex-nowrap scrollbar-none">
                  <button
                    onClick={() => setActiveTab("bookings")}
                    className={`pb-2 px-4 font-bold transition-all border-b-2 text-lg ${
                      activeTab === "bookings" ? "border-primary-500 text-white" : "border-transparent text-slate-400"
                    }`}
                  >
                    Active Sessions
                  </button>
                  <button
                    onClick={() => setActiveTab("favorites")}
                    className={`pb-2 px-4 font-bold transition-all border-b-2 text-lg ${
                      activeTab === "favorites" ? "border-primary-500 text-white" : "border-transparent text-slate-400"
                    }`}
                  >
                    Favorite Experts ({user.favorites?.length || 0})
                  </button>
                </div>

                {/* Tab content 1: Client Active Bookings */}
                {activeTab === "bookings" && (
                  <div className="space-y-6">
                    {loadingBookings ? (
                      <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : clientVisibleBookings.length === 0 ? (
                      <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/5">
                        <p className="text-slate-400 text-lg mb-6">No paid, confirmed upcoming consultations yet.</p>
                        <button
                          onClick={() => navigate("/experts")}
                          className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 px-8 rounded-2xl transition-all shadow-lg shadow-primary-500/20"
                        >
                          Find and Book an Expert
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-6">
                        {clientVisibleBookings.map((b) => (
                          <div key={b._id} className="glass p-8 rounded-[2rem] border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 hover:border-primary-500/20 transition-all">
                            <div className="flex items-center gap-4 flex-1">
                              <img
                                  src={resolveProfilePhotoUrl(b.expert) || "https://via.placeholder.com/100"}
                                  alt={b.expert?.name}
                                  className="w-16 h-16 rounded-full object-cover border border-white/10"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <div>
                                  <h4 className="text-xl font-bold text-white">{b.expert?.name}</h4>
                                  <p className="text-primary-400 text-sm">{b.expert?.title}</p>
                                  <p className="text-xs text-slate-400 font-mono mt-1">
                                    {new Date(getBookingStart(b)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} ({getBookingDurationMinutes(b)} min session)
                                  </p>
                                  {b.isPriority && (
                                    <span className="inline-flex mt-2 bg-amber-400/10 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                                      Priority booking
                                    </span>
                                  )}
                                  {b.notes && (
                                    <p className="text-slate-500 text-xs italic mt-2 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
                                      "{b.notes}"
                                    </p>
                                  )}
                                </div>
                            </div>

                            <div className="text-center md:text-right space-y-2">
                              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Status</p>
                              <div className="flex gap-2 justify-center md:justify-end">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                  b.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                                  b.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400" :
                                  b.status === "completed" ? "bg-primary-500/20 text-primary-400" :
                                  "bg-red-500/20 text-red-400"
                                }`}>
                                  {b.status}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                  b.paymentStatus === "paid" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                                }`}>
                                  {b.paymentStatus}
                                </span>
                              </div>
                              <p className="text-xl font-bold text-white mt-1">{formatMoney(getBookingAmount(b))}</p>
                            </div>

                            <div className="flex md:flex-col gap-2 w-full md:w-auto">
                              {canShowJoinRoom(b, nowTick) && (
                                <button
                                  onClick={() => handleJoinCall(b)}
                                  className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-bold py-3.5 px-6 rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1 shadow-lg shadow-primary-500/20 animate-pulse"
                                >
                                  📹 Join Room
                                </button>
                              )}
                              
                              {b.status === "pending" && (
                                <button
                                  onClick={() => handleUpdateBookingStatus(b._id, "cancelled")}
                                  className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/10 font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95"
                                >
                                  Cancel Request
                                </button>
                              )}

                              {b.status === "completed" && !b.ratingGiven && (
                                <button
                                  onClick={() => setReviewBooking(b)}
                                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs transition-all active:scale-95"
                                >
                                  ⭐ Write a Review
                                </button>
                              )}

                              {b.paymentStatus === "paid" && (
                                <button
                                  onClick={() => setSelectedInvoice(b)}
                                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs border border-white/10"
                                >
                                  📄 View Invoice
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab content 2: Favorites */}
                {activeTab === "favorites" && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {user.favorites?.map((expert) => (
                      <div key={expert._id} className="glass p-8 rounded-[2rem] border-white/5 flex flex-col items-center text-center relative group">
                        <button
                          onClick={() => handleToggleFavorite(expert._id)}
                          className="absolute top-4 right-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-full border border-red-500/20 transition-colors"
                          title="Remove from favorites"
                        >
                          ❤️
                        </button>
                        
                        <div className="w-24 h-24 rounded-full border-2 border-primary-500/20 mb-4 p-1">
                          <img
                            src={resolveProfilePhotoUrl(expert) || "https://via.placeholder.com/150"}
                            alt={expert.name}
                            className="w-full h-full object-cover rounded-full"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1">{expert.name}</h3>
                        <p className="text-primary-400 text-xs font-semibold mb-4">{expert.title}</p>
                        
                        <div className="w-full flex items-center justify-between border-t border-white/5 pt-4 mt-auto">
                          <p className="text-sm font-bold text-white">
                            {getExpertMinuteRate(expert) > 0 ? `${formatMoney(getExpertMinuteRate(expert))}/min` : `${formatMoney(expert.hourlyRate || 0)}/hr`}
                          </p>
                          <button
                            onClick={() => navigate(`/expert/${expert._id}`)}
                            className="bg-white/5 hover:bg-primary-500 text-white px-4 py-2 border border-white/10 rounded-xl text-xs font-bold transition-all"
                          >
                            Book Again
                          </button>
                        </div>
                      </div>
                    ))}
                    {(user.favorites?.length === 0 || !user.favorites) && (
                      <div className="col-span-full text-center py-20 bg-white/5 rounded-[2rem] border border-dashed border-white/5">
                        <p className="text-slate-400">No favorite experts saved yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 📄 TAX INVOICE MODAL (PRINTABLE) */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <div className="bg-white text-slate-900 rounded-3xl p-8 max-w-2xl w-full shadow-2xl overflow-y-auto max-h-[90vh] relative border-4 border-slate-900">
            {/* Modal actions */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-900">
              <h3 className="font-extrabold text-2xl uppercase tracking-wider text-slate-900">OFFICIAL RECEIPT</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-transform active:scale-95 shadow-md"
                >
                  Print Invoice
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-4 rounded-xl text-xs"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Invoice Contents */}
            <div className="space-y-6 font-sans">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">PLATFORM INC.</h1>
                  <p className="text-xs text-slate-500 font-semibold mt-1">102 Innovation Drive, Tech City, IN</p>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold uppercase">
                    PAID
                  </span>
                  <p className="text-xs font-mono text-slate-500 mt-2">INVOICE: #INV-{selectedInvoice._id.substring(18).toUpperCase()}</p>
                  <p className="text-xs font-mono text-slate-500">DATE: {new Date(selectedInvoice.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 border-y-2 border-slate-900 py-6">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">CLIENT BILL TO</p>
                  <p className="font-bold text-slate-800 mt-1">{selectedInvoice.client?.name || "Client"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedInvoice.client?.email}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wider text-right">EXPERT / CONSULTANT</p>
                  <p className="font-bold text-slate-800 mt-1 text-right">{selectedInvoice.expert?.name || "Expert"}</p>
                  <p className="text-xs text-slate-500 mt-0.5 text-right">{selectedInvoice.expert?.title}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-slate-600 text-left font-bold">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-center">Duration</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-3">
                      <p className="font-semibold">Professional Consultation Session</p>
                      <p className="text-xs text-slate-400">Scheduled on {new Date(getBookingStart(selectedInvoice)).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </td>
                    <td className="py-3 text-center font-mono">{getBookingDurationMinutes(selectedInvoice)} min</td>
                    <td className="py-3 text-right font-mono">{formatMoney(selectedInvoice.perMinuteRate || ((getBookingAmount(selectedInvoice) || 0) / Math.max(getBookingDurationMinutes(selectedInvoice), 1)))}/min</td>
                    <td className="py-3 text-right font-bold text-slate-900 font-mono">{formatMoney(getBookingAmount(selectedInvoice))}</td>
                  </tr>
                </tbody>
              </table>

              {/* Fees and totals */}
              <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-center text-lg font-black text-slate-900">
                <span>TOTAL AMOUNT PAID</span>
                <span className="font-mono">{formatMoney(getBookingAmount(selectedInvoice))}</span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-6">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Transaction Info</p>
                <p className="text-xs text-slate-600 font-mono mt-1">PAYMENT ID: {selectedInvoice.paymentId}</p>
                <p className="text-xs text-slate-600 font-mono">GATEWAY: Razorpay API Gateway Secure Connection</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ SUBMIT CLIENT REVIEW MODAL OVERLAY */}
      {reviewBooking && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
          <form onSubmit={handleSubmitReview} className="relative w-full max-w-lg glass p-10 rounded-[3rem] border-white/10 shadow-2xl overflow-hidden text-center space-y-6">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-500 to-accent" />
            
            <div>
              <h2 className="text-3xl font-bold text-white">How was your session?</h2>
              <p className="text-slate-400 text-sm mt-1">Provide feedback for <span className="text-primary-400 font-bold">{reviewBooking.expert?.name}</span></p>
            </div>

            {/* Stars Selector */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setReviewForm({ ...reviewForm, rating: s })}
                  className="text-4xl hover:scale-110 active:scale-95 transition-transform"
                >
                  {s <= reviewForm.rating ? "⭐" : "☆"}
                </button>
              ))}
            </div>

            <div className="space-y-2 text-left">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Your Review</label>
              <textarea
                required
                rows="4"
                placeholder="What did you learn? Was the expert helpful? Share your experience..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 text-white transition-all text-sm"
                value={reviewForm.reviewText}
                onChange={(e) => setReviewForm({ ...reviewForm, reviewText: e.target.value })}
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submittingReview}
                className="flex-grow bg-primary-500 hover:bg-primary-600 disabled:bg-slate-700 text-white font-bold py-4 rounded-2xl shadow-xl transition-all active:scale-95 text-sm"
              >
                {submittingReview ? "Submitting review..." : "Submit Review"}
              </button>
              <button
                type="button"
                onClick={() => setReviewBooking(null)}
                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 px-6 rounded-2xl transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Dashboard;
