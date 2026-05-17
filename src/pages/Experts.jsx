import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import toast from "react-hot-toast";
import BookingModal from "../components/BookingModal";

const Experts = () => {
  const [experts, setExperts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExpert, setSelectedExpert] = useState(null);

  useEffect(() => {
    const fetchExperts = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/profiles/experts`);
        setExperts(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchExperts();
  }, []);

  const handleBooking = (expert) => {
    setSelectedExpert(expert);
  };

  return (
    <div className="min-h-screen bg-surface">
      <SEO title="Find Experts" description="Browse and book top developers and experts for your project." />
      <Navbar />
      
      {selectedExpert && (
        <BookingModal 
          expert={selectedExpert} 
          onClose={() => setSelectedExpert(null)} 
        />
      )}
      
      <div className="section-padding pt-40 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-4">Find Your <span className="text-primary-400">Expert</span></h1>
            <p className="text-text-muted text-xl max-w-2xl">
              Connect with top-tier professionals and book a consultation in minutes.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {experts.map((expert, index) => (
              <motion.div 
                key={expert._id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-[3rem] p-8 border-white/5 flex flex-col items-center text-center group"
              >
                <div className="w-32 h-32 rounded-full border-4 border-primary-500/20 group-hover:border-primary-500 transition-all p-1 mb-6">
                  <img 
                    src={expert.profileImage ? `${import.meta.env.VITE_API_URL}${expert.profileImage}` : "https://via.placeholder.com/150"} 
                    alt={expert.name} 
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                
                <h3 className="text-2xl font-bold text-text-main mb-1">{expert.name}</h3>
                <p className="text-primary-400 font-medium mb-4">{expert.title}</p>
                
                <p className="text-text-muted text-sm line-clamp-2 mb-6">
                  {expert.bio || "No bio provided."}
                </p>

                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {expert.skills?.map(skill => (
                    <span key={skill} className="bg-white/5 px-3 py-1 rounded-full text-[10px] uppercase font-bold text-slate-500">
                      {skill}
                    </span>
                  ))}
                </div>

                <div className="w-full pt-6 border-t border-white/5 flex items-center justify-between mt-auto">
                  <div>
                    <p className="text-xs text-text-muted">Hourly Rate</p>
                    <p className="text-xl font-bold text-text-main">${expert.hourlyRate}/hr</p>
                  </div>
                  <button 
                    onClick={() => handleBooking(expert)}
                    className="bg-primary-500 hover:bg-primary-600 px-6 py-3 rounded-2xl text-white font-bold transition-all shadow-xl shadow-primary-500/20 active:scale-95"
                  >
                    Book Now
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Experts;
