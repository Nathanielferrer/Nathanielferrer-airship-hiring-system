import React, { useEffect } from 'react';
import ApplicantNavbar  from '../../components/ApplicantNavbar/ApplicantNavbar';
import ApplicationsList from './components/ApplicationsList';
import useApplicantData from '../../hooks/useApplicantData';
import ConfirmModal     from '../../components/ConfirmModal/ConfirmModal';
import LoadingScreen    from '../../components/LoadingScreen/LoadingScreen';
import useToast         from '../../components/Toast/Toast';
import { PageLoadingScreen } from '../../components/Loading';
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
    handleMarkAllAsRead,
    handleScheduleResponse,
    handleWithdrawApplication,
    handleRespondJobOffer,
    handleLogout,
    confirmModalState,
    closeConfirmModal,
    dropdownRef,
    notifRef,
    isHiredUser,
    isLoggingOut,
  } = useApplicantData({ navigateOnNotification: false, requireAuth: true });

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

  const handleRespondJobOfferWithToast = async (appId, action, reason = '') => {
    const res = await handleRespondJobOffer(appId, action, reason);
    if (res.status === 'success') {
      showToast(res.message, 'success');
    } else {
      showToast(res.message || 'Action failed', 'error');
    }
    return res;
  };

  const handleWithdrawApplicationWithToast = (appId, jobTitle) => {
    handleWithdrawApplication(appId, jobTitle, (success, msg) => {
      if (success) {
        showToast(msg || 'Application successfully withdrawn.', 'info');
      } else {
        showToast(msg || 'Failed to withdraw application.', 'danger');
      }
    });
  };

  if (!user) {
    return (
      <PageLoadingScreen
        title="Airship Express"
        subtitle="Retrieving your candidate portal..."
      />
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
        handleMarkAllAsRead={handleMarkAllAsRead}
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
              onWithdrawApplication={handleWithdrawApplicationWithToast}
              onRespondJobOffer={handleRespondJobOfferWithToast}
              isHiredUser={isHiredUser}
            />
          </div>
        </div>
      </main>

      {/* Toast notifications */}
      <ToastPortal />

      {/* Modals */}

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

export default ApplicationStatus;
