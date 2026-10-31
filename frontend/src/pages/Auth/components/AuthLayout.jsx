import React from 'react';
import { Link } from 'react-router-dom';
import bgImage from '../../../assets/images/Background_Login.webp';
import onlyLogoImg from '../../../assets/images/only_logo.webp';
import SquishSwitch from '../../../components/SquishSwitch/SquishSwitch';
import { useTheme } from '../../../context/ThemeContext';
import './AuthLayout.css';

/**
 * Shared Split-Screen Authentication Layout
 * Applied consistently to Login, Register, Forgot Password, and Reset Password pages.
 */
const AuthLayout = ({ children, isScrollable = false, showExplore = true }) => {
  const { isDarkMode, setIsDarkMode } = useTheme();

  return (
    <div className="auth-split-wrapper">
      {/* Left Section: Promotional Branding & Atmosphere (Approx 63%) */}
      <section
        className="auth-promo-panel"
        style={{ backgroundImage: `url(${bgImage})` }}
        aria-label="Airship Express Welcome"
      >
        {/* Dark Purple & Magenta Gradient Overlay for Text Readability */}
        <div className="auth-promo-overlay" />

        {/* Top-Left Official Logo Branding */}
        <header className="auth-promo-header">
          <div className="auth-promo-brand">
            <img
              src={onlyLogoImg}
              alt="Airship Express Logo"
              className="auth-promo-logo"
              decoding="async"
              width="48"
              height="48"
            />
            <div className="auth-brand-text">
              <div className="auth-brand-main">
                <span className="auth-brand-airship">AIRSHIP</span>
                <span className="auth-brand-express">EXPRESS</span>
              </div>
              <div className="auth-brand-sub">HIRING SYSTEM</div>
            </div>
          </div>
        </header>

        {/* Main Hero Headline & Description (Vertically centered in left panel) */}
        <div className="auth-promo-body">
          <h1 className="auth-promo-heading">
            Your Next Career<br />
            <span className="auth-promo-heading-highlight">Starts Here.</span>
          </h1>
          <p className="auth-promo-desc">
            Discover exciting career opportunities, submit your application, and track your hiring progress with Airship Express.
          </p>
          {/* Explore Opportunities Link directing to job vacancies (hidden when showExplore is false) */}
          {showExplore && (
            <Link to="/vacancy" className="auth-explore-link">
              Explore Opportunities <i className="bx bx-right-arrow-alt auth-explore-arrow" />
            </Link>
          )}
        </div>

        {/* Three Feature Highlights with Icons Centered at the Bottom */}
        <footer className="auth-promo-footer">
          <div className="auth-promo-features">
            <div className="auth-feature-item">
              <div className="auth-feature-icon-circle" aria-hidden="true">
                <i className="bx bx-briefcase-alt-2" />
              </div>
              <div className="auth-feature-info">
                <span className="auth-feature-title">Real Opportunities</span>
                <span className="auth-feature-desc">Find the right role for you.</span>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon-circle" aria-hidden="true">
                <i className="bx bx-time-five" />
              </div>
              <div className="auth-feature-info">
                <span className="auth-feature-title">Easy Tracking</span>
                <span className="auth-feature-desc">Stay updated, always.</span>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon-circle" aria-hidden="true">
                <i className="bx bx-user-check" />
              </div>
              <div className="auth-feature-info">
                <span className="auth-feature-title">Build Your Future</span>
                <span className="auth-feature-desc">Grow with Airship Express.</span>
              </div>
            </div>
          </div>
        </footer>
      </section>

      {/* Right Section: Modern Clean Form Interface (Approx 37%) */}
      <main className="auth-form-panel">
        {/* Dark Mode Toggle */}
        <div className="auth-theme-toggle-wrap" title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          <SquishSwitch
            checked={isDarkMode}
            onChange={setIsDarkMode}
            trackColor="#27272a"
            trackOnColor="#f5f5f5"
            width={48}
            height={26}
            radius={13}
            speed={50}
            stretch={20}
            hoverScale={1.035}
            colorDuration={320}
            disabled={false}
            thumbColor="#4e4e51"
            thumbOnColor="#27272a"
            ariaLabel="Dark mode switch"
          />
        </div>

        {/* Form Body Container */}
        <div className={`auth-form-container ${isScrollable ? 'is-scrollable' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
