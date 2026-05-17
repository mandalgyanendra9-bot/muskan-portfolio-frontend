import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

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
    <div className="retro-bg">
      <div className="retro-window">
        {/* Header */}
        <div className="retro-header">
          <img 
            src="https://api.dicebear.com/7.x/pixel-art/svg?seed=portfolio" 
            alt="Avatar" 
            className="retro-avatar"
          />
          <h1 className="retro-title">{user ? user.name : "MUSKAN KHATUN"}</h1>
        </div>

        {/* Content */}
        <div className="retro-content">
          <h2 className="retro-section-title">😎 ABOUT ME</h2>
          <p className="retro-text">
            Full-stack developer dedicated to building visually stunning and highly performant web applications. Passionate about solving complex problems and learning new technologies.
          </p>

          <h2 className="retro-section-title">🗿 HISTORY</h2>
          <p className="retro-text">
            2026 - Present: Building amazing web experiences.<br />
            2024 - 2026: Working as a full-stack engineer.<br />
            2020 - 2024: Studied Computer Science.
          </p>

          <h2 className="retro-section-title">🚀 WORKS</h2>
          {loading ? (
            <p className="retro-text">Loading...</p>
          ) : (
            <ul className="retro-list">
              {projects.map((project) => (
                <li key={project._id} className="retro-list-item">
                  <span>- </span>
                  <a 
                    className="retro-link" 
                    onClick={() => handleViewDemo(project._id)}
                  >
                    [{project.title ? project.title.toUpperCase() : "PROJECT"}]
                  </a>
                  <span className="retro-date">{new Date(project.createdAt || Date.now()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  {project.githubLink && (
                    <a href={project.githubLink} target="_blank" rel="noopener noreferrer" className="retro-link" style={{ marginLeft: "10px", fontSize: "14px" }}>[GITHUB]</a>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h2 className="retro-section-title">🍔 SNS</h2>
          <ul className="retro-list">
            <li className="retro-list-item">- <a href="#" className="retro-link">Facebook</a></li>
            <li className="retro-list-item">- <a href="#" className="retro-link">Instagram</a></li>
            <li className="retro-list-item">- <a href="#" className="retro-link">Twitter</a></li>
            <li className="retro-list-item">- <a href="#" className="retro-link">GitHub</a></li>
            <li className="retro-list-item">- <a href="#" className="retro-link">LinkedIn</a></li>
          </ul>

          <h2 className="retro-section-title">💌 CONTACT</h2>
          <p className="retro-text">
            <a href="mailto:contact@example.com" className="retro-link">contact@example.com</a>
          </p>

          <h2 className="retro-section-title">🔥 MUSIC</h2>
          <p className="retro-text">Currently listening to Synthwave & Lofi.</p>
          
          <div style={{ marginTop: '50px', marginBottom: '20px' }}>
             <a href="/dashboard" className="retro-link" style={{ fontSize: '14px' }}>[Go to Dashboard]</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;