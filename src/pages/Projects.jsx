import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { ProjectSkeleton } from "../components/Skeleton";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "";

const getAssetUrl = (path, fallback) => {
  if (!path) return fallback;
  return path.startsWith("http") ? path : `${API_URL}${path}`;
};

const Projects = () => {
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
      const errorMsg = err.response?.data?.message || "Access Denied or Link Missing";
      toast.error(errorMsg);
    }
  };

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/projects`);
        setProjects(res.data);
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
      
      <div className="section-padding pt-40">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6">Innovative <span className="text-primary-400">Solutions</span></h1>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto">
              Explore my latest projects, ranging from complex web systems to creative interactive experiences.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map(i => <ProjectSkeleton key={i} />)
            ) : (
              projects.map((project, index) => (
                <motion.div 
                  key={project._id || project.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -10 }}
                  className="glass rounded-[2.5rem] overflow-hidden border-white/5 flex flex-col group h-full"
                >
                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={getAssetUrl(project.image, "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80")}
                      alt={project.title || "Project"}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-surface/80 backdrop-blur-md text-primary-400 text-[10px] font-bold px-3 py-1 rounded-full border border-white/5 uppercase tracking-wider">
                        {project.type || "Web App"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className="text-2xl font-bold mb-3 group-hover:text-primary-400 transition-colors">{project.title || "Untitled Project"}</h3>
                    <p className="text-slate-400 text-sm mb-6 flex-1 line-clamp-3 leading-relaxed">
                      {project.description || "Project details will be added soon."}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-8">
                      {(project.tech || project.technologies || []).map((tech) => (
                        <span key={tech} className="text-[10px] bg-white/5 px-3 py-1 rounded-full text-slate-500 uppercase font-medium">
                          {tech}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-auto">
                      <button 
                        onClick={() => handleViewDemo(project._id)}
                        className="bg-primary-500 hover:bg-primary-600 text-white text-center py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 active:scale-95 text-sm"
                      >
                        Live Demo 🌐
                      </button>
                      
                      {project.githubLink ? (
                        <a href={project.githubLink} target="_blank" rel="noopener noreferrer" className="glass hover:bg-white/10 text-white text-center py-3 rounded-xl font-bold transition-all border border-white/10 active:scale-95 text-sm">
                          Source Code 💻
                        </a>
                      ) : (
                        <button disabled className="glass opacity-30 text-slate-600 text-center py-3 rounded-xl font-bold text-sm cursor-not-allowed border border-white/5">
                          Private Repo
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Projects;
