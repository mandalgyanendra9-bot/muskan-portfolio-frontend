import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/contact`, {
        headers: { Authorization: token },
      });
      setMessages(res.data);
    } catch (err) {
      toast.error("Failed to fetch messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleDelete = async (id) => {
    const token = localStorage.getItem("token");
    if (!window.confirm("Are you sure you want to delete this message?")) return;

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/contact/${id}`, {
        headers: { Authorization: token },
      });
      toast.success("Message deleted");
      fetchMessages();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const toggleRead = async (id) => {
    const token = localStorage.getItem("token");
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/contact/${id}/read`, {}, {
        headers: { Authorization: token },
      });
      fetchMessages();
    } catch (err) {
      toast.error("Update failed");
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      <div className="flex-1 section-padding pt-40">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h1 className="text-4xl font-bold mb-2">Inquiry <span className="text-primary-400">Inbox</span></h1>
              <p className="text-slate-400">Manage your contact form submissions.</p>
            </div>
            <div className="bg-white/5 px-6 py-2 rounded-full border border-white/10">
              <span className="text-primary-400 font-bold">{messages.filter(m => !m.isRead).length}</span> Unread
            </div>
          </div>

          <div className="space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg._id} 
                className={`glass p-8 rounded-3xl border-white/5 transition-all duration-300 relative group ${!msg.isRead ? 'border-l-4 border-l-primary-500 bg-primary-500/5' : 'opacity-80'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl ${!msg.isRead ? 'bg-primary-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                      {msg.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{msg.name}</h3>
                      <p className="text-primary-400 text-sm">{msg.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleRead(msg._id)}
                      className={`p-2 rounded-xl transition-all ${msg.isRead ? 'text-slate-500 hover:text-primary-400' : 'text-primary-400 hover:bg-primary-500/10'}`}
                      title={msg.isRead ? "Mark as unread" : "Mark as read"}
                    >
                      {msg.isRead ? (
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" /></svg>
                      ) : (
                         <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                      )}
                    </button>
                    <button 
                      onClick={() => handleDelete(msg._id)}
                      className="p-2 rounded-xl text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <div className="pl-16">
                   <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                   <p className="text-slate-500 text-xs mt-6">Received on {new Date(msg.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="glass p-20 rounded-3xl border-white/5 text-center">
                <p className="text-slate-500 text-lg">Your inbox is empty.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Messages;
