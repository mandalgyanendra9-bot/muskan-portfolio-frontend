import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Get booking details passed from navigation state (or fallback)
  const booking = location.state?.booking;
  const expertName = booking?.expert?.name || "Expert Advisor";
  const clientName = booking?.client?.name || "Client Partner";

  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([
    { sender: "System", text: "Welcome to your virtual meeting room. Secure WebRTC connection established.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [inputText, setInputText] = useState("");

  const localVideoRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize webcam
  useEffect(() => {
    async function startCamera() {
      try {
        if (camActive) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.error("Camera access failed:", err);
        toast.error("Could not access camera/mic. Running in Avatar mode.");
        setCamActive(false);
      }
    }
    
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [camActive]);

  // Handle send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = {
      sender: user?.name || "You",
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText("");

    // Simulated response from the other participant after 2 seconds
    setTimeout(() => {
      const responses = [
        "Absolutely, that makes sense. Let's look at the database schema.",
        "Could you show me your React components once more?",
        "Yes, we can optimize this API route by adding simple redis caching.",
        "Excellent question! Let's write out the configuration file for that.",
        "Perfect. I will send over the files right after our session concludes."
      ];
      const randomReply = responses[Math.floor(Math.random() * responses.length)];
      setMessages(prev => [...prev, {
        sender: user?.role === "expert" ? clientName : expertName,
        text: randomReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 2000);
  };

  // Leave Call
  const handleLeaveCall = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    toast.success("Call ended successfully.");
    
    // Redirect to dashboard with reviewTrigger state if client leaves
    if (user?.role === "client" || user?.role === "user") {
      navigate("/dashboard", { state: { reviewBooking: booking } });
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 border-b border-white/5 py-4 px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
          <span className="font-mono text-sm tracking-wider text-slate-400">ROOM ID: {roomId}</span>
        </div>
        <div className="flex items-center gap-6">
          <h2 className="text-lg font-bold text-gradient">Virtual WorkSpace</h2>
          <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-slate-400 capitalize">
            Role: {user?.role || "Client"}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Call Stream Grid */}
        <div className="flex-1 p-6 flex flex-col gap-6 items-center justify-center relative bg-slate-950">
          
          <div className="w-full h-full max-w-5xl grid md:grid-cols-2 gap-6 relative flex-1">
            {/* Client (You / User Feed) */}
            <div className="glass border-white/5 rounded-3xl overflow-hidden relative aspect-video md:h-full flex items-center justify-center bg-slate-900/50 shadow-2xl">
              {camActive ? (
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-primary-500/20 flex items-center justify-center text-4xl border border-primary-500/40 animate-pulse">
                    👤
                  </div>
                  <p className="text-sm font-medium text-slate-400">Camera Off</p>
                </div>
              )}
              
              {/* Overlay Tags */}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border border-white/5">
                <span className="w-2 h-2 rounded-full bg-primary-400" />
                {user?.name} (You)
              </div>

              {!micActive && (
                <div className="absolute top-4 right-4 bg-red-500/80 backdrop-blur-md p-2.5 rounded-full border border-red-400/20">
                  🎙️ Muted
                </div>
              )}
            </div>

            {/* Expert / Other Participant Feed */}
            <div className="glass border-white/5 rounded-3xl overflow-hidden relative aspect-video md:h-full flex items-center justify-center bg-slate-900/50 shadow-2xl">
              {/* Simulated High-Quality Wave Animation */}
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full bg-accent/20 flex items-center justify-center text-4xl border border-accent/40 relative z-10 shadow-lg">
                    {user?.role === "expert" ? "👤" : "💻"}
                  </div>
                  <div className="absolute -inset-2 bg-accent/30 rounded-full blur-[10px] animate-pulse" />
                  <div className="absolute inset-0 rounded-full border border-accent/40 scale-125 animate-ping opacity-30" />
                </div>
                
                <div>
                  <h4 className="text-xl font-bold">{user?.role === "expert" ? clientName : expertName}</h4>
                  <p className="text-xs text-accent font-mono tracking-widest uppercase mt-1">CONNECTED & STREAMING</p>
                </div>
              </div>

              {/* Overlay Tags */}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border border-white/5">
                <span className="w-2 h-2 rounded-full bg-accent" />
                {user?.role === "expert" ? clientName : expertName}
              </div>
              
              <div className="absolute top-4 right-4 bg-emerald-500/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono border border-emerald-400/20">
                ACTIVE MIC
              </div>
            </div>
          </div>

          {/* Control Bar */}
          <div className="bg-slate-900 border border-white/5 px-8 py-4 rounded-3xl flex items-center gap-6 shadow-2xl z-10">
            {/* Mic */}
            <button 
              onClick={() => setMicActive(!micActive)}
              className={`p-4 rounded-2xl transition-all active:scale-95 ${micActive ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'}`}
              title={micActive ? "Mute Mic" : "Unmute Mic"}
            >
              {micActive ? "🎙️" : "🔇"}
            </button>

            {/* Cam */}
            <button 
              onClick={() => setCamActive(!camActive)}
              className={`p-4 rounded-2xl transition-all active:scale-95 ${camActive ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'}`}
              title={camActive ? "Turn Cam Off" : "Turn Cam On"}
            >
              {camActive ? "📹" : "📷"}
            </button>

            {/* Screen Share */}
            <button 
              onClick={() => {
                setScreenSharing(!screenSharing);
                toast.success(screenSharing ? "Stopped screen share" : "Screen sharing mock started successfully");
              }}
              className={`p-4 rounded-2xl transition-all active:scale-95 ${screenSharing ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400' : 'bg-white/5 hover:bg-white/10 text-white'}`}
              title="Share Screen"
            >
              🖥️
            </button>

            {/* Chat Toggle */}
            <button 
              onClick={() => setChatOpen(!chatOpen)}
              className={`p-4 rounded-2xl transition-all active:scale-95 ${chatOpen ? 'bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 font-bold' : 'bg-white/5 hover:bg-white/10 text-white'}`}
              title="Toggle Chat"
            >
              💬
            </button>

            <div className="w-[1px] h-8 bg-white/10" />

            {/* End Call */}
            <button 
              onClick={handleLeaveCall}
              className="bg-red-500 hover:bg-red-600 px-6 py-4 rounded-2xl text-white font-bold transition-all active:scale-95 shadow-lg shadow-red-500/20 flex items-center gap-2"
            >
              <span>🔴</span> Leave Session
            </button>
          </div>
        </div>

        {/* Call Chat Sidebar */}
        {chatOpen && (
          <div className="w-96 bg-slate-900 border-l border-white/5 flex flex-col justify-between h-full z-10">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-lg">Meeting Chat</h3>
              <span className="bg-slate-800 text-xs px-2.5 py-1 rounded-full text-slate-400 font-mono">
                {messages.length} messages
              </span>
            </div>

            {/* Message area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.sender === "System" ? "items-center" : m.sender === (user?.name || "You") ? "items-end" : "items-start"}`}>
                  {m.sender !== "System" && (
                    <span className="text-[10px] text-slate-500 font-medium mb-1 mr-1">{m.sender}</span>
                  )}
                  <div className={`p-4 rounded-2xl text-sm max-w-[85%] ${
                    m.sender === "System" 
                      ? "bg-white/5 text-slate-400 text-center italic border border-white/5" 
                      : m.sender === (user?.name || "You") 
                      ? "bg-primary-500 text-white rounded-br-none" 
                      : "bg-white/5 border border-white/5 text-slate-300 rounded-bl-none"
                  }`}>
                    {m.text}
                  </div>
                  <span className="text-[9px] text-slate-600 mt-1 font-mono">{m.time}</span>
                </div>
              ))}
            </div>

            {/* Input form */}
            <form onSubmit={handleSendMessage} className="p-6 border-t border-white/5 flex gap-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-500 text-sm text-white"
              />
              <button 
                type="submit" 
                className="bg-primary-500 hover:bg-primary-600 p-3 rounded-xl transition-colors font-bold active:scale-95"
              >
                ➡️
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;
