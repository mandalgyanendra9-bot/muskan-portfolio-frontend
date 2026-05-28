/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import { useAuth } from "./AuthContext";

const ChatContext = createContext();
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: token } : {};
};

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?._id || !API_URL) {
      return undefined;
    }

    const token = localStorage.getItem("token");
    const newSocket = io(API_URL, {
      auth: { token },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    const socketInitTimer = window.setTimeout(() => {
      setSocket(newSocket);
    }, 0);
    newSocket.emit("join", user._id);

    axios
      .get(`${API_URL}/api/chat/unread/${user._id}`, { headers: getAuthHeaders() })
      .then((res) => setUnreadCount(res.data.unread ?? res.data.unreadCount ?? 0))
      .catch((err) => console.error("Failed to fetch unread count", err));

    newSocket.on("connect", () => {
      newSocket.emit("join", user._id);
    });

    newSocket.on("unreadUpdate", (data) => {
      if (data && typeof data.unread === "number") {
        setUnreadCount(data.unread);
      }
    });

    return () => {
      window.clearTimeout(socketInitTimer);
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user?._id]);

  const joinRoom = (bookingId, userId = user?._id) => {
    if (socket && bookingId && userId) {
      socket.emit("joinRoom", { bookingId, userId });
    }
  };

  const sendMessage = (bookingId, payload) => {
    if (socket && bookingId) {
      socket.emit("sendMessage", { bookingId, ...payload });
    }
  };

  return (
    <ChatContext.Provider value={{ socket, joinRoom, sendMessage, unreadCount, setUnreadCount }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
