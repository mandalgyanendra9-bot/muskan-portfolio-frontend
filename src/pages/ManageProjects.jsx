import { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import toast from "react-hot-toast";

const ManageProjects = () => {
  const [projects, setProjects] = useState([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "Web App",
    tech: "",
    liveLink: "",
    githubLink: "",
  });
  const [image, setImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/projects`);
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data = new FormData();
    data.append("title", formData.title);
    data.append("description", formData.description);
    data.append("type", formData.type);
    data.append("tech", formData.tech);
    data.append("liveLink", formData.liveLink);
    data.append("githubLink", formData.githubLink);
    if (image) data.append("image", image);

    const token = localStorage.getItem("token");

    try {
      if (editId) {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/projects/${editId}`, data, {
          headers: {
            Authorization: token,
            "Content-Type": "multipart/form-data",
          },
        });
        toast.success("Project updated!");
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/projects`, data, {
          headers: {
            Authorization: token,
            "Content-Type": "multipart/form-data",
          },
        });
        toast.success("Project added!");
      }
      resetForm();
      fetchProjects();
    } catch (err) {
      toast.error("Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", type: "Web App", tech: "", liveLink: "", githubLink: "" });
    setImage(null);
    setEditId(null);
  };

  const handleEdit = (project) => {
    setEditId(project._id);
    setFormData({
      title: project.title,
      description: project.description,
      type: project.type,
      tech: project.tech.join(","),
      liveLink: project.liveLink || "",
      githubLink: project.githubLink || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const token = localStorage.getItem("token");
    if (!window.confirm("Delete this project?")) return;

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/projects/${id}`, {
        headers: { Authorization: token },
      });
      toast.success("Project deleted");
      fetchProjects();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      <div className="flex-1 section-padding pt-40">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-2">Manage <span className="text-primary-400">Projects</span></h1>
            <p className="text-slate-400">Add, edit, or remove projects from your portfolio.</p>
          </div>

          <div className="grid lg:grid-cols-12 gap-12">
            {/* Form Column */}
            <div className="lg:col-span-5">
              <div className="glass p-10 rounded-[2.5rem] border-white/5 h-fit sticky top-32">
                <h2 className="text-2xl font-bold mb-8">
                  {editId ? "Edit Project" : "Add New Project"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <input 
                    type="text" 
                    placeholder="Title" 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                  <textarea 
                    placeholder="Description" 
                    rows="4"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                  <div className="grid grid-cols-1 gap-4">
                     <input 
                      type="text" 
                      placeholder="Tech (e.g. React, Node.js)" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all"
                      value={formData.tech}
                      onChange={(e) => setFormData({ ...formData, tech: e.target.value })}
                    />
                    <input 
                      type="text" 
                      placeholder="Live Link" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all"
                      value={formData.liveLink}
                      onChange={(e) => setFormData({ ...formData, liveLink: e.target.value })}
                    />
                    <input 
                      type="text" 
                      placeholder="GitHub Link" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-primary-500 transition-all"
                      value={formData.githubLink}
                      onChange={(e) => setFormData({ ...formData, githubLink: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 ml-1">Project Thumbnail</label>
                    <input 
                      type="file" 
                      className="w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-500/10 file:text-primary-400 hover:file:bg-primary-500/20 cursor-pointer"
                      onChange={(e) => setImage(e.target.files[0])}
                    />
                  </div>
                  <div className="flex gap-4">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? "Processing..." : (editId ? "Update" : "Create")}
                    </button>
                    {editId && (
                      <button 
                        type="button"
                        onClick={resetForm}
                        className="px-6 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* List Column */}
            <div className="lg:col-span-7">
               <div className="grid gap-6">
                 {projects.map((project) => (
                   <div key={project._id} className="glass p-6 rounded-3xl border-white/5 flex items-center gap-6 group hover:border-primary-500/20 transition-all">
                     <div className="w-24 h-24 rounded-2xl bg-white/5 overflow-hidden shrink-0">
                       {project.image && <img src={`${import.meta.env.VITE_API_URL}${project.image}`} alt="" className="w-full h-full object-cover" />}
                     </div>
                     <div className="flex-1 min-w-0">
                       <h3 className="font-bold text-lg truncate">{project.title}</h3>
                       <p className="text-slate-400 text-sm line-clamp-1">{project.description}</p>
                       <div className="flex gap-2 mt-3">
                         {project.tech.slice(0, 3).map(t => (
                           <span key={t} className="text-[10px] bg-white/5 px-2 py-1 rounded-md text-slate-500 uppercase">{t}</span>
                         ))}
                       </div>
                     </div>
                     <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => handleEdit(project)} className="p-3 rounded-xl bg-primary-500/10 text-primary-400 hover:bg-primary-500 hover:text-white transition-all">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                       </button>
                       <button onClick={() => handleDelete(project._id)} className="p-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       </button>
                     </div>
                   </div>
                 ))}
                 {projects.length === 0 && <p className="text-center py-20 text-slate-500">No projects yet.</p>}
               </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ManageProjects;
