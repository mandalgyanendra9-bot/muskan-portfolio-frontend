import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import { ChatProvider, useChat } from "../context/ChatContext";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import Navbar from "../components/Navbar";
import "./Messages.css";

const API_URL = import.meta.env.VITE_API_URL || "https://muskan-portfolio-backend.onrender.com";

const getAuthHeaders = (extra = {}) => {
  const token = localStorage.getItem("token");
  return token ? { ...extra, Authorization: token } : extra;
};

const idOf = (value) => {
  if (!value) return "";
  if (value._id) return String(value._id);
  return String(value);
};

const getAssetUrl = (path) => {
  if (!path) return "";
  return path.startsWith("http") ? path : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

const MessagesContent = () => {
  const { otherId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useChat();
  const currentUserId = user?._id;

  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedUserId = otherId || contacts[0]?._id || "";

  const selectedContact = useMemo(
    () => contacts.find((contact) => idOf(contact._id) === selectedUserId),
    [contacts, selectedUserId]
  );

  const appendMessage = (message) => {
    setMessages((prev) => {
      if (prev.some((item) => idOf(item._id) === idOf(message._id))) return prev;
      return [...prev, message];
    });
  };

  useEffect(() => {
    const fetchContacts = async () => {
      setLoadingContacts(true);
      try {
        const res = await API.get("/chat/contacts", { headers: getAuthHeaders() });
        setContacts(res.data || []);
      } catch (error) {
        console.error("Failed to fetch contacts", error);
      } finally {
        setLoadingContacts(false);
      }
    };

    if (currentUserId) fetchContacts();
  }, [currentUserId]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUserId || !selectedUserId) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      try {
        const res = await API.get(`/chat/messages/${currentUserId}/${selectedUserId}`, {
          headers: getAuthHeaders(),
        });
        setMessages(res.data || []);
      } catch (error) {
        console.error("Failed to fetch messages", error);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchHistory();
  }, [currentUserId, selectedUserId]);

  useEffect(() => {
    if (!socket || !currentUserId) return undefined;
    socket.emit("join", currentUserId);

    const handleNewMessage = (message) => {
      const senderId = idOf(message.sender);
      const recipientId = idOf(message.recipient);
      const belongsToOpenChat =
        selectedUserId &&
        ((senderId === currentUserId && recipientId === selectedUserId) ||
          (senderId === selectedUserId && recipientId === currentUserId));

      setContacts((prev) => {
        const otherUser = senderId === currentUserId ? message.recipient : message.sender;
        if (!otherUser?._id || prev.some((contact) => idOf(contact._id) === idOf(otherUser._id))) return prev;
        return [otherUser, ...prev];
      });

      if (belongsToOpenChat) appendMessage(message);
    };

    const handleTyping = ({ sender }) => {
      if (!sender || sender !== selectedUserId) return;
      setTypingUsers((prev) => (!prev.includes(sender) ? [...prev, sender] : prev));
      window.setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== sender));
      }, 2200);
    };

    const handleSeen = ({ messageIds }) => {
      setMessages((prev) =>
        prev.map((message) => (messageIds.includes(idOf(message._id)) ? { ...message, isSeen: true } : message))
      );
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("messagesSeen", handleSeen);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("messagesSeen", handleSeen);
    };
  }, [socket, currentUserId, selectedUserId]);

  useEffect(() => {
    if (!currentUserId || !messages.length) return;
    const unseen = messages
      .filter((message) => idOf(message.recipient) === currentUserId && !message.isSeen)
      .map((message) => idOf(message._id));

    if (!unseen.length) return;

    API.post("/chat/seen", { messageIds: unseen }, { headers: getAuthHeaders() }).catch(() => {});
    socket?.emit("seen", { messageIds: unseen });
  }, [messages, currentUserId, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  useEffect(() => {
    if (!socket || !input.trim() || !selectedUserId || !currentUserId) return undefined;
    const timeoutId = window.setTimeout(() => {
      socket.emit("typing", { sender: currentUserId, recipient: selectedUserId });
    }, 450);
    return () => window.clearTimeout(timeoutId);
  }, [input, socket, currentUserId, selectedUserId]);

  const handleSelectContact = (contactId) => {
    navigate(`/messages/${contactId}`, { replace: false });
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async () => {
    if (!selectedUserId || sending) return;
    const text = input.trim();
    if (!text && !imageFile) return;

    setSending(true);
    try {
      let payload;

      if (imageFile) {
        const form = new FormData();
        form.append("image", imageFile);
        const uploadRes = await API.post("/chat/upload-image", form, {
          headers: getAuthHeaders({ "Content-Type": "multipart/form-data" }),
        });
        payload = {
          recipient: selectedUserId,
          messageType: "image",
          message: uploadRes.data.imageUrl || uploadRes.data.url,
        };
      } else {
        payload = {
          recipient: selectedUserId,
          messageType: "text",
          message: text,
        };
      }

      const res = await API.post("/chat/messages", payload, { headers: getAuthHeaders() });
      appendMessage(res.data);
      setInput("");
      setShowEmoji(false);
      clearImage();
    } catch (error) {
      console.error("Message send failed", error);
      alert(error.response?.data?.message || "Message send failed. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (message) => {
    const isMe = idOf(message.sender) === currentUserId;
    return (
      <div key={idOf(message._id)} className={`msg-row ${isMe ? "me" : "other"}`}>
        <div className={`msg-bubble ${isMe ? "me" : "other"}`}>
          {message.messageType === "image" ? (
            <img src={getAssetUrl(message.message)} alt="Sent attachment" className="sent-image" loading="lazy" decoding="async" />
          ) : (
            <span>{message.message}</span>
          )}
          {isMe && message.isSeen ? <span className="seen-indicator">Seen</span> : null}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-surface text-white">
      <Navbar />
      <main className="messages-shell">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Messages</h2>
            <p>{loadingContacts ? "Loading contacts..." : `${contacts.length} contacts`}</p>
          </div>
          <div className="chat-contact-list">
            {contacts.map((contact) => {
              const contactId = idOf(contact._id);
              const active = contactId === selectedUserId;
              return (
                <button
                  type="button"
                  key={contactId}
                  onClick={() => handleSelectContact(contactId)}
                  className={`chat-contact ${active ? "active" : ""}`}
                >
                  <div className="contact-avatar">
                    {contact.profileImage ? (
                      <img src={getAssetUrl(contact.profileImage)} alt={contact.name || "User"} loading="lazy" decoding="async" />
                    ) : (
                      <span>{(contact.name || "U").charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <strong>{contact.name || "Unknown User"}</strong>
                    <span>{contact.title || contact.role || contact.email}</span>
                  </div>
                </button>
              );
            })}
            {!loadingContacts && contacts.length === 0 ? (
              <div className="chat-empty small">No contacts found yet.</div>
            ) : null}
          </div>
        </aside>

        <section className="chat-panel">
          <div className="chat-header">
            {selectedContact ? (
              <>
                <h2>{selectedContact.name || "Chat"}</h2>
                <p>{selectedContact.title || selectedContact.email || "Direct message"}</p>
              </>
            ) : (
              <>
                <h2>Select a conversation</h2>
                <p>Choose a contact to send text, emoji, and photo messages.</p>
              </>
            )}
          </div>

          <div className="chat-body">
            {loadingMessages ? (
              <div className="chat-empty">Loading messages...</div>
            ) : messages.length ? (
              messages.map(renderMessage)
            ) : (
              <div className="chat-empty">
                {selectedUserId ? "No messages yet. Start the conversation." : "No conversation selected."}
              </div>
            )}
            {typingUsers.length > 0 ? <div className="typing-indicator">Typing...</div> : null}
            <div ref={messagesEndRef} />
          </div>

          {imagePreview ? (
            <div className="image-preview">
              <img src={imagePreview} alt="Selected upload" loading="eager" decoding="async" />
              <span>{imageFile?.name}</span>
              <button type="button" onClick={clearImage}>Remove</button>
            </div>
          ) : null}

          <div className="chat-footer">
            {showEmoji ? (
              <div className="emoji-picker-wrapper">
                <EmojiPicker onEmojiClick={(emojiObject) => setInput((prev) => prev + (emojiObject?.emoji || ""))} />
              </div>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden-file"
              onChange={handleFileChange}
            />
            <button type="button" onClick={() => setShowEmoji((prev) => !prev)} className="emoji-btn" disabled={!selectedUserId}>
              Emoji
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="image-btn" disabled={!selectedUserId}>
              Photo
            </button>
            <input
              type="text"
              placeholder={selectedUserId ? "Type a message..." : "Select a contact first"}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
              className="message-input"
              disabled={!selectedUserId || sending}
            />
            <button type="button" onClick={sendMessage} className="send-btn" disabled={!selectedUserId || sending || (!input.trim() && !imageFile)}>
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

const Messages = () => (
  <ChatProvider>
    <MessagesContent />
  </ChatProvider>
);

export default Messages;
