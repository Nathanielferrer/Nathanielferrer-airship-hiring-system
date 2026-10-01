import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { API_BASE_URL } from '../utils/apiConfig';
/**
 * Shared hook providing auth guard, applications data, notifications,
 * interview details, and schedule response logic for all applicant-facing pages.
 *
 * @param {object} options
 * @param {boolean} options.navigateOnNotification - If true, clicking a notification
 *   navigates to /application-status after marking it as read. Set true on the
 *   dashboard, false on the status page itself.
 * @param {boolean} options.requireAuth - If true, redirects unauthenticated guests
 *   to /login. Set false on public/landing pages like the Home Dashboard.
 */
const useApplicantData = ({ navigateOnNotification = false, requireAuth = true } = {}) => {
  const navigate = useNavigate();

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('hiring_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [applications, setApplications]               = useState([]);
  const [loadingApps, setLoadingApps]                 = useState(true);
  const [notifications, setNotifications]             = useState([]);
  const [showNotifications, setShowNotifications]     = useState(false);
  const [interviewDetails, setInterviewDetails]       = useState({});
  const [scheduleActionLoading, setScheduleActionLoading] = useState({});
  const [scheduleActionFeedback, setScheduleActionFeedback] = useState({});
  const [showProfileMenu, setShowProfileMenu]         = useState(false);
  const [isHiredUser, setIsHiredUser]                 = useState(false);

  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem('hiring_user');
    if (!savedUser) {
      if (requireAuth) {
        navigate('/login');
      } else {
        setUser(null);
        setLoadingApps(false);
      }
      return;
    }
    try {
      const userData = JSON.parse(savedUser);
      if (userData.is_admin > 0) {
        navigate('/admin-dashboard');
        return;
      }
      setUser(userData);
    } catch {
      if (requireAuth) {
        navigate('/login');
      } else {
        setUser(null);
        setLoadingApps(false);
      }
    }
  }, [navigate, requireAuth]);

  // ── Load data once user is available ─────────────────────────────────────
  useEffect(() => {
    if (user) {
      fetchUserApplications();
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Fetch interview details for scheduled applications ────────────────────
  useEffect(() => {
    const scheduledStatuses = [
      'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'CONFIRMED', 'RESCHEDULING',
      'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'Candidate No Show'
    ];
    applications
      .filter(app => scheduledStatuses.includes(app.status))
      .forEach(app => {
        if (!interviewDetails[app.id]) {
          fetchInterviewDetails(app.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications]);

  // ── Close dropdowns on outside click ─────────────────────────────────────
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── API Functions ─────────────────────────────────────────────────────────

  const fetchUserApplications = async () => {
    if (!user) return;
    try {
      const res  = await fetch(`${API_BASE_URL}/applications/get_user_applications.php?user_id=${user.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setApplications(data.applications);

        // Keep local user identity in sync if Admin updated their legal name in the database
        if (data.user) {
          const freshFn = (data.user.User_Fname || '').trim();
          const freshMi = (data.user.User_MInitial || '').trim();
          const freshLn = (data.user.User_Lname || '').trim();
          const existing = JSON.parse(localStorage.getItem('hiring_user') || '{}');
          if (existing.User_Fname !== freshFn || existing.User_Lname !== freshLn || (existing.User_MInitial || '') !== freshMi) {
            const updated = {
              ...existing,
              first_name: freshFn,
              middle_initial: freshMi,
              last_name: freshLn,
              User_Fname: freshFn,
              User_MInitial: freshMi,
              User_Lname: freshLn
            };
            localStorage.setItem('hiring_user', JSON.stringify(updated));
            setUser(updated);
          }
        }
        const hiredStatuses = [
          'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 
          'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 
          'OFFICIALLY HIRED & REQUIREMENTS COMPLETED', 'OFFICIALLY HIRED & SIGNED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'
        ];
        setIsHiredUser(data.applications.some(app => hiredStatuses.includes((app.status || '').toUpperCase())));
      }
    } catch (err) {
      console.error('Failed to load user applications:', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res  = await fetch(`${API_BASE_URL}/notifications/get_notifications.php?user_id=${user.id}`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await fetch(`${API_BASE_URL}/notifications/mark_read.php`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ id: notif.id }),
        });
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n)
        );
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
    setShowNotifications(false);

    const targetPath = (notif?.link && notif.link !== '/applicant-dashboard') ? notif.link : '/application-status';
    
    // If already on application status, refresh data immediately
    if (window.location.pathname.includes('/application-status')) {
      fetchUserApplications();
    } else {
      navigate(targetPath);
    }
  };

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

  const handleClearReadNotifications = () => {
    if (!user) return;
    const readCount = notifications.filter(n => n.is_read).length;
    if (readCount === 0) {
      setConfirmModalState({
        isOpen: true,
        title: 'No Reviewed Notifications',
        message: 'You have no reviewed notifications to clear. Active unreviewed notifications cannot be removed until reviewed.',
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
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/mark_all_read.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const fetchInterviewDetails = async (appId) => {
    if (!user) return;
    try {
      const res  = await fetch(`${API_BASE_URL}/interviews/get_details.php?application_id=${appId}&user_id=${user.id}`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setInterviewDetails(prev => ({ ...prev, [appId]: data.interview }));
      }
    } catch (err) {
      console.error('Failed to fetch interview details:', err);
    }
  };

  const handleScheduleResponse = async (appId, action, extra = {}) => {
    setScheduleActionLoading(prev => ({ ...prev, [appId]: true }));
    try {
      const res  = await fetch(`${API_BASE_URL}/interviews/respond_schedule.php`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          application_id: appId,
          user_id: user.id,
          action,
          reason: extra.reason || '',
          slot_id: extra.slotId || null,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setScheduleActionFeedback(prev => ({
          ...prev,
          [appId]: { type: action, message: data.message },
        }));
        fetchUserApplications();
      }
    } catch (err) {
      console.error('Schedule response error:', err);
    } finally {
      setScheduleActionLoading(prev => ({ ...prev, [appId]: false }));
    }
  };

  const [isLoggingOut, setIsLoggingOut]               = useState(false);

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

  const handleWithdrawApplication = async (appId, jobTitle = 'this position', onResult = null) => {
    if (!user) return;
    setConfirmModalState({
      isOpen: true,
      title: 'Withdraw Application',
      message: `Are you sure you want to cancel and withdraw your application for "${jobTitle}"? Your application will be recorded as withdrawn.`,
      confirmText: 'Withdraw Application',
      cancelText: 'Keep Application',
      type: 'danger',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          const res = await fetch(`${API_BASE_URL}/applications/withdraw.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              application_id: appId,
              reason: 'Candidate cancelled application from status portal'
            })
          });
          const data = await res.json();
          if (res.ok && data.status === 'success') {
            fetchUserApplications();
            if (typeof onResult === 'function') onResult(true, data.message || 'Application successfully withdrawn.');
          } else {
            if (typeof onResult === 'function') onResult(false, data.message || 'Failed to withdraw application.');
          }
        } catch (err) {
          console.error('Withdraw application error:', err);
          if (typeof onResult === 'function') onResult(false, 'Connection error while withdrawing application.');
        }
      }
    });
  };

  const handleRespondJobOffer = async (appId, action, reason = '') => {
    if (!user) return { status: 'error', message: 'User not logged in' };
    try {
      const res = await fetch(`${API_BASE_URL}/applications/respond_job_offer.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: appId,
          user_id: user.id,
          action,
          reason
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        fetchUserApplications();
        fetchNotifications();
      }
      return data;
    } catch (err) {
      console.error('Job offer response error:', err);
      return { status: 'error', message: 'Failed to submit response. Please try again.' };
    }
  };

  // ── Return ─────────────────────────────────────────────────────────────────
  return {
    user,
    setUser,
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
    fetchUserApplications,
    handleLogout,
    confirmModalState,
    setConfirmModalState,
    closeConfirmModal,
    dropdownRef,
    notifRef,
    isHiredUser,
    isLoggingOut,
  };
};

export default useApplicantData;
