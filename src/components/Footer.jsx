import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-surface-variant/50 border-t border-white/5 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
        <div>
          <span className="text-xl font-bold text-gradient">MUSKAN.</span>
          <p className="text-slate-400 text-sm mt-2">© 2026 Building premium digital experiences.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
          <a href="#" className="hover:text-white transition-colors">Twitter</a>
          <a href="#" className="hover:text-white transition-colors">GitHub</a>
          <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
          <Link to="/refund" className="hover:text-white transition-colors">Refund</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
