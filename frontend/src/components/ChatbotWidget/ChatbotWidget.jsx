import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import './ChatbotWidget.css';
import assistantVideo from '../../assets/images/AI COMPANION.mp4';

const API_QUERY = 'http://localhost/Hiring%20System/backend/chatbot/query.php';
const API_GET_HISTORY = 'http://localhost/Hiring%20System/backend/chatbot/get_history.php';
const API_CLEAR_HISTORY = 'http://localhost/Hiring%20System/backend/chatbot/clear_history.php';

const DEFAULT_GREETING = {
  id: 'greeting-initial',
  sender: 'bot',
  text: 'Hello! 👋 Welcome to Airship Express. I am your AI Companion! I can help you with job openings, requirements, the application process, interview schedules, and more. What would you like to ask?',
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

const ChatbotWidget = () => {
  const [isOpen, setIsOpen]                 = useState(false);
  const [showPopBubble, setShowPopBubble]   = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [messages, setMessages]             = useState([DEFAULT_GREETING]);
  const [inputValue, setInputValue]         = useState('');
  const [isTyping, setIsTyping]             = useState(false);
  const [userName, setUserName]             = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

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

  // ── Parse user name for personalized floating greeting ─────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem('hiring_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        const name = u.User_Fname || u.first_name || u.User_Name || u.name || '';
        if (name) setUserName(name.trim());
      } catch (e) { /* ignore */ }
    }
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

  // ── Fetch Chat History for Logged-in User ─────────────────────────────────
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    const loadChatHistory = async () => {
      try {
        const res  = await fetch(`${API_GET_HISTORY}?applicant_id=${userId}`);
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.history) && data.history.length > 0) {
          const formatted = data.history.map(item => ({
            id:     item.id,
            sender: item.sender,
            text:   item.message_text,
            time:   new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }));
          setMessages(formatted);
        } else {
          setMessages([DEFAULT_GREETING]);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
    };

    loadChatHistory();
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
    e.preventDefault();
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
        text:   "I'm having trouble connecting right now. Please try again shortly.",
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="chatbot-icon-svg close-icon">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
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
              <span className="chatbot-status-indicator"></span>
            </div>
            <div>
              <h4 className="chatbot-title">AI Companion</h4>
              <p className="chatbot-subtitle">Online • Support Bot</p>
            </div>
          </div>
        </div>

        {/* Conversation History */}
        <div className="chatbot-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message-row ${msg.sender}`}>
              <div className="chat-message-bubble">
                {msg.sender === 'bot' ? (
                  <p className="chat-message-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                ) : (
                  <p className="chat-message-text">{msg.text}</p>
                )}
                <span className="chat-message-time">{msg.time}</span>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="chat-message-row bot typing">
              <div className="chat-message-bubble typing-bubble">
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form: [Trash Icon] | [Text Input Area] | [Send Button] */}
        <form onSubmit={handleSend} className="chatbot-input-form">
          <button
            type="button"
            className="chatbot-clear-btn"
            onClick={handleClearHistory}
            title="Clear Conversation History"
            aria-label="Clear Conversation History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="clear-btn-svg">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
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
          <button type="submit" className="chatbot-send-btn" disabled={!inputValue.trim() || isTyping}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="send-btn-svg">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>

      {/* 3. Centered Delete Confirmation Modal */}
      {showConfirmModal && (
        <div className="chatbot-confirm-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="chatbot-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
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
