import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useChat } from '../context/ChatContext';
import EmojiPicker from 'emoji-picker-react';
import './Messages.css';

const Messages = () => {
  // ----- Params & Context -----
  const { otherId } = useParams(); // ID of the user we are chatting with
  const { socket } = useChat();

  // ----- State -----
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  // ----- Refs -----
  const messagesEndRef = useRef(null);

  // ----- Helpers -----
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ----- Effects (must be declared before any conditional return) -----
  // Load current user ID (example: from localStorage)
  useEffect(() => {
    const stored = localStorage.getItem('userId');
    if (stored) setCurrentUserId(stored);
  }, []);

  // Join private room when socket & user ID are ready
  useEffect(() => {
    if (socket && currentUserId) {
      socket.emit('join', currentUserId);
    }
  }, [socket, currentUserId]);

  // Fetch chat history whenever IDs are ready
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/chat/messages/${currentUserId}/${otherId}`);
        setMessages(res.data);
      } catch (err) {
        console.error('Failed to fetch messages', err);
      }
    };
    if (currentUserId && otherId) {
      fetchHistory();
    }
  }, [currentUserId, otherId]);

  // Socket listeners (new messages, typing, seen status)
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const handleTyping = ({ sender }) => {
      setTypingUsers((prev) => (!prev.includes(sender) ? [...prev, sender] : prev));
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== sender));
      }, 3000);
    };
    const handleSeen = ({ messageIds }) => {
      setMessages((prev) =>
        prev.map((msg) => (messageIds.includes(msg._id) ? { ...msg, isSeen: true } : msg))
      );
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('messagesSeen', handleSeen);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('typing', handleTyping);
      socket.off('messagesSeen', handleSeen);
    };
  }, [socket]);

  // Emit typing event (debounced)
  useEffect(() => {
    if (!socket) return;
    const timeout = setTimeout(() => {
      if (input.trim()) {
        socket.emit('typing', { sender: currentUserId, recipient: otherId });
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [input, socket, currentUserId, otherId]);

  // Mark unseen messages as seen when they appear
  useEffect(() => {
    if (!socket || !messages.length) return;
    const unseen = messages
      .filter((msg) => msg.recipient === currentUserId && !msg.isSeen)
      .map((msg) => msg._id);
    if (unseen.length) {
      socket.emit('seen', { messageIds: unseen });
    }
  }, [socket, messages, currentUserId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ----- Render loading state if socket not ready -----
  if (!socket) {
    return <div className="chat-loading">Connecting to chat…</div>;
  }

  // ----- Handlers -----
  const sendMessage = async () => {
    if (!socket) return;
    let payload = {};
    if (imageFile) {
      const form = new FormData();
      form.append('image', imageFile);
      try {
        const uploadRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/chat/upload-image`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        payload = {
          sender: currentUserId,
          recipient: otherId,
          messageType: 'image',
          message: uploadRes.data.imageUrl,
        };
      } catch (err) {
        console.error('Image upload failed', err);
        return;
      }
    } else if (input.trim()) {
      payload = {
        sender: currentUserId,
        recipient: otherId,
        messageType: 'text',
        message: input.trim(),
      };
    } else {
      return;
    }
    socket.emit('chatMessage', payload);
    setInput('');
    setImageFile(null);
    setShowEmoji(false);
  };

  const onEmojiClick = (emojiObject, e) => {
    if (emojiObject?.emoji) {
      setInput((prev) => prev + emojiObject.emoji);
    }
  };

  const renderMessage = (msg) => {
    const isMe = msg.sender === currentUserId;
    const containerClass = isMe ? 'msg-bubble me' : 'msg-bubble other';
    return (
      <div key={msg._id} className={containerClass}>
        {msg.messageType === 'image' ? (
          <img src={msg.message} alt="sent" className="sent-image" />
        ) : (
          <span>{msg.message}</span>
        )}
        {isMe && msg.isSeen && <span className="seen-indicator">✓✓</span>}
      </div>
    );
  };

  return (
    <div className="chat-page">
      <div className="chat-header">
        <h2>Chat with {otherId}</h2>
      </div>
      <div className="chat-body">
        {messages.map(renderMessage)}
        {typingUsers.length > 0 && (
          <div className="typing-indicator">{typingUsers[0]} is typing...</div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-footer">
        {showEmoji && (
          <div className="emoji-picker-wrapper">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          id="imageUpload"
          onChange={(e) => setImageFile(e.target.files[0])}
        />
        <button onClick={() => setShowEmoji((prev) => !prev)} className="emoji-btn">😀</button>
        <button onClick={() => document.getElementById('imageUpload').click()} className="image-btn">📷</button>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="message-input"
        />
        <button onClick={sendMessage} className="send-btn">Send</button>
      </div>
    </div>
  );
};

export default Messages;
