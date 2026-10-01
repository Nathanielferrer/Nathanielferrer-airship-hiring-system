import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import companyImg from '../../assets/images/Company Picture.png';
import ApplicantNavbar from '../../components/ApplicantNavbar/ApplicantNavbar';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import LoadingScreen from '../../components/LoadingScreen/LoadingScreen';
import Footer from '../../components/Footer/Footer';
import './About.css';

import { API_BASE_URL } from '../../utils/apiConfig';
const About = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('hiring_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Navbar states matching Vacancy / Dashboard
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    document.title = 'About Us - Airship Express';
    const savedUser = localStorage.getItem('hiring_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/get_notifications.php?user_id=${user.id}`);
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await fetch(`${API_BASE_URL}/notifications/mark_read.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notif.id })
        });
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
    setShowNotifications(false);
    const targetPath = (notif?.link && notif.link.trim() !== '' && notif.link !== '/applicant-dashboard') 
      ? notif.link 
      : '/application-status';
    navigate(targetPath);
  };

  const handleClearReadNotifications = () => {
    if (!user) return;
    const hasRead = notifications.some(n => n.is_read);
    if (!hasRead) {
      setConfirmModalState({
        isOpen: true,
        title: 'No Reviewed Notifications',
        message: 'You have no reviewed notifications to clear at this time.',
        confirmText: 'OK',
        cancelText: 'Close',
        type: 'primary',
        onConfirm: closeConfirmModal,
      });
      return;
    }

    setConfirmModalState({
      isOpen: true,
      title: 'Clear Reviewed Notifications',
      message: 'Are you sure you want to clear your reviewed notifications? Active unreviewed notifications will remain intact.',
      confirmText: 'Clear Notifications',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          const res = await fetch(`${API_BASE_URL}/notifications/clear_read_notifications.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id }),
          });
          const data = await res.json();
          if (res.ok && data.status === 'success') {
            setNotifications(prev => prev.filter(n => !n.is_read));
          }
        } catch (err) {
          console.error('Failed to clear read notifications:', err);
        }
      },
    });
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch(`${API_BASE_URL}/notifications/mark_all_read.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id })
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger',
    onConfirm: null,
  });

  const closeConfirmModal = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  };

  const handleLogout = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Confirm Sign Out',
      message: 'Are you sure you want to sign out of your Airship Express account?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: () => {
        closeConfirmModal();
        setIsLoggingOut(true);
        localStorage.removeItem('hiring_user');
        localStorage.removeItem('hiring_token');
        sessionStorage.clear();
        window.dispatchEvent(new Event('auth_logout'));
        setTimeout(() => {
          window.location.href = '/';
        }, 900);
      },
    });
  };

  return (
    <div className="about-wrapper">
      <ApplicantNavbar
        user={user}
        activePage="about"
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        showProfileMenu={showProfileMenu}
        setShowProfileMenu={setShowProfileMenu}
        handleNotificationClick={handleNotificationClick}
        handleClearReadNotifications={handleClearReadNotifications}
        handleMarkAllAsRead={handleMarkAllAsRead}
        handleLogout={handleLogout}
        notifRef={notifRef}
        dropdownRef={dropdownRef}
      />

      {/* Hero Badge Intro */}
      <section className="about-hero-section">
        <div className="about-tag-badge">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          <span>Established 2016</span>
        </div>
      </section>

      {/* Main Content Section - Two Columns with Divider */}
      <section className="about-two-col-section">
        {/* Left Column (Image) */}
        <div className="about-col-left">
          <div className="about-company-image-container">
            <img src={companyImg} alt="Airship Express Operations and Team" className="about-company-img" />
          </div>
        </div>

        {/* Right Column (Text) */}
        <div className="about-col-right">
          <h1 className="about-heading">ABOUT AIRSHIP EXPRESS</h1>
          <p className="about-body-text">
            Airship Express is a logistics and courier company established in 2016. The company provides shipping services and accepts parcel drop-offs through various courier partners. Since its establishment, Airship Express has continuously expanded its services to provide reliable and efficient logistics solutions to its customers.
          </p>
        </div>
      </section>

      {/* Second Section: Why Work With Us */}
      <section id="why-work-with-us" className="about-why-section">
        <div className="about-section-container">
          <h2 className="about-section-heading-centered">WHY WORK WITH US</h2>
          <p className="about-section-subtext">
            Discover a workplace designed for ambition, where cutting-edge technology meets continuous team empowerment and growth.
          </p>

          <div className="about-cards-grid">
            {/* Card 1: Innovation First */}
            <div className="about-card">
              <div className="about-card-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              </div>
              <h3 className="about-card-title">Innovation First</h3>
              <p className="about-card-desc">
                Join a team driving the logistics industry forward using automated systems and advanced platform technology.
              </p>
            </div>

            {/* Card 2: Career Growth */}
            <div className="about-card">
              <div className="about-card-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              </div>
              <h3 className="about-card-title">Career Growth</h3>
              <p className="about-card-desc">
                We are rapidly expanding. As Airship Express grows, we invest in our people, offering clear paths for advancement and development.
              </p>
            </div>

            {/* Card 3: Efficiency and Reliability */}
            <div className="about-card">
              <div className="about-card-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9 12l2 2 4-4"></path></svg>
              </div>
              <h3 className="about-card-title">Efficiency and Reliability</h3>
              <p className="about-card-desc">
                Work in an environment focused on precision. Our systems ensure you spend less time on paperwork and more time delivering excellence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Third Section: Location Iframe */}
      <section className="about-location-section">
        <h2 className="about-location-title">FIND US AT <span>OUR HEADQUARTERS</span></h2>
        <p className="about-section-subtext" style={{ marginBottom: '10px' }}>
          Visit our main office or reach out to our logistics coordination center in Manila.
        </p>

        <div className="about-map-container">
          <iframe
            title="Airship Express Headquarters Map"
            src="https://maps.google.com/maps?q=352+T.+Pinpin+Escolta+st.+Binondo+Manila,+1006&t=&z=16&ie=UTF8&iwloc=&output=embed"
            className="about-map-iframe"
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>

        {/* Readable Address Card Below Iframe */}
        <div className="about-address-card">
          <div className="about-address-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </div>
          <div className="about-address-text-group">
            <div className="about-address-label">Official Address</div>
            <div className="about-address-value">352 T. Pinpin Escolta st. Binondo Manila, 1006</div>
          </div>
        </div>
      </section>

      {/* Standard Web Footer */}
      <Footer />

      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
        cancelText={confirmModalState.cancelText}
        type={confirmModalState.type}
        onConfirm={confirmModalState.onConfirm}
        onCancel={closeConfirmModal}
      />

      <LoadingScreen
        isOpen={isLoggingOut}
        title="Signing Out"
        subtitle="Clearing your candidate session..."
      />
    </div>
  );
};

export default About;
