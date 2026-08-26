import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Shared hook providing auth guard, applications data, notifications,
 * interview details, and schedule response logic for all applicant-facing pages.
 *
 * @param {object} options
 * @param {boolean} options.navigateOnNotification - If true, clicking a notification
 *   navigates to /application-status after marking it as read. Set true on the
 *   dashboard, false on the status page itself.
 */
const useApplicantData = ({ navigateOnNotification = false } = {}) => {
  const navigate = useNavigate();

  const [user, setUser]                               = useState(null);
  const [applications, setApplications]               = useState([]);
  const [loadingApps, setLoadingApps]                 = useState(true);
  const [notifications, setNotifications]             = useState([]);
  const [showNotifications, setShowNotifications]     = useState(false);
  const [interviewDetails, setInterviewDetails]       = useState({});
  const [scheduleActionLoading, setScheduleActionLoading] = useState({});
  const [scheduleActionFeedback, setScheduleActionFeedback] = useState({});
  const [showProfileMenu, setShowProfileMenu]         = useState(false);

  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedUser = localStorage.getItem('hiring_user');
    if (!savedUser) {
      navigate('/login');
      return;
    }
    const userData = JSON.parse(savedUser);
    if (userData.is_admin > 0) {
      navigate('/admin-dashboard');
      return;
    }
    setUser(userData);
  }, [navigate]);

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
    const scheduledStatuses = ['INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'CONFIRMED', 'RESCHEDULING'];
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
      const res  = await fetch(`http://localhost/Hiring%20System/backend/applications/get_user_applications.php?user_id=${user.id}`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setApplications(data.applications);
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
      const res  = await fetch(`http://localhost/Hiring%20System/backend/notifications/get_notifications.php?user_id=${user.id}`);
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
        await fetch('http://localhost/Hiring%20System/backend/notifications/mark_read.php', {
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
    if (navigateOnNotification) {
      navigate('/application-status');
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
          const res = await fetch('http://localhost/Hiring%20System/backend/notifications/clear_read_notifications.php', {
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

  const fetchInterviewDetails = async (appId) => {
    if (!user) return;
    try {
      const res  = await fetch(`http://localhost/Hiring%20System/backend/interviews/get_details.php?application_id=${appId}&user_id=${user.id}`);
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
      const res  = await fetch('http://localhost/Hiring%20System/backend/interviews/respond_schedule.php', {
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
        localStorage.removeItem('hiring_user');
        navigate('/login');
      },
    });
  };

  // ── Return ─────────────────────────────────────────────────────────────────
  return {
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
    fetchUserApplications,
    handleLogout,
    confirmModalState,
    closeConfirmModal,
    dropdownRef,
    notifRef,
  };
};

export default useApplicantData;
