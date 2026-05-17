import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { motion } from "framer-motion";

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="text-2xl font-bold tracking-tighter text-gradient">
          MUSKAN.
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center space-x-8">
          <Link to="/" className="text-sm font-medium hover:text-primary-400 transition-colors">Home</Link>
          <Link to="/about" className="text-sm font-medium hover:text-primary-400 transition-colors">About</Link>
          <Link to="/projects" className="text-sm font-medium hover:text-primary-400 transition-colors">Projects</Link>
          <Link to="/blog" className="text-sm font-medium hover:text-primary-400 transition-colors">Blog</Link>
          <Link to="/experts" className="text-sm font-medium hover:text-primary-400 transition-colors">Experts</Link>
          <Link to="/contact" className="text-sm font-medium hover:text-primary-400 transition-colors">Contact</Link>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-6">
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-white/5 transition-all text-primary-400 active:scale-90"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>

          {user ? (
            <div className="flex items-center space-x-4">
              {/* Profile / Admin Link */}
              <Link to="/admin" className="text-sm font-bold text-slate-300 hover:text-primary-400 transition-colors hidden sm:block">
                Dashboard
              </Link>
              
              {/* Profile Image (Click to Upload/Profile) */}
              <Link to="/upload" className="relative group">
                <div className="w-10 h-10 rounded-full border-2 border-primary-500/50 group-hover:border-primary-500 transition-all overflow-hidden bg-white/5">
                  <img 
                    src={user.profileImage ? `${import.meta.env.VITE_API_URL}${user.profileImage}` : "https://via.placeholder.com/150"} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </Link>

              {/* Logout */}
              <button 
                onClick={handleLogout}
                className="text-sm font-bold text-red-500/70 hover:text-red-500 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link to="/register" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">
                Join
              </Link>
              <Link to="/login" className="bg-primary-500 hover:bg-primary-600 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 active:scale-95 transition-all text-white">
                Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;