import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";

function Dashboard() {
  const { user } = useAuth();
  
  const profileImage = user?.profileImage 
    ? `${import.meta.env.VITE_API_URL}${user.profileImage}` 
    : "https://via.placeholder.com/200";

  const userName = user?.name || "User Name";

  const skills = [
    { name: "React", icon: "⚛️" },
    { name: "Node.js", icon: "🟢" },
    { name: "MongoDB", icon: "🍃" },
    { name: "Express", icon: "🚀" }
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-6 pt-32 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[500px] bg-primary-500/5 rounded-full blur-[120px] -z-10" />
        
        <div className="glass p-10 rounded-[3rem] w-full max-w-xl text-center border-white/5 relative overflow-hidden group">
          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-primary-500/50 to-transparent" />
          
          <div className="relative inline-block">
             <img
              src={profileImage}
              alt="Profile"
              className="w-40 h-40 rounded-full mx-auto object-cover border-4 border-white/10 shadow-2xl group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 rounded-full border border-primary-500/20 scale-110 animate-pulse" />
          </div>

          <h1 className="text-4xl font-bold mt-8 text-gradient">
            {userName}
          </h1>

          <p className="text-slate-400 mt-2 text-lg">
            Full Stack Developer & Creative Designer
          </p>

          <div className="mt-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary-400 mb-6 flex items-center justify-center gap-2">
              <span className="w-8 h-[1px] bg-primary-500/30"></span>
              Core Skills
              <span className="w-8 h-[1px] bg-primary-500/30"></span>
            </h2>

            <div className="flex flex-wrap justify-center gap-4">
              {skills.map((skill) => (
                <div key={skill.name} className="bg-white/5 border border-white/10 px-6 py-3 rounded-full hover:bg-white/10 hover:border-primary-500/30 transition-all cursor-default">
                  <span className="mr-2">{skill.icon}</span>
                  <span className="text-sm font-medium">{skill.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex gap-4 justify-center">
            <button className="bg-primary-500 hover:bg-primary-600 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-primary-500/20 active:scale-95">
              Download Resume
            </button>
            <button className="glass border-white/10 hover:bg-white/10 text-white px-10 py-4 rounded-2xl font-bold transition-all active:scale-95">
              Edit Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;