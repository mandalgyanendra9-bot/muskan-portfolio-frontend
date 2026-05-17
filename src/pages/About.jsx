import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import aboutImg from "../assets/hero.png";

const About = () => {
  const skills = [
    "React", "Node.js", "Tailwind CSS", "MongoDB", "Framer Motion", "Express", "PostgreSQL", "Vite"
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      
      <div className="section-padding pt-40 pb-32">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="flex-1 relative"
          >
            <div className="relative z-10 rounded-[3.5rem] overflow-hidden glass p-4 aspect-square shadow-2xl">
              <img src={aboutImg} alt="About Me" className="w-full h-full object-cover rounded-[2.5rem]" />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary-500/10 rounded-full blur-[120px] -z-10" />
          </motion.div>

          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="flex-1"
          >
            <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold mb-8 leading-tight">Passionate about <br /><span className="text-primary-400">Design & Code</span></motion.h1>
            <motion.p variants={itemVariants} className="text-xl text-slate-400 mb-10 leading-relaxed max-w-xl">
              I am a dedicated full-stack developer with a keen eye for detail and a passion for creating seamless user experiences. I love turning complex problems into simple, beautiful, and intuitive solutions.
            </motion.p>
            
            <motion.div variants={itemVariants} className="space-y-8">
              <h3 className="text-2xl font-bold">Tech Toolkit</h3>
              <div className="flex flex-wrap gap-4">
                {skills.map((skill) => (
                  <motion.span 
                    key={skill}
                    whileHover={{ y: -5, scale: 1.05 }}
                    className="glass px-8 py-4 rounded-3xl text-slate-300 font-bold border-white/5 hover:border-primary-500/50 hover:text-primary-400 transition-all cursor-default shadow-lg"
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default About;
