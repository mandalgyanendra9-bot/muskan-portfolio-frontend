const Footer = () => {
  return (
    <footer className="bg-surface-variant/50 border-t border-white/5 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
        <div>
          <span className="text-xl font-bold text-gradient">MUSKAN.</span>
          <p className="text-slate-400 text-sm mt-2">© 2024 Building premium digital experiences.</p>
        </div>
        <div className="flex space-x-6 text-sm text-slate-400">
          <a href="#" className="hover:text-white transition-colors">Twitter</a>
          <a href="#" className="hover:text-white transition-colors">GitHub</a>
          <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
