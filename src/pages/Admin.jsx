import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import toast from "react-hot-toast";

const Admin = () => {
  const [projects, setProjects] = useState([]);
  const [messages, setMessages] = useState([]);
  const [visitorCount, setVisitorCount] = useState(0);

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/projects`);
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/contact`, {
        headers: { Authorization: token }
      });
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/analytics/stats`);
      setVisitorCount(res.data.count);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchMessages();
    fetchStats();
  }, []);

  const handleDelete = async (id) => {
    const token = localStorage.getItem("token");
    if (!window.confirm("Are you sure you want to delete this project?")) return;

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/projects/${id}`, {
        headers: { Authorization: token },
      });
      toast.success("Project deleted");
      fetchProjects();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      <div className="flex-1 section-padding pt-32">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-8 rounded-[2rem] border-white/5 flex items-center gap-6 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              </div>
              <div>
                <p className="text-text-muted text-sm font-medium uppercase tracking-wider">Total Projects</p>
                <h3 className="text-4xl font-bold text-text-main">{projects.length}</h3>
              </div>
            </div>

            <div className="glass p-8 rounded-[2rem] border-white/5 flex items-center gap-6 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              </div>
              <div>
                <p className="text-text-muted text-sm font-medium uppercase tracking-wider">Messages</p>
                <h3 className="text-4xl font-bold text-text-main">{messages.length}</h3>
              </div>
            </div>

            <div className="glass p-8 rounded-[2rem] border-white/5 flex items-center gap-6 shadow-xl border-l-primary-500/20">
              <div className="w-16 h-16 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
              <div>
                <p className="text-text-muted text-sm font-medium uppercase tracking-wider">Live Visitors</p>
                <h3 className="text-4xl font-bold text-text-main">{visitorCount}</h3>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            
            {/* Quick Actions */}
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold mb-2 text-text-main">Content <span className="text-primary-400">Control</span></h2>
                  <p className="text-text-muted">Manage your portfolio and blog.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link to="/manage-projects" className="glass p-8 rounded-3xl border-white/5 hover:border-primary-500/30 transition-all group">
                   <h4 className="font-bold text-xl mb-2 group-hover:text-primary-400 transition-colors">Projects Hub</h4>
                   <p className="text-text-muted text-sm">Add, Edit or Delete projects.</p>
                </Link>
                <Link to="/blog" className="glass p-8 rounded-3xl border-white/5 hover:border-accent/30 transition-all group">
                   <h4 className="font-bold text-xl mb-2 group-hover:text-accent transition-colors">Blog Manager</h4>
                   <p className="text-text-muted text-sm">Write and edit articles.</p>
                </Link>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-text-main">Recent Projects</h3>
                <div className="grid grid-cols-1 gap-4">
                  {projects.slice(0, 3).map((project) => (
                    <div key={project._id} className="glass p-4 rounded-2xl border-white/5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden">
                        {project.image && <img src={`${import.meta.env.VITE_API_URL}${project.image}`} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold truncate text-text-main text-sm">{project.title}</h4>
                        <p className="text-text-muted text-[10px] uppercase tracking-widest">{project.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Messages Summary */}
            <div className="space-y-8">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold mb-2 text-text-main">Recent <span className="text-accent">Inquiries</span></h2>
                  <p className="text-text-muted">Stay connected with your audience.</p>
                </div>
                <Link to="/messages" className="text-primary-400 text-sm hover:underline font-bold">View Inbox</Link>
              </div>
              
              <div className="space-y-4">
                {messages.slice(0, 3).map((msg) => (
                  <div key={msg._id} className={`glass p-6 rounded-3xl border-white/5 space-y-3 ${!msg.isRead ? 'border-l-4 border-l-primary-500 shadow-lg shadow-primary-500/5' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-text-main">{msg.name}</h4>
                        <p className="text-primary-400 text-xs">{msg.email}</p>
                      </div>
                      {!msg.isRead && <span className="bg-primary-500 w-2 h-2 rounded-full animate-pulse"></span>}
                    </div>
                    <p className="text-text-muted text-sm italic line-clamp-1">"{msg.message}"</p>
                  </div>
                ))}
                {messages.length === 0 && <p className="text-text-muted py-12 text-center glass rounded-3xl border-dashed">No messages yet.</p>}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Admin;