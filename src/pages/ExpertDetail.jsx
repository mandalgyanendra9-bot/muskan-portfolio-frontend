import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import BookingModal from "../components/BookingModal";
import toast from "react-hot-toast";

const getAudienceId = (item) => (typeof item === "string" ? item : item?._id);

const ExpertDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  
  const [expert, setExpert] = useState(null);
  const [projects, setProjects] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const [expertRes, projectsRes, reviewsRes] = await Promise.all([
            axios.get(`${import.meta.env.VITE_API_URL}/api/profiles/expert/${id}`),
            axios.get(`${import.meta.env.VITE_API_URL}/api/projects/user/${id}`),
            axios.get(`${import.meta.env.VITE_API_URL}/api/reviews/expert/${id}`)
          ]);

          setExpert(expertRes.data);
          setProjects(projectsRes.data);
          setReviews(reviewsRes.data);
        } catch (err) {
          console.error(err);
          toast.error("Failed to load expert details");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id]);

  const handleBookingClick = () => {
    if (!user) {
      toast.error("Authentication required. Please sign in to book a session.");
      navigate("/login");
      return;
    }
    setIsBookingOpen(true);
  };

  // Toggle favorite expert
  const handleToggleFavorite = async () => {
    if (!user) {
      toast.error("Please login to save favorite experts.");
      navigate("/login");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/profiles/favorite/${id}`,
        {},
        { headers: { Authorization: token } }
      );
      updateUser(res.data);
      toast.success(isFavorited ? "Removed from favorites" : "Added to favorites!");
    } catch {
      toast.error("Failed to update favorites");
    }
  };

  const handleToggleAudience = async (type) => {
    if (!user) {
      toast.error(`Please login to ${type} this expert.`);
      navigate("/login");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/profiles/${type}/${id}`,
        {},
        { headers: { Authorization: token } }
      );
      setExpert(res.data.expert);
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${type} expert`);
    }
  };

  const isFavorited = user?.favorites?.some(fav => fav._id === id || fav === id);
  const isFollowing = expert?.followers?.some(item => getAudienceId(item) === user?._id);
  const isSubscribed = expert?.subscribers?.some(item => getAudienceId(item) === user?._id);
  const followerCount = expert?.followers?.length || 0;
  const subscriberCount = expert?.subscribers?.length || 0;
  const canViewExclusiveContent = isSubscribed || user?._id === expert?._id || user?.subscriptionPlan === "premium";

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!expert) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center">
        <Navbar />
        <h2 className="text-3xl font-bold text-white mb-4">Expert Not Found</h2>
        <Link to="/experts" className="text-primary-400 hover:underline font-bold">Go back to experts list</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <SEO title={`${expert.name} - Expert Consultant Profile`} description={expert.bio || `Consult with ${expert.name}`} />
      <Navbar />

      {isBookingOpen && (
        <BookingModal 
          expert={expert} 
          onClose={() => setIsBookingOpen(false)} 
        />
      )}

      <div className="pt-32 pb-20 max-w-7xl mx-auto px-6">
        {/* Profile Header Card */}
        <div className="glass rounded-[3rem] p-10 border-white/5 relative overflow-hidden mb-12 shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-primary-500 to-accent"></div>
          
          {/* Favorite button */}
          <button
            onClick={handleToggleFavorite}
            className={`md:absolute top-6 right-6 p-4 w-full md:w-auto mb-6 md:mb-0 rounded-2xl border transition-all active:scale-95 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-wider ${
              isFavorited 
                ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {isFavorited ? "❤️ Saved" : "🤍 Favorite"}
          </button>

          <div className="flex flex-col md:flex-row gap-10 items-center md:items-start mt-4">
            <div className="relative">
              <img 
                src={expert.profileImage ? `${import.meta.env.VITE_API_URL}${expert.profileImage}` : "https://via.placeholder.com/200"} 
                alt={expert.name} 
                className="w-48 h-48 rounded-full object-cover border-4 border-white/10 shadow-2xl"
              />
              <span className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-4 border-surface ${expert.isAvailable ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            </div>

            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <h1 className="text-4xl md:text-5xl font-extrabold text-white">{expert.name}</h1>
                  <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-3.5 py-1.5 rounded-full text-sm font-bold flex items-center gap-1">
                    ★ {expert.rating || "5.0"} <span className="text-slate-500 font-medium">({expert.reviewsCount || 0})</span>
                  </span>
                  {expert.category && (
                    <span className="bg-primary-500/10 border border-primary-500/20 text-primary-300 px-3.5 py-1.5 rounded-full text-xs font-bold">
                      {expert.category}
                    </span>
                  )}
                  {expert.subscriptionPlan === "premium" && (
                    <span className="bg-amber-400/10 border border-amber-400/30 text-amber-300 px-3.5 py-1.5 rounded-full text-xs font-bold">
                      VIP Member
                    </span>
                  )}
                </div>
                <p className="text-2xl text-primary-400 font-semibold mt-1">{expert.title}</p>
                {expert.experience && <p className="text-sm text-slate-400 mt-0.5">Experience: {expert.experience}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Followers</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{followerCount}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Subscribers</p>
                  <p className="text-2xl font-extrabold text-primary-400 mt-1">{subscriberCount}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Reviews</p>
                  <p className="text-2xl font-extrabold text-yellow-400 mt-1">{expert.reviewsCount || 0}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Content</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">{expert.exclusiveContent ? "1" : "0"}</p>
                </div>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {expert.skills?.map(skill => (
                  <span key={skill} className="bg-white/5 border border-white/5 px-4 py-2 rounded-full text-xs font-bold text-slate-300">
                    {skill}
                  </span>
                ))}
              </div>

              <p className="text-slate-400 text-lg max-w-3xl leading-relaxed">
                {expert.bio || "This expert hasn't provided a bio yet."}
              </p>

              {/* Social and portfolio link row */}
              {(expert.github || expert.linkedin || expert.portfolio) && (
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 py-2">
                  {expert.github && (
                    <a href={expert.github} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-white border border-white/10 bg-white/5 px-4 py-2 rounded-xl transition-all font-semibold">
                      GitHub
                    </a>
                  )}
                  {expert.linkedin && (
                    <a href={expert.linkedin} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-white border border-white/10 bg-white/5 px-4 py-2 rounded-xl transition-all font-semibold">
                      LinkedIn
                    </a>
                  )}
                  {expert.portfolio && (
                    <a href={expert.portfolio} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-white border border-white/10 bg-white/5 px-4 py-2 rounded-xl transition-all font-semibold">
                      Portfolio Site
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleToggleAudience("follow")}
                  className={`px-6 py-3 rounded-2xl border font-bold text-sm transition-all active:scale-95 ${
                    isFollowing
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-white/5 border-white/10 text-slate-300 hover:text-white hover:border-primary-500/30"
                  }`}
                >
                  {isFollowing ? "Following" : "Follow"}
                </button>
                <button
                  onClick={() => handleToggleAudience("subscribe")}
                  className={`px-6 py-3 rounded-2xl border font-bold text-sm transition-all active:scale-95 ${
                    isSubscribed
                      ? "bg-primary-500/15 border-primary-500/40 text-primary-300"
                      : "bg-amber-400/10 border-amber-400/30 text-amber-300 hover:bg-amber-400/20"
                  }`}
                >
                  {isSubscribed ? "Subscribed" : "Subscribe for Exclusive Content"}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 justify-center md:justify-start border-t border-white/5 pt-6 mt-6">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Hourly rate</p>
                  <p className="text-3xl font-extrabold text-white">₹{expert.hourlyRate}<span className="text-lg text-slate-400 font-medium">/hr</span></p>
                </div>
                {expert.pricePerMinute > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Per minute</p>
                    <p className="text-2xl font-extrabold text-emerald-400">₹{expert.pricePerMinute}<span className="text-base text-slate-400 font-medium">/min</span></p>
                  </div>
                )}
                <button
                  onClick={handleBookingClick}
                  disabled={!expert.isAvailable}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-primary-500 to-accent hover:from-primary-600 hover:to-violet-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white font-extrabold rounded-2xl shadow-xl shadow-primary-500/20 transition-all active:scale-95 tracking-wide text-sm uppercase"
                >
                  {expert.isAvailable ? "Book Consultation" : "Offline / Unavailable"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {expert.exclusiveContent && (
          <div className="mb-16 glass rounded-[2rem] p-8 border-white/5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <span className="inline-flex px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                  Exclusive Content
                </span>
                <h2 className="text-3xl font-bold text-white mt-3">Subscriber-only update</h2>
              </div>
              {!canViewExclusiveContent && (
                <button
                  onClick={() => handleToggleAudience("subscribe")}
                  className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-2xl transition-all active:scale-95"
                >
                  Subscribe to Unlock
                </button>
              )}
            </div>
            {canViewExclusiveContent ? (
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">{expert.exclusiveContent}</p>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6">
                <p className="text-slate-400 text-sm">
                  This creator has premium content available for subscribers. Follow and subscribe to unlock the full post.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Intro Video */}
        {expert.introVideo && (
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
              <span>🎬 Intro Reel</span>
            </h2>
            <div className="relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl" style={{ paddingBottom: "56.25%" }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={expert.introVideo.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/").replace("vimeo.com/", "player.vimeo.com/video/")}
                title="Expert Intro Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* Availability Schedule */}
        {expert.availabilitySchedule?.some(d => d.available) && (
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/10 pb-4">📅 Availability</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {expert.availabilitySchedule.filter(d => d.available).map(d => (
                <div key={d.day} className="glass p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
                  <p className="font-bold text-emerald-300 text-sm">{d.day}</p>
                  <p className="text-slate-400 text-xs mt-1">{d.from} — {d.to}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio Gallery */}
        {expert.portfolioGallery?.length > 0 && (
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/10 pb-4 flex items-center justify-between">
              <span>🖼️ Gallery</span>
              <span className="text-xs bg-white/5 text-slate-400 px-3 py-1.5 rounded-full border border-white/5">{expert.portfolioGallery.length} photos</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {expert.portfolioGallery.map((img, i) => (
                <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-white/10 group cursor-zoom-in">
                  <img
                    src={img.startsWith("http") ? img : `${import.meta.env.VITE_API_URL}${img}`}
                    alt={`Gallery ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Portfolio / Projects Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/10 pb-4 flex items-center justify-between">
            <span>Portfolio Projects</span>
            <span className="text-xs bg-white/5 text-slate-400 px-3 py-1.5 rounded-full border border-white/5">{projects.length} works</span>
          </h2>
          {projects.length === 0 ? (
            <p className="text-slate-400 text-center py-14 bg-white/5 rounded-[2rem] border border-dashed border-white/5">No projects found for this expert.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((project) => (
                <div key={project._id} className="glass rounded-[2.5rem] overflow-hidden border-white/5 group shadow-lg">
                  <div className="h-52 overflow-hidden relative">
                    <img 
                      src={project.image ? `${import.meta.env.VITE_API_URL}${project.image}` : "https://via.placeholder.com/800"} 
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent opacity-60"></div>
                  </div>
                  <div className="p-8">
                    <h3 className="text-2xl font-bold mb-2 text-white">{project.title}</h3>
                    <p className="text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed">{project.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {project.technologies?.slice(0, 3).map(t => (
                        <span key={t} className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[10px] uppercase font-bold text-slate-400">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Client Reviews Section */}
        <div>
          <h2 className="text-3xl font-bold text-white mb-8 border-b border-white/10 pb-4 flex items-center justify-between">
            <span>Client Reviews & Feedback</span>
            <span className="text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-3 py-1.5 rounded-full font-bold">★ {expert.rating || "5.0"} avg</span>
          </h2>
          {reviews.length === 0 ? (
            <p className="text-slate-400 text-center py-14 bg-white/5 rounded-[2rem] border border-dashed border-white/5">No client reviews submitted yet. Be the first to schedule a session!</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {reviews.map((r) => (
                <div key={r._id} className="glass p-8 rounded-[2rem] border-white/5 shadow-lg relative flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={r.client?.profileImage ? `${import.meta.env.VITE_API_URL}${r.client.profileImage}` : "https://via.placeholder.com/80"}
                        alt={r.client?.name}
                        className="w-12 h-12 rounded-full object-cover border border-white/10"
                      />
                      <div>
                        <h4 className="font-bold text-white text-base">{r.client?.name || "Client"}</h4>
                        <div className="text-yellow-400 text-xs font-bold tracking-wider mt-0.5">
                          {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                        </div>
                      </div>
                    </div>
                    <p className="text-slate-400 text-sm italic leading-relaxed">
                      "{r.reviewText}"
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600 block mt-6 text-right">
                    Reviewed on {new Date(r.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ExpertDetail;
