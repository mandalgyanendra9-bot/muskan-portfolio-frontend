import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import API from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import { useAuth } from "../context/AuthContext";
import { resolveProfilePhotoUrl } from "../utils/profilePhoto";

const aiFeatures = [
  { title: "AI Recommendation System", text: "Rank experts by skills, category, rating, availability, and budget." },
  { title: "AI Chat Assistant", text: "Ask platform questions and get quick guidance for bookings or profiles." },
  { title: "Smart Matching", text: "Describe a goal and get best-fit expert matches with reasons." },
  { title: "AI-generated Bios", text: "Turn skills and experience into a polished professional bio." },
];

const emptyMatchForm = {
  goal: "",
  skills: "",
  category: "",
  budget: "",
};

const AIFeatures = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [matchForm, setMatchForm] = useState(emptyMatchForm);
  const [matches, setMatches] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I can help with expert recommendations, smart matching, booking notes, live sessions, and profile bios.",
    },
  ]);
  const [bioForm, setBioForm] = useState({
    name: user?.name || "",
    title: user?.title || "",
    category: user?.category || "",
    skills: user?.skills?.join(", ") || "",
    experience: user?.experience || "",
    tone: "professional",
  });
  const [generatedBio, setGeneratedBio] = useState("");
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [matching, setMatching] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const { data } = await API.get("/ai/recommendations");
        setRecommendations(data.recommendations || []);
      } catch {
        setRecommendations([]);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    fetchRecommendations();
  }, []);

  const handleMatch = async (event) => {
    event.preventDefault();
    setMatching(true);
    try {
      const { data } = await API.post("/ai/match", matchForm);
      setMatches(data.matches || []);
      if ((data.matches || []).length === 0) toast("Add more details for a stronger match.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Smart matching failed");
    } finally {
      setMatching(false);
    }
  };

  const handleChat = async (event) => {
    event.preventDefault();
    if (!chatInput.trim()) return;
    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages((current) => [...current, { role: "user", text: userMessage }]);
    setChatting(true);
    try {
      const { data } = await API.post("/ai/chat", { message: userMessage });
      setChatMessages((current) => [
        ...current,
        { role: "assistant", text: data.reply, suggestions: data.suggestions || [] },
      ]);
    } catch (error) {
      toast.error(error.response?.data?.message || "AI assistant failed");
    } finally {
      setChatting(false);
    }
  };

  const handleBioGenerate = async (event) => {
    event.preventDefault();
    if (!user) {
      toast.error("Please login to generate a profile bio");
      navigate("/login");
      return;
    }

    setGeneratingBio(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await API.post("/ai/bio", bioForm, { headers: { Authorization: token } });
      setGeneratedBio(data.bio);
    } catch (error) {
      toast.error(error.response?.data?.message || "Bio generation failed");
    } finally {
      setGeneratingBio(false);
    }
  };

  const renderMatchCard = ({ expert, score, reasons, matchedSkills }) => (
    <div key={expert._id} className="glass p-6 rounded-[2rem] border-white/5">
      <div className="flex items-center gap-4">
        <img
          src={resolveProfilePhotoUrl(expert) || "https://via.placeholder.com/120"}
          alt={expert.name}
          className="w-14 h-14 rounded-full object-cover border border-white/10"
          loading="lazy"
          decoding="async"
        />
        <div className="min-w-0">
          <h3 className="text-white font-bold truncate">{expert.name}</h3>
          <p className="text-primary-300 text-xs truncate">{expert.title || "Expert"}</p>
        </div>
        <span className="ml-auto bg-primary-500/10 border border-primary-500/20 text-primary-300 px-3 py-1 rounded-full text-xs font-bold">
          {score}% fit
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        {(matchedSkills?.length ? matchedSkills : expert.skills || []).slice(0, 5).map((skill) => (
          <span key={skill} className="bg-white/5 border border-white/10 text-slate-300 px-3 py-1 rounded-full text-[11px] font-bold">
            {skill}
          </span>
        ))}
      </div>
      <ul className="mt-4 space-y-2 text-xs text-slate-400">
        {(reasons || []).slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <Link to={`/expert/${expert._id}`} className="inline-flex mt-5 text-primary-300 hover:text-primary-200 text-sm font-bold">
        View expert profile
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SEO title="AI Features" description="AI recommendations, chat assistant, smart matching, and generated bios." />
      <Navbar />

      <main className="flex-grow pt-28 pb-20 px-4 max-w-7xl mx-auto w-full space-y-8">
        <section className="glass rounded-[2rem] border-white/5 p-8">
          <span className="inline-flex px-3 py-1 rounded-full border border-primary-500/30 bg-primary-500/10 text-primary-300 text-xs font-extrabold uppercase tracking-wider">
            AI Features
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mt-4">Recommendations, chat, matching, and profile bios</h1>
          <p className="text-slate-400 max-w-3xl mt-3 leading-relaxed">
            Use smart platform intelligence to find better experts, improve profiles, and guide users faster.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {aiFeatures.map((feature) => (
              <div key={feature.title} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-bold">{feature.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed mt-2">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-8">
            <div className="glass rounded-[2rem] border-white/5 p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-white">AI Recommendation System</h2>
                  <p className="text-slate-400 text-sm mt-1">Top experts ranked by platform signals.</p>
                </div>
                <Link to="/experts" className="text-primary-300 hover:text-primary-200 text-sm font-bold">Browse all</Link>
              </div>
              {loadingRecommendations ? (
                <p className="text-slate-400">Loading recommendations...</p>
              ) : recommendations.length === 0 ? (
                <p className="text-slate-500 text-sm">No expert recommendations available yet.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {recommendations.slice(0, 4).map(renderMatchCard)}
                </div>
              )}
            </div>

            <div className="glass rounded-[2rem] border-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">Smart Matching</h2>
              <p className="text-slate-400 text-sm mt-1">Describe what you need and get ranked expert matches.</p>
              <form onSubmit={handleMatch} className="grid md:grid-cols-2 gap-4 mt-5">
                <textarea
                  rows={4}
                  placeholder="Goal: e.g. Need a React + Node expert to debug a booking flow"
                  className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm resize-none"
                  value={matchForm.goal}
                  onChange={(event) => setMatchForm({ ...matchForm, goal: event.target.value })}
                />
                <input
                  placeholder="Skills: React, Node.js, MongoDB"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={matchForm.skills}
                  onChange={(event) => setMatchForm({ ...matchForm, skills: event.target.value })}
                />
                <input
                  placeholder="Category"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={matchForm.category}
                  onChange={(event) => setMatchForm({ ...matchForm, category: event.target.value })}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Budget per hour"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={matchForm.budget}
                  onChange={(event) => setMatchForm({ ...matchForm, budget: event.target.value })}
                />
                <button
                  type="submit"
                  disabled={matching}
                  className="bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-extrabold rounded-xl px-4 py-3 transition-all active:scale-95"
                >
                  {matching ? "Matching..." : "Find Smart Matches"}
                </button>
              </form>
              {matches.length > 0 && (
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  {matches.map(renderMatchCard)}
                </div>
              )}
            </div>

            <div className="glass rounded-[2rem] border-white/5 p-6">
              <h2 className="text-2xl font-bold text-white">AI-generated Bios</h2>
              <p className="text-slate-400 text-sm mt-1">Generate a polished bio from your title, skills, and experience.</p>
              <form onSubmit={handleBioGenerate} className="grid md:grid-cols-2 gap-4 mt-5">
                <input
                  placeholder="Name"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={bioForm.name}
                  onChange={(event) => setBioForm({ ...bioForm, name: event.target.value })}
                />
                <input
                  placeholder="Title"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={bioForm.title}
                  onChange={(event) => setBioForm({ ...bioForm, title: event.target.value })}
                />
                <input
                  placeholder="Category"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={bioForm.category}
                  onChange={(event) => setBioForm({ ...bioForm, category: event.target.value })}
                />
                <input
                  placeholder="Experience"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={bioForm.experience}
                  onChange={(event) => setBioForm({ ...bioForm, experience: event.target.value })}
                />
                <input
                  placeholder="Skills"
                  className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={bioForm.skills}
                  onChange={(event) => setBioForm({ ...bioForm, skills: event.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setBioForm({ ...bioForm, tone: bioForm.tone === "professional" ? "friendly" : "professional" })}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-bold rounded-xl px-4 py-3 transition-all"
                >
                  Tone: {bioForm.tone}
                </button>
                <button
                  type="submit"
                  disabled={generatingBio}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-extrabold rounded-xl px-4 py-3 transition-all active:scale-95"
                >
                  {generatingBio ? "Generating..." : "Generate Bio"}
                </button>
              </form>
              {generatedBio && (
                <div className="mt-5 bg-white/5 border border-white/10 rounded-2xl p-5">
                  <p className="text-slate-200 leading-relaxed">{generatedBio}</p>
                </div>
              )}
            </div>
          </div>

          <aside className="glass rounded-[2rem] border-white/5 p-6 h-fit sticky top-28">
            <h2 className="text-2xl font-bold text-white">AI Chat Assistant</h2>
            <p className="text-slate-400 text-sm mt-1">Ask about experts, bookings, profiles, live, or premium tools.</p>
            <div className="h-96 overflow-y-auto space-y-3 mt-5 pr-1">
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-2xl p-4 border ${
                    message.role === "user"
                      ? "bg-primary-500/10 border-primary-500/20 text-primary-100"
                      : "bg-white/5 border-white/10 text-slate-200"
                  }`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {message.role === "user" ? "You" : "Assistant"}
                  </p>
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  {message.suggestions?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.suggestions.map((suggestion) => (
                        <span key={suggestion} className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-400">
                          {suggestion}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleChat} className="flex gap-2 mt-4">
              <input
                type="text"
                placeholder="Ask AI..."
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
              />
              <button
                type="submit"
                disabled={chatting}
                className="bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-white font-bold px-4 py-3 rounded-xl"
              >
                Send
              </button>
            </form>
          </aside>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AIFeatures;
