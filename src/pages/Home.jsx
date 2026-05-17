import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const Home = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const handleViewDemo = async (projectId) => {
    if (!user) {
      toast.error("Please login to view the live demo");
      return;
    }

    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/projects/${projectId}/access`, {
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
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/projects`);
        setProjects(res.data.slice(0, 3)); // Only show top 3 on home
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      
      {/* Hero Section */}
      <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Colorful Background Blurs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-[100px] -z-10 animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] -z-10 animate-pulse delay-700" />
        
        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-400 font-medium text-sm backdrop-blur-md">
              ✨ Welcome to my creative space
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight leading-tight text-white">
              Hi, I'm <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent">Muskan Khatun</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              A passionate Full-Stack Developer crafting beautiful, responsive, and high-performance web applications.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/projects" className="w-full sm:w-auto px-8 py-4 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-primary-500/20 active:scale-95">
                View My Work
              </Link>
              <Link to="/contact" className="w-full sm:w-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 active:scale-95">
                Get In Touch
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Skills / About Section */}
      <div className="py-20 bg-surface-variant/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Frontend", desc: "React, Tailwind, HTML, CSS, JavaScript", icon: "🎨" },
              { title: "Backend", desc: "Node.js, Express, MongoDB, REST APIs", icon: "⚙️" },
              { title: "Design", desc: "UI/UX, Figma, Responsive Interfaces", icon: "✨" }
            ].map((skill, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass p-8 rounded-[2rem] border-white/5 hover:border-primary-500/30 transition-all group"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{skill.icon}</div>
                <h3 className="text-2xl font-bold mb-2 text-white">{skill.title}</h3>
                <p className="text-slate-400">{skill.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Preview */}
      <div className="py-32 max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-bold mb-4 text-white">Featured <span className="text-primary-400">Projects</span></h2>
            <p className="text-slate-400 text-lg">Some of my recent works</p>
          </div>
          <Link to="/projects" className="hidden md:block text-primary-400 hover:text-primary-300 font-bold transition-colors">
            View All Projects →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {projects.map((project, index) => (
              <motion.div 
                key={project._id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass rounded-[2rem] overflow-hidden border-white/5 group"
              >
                <div className="h-48 overflow-hidden relative">
                  <img 
                    src={project.image ? `${import.meta.env.VITE_API_URL}${project.image}` : "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80"} 
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent opacity-60"></div>
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-2 text-white">{project.title}</h3>
                  <p className="text-slate-400 mb-6 line-clamp-2">{project.description}</p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.technologies?.slice(0, 3).map(tech => (
                      <span key={tech} className="bg-white/5 px-3 py-1 rounded-full text-xs font-medium text-slate-300">
                        {tech}
                      </span>
                    ))}
                  </div>
                  <button 
                    onClick={() => handleViewDemo(project._id)}
                    className="w-full py-3 bg-white/5 hover:bg-primary-500 text-white rounded-xl font-bold transition-all"
                  >
                    View Live Demo
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        <div className="mt-8 text-center md:hidden">
          <Link to="/projects" className="text-primary-400 hover:text-primary-300 font-bold transition-colors">
            View All Projects →
          </Link>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Home;