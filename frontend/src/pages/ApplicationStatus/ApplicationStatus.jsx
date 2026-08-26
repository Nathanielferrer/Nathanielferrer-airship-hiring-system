import React, { useEffect } from 'react';
import ChatbotWidget    from '../../components/ChatbotWidget/ChatbotWidget';
import ApplicantNavbar  from '../../components/ApplicantNavbar/ApplicantNavbar';
import ApplicationsList from './components/ApplicationsList';
import useApplicantData from '../../hooks/useApplicantData';
import ConfirmModal     from '../../components/ConfirmModal/ConfirmModal';
import useToast         from '../../components/Toast/Toast';
import './ApplicationStatus.css';

const ApplicationStatus = () => {
  const {
    user,
    applications,
    loadingApps,
    notifications,
    showNotifications,
    setShowNotifications,
    interviewDetails,
    scheduleActionLoading,
    scheduleActionFeedback,
    showProfileMenu,
    setShowProfileMenu,
    handleNotificationClick,
    handleClearReadNotifications,
    handleScheduleResponse,
    handleLogout,
    confirmModalState,
    closeConfirmModal,
    dropdownRef,
    notifRef,
  } = useApplicantData({ navigateOnNotification: false });

  const { showToast, ToastPortal } = useToast();

  useEffect(() => {
    document.title = 'Application Status - Airship Express';
  }, []);

  /**
   * Wraps handleScheduleResponse and fires a toast notification
   * when the applicant successfully submits a reschedule request.
   */
  const handleScheduleResponseWithToast = async (appId, action, extra = {}) => {
    await handleScheduleResponse(appId, action, extra);
    if (action === 'reschedule') {
      showToast('Your reschedule request has been submitted.', 'success');
    }
  };

  if (!user) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="status-page-wrapper animate-fade-in">

      <ApplicantNavbar
        user={user}
        activePage="status"
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

      <main className="status-main-container">
        <div className="status-section-header">
          <h1 className="status-page-title">Application Status</h1>
          <p className="status-page-subtitle">
            Track your job applications, interview schedules, and onboarding progress.
          </p>
        </div>

        <div className="status-grid">
          <div className="status-card">
            <h3 className="status-card-title">
              <i className="bx bx-file-blank" />
              My Applications
            </h3>

            <ApplicationsList
              applications={applications}
              loadingApps={loadingApps}
              interviewDetails={interviewDetails}
              scheduleActionLoading={scheduleActionLoading}
              scheduleActionFeedback={scheduleActionFeedback}
              onScheduleResponse={handleScheduleResponseWithToast}
            />
          </div>
        </div>
      </main>

      {/* Toast notifications */}
      <ToastPortal />

      {/* Chatbot & Modals */}
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

export default ApplicationStatus;
