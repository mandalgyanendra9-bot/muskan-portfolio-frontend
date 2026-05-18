import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import toast from "react-hot-toast";
import BookingModal from "../components/BookingModal";

const Experts = () => {
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpert, setSelectedExpert] = useState(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("all");
  const [minRating, setMinRating] = useState(1);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchExperts = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/profiles/experts`);
        setExperts(res.data);
      } catch (err) {
        console.error("Error fetching experts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchExperts();
  }, []);

  const handleBooking = (expert, e) => {
    e.stopPropagation(); // Avoid triggering card click navigation
    if (!user) {
      toast.error("Authentication required. Please login to book an expert consultation.");
      navigate("/login");
      return;
    }
    setSelectedExpert(expert);
  };

  // Compile all unique skills for filter dropdown
  const allSkills = ["all", ...new Set(experts.flatMap(e => e.skills || []))];

  // Filtering Logic
  const filteredExperts = experts.filter(expert => {
    const matchesSearch = 
      expert.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      expert.skills?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSkill = selectedSkill === "all" || expert.skills?.includes(selectedSkill);
    const matchesRating = (expert.rating || 5) >= minRating;
    const matchesAvailability = !onlyAvailable || expert.isAvailable;

    return matchesSearch && matchesSkill && matchesRating && matchesAvailability;
  });

  return (
    <div className="min-h-screen bg-surface">
      <SEO title="Find Top Tech Experts" description="Search and book consultation calls with professional developers, designers, and consultants." />
      <Navbar />
      
      {selectedExpert && (
        <BookingModal 
          expert={selectedExpert} 
          onClose={() => setSelectedExpert(null)} 
        />
      )}
      
      <div className="section-padding pt-40 pb-20">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center md:text-left"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-4">Find Your <span className="text-primary-400">Expert</span></h1>
            <p className="text-text-muted text-xl max-w-2xl">
              Connect with top-tier verified professionals, browse portfolios, and schedule consultations in minutes.
            </p>
          </motion.div>

          {/* Filters Panel */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-3xl p-6 border-white/5 shadow-xl mb-12 grid grid-cols-1 md:grid-cols-4 gap-6 items-center"
          >
            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Search Keywords</label>
              <input
                type="text"
                placeholder="Name, role, skills..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 focus:outline-none focus:border-primary-500 text-white text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Tech Stack Select */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Filter Tech Stack</label>
              <select
                className="w-full bg-[#0f172a] border border-white/10 rounded-2xl px-5 py-3.5 focus:outline-none focus:border-primary-500 text-white text-sm capitalize"
                value={selectedSkill}
                onChange={(e) => setSelectedSkill(e.target.value)}
              >
                {allSkills.map(skill => (
                  <option key={skill} value={skill}>{skill === "all" ? "All Technologies" : skill}</option>
                ))}
              </select>
            </div>

            {/* Minimum Rating */}
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Minimum Rating ({(minRating).toFixed(1)}★)</label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                className="w-full accent-primary-500 py-4"
                value={minRating}
                onChange={(e) => setMinRating(parseFloat(e.target.value))}
              />
            </div>

            {/* Availability Checkbox */}
            <div className="flex items-center gap-3 justify-center md:justify-start md:pt-5 h-full">
              <input
                type="checkbox"
                id="avail-toggle"
                className="w-5 h-5 accent-primary-500 rounded border-white/10 cursor-pointer"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
              />
              <label htmlFor="avail-toggle" className="text-sm font-semibold text-slate-300 cursor-pointer select-none">
                Online / Available Now
              </label>
            </div>
          </motion.div>

          {/* Experts List */}
          {loading ? (
            <div className="py-20 flex justify-center"><div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
          ) : filteredExperts.length === 0 ? (
            <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/5">
              <p className="text-slate-400 text-lg">No matching experts found. Try adjusting your filter parameters.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredExperts.map((expert, index) => (
                <motion.div 
                  key={expert._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/expert/${expert._id}`)}
                  className="glass rounded-[3rem] p-8 border-white/5 flex flex-col items-center text-center group hover:border-primary-500/30 transition-all cursor-pointer relative shadow-xl hover:shadow-2xl"
                >
                  {/* Availability indicator badge */}
                  <span className={`absolute top-6 left-6 px-3 py-1 rounded-full text-[9px] font-bold uppercase ${
                    expert.isAvailable 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-500/10 border border-slate-500/20 text-slate-400'
                  }`}>
                    {expert.isAvailable ? '● Available' : '○ Offline'}
                  </span>

                  {/* Rating Indicator */}
                  <span className="absolute top-6 right-6 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    ★ {expert.rating || "5.0"}
                  </span>

                  <div className="w-28 h-28 rounded-full border-4 border-primary-500/10 group-hover:border-primary-500 transition-all p-1 mb-6 mt-4">
                    <img 
                      src={expert.profileImage ? `${import.meta.env.VITE_API_URL}${expert.profileImage}` : "https://via.placeholder.com/150"} 
                      alt={expert.name} 
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-text-main mb-1 group-hover:text-primary-400 transition-colors">{expert.name}</h3>
                  <p className="text-slate-400 text-sm font-medium mb-4">{expert.title}</p>
                  
                  <p className="text-text-muted text-sm line-clamp-2 mb-6 max-w-xs">
                    {expert.bio || "No bio provided."}
                  </p>

                  <div className="flex flex-wrap justify-center gap-2 mb-8 mt-auto">
                    {expert.skills?.slice(0, 4).map(skill => (
                      <span key={skill} className="bg-white/5 border border-white/5 px-3 py-1 rounded-full text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <div className="w-full pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-xs text-text-muted">Hourly Rate</p>
                      <p className="text-xl font-extrabold text-white">₹{expert.hourlyRate}/hr</p>
                    </div>
                    <button 
                      onClick={(e) => handleBooking(expert, e)}
                      className="bg-primary-500 hover:bg-primary-600 px-6 py-3.5 rounded-2xl text-white font-extrabold transition-all shadow-xl shadow-primary-500/20 active:scale-95 text-xs tracking-wider uppercase"
                    >
                      Book Slot
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Experts;
