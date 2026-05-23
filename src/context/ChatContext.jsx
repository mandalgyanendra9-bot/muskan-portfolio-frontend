import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_API_URL, {
      withCredentials: true,
      transports: ['websocket'],
    });
    setSocket(newSocket);

    // Load initial unread count
    const userId = localStorage.getItem('userId');
    if (userId) {
      axios.get(`${import.meta.env.VITE_API_URL}/api/chat/unread/${userId}`)
        .then(res => setUnreadCount(res.data.unread || 0))
        .catch(err => console.error('Failed to fetch unread count', err));
    }

    // Listen for unread updates
    newSocket.on('unreadUpdate', data => {
      if (data && typeof data.unread === 'number') {
        setUnreadCount(data.unread);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);
+
+  // Join a chat room for a specific booking
+  const joinRoom = (bookingId, userId) => {
+    if (socket) {
+      socket.emit('joinRoom', { bookingId, userId });
+    }
+  };
+
+  // Send a chat message within a booking room
+  const sendMessage = (bookingId, payload) => {
+    if (socket) {
+      socket.emit('sendMessage', { bookingId, ...payload });
+    }
+  };

  return (
    <ChatContext.Provider value={{ socket, joinRoom, sendMessage, unreadCount }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);


