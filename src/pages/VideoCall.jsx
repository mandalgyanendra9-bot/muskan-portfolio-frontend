import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import toast from "react-hot-toast";

const VideoCall = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const meetingContainerRef = useRef(null);

  useEffect(() => {
    const initMeeting = async () => {
      try {
        // App ID must be a number. Use fallback for local/dev if not set.
        const appID = Number(import.meta.env.VITE_ZEGO_APP_ID) || 1618361093; // Generous default public ID for test
        const serverSecret = import.meta.env.VITE_ZEGO_SERVER_SECRET || "87245bdcc3539e0839e44ffc91bbfcb2"; 

        if (!import.meta.env.VITE_ZEGO_APP_ID) {
          toast("Running in Demo Mode. Set VITE_ZEGO_APP_ID in .env for production.", { icon: "ℹ️" });
        }

        // Generate Kit Token
        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          roomId,
          user?._id || Date.now().toString(),
          user?.name || "Anonymous User"
        );

        // Create instance
        const zp = ZegoUIKitPrebuilt.create(kitToken);

        // Join Room
        zp.joinRoom({
          container: meetingContainerRef.current,
          sharedLinks: [
            {
              name: "Copy Meeting Link",
              url: window.location.origin + `/video-call/${roomId}`,
            },
          ],
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall, // Set 1-on-1 Call mode
          },
          showScreenSharingButton: true,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showTextChat: true,
          showUserList: false,
          maxUsers: 2,
          layout: "Auto",
          onLeaveRoom: () => {
            toast.success("You left the meeting");
            navigate("/dashboard");
          },
        });
      } catch (error) {
        console.error("ZegoCloud Initialization Error:", error);
        toast.error("Failed to start video call. Check console for details.");
      }
    };

    if (meetingContainerRef.current) {
      initMeeting();
    }
  }, [roomId, user, navigate]);

  return (
    <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      {/* Top Bar */}
      <div className="w-full bg-slate-900 border-b border-white/5 py-3 px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
          <span className="font-mono text-sm tracking-wider text-slate-400">SECURE MEETING ROOM: {roomId}</span>
        </div>
        <button 
          onClick={() => navigate("/dashboard")}
          className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 px-4 py-1.5 rounded-full border border-red-500/20"
        >
          Exit Room
        </button>
      </div>

      {/* Video Call Container */}
      <div 
        ref={meetingContainerRef} 
        className="flex-grow w-full h-full relative"
        style={{ width: '100vw', height: 'calc(100vh - 60px)' }}
      />
    </div>
  );
};

export default VideoCall;
