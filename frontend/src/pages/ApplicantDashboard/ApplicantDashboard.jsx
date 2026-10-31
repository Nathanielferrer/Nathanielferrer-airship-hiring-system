import React, { useState, useEffect } from 'react';
import ApplicantNavbar  from '../../components/ApplicantNavbar/ApplicantNavbar';
import HeroSection      from './components/HeroSection';
import PartnersCarousel from './components/PartnersCarousel';
import HowToApply       from './components/HowToApply';
import FeaturedJobs     from './components/FeaturedJobs';
import useApplicantData from '../../hooks/useApplicantData';
import ConfirmModal     from '../../components/ConfirmModal/ConfirmModal';
import LoadingScreen    from '../../components/LoadingScreen/LoadingScreen';
import Footer           from '../../components/Footer/Footer';
import './ApplicantDashboard.css';

const ApplicantDashboard = () => {
  const {
    user,
    notifications,
    showNotifications,
    setShowNotifications,
    showProfileMenu,
    setShowProfileMenu,
    handleNotificationClick,
    handleClearReadNotifications,
    handleMarkAllAsRead,
    handleLogout,
    confirmModalState,
    closeConfirmModal,
    dropdownRef,
    notifRef,
    isLoggingOut,
  } = useApplicantData({ navigateOnNotification: true, requireAuth: false });

  // Determine if staggering should trigger:
  // ONLY trigger:
  // 1. When visiting the website as a guest for the first time
  // 2. Immediately after login (when trigger_dashboard_stagger or just_logged_in is set in sessionStorage)
  // If already visited as a guest OR already logged in -> NEVER stagger!
  const [shouldStagger] = useState(() => {
    try {
      const justLoggedIn = sessionStorage.getItem('trigger_dashboard_stagger') === 'true' ||
                           sessionStorage.getItem('just_logged_in') === 'true';
      if (justLoggedIn) {
        sessionStorage.removeItem('trigger_dashboard_stagger');
        sessionStorage.removeItem('just_logged_in');
        localStorage.setItem('airship_guest_visited', 'true');
        sessionStorage.setItem('airship_guest_visited', 'true');
        return true;
      }

      // If user is already logged in and didn't just log in -> DO NOT stagger
      const savedUser = localStorage.getItem('hiring_user');
      if (savedUser) {
        return false;
      }

      // Guest check: only stagger on the very first guest visit ever
      const guestAlreadyVisited = localStorage.getItem('airship_guest_visited') === 'true' ||
                                  sessionStorage.getItem('airship_guest_visited') === 'true';
      if (!guestAlreadyVisited) {
        // Mark as visited synchronously right now so no race condition or navigation can re-trigger it
        localStorage.setItem('airship_guest_visited', 'true');
        sessionStorage.setItem('airship_guest_visited', 'true');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  const [hasAnimated, setHasAnimated] = useState(!shouldStagger);

  useEffect(() => {
    document.title = 'Home - Airship Express Hiring Platform';

    if (shouldStagger) {
      try {
        sessionStorage.setItem('airship_guest_visited', 'true');
        localStorage.setItem('airship_guest_visited', 'true');
      } catch {}

      const raf = requestAnimationFrame(() => {
        setHasAnimated(true);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [shouldStagger]);

  const wrapperClass = shouldStagger
    ? (hasAnimated ? 'applicant-dashboard--stagger' : 'applicant-dashboard--pre-stagger')
    : 'applicant-dashboard--ready';

  return (
    <div className={`dashboard-wrapper ${shouldStagger ? 'animate-fade-in' : ''} ${wrapperClass}`}>

      <ApplicantNavbar
        user={user}
        activePage="home"
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

      <HeroSection user={user} />
      <PartnersCarousel />
      <HowToApply shouldStagger={shouldStagger} />
      <FeaturedJobs shouldStagger={shouldStagger} />

      {/* Footer */}
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

export default ApplicantDashboard;
