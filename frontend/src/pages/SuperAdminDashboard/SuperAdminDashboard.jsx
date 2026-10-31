import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import LoadingScreen from '../../components/LoadingScreen/LoadingScreen';
import { TableSkeleton, DatabaseErrorState, PageLoadingScreen } from '../../components/Loading';
import MasterListTab from '../AdminDashboard/components/tabs/MasterListTab';
import JobsTab from '../AdminDashboard/components/tabs/JobsTab';
import ApplicantsTab from '../AdminDashboard/components/tabs/ApplicantsTab';
import InterviewsTab from '../AdminDashboard/components/tabs/InterviewsTab';
import ChatbotKbTab from '../AdminDashboard/components/tabs/ChatbotKbTab';
import SuperAdminAuditTab from './components/SuperAdminAuditTab';
import OnboardingDrawer from './components/OnboardingDrawer';
import PreEmploymentDrawer from './components/PreEmploymentDrawer';
import JobOfferModal from './components/JobOfferModal';
import SuperAdminMfaModal from './components/SuperAdminMfaModal';
import WeekdayCalendarPicker from '../../components/WeekdayCalendarPicker/WeekdayCalendarPicker';
import logoImg from '../../assets/images/Logo Airship Express.webp';
import useInactivityTimeout from '../../hooks/useInactivityTimeout';
import useToast from '../../hooks/useToast';
import ToastContainer from '../../components/Toast/ToastNotification';
import '../AdminDashboard/AdminDashboard.css';

import { API_BASE_URL } from '../../utils/apiConfig';
const FIELD_STYLE = {
  width: '100%', padding: '10px 13px', borderRadius: '8px',
  border: '1.5px solid #cbd5e1', fontSize: '13.5px', outline: 'none',
  boxSizing: 'border-box', fontFamily: "'Inter', sans-serif", color: '#0f172a',
};

// ── Calendar helpers ──────────────────────────────────────────────────────────
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Returns true only if the scheduled interview date and time has arrived (today on time, or in the past)
const isInterviewScheduleReady = (interviewDate, startTime) => {
  if (!interviewDate) return false;
  const dateStr = interviewDate.split('T')[0].split(' ')[0];
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (dateStr > todayStr) {
    return false; // Scheduled in future date
  }
  if (dateStr < todayStr) {
    return true; // Scheduled in past date (already took place)
  }
  // If dateStr === todayStr: check if startTime has arrived
  if (!startTime) {
    return true;
  }
  try {
    let cleanTime = startTime.trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(cleanTime)) {
      if (cleanTime.length === 5) cleanTime += ':00';
      const scheduledDateTime = new Date(`${dateStr}T${cleanTime}`);
      if (!isNaN(scheduledDateTime.getTime())) {
        return now >= scheduledDateTime;
      }
    } else {
      const match = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        const scheduledDateTime = new Date(year, now.getMonth(), now.getDate(), h, m, 0);
        return now >= scheduledDateTime;
      }
    }
  } catch (e) {}
  return true;
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('admins');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', type: 'danger', onConfirm: null });
  const [modalError, setModalError] = useState('');
  const [showMfaModal, setShowMfaModal] = useState(false);

  // Universal Toast Notification Hook
  const { toasts, showToast, removeToast } = useToast();
  const showSaveToast = (msg, type = 'success') => {
    showToast(typeof msg === 'string' ? msg : 'Saved successfully', type);
  };

  // ── Real-Time Session Guard ────────────────────────────────────────────────
  useEffect(() => {
    const checkSessionRealtime = async () => {
      const savedUser = localStorage.getItem('hiring_user');
      if (!savedUser) { window.location.href = '/login'; return; }
      let userId = null;
      try { const parsed = JSON.parse(savedUser); userId = parsed?.id || parsed?.User_ID || parsed?.sub; } catch { return; }
      if (!userId) return;
      try {
        const res = await fetch(`${API_BASE_URL}/auth/check_session.php`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }),
        });
        const data = await res.json();
        if (data.status === 'password_reset_required' || data.status === 'account_deleted') {
          localStorage.removeItem('hiring_token'); localStorage.removeItem('hiring_user'); sessionStorage.clear();
          window.location.href = `/login?reason=${data.status}`;
        }
      } catch { /* silent */ }
    };
    checkSessionRealtime();
    const interval = setInterval(checkSessionRealtime, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Data States ────────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState([]);
  const [slots, setSlots] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [drawerShowRequirements, setDrawerShowRequirements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tabError, setTabError] = useState(null);

  // Admin status tab filter: 'active' | 'inactive'
  const [adminStatusTab, setAdminStatusTab] = useState('active');

  // Auto-Capitalization helper (capitalizes first letter of each word as user types)
  const autoCapitalize = (val) => {
    if (!val) return '';
    return val.replace(/(?:^|\s|-)\S/g, (char) => char.toUpperCase());
  };

  // Add Admin Modal
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ first_name: '', last_name: '', email: '' });

  // Update Admin Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState({ id: '', first_name: '', last_name: '', email: '' });

  // Add Slot Modal (custom num_slots, auto calculate end time)
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [newSlot, setNewSlot] = useState({ date: '', start_time: '09:00', end_time: '09:30', num_slots: 1 });
  const [slotError, setSlotError] = useState('');
  const [slotDayCount, setSlotDayCount] = useState(null); // { count, remaining }
  const slotDateRef = useRef(null);
  const startTimeRef = useRef(null);
  const endTimeRef = useRef(null);
  const contractDateRef = useRef(null);

  // Schedule View Toggle: 'list' | 'calendar'
  const [scheduleView, setScheduleView] = useState('list');
  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calSelectedDay, setCalSelectedDay] = useState(null); // date string 'YYYY-MM-DD'

  // Candidate Evaluation states: 'pending' | 'final_approval' | 'job_offer' | 'contract_signing' | 'onboarding'
  const [evalTab, setEvalTab] = useState('pending');
  const [selectedFinalInterviewIds, setSelectedFinalInterviewIds] = useState([]);
  const [selectedApprovalIds, setSelectedApprovalIds] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [evalSearch, setEvalSearch] = useState('');
  const [evalPage, setEvalPage] = useState(1);
  const [updateStatusTarget, setUpdateStatusTarget] = useState(null); // { id, name, job, status }
  const [selectedPostHireStatus, setSelectedPostHireStatus] = useState('Candidate Withdrew');
  const [jobOfferModalCandidate, setJobOfferModalCandidate] = useState(null);

  // Smart Slot Capacity Warning Modal State
  const [slotWarningModalState, setSlotWarningModalState] = useState({
    isOpen: false,
    candidate: null,
    candidateName: '',
    jobTitle: '',
    totalSlots: 1,
    occupiedSlots: 1,
    activeHolderName: '',
    activeHolderStatus: '',
    applicationId: null
  });

  // Batch Approval Slot Capacity Error Modal State
  const [batchSlotErrorModalState, setBatchSlotErrorModalState] = useState({
    isOpen: false,
    conflicts: []
  });

  // Contract Signing Schedule States
  const [contractModalCandidate, setContractModalCandidate] = useState(null); // { id, name, job, email, date, time, location, notes }
  const [contractDate, setContractDate] = useState('');
  const [contractTime, setContractTime] = useState('');
  const [contractLocation, setContractLocation] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [contractSubmitting, setContractSubmitting] = useState(false);
  const [contractScheduleError, setContractScheduleError] = useState(null);

  // Remarks view state

  // Onboarding & Requirements Side Drawer states
  const [onboardingDrawerCandidate, setOnboardingDrawerCandidate] = useState(null);
  const [requirementsDrawerCandidate, setRequirementsDrawerCandidate] = useState(null);

  // Global Video Loading Screen state
  const [loadingScreenState, setLoadingScreenState] = useState({
    isOpen: false,
    title: 'Processing...',
    subtitle: 'Please wait a moment while the system completes your request.'
  });

  // Candidate Credentials states
  const [resumeSearch, setResumeSearch] = useState('');
  const [resumePage, setResumePage] = useState(1);

  // Declined Job Offer Reason Modal state
  const [declinedReasonCandidate, setDeclinedReasonCandidate] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('hiring_user');
    if (!userData) { navigate('/login'); return; }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.is_admin !== 3) { navigate('/login'); return; }
    setUser(parsedUser);
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'admins') fetchAdmins();
    else if (activeTab === 'slots') fetchSlots();
    else if (activeTab === 'results') fetchInterviews();
    else if (activeTab === 'resumes') fetchResumes();
  }, [user, activeTab]);

  const fetchAdmins = async (silent = false) => {
    if (!silent) setLoading(true);
    setTabError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/admins/get_admins.php`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
      });
      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      if (data.status === 'success') {
        setAdmins(data.admins);
      } else {
        throw new Error(data.message || 'Failed to load admin accounts.');
      }
    } catch (e) {
      console.error(e);
      setTabError(e.message || 'Database connection error while retrieving administrators.');
    }
    if (!silent) setLoading(false);
  };

  const fetchSlots = async (silent = false) => {
    if (!silent) setLoading(true);
    setTabError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/slots/get_slots.php`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
      });
      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      if (data.status === 'success') {
        setSlots(data.slots);
      } else {
        throw new Error(data.message || 'Failed to load interview slots.');
      }
    } catch (e) {
      console.error(e);
      setTabError(e.message || 'Database connection error while retrieving interview schedule slots.');
    }
    if (!silent) setLoading(false);
  };

  const fetchInterviews = async (silent = false) => {
    if (!silent) setLoading(true);
    setTabError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/interviews/get_scheduled.php`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
      });
      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      if (data.status === 'success') {
        setInterviews(data.scheduled);
      } else {
        throw new Error(data.message || 'Failed to load candidate evaluations.');
      }
    } catch (e) {
      console.error(e);
      setTabError(e.message || 'Database connection error while retrieving candidate evaluations.');
    }
    if (!silent) setLoading(false);
  };

  const fetchResumes = async (silent = false) => {
    if (!silent) setLoading(true);
    setTabError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/applicants/get_screened_applicants.php`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
      });
      if (!res.ok) throw new Error(`Server status ${res.status}`);
      const data = await res.json();
      if (data.status === 'success') {
        setResumes(data.applicants);
      } else {
        throw new Error(data.message || 'Failed to load candidate credentials.');
      }
    } catch (e) {
      console.error(e);
      setTabError(e.message || 'Database connection error while retrieving candidate resumes.');
    }
    if (!silent) setLoading(false);
  };

  // ── Fetch slot count for selected date (for modal warning) ────────────────
  const fetchSlotDayCount = useCallback(async (date) => {
    if (!date) { setSlotDayCount(null); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/slots/get_slot_count.php?date=${date}`);
      const data = await res.json();
      if (data.status === 'success') setSlotDayCount({ count: data.count, remaining: data.remaining });
    } catch { setSlotDayCount(null); }
  }, []);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setModalError('');

    const trimmedFn = (newAdmin.first_name || '').trim();
    const trimmedLn = (newAdmin.last_name || '').trim();
    if (trimmedFn.length < 2 || trimmedFn.length > 50 || !/^[a-zA-Z\s\-'\.]+$/.test(trimmedFn)) {
      setModalError('First name must be between 2 and 50 characters (letters, spaces, hyphens, apostrophes, and periods only).');
      return;
    }
    if (trimmedLn.length < 2 || trimmedLn.length > 50 || !/^[a-zA-Z\s\-'\.]+$/.test(trimmedLn)) {
      setModalError('Last name must be between 2 and 50 characters (letters, spaces, hyphens, apostrophes, and periods only).');
      return;
    }

    setLoadingScreenState({
      isOpen: true,
      title: 'Creating Admin Account...',
      subtitle: `Setting up credentials and emailing temporary password to ${newAdmin.email}...`
    });
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/admins/add_admin.php`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({ ...newAdmin, actor_id: user.id }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setAdminModalOpen(false);
        setNewAdmin({ first_name: '', last_name: '', email: '' });
        fetchAdmins();
        showSaveToast(data.message || 'Admin account created! Temporary password has been emailed to the admin.');
      } else {
        setModalError(data.message || 'Failed to create admin.');
      }
    } catch (e) {
      console.error(e);
      setModalError('Connection error.');
    } finally {
      setLoadingScreenState(prev => ({ ...prev, isOpen: false }));
    }
  };

  // ── Update Admin Profile (name/email only) ───────────────────────────────────
  const confirmUpdateAdminSubmit = (e) => {
    e.preventDefault();
    setModalError('');
    const trimmedFn = (editAdmin.first_name || '').trim();
    const trimmedLn = (editAdmin.last_name || '').trim();
    if (!trimmedFn || !trimmedLn || !editAdmin.email) {
      setModalError('First Name, Last Name, and Email Address are required.');
      return;
    }
    if (trimmedFn.length < 2 || trimmedFn.length > 50 || !/^[a-zA-Z\s\-'\.]+$/.test(trimmedFn)) {
      setModalError('First name must be between 2 and 50 characters (letters, spaces, hyphens, apostrophes, and periods only).');
      return;
    }
    if (trimmedLn.length < 2 || trimmedLn.length > 50 || !/^[a-zA-Z\s\-'\.]+$/.test(trimmedLn)) {
      setModalError('Last name must be between 2 and 50 characters (letters, spaces, hyphens, apostrophes, and periods only).');
      return;
    }
    setConfirmModalState({
      isOpen: true,
      title: 'Confirm Admin Account Update',
      message: `Are you sure you want to save the profile changes for "${editAdmin.first_name} ${editAdmin.last_name}"?`,
      confirmText: 'Save Changes',
      cancelText: 'Cancel',
      type: 'primary',
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        await executeUpdateAdmin();
      }
    });
  };

  const executeUpdateAdmin = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/admins/update_admin.php`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({ id: editAdmin.id, first_name: editAdmin.first_name, last_name: editAdmin.last_name, email: editAdmin.email, actor_id: user.id }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setEditModalOpen(false);
        setEditAdmin({ id: '', first_name: '', last_name: '', email: '' });
        fetchAdmins();
        showSaveToast('Admin profile updated successfully!');
      } else {
        setModalError(data.message || 'Failed to update admin.');
      }
    } catch (e) { console.error(e); setModalError('Connection error.'); }
  };

  // ── Reset Admin Password (auto-generate + email) ──────────────────────────────
  const handleResetAdminPassword = () => {
    if (!editAdmin.id || !editAdmin.email) return;
    setConfirmModalState({
      isOpen: true,
      title: 'Reset Admin Password',
      message: `Are you sure you want to reset the password for "${editAdmin.first_name} ${editAdmin.last_name}"? A new secure temporary password will be auto-generated and sent to ${editAdmin.email}.`,
      confirmText: 'Reset Password',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        setLoadingScreenState({
          isOpen: true,
          title: 'Resetting Admin Password...',
          subtitle: `Generating new temporary credentials and emailing ${editAdmin.email}...`
        });
        try {
          const res = await fetch(`${API_BASE_URL}/super_admin/admins/update_admin.php`, {
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
            },
            body: JSON.stringify({
              id: editAdmin.id,
              first_name: editAdmin.first_name,
              last_name: editAdmin.last_name,
              email: editAdmin.email,
              actor_id: user.id,
              reset_password: true,
            }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            setEditModalOpen(false);
            setEditAdmin({ id: '', first_name: '', last_name: '', email: '' });
            fetchAdmins();
            showSaveToast(data.message || 'Password reset! A new temporary password has been emailed to the admin.');
          } else {
            setModalError(data.message || 'Failed to reset password.');
          }
        } catch (e) {
          console.error(e);
          setModalError('Connection error.');
        } finally {
          setLoadingScreenState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleReactivateAdmin = (admin) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Confirm Admin Account Reactivation',
      message: `Are you sure you want to reactivate the admin account for "${admin.User_Fname} ${admin.User_Lname}"? The administrator will regain access to the portal.`,
      confirmText: 'Reactivate Account',
      cancelText: 'Cancel',
      type: 'primary',
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        try {
          const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
          const res = await fetch(`${API_BASE_URL}/super_admin/admins/reactivate_admin.php`, {
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
            },
            body: JSON.stringify({ id: admin.User_ID, actor_id: user?.id, actor_name: superAdminName }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            fetchAdmins();
            showSaveToast(data.message || 'Admin account reactivated.');
          } else {
            showToast(data.message || 'Failed to reactivate admin.', 'danger');
          }
        } catch (e) {
          console.error(e);
          showToast('Connection error while reactivating admin.', 'danger');
        }
      },
    });
  };

  // ── Deactivate Admin (Soft Delete — preserves audit integrity) ───────────────
  const handleDeactivateAdmin = () => {
    if (!editAdmin.id) return;
    setConfirmModalState({
      isOpen: true,
      title: 'Confirm Admin Account Deactivation',
      message: `Are you sure you want to deactivate the admin account for "${editAdmin.first_name} ${editAdmin.last_name}"? The administrator will immediately lose access to the portal. Their identity and audit trail history will remain permanently preserved in the system.`,
      confirmText: 'Deactivate Account',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        try {
          const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
          const res = await fetch(`${API_BASE_URL}/super_admin/admins/deactivate_admin.php`, {
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
            },
            body: JSON.stringify({ id: editAdmin.id, actor_id: user?.id, actor_name: superAdminName }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            setEditModalOpen(false);
            setEditAdmin({ id: '', first_name: '', last_name: '', email: '' });
            fetchAdmins();
            showSaveToast(data.message || 'Admin account deactivated.');
          } else {
            setModalError(data.message || 'Failed to deactivate admin.');
          }
        } catch (e) {
          console.error(e);
          setModalError('Connection error while deactivating admin.');
        }
      },
    });
  };

  // ── Helper to calculate end time based on start time & number of slots ──────
  const calculateEndTime = (startTimeVal, slotsCount) => {
    if (!startTimeVal) return '';
    const [h, m] = startTimeVal.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '';
    let totalMins = h * 60 + m + (slotsCount * 30);
    if (totalMins >= 24 * 60) {
      return '23:59';
    }
    let endH = Math.floor(totalMins / 60);
    let endM = totalMins % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const handleStartTimeChange = (startTimeVal, countVal = newSlot.num_slots) => {
    const count = Math.max(1, parseInt(countVal, 10) || 1);
    const updatedEnd = calculateEndTime(startTimeVal, count);
    setNewSlot(prev => ({ ...prev, start_time: startTimeVal, end_time: updatedEnd }));
    setSlotError('');

    if (startTimeRef.current) {
      if (startTimeVal && startTimeVal < '08:00') {
        startTimeRef.current.setCustomValidity('Value must be 8:00 AM or later.');
      } else {
        startTimeRef.current.setCustomValidity('');
      }
    }

    if (endTimeRef.current) {
      if (updatedEnd && updatedEnd > '17:00') {
        endTimeRef.current.setCustomValidity('Value must be 5:00 PM or earlier.');
        setTimeout(() => endTimeRef.current?.reportValidity(), 50);
      } else {
        endTimeRef.current.setCustomValidity('');
      }
    }
  };

  const handleNumSlotsChange = (numSlotsVal) => {
    const count = Math.max(1, parseInt(numSlotsVal, 10) || 1);
    const updatedEnd = calculateEndTime(newSlot.start_time, count);
    setNewSlot(prev => ({ ...prev, num_slots: count, end_time: updatedEnd }));
    setSlotError('');

    if (endTimeRef.current) {
      if (updatedEnd && updatedEnd > '17:00') {
        endTimeRef.current.setCustomValidity('Value must be 5:00 PM or earlier.');
        setTimeout(() => endTimeRef.current?.reportValidity(), 50);
      } else {
        endTimeRef.current.setCustomValidity('');
      }
    }
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    setSlotError('');
    if (!newSlot.date) {
      setSlotError('Please select an interview date (weekdays only).');
      return;
    }
    const slotDateObj = new Date(newSlot.date + 'T00:00:00');
    if (slotDateObj.getDay() === 0 || slotDateObj.getDay() === 6) {
      setSlotError('Weekends are disabled. Please select a weekday (Monday to Friday).');
      return;
    }
    const slotsCount = Math.max(1, parseInt(newSlot.num_slots, 10) || 1);
    if (!newSlot.start_time) {
      setSlotError('Please select a start time.');
      return;
    }
    const [startH, startM] = newSlot.start_time.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const requiredMinutes = slotsCount * 30;
    const endMinutes = startMinutes + requiredMinutes;

    if (startMinutes < 480) {
      if (startTimeRef.current) {
        startTimeRef.current.setCustomValidity('Value must be 8:00 AM or later.');
        startTimeRef.current.reportValidity();
      } else {
        setSlotError('Interview start time must be 8:00 AM or later.');
      }
      return;
    }

    if (endMinutes > 1020) {
      if (endTimeRef.current) {
        endTimeRef.current.setCustomValidity('Value must be 5:00 PM or earlier.');
        endTimeRef.current.reportValidity();
      } else {
        setSlotError('Interview end time must be 5:00 PM or earlier.');
      }
      return;
    }

    if (startMinutes + requiredMinutes > 24 * 60) {
      const hoursNeeded = (requiredMinutes / 60).toFixed(requiredMinutes % 60 === 0 ? 0 : 1);
      setSlotError(`Cannot create ${slotsCount} slots (${hoursNeeded} hours) starting at ${fmtTime(newSlot.start_time)}: schedule exceeds 23:59 for this date. Please select an earlier start time or reduce the number of slots.`);
      return;
    }

    const calculatedEnd = calculateEndTime(newSlot.start_time, slotsCount);
    if (!calculatedEnd) {
      setSlotError('Invalid time calculation. Please check start time and number of slots.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/slots/add_slot.php`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({
          ...newSlot,
          actor_id: user?.id,
          actor_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin'
        }),
      });
      const data = await res.json();
      if (res.ok && (data.status === 'success' || data.status === 'info')) {
        setSlotModalOpen(false);
        setNewSlot({ date: '', start_time: '09:00', end_time: '09:30', num_slots: 1 });
        setSlotError('');
        setSlotDayCount(null);
        fetchSlots();
        if (data.status === 'success') showSaveToast(data.message || 'Interview slot added!');
      } else {
        setSlotError(data.message || 'Failed to add interview slot.');
      }
    } catch (e) { console.error(e); setSlotError('Connection error while saving slot.'); }
  };

  const handleDeleteSlot = (slot_id) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Delete Interview Slot',
      message: 'Are you sure you want to delete this interview time slot?',
      confirmText: 'Delete Slot',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        try {
          const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
          const res = await fetch(`${API_BASE_URL}/super_admin/slots/delete_slot.php`, {
            method: 'POST', 
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
            },
            body: JSON.stringify({ slot_id, actor_id: user?.id, actor_name: superAdminName }),
          });
          const data = await res.json();
          if (res.ok && data.status === 'success') {
            showToast(data.message || 'Interview schedule slot deleted successfully.', 'success');
          } else {
            showToast(data.message || 'Failed to delete interview schedule slot.', 'danger');
          }
          fetchSlots();
          setCalSelectedDay(null);
        } catch (e) {
          console.error(e);
          showToast('Failed to delete interview schedule slot.', 'danger');
        }
      },
    });
  };

  const executeUpdateResult = async (application_id, result, remarks = '', extraData = {}) => {
    let loadTitle = 'Updating Status';
    let loadSubtitle = 'Saving candidate evaluation...';

    if (result === 'President Approved' || result === 'Approved for Job Offer') {
      loadTitle = "Granting President's Approval";
      loadSubtitle = "Recording President's approval and advancing to Job Offer queue...";
    } else if (result === 'PLACE_ON_STANDBY' || result === 'Passed Final — Waiting for Slot') {
      loadTitle = 'Placing on Priority Standby';
      loadSubtitle = 'Updating candidate status and notifying applicant...';
    } else if (result === 'Passed Final Approval') {
      loadTitle = "Approving Candidate";
      loadSubtitle = "Recording President's approval...";
    } else if (result === 'Requirement Pending' || result === 'Contract Signed & Onboarded' || result === 'CONTRACT_SIGNED') {
      loadTitle = 'Finalizing Contract';
      loadSubtitle = 'Marking contract executed and advancing to Requirement Pending...';
    } else if (result === 'Officially Hired' || result === 'Completed Requirements') {
      loadTitle = 'Clearing for Day 1';
      loadSubtitle = 'Finalizing requirements & confirming official hire...';
    } else if (result === 'Candidate Withdrew') {
      loadTitle = 'Recording Withdrawal';
      loadSubtitle = 'Updating candidate status...';
    } else if (result === 'Candidate No Show') {
      loadTitle = 'Recording No-Show';
      loadSubtitle = 'Updating interview status...';
    } else if (result === 'Offer Rejected' || result === 'OFFER_REJECTED') {
      loadTitle = 'Archiving Declined Offer';
      loadSubtitle = 'Moving candidate record to Application Audit Record...';
    }

    setLoadingScreenState({
      isOpen: true,
      title: loadTitle,
      subtitle: loadSubtitle
    });

    try {
      const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
      const payload = { application_id, result, actor_id: user?.id, actor_name: superAdminName, ...extraData };
      if (remarks) payload.remarks = remarks;

      const res = await fetch(`${API_BASE_URL}/super_admin/interviews/update_result.php`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === 'success') {
        await fetchInterviews(true);
        if (result === 'President Approved' || result === 'Approved for Job Offer') {
          setEvalTab('job_offer');
        }
        const isPositive = ['Passed Final Interview', 'President Approved', 'Approved for Job Offer', 'Passed Final Approval', 'HIRED', 'Requirements Verified', 'Completed Requirements', 'Partially Compliant', 'Officially Hired', 'Contract Signed & Onboarded', 'Requirement Pending', 'Requirements Pending', 'UNDO', 'PLACE_ON_STANDBY', 'Passed Final — Waiting for Slot'].includes(result);
        showSaveToast(data.message || `${result}. Candidate #${application_id}.`, isPositive ? 'success' : 'danger');
      } else {
        showToast(data.message || 'Failed to update candidate status.', 'danger');
      }
    } catch (e) {
      console.error(e);
      showToast('Connection error while updating evaluation.', 'danger');
    } finally {
      setLoadingScreenState(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleUpdateResult = (application_id, result, candidateName, candidateJob = '', extraData = {}) => {
    let modalTitle = 'Confirm Evaluation Decision';
    let modalMsg = `Are you sure you want to update the evaluation decision for "${candidateName}"?`;
    let confirmBtnText = 'Confirm Decision';
    let confirmBtnType = 'primary';

    if (result === 'Passed Final Interview' || result === 'PASS_FINAL_INTERVIEW') {
      modalTitle = 'Pass Final Interview';
      modalMsg = `Confirm passing "${candidateName}" for the final interview? This will forward the candidate to President's Review.`;
      confirmBtnText = 'Pass Candidate';
      confirmBtnType = 'primary';
    } else if (result === 'Failed Final Interview' || result === 'FAIL_FINAL_INTERVIEW' || result === 'INTERVIEW_FAILED' || result === 'rejected') {
      modalTitle = 'Fail Final Interview';
      modalMsg = `Confirm marking "${candidateName}" as Failed in the final interview?`;
      confirmBtnText = 'Fail Candidate';
      confirmBtnType = 'danger';
    } else if (result === 'President Approved' || result === 'Approved for Job Offer') {
      modalTitle = "President's Approval";
      modalMsg = `Are you sure you want to approve "${candidateName}" for "${candidateJob || 'this position'}"? The candidate will advance to the Job Offer tab with status "Ready for Offer".`;
      confirmBtnText = 'Grant Approval';
      confirmBtnType = 'primary';
    } else if (result === 'Passed Final Approval' || result === 'PASS_FINAL_APPROVAL' || result === 'HIRED') {
      modalTitle = "President's Final Approval";
      modalMsg = `Are you sure you want to approve "${candidateName}" for employment? This will grant President's final approval and advance the candidate to contract signing.`;
      confirmBtnText = 'Grant Approval';
      confirmBtnType = 'primary';
    } else if (result === 'Failed Final Approval' || result === 'FAIL_FINAL_APPROVAL') {
      modalTitle = 'Reject at Final Approval';
      modalMsg = `Confirm rejecting "${candidateName}" at President's Final Approval?`;
      confirmBtnText = 'Reject Candidate';
      confirmBtnType = 'danger';
    } else if (result === 'Candidate No Show' || result === 'CANDIDATE_NO_SHOW' || result === 'NO_SHOW') {
      modalTitle = 'Mark Candidate No Show';
      modalMsg = `Confirm marking "${candidateName}" as Candidate No Show?`;
      confirmBtnText = 'Mark No Show';
      confirmBtnType = 'danger';
    } else if (result === 'Candidate Withdrew' || result === 'CANDIDATE_WITHDREW') {
      modalTitle = 'Candidate Withdrawal';
      modalMsg = `Record voluntary withdrawal for "${candidateName}"?`;
      confirmBtnText = 'Record Withdrawal';
      confirmBtnType = 'secondary';
    } else if (result === 'Offer Rejected' || result === 'OFFER_REJECTED') {
      modalTitle = 'Confirm Offer Rejection';
      modalMsg = `Confirm acknowledging the declined job offer for "${candidateName}"? This will officially close the application and move it to the Application Audit Record.`;
      confirmBtnText = 'Confirm & Move to Audit';
      confirmBtnType = 'danger';
    } else if (result === 'Incomplete Requirements' || result === 'INCOMPLETE_REQUIREMENTS') {
      modalTitle = 'Incomplete Requirements';
      modalMsg = `Mark "${candidateName}" as Incomplete Requirements?`;
      confirmBtnText = 'Mark Incomplete';
      confirmBtnType = 'danger';
    } else if (result === 'Failed Pre-Employment' || result === 'FAILED_PRE_EMPLOYMENT') {
      modalTitle = 'Pre-Employment Failure';
      modalMsg = `Mark "${candidateName}" as Failed Pre-Employment?`;
      confirmBtnText = 'Mark Failed';
      confirmBtnType = 'danger';
    } else if (result === 'Requirements Verified' || result === 'VERIFY_REQUIREMENTS') {
      modalTitle = 'Verify Requirements';
      modalMsg = `Confirm all pre-employment requirements are verified for "${candidateName}"?`;
      confirmBtnText = 'Verify Requirements';
      confirmBtnType = 'primary';
    } else if (result === 'Requirement Pending' || result === 'Contract Signed & Onboarded' || result === 'CONTRACT_SIGNED') {
      modalTitle = 'Confirm Contract Execution';
      modalMsg = `Confirm employment contract signed for "${candidateName}" and advance status to Requirement Pending?`;
      confirmBtnText = 'Confirm Contract Signed';
      confirmBtnType = 'primary';
    } else if (result === 'Officially Hired' || result === 'Completed Requirements' || result === 'COMPLETED_REQUIREMENTS') {
      const formattedStart = extraData?.work_start_date
        ? new Date(extraData.work_start_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : 'scheduled date';
      modalTitle = 'Clear Candidate for Day 1 & Officially Hire';
      modalMsg = `Confirm all 6 pre-employment requirements are verified for "${candidateName}", schedule Day 1 starting on ${formattedStart}, and officially hire this candidate? This will send the Day 1 Cleared email and in-app guide.`;
      confirmBtnText = 'Clear for Day 1 & Hire';
      confirmBtnType = 'primary';
    } else if (result === 'Partially Compliant' || result === 'PARTIALLY_COMPLIANT') {
      modalTitle = 'Accept as Partially Compliant';
      modalMsg = `Accept "${candidateName}" with partial requirements and graduate candidate to Application Audit Records?`;
      confirmBtnText = 'Accept & Archive';
      confirmBtnType = 'warning';
    } else if (result === 'UNDO' || result === 'REVERT') {
      modalTitle = 'Revert Decision';
      modalMsg = `Revert the evaluation decision for "${candidateName}"?`;
      confirmBtnText = 'Revert Decision';
      confirmBtnType = 'secondary';
    }

    setConfirmModalState({
      isOpen: true,
      title: modalTitle,
      message: modalMsg,
      confirmText: confirmBtnText,
      cancelText: 'Cancel',
      type: confirmBtnType,
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        await executeUpdateResult(application_id, result, '', extraData);
      },
    });
  };

  const handlePresidentApprovalClick = (candidateItem, candidateName) => {
    const safeInterviews = Array.isArray(interviews) ? interviews : [];
    const waitlistedCandidates = safeInterviews.filter(c => 
      c.job_id === candidateItem.job_id && 
      ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes((c.status || '').toUpperCase())
    ).sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at || a.applied_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || b.applied_at || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.application_id || 0) - (b.application_id || 0);
    });
    const currentWaitlistCount = waitlistedCandidates.length;
    const isStandby = ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes((candidateItem.status || '').toUpperCase());

    let candidateWaitlistRank = 1;
    if (isStandby) {
      const idx = waitlistedCandidates.findIndex(c => c.application_id === candidateItem.application_id);
      candidateWaitlistRank = idx !== -1 ? idx + 1 : 1;
    }

    const rawAvailableSlots = candidateItem.available_slots !== undefined ? Math.max(0, candidateItem.available_slots) : 0;
    const unreservedSlots = Math.max(0, rawAvailableSlots - currentWaitlistCount);

    const isCapacityFull = candidateItem.available_slots !== undefined && (
      rawAvailableSlots <= 0 || (!isStandby && unreservedSlots <= 0)
    );

    if (isCapacityFull) {
      setSlotWarningModalState({
        isOpen: true,
        candidate: candidateItem,
        candidateName: candidateName,
        jobTitle: candidateItem.job_title || 'Position',
        totalSlots: candidateItem.total_slots || 1,
        occupiedSlots: candidateItem.occupied_slots || 1,
        activeHolderName: candidateItem.active_holder_name || '',
        activeHolderStatus: candidateItem.active_holder_status || 'Job Offer Extended',
        applicationId: candidateItem.application_id,
        nextQueueNumber: currentWaitlistCount + 1,
        isReservedForWaitlist: !isStandby && rawAvailableSlots > 0 && unreservedSlots <= 0,
        isAlreadyWaitlisted: isStandby,
        waitlistRank: candidateWaitlistRank
      });
    } else {
      handleUpdateResult(candidateItem.application_id, 'President Approved', candidateName, candidateItem.job_title);
    }
  };

  const handleBatchUpdateResult = (applicationIds, result) => {
    if (!applicationIds || applicationIds.length === 0) return;
    const count = applicationIds.length;
    let title = 'Confirm Batch Action';
    let msg = `Are you sure you want to apply "${result}" to ${count} selected candidate(s)?`;
    let confirmBtnText = 'Confirm Batch Action';
    let btnType = 'primary';

    if (result === 'Passed Final Interview') {
      title = 'Batch Pass Final Interview';
      msg = `Advance all ${count} selected candidate(s) to Final Approval?`;
      confirmBtnText = `Pass ${count} Candidates`;
    } else if (result === 'Failed Final Interview') {
      title = 'Batch Fail Final Interview';
      msg = `Mark all ${count} selected candidate(s) as Failed Final Interview?`;
      confirmBtnText = `Fail ${count} Candidates`;
      btnType = 'danger';
    } else if (result === 'Candidate No Show') {
      title = 'Batch Mark No Show';
      msg = `Mark all ${count} selected candidate(s) as Candidate No Show?`;
      confirmBtnText = `Mark ${count} as No Show`;
      btnType = 'danger';
    } else if (result === 'President Approved') {
      const safeList = Array.isArray(interviews) ? interviews : [];
      const selectedCandidates = applicationIds
        .map(id => safeList.find(x => x.application_id === id))
        .filter(Boolean);

      // Group selected candidates by position (job_id)
      const jobGroups = {};
      selectedCandidates.forEach(cand => {
        const jId = cand.job_id || 'unknown';
        if (!jobGroups[jId]) {
          const waitlistCountForJob = safeList.filter(c =>
            c.job_id === cand.job_id &&
            ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes((c.status || '').toUpperCase())
          ).length;
          const rawAvail = cand.available_slots !== undefined ? Math.max(0, cand.available_slots) : 0;
          const unreserved = Math.max(0, rawAvail - waitlistCountForJob);

          jobGroups[jId] = {
            jobId: jId,
            jobTitle: cand.job_title || 'Position',
            availableSlots: unreserved,
            totalSlots: cand.total_slots || 1,
            candidates: []
          };
        }
        jobGroups[jId].candidates.push(cand);
      });

      // Find all positions where selected candidates exceed available openings
      const conflictingJobs = Object.values(jobGroups).filter(
        group => group.candidates.length > group.availableSlots
      );

      if (conflictingJobs.length > 0) {
        setBatchSlotErrorModalState({
          isOpen: true,
          conflicts: conflictingJobs
        });
        return;
      }

      title = "Batch President's Approval";
      msg = `Grant President's Approval for all ${count} selected candidate(s)? They will advance to the Job Offer queue with status "Ready for Offer".`;
      confirmBtnText = `Approve ${count} Candidates`;
    } else if (result === 'Failed Final Approval') {
      const safeList = Array.isArray(interviews) ? interviews : [];
      const standbySelected = applicationIds
        .map(id => safeList.find(x => x.application_id === id))
        .filter(x => x && ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes((x.status || '').toUpperCase()));
      if (standbySelected.length > 0) {
        showToast(`Cannot batch reject: ${standbySelected.length} candidate(s) are on the priority waitlist. Waitlisted candidates cannot be rejected.`, 'warning');
        return;
      }
      title = "Batch Reject at Final Approval";
      msg = `Reject all ${count} selected candidate(s) at President's Final Approval?`;
      confirmBtnText = `Reject ${count} Candidates`;
      btnType = 'danger';
    }

    setConfirmModalState({
      isOpen: true,
      title,
      message: msg,
      confirmText: confirmBtnText,
      cancelText: 'Cancel',
      type: btnType,
      onConfirm: async () => {
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        setLoadingScreenState({
          isOpen: true,
          title: `Processing ${count} Candidates`,
          subtitle: `Recording decision "${result}"...`
        });

        try {
          const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
          const payload = {
            application_ids: applicationIds,
            result,
            actor_id: user?.id,
            actor_name: superAdminName
          };

          const res = await fetch(`${API_BASE_URL}/super_admin/interviews/update_result.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data.status === 'success') {
            await fetchInterviews(true);
            setSelectedFinalInterviewIds([]);
            setSelectedApprovalIds([]);
            if (result === 'President Approved') {
              setEvalTab('job_offer');
            }
            showToast(data.message || `Batch update completed successfully for ${count} candidate(s).`, 'success');
          } else if (data.status === 'BATCH_SLOT_EXCEEDED' && Array.isArray(data.conflicts)) {
            setBatchSlotErrorModalState({
              isOpen: true,
              conflicts: data.conflicts.map(c => ({
                jobId: c.job_id,
                jobTitle: c.job_title,
                availableSlots: c.available_slots,
                totalSlots: c.total_slots,
                candidates: (c.candidates || []).map(name => ({ candidate_name: name }))
              }))
            });
          } else {
            showToast(data.message || 'Batch update failed.', 'danger');
          }
        } catch (e) {
          console.error(e);
          showToast('Connection error during batch evaluation.', 'danger');
        } finally {
          setLoadingScreenState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleScheduleContractSigning = async (e) => {
    if (e) e.preventDefault();
    if (!contractModalCandidate) return;
    if (!contractDate) {
      if (contractDateRef.current) {
        contractDateRef.current.setCustomValidity('Please select a contract signing date.');
        contractDateRef.current.reportValidity();
      }
      return;
    }
    const cDay = new Date(contractDate + 'T00:00:00').getDay();
    if (cDay === 0 || cDay === 6) {
      if (contractDateRef.current) {
        contractDateRef.current.setCustomValidity('Weekends are disabled. Contract signing can only be scheduled on weekdays (Monday to Friday).');
        contractDateRef.current.reportValidity();
      }
      return;
    }
    if (!contractTime) {
      showToast('Please specify a scheduled time.', 'warning');
      return;
    }
    const parts = contractTime.split(':').map(Number);
    if (parts.length >= 2) {
      const totalM = parts[0] * 60 + parts[1];
      if (totalM < 480 || totalM >= 1020) {
        showToast('Contract signing must be scheduled between 8:00 AM and before 5:00 PM (office closes at 5:00 PM).', 'warning');
        return;
      }
    }
    setContractSubmitting(true);
    setContractScheduleError(null);
    try {
      const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
      const res = await fetch(`${API_BASE_URL}/super_admin/interviews/schedule_contract_signing.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({
          application_id: contractModalCandidate.id,
          scheduled_date: contractDate,
          scheduled_time: contractTime,
          location: contractLocation,
          notes: contractNotes,
          actor_id: user?.id || 0,
          actor_name: superAdminName
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        const candName = data.candidate_name || contractModalCandidate?.candidate_name || contractModalCandidate?.name || 'Candidate';
        showSaveToast(data.message || `Contract Signing Scheduled. ${candName}.`, 'success');
        setContractModalCandidate(null);
        setContractScheduleError(null);
        await fetchInterviews(true);
      } else {
        showToast(data.message || 'Failed to schedule contract signing.', 'danger');
        setContractScheduleError(data.message || 'Schedule conflict: A contract signing appointment is already scheduled at this date and time.');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error while scheduling contract signing.', 'danger');
      setContractScheduleError('Connection error while scheduling contract signing.');
    } finally {
      setContractSubmitting(false);
    }
  };

  const handleLogout = () => setShowLogoutConfirm(true);
  const confirmLogoutAction = () => {
    setShowLogoutConfirm(false);
    localStorage.removeItem('hiring_token');
    localStorage.removeItem('hiring_user');
    navigate('/login');
  };

  // ── Session Auto-Timeout on Inactivity (30 Minutes) ───────────────────────
  // OWASP Session Management Standard: Super Admin sessions auto-expire after
  // 30 minutes of no mouse/keyboard/touch activity to protect sensitive data.
  const handleInactivityTimeout = useCallback(() => {
    localStorage.removeItem('hiring_token');
    localStorage.removeItem('hiring_user');
    window.location.href = '/login?reason=inactivity';
  }, []);

  const { sessionExpiring, resetTimer } = useInactivityTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    warningMs: 2 * 60 * 1000, // Warn 2 minutes before
    onTimeout: handleInactivityTimeout,
  });
  // ──────────────────────────────────────────────────────────────────────────

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const buildSlotsByDate = () => {
    const map = {};
    slots.forEach(s => {
      const key = s.date; // 'YYYY-MM-DD'
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  };

  const fmtTime = (t) => {
    if (!t) return '';
    const parts = t.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minute} ${ampm}`;
  };

  const padDate = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // ── Style constants ───────────────────────────────────────────────────────
  const MODAL_OVERLAY = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 };
  const MODAL_CARD = { background: '#ffffff', borderRadius: '18px', width: '480px', maxWidth: '94%', padding: '30px 32px', boxShadow: '0 24px 40px rgba(0,0,0,0.18)', fontFamily: "'Inter', sans-serif" };
  const MODAL_HEADER = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' };
  const MODAL_TITLE = { fontFamily: "'Montserrat', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 };
  const MODAL_SUB = { fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' };
  const MODAL_CLOSE = { background: 'none', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 };
  const LABEL_STYLE = { display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' };
  const BTN_CANCEL = { padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" };
  const BTN_PRIMARY = { padding: '9px 22px', borderRadius: '8px', border: 'none', background: '#e6007e', color: '#ffffff', fontWeight: '700', fontSize: '13.5px', cursor: 'pointer', fontFamily: "'Montserrat', sans-serif", boxShadow: '0 4px 14px rgba(230,0,126,0.35)' };

  // ── Sidebar nav sections ──────────────────────────────────────────────────
  const SIDEBAR_SECTIONS = [
    {
      category: 'ADMINISTRATION',
      items: [
        { key: 'admins', label: 'Administrative Access', icon: 'bx-user-check' },
        { key: 'audit', label: 'System Audit Trail', icon: 'bx-shield-quarter' },
      ]
    },
    {
      category: 'RECRUITMENT SETUP',
      items: [
        { key: 'jobs', label: 'Job Postings', icon: 'bx-briefcase' },
        { key: 'slots', label: 'Interview Schedule', icon: 'bx-calendar-plus' },
      ]
    },
    {
      category: 'INITIAL SCREENING',
      items: [
        { key: 'applicants', label: 'Initial Interview', icon: 'bx-file-find' },
        { key: 'interviews', label: 'Interview Management', icon: 'bx-calendar-check' },
      ]
    },
    {
      category: 'FINAL EVALUATION & HIRING',
      items: [
        { key: 'results', label: 'Candidate Evaluation', icon: 'bx-trophy' },
        { key: 'resumes', label: 'Candidate Credentials', icon: 'bx-id-card' },
      ]
    },
    {
      category: 'APPLICANT RECORDS',
      items: [
        { key: 'master_list', label: 'Application Audit Records', icon: 'bx-file' },
      ]
    },
    {
      category: 'KNOWLEDGE BASE',
      items: [
        { key: 'chatbot_kb', label: 'Chatbot Intelligence', icon: 'bx-bot' },
      ]
    }
  ];

  if (!user) {
    return (
      <PageLoadingScreen
        title="Super Admin Workspace"
        subtitle="Verifying authorization and loading platform controls..."
      />
    );
  }

  // ── Expanded & Modern Calendar render ─────────────────────────────────────
  const renderCalendar = () => {
    const slotsByDate = buildSlotsByDate();
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const selectedDaySlots = calSelectedDay ? (slotsByDate[calSelectedDay] || []) : [];

    return (
      <div style={{ display: 'flex', gap: '22px', alignItems: 'stretch', width: '100%', minHeight: '620px' }}>
        {/* Calendar grid container */}
        <div style={{ flex: 1, background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>

          {/* Calendar Top Navigation Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', background: '#f8fafc', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                    else setCalMonth(m => m - 1);
                    setCalSelectedDay(null);
                  }}
                  style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Previous Month"
                >
                  <i className="bx bx-chevron-left" style={{ fontSize: '20px' }}></i>
                </button>
                <button
                  onClick={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                    else setCalMonth(m => m + 1);
                    setCalSelectedDay(null);
                  }}
                  style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '7px', padding: '6px 12px', cursor: 'pointer', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Next Month"
                >
                  <i className="bx bx-chevron-right" style={{ fontSize: '20px' }}></i>
                </button>
              </div>
              <button
                onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); setCalSelectedDay(null); }}
                style={{ background: 'rgba(230,0,126,0.08)', color: '#e6007e', border: '1px solid rgba(230,0,126,0.3)', borderRadius: '8px', padding: '6px 14px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
              >
                Today
              </button>
            </div>

            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: '800', fontSize: '20px', color: '#0f172a', margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {MONTH_NAMES[calMonth]} {calYear}
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e6007e', display: 'inline-block' }} />
              </h2>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }}></span>
                <span>Open Slots</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b' }}></span>
                <span>Booked Slots</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f1f5f9', border: '1px dashed #cbd5e1' }}></span>
                <span>Weekend (Disabled)</span>
              </div>
            </div>
          </div>

          {/* Day Names Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {DAY_NAMES.map((d, idx) => {
              const isWeekendHeader = idx === 0 || idx === 6;
              return (
                <div
                  key={d}
                  style={{
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: '800',
                    color: isWeekendHeader ? '#94a3b8' : '#64748b',
                    letterSpacing: '0.8px',
                    padding: '6px 0',
                    textTransform: 'uppercase',
                    background: isWeekendHeader ? '#f1f5f9' : '#f8fafc',
                    borderRadius: '6px'
                  }}
                >
                  {d}
                </div>
              );
            })}
          </div>

          {/* Expanded Grid Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', flex: 1 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} style={{ background: '#f8fafc', borderRadius: '12px', opacity: 0.4 }} />;
              const dateStr = padDate(calYear, calMonth, day);
              const dayOfWeek = new Date(calYear, calMonth, day).getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              const daySlots = slotsByDate[dateStr] || [];
              const hasSlots = daySlots.length > 0;
              const openCount = daySlots.filter(s => s.status === 'Open').length;
              const bookedCount = daySlots.length - openCount;
              const isToday = dateStr === today.toISOString().split('T')[0];
              const isSelected = dateStr === calSelectedDay;

              // Weekend cell styling: disabled with light color tint
              if (isWeekend) {
                return (
                  <div
                    key={day}
                    style={{
                      borderRadius: '12px',
                      padding: '10px 8px',
                      textAlign: 'left',
                      cursor: 'not-allowed',
                      background: '#f1f5f9',
                      border: '1.5px dashed #cbd5e1',
                      minHeight: '85px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: 0.85,
                      userSelect: 'none'
                    }}
                    title="Weekends are disabled for interview slots"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '15px', fontWeight: '700', color: '#94a3b8' }}>
                        {day}
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: '800', background: '#e2e8f0', color: '#64748b', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        Closed
                      </span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic', marginTop: 'auto' }}>
                      Weekend
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={day}
                  onClick={() => hasSlots ? setCalSelectedDay(isSelected ? null : dateStr) : null}
                  style={{
                    borderRadius: '12px',
                    padding: '10px 8px',
                    textAlign: 'left',
                    cursor: hasSlots ? 'pointer' : 'default',
                    background: isSelected ? '#fff0f7' : isToday ? '#fff5fa' : hasSlots ? '#ffffff' : '#fafafa',
                    border: isSelected ? '2.5px solid #e6007e' : isToday ? '2px solid rgba(230, 0, 126, 0.4)' : hasSlots ? '1.5px solid #cbd5e1' : '1px solid #f1f5f9',
                    boxShadow: isSelected ? '0 6px 16px rgba(230, 0, 126, 0.2)' : hasSlots ? '0 2px 6px rgba(0,0,0,0.03)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    minHeight: '85px',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '15px', fontWeight: isToday || isSelected ? '800' : '700', color: isSelected ? '#e6007e' : isToday ? '#e6007e' : '#0f172a' }}>
                      {day}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: '9px', fontWeight: '800', background: '#e6007e', color: '#fff', padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        Today
                      </span>
                    )}
                  </div>

                  {hasSlots ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                      {openCount > 0 && (
                        <div style={{
                          fontSize: '10.5px', fontWeight: '700',
                          background: '#d1fae5',
                          color: '#047857',
                          border: '1px solid #a7f3d0',
                          borderRadius: '6px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <i className="bx bx-time-five" style={{ fontSize: '12px' }}></i>
                          <span>{openCount} Open</span>
                        </div>
                      )}
                      {bookedCount > 0 && (
                        <div style={{
                          fontSize: '10.5px', fontWeight: '700',
                          background: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a',
                          borderRadius: '6px', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <i className="bx bx-user-check" style={{ fontSize: '12px' }}></i>
                          <span>{bookedCount} Booked</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic', marginTop: 'auto' }}>No slots</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail Panel */}
        <div style={{ width: '310px', background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
          {!calSelectedDay ? (
            <div style={{ textAlign: 'center', padding: '60px 10px', color: '#94a3b8', margin: 'auto 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', color: '#e6007e' }}>
                <i className="bx bx-calendar-event" style={{ fontSize: '28px' }}></i>
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>No Date Selected</h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                Click on any calendar day with interview slots to view specific time details and manage slots.
              </p>
            </div>
          ) : (
            <>
              <div style={{ borderBottom: '1.5px solid #f1f5f9', paddingBottom: '14px', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#e6007e', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '3px' }}>
                  Slot Schedule Details
                </span>
                <h4 style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: '800', fontSize: '15px', color: '#0f172a' }}>
                  {new Date(calSelectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </h4>
              </div>

              {selectedDaySlots.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '13px' }}>No slots recorded for this date.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
                  {selectedDaySlots.map(s => (
                    <div key={s.slot_id} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '13.5px', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>
                          {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                        </div>
                        {s.applicant_name ? (
                          <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '700', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="bx bx-user" style={{ fontSize: '14px' }} />
                            {s.applicant_name} {s.job_title ? `(${s.job_title})` : ''}
                          </div>
                        ) : (
                          <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: '600', marginTop: '3px' }}>
                            Available (Unassigned)
                          </div>
                        )}
                        <span style={{
                          display: 'inline-block', marginTop: '5px', padding: '2px 8px', borderRadius: '12px',
                          fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.3px',
                          background: s.status === 'Open' ? '#d1fae5' : '#fef3c7',
                          color: s.status === 'Open' ? '#047857' : '#b45309',
                          border: s.status === 'Open' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                        }}>
                          {s.status.toUpperCase()}
                        </span>
                      </div>
                      {s.status === 'Open' && (
                        <button
                          onClick={() => handleDeleteSlot(s.slot_id)}
                          style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: '7px', cursor: 'pointer', fontWeight: '700', fontSize: '11.5px', fontFamily: "'Inter', sans-serif", display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Delete slot"
                        >
                          <i className="bx bx-trash" style={{ fontSize: '14px' }}></i> Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

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
            Super Admin
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

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar superadmin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100vh' }}>
        <div>
          {/* Brand Logo Header (No box border, clean transparent logo) */}
          <div className="admin-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div className="admin-sidebar-logo-row">
                <img src={logoImg} alt="Airship Express" className="admin-sidebar-logo-img" />
                <span className="admin-brand-name">AIRSHIP EXPRESS</span>
              </div>
              <button
                type="button"
                className="admin-mobile-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close sidebar"
              >
                <i className="bx bx-x" style={{ fontSize: '22px' }}></i>
              </button>
            </div>
            <div>
              <h2 className="admin-sidebar-title">Super Admin</h2>
              <span className="admin-brand-platform">Hiring Platform Control</span>
            </div>
          </div>

          {/* Categorized Menu Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {SIDEBAR_SECTIONS.map((section, sIdx) => (
              <div key={sIdx} className="superadmin-sidebar-section">
                <div className="admin-sidebar-section-label">
                  {section.category}
                </div>
                <ul className="admin-sidebar-menu">
                  {section.items.map(item => {
                    const isActive = activeTab === item.key;
                    return (
                      <li key={item.key}>
                        <span
                          className={`admin-menu-item ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            setActiveTab(item.key);
                            setMobileMenuOpen(false);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="admin-menu-left">
                            <i className={`bx ${item.icon}`} style={{ fontSize: '16px', flexShrink: 0, color: isActive ? '#f472b6' : '#94a3b8' }}></i>
                            <span className="admin-menu-text">{item.label}</span>
                          </div>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Footer Profile */}
        <div className="superadmin-sidebar-footer">
          {/* Admin Profile Card */}
          <div className="admin-sidebar-profile" title={user?.email || 'Super Administrator'}>
            <div className="admin-profile-avatar" style={{ background: 'linear-gradient(135deg, #e6007e 0%, #3b82f6 100%)' }}>
              {(((user?.first_name || user?.User_Fname || 'S').charAt(0)) + ((user?.last_name || user?.User_Lname || 'A').charAt(0))).toUpperCase()}
            </div>
            <div className="admin-profile-info">
              <span className="admin-profile-name">{`${user?.first_name || user?.User_Fname || 'Super'} ${user?.last_name || user?.User_Lname || 'Admin'}`.trim()}</span>
              <span className="admin-profile-role">
                <span className="admin-profile-status-dot"></span>
                Super Admin
              </span>
            </div>
          </div>

          {/* 2FA Security Action */}
          <span 
            className="admin-menu-item" 
            onClick={() => setShowMfaModal(true)} 
            style={{ cursor: 'pointer', justifyContent: 'flex-start', gap: '10px', marginTop: '4px' }}
            title="Configure Google Authenticator Two-Factor Authentication"
          >
            <i className="bx bx-shield-quarter" style={{ fontSize: '18px', flexShrink: 0, color: '#e6007e' }}></i>
            <span className="admin-menu-text" style={{ fontWeight: '500' }}>2FA Security</span>
          </span>

          <span className="admin-menu-item logout-item" onClick={handleLogout} style={{ cursor: 'pointer', justifyContent: 'flex-start', gap: '10px' }}>
            <i className="bx bx-log-out" style={{ fontSize: '16px', flexShrink: 0 }}></i>
            <span className="admin-menu-text">Sign Out</span>
          </span>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="admin-main-content">

        {/* ── Manage Admins Tab ── */}
        {activeTab === 'admins' && (() => {
          const activeAdmins = admins.filter(a => (a.status || 'Active').toLowerCase() === 'active');
          const inactiveAdmins = admins.filter(a => (a.status || '').toLowerCase() === 'inactive');
          const displayedAdmins = adminStatusTab === 'active' ? activeAdmins : inactiveAdmins;

          return (
            <>
              <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 className="admin-header-title">Manage Admin Accounts</h1>
                  <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                    Create, update, and manage authorized administrative portal accounts.
                  </p>
                </div>
                <button
                  style={{ ...BTN_PRIMARY, display: 'inline-flex', alignItems: 'center', gap: '7px' }}
                  onClick={() => { setModalError(''); setAdminModalOpen(true); }}
                >
                  <i className="bx bx-user-plus" style={{ fontSize: '17px' }}></i> Add Admin
                </button>
              </div>

              {/* Status Filter Tabs: Active Admins | Inactive Admins */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setAdminStatusTab('active')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: adminStatusTab === 'active' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                    background: adminStatusTab === 'active' ? '#0f172a' : '#ffffff',
                    color: adminStatusTab === 'active' ? '#ffffff' : '#64748b',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: adminStatusTab === 'active' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  Active Admins
                  <span style={{
                    background: adminStatusTab === 'active' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                    color: adminStatusTab === 'active' ? '#ffffff' : '#475569',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11.5px',
                    fontWeight: '800'
                  }}>
                    {activeAdmins.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminStatusTab('inactive')}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: adminStatusTab === 'inactive' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                    background: adminStatusTab === 'inactive' ? '#0f172a' : '#ffffff',
                    color: adminStatusTab === 'inactive' ? '#ffffff' : '#64748b',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: adminStatusTab === 'inactive' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                  Deactivated Admins
                  <span style={{
                    background: adminStatusTab === 'inactive' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                    color: adminStatusTab === 'inactive' ? '#ffffff' : '#475569',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11.5px',
                    fontWeight: '800'
                  }}>
                    {inactiveAdmins.length}
                  </span>
                </button>
              </div>

              <div className="admin-table-card">
                {loading ? (
                  <TableSkeleton
                    columns={['Administrator', 'Email Address', 'Account Role', 'Status', 'Actions']}
                    rows={4}
                    hasAvatar={true}
                    hasActions={true}
                  />
                ) : tabError ? (
                  <DatabaseErrorState
                    title="Unable to Load Admin Accounts"
                    message={tabError}
                    onRetry={fetchAdmins}
                  />
                ) : displayedAdmins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 24px', background: '#ffffff', borderRadius: '12px' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: adminStatusTab === 'active' ? 'rgba(230,0,126,0.08)' : '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', color: adminStatusTab === 'active' ? '#e6007e' : '#64748b' }}>
                      <i className={`bx ${adminStatusTab === 'active' ? 'bx-user-x' : 'bx-archive'}`} style={{ fontSize: '26px' }}></i>
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15.5px', fontWeight: '700', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>
                      {adminStatusTab === 'active' ? 'No Active Admin Accounts' : 'No Deactivated Admin Accounts'}
                    </h4>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
                      {adminStatusTab === 'active'
                        ? 'Get started by creating authorized admin accounts to oversee recruitment and scheduling.'
                        : 'Deactivated administrator accounts will appear here. You can reactivate them at any time.'}
                    </p>
                    {adminStatusTab === 'active' && (
                      <button style={{ ...BTN_PRIMARY, display: 'inline-flex', alignItems: 'center', gap: '7px' }} onClick={() => { setModalError(''); setAdminModalOpen(true); }}>
                        <i className="bx bx-user-plus" style={{ fontSize: '17px' }}></i> Add Admin Account
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Email</th><th>ROLE</th><th>Status</th><th>Created At</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedAdmins.map(a => {
                        const isInactive = (a.status || '').toLowerCase() === 'inactive';
                        const isPendingSetup = parseInt(a.requires_password_reset) === 1;

                        return (
                          <tr key={a.User_ID} style={{ opacity: isInactive ? 0.75 : 1 }}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '34px', height: '34px', borderRadius: '50%',
                                  background: isInactive ? '#f1f5f9' : 'rgba(230,0,126,0.12)',
                                  border: isInactive ? '1.5px solid #cbd5e1' : '1.5px solid rgba(230,0,126,0.3)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: isInactive ? '#64748b' : '#e6007e' }}>
                                    {(a.User_Fname?.[0] || '').toUpperCase()}
                                  </span>
                                </div>
                                <strong style={{ color: isInactive ? '#64748b' : '#0f172a', fontSize: '13.5px' }}>
                                  {a.User_Fname} {a.User_Lname}
                                </strong>
                              </div>
                            </td>
                            <td style={{ color: isInactive ? '#94a3b8' : '#475569', fontSize: '13px' }}>{a.User_Email}</td>
                            <td>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                background: isInactive ? '#f1f5f9' : '#eff6ff',
                                color: isInactive ? '#64748b' : '#1d4ed8',
                                border: isInactive ? '1px solid #cbd5e1' : '1px solid #bfdbfe',
                                borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700',
                                textTransform: 'uppercase', letterSpacing: '0.4px'
                              }}>
                                <i className="bx bx-shield-alt-2" style={{ fontSize: '13px' }}></i> Admin
                              </span>
                            </td>
                            <td>
                              {isInactive ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '20px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Deactivated
                                </span>
                              ) : isPendingSetup ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '20px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Pending Setup
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '3px 10px', fontSize: '11.5px', fontWeight: '700' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Active
                                </span>
                              )}
                            </td>
                            <td style={{ color: '#64748b', fontSize: '13px' }}>
                              {new Date(a.Created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isInactive ? (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px' }}>
                                  <button
                                    style={{
                                      background: '#f0fdf4',
                                      color: '#15803d',
                                      border: '1.5px solid #bbf7d0',
                                      padding: '5px 12px',
                                      borderRadius: '7px',
                                      cursor: 'pointer',
                                      fontWeight: '700',
                                      fontSize: '12px',
                                      fontFamily: "'Inter', sans-serif",
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      boxShadow: '0 1px 2px rgba(21, 128, 61, 0.05)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onClick={() => handleReactivateAdmin(a)}
                                    title="Reactivate this admin account to restore portal access"
                                  >
                                    <i className="bx bx-refresh" style={{ fontSize: '15px' }}></i> Reactivate
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button
                                    style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '5px 13px', borderRadius: '7px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif", display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    onClick={() => { setModalError(''); setEditAdmin({ id: a.User_ID, first_name: a.User_Fname, last_name: a.User_Lname, email: a.User_Email }); setEditModalOpen(true); }}
                                    title="Update Admin details, reset password, or deactivate account"
                                  >
                                    <i className="bx bx-edit" style={{ fontSize: '14px' }}></i> Update
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          );
        })()}

        {/* ── Job Postings Tab ── */}
        {activeTab === 'jobs' && <JobsTab showToast={showToast} />}

        {/* ── Candidate Credentials Tab ── */}
        {activeTab === 'resumes' && (() => {
          const filteredResumes = resumes.filter(r => {
            if (!resumeSearch.trim()) return true;
            const q = resumeSearch.toLowerCase().trim();
            const name = (r.candidate_name || `${r.User_Fname || ''} ${r.User_Lname || ''}`).toLowerCase();
            const title = (r.job_title || '').toLowerCase();
            const email = (r.candidate_email || r.User_Email || '').toLowerCase();
            const mobile = (r.candidate_mobile || r.User_Mobile || '').toLowerCase();
            const status = (r.status || '').toLowerCase();
            return name.includes(q) || title.includes(q) || email.includes(q) || mobile.includes(q) || status.includes(q);
          });

          const RESUME_PAGE_SIZE = 8;
          const resumeTotalPages = Math.max(1, Math.ceil(filteredResumes.length / RESUME_PAGE_SIZE));
          const resumeCurrentPage = Math.min(resumePage, resumeTotalPages);
          const paginatedResumes = filteredResumes.slice((resumeCurrentPage - 1) * RESUME_PAGE_SIZE, resumeCurrentPage * RESUME_PAGE_SIZE);

          return (
            <>
              <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h1 className="admin-header-title">Candidate Credentials &amp; Profiles</h1>
                  <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                    Structured candidate dossiers, competencies, and AI-evaluated resumes for screened applicants.
                  </p>
                </div>

                {/* Top Search Bar */}
                <div
                  className="admin-search-wrapper"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    maxWidth: '380px',
                    flex: 'none',
                    height: '40px'
                  }}
                >
                  <i
                    className="bx bx-search"
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '18px',
                      color: '#94a3b8',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type="text"
                    value={resumeSearch}
                    onChange={(e) => { setResumeSearch(e.target.value); setResumePage(1); }}
                    placeholder="Search candidate, email, contact #, or position..."
                    style={{
                      width: '100%',
                      height: '40px',
                      padding: '0 36px 0 40px',
                      borderRadius: '8px',
                      border: '1.5px solid #e2e8f0',
                      fontSize: '13px',
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'border-color 0.15s ease'
                    }}
                  />
                  {resumeSearch && (
                    <button
                      type="button"
                      onClick={() => { setResumeSearch(''); setResumePage(1); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '15px'
                      }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-table-card">
                {loading ? (
                  <TableSkeleton
                    columns={['Candidate Name', 'Contact Details', 'Applied Position', 'Match Score', 'Status', 'Actions']}
                    rows={5}
                    hasAvatar={true}
                    hasActions={true}
                  />
                ) : tabError ? (
                  <DatabaseErrorState
                    title="Unable to Load Candidate Credentials"
                    message={tabError}
                    onRetry={fetchResumes}
                  />
                ) : paginatedResumes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '64px 24px', background: '#ffffff', borderRadius: '12px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(230,0,126,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', color: '#e6007e' }}>
                      <i className="bx bx-file-find" style={{ fontSize: '28px' }}></i>
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>
                      {resumeSearch ? 'No Candidates Match Your Search' : 'No Screened Applicants Yet'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
                      {resumeSearch
                        ? `No applicants found matching "${resumeSearch}". Try modifying your search term.`
                        : 'Applicants will appear here after they pass the initial screening stage in the system.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                          <th style={{ padding: '14px 18px', textAlign: 'left', width: '22%' }}>Candidate Name</th>
                          <th style={{ padding: '14px 18px', textAlign: 'left', width: '24%' }}>Contact Details</th>
                          <th style={{ padding: '14px 18px', textAlign: 'left', width: '18%' }}>Position Applied</th>
                          <th style={{ padding: '14px 18px', textAlign: 'center', width: '12%' }}>AI Match Score</th>
                          <th style={{ padding: '14px 18px', textAlign: 'center', width: '14%' }}>Evaluation Status</th>
                          <th style={{ padding: '14px 18px', textAlign: 'center', width: '10%' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedResumes.map(r => {
                          const name = r.candidate_name || `${r.User_Fname || ''} ${r.User_Lname || ''}`.trim() || 'Candidate';
                          const email = r.candidate_email || r.User_Email || '';
                          const mobile = r.candidate_mobile || r.User_Mobile || '';
                          const score = r.ai_match_score !== null && r.ai_match_score !== undefined ? Number(r.ai_match_score) : null;

                          // Evaluation Status Badge config
                          const normStatus = (r.status || '').toUpperCase().trim();
                          let statusBadgeBg = '#fef3c7';
                          let statusBadgeColor = '#b45309';
                          let statusBadgeBorder = '#fde68a';
                          let statusLabel = r.status || 'PENDING';

                          if (normStatus === 'PASSED INITIAL' || normStatus === 'PASSED' || normStatus === 'PASSED INITIAL SCREENING' || normStatus === 'PENDING SCHEDULED' || normStatus === 'PENDING_SCHEDULED' || normStatus === 'PENDING SCHEDULE') {
                            statusBadgeBg = '#ecfdf5';
                            statusBadgeColor = '#047857';
                            statusBadgeBorder = '#a7f3d0';
                            statusLabel = 'PASSED INITIAL SCREENING';
                          } else if (normStatus === 'INTERVIEW_SCHEDULED' || normStatus === 'INTERVIEW SCHEDULED' || normStatus === 'CONFIRMED' || normStatus === 'CONFIRMED SCHEDULE') {
                            statusBadgeBg = '#ecfdf5';
                            statusBadgeColor = '#065f46';
                            statusBadgeBorder = '#6ee7b7';
                            statusLabel = 'CONFIRMED SCHEDULE';
                          } else if (normStatus === 'RESCHEDULING' || normStatus === 'RESCHEDULE_REQUESTED' || normStatus === 'RESCHEDULE REQUESTED' || normStatus === 'RESCHEDULING REQUESTED') {
                            statusBadgeBg = '#fffbeb';
                            statusBadgeColor = '#b45309';
                            statusBadgeBorder = '#fde68a';
                            statusLabel = 'RESCHEDULING REQUESTED';
                          } else if (normStatus.includes('REJECT') || normStatus.includes('FAILED')) {
                            statusBadgeBg = '#fef2f2';
                            statusBadgeColor = '#b91c1c';
                            statusBadgeBorder = '#fecaca';
                            statusLabel = 'REJECTED';
                          }

                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              {/* 1. Candidate Name */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    background: 'rgba(230,0,126,0.08)',
                                    border: '1.5px solid rgba(230,0,126,0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#e6007e' }}>
                                      {(name[0] || '').toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <strong style={{ color: '#0f172a', fontSize: '13.5px', display: 'block', lineHeight: 1.3 }}>
                                      {name}
                                    </strong>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Contact Details (Email + Contact/Mobile Number, rendered as applicant input) */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {email ? (
                                    <span style={{ fontSize: '12px', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                      <i className="bx bx-envelope" style={{ fontSize: '13px', color: '#64748b' }}></i>
                                      {email}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>No email</span>
                                  )}
                                  {mobile ? (
                                    <span style={{ fontSize: '12px', color: '#334155', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                      <i className="bx bx-phone" style={{ fontSize: '13px', color: '#64748b' }}></i>
                                      {mobile}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>No contact #</span>
                                  )}
                                </div>
                              </td>

                              {/* 3. Position Applied */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                <strong style={{ color: '#0f172a', fontSize: '13px' }}>{r.job_title}</strong>
                              </td>

                              {/* 4. AI Match Score Badge */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                {score !== null ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    background: score >= 80 ? '#ecfdf5' : (score >= 50 ? '#fef3c7' : '#fef2f2'),
                                    color: score >= 80 ? '#047857' : (score >= 50 ? '#b45309' : '#b91c1c'),
                                    border: score >= 80 ? '1px solid #a7f3d0' : (score >= 50 ? '1px solid #fde68a' : '1px solid #fecaca')
                                  }}>
                                    <i className={`bx ${score >= 80 ? 'bx-check-circle' : (score >= 50 ? 'bx-trending-up' : 'bx-error-circle')}`} style={{ fontSize: '14px' }}></i>
                                    {score}%
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '11.5px',
                                    fontWeight: '600',
                                    background: '#f1f5f9',
                                    color: '#64748b'
                                  }}>
                                    N/A
                                  </span>
                                )}
                              </td>

                              {/* 5. Evaluation Status Badge */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 12px',
                                  borderRadius: '20px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: statusBadgeColor,
                                  backgroundColor: statusBadgeBg,
                                  border: `1px solid ${statusBadgeBorder}`,
                                  fontFamily: "'Montserrat', sans-serif",
                                  letterSpacing: '0.4px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {statusLabel}
                                </span>
                              </td>

                              {/* 6. Action Button */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                <button
                                  style={{
                                    background: '#0f172a',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '7px 16px',
                                    borderRadius: '7px',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    fontSize: '12px',
                                    fontFamily: "'Inter', sans-serif",
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.15s ease',
                                    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)'
                                  }}
                                  onClick={() => setSelectedResume(r)}
                                >
                                  <i className="bx bx-show" style={{ fontSize: '15px' }}></i> View Profile
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {filteredResumes.length > 0 && (
                      <div style={{
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #e2e8f0',
                        background: '#ffffff',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
                          Showing <strong>{(resumeCurrentPage - 1) * RESUME_PAGE_SIZE + 1}</strong> to <strong>{Math.min(resumeCurrentPage * RESUME_PAGE_SIZE, filteredResumes.length)}</strong> of <strong>{filteredResumes.length}</strong> candidate(s)
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            disabled={resumeCurrentPage <= 1}
                            onClick={() => setResumePage(prev => Math.max(1, prev - 1))}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: resumeCurrentPage <= 1 ? '#f8fafc' : '#ffffff',
                              color: resumeCurrentPage <= 1 ? '#94a3b8' : '#334155',
                              cursor: resumeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Previous
                          </button>

                          {Array.from({ length: resumeTotalPages }, (_, idx) => idx + 1).map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setResumePage(p)}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                border: resumeCurrentPage === p ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                                background: resumeCurrentPage === p ? '#0f172a' : '#ffffff',
                                color: resumeCurrentPage === p ? '#ffffff' : '#334155',
                                fontWeight: resumeCurrentPage === p ? '700' : '500',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {p}
                            </button>
                          ))}

                          <button
                            type="button"
                            disabled={resumeCurrentPage >= resumeTotalPages}
                            onClick={() => setResumePage(prev => Math.min(resumeTotalPages, prev + 1))}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: resumeCurrentPage >= resumeTotalPages ? '#f8fafc' : '#ffffff',
                              color: resumeCurrentPage >= resumeTotalPages ? '#94a3b8' : '#334155',
                              cursor: resumeCurrentPage >= resumeTotalPages ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          );
        })()}

        {/* ── Candidate Credentials Drawer ── */}
        {selectedResume && (() => {
          let aiData = null;
          if (selectedResume.ai_summary?.trim().startsWith('{')) {
            try { aiData = JSON.parse(selectedResume.ai_summary); } catch { }
          }
          const resumeName = aiData?.applicant_info?.name || '';
          const accountName = (selectedResume.candidate_name || `${selectedResume.User_Fname || ''} ${selectedResume.User_Lname || ''}`).trim();
          const drawerTitle = resumeName || accountName || 'Applicant';
          const score = selectedResume.ai_match_score;
          const scoreLabel = score >= 80 ? 'Highly Recommended' : score >= 60 ? 'Good Match' : 'Low Match';
          const badgeClass = score >= 80 ? 'excellent' : score >= 60 ? 'good' : 'poor';

          return ReactDOM.createPortal(
            <div className="admin-drawer-overlay" onClick={() => { setSelectedResume(null); setDrawerExpanded(false); setDrawerShowRequirements(false); }}>
              <div
                className="admin-drawer-container"
                onClick={e => e.stopPropagation()}
                style={{
                  width: drawerExpanded ? 'min(880px, 92vw)' : '460px',
                  maxWidth: '96vw',
                  transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div className="admin-drawer-header" style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10 }}>
                    <button
                      type="button"
                      onClick={() => setDrawerExpanded(prev => !prev)}
                      title={drawerExpanded ? "Collapse to side panel" : "Expand to wide modal"}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        color: '#475569',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className={`bx ${drawerExpanded ? 'bx-collapse-alt' : 'bx-expand-alt'}`} style={{ fontSize: '18px', lineHeight: 1 }}></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedResume(null); setDrawerExpanded(false); setDrawerShowRequirements(false); }}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        color: '#475569'
                      }}
                    >
                      <i className='bx bx-x' style={{ fontSize: '20px', lineHeight: 1 }}></i>
                    </button>
                  </div>

                  <div className="admin-drawer-avatar">
                    <i className='bx bx-user' style={{ fontSize: '44px' }}></i>
                  </div>

                  <div className="admin-drawer-profile-text" style={{ paddingRight: '70px' }}>
                    <span className="admin-drawer-name">{drawerTitle}</span>
                    <span className="admin-drawer-role">{selectedResume.job_title}</span>
                  </div>
                </div>
                <div className="admin-drawer-body">
                  <div className="admin-drawer-contact-list">
                    <div className="admin-contact-item"><i className='bx bx-envelope admin-contact-icon'></i><span>{selectedResume.candidate_email || selectedResume.User_Email}</span></div>
                    <div className="admin-contact-item">
                      <i className='bx bx-phone admin-contact-icon'></i>
                      {(selectedResume.candidate_mobile || selectedResume.User_Mobile) ? (
                        <span style={{ color: '#334155', fontWeight: '500' }}>
                          {selectedResume.candidate_mobile || selectedResume.User_Mobile}
                        </span>
                      ) : (
                        <span>Not provided</span>
                      )}
                    </div>
                    <div className="admin-contact-item"><i className='bx bx-map admin-contact-icon'></i><span>{aiData?.applicant_info?.location || 'Location not provided'}</span></div>
                  </div>


                  {score !== null && (
                    <div className={`admin-drawer-ai-alert ${badgeClass}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div className={`admin-drawer-ai-badge ${badgeClass}`}>
                          <i className='bx bx-bot' style={{ fontSize: '18px' }}></i>
                          <span>{scoreLabel}</span>
                        </div>
                        <span className="admin-drawer-ai-confidence">Confidence/Match Score: {score}%</span>
                      </div>

                      <div style={{ marginTop: '10px', borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setDrawerShowRequirements(prev => !prev)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.85)',
                            border: '1px solid rgba(0, 0, 0, 0.12)',
                            borderRadius: '7px',
                            padding: '7px 12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#1e293b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className='bx bx-list-check' style={{ fontSize: '16px', color: '#6366f1' }}></i>
                            <span>View Job Requirements</span>
                          </span>
                          <i className={`bx ${drawerShowRequirements ? 'bx-chevron-up' : 'bx-chevron-down'}`} style={{ fontSize: '16px', color: '#64748b' }}></i>
                        </button>

                        {drawerShowRequirements && (
                          <div style={{
                            marginTop: '8px',
                            padding: '12px 14px',
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 0, 0, 0.08)',
                            fontSize: '12.5px',
                            color: '#334155',
                            lineHeight: '1.6',
                            maxHeight: '220px',
                            overflowY: 'auto'
                          }}>
                            <strong style={{ display: 'block', marginBottom: '6px', color: '#0f172a', fontSize: '13px' }}>
                              📋 {selectedResume.job_title} Requirements:
                            </strong>
                            {selectedResume.job_requirements ? (
                              <div style={{ whiteSpace: 'pre-line' }}>{selectedResume.job_requirements}</div>
                            ) : (
                              <p style={{ margin: 0, fontStyle: 'italic', color: '#94a3b8' }}>
                                No specific requirements text specified for this position.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {aiData?.summary && (() => {
                        const list = Array.isArray(aiData.summary) ? aiData.summary : aiData.summary.split('\n');
                        return (<ul className="admin-drawer-ai-bullets" style={{ marginTop: '10px' }}>{list.map((b, i) => <li key={i}>{b.replace(/^[-\s*•]+/, '')}</li>)}</ul>);
                      })()}
                    </div>
                  )}
                  <div>
                    <h4 className="admin-drawer-section-title">Skills</h4>
                    <div className="admin-drawer-skills-grid">
                      {aiData?.skills_analysis?.found_skills?.length > 0 ? aiData.skills_analysis.found_skills.map((s, i) => <span key={i} className="admin-drawer-skill-tag">{s}</span>) : <span style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>No skills extracted.</span>}
                    </div>
                  </div>
                  <div>
                    <h4 className="admin-drawer-section-title">Experience</h4>
                    {aiData?.extracted_work_history?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {aiData.extracted_work_history.map((job, i) => (
                          <div key={i} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                            <p className="admin-drawer-detail-p" style={{ fontWeight: '600', color: '#111827' }}>{job.job_title} ({job.duration})</p>
                            {Array.isArray(job.key_responsibilities) && job.key_responsibilities.map((r, ri) => <p key={ri} className="admin-drawer-detail-p" style={{ fontSize: '12px', paddingLeft: '8px' }}>• {r}</p>)}
                          </div>
                        ))}
                      </div>
                    ) : <p className="admin-drawer-detail-p" style={{ color: '#6b7280', fontStyle: 'italic' }}>No experience records extracted.</p>}
                  </div>
                  <div>
                    <h4 className="admin-drawer-section-title">Education</h4>
                    {aiData?.extracted_education?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {aiData.extracted_education.map((edu, i) => <p key={i} className="admin-drawer-detail-p" style={{ color: '#374151' }}><strong>{edu.degree}</strong> ({edu.year_graduated})</p>)}
                      </div>
                    ) : <p className="admin-drawer-detail-p" style={{ color: '#6b7280', fontStyle: 'italic' }}>No education records extracted.</p>}
                  </div>
                  {selectedResume.remarks && (
                    <div>
                      <h4 className="admin-drawer-section-title">Evaluator Remarks</h4>
                      {(() => {
                        let actualRemarks = selectedResume.remarks || '';
                        let evalName = '';
                        let evalDate = '';
                        if (actualRemarks.includes('|||SIG|||')) {
                          const parts = actualRemarks.split('|||SIG|||');
                          actualRemarks = parts[0].trim();
                          if (parts[1]) {
                            const sigParts = parts[1].split('|||');
                            evalName = sigParts[0]?.trim() || '';
                            evalDate = sigParts[1]?.trim() || '';
                          }
                        }
                        return (
                          <>
                            <div style={{
                              padding: '12px 14px',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              fontSize: '13px',
                              color: '#334155',
                              lineHeight: '1.5',
                              whiteSpace: 'pre-line',
                              fontStyle: 'italic',
                              marginBottom: evalName ? '8px' : '0'
                            }}>
                              "{actualRemarks || 'No remarks provided.'}"
                            </div>
                            {evalName && (
                              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <i className='bx bx-info-circle' style={{ fontSize: '14px' }}></i>
                                Interviewed by: <strong>{evalName}</strong> {evalDate ? `on ${evalDate}` : ''}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div>
                    <h4 className="admin-drawer-section-title">Documents</h4>
                    <div className="admin-drawer-doc-list">
                      <button className="admin-drawer-doc-btn" onClick={() => window.open(`${API_BASE_URL}/applications/download_resume.php?id=${selectedResume.id}&token=${encodeURIComponent(localStorage.getItem('hiring_token') || '')}`, '_blank')}>
                        <div className="admin-drawer-doc-btn-left"><i className='bx bxs-file-pdf admin-drawer-doc-icon' style={{ fontSize: '16px' }}></i><span>Download Resume PDF</span></div>
                        <i className='bx bx-download' style={{ fontSize: '16px' }}></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}

        {/* ── Interview Schedule Tab ── */}
        {activeTab === 'slots' && (
          <>
            <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 className="admin-header-title">Interview Schedule</h1>
                <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                  Manage available interview time slots. You can set any number of slots per day.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* List / Calendar Toggle */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', border: '1px solid #e2e8f0' }}>
                  <button
                    onClick={() => setScheduleView('list')}
                    title="List View"
                    style={{ background: scheduleView === 'list' ? '#ffffff' : 'transparent', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: scheduleView === 'list' ? '#e6007e' : '#64748b', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s', boxShadow: scheduleView === 'list' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
                  >
                    <i className="bx bx-list-ul" style={{ fontSize: '16px' }}></i> List
                  </button>
                  <button
                    onClick={() => setScheduleView('calendar')}
                    title="Calendar View"
                    style={{ background: scheduleView === 'calendar' ? '#ffffff' : 'transparent', border: 'none', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', color: scheduleView === 'calendar' ? '#e6007e' : '#64748b', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s', boxShadow: scheduleView === 'calendar' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}
                  >
                    <i className="bx bx-calendar" style={{ fontSize: '16px' }}></i> Calendar
                  </button>
                </div>
                <button
                  style={{ ...BTN_PRIMARY, display: 'inline-flex', alignItems: 'center', gap: '7px' }}
                  onClick={() => { setSlotError(''); setSlotDayCount(null); setSlotModalOpen(true); }}
                >
                  <i className="bx bx-plus-circle" style={{ fontSize: '17px' }}></i> Add Slot
                </button>
              </div>
            </div>

            {scheduleView === 'list' ? (
              <div className="admin-table-card">
                {loading ? (
                  <TableSkeleton
                    columns={['Day', 'Date', 'Time Slot', 'Scheduled Candidate', 'Status', 'Actions']}
                    rows={5}
                    hasAvatar={false}
                    hasActions={true}
                  />
                ) : tabError ? (
                  <DatabaseErrorState
                    title="Unable to Load Interview Slots"
                    message={tabError}
                    onRetry={fetchSlots}
                  />
                ) : slots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', fontSize: '14px' }}>
                    No interview slots created yet. Click <strong>"+ Add Slot"</strong> to define available times.
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Date</th>
                        <th>Time Slot</th>
                        <th>Scheduled Candidate</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map(s => {
                        const dayName = s.day_name || (s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '—');
                        return (
                          <tr key={s.slot_id}>
                            <td><strong style={{ color: '#0f172a' }}>{dayName}</strong></td>
                            <td>{new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                            <td>{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</td>
                            <td>
                              {s.applicant_name ? (
                                <div>
                                  <strong style={{ color: '#0f172a', fontSize: '13px' }}>{s.applicant_name}</strong>
                                  {s.job_title && <span style={{ color: '#64748b', fontSize: '12px', display: 'block' }}>{s.job_title}</span>}
                                </div>
                              ) : (
                                <span style={{ color: '#059669', fontSize: '12px', fontWeight: '600' }}>
                                  <i className="bx bx-check" style={{ marginRight: '3px' }} /> Available (Unassigned)
                                </span>
                              )}
                            </td>
                            <td>
                              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '16px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px', background: s.status === 'Open' ? '#d1fae5' : '#fef3c7', color: s.status === 'Open' ? '#047857' : '#b45309', border: s.status === 'Open' ? '1px solid #a7f3d0' : '1px solid #fde68a' }}>
                                {s.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {s.status === 'Open' ? (
                                <button
                                  style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '5px 13px', borderRadius: '7px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif", display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  onClick={() => handleDeleteSlot(s.slot_id)}
                                >
                                  <i className="bx bx-trash" style={{ fontSize: '14px' }}></i> Delete
                                </button>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Booked</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="admin-table-card" style={{ padding: '20px' }}>
                {loading ? <div className="admin-loading">Loading slots...</div> : renderCalendar()}
              </div>
            )}
          </>
        )}

        {/* ── Candidate Evaluation Tab ── */}
        {activeTab === 'results' && (() => {
          const isPendingStatus = (s) => ['CONFIRMED', 'INTERVIEW_SCHEDULED'].includes((s || '').toUpperCase());
          const isFinalApprovalStatus = (s) => [
            'PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW',
            'PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT'
          ].includes((s || '').toUpperCase());
          const isJobOfferStatus = (s) => [
            'JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING', 'OFFER_EXTENDED',
            'APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER',
            'PRESIDENT APPROVED', 'PRESIDENT_APPROVED', 'APPROVED',
            'OFFER DECLINED', 'OFFER_DECLINED'
          ].includes((s || '').toUpperCase());
          const isContractSigningStatus = (s) => [
            'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'PASSED',
            'JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED',
            'OFFER ACCEPTED', 'OFFER_ACCEPTED',
            'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED',
            'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'
          ].includes((s || '').toUpperCase());
          const isOnboardingStatus = (s) => [
            'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING',
            'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED',
            'OFFICIALLY HIRED', 'OFFICIALLY_HIRED',
            'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
            'OFFICIALLY HIRED & SIGNED',
            'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED',
            'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT',
            'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'
          ].includes((s || '').toUpperCase());

          const safeInterviews = Array.isArray(interviews) ? interviews : [];
          const pendingCandidates = safeInterviews.filter(i => isPendingStatus(i.status));
          const finalApprovalCandidates = safeInterviews.filter(i => isFinalApprovalStatus(i.status));
          const jobOfferCandidates = safeInterviews.filter(i => isJobOfferStatus(i.status));
          const contractSigningCandidates = safeInterviews.filter(i => isContractSigningStatus(i.status));
          const onboardingCandidates = safeInterviews.filter(i => isOnboardingStatus(i.status) && !i.work_start_date && !i.is_archived);

          let activeList = pendingCandidates;
          if (evalTab === 'final_approval') activeList = finalApprovalCandidates;
          else if (evalTab === 'job_offer') activeList = jobOfferCandidates;
          else if (evalTab === 'contract_signing') activeList = contractSigningCandidates;
          else if (evalTab === 'onboarding') activeList = onboardingCandidates;

          const filteredList = activeList.filter(i => {
            if (!evalSearch.trim()) return true;
            const q = evalSearch.toLowerCase().trim();
            const name = (i.candidate_name || `${i.User_Fname || ''} ${i.User_Lname || ''}`).toLowerCase();
            const title = (i.job_title || '').toLowerCase();
            const email = (i.candidate_email || i.User_Email || '').toLowerCase();
            return name.includes(q) || title.includes(q) || email.includes(q);
          });

          const EVAL_PAGE_SIZE = 10;
          const evalTotalPages = Math.max(1, Math.ceil(filteredList.length / EVAL_PAGE_SIZE));
          const evalCurrentPage = Math.min(evalPage, evalTotalPages);
          const paginatedList = filteredList.slice((evalCurrentPage - 1) * EVAL_PAGE_SIZE, evalCurrentPage * EVAL_PAGE_SIZE);

          return (
            <>
              <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 className="admin-header-title">Candidate Evaluation &amp; President's Approval Pipeline</h1>
                  <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                    Manage the 5-stage evaluation pipeline: F2F interview evaluation, President approval, Job Offer issuance, contract signing, and onboarding &amp; pre-employment verification.
                  </p>
                </div>
              </div>

              {/* 5 Status Filter Tabs & Search Top Bar */}
              {/* 5 Status Filter Tabs & Action Top Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', width: '100%' }}>
                {/* 5 Tabs: [ Final Interview Evaluation ] | [ Final Approval ] | [ Job Offer ] | [ Contract Signing ] | [ Onboarding ] */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {/* Tab 1: Final Interview Evaluation */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('pending'); setEvalPage(1); setEvalSearch(''); setSelectedFinalInterviewIds([]); setSelectedApprovalIds([]); }}
                    style={{
                      padding: '7px 13px',
                      borderRadius: '8px',
                      border: evalTab === 'pending' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'pending' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'pending' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: evalTab === 'pending' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                    Final Interview Evaluation
                    <span style={{
                      background: evalTab === 'pending' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'pending' ? '#ffffff' : '#475569',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {pendingCandidates.length}
                    </span>
                  </button>

                  {/* Tab 2: Final Approval */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('final_approval'); setEvalPage(1); setEvalSearch(''); setSelectedFinalInterviewIds([]); setSelectedApprovalIds([]); }}
                    style={{
                      padding: '7px 13px',
                      borderRadius: '8px',
                      border: evalTab === 'final_approval' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'final_approval' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'final_approval' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: evalTab === 'final_approval' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Final Approval
                    <span style={{
                      background: evalTab === 'final_approval' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'final_approval' ? '#ffffff' : '#475569',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {finalApprovalCandidates.length}
                    </span>
                  </button>

                  {/* Tab 3: Job Offer */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('job_offer'); setEvalPage(1); setSelectedFinalInterviewIds([]); setSelectedApprovalIds([]); }}
                    style={{
                      padding: '7px 13px',
                      borderRadius: '8px',
                      border: evalTab === 'job_offer' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'job_offer' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'job_offer' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: evalTab === 'job_offer' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                    Job Offer
                    <span style={{
                      background: evalTab === 'job_offer' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'job_offer' ? '#ffffff' : '#475569',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {jobOfferCandidates.length}
                    </span>
                  </button>

                  {/* Tab 4: Contract Signing */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('contract_signing'); setEvalPage(1); setSelectedFinalInterviewIds([]); setSelectedApprovalIds([]); }}
                    style={{
                      padding: '7px 13px',
                      borderRadius: '8px',
                      border: evalTab === 'contract_signing' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'contract_signing' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'contract_signing' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: evalTab === 'contract_signing' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#e6007e', display: 'inline-block' }} />
                    Contract Signing
                    <span style={{
                      background: evalTab === 'contract_signing' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'contract_signing' ? '#ffffff' : '#475569',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {contractSigningCandidates.length}
                    </span>
                  </button>

                  {/* Tab 5: Onboarding */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('onboarding'); setEvalPage(1); setSelectedFinalInterviewIds([]); setSelectedApprovalIds([]); }}
                    style={{
                      padding: '7px 13px',
                      borderRadius: '8px',
                      border: evalTab === 'onboarding' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'onboarding' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'onboarding' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: evalTab === 'onboarding' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
                    Onboarding
                    <span style={{
                      background: evalTab === 'onboarding' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'onboarding' ? '#ffffff' : '#475569',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {onboardingCandidates.length}
                    </span>
                  </button>
                </div>

                {/* Right Side: Batch Action Buttons (for pending & final_approval) OR Search Bar (only for other tabs) */}
                {evalTab === 'pending' && selectedFinalInterviewIds.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    marginLeft: 'auto'
                  }}>
                    <span style={{
                      background: '#fdf2f8',
                      color: '#e6007e',
                      border: '1px solid #fbcfe8',
                      padding: '5px 10px',
                      borderRadius: '20px',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      <i className="bx bx-check-double" style={{ fontSize: '14px' }}></i>
                      {selectedFinalInterviewIds.length} Selected
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBatchUpdateResult(selectedFinalInterviewIds, 'Passed Final Interview')}
                      style={{
                        background: '#059669',
                        color: '#fff', border: 'none', padding: '6.5px 12px', borderRadius: '8px',
                        fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'inline-flex',
                        alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                      title="Pass selected candidates"
                    >
                      <i className="bx bx-check-circle" style={{ fontSize: '14px' }}></i> Pass selected ({selectedFinalInterviewIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchUpdateResult(selectedFinalInterviewIds, 'Failed Final Interview')}
                      style={{
                        background: '#fff1f2', color: '#e11d48', border: '1.5px solid #fecdd3',
                        padding: '6.5px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '12px',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                      title="Fail selected candidates"
                    >
                      <i className="bx bx-x-circle" style={{ fontSize: '14px' }}></i> Fail selected ({selectedFinalInterviewIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchUpdateResult(selectedFinalInterviewIds, 'Candidate No Show')}
                      style={{
                        background: '#fffbeb', color: '#d97706', border: '1.5px solid #fde68a',
                        padding: '6.5px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '12px',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                      title="Mark selected candidates as No Show"
                    >
                      <i className="bx bx-user-x" style={{ fontSize: '14px' }}></i> No show ({selectedFinalInterviewIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFinalInterviewIds([])}
                      title="Clear selection"
                      style={{
                        background: '#f8fafc', color: '#64748b', border: '1.5px solid #cbd5e1',
                        padding: '6.5px 10px', borderRadius: '8px', fontWeight: '600', fontSize: '12px',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                    >
                      <i className="bx bx-x" style={{ fontSize: '14px' }}></i> Clear
                    </button>
                  </div>
                ) : evalTab === 'final_approval' && selectedApprovalIds.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-end',
                    marginLeft: 'auto'
                  }}>
                    <span style={{
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      padding: '5px 10px',
                      borderRadius: '20px',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}>
                      <i className="bx bx-check-double" style={{ fontSize: '14px' }}></i>
                      {selectedApprovalIds.length} Finalist{selectedApprovalIds.length > 1 ? 's' : ''} Selected
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBatchUpdateResult(selectedApprovalIds, 'President Approved')}
                      style={{
                        background: '#059669',
                        color: '#fff', border: 'none', padding: '6.5px 12px', borderRadius: '8px',
                        fontWeight: '700', fontSize: '12px', cursor: 'pointer', display: 'inline-flex',
                        alignItems: 'center', gap: '4px', boxShadow: '0 2px 6px rgba(5,150,105,0.25)',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                      title="Grant President's Approval for selected candidates"
                    >
                      <i className="bx bx-check-circle" style={{ fontSize: '14px' }}></i> Pass selected ({selectedApprovalIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchUpdateResult(selectedApprovalIds, 'Failed Final Approval')}
                      style={{
                        background: '#fff1f2', color: '#e11d48', border: '1.5px solid #fecdd3',
                        padding: '6.5px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '12px',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                      title="Reject selected candidates at Final Approval"
                    >
                      <i className="bx bx-x-circle" style={{ fontSize: '14px' }}></i> Fail selected ({selectedApprovalIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedApprovalIds([])}
                      title="Clear selection"
                      style={{
                        background: '#f8fafc', color: '#64748b', border: '1.5px solid #cbd5e1',
                        padding: '6.5px 10px', borderRadius: '8px', fontWeight: '600', fontSize: '12px',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px',
                        transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                      }}
                    >
                      <i className="bx bx-x" style={{ fontSize: '14px' }}></i> Clear
                    </button>
                  </div>
                ) : (
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <i className="bx bx-search" style={{ position: 'absolute', left: '10px', color: '#94a3b8', fontSize: '15px', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        placeholder="Search candidate or position..."
                        value={evalSearch}
                        onChange={e => { setEvalSearch(e.target.value); setEvalPage(1); }}
                        style={{
                          padding: '6.5px 12px 6.5px 32px',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          color: '#1e293b',
                          background: '#ffffff',
                          outline: 'none',
                          width: '230px',
                          transition: 'all 0.15s ease'
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#e6007e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(230, 0, 126, 0.1)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                      {evalSearch && (
                        <button
                          type="button"
                          onClick={() => { setEvalSearch(''); setEvalPage(1); }}
                          style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                          title="Clear search"
                        >
                          <i className="bx bx-x" style={{ fontSize: '15px' }} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="admin-table-card">
                {loading ? (
                  <TableSkeleton
                    columns={['Candidate Details', 'Applied Position', 'Interview Status', 'Final Evaluation', 'Actions']}
                    rows={5}
                    hasAvatar={true}
                    hasActions={true}
                  />
                ) : tabError ? (
                  <DatabaseErrorState
                    title="Unable to Load Candidate Evaluations"
                    message={tabError}
                    onRetry={fetchInterviews}
                  />
                ) : paginatedList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 24px', background: '#ffffff', borderRadius: '12px' }}>
                    <div style={{
                      width: '54px', height: '54px', borderRadius: '50%',
                      background: evalTab === 'pending' ? '#fef3c7' : (evalTab === 'final_approval' ? '#ecfdf5' : (evalTab === 'job_offer' ? '#fff7ed' : (evalTab === 'contract_signing' ? '#fdf2f8' : '#e0f2fe'))),
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
                      color: evalTab === 'pending' ? '#d97706' : (evalTab === 'final_approval' ? '#059669' : (evalTab === 'job_offer' ? '#ea580c' : (evalTab === 'contract_signing' ? '#e6007e' : '#0284c7')))
                    }}>
                      <i className={`bx ${evalTab === 'pending' ? 'bx-time' : (evalTab === 'final_approval' ? 'bx-user-check' : (evalTab === 'job_offer' ? 'bx-file' : (evalTab === 'contract_signing' ? 'bx-calendar-edit' : 'bx-badge-check')))}`} style={{ fontSize: '26px' }}></i>
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15.5px', fontWeight: '700', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>
                      {evalSearch ? 'No Candidates Match Your Search' : (
                        evalTab === 'pending'
                          ? 'No Candidates Currently Awaiting Final Interview Evaluation'
                          : (evalTab === 'final_approval'
                            ? 'No Candidates Currently Awaiting Final Approval'
                            : (evalTab === 'job_offer'
                              ? 'No Candidates Currently Awaiting Job Offer Response'
                              : (evalTab === 'contract_signing'
                                ? 'No Candidates Awaiting Contract Signing'
                                : 'No Active Candidates in Onboarding')))
                      )}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
                      {evalSearch
                        ? `No records found matching "${evalSearch}". Try clearing the search filter.`
                        : (evalTab === 'pending'
                          ? 'Candidates scheduled for final interview will appear here for evaluation.'
                          : (evalTab === 'final_approval'
                            ? "Candidates who passed the final interview will queue here for the President's decision."
                            : (evalTab === 'job_offer'
                              ? 'Candidates who have been extended an official job offer letter will appear here until they accept.'
                              : (evalTab === 'contract_signing'
                                ? 'Approved candidates awaiting contract scheduling and formal signing will appear here.'
                                : 'Hired employees submitting pre-employment requirements (Medical, Drug Test, NBI, Police, COE, TOR/Diploma) and finalized records will appear here.'))))}
                    </p>
                  </div>
                ) : (
                  <>
                    <table className="admin-table" style={{ width: '100%', minWidth: evalTab === 'final_approval' ? '960px' : '880px', borderCollapse: 'collapse' }}>
                      <thead>
                        {evalTab === 'final_approval' ? (
                          <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                            <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {(() => {
                                  const actionableFinalists = paginatedList.filter(x => {
                                    const s = (x.status || '').toUpperCase();
                                    return !['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes(s);
                                  });
                                  const actionableIds = actionableFinalists.map(x => x.application_id);
                                  const allActionableSelected = actionableIds.length > 0 && actionableIds.every(id => selectedApprovalIds.includes(id));
                                  return (
                                    <input
                                      type="checkbox"
                                      title={actionableIds.length === 0 ? "No actionable finalists to select on this page (all are on standby)" : (allActionableSelected ? "Deselect all actionable finalists" : "Select all actionable finalists")}
                                      disabled={actionableIds.length === 0}
                                      checked={allActionableSelected}
                                      onChange={() => {
                                        if (actionableIds.length === 0) return;
                                        if (allActionableSelected) {
                                          setSelectedApprovalIds(prev => prev.filter(id => !actionableIds.includes(id)));
                                        } else {
                                          setSelectedApprovalIds(prev => Array.from(new Set([...prev, ...actionableIds])));
                                        }
                                      }}
                                      style={{
                                        margin: 0,
                                        padding: 0,
                                        cursor: actionableIds.length === 0 ? 'not-allowed' : 'pointer',
                                        width: '16px',
                                        height: '16px',
                                        accentColor: '#e6007e',
                                        display: 'block',
                                        flexShrink: 0,
                                        opacity: actionableIds.length === 0 ? 0.45 : 1
                                      }}
                                    />
                                  );
                                })()}
                              </div>
                            </th>
                            <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', width: '22%' }}>Candidate</th>
                            <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', width: '18%' }}>Applied Position</th>
                            <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', width: '16%' }}>Open Slots</th>
                            <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', width: '16%' }}>Status</th>
                            <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', width: '12%' }}>Interview Date</th>
                            <th style={{ padding: '14px 18px', textAlign: 'center', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#475569', width: '16%' }}>Actions</th>
                          </tr>
                        ) : (
                          <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                            {evalTab === 'pending' && (
                              <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {(() => {
                                    const actionableCandidates = paginatedList.filter(x => isInterviewScheduleReady(x.interview_date, x.start_time));
                                    const actionableIds = actionableCandidates.map(x => x.application_id);
                                    const allActionableSelected = actionableIds.length > 0 && actionableIds.every(id => selectedFinalInterviewIds.includes(id));
                                    return (
                                      <input
                                        type="checkbox"
                                        title={actionableIds.length === 0 ? "No candidates with current or past interview schedules on this page" : (allActionableSelected ? "Deselect all actionable candidates" : "Select all actionable candidates")}
                                        disabled={actionableIds.length === 0}
                                        checked={allActionableSelected}
                                        onChange={() => {
                                          if (actionableIds.length === 0) return;
                                          if (allActionableSelected) {
                                            setSelectedFinalInterviewIds(prev => prev.filter(id => !actionableIds.includes(id)));
                                          } else {
                                            setSelectedFinalInterviewIds(prev => Array.from(new Set([...prev, ...actionableIds])));
                                          }
                                        }}
                                        style={{
                                          margin: 0, padding: 0,
                                          cursor: actionableIds.length === 0 ? 'not-allowed' : 'pointer',
                                          width: '16px', height: '16px', accentColor: '#e6007e',
                                          display: 'block', flexShrink: 0,
                                          opacity: actionableIds.length === 0 ? 0.45 : 1
                                        }}
                                      />
                                    );
                                  })()}
                                </div>
                              </th>
                            )}
                            <th style={{ padding: '14px 18px', textAlign: 'left' }}>Candidate</th>
                            <th style={{ padding: '14px 18px', textAlign: 'left' }}>Position</th>
                            <th style={{ padding: '14px 18px', textAlign: 'center' }}>
                              {evalTab === 'onboarding'
                                ? 'Hired Date'
                                : (evalTab === 'contract_signing'
                                  ? 'Signing Schedule'
                                  : (evalTab === 'job_offer'
                                    ? 'Offer Sent Date'
                                    : 'Interview Schedule'))}
                            </th>
                            {(evalTab === 'pending' || evalTab === 'job_offer' || evalTab === 'contract_signing') && (
                              <th style={{ padding: '14px 18px', textAlign: 'center' }}>
                                {evalTab === 'pending'
                                  ? 'Interview Status'
                                  : (evalTab === 'job_offer' ? 'Offer Status' : 'Contract Status')}
                              </th>
                            )}
                            {evalTab === 'onboarding' ? (
                              <>
                                <th style={{ padding: '14px 18px', textAlign: 'center' }}>Employment Status</th>
                                <th style={{ padding: '14px 18px', textAlign: 'center' }}>Requirements Status</th>
                                <th style={{ padding: '14px 18px', textAlign: 'center' }}>Action</th>
                              </>
                            ) : (
                              <th style={{
                                padding: '14px 18px',
                                textAlign: evalTab === 'pending' ? 'left' : 'center',
                                textTransform: 'uppercase',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                letterSpacing: '0.06em',
                                color: '#475569'
                              }}>
                                Actions
                              </th>
                            )}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {paginatedList.map(i => {
                          const candidateName = i.candidate_name || `${i.User_Fname || ''} ${i.User_Lname || ''}`.trim();
                          const candidateEmail = i.candidate_email || i.User_Email || '';
                          const dateStr = i.interview_date ? new Date(i.interview_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Awaiting Date';
                          const timeStr = i.start_time ? (i.end_time ? `${fmtTime(i.start_time)} – ${fmtTime(i.end_time)}` : fmtTime(i.start_time)) : '';

                          const normStatus = (i.status || '').toUpperCase();
                          const isPassedApproval = ['PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'PASSED'].includes(normStatus);
                          const isReqVerified = ['REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED'].includes(normStatus);
                          const isContractScheduled = ['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(normStatus);
                          const isContractSigned = ['CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED'].includes(normStatus);
                          const isFailedApproval = ['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes(normStatus);
                          const isFailedInterview = ['FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'INTERVIEW_FAILED', 'REJECTED'].includes(normStatus);
                          const isPassedInterview = ['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(normStatus);
                          const isWithdrawn = ['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED'].includes(normStatus);
                          const isIncompleteReq = ['INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS'].includes(normStatus);
                          const isFailedPreEmp = ['FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes(normStatus);

                          // Computed 7-day deadline from applied/updated date
                          const refDate = i.updated_at || i.applied_at || new Date().toISOString();
                          const deadlineObj = new Date(new Date(refDate).getTime() + 7 * 24 * 60 * 60 * 1000);
                          const deadlineStr = deadlineObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                          const isSelected = (evalTab === 'pending' && selectedFinalInterviewIds.includes(i.application_id)) || (evalTab === 'final_approval' && selectedApprovalIds.includes(i.application_id));
                          const isSchedReady = isInterviewScheduleReady(i.interview_date, i.start_time);

                          /* ── DEDICATED ROW FOR PRESIDENT'S FINAL APPROVAL (7-COLUMN EXECUTIVE BOARD) ── */
                          if (evalTab === 'final_approval') {
                            const isStandby = ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes(normStatus);

                            // Calculate dynamic waitlist candidates & queue order for this same job
                            const jobWaitlistedCandidates = finalApprovalCandidates
                              .filter(c => c.job_id === i.job_id && ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes((c.status || '').toUpperCase()))
                              .sort((a, b) => {
                                const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
                                const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
                                if (timeA !== timeB) return timeA - timeB;
                                return (a.application_id || 0) - (b.application_id || 0);
                              });
                            const waitlistCount = jobWaitlistedCandidates.length;

                            let waitlistRank = 1;
                            if (isStandby) {
                              const idx = jobWaitlistedCandidates.findIndex(c => c.application_id === i.application_id);
                              waitlistRank = idx !== -1 ? idx + 1 : 1;
                            }

                            const rawAvailableSlots = i.available_slots !== undefined ? Math.max(0, i.available_slots) : 0;
                            // Available slots not already earmarked for priority waitlist candidates
                            const unreservedSlots = Math.max(0, rawAvailableSlots - waitlistCount);

                            // Capacity is full if raw slots <= 0 OR if all open slots are reserved for priority waitlist candidates
                            const isCapacityFull = i.available_slots !== undefined && (
                              rawAvailableSlots <= 0 || (!isStandby && unreservedSlots <= 0)
                            );

                            return (
                              <tr
                                key={i.application_id}
                                style={{
                                  borderBottom: '1px solid #e2e8f0',
                                  background: isSelected ? '#fdf2f8' : (isStandby ? '#f8faff' : '#ffffff'),
                                  borderLeft: isSelected ? '4px solid #e6007e' : (isStandby ? '4px solid #3b82f6' : '4px solid #10b981'),
                                  transition: 'background-color 0.15s ease'
                                }}
                              >
                                {/* 1. Selection Checkbox */}
                                <td style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '16px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <input
                                      type="checkbox"
                                      disabled={isStandby}
                                      checked={!isStandby && selectedApprovalIds.includes(i.application_id)}
                                      onChange={() => {
                                        if (isStandby) return;
                                        setSelectedApprovalIds(prev =>
                                          prev.includes(i.application_id) ? prev.filter(x => x !== i.application_id) : [...prev, i.application_id]
                                        );
                                      }}
                                      title={isStandby ? `Candidate is on Priority Waitlist (#${waitlistRank}). Batch decisions disabled; evaluate individually.` : "Select for batch evaluation"}
                                      style={{
                                        margin: 0,
                                        padding: 0,
                                        cursor: isStandby ? 'not-allowed' : 'pointer',
                                        width: '16px',
                                        height: '16px',
                                        accentColor: '#e6007e',
                                        display: 'block',
                                        flexShrink: 0,
                                        opacity: isStandby ? 0.35 : 1
                                      }}
                                    />
                                  </div>
                                </td>

                                {/* 2. Candidate Profile */}
                                <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{
                                      width: '38px', height: '38px', borderRadius: '50%',
                                      background: isStandby ? '#eff6ff' : '#ecfdf5',
                                      border: isStandby ? '1.5px solid #bfdbfe' : '1.5px solid #a7f3d0',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                      fontWeight: '700', fontSize: '13.5px',
                                      color: isStandby ? '#1d4ed8' : '#059669'
                                    }}>
                                      {(candidateName[0] || 'A').toUpperCase()}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {candidateName}
                                      </div>
                                      {candidateEmail && (
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {candidateEmail}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* 3. Applied Position (Application # removed) */}
                                <td style={{ padding: '16px 18px', verticalAlign: 'middle' }}>
                                  <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                                    {i.job_title}
                                  </div>
                                </td>

                                {/* 4. Dedicated Open Slots Column (Held by text removed) */}
                                <td style={{ padding: '16px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  {i.available_slots !== undefined && (
                                    (!isStandby && unreservedSlots <= 0 && rawAvailableSlots > 0) ? (
                                      <span
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
                                          padding: '4px 10px', borderRadius: '20px',
                                          fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'help'
                                        }}
                                        title={`Slot capacity is open (${rawAvailableSlots}/${i.total_slots || 1}), but reserved for Priority Waitlisted candidate (#1)`}
                                      >
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                        0/{i.total_slots || 1} Open (Reserved)
                                      </span>
                                    ) : i.available_slots > 0 ? (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
                                        padding: '4px 10px', borderRadius: '20px',
                                        fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap'
                                      }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                        {i.available_slots}/{i.total_slots || 1} Open
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a',
                                          padding: '4px 10px', borderRadius: '20px',
                                          fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap', cursor: 'help'
                                        }}
                                        title={i.active_holder_name ? `Slot reserved for ${i.active_holder_name} (${i.active_holder_status || 'Job Offer'})` : 'Slot capacity reached (Reserved)'}
                                      >
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                        0/{i.total_slots || 1} Open
                                      </span>
                                    )
                                  )}
                                </td>

                                {/* 5. Dedicated Pipeline Status Column with Dynamic Waitlist Rank */}
                                <td style={{ padding: '16px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  {isStandby ? (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                                      background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                                      padding: '4px 11px', borderRadius: '20px',
                                      fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap'
                                    }}>
                                      <i className="bx bx-time-five" style={{ fontSize: '13px' }} />
                                      WAITLISTED #{waitlistRank}
                                    </span>
                                  ) : (
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                                      background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
                                      padding: '4px 11px', borderRadius: '20px',
                                      fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap'
                                    }}>
                                      <i className="bx bx-check-double" style={{ fontSize: '14px' }} />
                                      PASSED FINAL INTERVIEW
                                    </span>
                                  )}
                                </td>

                                {/* 6. Interview Completed Date */}
                                <td style={{ padding: '16px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>
                                    {dateStr}
                                  </div>
                                </td>

                                {/* 7. Executive Decision / Actions (Strictly Horizontal, Anti-Spam Disabled when Waitlisted) */}
                                <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '6px', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                    {isStandby && isCapacityFull ? (
                                      waitlistRank === 1 ? (
                                        <button
                                          type="button"
                                          onClick={() => handlePresidentApprovalClick(i, candidateName)}
                                          style={{
                                            background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                                            color: '#ffffff', border: 'none', borderRadius: '8px',
                                            padding: '6px 12px', cursor: 'pointer', display: 'inline-flex',
                                            alignItems: 'center', justifyContent: 'center', gap: '5px',
                                            fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                                            boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)', transition: 'all 0.15s ease'
                                          }}
                                          title="All position openings are filled — Click Manage to authorize an additional vacancy slot and promote this #1 waitlisted candidate"
                                        >
                                          <i className="bx bx-slider-alt" style={{ fontSize: '13px' }} /> Manage
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled
                                          style={{
                                            background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0',
                                            borderRadius: '8px', padding: '6px 12px', cursor: 'not-allowed',
                                            fontWeight: '600', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                                            display: 'inline-flex', alignItems: 'center', gap: '5px'
                                          }}
                                          title={`Candidate is #${waitlistRank} on priority waitlist. Inactive until an opening becomes available or higher-priority waitlisted candidates are processed.`}
                                        >
                                          <i className="bx bx-time" style={{ fontSize: '13px' }} /> Waitlisted (#{waitlistRank})
                                        </button>
                                      )
                                    ) : isStandby && !isCapacityFull ? (
                                      waitlistRank === 1 ? (
                                        <button
                                          type="button"
                                          onClick={() => handlePresidentApprovalClick(i, candidateName)}
                                          style={{
                                            background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                                            color: '#ffffff', border: 'none', borderRadius: '8px',
                                            padding: '6px 12px', cursor: 'pointer', display: 'inline-flex',
                                            alignItems: 'center', justifyContent: 'center', gap: '5px',
                                            fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)', transition: 'all 0.15s ease'
                                          }}
                                          title="A position slot has reopened! Click to promote #1 priority candidate and advance to Job Offer tab"
                                        >
                                          <i className="bx bx-check-circle" style={{ fontSize: '13px' }} /> Promote (#1)
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled
                                          style={{
                                            background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0',
                                            borderRadius: '8px', padding: '6px 12px', cursor: 'not-allowed',
                                            fontWeight: '600', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                                            display: 'inline-flex', alignItems: 'center', gap: '5px'
                                          }}
                                          title={`Candidate is #${waitlistRank} on waitlist. Priority #1 candidate must be promoted first to respect queue order.`}
                                        >
                                          <i className="bx bx-time" style={{ fontSize: '13px' }} /> Standby (#{waitlistRank})
                                        </button>
                                      )
                                    ) : isCapacityFull ? (
                                      <button
                                        type="button"
                                        onClick={() => handlePresidentApprovalClick(i, candidateName)}
                                        style={{
                                          background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                                          color: '#ffffff', border: 'none', borderRadius: '8px',
                                          padding: '6px 12px', cursor: 'pointer', display: 'inline-flex',
                                          alignItems: 'center', justifyContent: 'center', gap: '5px',
                                          fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                                          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)', transition: 'all 0.15s ease'
                                        }}
                                        title={rawAvailableSlots > 0 && unreservedSlots <= 0 ? "Slot is reserved for Priority Waitlisted candidate — Click Manage to place this candidate on waitlist or authorize an additional slot" : "Slot capacity reached — Click to manage slot allocation or waitlist placement"}
                                      >
                                        <i className="bx bx-slider-alt" style={{ fontSize: '13px' }} /> Manage
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handlePresidentApprovalClick(i, candidateName)}
                                        style={{
                                          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                          color: '#ffffff', border: 'none', borderRadius: '8px',
                                          padding: '6px 12px', cursor: 'pointer', display: 'inline-flex',
                                          alignItems: 'center', justifyContent: 'center', gap: '5px',
                                          fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)', transition: 'all 0.15s ease'
                                        }}
                                        title="Approve candidate and advance to Job Offer tab"
                                      >
                                        <i className="bx bx-check-circle" style={{ fontSize: '13px' }} /> Approve
                                      </button>
                                    )}

                                    {!isStandby && (
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateResult(i.application_id, 'Failed Final Approval', candidateName, i.job_title)}
                                        style={{
                                          background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca',
                                          padding: '6px 11px', borderRadius: '8px', cursor: 'pointer',
                                          fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif",
                                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                                          transition: 'all 0.15s', whiteSpace: 'nowrap'
                                        }}
                                        title="Reject candidate at Final Approval"
                                      >
                                        <i className="bx bx-x-circle" style={{ fontSize: '13px' }} /> Reject
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={i.application_id} style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#fdf2f8' : 'transparent' }}>
                              {/* Selection Checkbox for Stage 1 */}
                              {evalTab === 'pending' && (
                                <td style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <input
                                      type="checkbox"
                                      disabled={!isSchedReady}
                                      title={!isSchedReady ? "Interview schedule has not arrived yet." : "Select candidate"}
                                      checked={isSchedReady && selectedFinalInterviewIds.includes(i.application_id)}
                                      onChange={() => {
                                        if (!isSchedReady) return;
                                        setSelectedFinalInterviewIds(prev =>
                                          prev.includes(i.application_id) ? prev.filter(x => x !== i.application_id) : [...prev, i.application_id]
                                        );
                                      }}
                                      style={{
                                        margin: 0, padding: 0,
                                        cursor: isSchedReady ? 'pointer' : 'not-allowed',
                                        width: '16px', height: '16px', accentColor: '#e6007e',
                                        display: 'block', flexShrink: 0,
                                        opacity: isSchedReady ? 1 : 0.4
                                      }}
                                    />
                                  </div>
                                </td>
                              )}


                              {/* Candidate Info with Colored Avatar */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '36px', height: '36px', borderRadius: '50%',
                                    background: (isPassedApproval || isPassedInterview || isReqVerified || isContractScheduled || isContractSigned) ? '#ecfdf5' : ((isFailedInterview || isIncompleteReq || isFailedPreEmp) ? '#fef2f2' : (isFailedApproval ? '#f1f5f9' : '#f8fafc')),
                                    border: (isPassedApproval || isPassedInterview || isReqVerified || isContractScheduled || isContractSigned) ? '1.5px solid #a7f3d0' : ((isFailedInterview || isIncompleteReq || isFailedPreEmp) ? '1.5px solid #fecaca' : (isFailedApproval ? '1.5px solid #cbd5e1' : '1.5px solid #cbd5e1')),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                  }}>
                                    <span style={{
                                      fontSize: '13px', fontWeight: '700',
                                      color: (isPassedApproval || isPassedInterview || isReqVerified || isContractScheduled || isContractSigned) ? '#059669' : ((isFailedInterview || isFailedPreEmp) ? '#dc2626' : (isIncompleteReq ? '#be123c' : (isFailedApproval ? '#475569' : '#64748b')))
                                    }}>
                                      {(candidateName[0] || 'A').toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <strong style={{ color: '#0f172a', fontSize: '13.5px', display: 'block' }}>{candidateName}</strong>
                                    {candidateEmail && <span style={{ color: '#64748b', fontSize: '12px' }}>{candidateEmail}</span>}
                                  </div>
                                </div>
                              </td>

                              {/* Position */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                <strong style={{ color: '#0f172a', fontSize: '13px' }}>{i.job_title}</strong>
                              </td>

                              {/* Column 3: Tab-dependent (Contract Status / Schedule / Decision Date) */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
                                {evalTab === 'contract_signing' ? (
                                  isContractScheduled && i.contract_signing_date ? (
                                    <div>
                                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                                        {new Date(i.contract_signing_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </strong>
                                      {i.contract_signing_time && (
                                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>{i.contract_signing_time}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Not Set</span>
                                  )
                                ) : evalTab === 'onboarding' ? (
                                  <div>
                                    <div style={{ fontWeight: '600', color: '#0f172a' }}>
                                      {i.updated_at ? new Date(i.updated_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : (i.applied_at ? new Date(i.applied_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—')}
                                    </div>
                                  </div>
                                ) : evalTab === 'job_offer' ? (() => {
                                  const isDeclined = ['OFFER DECLINED', 'OFFER_DECLINED'].includes((i.status || '').toUpperCase());
                                  const hasOfferSent = ['JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING', 'OFFER_EXTENDED'].includes((i.status || '').toUpperCase());
                                  let offerSentDate = i.updated_at;
                                  if (i.job_offer_details) {
                                    try {
                                      const details = typeof i.job_offer_details === 'string' ? JSON.parse(i.job_offer_details) : i.job_offer_details;
                                      if (isDeclined && details?.responded_at) offerSentDate = details.responded_at;
                                      else if (details?.sent_at) offerSentDate = details.sent_at;
                                    } catch (e) {
                                      // fallback to updated_at
                                    }
                                  }
                                  if (isDeclined) {
                                    return (
                                      <div>
                                        <div style={{ fontWeight: '600', color: '#b91c1c' }}>
                                          {offerSentDate ? new Date(offerSentDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: '600' }}>Declined</div>
                                      </div>
                                    );
                                  }
                                  return hasOfferSent ? (
                                    <div style={{ fontWeight: '600', color: '#0f172a' }}>
                                      {offerSentDate ? new Date(offerSentDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}
                                    </div>
                                  ) : (
                                    <div style={{ fontWeight: '600', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <i className="bx bx-time-five" style={{ fontSize: '13px', color: '#94a3b8' }} />
                                      Not Sent Yet
                                    </div>
                                  );
                                })() : (
                                  <div>
                                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{dateStr}</div>
                                    {timeStr && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{timeStr}</div>}
                                  </div>
                                )}
                              </td>

                              {/* Column 4: Interview Status / Offer Status / Contract Status */}
                              {(evalTab === 'pending' || evalTab === 'job_offer' || evalTab === 'contract_signing') && (() => {
                                if (evalTab === 'pending') {
                                  return (
                                    <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                      {!isSchedReady ? (
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          background: '#fffbeb',
                                          color: '#d97706',
                                          border: '1.5px solid #fde68a',
                                          borderRadius: '20px',
                                          padding: '4px 12px',
                                          fontSize: '11.5px',
                                          fontWeight: '700',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          <i className="bx bx-time-five" style={{ fontSize: '13px' }}></i> Upcoming
                                        </span>
                                      ) : (
                                        <span style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          background: '#ecfdf5',
                                          color: '#047857',
                                          border: '1.5px solid #a7f3d0',
                                          borderRadius: '20px',
                                          padding: '4px 12px',
                                          fontSize: '11.5px',
                                          fontWeight: '700',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          <i className="bx bx-check-circle" style={{ fontSize: '13px' }}></i> Ready
                                        </span>
                                      )}
                                    </td>
                                  );
                                }
                                if (evalTab === 'job_offer') {
                                  const isDeclined = ['OFFER DECLINED', 'OFFER_DECLINED'].includes((i.status || '').toUpperCase());
                                  const hasOfferSent = ['JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING', 'OFFER_EXTENDED'].includes((i.status || '').toUpperCase());
                                  return (
                                    <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                      {isDeclined ? (
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca',
                                          borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                        }}>
                                          <i className="bx bx-x-circle" style={{ fontSize: '14px' }}></i> OFFER DECLINED
                                        </span>
                                      ) : hasOfferSent ? (
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#fff7ed', color: '#c2410c', border: '1.5px solid #fed7aa',
                                          borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                        }}>
                                          <i className="bx bx-time" style={{ fontSize: '14px' }}></i> JOB OFFER PENDING
                                        </span>
                                      ) : (
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#d1fae5', color: '#047857', border: '1.5px solid #a7f3d0',
                                          borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                        }}>
                                          <i className="bx bx-check-circle" style={{ fontSize: '14px' }}></i> READY FOR OFFER
                                        </span>
                                      )}
                                    </td>
                                  );
                                }
                                if (evalTab === 'contract_signing') {
                                  return (
                                    <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                      {isContractScheduled ? (
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#ecfdf5', color: '#047857', border: '1.5px solid #a7f3d0',
                                          borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                        }}>
                                          <i className="bx bx-calendar-check" style={{ fontSize: '14px' }}></i> Scheduled
                                        </span>
                                      ) : (
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a',
                                          borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                        }}>
                                          <i className="bx bx-time" style={{ fontSize: '14px' }}></i> Ready to Schedule
                                        </span>
                                      )}
                                    </td>
                                  );
                                }
                                return null;
                              })()}

                              {/* Tab 1, 2, 3: Column for Actions or Status */}
                              {evalTab !== 'onboarding' && (
                                <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: evalTab === 'pending' ? 'left' : 'center' }}>
                                  {evalTab === 'pending' && (
                                    /* ── Tab 1 Pending Actions (Pass, Fail, No Show matching screenshot) ── */
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', flexWrap: 'nowrap' }}>
                                      <button
                                        type="button"
                                        disabled={!isSchedReady}
                                        onClick={() => isSchedReady && handleUpdateResult(i.application_id, 'Passed Final Interview', candidateName, i.job_title)}
                                        style={{
                                          background: '#059669',
                                          color: '#ffffff',
                                          border: 'none',
                                          padding: '8px 18px',
                                          borderRadius: '10px',
                                          cursor: isSchedReady ? 'pointer' : 'not-allowed',
                                          opacity: isSchedReady ? 1 : 0.45,
                                          fontWeight: '600',
                                          fontSize: '13px',
                                          fontFamily: "'Inter', sans-serif",
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          boxShadow: isSchedReady ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                                          transition: 'all 0.15s ease',
                                          whiteSpace: 'nowrap'
                                        }}
                                        onMouseOver={(e) => { if (isSchedReady) { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                                        onMouseOut={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none'; }}
                                        title={!isSchedReady ? "Action disabled: Scheduled interview has not taken place yet." : "Mark candidate as Passed Final Interview"}
                                      >
                                        <i className="bx bx-check-circle" style={{ fontSize: '16px' }}></i> Pass
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!isSchedReady}
                                        onClick={() => isSchedReady && handleUpdateResult(i.application_id, 'Failed Final Interview', candidateName, i.job_title)}
                                        style={{
                                          background: '#fff1f2',
                                          color: '#e11d48',
                                          border: '1.5px solid #fecdd3',
                                          padding: '8px 18px',
                                          borderRadius: '10px',
                                          cursor: isSchedReady ? 'pointer' : 'not-allowed',
                                          opacity: isSchedReady ? 1 : 0.45,
                                          fontWeight: '600',
                                          fontSize: '13px',
                                          fontFamily: "'Inter', sans-serif",
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          transition: 'all 0.15s ease',
                                          whiteSpace: 'nowrap'
                                        }}
                                        onMouseOver={(e) => { if (isSchedReady) { e.currentTarget.style.background = '#ffe4e6'; e.currentTarget.style.borderColor = '#fb7185'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.borderColor = '#fecdd3'; e.currentTarget.style.transform = 'none'; }}
                                        title={!isSchedReady ? "Action disabled: Scheduled interview has not taken place yet." : "Mark candidate as Failed Final Interview"}
                                      >
                                        <i className="bx bx-x-circle" style={{ fontSize: '16px' }}></i> Fail
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!isSchedReady}
                                        onClick={() => isSchedReady && handleUpdateResult(i.application_id, 'Candidate No Show', candidateName, i.job_title)}
                                        style={{
                                          background: '#fffbeb',
                                          color: '#d97706',
                                          border: '1.5px solid #fde68a',
                                          padding: '8px 18px',
                                          borderRadius: '10px',
                                          cursor: isSchedReady ? 'pointer' : 'not-allowed',
                                          opacity: isSchedReady ? 1 : 0.45,
                                          fontWeight: '600',
                                          fontSize: '13px',
                                          fontFamily: "'Inter', sans-serif",
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          transition: 'all 0.15s ease',
                                          whiteSpace: 'nowrap'
                                        }}
                                        onMouseOver={(e) => { if (isSchedReady) { e.currentTarget.style.background = '#fef3c7'; e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = '#fffbeb'; e.currentTarget.style.borderColor = '#fde68a'; e.currentTarget.style.transform = 'none'; }}
                                        title={!isSchedReady ? "Action disabled: Scheduled interview has not taken place yet." : "Mark candidate as No Show for the interview"}
                                      >
                                        <i className="bx bx-user-x" style={{ fontSize: '16px' }}></i> No Show
                                      </button>
                                    </div>
                                  )}


                                  {evalTab === 'job_offer' && (() => {
                                    const isDeclined = ['OFFER DECLINED', 'OFFER_DECLINED'].includes((i.status || '').toUpperCase());
                                    const hasOfferSent = ['JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING', 'OFFER_EXTENDED'].includes((i.status || '').toUpperCase());
                                    return (
                                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        {isDeclined ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => setDeclinedReasonCandidate(i)}
                                              style={{
                                                background: '#f8fafc', color: '#0f172a', border: '1.5px solid #cbd5e1',
                                                borderRadius: '7px', padding: '7px 13px', cursor: 'pointer',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.15s ease'
                                              }}
                                              title="View candidate's reason for declining the job offer"
                                            >
                                              <i className='bx bx-show' style={{ fontSize: '15px', color: '#475569' }}></i> View Reason
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateResult(i.application_id, 'Offer Rejected', candidateName, i.job_title)}
                                              style={{
                                                background: '#ef4444', color: '#ffffff', border: 'none',
                                                borderRadius: '7px', padding: '7px 14px', cursor: 'pointer',
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)', transition: 'all 0.15s ease'
                                              }}
                                              title="Acknowledge decline and move to Application Audit Record"
                                            >
                                              <i className='bx bx-user-x' style={{ fontSize: '15px' }}></i> Offer Rejected
                                            </button>
                                          </>
                                        ) : hasOfferSent ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                window.open(`${API_BASE_URL}/super_admin/generate_job_offer_pdf.php?application_id=${i.application_id}`, '_blank');
                                              }}
                                              style={{
                                                background: 'linear-gradient(135deg, #e6007e 0%, #ff2d92 100%)',
                                                color: '#ffffff', border: 'none', borderRadius: '7px',
                                                padding: '7px 14px', cursor: 'pointer', display: 'inline-flex',
                                                alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                                boxShadow: '0 2px 8px rgba(230, 0, 126, 0.28)', transition: 'all 0.15s ease'
                                              }}
                                              title="View Official Job Offer Letter PDF"
                                            >
                                              <i className='bx bx-file' style={{ fontSize: '15px' }}></i> View Offer
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setJobOfferModalCandidate(i)}
                                              style={{
                                                background: '#f8fafc', color: '#475569', border: '1.5px solid #cbd5e1',
                                                padding: '7px 12px', borderRadius: '7px', cursor: 'pointer',
                                                fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                transition: 'all 0.15s'
                                              }}
                                              title="Edit Job Offer terms"
                                            >
                                              <i className="bx bx-edit" style={{ fontSize: '14px' }}></i> Edit
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => setJobOfferModalCandidate(i)}
                                            style={{
                                              background: 'linear-gradient(135deg, #e6007e 0%, #ff2d92 100%)',
                                              color: '#ffffff', border: 'none', borderRadius: '7px',
                                              padding: '7px 16px', cursor: 'pointer', display: 'inline-flex',
                                              alignItems: 'center', justifyContent: 'center', gap: '6px',
                                              fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                              boxShadow: '0 2px 8px rgba(230, 0, 126, 0.28)', transition: 'all 0.15s ease'
                                            }}
                                            title="Create and send official Job Offer letter to candidate"
                                          >
                                            <i className='bx bx-file' style={{ fontSize: '15px' }}></i> Make Job Offer
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {evalTab === 'contract_signing' && (
                                    /* ── Tab 3 Contract Signing Action Button ── */
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setOnboardingDrawerCandidate(i)}
                                        style={{
                                          background: '#0f172a',
                                          color: '#ffffff',
                                          border: 'none',
                                          padding: '7px 16px',
                                          borderRadius: '7px',
                                          cursor: 'pointer',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          fontFamily: "'Montserrat', sans-serif",
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.3)',
                                          transition: 'all 0.15s'
                                        }}
                                        title="Open drawer to schedule contract signing"
                                      >
                                        <i className="bx bx-calendar-edit" style={{ fontSize: '16px' }}></i> Manage Contract
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}

                              {/* Tab 4 Onboarding Option 2: Dedicated Employment Status Column */}
                              {evalTab === 'onboarding' && (() => {
                                const isHiredOfficially = [
                                  'OFFICIALLY HIRED', 'OFFICIALLY_HIRED',
                                  'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED'
                                ].includes(normStatus) || Boolean(i.work_start_date && (normStatus === 'OFFICIALLY HIRED' || normStatus === 'COMPLETED REQUIREMENTS'));

                                return (
                                  <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {isHiredOfficially ? (
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#ecfdf5', color: '#047857', border: '1.5px solid #a7f3d0',
                                          borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                        }}>
                                          <i className="bx bx-check-double" style={{ fontSize: '15px', color: '#059669' }}></i> Officially Hired
                                        </span>
                                      ) : (
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                                          background: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a',
                                          borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                        }}>
                                          <i className="bx bx-time" style={{ fontSize: '14px', color: '#d97706' }}></i> Requirement Pending
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })()}

                              {/* Tab 4 Onboarding Option 2: Dedicated Requirements Status Column */}
                              {evalTab === 'onboarding' && (() => {
                                const isOfficiallyHired = [
                                  'OFFICIALLY HIRED', 'OFFICIALLY_HIRED',
                                  'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED',
                                  'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED',
                                  'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT',
                                  'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT'
                                ].includes(normStatus);

                                const isCompletedReq = ['COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED'].includes(normStatus);
                                const isPartiallyCompliant = ['PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'].includes(normStatus);

                                const verifiedCount = (() => {
                                  try {
                                    if (i.pre_employment_checklist) {
                                      const c = JSON.parse(i.pre_employment_checklist);
                                      const reqKeys = ['medical', 'drug_test', 'nbi', 'police', 'coe', 'tor_diploma'];
                                      return reqKeys.filter(k => c[k] === true || c[k] === 'verified').length;
                                    }
                                  } catch (e) { }
                                  return 0;
                                })();

                                return (
                                  <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {isOfficiallyHired ? (
                                        isCompletedReq ? (
                                          <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                            background: '#dcfce7', color: '#15803d', border: '1.5px solid #86efac',
                                            borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontWeight: '800'
                                          }}>
                                            <i className="bx bx-badge-check" style={{ fontSize: '14px', color: '#16a34a' }}></i> Completed Requirements
                                          </span>
                                        ) : isPartiallyCompliant ? (
                                          <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            background: '#fef3c7', color: '#b45309', border: '1.5px solid #fde68a',
                                            borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontWeight: '800'
                                          }}>
                                            <i className="bx bx-user-check" style={{ fontSize: '14px', color: '#b45309' }}></i> Partially Compliant ({verifiedCount}/6)
                                          </span>
                                        ) : (
                                          <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            background: '#fffbeb', color: '#b45309', border: '1.5px solid #fde68a',
                                            borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontWeight: '700'
                                          }}>
                                            <i className="bx bx-time" style={{ fontSize: '13px' }}></i> Requirements Pending ({verifiedCount}/6)
                                          </span>
                                        )
                                      ) : (
                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })()}

                              {/* Action Column (Rendered in Onboarding tab) */}

                              {evalTab === 'onboarding' && (
                                <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setRequirementsDrawerCandidate(i)}
                                    style={{
                                      background: '#0f172a',
                                      color: '#ffffff',
                                      border: 'none',
                                      padding: '7px 14px',
                                      borderRadius: '7px',
                                      cursor: 'pointer',
                                      fontWeight: '700',
                                      fontSize: '12px',
                                      fontFamily: "'Montserrat', sans-serif",
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)',
                                      transition: 'all 0.15s'
                                    }}
                                    title="Open Pre-Employment Requirements Checklist"
                                  >
                                    <i className="bx bx-list-check" style={{ fontSize: '16px' }}></i> Requirements
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination Controls (Always visible across all 5 candidate evaluation tabs when candidates exist) */}
                    {filteredList.length > 0 && (
                      <div style={{
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop: '1px solid #e2e8f0',
                        background: '#ffffff',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
                          Showing <strong>{(evalCurrentPage - 1) * EVAL_PAGE_SIZE + 1}</strong> to <strong>{Math.min(evalCurrentPage * EVAL_PAGE_SIZE, filteredList.length)}</strong> of <strong>{filteredList.length}</strong> candidate(s)
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            disabled={evalCurrentPage <= 1}
                            onClick={() => setEvalPage(prev => Math.max(1, prev - 1))}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: evalCurrentPage <= 1 ? '#f8fafc' : '#ffffff',
                              color: evalCurrentPage <= 1 ? '#94a3b8' : '#334155',
                              cursor: evalCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            &lt; Previous
                          </button>

                          {Array.from({ length: evalTotalPages }, (_, idx) => idx + 1).map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setEvalPage(p)}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                border: evalCurrentPage === p ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                                background: evalCurrentPage === p ? '#0f172a' : '#ffffff',
                                color: evalCurrentPage === p ? '#ffffff' : '#334155',
                                fontWeight: evalCurrentPage === p ? '700' : '500',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              {p}
                            </button>
                          ))}

                          <button
                            type="button"
                            disabled={evalCurrentPage >= evalTotalPages}
                            onClick={() => setEvalPage(prev => Math.min(evalTotalPages, prev + 1))}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: evalCurrentPage >= evalTotalPages ? '#f8fafc' : '#ffffff',
                              color: evalCurrentPage >= evalTotalPages ? '#94a3b8' : '#334155',
                              cursor: evalCurrentPage >= evalTotalPages ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            Next &gt;
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          );
        })()}

        {/* ── Application Audit Records Tab (Identical to Admin MasterListTab) ── */}
        {activeTab === 'master_list' && <MasterListTab showToast={showToast} />}

        {/* ── System Audit Records Tab ── */}
        {activeTab === 'audit' && <SuperAdminAuditTab />}

        {/* ── Resume Screening Tab (Reused from Admin) ── */}
        {activeTab === 'applicants' && <ApplicantsTab showToast={showToast} />}

        {/* ── Interview Management Tab (Reused from Admin) ── */}
        {activeTab === 'interviews' && <InterviewsTab showToast={showToast} />}

        {/* ── Chatbot Intelligence Tab (Reused from Admin) ── */}
        {activeTab === 'chatbot_kb' && <ChatbotKbTab showToast={showToast} />}

      </main>

      {/* ── Add Admin Modal ── */}
      {adminModalOpen && ReactDOM.createPortal(
        <div style={MODAL_OVERLAY}>
          <div style={MODAL_CARD}>
            <div style={MODAL_HEADER}>
              <div>
                <h3 style={MODAL_TITLE}>Add New Admin User</h3>
                <p style={MODAL_SUB}>A secure temporary password will be auto-generated and emailed to the admin.</p>
              </div>
              <button style={MODAL_CLOSE} onClick={() => { setAdminModalOpen(false); setModalError(''); }}>✕</button>
            </div>
            {modalError && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', fontWeight: '600' }}>⚠️ {modalError}</div>}
            <form onSubmit={handleAddAdmin}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div><label style={LABEL_STYLE}>First Name</label><input required type="text" placeholder="First Name" minLength={2} maxLength={50} value={newAdmin.first_name} onChange={e => setNewAdmin({ ...newAdmin, first_name: autoCapitalize(e.target.value) })} style={FIELD_STYLE} /></div>
                <div><label style={LABEL_STYLE}>Last Name</label><input required type="text" placeholder="Last Name" minLength={2} maxLength={50} value={newAdmin.last_name} onChange={e => setNewAdmin({ ...newAdmin, last_name: autoCapitalize(e.target.value) })} style={FIELD_STYLE} /></div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={LABEL_STYLE}>Email Address</label>
                <input required type="email" placeholder="admin@airshipexpress.com" maxLength={254} value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} style={FIELD_STYLE} />
              </div>
              {/* Info note */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', marginBottom: '22px' }}>
                <i className='bx bx-lock-alt' style={{ fontSize: '18px', color: '#15803d', flexShrink: 0, marginTop: '1px' }}></i>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#15803d', fontWeight: '600', lineHeight: 1.5 }}>
                  A strong temporary password will be auto-generated and securely delivered to the admin's email. They must change it on first login.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" style={BTN_CANCEL} onClick={() => { setAdminModalOpen(false); setModalError(''); }}>Cancel</button>
                <button type="submit" style={BTN_PRIMARY}>
                  <i className='bx bx-user-plus' style={{ fontSize: '16px', marginRight: '6px' }}></i>Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Update Admin Modal ── */}
      {editModalOpen && ReactDOM.createPortal(
        <div style={MODAL_OVERLAY}>
          <div style={MODAL_CARD}>
            <div style={MODAL_HEADER}>
              <div>
                <h3 style={MODAL_TITLE}>Update Admin Account</h3>
                <p style={MODAL_SUB}>Update this admin's name and email address.</p>
              </div>
              <button style={MODAL_CLOSE} onClick={() => { setEditModalOpen(false); setModalError(''); }}>✕</button>
            </div>
            {modalError && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', fontWeight: '600' }}>⚠️ {modalError}</div>}
            <form onSubmit={confirmUpdateAdminSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div><label style={LABEL_STYLE}>First Name</label><input required type="text" placeholder="First Name" minLength={2} maxLength={50} value={editAdmin.first_name} onChange={e => setEditAdmin({ ...editAdmin, first_name: autoCapitalize(e.target.value) })} style={FIELD_STYLE} /></div>
                <div><label style={LABEL_STYLE}>Last Name</label><input required type="text" placeholder="Last Name" minLength={2} maxLength={50} value={editAdmin.last_name} onChange={e => setEditAdmin({ ...editAdmin, last_name: autoCapitalize(e.target.value) })} style={FIELD_STYLE} /></div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={LABEL_STYLE}>Email Address</label>
                <input required type="email" placeholder="admin@airshipexpress.com" maxLength={254} value={editAdmin.email} onChange={e => setEditAdmin({ ...editAdmin, email: e.target.value })} style={FIELD_STYLE} />
              </div>

              {/* Password Reset Section */}
              <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '2px' }}>
                      Password Management
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4', display: 'block' }}>
                      Auto-generate a new secure temporary password and email it.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAdminPassword}
                    style={{
                      flexShrink: 0,
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #fde68a',
                      background: '#fef3c7',
                      color: '#92400e',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <i className='bx bx-reset' style={{ fontSize: '15px' }}></i> Reset Password
                  </button>
                </div>
              </div>

              {/* Account Deactivation Section (Professional, no Danger Zone) */}
              <div style={{ marginBottom: '20px', background: '#fff5f5', padding: '14px 16px', borderRadius: '10px', border: '1px solid #fed7d7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b', display: 'block', marginBottom: '2px' }}>
                      Account Deactivation
                    </span>
                    <span style={{ fontSize: '12px', color: '#7f1d1d', opacity: 0.85, lineHeight: '1.4', display: 'block' }}>
                      Revoke access and move to Inactive. History remains preserved.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeactivateAdmin}
                    style={{
                      flexShrink: 0,
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #fca5a5',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: "'Inter', sans-serif",
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <i className='bx bx-user-x' style={{ fontSize: '15px' }}></i> Deactivate Account
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" style={BTN_CANCEL} onClick={() => { setEditModalOpen(false); setModalError(''); }}>Cancel</button>
                <button type="submit" style={BTN_PRIMARY}>
                  <i className='bx bx-save' style={{ fontSize: '16px', marginRight: '6px' }}></i>Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Add Slot Modal (With Number of Slots dropdown) ── */}
      {slotModalOpen && ReactDOM.createPortal(
        <div style={MODAL_OVERLAY}>
          <div style={{ ...MODAL_CARD, width: '490px' }}>
            <div style={MODAL_HEADER}>
              <div>
                <h3 style={MODAL_TITLE}>Add Interview Time Slot</h3>
                <p style={MODAL_SUB}>Select date, start time, and how many consecutive 30-min slots to generate.</p>
              </div>
              <button style={MODAL_CLOSE} onClick={() => { setSlotModalOpen(false); setSlotDayCount(null); }}>✕</button>
            </div>
            {slotError && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', fontSize: '12.5px', marginBottom: '16px', fontWeight: '600' }}>⚠️ {slotError}</div>}
            <form onSubmit={handleAddSlot}>
              <div style={{ marginBottom: '16px' }}>
                <label style={LABEL_STYLE}>Interview Date (Weekdays Only)</label>
                <WeekdayCalendarPicker
                  value={newSlot.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(chosenDate) => {
                    setNewSlot(prev => ({ ...prev, date: chosenDate }));
                    setSlotError('');
                    if (chosenDate) {
                      fetchSlotDayCount(chosenDate);
                    } else {
                      setSlotDayCount(null);
                    }
                  }}
                  placeholder="Select interview date (Mon – Fri)..."
                  required
                />
                {slotDayCount !== null && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '7px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                    <i className={`bx bx-info-circle`} style={{ fontSize: '15px' }}></i>
                    {slotDayCount.count} slot(s) already exist for this date.
                  </div>
                )}
              </div>

              {/* Number of Slots Field */}
              <div style={{ marginBottom: '16px' }}>
                <label style={LABEL_STYLE}>Number of Slots to Create</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={newSlot.num_slots || 1}
                  onChange={e => handleNumSlotsChange(e.target.value)}
                  style={{ ...FIELD_STYLE, width: '100%' }}
                  placeholder="Enter number of slots (e.g. 6)"
                />
                <p style={{ fontSize: '12px', color: '#64748b', margin: '5px 0 0 0' }}>
                  Each slot = 30 minutes. Enter any number of consecutive slots you need.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '14px', rowGap: '6px', marginBottom: '16px', alignItems: 'end' }}>
                {/* Row 1: Labels */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '22px' }}>
                  <label style={{ ...LABEL_STYLE, margin: 0, whiteSpace: 'nowrap' }}>Start Time</label>
                  <span style={{ fontSize: '11px', color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                    8:00 AM – 5:00 PM
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '22px' }}>
                  <label style={{ ...LABEL_STYLE, margin: 0, whiteSpace: 'nowrap' }}>End Time (Auto)</label>
                  <span style={{ fontSize: '11px', color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                    Until 5:00 PM
                  </span>
                </div>

                {/* Row 2: Inputs (Guaranteed 100% horizontally aligned) */}
                <div>
                  <input
                    ref={startTimeRef}
                    required
                    type="time"
                    min="08:00"
                    max="17:00"
                    value={newSlot.start_time}
                    onChange={e => handleStartTimeChange(e.target.value)}
                    style={FIELD_STYLE}
                  />
                </div>
                <div>
                  <input
                    ref={endTimeRef}
                    type="time"
                    min="08:30"
                    max="17:00"
                    value={newSlot.end_time || calculateEndTime(newSlot.start_time, newSlot.num_slots || 1)}
                    onChange={() => { }}
                    onKeyDown={e => e.preventDefault()}
                    style={{ ...FIELD_STYLE, background: '#f8fafc', color: '#475569', cursor: 'default' }}
                    title="Automatically computed based on Start Time and Number of Slots (30 mins per slot)"
                  />
                </div>
              </div>

              {/* Summary calculation box */}
              {newSlot.start_time && newSlot.end_time && (
                <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', color: '#475569', marginBottom: '22px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="bx bx-time" style={{ fontSize: '16px', color: '#e6007e' }}></i>
                  <span>
                    Will create <strong>{newSlot.num_slots || 1}</strong> consecutive slot(s) from <strong>{fmtTime(newSlot.start_time)}</strong> to <strong>{fmtTime(newSlot.end_time)}</strong>.
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" style={BTN_CANCEL} onClick={() => { setSlotModalOpen(false); setSlotDayCount(null); }}>Cancel</button>
                <button type="submit" style={BTN_PRIMARY}>
                  Save Time Slots
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Update Candidate Status Modal ── */}
      {updateStatusTarget && ReactDOM.createPortal(
        <div style={MODAL_OVERLAY}>
          <div
            style={{ ...MODAL_CARD, maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={MODAL_HEADER}>
              <div>
                <h3 style={MODAL_TITLE}>Update Candidate Status</h3>
                <p style={MODAL_SUB}>
                  Candidate: <strong style={{ color: '#0f172a' }}>{updateStatusTarget.name}</strong> • Position: <strong>{updateStatusTarget.job}</strong>
                </p>
              </div>
              <button style={MODAL_CLOSE} onClick={() => setUpdateStatusTarget(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
              {/* Option 1: Candidate Withdrew */}
              <div
                onClick={() => setSelectedPostHireStatus('Candidate Withdrew')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: selectedPostHireStatus === 'Candidate Withdrew' ? '2px solid #e6007e' : '1.5px solid #e2e8f0',
                  background: selectedPostHireStatus === 'Candidate Withdrew' ? '#fdf2f8' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: selectedPostHireStatus === 'Candidate Withdrew' ? '#fce7f3' : '#f1f5f9',
                  color: selectedPostHireStatus === 'Candidate Withdrew' ? '#e6007e' : '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: '18px'
                }}>
                  <i className="bx bx-user-minus" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>Candidate Withdrew</strong>
                    <span style={{ fontSize: '11px', fontWeight: '700', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px' }}>
                      Restores 1 Opening
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                    The candidate voluntarily backed out or declined to proceed with the position.
                  </p>
                </div>
              </div>

              {/* Option 2: Incomplete Requirements */}
              <div
                onClick={() => setSelectedPostHireStatus('Incomplete Requirements')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: selectedPostHireStatus === 'Incomplete Requirements' ? '2px solid #e6007e' : '1.5px solid #e2e8f0',
                  background: selectedPostHireStatus === 'Incomplete Requirements' ? '#fdf2f8' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: selectedPostHireStatus === 'Incomplete Requirements' ? '#fce7f3' : '#f1f5f9',
                  color: selectedPostHireStatus === 'Incomplete Requirements' ? '#e6007e' : '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: '18px'
                }}>
                  <i className="bx bx-time-five" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>Incomplete Requirements</strong>
                    <span style={{ fontSize: '11px', fontWeight: '700', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px' }}>
                      Restores 1 Opening
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                    The candidate missed the 1-week pre-employment physical document submission deadline.
                  </p>
                </div>
              </div>

              {/* Option 3: Failed Pre-Employment */}
              <div
                onClick={() => setSelectedPostHireStatus('Failed Pre-Employment')}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: selectedPostHireStatus === 'Failed Pre-Employment' ? '2px solid #e6007e' : '1.5px solid #e2e8f0',
                  background: selectedPostHireStatus === 'Failed Pre-Employment' ? '#fdf2f8' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: selectedPostHireStatus === 'Failed Pre-Employment' ? '#fce7f3' : '#f1f5f9',
                  color: selectedPostHireStatus === 'Failed Pre-Employment' ? '#e6007e' : '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: '18px'
                }}>
                  <i className="bx bx-error-circle" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>Failed Pre-Employment</strong>
                    <span style={{ fontSize: '11px', fontWeight: '700', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px' }}>
                      Restores 1 Opening
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.45 }}>
                    The candidate did not pass mandatory pre-employment clearance (medical or drug testing).
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                style={BTN_CANCEL}
                onClick={() => setUpdateStatusTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...BTN_PRIMARY,
                  background: 'linear-gradient(135deg, #e6007e 0%, #be006b 100%)',
                  boxShadow: '0 4px 12px rgba(230, 0, 126, 0.25)'
                }}
                onClick={() => {
                  const target = updateStatusTarget;
                  setUpdateStatusTarget(null);
                  handleUpdateResult(target.id, selectedPostHireStatus, target.name, target.job);
                }}
              >
                <i className="bx bx-check" style={{ fontSize: '16px', marginRight: '6px' }} />
                Confirm &amp; Update Status
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Freedom Time Contract Signing Schedule Modal ── */}
      {contractModalCandidate && ReactDOM.createPortal(
        <div style={MODAL_OVERLAY}>
          <div
            style={{ ...MODAL_CARD, maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={MODAL_HEADER}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fdf2f8', color: '#e6007e', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', marginBottom: '6px' }}>
                  <i className="bx bx-calendar-check" /> CONTRACT SIGNING &amp; ONBOARDING
                </div>
                <h3 style={MODAL_TITLE}>Schedule Contract Signing</h3>
                <p style={MODAL_SUB}>
                  Candidate: <strong style={{ color: '#0f172a' }}>{contractModalCandidate.name}</strong> • Position: <strong>{contractModalCandidate.job}</strong>
                </p>
              </div>
              <button
                style={MODAL_CLOSE}
                disabled={contractSubmitting}
                onClick={() => setContractModalCandidate(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleContractSigning}>
              {/* Duplicate Schedule Error Banner */}
              {contractScheduleError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  color: '#991b1b',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.08)'
                }}>
                  <i className="bx bx-error-circle" style={{ fontSize: '20px', color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px', marginBottom: '2px', color: '#b91c1c' }}>
                      Cannot Schedule: Slot Already Booked
                    </strong>
                    <span>{contractScheduleError}</span>
                  </div>
                </div>
              )}

              {/* Date with Dynamic Day of the Week calculation */}
              <div style={{ marginBottom: '16px' }}>
                <label style={LABEL_STYLE}>
                  Scheduled Date &amp; Day <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                  <WeekdayCalendarPicker
                    value={contractDate}
                    onChange={(val) => {
                      setContractDate(val);
                      setContractScheduleError(null);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    placeholder="Select signing date..."
                    required
                  />
                  <div style={{
                    minWidth: '110px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    color: contractDate ? '#e6007e' : '#94a3b8',
                    padding: '0 10px'
                  }}>
                    {contractDate
                      ? new Date(contractDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
                      : 'Select Date'}
                  </div>
                </div>
                {contractDate && (() => {
                  const day = new Date(contractDate + 'T00:00:00').getDay();
                  if (day === 0 || day === 6) {
                    return (
                      <p style={{ color: '#ef4444', fontSize: '11.5px', marginTop: '6px', marginBottom: 0, fontWeight: '700' }}>
                        ⚠️ Weekends are disabled. Contract signing can only be scheduled on weekdays (Monday to Friday).
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Time Input (Plain text / picker, no presets) */}
              <div style={{ marginBottom: '16px' }}>
                <label style={LABEL_STYLE}>
                  Scheduled Time <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10:00 AM"
                  value={contractTime}
                  onChange={(e) => {
                    setContractTime(e.target.value);
                    setContractScheduleError(null);
                  }}
                  style={FIELD_STYLE}
                />
              </div>

              {/* What to Bring / Special Instructions */}
              <div style={{ marginBottom: '22px' }}>
                <label style={LABEL_STYLE}>
                  What to Bring / Special Instructions
                </label>
                <textarea
                  rows={3}
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  placeholder="e.g. Please bring 2 valid IDs and 1 black signing pen."
                  style={{ ...FIELD_STYLE, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  style={BTN_CANCEL}
                  disabled={contractSubmitting}
                  onClick={() => setContractModalCandidate(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contractSubmitting}
                  style={{
                    ...BTN_PRIMARY,
                    background: 'linear-gradient(135deg, #e6007e 0%, #be006b 100%)',
                    boxShadow: '0 4px 12px rgba(230, 0, 126, 0.25)',
                    cursor: contractSubmitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  <i className="bx bx-send" style={{ fontSize: '16px', marginRight: '6px' }} />
                  {contractSubmitting ? 'Scheduling...' : 'Confirm & Schedule Contract Signing'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

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

      {/* ── Logout Confirm ── */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Confirm Super Admin Sign Out"
        message="Are you sure you want to log out of the Super Admin Portal?"
        confirmText="Log Out"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmLogoutAction}
        onCancel={() => setShowLogoutConfirm(false)}
      />


      {/* ── Generic Action Confirm (Delete, Result, Admin Update) ── */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
        cancelText={confirmModalState.cancelText}
        type={confirmModalState.type}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ── Plain Professional Position Capacity Modal ── */}
      {slotWarningModalState.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 40px -12px rgba(15, 23, 42, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif"
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Manage Position Capacity &amp; Placement
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {slotWarningModalState.jobTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSlotWarningModalState(prev => ({ ...prev, isOpen: false }))}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#94a3b8', fontSize: '20px', padding: '4px',
                  borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
              >
                <i className="bx bx-x" />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '20px 22px' }}>
              {/* Context Summary */}
              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: '8px', padding: '12px 14px', marginBottom: '18px',
                fontSize: '13px', color: '#334155', lineHeight: 1.5
              }}>
                {slotWarningModalState.isAlreadyWaitlisted ? (
                  <span><strong>{slotWarningModalState.candidateName}</strong> is currently on Priority Standby (#<strong>{slotWarningModalState.waitlistRank || 1}</strong>). All <strong>{slotWarningModalState.totalSlots}</strong> authorized opening(s) are currently filled.
                  {slotWarningModalState.activeHolderName && (
                    <span> A job offer is currently held by <strong>{slotWarningModalState.activeHolderName}</strong>.</span>
                  )}</span>
                ) : slotWarningModalState.isReservedForWaitlist ? (
                  <span>The open slot for <strong>{slotWarningModalState.jobTitle}</strong> is currently reserved for a priority waitlisted candidate awaiting promotion.</span>
                ) : (
                  <span>All <strong>{slotWarningModalState.totalSlots}</strong> authorized opening(s) are currently filled.
                  {slotWarningModalState.activeHolderName && (
                    <span> A job offer is currently held by <strong>{slotWarningModalState.activeHolderName}</strong>.</span>
                  )}</span>
                )}
                <div style={{ marginTop: '4px', color: '#64748b', fontSize: '12.5px' }}>
                  Select a management action for <strong>{slotWarningModalState.candidateName}</strong>:
                </div>
              </div>

              {/* Two Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {/* Option 1: Waitlist */}
                <div style={{
                  border: '1px solid #e2e8f0', borderRadius: '10px',
                  padding: '14px 16px', background: slotWarningModalState.isAlreadyWaitlisted ? '#f8fafc' : '#ffffff',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  opacity: slotWarningModalState.isAlreadyWaitlisted ? 0.75 : 1
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                      Place on Priority Waitlist
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: '600',
                      color: slotWarningModalState.isAlreadyWaitlisted ? '#64748b' : '#2563eb',
                      background: slotWarningModalState.isAlreadyWaitlisted ? '#e2e8f0' : '#eff6ff',
                      padding: '2px 8px', borderRadius: '4px'
                    }}>
                      {slotWarningModalState.isAlreadyWaitlisted ? `Already Queued (#${slotWarningModalState.waitlistRank || 1})` : `Queued #${slotWarningModalState.nextQueueNumber || 1}`}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.45 }}>
                    {slotWarningModalState.isAlreadyWaitlisted
                      ? "Candidate is already placed on the priority standby queue. To admit them now while all slots are filled, authorize an additional vacancy slot below."
                      : "Candidate officially passes and is placed on priority standby. If an offer is declined or a slot opens, they can be promoted with 1 click."}
                  </p>
                  <div style={{ marginTop: '4px' }}>
                    {slotWarningModalState.isAlreadyWaitlisted ? (
                      <button
                        type="button"
                        disabled
                        style={{
                          background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0',
                          borderRadius: '6px', padding: '8px 14px', cursor: 'not-allowed',
                          fontWeight: '600', fontSize: '12.5px', display: 'inline-flex',
                          alignItems: 'center', gap: '5px'
                        }}
                        title="Candidate is already on the priority standby queue"
                      >
                        <i className="bx bx-check" style={{ fontSize: '14px' }} />
                        Already on Waitlist (#{slotWarningModalState.waitlistRank || 1})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          const appId = slotWarningModalState.applicationId;
                          setSlotWarningModalState(prev => ({ ...prev, isOpen: false }));
                          await executeUpdateResult(appId, 'PLACE_ON_STANDBY');
                        }}
                        style={{
                          background: '#0f172a', color: '#ffffff', border: 'none',
                          borderRadius: '6px', padding: '8px 14px', cursor: 'pointer',
                          fontWeight: '600', fontSize: '12.5px', display: 'inline-flex',
                          alignItems: 'center', gap: '5px'
                        }}
                      >
                        <i className="bx bx-time" style={{ fontSize: '14px' }} />
                        Place on Waitlist
                      </button>
                    )}
                  </div>
                </div>

                {/* Option 2: Increase Slot */}
                <div style={{
                  border: slotWarningModalState.isAlreadyWaitlisted ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 16px', background: slotWarningModalState.isAlreadyWaitlisted ? '#f0fdf4' : '#ffffff',
                  display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                      Authorize Reserved Slot &amp; Approve
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px' }}>
                      Candidate Reservation
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.45 }}>
                    Allocates an internal reserved slot specifically for <strong>{slotWarningModalState.candidateName}</strong> and immediately approves them for a Job Offer. The public job vacancy remains closed/reserved so no outside applicants can apply.
                  </p>
                  <div style={{ marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={async () => {
                        const appId = slotWarningModalState.applicationId;
                        setSlotWarningModalState(prev => ({ ...prev, isOpen: false }));
                        await executeUpdateResult(appId, 'President Approved', '', { increase_slot: true });
                      }}
                      style={{
                        background: '#059669', color: '#ffffff', border: 'none',
                        borderRadius: '6px', padding: '8px 14px', cursor: 'pointer',
                        fontWeight: '600', fontSize: '12.5px', display: 'inline-flex',
                        alignItems: 'center', gap: '5px'
                      }}
                    >
                      <i className="bx bx-check-shield" style={{ fontSize: '14px' }} />
                      Authorize &amp; Approve Candidate
                    </button>
                  </div>
                </div>
              </div>

              {/* Close / Cancel */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSlotWarningModalState(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
                    padding: '7px 16px', borderRadius: '6px', cursor: 'pointer',
                    fontWeight: '600', fontSize: '12.5px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Approval Slot Capacity Error Modal ── */}
      {batchSlotErrorModalState.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              background: '#ffffff'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                flexShrink: 0
              }}>
                <i className="bx bx-error-circle" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.2px' }}>
                  Cannot Batch Approve: Slot Capacity Exceeded
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                  Batch approval is paused because selected candidate count exceeds available job openings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBatchSlotErrorModalState({ isOpen: false, conflicts: [] })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '22px',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
              >
                <i className="bx bx-x" />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '20px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Context Notice */}
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#991b1b',
                lineHeight: 1.5,
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}>
                <i className="bx bx-shield-x" style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }} />
                <div>
                  <strong>System Quota Enforcement:</strong> The hiring policy prevents approving more candidates than authorized openings. You cannot approve them all at once since available slots are limited.
                </div>
              </div>

              {/* Conflicting Positions Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {batchSlotErrorModalState.conflicts.map((conf, idx) => {
                  const excessCount = conf.candidates.length - conf.availableSlots;
                  return (
                    <div
                      key={conf.jobId || idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Position Title & Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                            {conf.jobTitle}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#2563eb',
                            background: '#eff6ff',
                            border: '1px solid #dbeafe',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {conf.availableSlots} Open Slot{conf.availableSlots === 1 ? '' : 's'}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#d97706',
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {conf.candidates.length} Selected
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#dc2626',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            +{excessCount} Exceeded
                          </span>
                        </div>
                      </div>

                      {/* Selected candidates list for this job */}
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Selected Candidate(s) for this position:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {conf.candidates.map((cand, cIdx) => {
                            const name = cand.candidate_name || `${cand.User_Fname || ''} ${cand.User_Lname || ''}`.trim() || `Candidate #${cIdx + 1}`;
                            return (
                              <span
                                key={cIdx}
                                style={{
                                  fontSize: '12px',
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  padding: '3px 9px',
                                  color: '#334155',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <i className="bx bx-user" style={{ fontSize: '12px', color: '#94a3b8' }} />
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Guidance recommendation */}
                      <div style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #3b82f6', lineHeight: 1.45 }}>
                        {conf.availableSlots > 0 ? (
                          <span>
                            Please select at most <strong>{conf.availableSlots}</strong> candidate(s) for this position, or approve candidates individually to place excess candidates on the priority waitlist.
                          </span>
                        ) : (
                          <span>
                            All openings are currently filled for this position. Individual approval allows placing them on the priority waitlist or authorizing an additional slot.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{
              padding: '16px 22px',
              borderTop: '1px solid #f1f5f9',
              background: '#fafafa',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedApprovalIds([]);
                  setBatchSlotErrorModalState({ isOpen: false, conflicts: [] });
                }}
                style={{
                  background: '#ffffff',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  padding: '8px 16px',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '12.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
              >
                <i className="bx bx-trash" style={{ fontSize: '14px' }} />
                Clear Selection
              </button>

              <button
                type="button"
                onClick={() => setBatchSlotErrorModalState({ isOpen: false, conflicts: [] })}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '12.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#1e293b'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#0f172a'; }}
              >
                <i className="bx bx-check-square" style={{ fontSize: '14px' }} />
                Adjust Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Contract Signing Side Drawer (Onboarding Tab) ── */}
      {onboardingDrawerCandidate && (
        <OnboardingDrawer
          candidate={onboardingDrawerCandidate}
          allCandidates={interviews}
          onClose={() => setOnboardingDrawerCandidate(null)}
          onWithdrawContract={async (appId) => {
            await executeUpdateResult(appId, 'Contract Signing No Show');
            setOnboardingDrawerCandidate(null);
          }}
          onSignContract={async (appId) => {
            await executeUpdateResult(appId, 'Requirement Pending');
            setOnboardingDrawerCandidate(null);
          }}
          onScheduleContract={async (appId, scheduleData) => {
            if (scheduleData?.time) {
              const match = scheduleData.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
              if (match) {
                let h = parseInt(match[1], 10);
                const m = parseInt(match[2], 10);
                const ampm = (match[3] || '').toUpperCase();
                if (ampm === 'PM' && h < 12) h += 12;
                if (ampm === 'AM' && h === 12) h = 0;
                const totalM = h * 60 + m;
                if (totalM < 480 || totalM >= 1020) {
                  showToast('Contract signing must be scheduled between 8:00 AM and before 5:00 PM (office closes at 5:00 PM).', 'warning');
                  return { success: false, message: 'Contract signing must be scheduled between 8:00 AM and before 5:00 PM.' };
                }
              }
            }
            setLoadingScreenState({
              isOpen: true,
              title: 'Scheduling Contract',
              subtitle: 'Validating schedule slot and sending signing details...'
            });
            try {
              const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
              const res = await fetch(`${API_BASE_URL}/super_admin/interviews/schedule_contract_signing.php`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
                },
                body: JSON.stringify({
                  application_id: appId,
                  scheduled_date: scheduleData.date,
                  scheduled_time: scheduleData.time,
                  location: scheduleData.location,
                  notes: scheduleData.notes,
                  actor_id: user?.id || 0,
                  actor_name: superAdminName
                })
              });
              const data = await res.json();
              if (data.status === 'success') {
                const candName = data.candidate_name || onboardingDrawerCandidate?.candidate_name || onboardingDrawerCandidate?.name || 'Candidate';
                showSaveToast(data.message || `Contract Signing Scheduled. ${candName}.`, 'success');
                setOnboardingDrawerCandidate(null);
                await fetchInterviews(true);
                return { success: true };
              } else {
                showToast(data.message || 'Failed to schedule contract signing.', 'danger');
                return { success: false, message: data.message, conflict: data };
              }
            } catch (err) {
              console.error(err);
              showToast('Connection error while scheduling contract signing.', 'danger');
              return { success: false, message: 'Connection error while scheduling contract signing.' };
            } finally {
              setLoadingScreenState(prev => ({ ...prev, isOpen: false }));
            }
          }}
        />
      )}

      {/* ── Pre-Employment Requirements Side Drawer (Evaluated Tab) ── */}
      {requirementsDrawerCandidate && (
        <PreEmploymentDrawer
          candidate={requirementsDrawerCandidate}
          onClose={() => setRequirementsDrawerCandidate(null)}
          onScheduleUpdated={async () => {
            await fetchInterviews(true);
          }}
          onCompleteRequirements={async (appId, targetStatus, candName, candJob, scheduleData) => {
            setRequirementsDrawerCandidate(null);
            handleUpdateResult(
              appId,
              targetStatus || 'Completed Requirements',
              candName || requirementsDrawerCandidate.candidate_name || 'Candidate',
              candJob || requirementsDrawerCandidate.job_title || '',
              scheduleData || {}
            );
          }}
        />
      )}




      {/* ── Job Offer Decline Reason Modal ── */}
      {declinedReasonCandidate && (() => {
        let offerDetails = {};
        try {
          offerDetails = typeof declinedReasonCandidate.job_offer_details === 'string'
            ? JSON.parse(declinedReasonCandidate.job_offer_details)
            : (declinedReasonCandidate.job_offer_details || {});
        } catch (e) {}

        const declineReason = offerDetails.decline_reason || 'No specific reason provided by the candidate.';
        const respondedAt = offerDetails.responded_at || declinedReasonCandidate.updated_at;
        const candidateName = (declinedReasonCandidate.candidate_name || '').trim() || `${declinedReasonCandidate.User_Fname || ''} ${declinedReasonCandidate.User_Lname || ''}`.trim() || 'Candidate';
        const jobTitle = declinedReasonCandidate.job_title || 'Position';
        const basicSalary = offerDetails.basic_salary ? `₱${Number(offerDetails.basic_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : null;

        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}>
            <div style={{
              background: '#ffffff', borderRadius: '16px', maxWidth: '500px', width: '100%',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)', overflow: 'hidden',
              border: '1px solid #e2e8f0', animation: 'fadeIn 0.2s ease-out'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '18px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: '#fef2f2', color: '#b91c1c', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                  }}>
                    <i className="bx bx-x-circle" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      Job Offer Decline Details
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      Candidate's response to the official job offer
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeclinedReasonCandidate(null)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', fontSize: '22px', display: 'flex', alignItems: 'center', padding: '4px'
                  }}
                >
                  <i className="bx bx-x" />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Candidate Info Card */}
                <div style={{
                  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                  padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{candidateName}</div>
                    <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>{jobTitle}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
                      borderRadius: '12px', padding: '3px 10px', fontSize: '11px', fontWeight: '700'
                    }}>
                      <i className="bx bx-x" /> Declined
                    </span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      {respondedAt ? new Date(respondedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                </div>

                {/* Decline Reason Box */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                    Reason for Declining
                  </label>
                  <div style={{
                    background: '#fff1f2', border: '1.5px solid #ffe4e6', borderRadius: '10px',
                    padding: '14px 16px', color: '#9f1239', fontSize: '13.5px', lineHeight: 1.5,
                    fontWeight: '500'
                  }}>
                    <i className="bx bx-message-alt-x" style={{ fontSize: '16px', marginRight: '6px', verticalAlign: '-2px' }} />
                    {declineReason}
                  </div>
                </div>

                {/* Offer terms summary if available */}
                {basicSalary && (
                  <div style={{
                    background: '#f1f5f9', borderRadius: '8px', padding: '10px 14px',
                    fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between'
                  }}>
                    <span>Offered Basic Salary:</span>
                    <strong style={{ color: '#0f172a' }}>{basicSalary}</strong>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
                display: 'flex', justifyContent: 'flex-end', gap: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setDeclinedReasonCandidate(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                    background: '#ffffff', color: '#475569', fontWeight: '600', fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cand = declinedReasonCandidate;
                    setDeclinedReasonCandidate(null);
                    handleUpdateResult(cand.application_id, 'Offer Rejected', candidateName, jobTitle);
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: '#ef4444', color: '#ffffff', fontWeight: '700', fontSize: '12.5px',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)'
                  }}
                >
                  <i className="bx bx-user-x" /> Offer Rejected
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Official Job Offer Letter Modal ── */}
      <JobOfferModal
        isOpen={Boolean(jobOfferModalCandidate)}
        onClose={() => setJobOfferModalCandidate(null)}
        candidate={jobOfferModalCandidate}
        user={user}
        showToast={showSaveToast}
        onSuccess={() => {
          setJobOfferModalCandidate(null);
          setEvalTab('job_offer');
          fetchInterviews(true);
        }}
      />

      {/* ── Super Admin 2FA Security Modal ── */}
      <SuperAdminMfaModal
        isOpen={showMfaModal}
        onClose={() => setShowMfaModal(false)}
        user={user}
        showToast={showToast}
      />

      {/* ── Global Video Loading Modal ── */}
      <LoadingScreen
        isOpen={loadingScreenState.isOpen}
        title={loadingScreenState.title}
        subtitle={loadingScreenState.subtitle}
      />

      {/* ── Global Toast Notifications ── */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

    </div>
  );
};

export default SuperAdminDashboard;
