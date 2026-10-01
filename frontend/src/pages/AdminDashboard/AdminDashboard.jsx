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
import { PageLoadingScreen } from '../../components/Loading';
import useSessionGuard from '../../hooks/useSessionGuard';
import useInactivityTimeout from '../../hooks/useInactivityTimeout';
import logoImg from '../../assets/images/Logo Airship Express.png';
import useToast from '../../hooks/useToast';
import ToastContainer from '../../components/Toast/ToastNotification';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Universal Toast Notifications Hook ──────────────────────────────────────
  const { toasts, showToast, removeToast } = useToast();

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
    const role = parseInt(userData.is_admin);
    if (role === 0) {
      navigate('/applicant-dashboard');
      return;
    }
    if (role === 3) {
      navigate('/super-admin-dashboard');
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
      <PageLoadingScreen
        title="Admin Workspace"
        subtitle="Verifying credentials and loading recruitment console..."
      />
    );
  }

  return (
    <div className="admin-layout-wrapper animate-fade-in">
      {/* ── Mobile Sticky Top Header Bar ── */}
      <header className="admin-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="admin-hamburger-btn"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Toggle navigation menu"
          >
            <i className={`bx ${mobileMenuOpen ? 'bx-x' : 'bx-menu'}`} style={{ fontSize: '24px' }}></i>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={logoImg} alt="Airship Express" style={{ height: '24px', width: 'auto' }} />
            <span style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a', letterSpacing: '0.5px', fontFamily: "'Montserrat', sans-serif" }}>
              AIRSHIP EXPRESS
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '12px',
            background: 'rgba(230,0,126,0.1)', color: '#e6007e', textTransform: 'uppercase'
          }}>
            Admin
          </span>
        </div>
      </header>

      {/* ── Mobile Sidebar Backdrop Overlay ── */}
      {mobileMenuOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Admin Sidebar (Responsive Drawer on small screens) ── */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        user={user}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      <main className="admin-main-content">
        {activeTab === 'overview'    && <OverviewTab setActiveTab={setActiveTab} showToast={showToast} />}
        {activeTab === 'applicants'  && <ApplicantsTab showToast={showToast} />}
        {activeTab === 'jobs'        && <JobsTab showToast={showToast} />}
        {activeTab === 'interviews'  && <InterviewsTab showToast={showToast} />}
        {activeTab === 'master_list' && <MasterListTab showToast={showToast} />}
        {activeTab === 'chatbot_kb'  && <ChatbotKbTab showToast={showToast} />}
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

      {/* ── Global Toast Notifications Container ── */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
};

export default AdminDashboard;
