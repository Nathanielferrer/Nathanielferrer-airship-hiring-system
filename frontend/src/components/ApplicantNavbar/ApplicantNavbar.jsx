import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import logoImg from '../../assets/images/Logo Airship Express.png';
import './ApplicantNavbar.css';

/**
 * Universal applicant-facing navbar used across ApplicantDashboard, Vacancy, About, and ApplicationStatus.
 *
 * Props:
 *   user                  - logged-in user object (or null if guest)
 *   activePage            - 'home' | 'vacancy' | 'about' | 'status'
 *   notifications         - array of notification objects (optional)
 *   showNotifications     - boolean (optional)
 *   setShowNotifications  - setter (optional)
 *   showProfileMenu       - boolean (optional)
 *   setShowProfileMenu    - setter (optional)
 *   handleNotificationClick - (notif) => void (optional)
 *   handleClearReadNotifications - () => void (optional)
 *   handleMarkAllAsRead   - () => void (optional)
 *   handleLogout          - () => void (optional)
 *   notifRef              - ref for notification dropdown (optional)
 *   dropdownRef           - ref for profile dropdown wrapper (optional)
 */
const ApplicantNavbar = ({
  user,
  activePage = 'home',
  notifications = [],
  showNotifications = false,
  setShowNotifications = () => {},
  showProfileMenu = false,
  setShowProfileMenu = () => {},
  handleNotificationClick = () => {},
  handleClearReadNotifications = () => {},
  handleMarkAllAsRead = () => {},
  handleLogout = () => {},
  notifRef,
  dropdownRef,
}) => {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const unreadCount = (notifications || []).filter(n => !n.is_read).length;

  const navLinksRef = useRef({});
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });

  useEffect(() => {
    const updateIndicator = () => {
      const currentEl = navLinksRef.current[activePage];
      if (currentEl) {
        setIndicatorStyle({
          left: currentEl.offsetLeft,
          width: currentEl.offsetWidth,
          opacity: 1,
        });
      } else {
        setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
      }
    };

    updateIndicator();
    const handleResize = () => {
      updateIndicator();
      if (window.innerWidth > 768) {
        setShowMobileMenu(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activePage]);

  const handleNav = (path) => {
    setShowMobileMenu(false);
    navigate(path);
  };

  // Resolve active user: use prop if valid, fallback synchronously to localStorage to prevent guest flash on fast page navigation
  const activeUser = user !== undefined && user !== null ? user : (() => {
    try {
      const saved = localStorage.getItem('hiring_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const getHomePath = () => {
    if (!activeUser) return '/';
    return activeUser.is_admin > 0 ? '/admin-dashboard' : '/';
  };

  return (
    <header className="dashboard-navbar">
      {/* Brand */}
      <div className="dashboard-navbar-left" onClick={() => handleNav(getHomePath())}>
        <img src={logoImg} alt="Airship Express Logo" className="dashboard-navbar-logo-img" />
        <div className="dashboard-navbar-brand-text">
          <span className="brand-name">AIRSHIP EXPRESS</span>
          <span className="brand-platform">Hiring Platform</span>
        </div>
      </div>

      {/* Center Nav links with Animated Sliding Underline */}
      <nav className="dashboard-navbar-nav-wrapper">
        <ul className="dashboard-navbar-nav">
          <li>
            <span
              ref={el => { navLinksRef.current['home'] = el; }}
              className={`nav-link-item ${activePage === 'home' ? 'active' : ''}`}
              onClick={() => handleNav(getHomePath())}
            >
              Home
            </span>
          </li>
          <li>
            <span
              ref={el => { navLinksRef.current['vacancy'] = el; }}
              className={`nav-link-item ${activePage === 'vacancy' ? 'active' : ''}`}
              onClick={() => handleNav('/vacancy')}
            >
              Vacancy
            </span>
          </li>
          <li>
            <span
              ref={el => { navLinksRef.current['about'] = el; }}
              className={`nav-link-item ${activePage === 'about' ? 'active' : ''}`}
              onClick={() => handleNav('/about')}
            >
              About
            </span>
          </li>
          <li>
            <span
              ref={el => { navLinksRef.current['status'] = el; }}
              className={`nav-link-item ${activePage === 'status' ? 'active' : ''}`}
              onClick={() => {
                if (activeUser) {
                  handleNav('/application-status');
                } else {
                  setShowGuestModal(true);
                }
              }}
            >
              Application Status
            </span>
          </li>
        </ul>
        <span
          className="nav-sliding-indicator"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: `${indicatorStyle.width}px`,
            opacity: indicatorStyle.opacity,
          }}
        />
      </nav>

      {/* Right side: notifications + profile or sign in + mobile burger */}
      <div className="dashboard-navbar-right" ref={dropdownRef}>
        {activeUser ? (
          <>
            {/* Notification Bell */}
            <div className="navbar-notif-wrapper" ref={notifRef}>
              <button
                className="notification-bell-btn"
                aria-label="Notifications"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                  setShowMobileMenu(false);
                }}
              >
                <i className="bx bx-bell nav-notif-bell-icon" />
                {unreadCount > 0 && (
                  <span className="notification-badge-count">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="navbar-notifications-menu">
                  <div className="navbar-notif-header">
                    <span className="navbar-notif-title">Notifications</span>
                    {notifications.some(n => !n.is_read) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (handleMarkAllAsRead) handleMarkAllAsRead();
                        }}
                        className="navbar-notif-action-btn read-all"
                      >
                        Read All
                      </button>
                    )}
                    {notifications.some(n => n.is_read) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (handleClearReadNotifications) handleClearReadNotifications();
                        }}
                        className="navbar-notif-action-btn clear"
                      >
                        Clear Reviewed
                      </button>
                    )}
                  </div>
                  <div className="navbar-notif-list">
                    {notifications.length === 0 ? (
                      <div className="navbar-notif-empty">
                        No notifications
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`navbar-notif-item ${!notif.is_read ? 'unread' : ''}`}
                          title="Click to view application status"
                        >
                          <div className="navbar-notif-item-header">
                            <span className="navbar-notif-item-title">{notif.title}</span>
                            {!notif.is_read ? (
                              <span className="navbar-notif-active-badge">Active</span>
                            ) : (
                              <span className="navbar-notif-arrow">&rarr;</span>
                            )}
                          </div>
                          <div className="navbar-notif-message">
                            {notif.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.some(n => !n.is_read) && (
                    <div className="navbar-notif-footer">
                      Unreviewed notifications cannot be cleared until reviewed.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div className="navbar-profile-wrapper">
              <button
                className="avatar-profile-btn"
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                  setShowMobileMenu(false);
                }}
                aria-label="User Profile"
              >
                <i className="bx bx-user nav-avatar-icon" />
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-user-info">
                    <span className="dropdown-user-name">
                      {activeUser.first_name || activeUser.User_Fname} {(activeUser.middle_initial || activeUser.User_MInitial) ? `${activeUser.middle_initial || activeUser.User_MInitial}. ` : ''}{activeUser.last_name || activeUser.User_Lname}
                    </span>
                    <span className="dropdown-user-email">{activeUser.email || activeUser.User_Email}</span>
                  </div>
                  <div className="dropdown-divider" />

                  {/* Settings */}
                  <button
                    className="dropdown-logout-btn dropdown-settings-btn"
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleNav('/settings');
                    }}
                  >
                    <i className="bx bx-cog dropdown-menu-icon" />
                    Settings
                  </button>
                  <div className="dropdown-divider" />

                  {/* Sign Out */}
                  <button onClick={() => { setShowProfileMenu(false); handleLogout(); }} className="dropdown-logout-btn">
                    <i className="bx bx-log-out dropdown-menu-icon" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="nav-auth-buttons">
            <button onClick={() => handleNav('/login')} className="nav-login-btn">
              Log In
            </button>
            <button onClick={() => handleNav('/register')} className="nav-signup-btn">
              Sign Up
            </button>
          </div>
        )}

        {/* Mobile Burger Menu Button */}
        <button
          className="mobile-burger-btn"
          onClick={() => {
            setShowMobileMenu(!showMobileMenu);
            setShowProfileMenu(false);
            setShowNotifications(false);
          }}
          aria-label="Toggle Navigation Menu"
        >
          <i className={`mobile-burger-icon bx ${showMobileMenu ? 'bx-x' : 'bx-menu'}`} />
        </button>
      </div>

      {/* Mobile Nav Dropdown (Locked directly underneath the sticky header) */}
      {showMobileMenu && (
        <div className="mobile-nav-dropdown">
          <div
            className={`mobile-nav-item ${activePage === 'home' ? 'active' : ''}`}
            onClick={() => handleNav(getHomePath())}
          >
            Home
          </div>
          <div
            className={`mobile-nav-item ${activePage === 'vacancy' ? 'active' : ''}`}
            onClick={() => handleNav('/vacancy')}
          >
            Vacancy
          </div>
          <div
            className={`mobile-nav-item ${activePage === 'about' ? 'active' : ''}`}
            onClick={() => handleNav('/about')}
          >
            About
          </div>
          <div
            className={`mobile-nav-item ${activePage === 'status' ? 'active' : ''}`}
            onClick={() => {
              if (activeUser) {
                handleNav('/application-status');
              } else {
                setShowMobileMenu(false);
                setShowGuestModal(true);
              }
            }}
          >
            Application Status
          </div>
        </div>
      )}

      {/* Guest Sign In Required Modal */}
      {showGuestModal && ReactDOM.createPortal(
        <div className="guest-modal-overlay" onClick={() => setShowGuestModal(false)}>
          <div className="guest-modal-card" onClick={e => e.stopPropagation()}>
            <div className="guest-modal-icon-wrap">
              <i className="bx bx-lock-alt" />
            </div>
            <h3 className="guest-modal-title">Sign In Required</h3>
            <p className="guest-modal-desc">
              Please log in or create an account to view and track your job application status, interview schedules, and updates.
            </p>
            <div className="guest-modal-actions">
              <button
                className="guest-modal-btn guest-modal-btn-primary"
                onClick={() => {
                  setShowGuestModal(false);
                  navigate('/login');
                }}
              >
                Log In
              </button>
              <button
                className="guest-modal-btn guest-modal-btn-secondary"
                onClick={() => {
                  setShowGuestModal(false);
                  navigate('/register');
                }}
              >
                Create Account
              </button>
            </div>
            <button
              className="guest-modal-close-btn"
              onClick={() => setShowGuestModal(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export default ApplicantNavbar;
