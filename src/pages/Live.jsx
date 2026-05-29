import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SEO from "../components/SEO";
import { useAuth } from "../context/AuthContext";
import { SecureMediaImage } from "../components/SensitiveContentProtection";

const API_URL = import.meta.env.VITE_API_URL || "https://muskan-portfolio-backend.onrender.com";
const SOCKET_URL = API_URL || "http://localhost:5000";

const featureCards = [
  { title: "Live Streaming", text: "Host real-time portfolio sessions and expert talks." },
  { title: "Go Live", text: "Start a branded live room with one click." },
  { title: "Live Chat", text: "Keep viewers talking while the session is active." },
  { title: "Gifts / Coins", text: "Let viewers support creators with coin gifts." },
  { title: "Live Viewer Count", text: "Track the active audience as people join or leave." },
];

const Live = () => {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [streams, setStreams] = useState([]);
  const [selectedStream, setSelectedStream] = useState(null);
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [sendingGift, setSendingGift] = useState("");
  const [viewerCount, setViewerCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [liveForm, setLiveForm] = useState({ title: "", category: "Portfolio Live" });
  const [messages, setMessages] = useState([]);
  const [giftFeed, setGiftFeed] = useState([]);
  const socketRef = useRef(null);
  const liveContainerRef = useRef(null);
  const zegoRef = useRef(null);

  const token = localStorage.getItem("token");
  const requestedStreamId = searchParams.get("stream");
  const isHost = selectedStream?.host?._id === user?._id || selectedStream?.host === user?._id;
  const coinBalance = user?.coinBalance ?? 250;

  const headers = useMemo(() => (
    token ? { Authorization: token } : {}
  ), [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          const [streamsRes, giftsRes] = await Promise.all([
            axios.get(`${API_URL}/api/live/active`),
            axios.get(`${API_URL}/api/live/gifts/catalog`),
          ]);
          setStreams(streamsRes.data);
          setGiftCatalog(giftsRes.data);
          setSelectedStream((current) => {
            if (current) {
              return streamsRes.data.find((stream) => stream._id === current._id) || current;
            }
            return streamsRes.data.find((stream) => stream._id === requestedStreamId) || streamsRes.data[0] || null;
          });
        } catch {
          toast.error("Failed to load live streams");
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [requestedStreamId]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("live:started", (stream) => {
      setStreams((current) => [stream, ...current.filter((item) => item._id !== stream._id)]);
      setSelectedStream((current) => current || stream);
    });

    socket.on("live:ended:list", (stream) => {
      setStreams((current) => current.filter((item) => item._id !== stream._id));
      setSelectedStream((current) => current?._id === stream._id ? null : current);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!selectedStream?.roomId || !socketRef.current) return undefined;
    const socket = socketRef.current;

    setMessages(selectedStream.chatMessages?.slice(-60) || []);
    setGiftFeed(selectedStream.gifts?.slice(-20).reverse() || []);
    setViewerCount(selectedStream.viewerCount || 0);
    socket.emit("live:join", { roomId: selectedStream.roomId });

    const handleViewerCount = (payload) => {
      if (payload.roomId === selectedStream.roomId) setViewerCount(payload.viewerCount);
    };
    const handleChat = (message) => setMessages((current) => [...current.slice(-59), message]);
    const handleGift = (gift) => setGiftFeed((current) => [gift, ...current.slice(0, 19)]);
    const handleEnded = (stream) => {
      toast("This live stream has ended");
      setStreams((current) => current.filter((item) => item._id !== stream._id));
      setSelectedStream(null);
    };

    socket.on("live:viewers", handleViewerCount);
    socket.on("live:chat", handleChat);
    socket.on("live:gift", handleGift);
    socket.on("live:ended", handleEnded);

    return () => {
      socket.emit("live:leave", { roomId: selectedStream.roomId });
      socket.off("live:viewers", handleViewerCount);
      socket.off("live:chat", handleChat);
      socket.off("live:gift", handleGift);
      socket.off("live:ended", handleEnded);
    };
  }, [
    selectedStream?._id,
    selectedStream?.roomId,
    selectedStream?.chatMessages,
    selectedStream?.gifts,
    selectedStream?.viewerCount,
  ]);

  const handleEndLive = useCallback(async () => {
    if (!selectedStream || !isHost) return;
    setEnding(true);
    try {
      await axios.put(`${API_URL}/api/live/${selectedStream._id}/end`, {}, { headers });
      setStreams((current) => current.filter((item) => item._id !== selectedStream._id));
      setSelectedStream(null);
      toast.success("Live stream ended");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to end live");
    } finally {
      setEnding(false);
    }
  }, [selectedStream, isHost, headers]);

  useEffect(() => {
    if (!selectedStream?.roomId || !liveContainerRef.current) return undefined;
    if (zegoRef.current) {
      zegoRef.current.destroy();
      zegoRef.current = null;
    }

    const appID = Number(import.meta.env.VITE_ZEGO_APP_ID) || 1618361093;
    const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET || "87245bdcc3539e0839e44ffc91bbfcb2";
    const liveRole = isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience;
    const liveMode = ZegoUIKitPrebuilt.LiveStreamingMode?.RealTimeLive || "RealTimeLive";
    const userId = user?._id || `guest_${Date.now()}`;
    const userName = user?.name || "Guest Viewer";

    try {
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
        appID,
        serverSecret,
        selectedStream.roomId,
        userId,
        userName
      );
      const zego = ZegoUIKitPrebuilt.create(kitToken);
      zegoRef.current = zego;
      zego.joinRoom({
        container: liveContainerRef.current,
        sharedLinks: [
          {
            name: "Copy Live Link",
            url: `${window.location.origin}/live?stream=${selectedStream._id}`,
          },
        ],
        scenario: {
          mode: ZegoUIKitPrebuilt.LiveStreaming,
          config: {
            role: liveRole,
            liveStreamingMode: liveMode,
          },
        },
        showPreJoinView: isHost,
        turnOnCameraWhenJoining: isHost,
        turnOnMicrophoneWhenJoining: isHost,
        showTextChat: false,
        showUserList: true,
        showScreenSharingButton: isHost,
        startLiveButtonText: "Go Live",
        onLiveStart: () => toast.success("You are live now"),
        onLiveEnd: () => {
          if (isHost) handleEndLive();
        },
      });
    } catch (error) {
      console.error(error);
      toast.error("Live video could not start. Chat and gifts are still available.");
    }

    return () => {
      if (zegoRef.current) {
        zegoRef.current.destroy();
        zegoRef.current = null;
      }
    };
  }, [selectedStream?._id, selectedStream?.roomId, isHost, user?._id, user?.name, handleEndLive]);

  const handleStartLive = async (event) => {
    event.preventDefault();
    if (!user) return toast.error("Please login to go live");
    if (!liveForm.title.trim()) return toast.error("Live title is required");

    setStarting(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/live/start`, liveForm, { headers });
      setStreams((current) => [data, ...current.filter((item) => item._id !== data._id)]);
      setSelectedStream(data);
      setLiveForm({ title: "", category: "Portfolio Live" });
      toast.success("Live room created. Press Go Live in the video panel.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to start live");
    } finally {
      setStarting(false);
    }
  };

  const handleSendChat = async (event) => {
    event.preventDefault();
    if (!user) return toast.error("Please login to chat");
    if (!selectedStream) return toast.error("Select a live stream first");
    if (!chatInput.trim()) return;

    setSendingChat(true);
    try {
      await axios.post(
        `${API_URL}/api/live/${selectedStream._id}/chat`,
        { message: chatInput },
        { headers }
      );
      setChatInput("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendGift = async (giftId) => {
    if (!user) return toast.error("Please login to send gifts");
    if (!selectedStream) return toast.error("Select a live stream first");

    setSendingGift(giftId);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/live/${selectedStream._id}/gift`,
        { giftId },
        { headers }
      );
      updateUser({ ...user, ...data.user });
      setSelectedStream((current) => current ? { ...current, totalCoins: data.totalCoins } : current);
      toast.success("Gift sent");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send gift");
    } finally {
      setSendingGift("");
    }
  };

  const handleClaimCoins = async () => {
    if (!user) return toast.error("Please login to claim coins");
    try {
      const { data } = await axios.post(`${API_URL}/api/live/coins/claim`, {}, { headers });
      updateUser({ ...user, ...data.user });
      toast.success(data.message);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to claim coins");
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <SEO title="Live Streaming" description="Go live, chat with viewers, send gifts, and track live viewer count." />
      <Navbar />

      <main className="flex-grow pt-28 pb-20 px-4 max-w-7xl mx-auto w-full space-y-8">
        <section className="glass rounded-[2rem] border-white/5 p-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <span className="inline-flex px-3 py-1 rounded-full border border-red-400/30 bg-red-500/10 text-red-300 text-xs font-extrabold uppercase tracking-wider">
                Live Streaming
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mt-4">Go live with chat, gifts, coins, and viewer count</h1>
              <p className="text-slate-400 max-w-3xl mt-3 leading-relaxed">
                Host expert sessions, portfolio demos, Q&A rooms, and subscriber moments from one live studio.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full lg:w-72">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Live Viewers</p>
                <p className="text-3xl font-extrabold text-white mt-1">{selectedStream ? viewerCount : 0}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Coins</p>
                <p className="text-3xl font-extrabold text-amber-300 mt-1">{coinBalance}</p>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
            {featureCards.map((feature) => (
              <div key={feature.title} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <h3 className="text-white font-bold">{feature.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed mt-2">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-6">
            <div className="glass rounded-[2rem] border-white/5 p-4 md:p-6">
              {selectedStream ? (
                <>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Live</span>
                        <span className="bg-white/5 border border-white/10 text-slate-300 text-xs font-bold px-3 py-1 rounded-full">
                          {viewerCount} watching
                        </span>
                        <span className="bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
                          {selectedStream.totalCoins || 0} coins
                        </span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-white mt-3">{selectedStream.title}</h2>
                      <p className="text-sm text-slate-400 mt-1">
                        Hosted by {selectedStream.host?.name || "Creator"} - {selectedStream.category}
                      </p>
                    </div>
                    {isHost && (
                      <button
                        onClick={handleEndLive}
                        disabled={ending}
                        className="bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-bold px-5 py-3 rounded-2xl transition-all active:scale-95"
                      >
                        {ending ? "Ending..." : "End Live"}
                      </button>
                    )}
                  </div>
                  <div
                    key={selectedStream._id}
                    ref={liveContainerRef}
                    className="w-full min-h-[520px] rounded-2xl overflow-hidden bg-slate-950 border border-white/10"
                  />
                </>
              ) : (
                <div className="min-h-[520px] rounded-2xl border border-dashed border-white/10 bg-white/[0.03] flex items-center justify-center text-center p-8">
                  <div>
                    <h2 className="text-2xl font-bold text-white">No live stream selected</h2>
                    <p className="text-slate-400 mt-2">Start a new live room or pick an active stream from the list.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={handleStartLive} className="glass rounded-[2rem] border-white/5 p-6 space-y-4">
                <h2 className="text-xl font-bold text-white">Go Live</h2>
                <input
                  type="text"
                  placeholder="Live title"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={liveForm.title}
                  onChange={(event) => setLiveForm({ ...liveForm, title: event.target.value })}
                />
                <input
                  type="text"
                  placeholder="Category"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={liveForm.category}
                  onChange={(event) => setLiveForm({ ...liveForm, category: event.target.value })}
                />
                <button
                  type="submit"
                  disabled={starting}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white font-extrabold py-3 rounded-2xl transition-all active:scale-95"
                >
                  {starting ? "Creating Room..." : "Go Live"}
                </button>
              </form>

              <div className="glass rounded-[2rem] border-white/5 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">Live Coins</h2>
                    <p className="text-slate-400 text-sm mt-1">Use coins to send gifts during streams.</p>
                  </div>
                  <p className="text-3xl font-extrabold text-amber-300">{coinBalance}</p>
                </div>
                <button
                  onClick={handleClaimCoins}
                  className="w-full mt-5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold py-3 rounded-2xl transition-all active:scale-95"
                >
                  Claim Daily 100 Coins
                </button>
              </div>
            </div>

            <div className="glass rounded-[2rem] border-white/5 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Active Live Streams</h2>
              {loading ? (
                <p className="text-slate-400">Loading live streams...</p>
              ) : streams.length === 0 ? (
                <p className="text-slate-500 text-sm">No one is live right now.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {streams.map((stream) => (
                    <button
                      key={stream._id}
                      type="button"
                      onClick={() => setSelectedStream(stream)}
                      className={`text-left p-4 rounded-2xl border transition-all ${
                        selectedStream?._id === stream._id
                          ? "bg-primary-500/10 border-primary-500/40"
                          : "bg-white/5 border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <SecureMediaImage
                          source={stream.host?.profilePhotoUrl || stream.host?.profileImage || stream.host?.googlePhoto || stream.host?.image || ""}
                          alt={stream.host?.name || "Host"}
                          className="w-12 h-12 rounded-full border border-white/10"
                          imageClassName="rounded-full"
                          fallbackClassName="rounded-full text-xs font-bold text-primary-200 bg-primary-500/15"
                          signed
                        />
                        <div>
                          <h3 className="text-white font-bold line-clamp-1">{stream.title}</h3>
                          <p className="text-primary-300 text-xs">{stream.host?.name || "Creator"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4 text-xs font-bold text-slate-400">
                        <span>{stream.viewerCount || 0} viewers</span>
                        <span>{stream.totalCoins || 0} coins</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="glass rounded-[2rem] border-white/5 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-white">Live Chat</h2>
                <span className="text-xs font-bold text-slate-500">{messages.length} messages</span>
              </div>
              <div className="h-80 overflow-y-auto space-y-3 pr-1">
                {messages.length === 0 ? (
                  <p className="text-slate-500 text-sm">Chat messages will appear here.</p>
                ) : (
                  messages.map((message) => (
                    <div key={message._id || `${message.createdAt}-${message.name}`} className="bg-white/5 border border-white/5 rounded-2xl p-3">
                      <p className="text-xs font-bold text-primary-300">{message.name}</p>
                      <p className="text-sm text-slate-200 mt-1">{message.message}</p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2 mt-4">
                <input
                  type="text"
                  maxLength={300}
                  placeholder={user ? "Type a live message..." : "Login to chat"}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 text-sm"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                />
                <button
                  type="submit"
                  disabled={sendingChat || !selectedStream}
                  className="bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-bold px-4 py-3 rounded-xl transition-all"
                >
                  Send
                </button>
              </form>
            </div>

            <div className="glass rounded-[2rem] border-white/5 p-6">
              <h2 className="text-xl font-bold text-white mb-4">Gifts / Coins</h2>
              <div className="grid grid-cols-2 gap-3">
                {giftCatalog.map((gift) => (
                  <button
                    key={gift.id}
                    onClick={() => handleSendGift(gift.id)}
                    disabled={sendingGift === gift.id || !selectedStream}
                    className="bg-white/5 hover:bg-amber-400/10 border border-white/10 hover:border-amber-400/30 rounded-2xl p-4 text-left transition-all disabled:opacity-50"
                  >
                    <p className="text-white font-bold">{gift.name}</p>
                    <p className="text-amber-300 text-sm font-bold mt-1">{gift.coins} coins</p>
                  </button>
                ))}
              </div>
              <div className="mt-5 space-y-2">
                {giftFeed.length === 0 ? (
                  <p className="text-slate-500 text-sm">Gift activity will show here.</p>
                ) : (
                  giftFeed.map((gift) => (
                    <div key={gift._id || `${gift.createdAt}-${gift.name}`} className="bg-amber-400/10 border border-amber-400/20 rounded-2xl p-3">
                      <p className="text-sm text-amber-200">
                        <span className="font-bold">{gift.name}</span> sent {gift.giftName} ({gift.coins} coins)
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Live;
