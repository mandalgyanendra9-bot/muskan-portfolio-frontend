import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const API_URL = import.meta.env.VITE_API_URL || "";

const getAssetUrl = (path, fallback) => {
  if (!path) return fallback;
  return path.startsWith("http") ? path : `${API_URL}${path}`;
};

const premiumFeatures = [
  {
    title: "VIP Membership",
    description: "Highlight premium members with stronger profile placement and trust signals.",
  },
  {
    title: "Priority Booking",
    description: "Let premium clients jump into a priority queue when they book consultations.",
  },
  {
    title: "Exclusive Content",
    description: "Experts can publish subscriber-only profile updates, notes, and resources.",
  },
  {
    title: "Followers / Subscribers",
    description: "Grow a real audience with follow and subscribe actions on expert profiles.",
  },
];

const Home = () => {
  const [projects, setProjects] = useState([]);
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleViewDemo = async (projectId) => {
    if (!user) {
      toast.error("Authentication required. Please login to view live project demos.");
      navigate("/login");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${API_URL}/api/projects/${projectId}/access`, {
        headers: { Authorization: token }
      });
      if (res.data.liveLink) {
        window.open(res.data.liveLink, "_blank");
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Access Denied";
      toast.error(errorMsg);
    }
  };

  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        const [projectsRes, expertsRes] = await Promise.all([
          axios.get(`${API_URL}/api/projects`),
          axios.get(`${API_URL}/api/profiles/experts`)
        ]);
        
        setProjects(projectsRes.data.slice(0, 3)); // Top 3 projects
        setExperts(expertsRes.data.slice(0, 3)); // Top 3 experts
      } catch (err) {
        console.error("Error fetching landing data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLandingData();
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Colorful Background Blurs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[100px] -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[100px] -z-10 animate-pulse delay-700" />
        
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-400 font-medium text-sm backdrop-blur-md">
              ✨ Professional Portfolio + VC Expert Marketplace
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight leading-tight text-white">
              Hire Top Tech Experts for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent">Live Consultations</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              Unlock direct access to top developers and consultants. Book secure 1-on-1 video call workspaces, audit professional portfolios, and solve technical issues in real-time.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/experts" className="w-full sm:w-auto px-8 py-4.5 bg-primary-500 hover:bg-primary-600 text-white font-extrabold rounded-2xl transition-all shadow-xl shadow-primary-500/20 active:scale-95 text-sm uppercase tracking-wider">
                Find Experts
              </Link>
              <Link to="/register" className="w-full sm:w-auto px-8 py-4.5 bg-white/5 hover:bg-white/10 text-white font-extrabold rounded-2xl transition-all border border-white/10 active:scale-95 text-sm uppercase tracking-wider">
                Join as Expert
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Premium Features Section */}
      <div className="py-20 border-y border-white/5 bg-surface-variant/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <span className="inline-flex px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                Premium Features
              </span>
              <h2 className="text-4xl font-extrabold text-white mt-4">VIP access for serious clients and creators</h2>
              <p className="text-slate-400 text-lg mt-2 max-w-2xl">
                Add membership value with priority bookings, exclusive content, and real follower/subscriber growth.
              </p>
            </div>
            <Link to={user ? "/billing" : "/register"} className="w-full sm:w-auto text-center px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-2xl transition-all active:scale-95">
              {user ? "Open Premium" : "Start Membership"}
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {premiumFeatures.map((feature) => (
              <div key={feature.title} className="glass rounded-[2rem] p-6 border-white/5">
                <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mt-3">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Experts Section */}
      <div className="py-24 bg-surface-variant/20 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-12 gap-4">
            <div className="text-center md:text-left">
              <h2 className="text-4xl font-extrabold text-white">Featured <span className="text-primary-400">Consultants</span></h2>
              <p className="text-slate-400 text-lg mt-1">Book live sessions with certified software engineers and advisors</p>
            </div>
            <Link to="/experts" className="text-primary-400 hover:text-primary-300 font-bold transition-colors">
              Browse All Experts ({experts.length}+) →
            </Link>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : experts.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No experts currently approved.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {experts.map((expert, index) => (
                <motion.div 
                  key={expert._id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => navigate(`/expert/${expert._id}`)}
                  className="glass rounded-[3rem] p-8 border-white/5 flex flex-col items-center text-center group hover:border-primary-500/20 transition-all cursor-pointer relative shadow-lg"
                >
                  <span className="absolute top-6 right-6 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    ★ {expert.rating || "5.0"}
                  </span>
                  
                  <div className="w-24 h-24 rounded-full border-2 border-primary-500/15 mb-4 p-1">
                    <img 
                      src={getAssetUrl(expert.profileImage, "https://via.placeholder.com/150")} 
                      alt={expert.name || "Expert"} 
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-primary-400 transition-colors">{expert.name || "Expert"}</h3>
                  <p className="text-slate-400 text-xs font-medium mb-4">{expert.title || "Professional"}</p>
                  <div className="flex items-center gap-3 mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{expert.followers?.length || 0} followers</span>
                    <span>{expert.subscribers?.length || 0} subscribers</span>
                  </div>
                  
                  <p className="text-text-muted text-xs line-clamp-2 mb-6">
                    {expert.bio || "No bio provided."}
                  </p>

                  <div className="w-full pt-4 border-t border-white/5 flex items-center justify-between mt-auto">
                    <p className="text-sm font-bold text-white">₹{expert.hourlyRate}/hr</p>
                    <span className="text-xs text-primary-400 font-bold group-hover:underline">View Profile →</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Featured Projects Preview */}
      <div className="py-24 max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-12 gap-4">
          <div className="text-center md:text-left">
            <h2 className="text-4xl font-extrabold text-white">Featured <span className="text-accent">Projects</span></h2>
            <p className="text-slate-400 text-lg mt-1">Audit proof of work from our expert network</p>
          </div>
          <Link to="/projects" className="text-primary-400 hover:text-primary-300 font-bold transition-colors">
            View All Projects →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <motion.div 
                key={project._id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-[2.5rem] overflow-hidden border-white/5 group shadow-lg"
              >
                <div className="h-48 overflow-hidden relative">
                  <img 
                    src={getAssetUrl(project.image, "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80")} 
                    alt={project.title || "Project"}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent opacity-60"></div>
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-2 text-white">{project.title || "Untitled Project"}</h3>
                  <p className="text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed">{project.description || "Project details will be added soon."}</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {(project.tech || project.technologies || []).slice(0, 3).map(tech => (
                      <span key={tech} className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400">
                        {tech}
                      </span>
                    ))}
                  </div>
                  <button 
                    onClick={() => handleViewDemo(project._id)}
                    className="w-full py-3 bg-white/5 border border-white/10 hover:bg-primary-500 hover:border-primary-500 text-white rounded-xl font-bold transition-all active:scale-[0.98]"
                  >
                    View Live Demo
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Reviews & Testimonials Section */}
      <div className="py-24 bg-surface-variant/20 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-white">Client <span className="text-primary-400">Testimonials</span></h2>
            <p className="text-slate-400 text-lg mt-1">What our clients say after consult sessions</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                client: "David Miller",
                role: "SaaS Startup Founder",
                text: "The built-in video workspace was flawless. I shared my screen, and the expert walked me through fixing a complex PostgreSQL locking issue in 40 minutes. Absolutely outstanding value!",
                rating: 5,
                avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&q=80"
              },
              {
                client: "Elena Rostova",
                role: "Product Manager at Fintech",
                text: "The payment flow was incredibly simple and dynamic. Instantly generated receipt invoices for corporate expense approval, and booking calendar slots fit right in with my daily timeline.",
                rating: 5,
                avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&q=80"
              },
              {
                client: "Arjun Mehta",
                role: "CTO, Logistics Corp",
                text: "Finding an expert with deep NestJS experience took seconds. Highly professional, responsive, and completed the session directly within the virtual meeting room. Will book weekly consultations.",
                rating: 5,
                avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&q=80"
              }
            ].map((t, idx) => (
              <div key={idx} className="glass p-8 rounded-[2.5rem] border-white/5 flex flex-col justify-between shadow-lg">
                <div className="space-y-4">
                  <div className="text-yellow-400 text-sm">
                    {"★".repeat(t.rating)}
                  </div>
                  <p className="text-slate-400 text-sm italic leading-relaxed">
                    "{t.text}"
                  </p>
                </div>
                
                <div className="flex items-center gap-3 mt-8 border-t border-white/5 pt-4">
                  <img src={t.avatar} alt={t.client} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <h4 className="font-bold text-white text-sm">{t.client}</h4>
                    <p className="text-slate-500 text-[10px] uppercase font-bold">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Home;
