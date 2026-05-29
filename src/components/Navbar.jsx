import { useState } from "react";
import { useChat } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import ProfileAvatar from "./ProfileAvatar";

const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount = 0 } = useChat() || {};
  const unread = unreadCount ?? 0;
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/login");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-2xl font-bold tracking-tighter text-gradient">
          MUSKAN.
        </Link>

        {/* Navigation Links (Desktop) */}
        <div className="hidden md:flex items-center space-x-5 lg:space-x-6">
          <Link to="/" className="text-sm font-medium hover:text-primary-400 transition-colors">Home</Link>
          <Link to="/about" className="text-sm font-medium hover:text-primary-400 transition-colors">About</Link>
          <Link to="/projects" className="text-sm font-medium hover:text-primary-400 transition-colors">Projects</Link>
          <Link to="/blog" className="text-sm font-medium hover:text-primary-400 transition-colors">Blog</Link>
          <Link to="/experts" className="text-sm font-medium hover:text-primary-400 transition-colors">Experts</Link>
          <Link to="/live" className="text-sm font-medium hover:text-primary-400 transition-colors">Live</Link>
          <Link to="/ai" className="text-sm font-medium hover:text-primary-400 transition-colors">AI</Link>
          <Link to="/security" className="text-sm font-medium hover:text-primary-400 transition-colors">Security</Link>
          <Link to="/contact" className="text-sm font-medium hover:text-primary-400 transition-colors">Contact</Link>
          <Link to="/messages" className="text-sm font-medium hover:text-primary-400 transition-colors relative">
            Messages
            {unread > 0 && (
              <span className="absolute -top-1 -right-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-red-600 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-white/5 transition-all text-primary-400 active:scale-90"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>

          {user ? (
            <div className="flex items-center space-x-3 sm:space-x-4">
              {/* Dashboard Link (Desktop) */}
              <Link to="/dashboard" className="text-sm font-bold text-slate-300 hover:text-primary-400 transition-colors hidden sm:block">
                Dashboard
              </Link>
              <Link to="/manage-projects" className="text-sm font-bold text-slate-300 hover:text-primary-400 transition-colors hidden lg:block">
                Manage Projects
              </Link>
              {/* Billing Link (Desktop) */}
              <Link to="/billing" className="text-sm font-bold text-slate-300 hover:text-primary-400 transition-colors hidden sm:block">
                Billing
              </Link>
              {user?.isAdmin && (
                <Link to="/admin" className="text-sm font-bold text-red-300 hover:text-red-200 transition-colors hidden lg:block">
                  Admin
                </Link>
              )}
              {/* My Profile Link (Desktop) */}
              <Link to="/profile" className="text-sm font-bold text-slate-300 hover:text-primary-400 transition-colors hidden sm:block">
                My Profile
              </Link>

              {/* Avatar → Profile Page */}
              <Link to="/profile" className="relative group">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-primary-500/50 group-hover:border-primary-500 transition-all overflow-hidden bg-white/5">
                  <ProfileAvatar
                    user={user}
                    className="w-full h-full"
                    imageClassName="w-full h-full object-cover"
                    fallbackClassName="w-full h-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold text-sm"
                  />
                </div>
                {/* Online indicator */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0f172a] bg-emerald-500" />
              </Link>

              {/* Logout (Desktop) */}
              <button 
                onClick={handleLogout}
                className="text-sm font-bold text-red-500/70 hover:text-red-500 transition-colors hidden sm:block"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3 sm:space-x-4">
              <Link to="/register" className="text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors">
                Join
              </Link>
              <Link to="/login" className="bg-primary-500 hover:bg-primary-600 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-primary-500/20 active:scale-95 transition-all text-white">
                Login
              </Link>
            </div>
          )}

          {/* Hamburger Menu Toggle (Mobile) */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-xl hover:bg-white/5 transition-all text-slate-300 active:scale-90"
            aria-label="Toggle Menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown Panel */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden absolute top-[73px] left-0 right-0 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/5 p-6 flex flex-col space-y-4 z-40 overflow-y-auto max-h-[70vh] shadow-2xl"
          >
            <Link to="/" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">Home</Link>
            <Link to="/about" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">About</Link>
            <Link to="/projects" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">Projects</Link>
            <Link to="/blog" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">Blog</Link>
            <Link to="/experts" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">Experts</Link>
            <Link to="/live" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">Live</Link>
            <Link to="/ai" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">AI</Link>
            <Link to="/security" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">Security</Link>
            <Link to="/contact" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5">Contact</Link>
            <Link to="/messages" onClick={() => setMenuOpen(false)} className="text-base font-medium hover:text-primary-400 transition-colors py-2 border-b border-white/5 relative">
            Messages
            {unread > 0 && (
              <span className="absolute -top-1 -right-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-red-600 text-xs font-bold text-white">
                {unread}
              </span>
            )}
          </Link>
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="text-base font-bold text-primary-400 py-2 border-b border-white/5">
                  Dashboard
                </Link>
                <Link to="/manage-projects" onClick={() => setMenuOpen(false)} className="text-base font-bold text-slate-300 hover:text-primary-400 py-2 border-b border-white/5 transition-colors">
                  Manage Projects
                </Link>
                <Link to="/billing" onClick={() => setMenuOpen(false)} className="text-base font-bold text-slate-300 hover:text-primary-400 py-2 border-b border-white/5 transition-colors">
                  Billing
                </Link>
                {user?.isAdmin && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)} className="text-base font-bold text-red-300 hover:text-red-200 py-2 border-b border-white/5 transition-colors">
                    Admin Dashboard
                  </Link>
                )}
                <Link to="/profile" onClick={() => setMenuOpen(false)} className="text-base font-bold text-slate-300 hover:text-primary-400 py-2 border-b border-white/5 transition-colors">
                  My Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-left text-base font-bold text-red-400 hover:text-red-500 py-2"
                >
                  Logout
                </button>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
