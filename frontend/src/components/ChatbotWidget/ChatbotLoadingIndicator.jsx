import React, { useState, useEffect } from 'react';
import './ChatbotWidget.css';

/**
 * Exact steps sequence required for chatbot processing.
 */
const LOADING_STEPS = [
  'Processing request...',
  'Searching...',
  'Generating response...'
];

/**
 * Dynamic Loading Indicator Component for React-based Chatbot.
 * - Cycles through 3 states every 2 seconds.
 * - Stops on final message without looping.
 * - Smooth fade transition between text steps.
 */
const ChatbotLoadingIndicator = () => {
  const [stepIndex, setStepIndex] = useState(0);
  const [fadeState, setFadeState] = useState('fade-in');

  useEffect(() => {
    // Stop on the final message ("Generating response...") and do not loop back
    if (stepIndex >= LOADING_STEPS.length - 1) {
      return;
    }

    // Trigger next step every 2 seconds (2000ms) with a smooth fade transition
    const stepTimeout = setTimeout(() => {
      setFadeState('fade-out');

      const transitionTimeout = setTimeout(() => {
        setStepIndex(prev => {
          const nextIndex = prev + 1;
          return nextIndex < LOADING_STEPS.length ? nextIndex : prev;
        });
        setFadeState('fade-in');
      }, 220); // Duration matches CSS transition

      return () => clearTimeout(transitionTimeout);
    }, 2000);

    return () => clearTimeout(stepTimeout);
  }, [stepIndex]);

  return (
    <div className="chat-message-row bot typing">
      <div className="chat-message-bubble chatbot-loading-bubble">
        <div className="chatbot-loading-content">
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
          <span className={`chatbot-loading-text ${fadeState}`}>
            {LOADING_STEPS[stepIndex]}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatbotLoadingIndicator;
