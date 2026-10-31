import React from 'react';
import ReactDOM from 'react-dom';
import splashVideo from '../../assets/images/Splash_loading_screen.mp4';
import { useTheme } from '../../context/ThemeContext';
import './LoadingScreen.css';

/**
 * Reusable, high-fidelity video loading modal component for long-running system processes.
 * Uses ReactDOM.createPortal to ensure top-level rendering above any drawer/page transforms.
 */
const LoadingScreen = ({
  isOpen,
  title = 'Processing...',
  subtitle = 'Please wait a moment while the system completes your request.',
  videoSrc = splashVideo
}) => {
  const { isDarkMode } = useTheme();

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      className={`video-loading-overlay ${isDarkMode ? 'dark-mode' : ''}`}
      data-theme={isDarkMode ? 'dark' : 'light'}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="video-loading-card">
        {/* Large Prominent Video Container */}
        <div className="video-loading-media-wrapper">
          <video
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="video-loading-media"
          />
        </div>

        {/* Dynamic Contextual Text */}
        <h3 className="video-loading-title">{title}</h3>
        {subtitle && <p className="video-loading-subtitle">{subtitle}</p>}
      </div>
    </div>,
    document.body
  );
};

export default LoadingScreen;
