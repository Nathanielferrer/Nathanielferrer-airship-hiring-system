import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../../assets/images/Logo Airship Express.png';
import ChatbotWidget    from '../../components/ChatbotWidget/ChatbotWidget';
import ApplicantNavbar  from '../../components/ApplicantNavbar/ApplicantNavbar';
import HeroSection      from './components/HeroSection';
import PartnersCarousel from './components/PartnersCarousel';
import HowToApply       from './components/HowToApply';
import FeaturedJobs     from './components/FeaturedJobs';
import useApplicantData from '../../hooks/useApplicantData';
import ConfirmModal     from '../../components/ConfirmModal/ConfirmModal';
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
    handleLogout,
    confirmModalState,
    closeConfirmModal,
    dropdownRef,
    notifRef,
  } = useApplicantData({ navigateOnNotification: true });

  useEffect(() => {
    document.title = 'Home - Airship Express Hiring Platform';
  }, []);

  if (!user) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper animate-fade-in">

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
        handleLogout={handleLogout}
        notifRef={notifRef}
        dropdownRef={dropdownRef}
      />

      <HeroSection />
      <PartnersCarousel />
      <HowToApply />
      <FeaturedJobs />

      {/* Footer */}
      <Footer />

      <ChatbotWidget />

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
    </div>
  );
};

export default ApplicantDashboard;
