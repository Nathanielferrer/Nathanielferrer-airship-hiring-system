import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './components/AdminSidebar';
import OverviewTab from './components/tabs/OverviewTab';
import ApplicantsTab from './components/tabs/ApplicantsTab';
import InterviewsTab from './components/tabs/InterviewsTab';
import MasterListTab from './components/tabs/MasterListTab';
import JobsTab from './components/tabs/JobsTab';
import ChatbotKbTab from './components/tabs/ChatbotKbTab';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import useSessionGuard from '../../hooks/useSessionGuard';
import useInactivityTimeout from '../../hooks/useInactivityTimeout';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ── Real-Time Session Guard ─────────────────────────────────────────────────
  // Polls check_session.php every 10 seconds. If Super Admin deletes or resets
  // this admin account, the session is immediately terminated and the user is
  // redirected to /login. (ISO 27001 A.8.5 / OWASP A07)
  useSessionGuard();

  useEffect(() => {
    document.title = 'Admin Panel - Airship Express';
    const savedUser = localStorage.getItem('hiring_user');
    if (!savedUser) {
      navigate('/login');
      return;
    }
    const userData = JSON.parse(savedUser);
    if (userData.is_admin === 0) {
      navigate('/applicant-dashboard');
      return;
    }
    setUser(userData);
  }, [navigate]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogoutAction = () => {
    setShowLogoutConfirm(false);
    localStorage.removeItem('hiring_token');
    localStorage.removeItem('hiring_user');
    navigate('/login');
  };

  // ── Session Auto-Timeout on Inactivity (30 Minutes) ───────────────────────
  // OWASP Session Management Standard: Admin sessions auto-expire after
  // 30 minutes of no mouse/keyboard/touch activity to protect sensitive data.
  const handleInactivityTimeout = useCallback(() => {
    localStorage.removeItem('hiring_token');
    localStorage.removeItem('hiring_user');
    window.location.href = '/login?reason=inactivity';
  }, []);

  const { sessionExpiring, resetTimer } = useInactivityTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    warningMs:  2 * 60 * 1000, // Warn 2 minutes before
    onTimeout: handleInactivityTimeout,
  });
  // ──────────────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="admin-layout-wrapper animate-fade-in">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout} user={user} />
      <main className="admin-main-content">
        {activeTab === 'overview'    && <OverviewTab setActiveTab={setActiveTab} />}
        {activeTab === 'applicants'  && <ApplicantsTab />}
        {activeTab === 'jobs'        && <JobsTab />}
        {activeTab === 'interviews'  && <InterviewsTab />}
        {activeTab === 'master_list' && <MasterListTab />}
        {activeTab === 'chatbot_kb'  && <ChatbotKbTab />}
      </main>

      {/* ── Inactivity Warning Modal ──────────────────────────────────────── */}
      <ConfirmModal
        isOpen={sessionExpiring}
        title="Session Expiring Soon"
        message="You have been inactive for 28 minutes. You will be automatically signed out in 2 minutes to protect sensitive data. Click 'Stay Signed In' to continue your session."
        confirmText="Stay Signed In"
        cancelText="Sign Out Now"
        type="warning"
        onConfirm={resetTimer}
        onCancel={handleInactivityTimeout}
      />

      {/* ── Manual Logout Confirmation Modal ─────────────────────────────── */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Confirm Admin Sign Out"
        message="Are you sure you want to log out of the Admin Portal?"
        confirmText="Log Out"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmLogoutAction}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
};

export default AdminDashboard;
