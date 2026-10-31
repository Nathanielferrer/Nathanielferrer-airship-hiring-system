import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
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
  timestamp: Date.now(),
  isHistory: false,
};

const QUICK_PROMPTS = [
  { id: 'jobs', icon: 'bx-briefcase-alt-2', label: 'Available Jobs', query: 'What jobs are available?' },
  { id: 'status', icon: 'bx-time-five', label: 'My Application Status', query: 'What is the status of my application?' },
  { id: 'company_bg', icon: 'bx-buildings', label: 'Company Background', query: 'What is the background of the company?' },
  { id: 'office', icon: 'bx-map-pin', label: 'Office & Interview', query: 'Where is your main office located?' }
];

const ChatbotWidget = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(() => {
    return sessionStorage.getItem('airship_chatbot_open') === 'true';
  });
  const [showPopBubble, setShowPopBubble]   = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

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
        const formatted = data.history.map(item => {
          const itemDate = item.created_at ? new Date(item.created_at) : new Date();
          return {
            id:        item.id,
            sender:    item.sender,
            text:      item.message_text,
            time:      itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: itemDate.getTime(),
            isHistory: true,
          };
        });
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

  // ── Copy Message to Clipboard ─────────────────────────────────────────────
  const handleCopy = (id, text) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // ── Unified Send Message Query (Supports form submit & quick chips) ─────────
  const sendMessageQuery = async (queryText) => {
    const trimmed = (queryText !== undefined ? queryText : inputValue).trim();
    if (!trimmed || isTyping || isCooldown) return;

    const now = Date.now();
    const userMessage = {
      id:        now,
      sender:    'user',
      text:      trimmed,
      time:      new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: now,
      isHistory: false,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);
    setIsCooldown(true);
    setTimeout(() => setIsCooldown(false), 2000); // 2-second anti-spam cooldown

    try {
      const userId = getUserId();

      const res  = await fetch(API_QUERY, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: trimmed, user_id: userId }),
      });
      const data = await res.json();

      const botNow = Date.now();
      const botMessage = {
        id:        botNow + 1,
        sender:    'bot',
        status:    data.status || 'match',
        text:      data.response ?? "Sorry, I encountered an issue. Please try again.",
        time:      new Date(botNow).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: botNow,
        isHistory: false,
      };
      setMessages(prev => [...prev, botMessage]);
    } catch {
      const errNow = Date.now();
      const errorMessage = {
        id:        errNow + 1,
        sender:    'bot',
        status:    'error',
        text:      "I am currently unable to process your request. Please wait a moment and try sending your message again. Thank you for your patience.",
        time:      new Date(errNow).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: errNow,
        isHistory: false,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    sendMessageQuery(inputValue);
  };

  // ── Helper to Render Clean Formatted Messages with Bold, Bullets & Nav Links ──
  const renderFormattedMessage = (msg) => {
    const rawText = msg.text || '';
    const isSecurityRefusal = msg.status === 'security_refusal' ||
      rawText.includes('violates our system security guidelines') ||
      rawText.includes('security guidelines') ||
      rawText.includes('Hindi maproseso ang kahilingang ito') ||
      rawText.includes('I am unable to follow those instructions') ||
      rawText.includes('hindi ko maaaring sundin ang tagubiling iyan') ||
      rawText.includes('Paumanhin po, ngunit hindi ko maaaring sundin');
    const isOutOfDomain = msg.status === 'ood' ||
      rawText.includes('I specialize exclusively in Airship Express recruitment') ||
      rawText.includes('Eksklusibo po akong nakatalaga para sa recruitment');
    const isPendingReview = msg.status === 'pending_review';
    const isKnowledgeGap = isPendingReview ||
      rawText.includes('We do not have official guidelines for this inquiry yet') ||
      rawText.includes('Wala pa po kaming opisyal na impormasyon ukol dito') ||
      rawText.includes('logged your question for our') ||
      rawText.includes('naitala ko na po ang inyong katanungan') ||
      rawText.includes('Naitala ko na po ang inyong katanungan') ||
      rawText.includes('This inquiry has already been logged');
    const isError = msg.status === 'error';

    const lower = rawText.toLowerCase();

    // Distinguish "How to Apply" tutorials from actual status lookups
    const isApplyGuide = lower.includes('how to apply') ||
      lower.includes('ready to apply') ||
      lower.includes('here is how to apply') ||
      lower.includes('paano mag-apply') ||
      lower.includes('submit your application') ||
      lower.includes('pre-screening check');

    // Detect greeting messages (initial or subsequent greeting replies in English / Tagalog)
    const isGreeting = 
      msg.id === 'greeting-initial' ||
      lower.includes('welcome to airship express') ||
      lower.includes('airship express ai companion') ||
      lower.includes('ai companion ng airship express') ||
      lower.includes('what would you like to ask') ||
      lower.includes('what would you like to know') ||
      lower.includes('ano ang nais mong malaman');

    // Detect interview process description messages
    const isInterviewProcess =
      lower.includes('interview process') ||
      lower.includes('consists of two stages') ||
      lower.includes('two stages:') ||
      lower.includes('dalawang yugto') ||
      lower.includes('proseso ng interview');

    // Never show navigation buttons on security refusal, OOD, knowledge-gap, system errors, greetings, or interview process messages
    const canShowActions = !isSecurityRefusal && !isOutOfDomain && !isKnowledgeGap && !isError && !isGreeting && !isInterviewProcess && msg.sender === 'bot';

    // Detect if message is informing user that they already applied for this job
    const hasAlreadyAppliedNote =
      lower.includes('you have already submitted an application') ||
      lower.includes('you have already applied') ||
      lower.includes('naipasa mo na ang iyong aplikasyon') ||
      lower.includes('note on your application') ||
      lower.includes('paalala sa iyong aplikasyon');

    // Vacancy action button should show for job queries, application guides, and vacancy mentions (BUT NOT if user already applied)
    const hasVacancyAction = canShowActions && !hasAlreadyAppliedNote && (
      lower.includes('vacanc') || // matches "vacancy", "vacancies"
      lower.includes('job opening') ||
      lower.includes('open position') ||
      lower.includes('available position') ||
      lower.includes('bakanteng') ||
      lower.includes('mag-apply') ||
      isApplyGuide
    );

    // Status action button should appear when checking status or when user already applied for the discussed role,
    // and NEVER on a "How to Apply" guide where the user hasn't submitted yet
    const hasStatusAction = canShowActions && !isApplyGuide && (
      hasAlreadyAppliedNote ||
      lower.includes('track status') ||
      lower.includes('track my application') ||
      lower.includes('check status') ||
      lower.includes('check your application') ||
      lower.includes('status ng iyong aplikasyon') ||
      lower.includes('status of your application') ||
      lower.includes('real-time status') ||
      lower.includes('application status page') ||
      lower.includes('under initial review') ||
      lower.includes('under detailed review') ||
      lower.includes('interview confirmed') ||
      lower.includes('pre-employment phase')
    );

    // About action button should appear when asking about company background or history
    const hasAboutAction = canShowActions && (
      lower.includes('established in 2016') ||
      lower.includes('background of the company') ||
      lower.includes('company background') ||
      lower.includes('about airship express') ||
      lower.includes('tungkol sa airship express') ||
      lower.includes('kasaysayan ng airship')
    );

    const lines = rawText.split('\n');

    return (
      <div className={`chat-bubble-inner ${isSecurityRefusal ? 'is-security-refusal' : ''} ${isOutOfDomain ? 'is-out-of-domain' : ''} ${isPendingReview ? 'is-pending-review' : ''}`}>
        {isSecurityRefusal && (
          <div className="chatbot-security-badge">
            <i className="bx bx-shield-quarter" />
            <span>Security Notice</span>
          </div>
        )}
        {isOutOfDomain && (
          <div className="chatbot-ood-badge">
            <i className="bx bx-error-circle" />
            <span>Out of Scope</span>
          </div>
        )}
        {isPendingReview && (
          <div className="chatbot-pending-badge">
            <i className="bx bx-time-five" />
            <span>Under HR Review</span>
          </div>
        )}

        <div className="chat-message-lines">
          {lines.map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) {
              return <div key={idx} className="chat-empty-line" />;
            }

            const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || /^\d+[\.\)]\s/.test(trimmed);

            // Parse bold markdown **bold**
            const parts = line.split(/(\*\*[^*]+\*\*)/g);
            const content = parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pIdx} className="chat-bold-text">{part.slice(2, -2)}</strong>;
              }
              return part;
            });

            return (
              <p key={idx} className={`chat-message-line ${isBullet ? 'is-bullet-item' : ''}`}>
                {content}
              </p>
            );
          })}
        </div>

        {/* In-Chat Quick Action Navigation Buttons (Only for helpful guidance, never on security refusal) */}
        {canShowActions && (hasVacancyAction || hasStatusAction || hasAboutAction) && (
          <div className="chatbot-action-pills">
            {hasVacancyAction && (
              <button
                type="button"
                className="chatbot-action-pill"
                onClick={() => {
                  navigate('/vacancy');
                }}
                title="Open Vacancy Page"
              >
                <i className="bx bx-briefcase-alt-2" />
                <span>Open Vacancy Page</span>
              </button>
            )}
            {hasStatusAction && (
              <button
                type="button"
                className="chatbot-action-pill"
                onClick={() => {
                  navigate('/application-status');
                }}
                title="View Application Status"
              >
                <i className="bx bx-list-check" />
                <span>View Application Status</span>
              </button>
            )}
            {hasAboutAction && (
              <button
                type="button"
                className="chatbot-action-pill"
                onClick={() => {
                  navigate('/about');
                }}
                title="Learn More About Us"
              >
                <i className="bx bx-buildings" />
                <span>Learn More About Us</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
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

  // ── Timestamp & History Divider Helpers ─────────────────────────────────────
  const formatDividerTime = (msg) => {
    if (!msg) return '';
    if (msg.timestamp) {
      const d = new Date(msg.timestamp);
      if (!isNaN(d.getTime())) {
        const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return timeStr;
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) {
          return `Yesterday, ${timeStr}`;
        }
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
      }
    }
    return msg.time || '';
  };

  const shouldRenderTimeDivider = (currentMsg, prevMsg, index) => {
    if (index === 0) return true;
    if (!prevMsg) return false;
    // Transitioning from loaded history messages to new active conversation
    if (prevMsg.isHistory && !currentMsg.isHistory) return true;
    // Time difference between consecutive messages is >= 20 minutes (1200000ms)
    if (currentMsg.timestamp && prevMsg.timestamp) {
      if (Math.abs(currentMsg.timestamp - prevMsg.timestamp) >= 20 * 60 * 1000) {
        return true;
      }
    }
    return false;
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
          {messages.map((msg, idx) => {
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const showDivider = shouldRenderTimeDivider(msg, prevMsg, idx);
            const dividerText = showDivider ? formatDividerTime(msg) : '';

            return (
              <React.Fragment key={msg.id}>
                {showDivider && dividerText && (
                  <div className="chat-time-divider">
                    <span className="chat-divider-line" />
                    <span className="chat-divider-text">{dividerText}</span>
                    <span className="chat-divider-line" />
                  </div>
                )}
                <div className={`chat-message-row ${msg.sender}`}>
                  <div className="chat-message-bubble">
                    {renderFormattedMessage(msg)}
                    <div className="chat-message-footer">
                      <span className="chat-message-time">{msg.time}</span>
                      {msg.sender === 'bot' && (
                        <button
                          type="button"
                          className="chat-copy-btn"
                          onClick={() => handleCopy(msg.id, msg.text)}
                          title="Copy message"
                          aria-label="Copy message"
                        >
                          <i className={`bx ${copiedId === msg.id ? 'bx-check text-green' : 'bx-copy'}`} />
                          {copiedId === msg.id && <span className="copy-label">Copied</span>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
          {isTyping && <ChatbotLoadingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Action Suggestion Chips for Logged-In Users */}
        {user && !isTyping && (
          <div className="chatbot-quick-chips-wrapper">
            <div className="chatbot-quick-chips">
              {QUICK_PROMPTS.map(chip => (
                <button
                  key={chip.id}
                  type="button"
                  className="chatbot-chip-btn"
                  onClick={() => sendMessageQuery(chip.query)}
                  disabled={isTyping || isCooldown}
                  title={`Ask: "${chip.query}"`}
                >
                  <i className={`bx ${chip.icon}`} />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
            <div className="chatbot-input-wrapper">
              <input
                type="text"
                className="chatbot-input"
                placeholder={isCooldown ? "Please wait a moment..." : "Ask about jobs, status, interviews..."}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                disabled={isTyping || isCooldown}
                maxLength={300}
              />
              {inputValue.length > 0 && (
                <span className={`chatbot-char-counter ${inputValue.length >= 280 ? 'warn' : ''}`}>
                  {inputValue.length}/300
                </span>
              )}
            </div>
            <button
              type="submit"
              className={`chatbot-send-btn ${isCooldown ? 'cooldown' : ''}`}
              disabled={!inputValue.trim() || isTyping || isCooldown}
              title={isCooldown ? "Please wait..." : "Send Message"}
              aria-label="Send Message"
              onMouseDown={(e) => e.preventDefault()}
              onTouchEnd={(e) => {
                if (inputValue.trim() && !isTyping && !isCooldown) {
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
