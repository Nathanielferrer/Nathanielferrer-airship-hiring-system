import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './ChatbotWidget.css';
import assistantVideo from '../../assets/images/AI COMPANION.mp4';
import ChatbotLoadingIndicator from './ChatbotLoadingIndicator';

import { API_BASE_URL } from '../../utils/apiConfig';
const API_QUERY = `${API_BASE_URL}/chatbot/query.php`;
const API_GET_HISTORY = `${API_BASE_URL}/chatbot/get_history.php`;
const API_CLEAR_HISTORY = `${API_BASE_URL}/chatbot/clear_history.php`;

const DEFAULT_GREETING = {
  id: 'greeting-initial',
  sender: 'bot',
  text: 'Hello! 👋 Welcome to Airship Express. I am your AI Companion! I can help you with job openings, requirements, the application process, interview schedules, and more. You can ask me in English or Filipino/Tagalog. What would you like to ask?',
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(() => {
    return sessionStorage.getItem('airship_chatbot_open') === 'true';
  });
  const [showPopBubble, setShowPopBubble]   = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ── Helper to resolve logged-in user ID ─────────────────────────────────────
  const getUserId = () => {
    const savedUser = localStorage.getItem('hiring_user');
    if (!savedUser) return null;
    try {
      const u = JSON.parse(savedUser);
      return u?.id ?? u?.User_ID ?? u?.user_id ?? null;
    } catch (e) {
      return null;
    }
  };

  const getStorageKey = (uid) => {
    const id = uid || getUserId();
    return id ? `airship_chatbot_messages_${id}` : 'airship_chatbot_messages';
  };

  const [messages, setMessages] = useState(() => {
    try {
      const uid = getUserId();
      const saved = sessionStorage.getItem(getStorageKey(uid));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback to default greeting
    }
    return [DEFAULT_GREETING];
  });
  const [inputValue, setInputValue]         = useState('');
  const [isTyping, setIsTyping]             = useState(false);
  const [user, setUser]                     = useState(null);
  const [userName, setUserName]             = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  // ── Sync messages and isOpen state to sessionStorage for cross-page persistence ────
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        const uid = getUserId();
        sessionStorage.setItem(getStorageKey(uid), JSON.stringify(messages));
      }
    } catch (e) {
      // ignore storage quota errors
    }
  }, [messages]);

  useEffect(() => {
    sessionStorage.setItem('airship_chatbot_open', String(isOpen));
  }, [isOpen]);

  // ── Load Chat History from Server ───────────────────────────────────────────
  const loadChatHistory = async (targetUid) => {
    const uid = targetUid || getUserId();
    if (!uid) {
      // Guest: restore guest session or default greeting
      try {
        const saved = sessionStorage.getItem('airship_chatbot_messages');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            return;
          }
        }
      } catch (e) {}
      setMessages([DEFAULT_GREETING]);
      return;
    }

    try {
      const res = await fetch(`${API_GET_HISTORY}?applicant_id=${uid}`);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.history) && data.history.length > 0) {
        const formatted = data.history.map(item => ({
          id:     item.id,
          sender: item.sender,
          text:   item.message_text,
          time:   new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setMessages(formatted);
        try {
          sessionStorage.setItem(getStorageKey(uid), JSON.stringify(formatted));
        } catch (e) {}
      } else {
        setMessages([DEFAULT_GREETING]);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  // ── Parse user and name for personalized floating greeting & auth sync ────────
  useEffect(() => {
    const checkAuthUser = () => {
      const savedUser = localStorage.getItem('hiring_user');
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          setUser(u);
          const name = u.User_Fname || u.first_name || u.User_Name || u.name || '';
          if (name) setUserName(name.trim());
          return u?.id ?? u?.User_ID ?? u?.user_id ?? null;
        } catch { 
          setUser(null);
        }
      } else {
        setUser(null);
        setUserName('');
      }
      return null;
    };

    const initialUid = checkAuthUser();
    loadChatHistory(initialUid);

    const handleAuthLogin = (e) => {
      const u = e?.detail || null;
      const uid = u?.id ?? u?.User_ID ?? u?.user_id ?? checkAuthUser();
      loadChatHistory(uid);
    };

    const handleAuthLogout = () => {
      const currentUid = getUserId();
      if (currentUid) {
        try { sessionStorage.removeItem(`airship_chatbot_messages_${currentUid}`); } catch (e) {}
      }
      try {
        sessionStorage.removeItem('airship_chatbot_messages');
        sessionStorage.removeItem('airship_chatbot_open');
      } catch (e) {}
      setUser(null);
      setUserName('');
      setMessages([DEFAULT_GREETING]);
      setIsOpen(false);
      setShowPopBubble(false);
      setInputValue('');
    };

    window.addEventListener('auth_login', handleAuthLogin);
    window.addEventListener('auth_logout', handleAuthLogout);
    window.addEventListener('storage', () => {
      const uid = checkAuthUser();
      loadChatHistory(uid);
    });

    return () => {
      window.removeEventListener('auth_login', handleAuthLogin);
      window.removeEventListener('auth_logout', handleAuthLogout);
      window.removeEventListener('storage', checkAuthUser);
    };
  }, []);

  // ── Show floating speech bubble pop-up ONLY ONCE when user just logged in ────
  useEffect(() => {
    const isJustLoggedIn = sessionStorage.getItem('just_logged_in') === 'true';
    if (isJustLoggedIn && !isOpen) {
      const timer = setTimeout(() => {
        setShowPopBubble(true);
        sessionStorage.removeItem('just_logged_in');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isTyping]);

  const handleToggle = () => {
    if (!isOpen) {
      setShowPopBubble(false);
    }
    setIsOpen(!isOpen);
  };

  const handleOpenFromBubble = () => {
    setIsOpen(true);
    setShowPopBubble(false);
  };

  const handleDismissBubble = (e) => {
    e.stopPropagation();
    setShowPopBubble(false);
  };

  // ── Send Message ────────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMessage = {
      id:     Date.now(),
      sender: 'user',
      text:   inputValue.trim(),
      time:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    const query = inputValue.trim();
    setInputValue('');
    setIsTyping(true);

    try {
      const userId = getUserId();

      const res  = await fetch(API_QUERY, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: query, user_id: userId }),
      });
      const data = await res.json();

      const botMessage = {
        id:     Date.now() + 1,
        sender: 'bot',
        text:   data.response ?? "Sorry, I encountered an issue. Please try again.",
        time:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, botMessage]);
    } catch {
      const errorMessage = {
        id:     Date.now() + 1,
        sender: 'bot',
        text:   "I am currently unable to process your request. Please wait a moment and try sending your message again. Thank you for your patience.",
        time:   new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // ── Trigger Delete Confirmation Modal ───────────────────────────────────────
  const handleClearHistory = () => {
    setShowConfirmModal(true);
  };

  // ── Confirm Delete Action ────────────────────────────────────────────────────
  const handleConfirmClearHistory = async () => {
    setShowConfirmModal(false);
    const userId = getUserId();

    if (userId) {
      try {
        await fetch(API_CLEAR_HISTORY, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ applicant_id: userId }),
        });
      } catch (err) {
        console.error('Failed to clear server chat history:', err);
      }
    }

    try {
      if (userId) {
        sessionStorage.removeItem(`airship_chatbot_messages_${userId}`);
      }
      sessionStorage.removeItem('airship_chatbot_messages');
    } catch (e) {}

    setMessages([DEFAULT_GREETING]);
  };

  const bubbleText = userName
    ? `Welcome, ${userName}! 👋 Need help? Just ask me!`
    : `Welcome! 👋 Need help? Just ask me!`;

  return ReactDOM.createPortal(
    <div className={`chatbot-container ${isOpen ? 'active' : ''}`}>
      {/* Personalized Floating Speech Bubble above avatar head */}
      {!isOpen && showPopBubble && (
        <div className="chatbot-pop-bubble" onClick={handleOpenFromBubble}>
          <span>{bubbleText}</span>
          <button className="pop-bubble-close" onClick={handleDismissBubble} title="Dismiss">×</button>
        </div>
      )}

      {/* 1. Floating Trigger Button with Silent Video Avatar */}
      <button
        className="chatbot-float-widget"
        onClick={handleToggle}
        title={isOpen ? 'Close Chat' : 'Ask AI Companion'}
        aria-label="Toggle chat widget"
      >
        {isOpen ? (
          <i className="bx bx-x chatbot-close-icon" />
        ) : (
          <video
            src={assistantVideo}
            autoPlay
            muted
            playsInline
            className="chatbot-float-video"
          />
        )}
      </button>

      {/* 2. Expanded Chat Popup Window */}
      <div className="chatbot-window">
        {/* Header with Video Avatar */}
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <div className="chatbot-avatar">
              <video
                src={assistantVideo}
                autoPlay
                muted
                playsInline
                className="chatbot-avatar-video"
              />
              <span className="chatbot-status-indicator" />
            </div>
            <div>
              <h4 className="chatbot-title">AI Companion</h4>
              <p className="chatbot-subtitle">Online • Support Bot</p>
            </div>
          </div>
          <button
            type="button"
            className="chatbot-close-btn"
            onClick={handleToggle}
            title="Close Chat"
            aria-label="Close Chat"
          >
            <i className="bx bx-x" style={{ fontSize: '24px' }} />
          </button>
        </div>

        {/* Conversation History */}
        <div className="chatbot-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message-row ${msg.sender}`}>
              <div className="chat-message-bubble">
                <p className="chat-message-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                <span className="chat-message-time">{msg.time}</span>
              </div>
            </div>
          ))}
          {isTyping && <ChatbotLoadingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area: Hard Gate for Guest, Active Form for Logged-In */}
        {!user ? (
          <div className="chatbot-gate-container">
            <div className="chatbot-gate-content">
              <i className="bx bx-lock-alt chatbot-gate-icon" />
              <span className="chatbot-gate-text">Sign in to chat with our AI Companion.</span>
            </div>
            <div className="chatbot-gate-actions">
              <a href="/login" className="chatbot-gate-btn chatbot-gate-login">
                Log In
              </a>
              <a href="/register" className="chatbot-gate-btn chatbot-gate-signup">
                Sign Up
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="chatbot-input-form">
            <button
              type="button"
              className="chatbot-clear-btn"
              onClick={handleClearHistory}
              title="Clear Conversation History"
              aria-label="Clear Conversation History"
            >
              <i className="bx bx-trash chatbot-clear-icon" />
            </button>
            <input
              type="text"
              className="chatbot-input"
              placeholder="Ask about jobs, status, interviews..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              disabled={isTyping}
              maxLength={300}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={!inputValue.trim() || isTyping}
              title="Send Message"
              aria-label="Send Message"
              onMouseDown={(e) => e.preventDefault()}
              onTouchEnd={(e) => {
                if (inputValue.trim() && !isTyping) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            >
              <i className="bx bxs-send chatbot-send-icon" />
            </button>
          </form>
        )}
      </div>

      {/* 3. Centered Delete Confirmation Modal */}
      {showConfirmModal && (
        <div className="chatbot-confirm-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="chatbot-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              <i className="bx bx-trash confirm-modal-trash-icon" />
            </div>
            <h3 className="confirm-modal-title">Clear Chat History?</h3>
            <p className="confirm-modal-desc">
              Are you sure you want to clear your conversation history with <strong>AI Companion</strong>? This action cannot be undone.
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="confirm-btn-cancel"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-btn-delete"
                onClick={handleConfirmClearHistory}
              >
                Yes, Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default ChatbotWidget;
