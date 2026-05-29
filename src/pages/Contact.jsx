import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

const Contact = () => {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/contact`, formData);
      setIsSuccess(true);
      toast.success("Message sent!");
      setFormData({ name: "", email: "", message: "" });
      setTimeout(() => setIsSuccess(false), 5000); // Reset success after 5s
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Failed to send message. Please try again.";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SEO
        title="Contact"
        description="Get in touch with Muskan Khatun for portfolio work, collaborations, and expert consultation."
      />
      <Navbar />
      <main className="flex-1 section-padding pt-40 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-6">Let's <span className="text-primary-400">Connect</span></h1>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto">
              Have a project in mind or just want to say hi? I'm always open to new opportunities.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-20 items-start">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-12"
            >
              <div className="glass p-12 rounded-[3rem] border-white/5 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl group-hover:bg-primary-500/20 transition-all duration-500" />
                 <h3 className="text-2xl font-bold mb-8">Contact Information</h3>
                 <div className="space-y-6">
                    <div className="flex items-center gap-6">
                       <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-primary-400">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                       </div>
                       <div>
                          <p className="text-slate-500 text-sm">Email me at</p>
                          <p className="text-white font-medium">hello@yourdomain.com</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-accent">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                       </div>
                       <div>
                          <p className="text-slate-500 text-sm">Location</p>
                          <p className="text-white font-medium">Remote / Worldwide</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex gap-4">
                 {['LinkedIn', 'Twitter', 'GitHub'].map(social => (
                   <motion.a 
                    key={social}
                    whileHover={{ y: -5 }}
                    href="#" 
                    className="flex-1 glass py-6 rounded-3xl text-center font-bold hover:text-primary-400 hover:border-primary-500/30 transition-all"
                   >
                     {social}
                   </motion.a>
                 ))}
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass p-20 rounded-[3rem] border-white/5 text-center flex flex-col items-center justify-center h-full min-h-[500px]"
                >
                  <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-8">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="text-4xl font-bold mb-4">Message Sent!</h2>
                  <p className="text-slate-400">Thanks for reaching out. I'll get back to you soon.</p>
                  <button 
                    onClick={() => setIsSuccess(false)}
                    className="mt-10 text-primary-400 hover:underline font-bold"
                  >
                    Send another message
                  </button>
                </motion.div>
              ) : (
                <motion.form 
                  key="form"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ delay: 0.3 }}
                  onSubmit={handleSubmit} 
                  className="glass p-12 rounded-[3rem] border-white/5 space-y-8 shadow-2xl"
                >
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-400 ml-1">What's your name?</label>
                      <input 
                        type="text" 
                        placeholder="Type your name here..." 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 focus:outline-none focus:border-primary-500 transition-all text-white placeholder:text-slate-600"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-400 ml-1">Your email address</label>
                      <input 
                        type="email" 
                        placeholder="email@example.com" 
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 focus:outline-none focus:border-primary-500 transition-all text-white placeholder:text-slate-600"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-400 ml-1">How can I help you?</label>
                      <textarea 
                        rows="4" 
                        placeholder="Describe your project or inquiry..." 
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-8 py-5 focus:outline-none focus:border-primary-500 transition-all text-white placeholder:text-slate-600 resize-none"
                      ></textarea>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-primary-500 hover:bg-primary-600 text-white font-bold py-6 rounded-2xl transition-all shadow-xl shadow-primary-500/20 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
