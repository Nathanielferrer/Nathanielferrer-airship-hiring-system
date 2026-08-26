import React, { useState } from 'react';
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
  handleLogout = () => {},
  notifRef,
  dropdownRef,
}) => {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const unreadCount = (notifications || []).filter(n => !n.is_read).length;

  const handleNav = (path) => {
    setShowMobileMenu(false);
    navigate(path);
  };

  const getHomePath = () => {
    if (!user) return '/applicant-dashboard';
    return user.is_admin > 0 ? '/admin-dashboard' : '/applicant-dashboard';
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

      {/* Center Nav links */}
      <nav>
        <ul className="dashboard-navbar-nav">
          <li>
            <span
              className={`nav-link-item ${activePage === 'home' ? 'active' : ''}`}
              onClick={() => handleNav(getHomePath())}
            >
              Home
            </span>
          </li>
          <li>
            <span
              className={`nav-link-item ${activePage === 'vacancy' ? 'active' : ''}`}
              onClick={() => handleNav('/vacancy')}
            >
              Vacancy
            </span>
          </li>
          <li>
            <span
              className={`nav-link-item ${activePage === 'about' ? 'active' : ''}`}
              onClick={() => handleNav('/about')}
            >
              About
            </span>
          </li>
        </ul>
      </nav>

      {/* Right side: notifications + profile or sign in + mobile burger */}
      <div className="dashboard-navbar-right" ref={dropdownRef}>
        {user ? (
          <>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                className="notification-bell-btn"
                aria-label="Notifications"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfileMenu(false);
                  setShowMobileMenu(false);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && (
                  <span className="notification-badge-count">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="navbar-notifications-menu">
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '13.5px', fontFamily: 'Montserrat, sans-serif' }}>Notifications</span>
                    {notifications.some(n => n.is_read) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (handleClearReadNotifications) handleClearReadNotifications();
                        }}
                        style={{
                          background: 'none', border: 'none', color: '#e6007e', fontSize: '12px',
                          fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter, sans-serif'
                        }}
                      >
                        Clear Reviewed
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        No notifications
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          style={{
                            padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer', background: notif.is_read ? 'white' : '#f0fdf4',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f172a', marginBottom: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{notif.title}</span>
                            {!notif.is_read && (
                              <span style={{ fontSize: '10px', background: '#d1fae5', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>Active</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.4' }}>
                            {notif.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.some(n => !n.is_read) && (
                    <div style={{ padding: '8px 12px', borderTop: '1px solid #f1f5f9', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                      Unreviewed notifications cannot be cleared until reviewed.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div style={{ position: 'relative' }}>
              <button
                className="avatar-profile-btn"
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifications(false);
                  setShowMobileMenu(false);
                }}
                aria-label="User Profile"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="avatar-silhouette-svg">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-user-info">
                    <span className="dropdown-user-name">{user.first_name || user.User_Fname} {user.last_name || user.User_Lname}</span>
                    <span className="dropdown-user-email">{user.email || user.User_Email}</span>
                  </div>
                  <div className="dropdown-divider"></div>

                  {/* Application Status */}
                  <button
                    className="dropdown-logout-btn"
                    style={{ color: '#ffffff', fontWeight: '600' }}
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleNav('/application-status');
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Application Status
                  </button>
                  <div className="dropdown-divider"></div>

                  {/* Sign Out */}
                  <button onClick={() => { setShowProfileMenu(false); handleLogout(); }} className="dropdown-logout-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button onClick={() => handleNav('/login')} className="nav-signin-btn">
            Sign In
          </button>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {showMobileMenu ? (
              <path d="M18 6L6 18M6 6l12 12" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
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
          {!user && (
            <div
              className="mobile-nav-item"
              onClick={() => handleNav('/login')}
              style={{ color: '#e6007e', fontWeight: '700' }}
            >
              Sign In
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default ApplicantNavbar;
