import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import MasterListTab from '../AdminDashboard/components/tabs/MasterListTab';
import JobsTab from '../AdminDashboard/components/tabs/JobsTab';
import SuperAdminAuditTab from './components/SuperAdminAuditTab';
import OnboardingDrawer from './components/OnboardingDrawer';
import logoImg from '../../assets/images/Logo Airship Express.png';
import useInactivityTimeout from '../../hooks/useInactivityTimeout';
import '../AdminDashboard/AdminDashboard.css';

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

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('admins');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', type: 'danger', onConfirm: null });
  const [modalError, setModalError] = useState('');

  // Save success / feedback toast
  const [saveToast, setSaveToast] = useState(null); // { message, type: 'success' | 'danger' }
  const toastTimerRef = useRef(null);

  const showSaveToast = (msg, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setSaveToast({ message: typeof msg === 'string' ? msg : 'Saved successfully', type });
    toastTimerRef.current = setTimeout(() => {
      setSaveToast(null);
    }, 3200);
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
        const res = await fetch('http://localhost/Hiring%20System/backend/auth/check_session.php', {
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

  // Schedule View Toggle: 'list' | 'calendar'
  const [scheduleView, setScheduleView] = useState('list');
  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calSelectedDay, setCalSelectedDay] = useState(null); // date string 'YYYY-MM-DD'

  // Candidate Evaluation states: 'pending' | 'final_approval' | 'evaluated'
  const [evalTab, setEvalTab] = useState('pending');
  const [evalSearch, setEvalSearch] = useState('');
  const [evalPage, setEvalPage] = useState(1);
  const [updateStatusTarget, setUpdateStatusTarget] = useState(null); // { id, name, job, status }
  const [selectedPostHireStatus, setSelectedPostHireStatus] = useState('Candidate Withdrew');

  // Contract Signing Schedule States
  const [contractModalCandidate, setContractModalCandidate] = useState(null); // { id, name, job, email, date, time, location, notes }
  const [contractDate, setContractDate] = useState('');
  const [contractTime, setContractTime] = useState('');
  const [contractLocation, setContractLocation] = useState('');
  const [contractNotes, setContractNotes] = useState('');
  const [contractSubmitting, setContractSubmitting] = useState(false);

  // Onboarding Side Drawer state
  const [onboardingDrawerCandidate, setOnboardingDrawerCandidate] = useState(null);

  // Candidate Credentials states
  const [resumeSearch, setResumeSearch] = useState('');
  const [resumePage, setResumePage] = useState(1);

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
    try {
      const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/admins/get_admins.php');
      const data = await res.json();
      if (data.status === 'success') setAdmins(data.admins);
    } catch (e) { console.error(e); }
    if (!silent) setLoading(false);
  };

  const fetchSlots = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/slots/get_slots.php');
      const data = await res.json();
      if (data.status === 'success') setSlots(data.slots);
    } catch (e) { console.error(e); }
    if (!silent) setLoading(false);
  };

  const fetchInterviews = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/interviews/get_scheduled.php');
      const data = await res.json();
      if (data.status === 'success') setInterviews(data.scheduled);
    } catch (e) { console.error(e); }
    if (!silent) setLoading(false);
  };

  const fetchResumes = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/applicants/get_screened_applicants.php');
      const data = await res.json();
      if (data.status === 'success') setResumes(data.applicants);
    } catch (e) { console.error(e); }
    if (!silent) setLoading(false);
  };

  // ── Fetch slot count for selected date (for modal warning) ────────────────
  const fetchSlotDayCount = useCallback(async (date) => {
    if (!date) { setSlotDayCount(null); return; }
    try {
      const res = await fetch(`http://localhost/Hiring%20System/backend/super_admin/slots/get_slot_count.php?date=${date}`);
      const data = await res.json();
      if (data.status === 'success') setSlotDayCount({ count: data.count, remaining: data.remaining });
    } catch { setSlotDayCount(null); }
  }, []);

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/admins/add_admin.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    } catch (e) { console.error(e); setModalError('Connection error.'); }
  };

  // ── Update Admin Profile (name/email only) ───────────────────────────────────
  const confirmUpdateAdminSubmit = (e) => {
    e.preventDefault();
    setModalError('');
    if (!editAdmin.first_name || !editAdmin.last_name || !editAdmin.email) {
      setModalError('First Name, Last Name, and Email Address are required.');
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
      const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/admins/update_admin.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        try {
          const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/admins/update_admin.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        } catch (e) { console.error(e); setModalError('Connection error.'); }
      }
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
          const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/admins/deactivate_admin.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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
  };

  const handleNumSlotsChange = (numSlotsVal) => {
    const count = Math.max(1, parseInt(numSlotsVal, 10) || 1);
    const updatedEnd = calculateEndTime(newSlot.start_time, count);
    setNewSlot(prev => ({ ...prev, num_slots: count, end_time: updatedEnd }));
    setSlotError('');
  };

  const handleAddSlot = async (e) => {
    e.preventDefault();
    setSlotError('');
    if (!newSlot.date) {
      setSlotError('Please select an interview date.');
      return;
    }
    const slotsCount = Math.max(1, parseInt(newSlot.num_slots, 10) || 1);
    if (!newSlot.start_time) {
      setSlotError('Please select a start time.');
      return;
    }
    const [startH, startM] = newSlot.start_time.split(':').map(Number);
    const requiredMinutes = slotsCount * 30;
    if (startH * 60 + startM + requiredMinutes > 24 * 60) {
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
      const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/slots/add_slot.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
          await fetch('http://localhost/Hiring%20System/backend/super_admin/slots/delete_slot.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slot_id, actor_id: user?.id, actor_name: superAdminName }),
          });
          fetchSlots();
          setCalSelectedDay(null);
        } catch (e) { console.error(e); }
      },
    });
  };

  const handleUpdateResult = (application_id, result, candidateName, candidateJob = '') => {
    let modalTitle = 'Confirm Evaluation Decision';
    let modalMsg = `Are you sure you want to update the evaluation decision for "${candidateName}"?`;
    let confirmBtnText = 'Confirm Decision';
    let confirmBtnType = 'primary';

    if (result === 'Passed Final Interview' || result === 'PASS_FINAL_INTERVIEW') {
      modalTitle = 'Pass Final Interview';
      modalMsg = `Mark "${candidateName}" as Passed in Final Interview and forward to Executive Approval?`;
      confirmBtnText = 'Pass Interview';
      confirmBtnType = 'primary';
    } else if (result === 'Failed Final Interview' || result === 'FAIL_FINAL_INTERVIEW' || result === 'INTERVIEW_FAILED' || result === 'rejected') {
      modalTitle = 'Fail Final Interview';
      modalMsg = `Mark "${candidateName}" as Failed in Final Interview?`;
      confirmBtnText = 'Fail Interview';
      confirmBtnType = 'danger';
    } else if (result === 'Passed Final Approval' || result === 'PASS_FINAL_APPROVAL' || result === 'HIRED') {
      modalTitle = 'Approve & Hire Candidate';
      modalMsg = `Approve and hire "${candidateName}" for "${candidateJob}"?`;
      confirmBtnText = 'Approve & Hire';
      confirmBtnType = 'primary';
    } else if (result === 'Failed Final Approval' || result === 'FAIL_FINAL_APPROVAL') {
      modalTitle = 'Executive Rejection';
      modalMsg = `Reject "${candidateName}" at Executive Final Approval?`;
      confirmBtnText = 'Reject Candidate';
      confirmBtnType = 'danger';
    } else if (result === 'Candidate Withdrew' || result === 'CANDIDATE_WITHDREW') {
      modalTitle = 'Candidate Withdrawal';
      modalMsg = `Record voluntary withdrawal for "${candidateName}"?`;
      confirmBtnText = 'Record Withdrawal';
      confirmBtnType = 'secondary';
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
    } else if (result === 'Contract Signed & Onboarded' || result === 'CONTRACT_SIGNED') {
      modalTitle = 'Complete Onboarding';
      modalMsg = `Confirm employment contract signed and complete onboarding for "${candidateName}"?`;
      confirmBtnText = 'Confirm Onboarded';
      confirmBtnType = 'primary';
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
        try {
          const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
          const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/interviews/update_result.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_id, result, actor_id: user?.id, actor_name: superAdminName }),
          });
          const data = await res.json();
          if (data.status === 'success') {
            await fetchInterviews(true);
            const isPositive = ['Passed Final Interview', 'Passed Final Approval', 'HIRED', 'Requirements Verified', 'Contract Signed & Onboarded', 'UNDO'].includes(result);
            showSaveToast(data.message || 'Candidate evaluation updated successfully.', isPositive ? 'success' : 'danger');
          } else {
            alert(data.message || 'Failed to update candidate status.');
          }
        } catch (e) {
          console.error(e);
          alert('Connection error while updating evaluation.');
        }
      },
    });
  };

  const handleScheduleContractSigning = async (e) => {
    if (e) e.preventDefault();
    if (!contractModalCandidate || !contractDate || !contractTime) {
      alert('Please specify both scheduled date and time.');
      return;
    }
    setContractSubmitting(true);
    try {
      const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
      const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/interviews/schedule_contract_signing.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        showSaveToast('Contract signing schedule sent successfully!', 'success');
        setContractModalCandidate(null);
        await fetchInterviews(true);
      } else {
        alert(data.message || 'Failed to schedule contract signing.');
      }
    } catch (err) {
      console.error(err);
      alert('Connection error while scheduling contract signing.');
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

  // ── Sidebar nav order ─────────────────────────────────────────────────────
  const SIDEBAR_ITEMS = [
    { key: 'admins', label: 'Administrative Access', icon: 'bx-user-check' },
    { key: 'jobs', label: 'Job Postings', icon: 'bx-briefcase' },
    { key: 'resumes', label: 'Candidate Credentials', icon: 'bx-file-find' },
    { key: 'slots', label: 'Interview Schedule', icon: 'bx-calendar-plus' },
    { key: 'results', label: 'Candidate Evaluation', icon: 'bx-trophy' },
    { key: 'master_list', label: 'Application Audit Records', icon: 'bx-file' },
    { key: 'audit', label: 'System Audit Trail', icon: 'bx-shield-quarter' },
  ];

  if (!user) return <div className="loading-container"><div className="spinner"></div></div>;

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
            </div>
          </div>

          {/* Day Names Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: '8px' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '800', color: '#64748b', letterSpacing: '0.8px', padding: '6px 0', textTransform: 'uppercase', background: '#f8fafc', borderRadius: '6px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Expanded Grid Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', flex: 1 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} style={{ background: '#f8fafc', borderRadius: '12px', opacity: 0.4 }} />;
              const dateStr = padDate(calYear, calMonth, day);
              const daySlots = slotsByDate[dateStr] || [];
              const hasSlots = daySlots.length > 0;
              const openCount = daySlots.filter(s => s.status === 'Open').length;
              const bookedCount = daySlots.length - openCount;
              const isToday = dateStr === today.toISOString().split('T')[0];
              const isSelected = dateStr === calSelectedDay;

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

      {/* ── Save / Action Feedback Toast ── */}
      {saveToast && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: saveToast.type === 'danger' ? '#450a0a' : '#052e16',
            color: saveToast.type === 'danger' ? '#fca5a5' : '#86efac',
            border: saveToast.type === 'danger' ? '1.5px solid #991b1b' : '1.5px solid #166534',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '13.5px',
            fontWeight: '700',
            fontFamily: "'Inter', sans-serif",
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
            pointerEvents: 'none'
          }}
        >
          <i className={`bx ${saveToast.type === 'danger' ? 'bx-x-circle' : 'bx-check-circle'}`} style={{ fontSize: '20px' }}></i>
          <span>{saveToast.message}</span>
        </div>,
        document.body
      )}

      {/* ── Sidebar ── */}
      <aside className="admin-sidebar" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="admin-sidebar-header" style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <img src={logoImg} alt="Airship Logo" style={{ height: '24px', width: 'auto', objectFit: 'contain' }} />
              <span className="admin-brand-name" style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '1px' }}>AIRSHIP EXPRESS</span>
            </div>
            <h2 className="admin-sidebar-title" style={{ margin: 0 }}>Super Admin</h2>
            <span style={{ fontSize: '11px', color: '#475569', fontWeight: '500' }}>Hiring Platform Control</span>
          </div>

          <ul className="admin-sidebar-menu">
            {SIDEBAR_ITEMS.map(item => (
              <li key={item.key}>
                <span
                  className={`admin-menu-item ${activeTab === item.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                  style={{ cursor: 'pointer' }}
                >
                  <i className={`bx ${item.icon}`} style={{ fontSize: '17px', flexShrink: 0 }}></i>
                  <span className="admin-menu-text">{item.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px', marginTop: 'auto' }}>
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

          <span className="admin-menu-item logout-item" onClick={handleLogout} style={{ cursor: 'pointer' }}>
            <i className="bx bx-log-out" style={{ fontSize: '17px', flexShrink: 0 }}></i>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
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
                  Inactive Admins
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
                  <div className="admin-loading">Loading admin accounts...</div>
                ) : displayedAdmins.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 24px', background: '#ffffff', borderRadius: '12px' }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: adminStatusTab === 'active' ? 'rgba(230,0,126,0.08)' : '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px', color: adminStatusTab === 'active' ? '#e6007e' : '#64748b' }}>
                      <i className={`bx ${adminStatusTab === 'active' ? 'bx-user-x' : 'bx-archive'}`} style={{ fontSize: '26px' }}></i>
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15.5px', fontWeight: '700', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>
                      {adminStatusTab === 'active' ? 'No Active Admin Accounts' : 'No Inactive Admin Accounts'}
                    </h4>
                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
                      {adminStatusTab === 'active'
                        ? 'Get started by creating authorized admin accounts to oversee recruitment and scheduling.'
                        : 'Deactivated or resigned administrator accounts will appear here with locked historical records.'}
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
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Inactive
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
                                  <span
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                                      background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0',
                                      padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '600',
                                      cursor: 'not-allowed'
                                    }}
                                    title="Action locked: Inactive account data is locked to preserve historical audit trail."
                                  >
                                    <i className="bx bx-lock-alt" style={{ fontSize: '13px' }}></i> Locked
                                  </span>
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
        {activeTab === 'jobs' && <JobsTab />}

        {/* ── Candidate Credentials Tab ── */}
        {activeTab === 'resumes' && (() => {
          const filteredResumes = resumes.filter(r => {
            if (!resumeSearch.trim()) return true;
            const q = resumeSearch.toLowerCase().trim();
            const name = (r.candidate_name || `${r.User_Fname || ''} ${r.User_Lname || ''}`).toLowerCase();
            const title = (r.job_title || '').toLowerCase();
            const email = (r.candidate_email || r.User_Email || '').toLowerCase();
            return name.includes(q) || title.includes(q) || email.includes(q);
          });

          const RESUME_PAGE_SIZE = 10;
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
                <div style={{ position: 'relative', minWidth: '300px', maxWidth: '420px', flex: '1 1 300px' }}>
                  <i className="bx bx-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: '#94a3b8' }}></i>
                  <input
                    type="text"
                    value={resumeSearch}
                    onChange={(e) => { setResumeSearch(e.target.value); setResumePage(1); }}
                    placeholder="Search candidate name, email, or position..."
                    style={{
                      width: '100%',
                      padding: '10px 36px 10px 40px',
                      borderRadius: '10px',
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
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '15px'
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
                  <div className="admin-loading">Loading screened applicants...</div>
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
                          <th style={{ padding: '14px 18px', textAlign: 'left', width: '38%' }}>Candidate</th>
                          <th style={{ padding: '14px 18px', textAlign: 'left', width: '30%' }}>Position Applied</th>
                          <th style={{ padding: '14px 18px', textAlign: 'center', width: '18%' }}>AI Match Score</th>
                          <th style={{ padding: '14px 18px', textAlign: 'center', width: '14%' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedResumes.map(r => {
                          const name = r.candidate_name || `${r.User_Fname || ''} ${r.User_Lname || ''}`.trim() || 'Candidate';
                          const email = r.candidate_email || r.User_Email || '';
                          const score = r.ai_match_score !== null && r.ai_match_score !== undefined ? Number(r.ai_match_score) : null;

                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              {/* Candidate Column: Avatar + Name + Email underneath */}
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
                                    {email && (
                                      <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginTop: '2px' }}>
                                        {email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Position Applied */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle' }}>
                                <strong style={{ color: '#0f172a', fontSize: '13px' }}>{r.job_title}</strong>
                              </td>

                              {/* AI Match Score Badge */}
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

                              {/* Action Button */}
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
                    {filteredResumes.length > RESUME_PAGE_SIZE && (
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
          const name = selectedResume.candidate_name || `${selectedResume.User_Fname || ''} ${selectedResume.User_Lname || ''}`.trim();
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
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '7px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#475569',
                        transition: 'all 0.15s ease'
                      }}
                      title={drawerExpanded ? "Collapse Drawer" : "Maximize / Expand Drawer"}
                    >
                      {drawerExpanded ? <i className='bx bx-collapse-alt' style={{ fontSize: '18px' }}></i> : <i className='bx bx-expand-alt' style={{ fontSize: '18px' }}></i>}
                    </button>
                    <button className="admin-drawer-close" onClick={() => { setSelectedResume(null); setDrawerExpanded(false); setDrawerShowRequirements(false); }} aria-label="Close" style={{ position: 'static' }}>
                      <i className='bx bx-x' style={{ fontSize: '22px', lineHeight: 1 }}></i>
                    </button>
                  </div>
                  <div className="admin-drawer-avatar"><i className='bx bx-user' style={{ fontSize: '44px' }}></i></div>
                  <div className="admin-drawer-profile-text">
                    <span className="admin-drawer-name">{aiData?.applicant_info?.name || name}</span>
                    <span className="admin-drawer-role">{selectedResume.job_title}</span>
                  </div>
                </div>
                <div className="admin-drawer-body">
                  <div className="admin-drawer-contact-list">
                    <div className="admin-contact-item"><i className='bx bx-envelope admin-contact-icon'></i><span>{selectedResume.candidate_email || selectedResume.User_Email}</span></div>
                    <div className="admin-contact-item"><i className='bx bx-phone admin-contact-icon'></i><span>{selectedResume.User_Mobile || 'Not provided'}</span></div>
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
                  <div>
                    <h4 className="admin-drawer-section-title">Documents</h4>
                    <div className="admin-drawer-doc-list">
                      <button className="admin-drawer-doc-btn" onClick={() => window.open(`http://localhost/Hiring%20System/backend/applications/download_resume.php?id=${selectedResume.id}`, '_blank')}>
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
                  <div className="admin-loading">Loading available slots...</div>
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
                        <th>Booked / Scheduled Applicant</th>
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
          const isPendingStatus = (s) => ['CONFIRMED', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'RESCHEDULING'].includes((s || '').toUpperCase());
          const isFinalApprovalStatus = (s) => ['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes((s || '').toUpperCase());
          const isOnboardingStatus = (s) => ['PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'PASSED', 'REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes((s || '').toUpperCase());
          const isEvaluatedStatus = (s) => ['CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'INTERVIEW_FAILED', 'REJECTED', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes((s || '').toUpperCase());

          const pendingCandidates = interviews.filter(i => isPendingStatus(i.status));
          const finalApprovalCandidates = interviews.filter(i => isFinalApprovalStatus(i.status));
          const onboardingCandidates = interviews.filter(i => isOnboardingStatus(i.status));
          const evaluatedCandidates = interviews.filter(i => isEvaluatedStatus(i.status));

          let activeList = pendingCandidates;
          if (evalTab === 'final_approval') activeList = finalApprovalCandidates;
          else if (evalTab === 'onboarding') activeList = onboardingCandidates;
          else if (evalTab === 'evaluated') activeList = evaluatedCandidates;

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
                  <h1 className="admin-header-title">Candidate Evaluation &amp; Executive Pipeline</h1>
                  <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
                    Manage the 4-stage evaluation pipeline: F2F interview evaluation, President approval, physical requirements verification &amp; contract signing, and historical archives.
                  </p>
                </div>
              </div>

              {/* 4 Status Filter Tabs & Search Top Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
                {/* 4 Tabs: [ Pending Final Interview ] | [ Final Approval ] | [ Onboarding & Requirements ] | [ Evaluated ] */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Tab 1: Pending Final Interview */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('pending'); setEvalPage(1); }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: evalTab === 'pending' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'pending' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'pending' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: evalTab === 'pending' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                    Pending Final Interview
                    <span style={{
                      background: evalTab === 'pending' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'pending' ? '#ffffff' : '#475569',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11.5px',
                      fontWeight: '800'
                    }}>
                      {pendingCandidates.length}
                    </span>
                  </button>

                  {/* Tab 2: Final Approval */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('final_approval'); setEvalPage(1); }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: evalTab === 'final_approval' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'final_approval' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'final_approval' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: evalTab === 'final_approval' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Final Approval
                    <span style={{
                      background: evalTab === 'final_approval' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'final_approval' ? '#ffffff' : '#475569',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11.5px',
                      fontWeight: '800'
                    }}>
                      {finalApprovalCandidates.length}
                    </span>
                  </button>

                  {/* Tab 3: Onboarding & Requirements */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('onboarding'); setEvalPage(1); }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: evalTab === 'onboarding' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'onboarding' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'onboarding' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: evalTab === 'onboarding' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e6007e', display: 'inline-block' }} />
                    Onboarding
                    <span style={{
                      background: evalTab === 'onboarding' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'onboarding' ? '#ffffff' : '#475569',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11.5px',
                      fontWeight: '800'
                    }}>
                      {onboardingCandidates.length}
                    </span>
                  </button>

                  {/* Tab 4: Evaluated (Master History) */}
                  <button
                    type="button"
                    onClick={() => { setEvalTab('evaluated'); setEvalPage(1); }}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: evalTab === 'evaluated' ? '1.5px solid #0f172a' : '1.5px solid #e2e8f0',
                      background: evalTab === 'evaluated' ? '#0f172a' : '#ffffff',
                      color: evalTab === 'evaluated' ? '#ffffff' : '#64748b',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: evalTab === 'evaluated' ? '0 4px 12px rgba(15,23,42,0.12)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />
                    Evaluated
                    <span style={{
                      background: evalTab === 'evaluated' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
                      color: evalTab === 'evaluated' ? '#ffffff' : '#475569',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11.5px',
                      fontWeight: '800'
                    }}>
                      {evaluatedCandidates.length}
                    </span>
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', minWidth: '280px', maxWidth: '380px', flex: 1 }}>
                  <i className="bx bx-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '17px', color: '#94a3b8' }}></i>
                  <input
                    type="text"
                    value={evalSearch}
                    onChange={(e) => { setEvalSearch(e.target.value); setEvalPage(1); }}
                    placeholder="Search candidate, email, or position..."
                    style={{
                      width: '100%',
                      padding: '9px 36px 9px 36px',
                      borderRadius: '8px',
                      border: '1.5px solid #e2e8f0',
                      fontSize: '13px',
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {evalSearch && (
                    <button
                      type="button"
                      onClick={() => { setEvalSearch(''); setEvalPage(1); }}
                      style={{
                        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '15px'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-table-card">
                {loading ? (
                  <div className="admin-loading">Loading candidate pipeline...</div>
                ) : paginatedList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '56px 24px', background: '#ffffff', borderRadius: '12px' }}>
                    <div style={{
                      width: '54px', height: '54px', borderRadius: '50%',
                      background: evalTab === 'pending' ? '#fef3c7' : (evalTab === 'final_approval' ? '#ecfdf5' : (evalTab === 'onboarding' ? '#e0f2fe' : '#f1f5f9')),
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
                      color: evalTab === 'pending' ? '#d97706' : (evalTab === 'final_approval' ? '#059669' : (evalTab === 'onboarding' ? '#0284c7' : '#64748b'))
                    }}>
                      <i className={`bx ${evalTab === 'pending' ? 'bx-time' : (evalTab === 'final_approval' ? 'bx-user-check' : (evalTab === 'onboarding' ? 'bx-file' : 'bx-archive'))}`} style={{ fontSize: '26px' }}></i>
                    </div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15.5px', fontWeight: '700', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>
                      {evalSearch ? 'No Candidates Match Your Search' : (
                        evalTab === 'pending'
                          ? 'No Pending Candidates Awaiting F2F Evaluation'
                          : (evalTab === 'final_approval'
                            ? 'No Candidates Currently Awaiting Final Approval'
                            : (evalTab === 'onboarding'
                              ? 'No Active Hired Candidates in Onboarding'
                              : 'No Evaluated Master Records Yet'))
                      )}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.5' }}>
                      {evalSearch
                        ? `No records found matching "${evalSearch}". Try clearing the search filter.`
                        : (evalTab === 'pending'
                          ? 'Candidates scheduled for final interview will appear here for evaluation.'
                          : (evalTab === 'final_approval'
                            ? 'Candidates who passed the final interview will queue here for executive decision.'
                            : (evalTab === 'onboarding'
                              ? 'Hired candidates awaiting physical document verification and contract signing will appear here.'
                              : 'Candidates evaluated, onboarded, or finalized will be preserved here.')))}
                    </p>
                  </div>
                ) : (
                  <>
                    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                          <th style={{ padding: '14px 18px', textAlign: 'left' }}>Candidate</th>
                          <th style={{ padding: '14px 18px', textAlign: 'left' }}>Position</th>
                          <th style={{ padding: '14px 18px', textAlign: 'center' }}>
                            {evalTab === 'evaluated'
                              ? 'Decision Date'
                              : (evalTab === 'onboarding'
                                ? 'Requirement Status'
                                : 'Interview Schedule')}
                          </th>
                          {evalTab === 'onboarding' && (
                            <th style={{ padding: '14px 18px', textAlign: 'center' }}>Submission Deadline</th>
                          )}
                          <th style={{ padding: '14px 18px', textAlign: 'center' }}>
                            {evalTab === 'evaluated'
                              ? 'Final Status'
                              : (evalTab === 'onboarding' ? 'Onboarding Actions' : 'Actions')}
                          </th>
                          {evalTab === 'onboarding' && (
                            <th style={{ padding: '14px 18px', textAlign: 'center' }}>Action</th>
                          )}
                        </tr>
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
                          const isWithdrawn = ['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW'].includes(normStatus);
                          const isIncompleteReq = ['INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS'].includes(normStatus);
                          const isFailedPreEmp = ['FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes(normStatus);

                          // Computed 7-day deadline from applied/updated date
                          const refDate = i.updated_at || i.applied_at || new Date().toISOString();
                          const deadlineObj = new Date(new Date(refDate).getTime() + 7 * 24 * 60 * 60 * 1000);
                          const deadlineStr = deadlineObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                          return (
                            <tr key={i.application_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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

                              {/* Column 3: Tab-dependent (Requirement Status / Schedule / Decision Date) */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
                                {evalTab === 'onboarding' ? (
                                  <div>
                                    {isContractScheduled ? (
                                      <div style={{ fontWeight: '700', color: '#e6007e', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <i className="bx bx-calendar-check" style={{ fontSize: '15px' }} />
                                        Contract Signing Scheduled
                                      </div>
                                    ) : isReqVerified ? (
                                      <div style={{ fontWeight: '700', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <i className="bx bx-check-double" style={{ fontSize: '16px' }} />
                                        Complete Requirements
                                      </div>
                                    ) : (
                                      <div style={{ fontWeight: '700', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                        <i className="bx bx-time" style={{ fontSize: '15px' }} />
                                        Awaiting Requirements
                                      </div>
                                    )}
                                  </div>
                                ) : evalTab === 'evaluated' ? (
                                  <div>
                                    <div style={{ fontWeight: '600', color: '#0f172a' }}>
                                      {i.updated_at ? new Date(i.updated_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : (i.applied_at ? new Date(i.applied_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—')}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{dateStr}</div>
                                    {timeStr && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{timeStr}</div>}
                                  </div>
                                )}
                              </td>

                              {/* Column 4: Submission Deadline (Only rendered when in onboarding tab) */}
                              {evalTab === 'onboarding' && (
                                <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center', fontSize: '13px' }}>
                                  {isContractScheduled || isReqVerified ? (
                                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                                  ) : (
                                    <strong style={{ color: '#b91c1c', fontSize: '13px' }}>{deadlineStr}</strong>
                                  )}
                                </td>
                              )}

                              {/* Column 5/4: Primary Actions or Status Badges */}
                              <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                {evalTab === 'pending' && (
                                  /* ── Tab 1 Pending Actions ── */
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateResult(i.application_id, 'Passed Final Interview', candidateName, i.job_title)}
                                      style={{
                                        background: '#10b981', color: '#ffffff', border: 'none',
                                        padding: '7px 14px', borderRadius: '7px', cursor: 'pointer',
                                        fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)', transition: 'all 0.15s'
                                      }}
                                      title="Mark candidate as Passed Final Interview"
                                    >
                                      <i className="bx bx-check" style={{ fontSize: '16px' }}></i> Pass interview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateResult(i.application_id, 'Failed Final Interview', candidateName, i.job_title)}
                                      style={{
                                        background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca',
                                        padding: '7px 14px', borderRadius: '7px', cursor: 'pointer',
                                        fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                        display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s'
                                      }}
                                      title="Mark candidate as Failed Final Interview"
                                    >
                                      <i className="bx bx-x" style={{ fontSize: '16px' }}></i> Fail interview
                                    </button>
                                  </div>
                                )}

                                {evalTab === 'final_approval' && (
                                  /* ── Tab 2 Final Approval Actions ── */
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateResult(i.application_id, 'Passed Final Approval', candidateName, i.job_title)}
                                      style={{
                                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                        color: '#ffffff', border: 'none',
                                        padding: '7px 16px', borderRadius: '7px', cursor: 'pointer',
                                        fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        boxShadow: '0 2px 10px rgba(5, 150, 105, 0.3)', transition: 'all 0.15s'
                                      }}
                                      title="Officially Approve and Hire candidate"
                                    >
                                      <i className="bx bx-award" style={{ fontSize: '16px' }}></i> Hire
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateResult(i.application_id, 'Failed Final Approval', candidateName, i.job_title)}
                                      style={{
                                        background: '#ffffff', color: '#475569', border: '1.5px solid #cbd5e1',
                                        padding: '7px 14px', borderRadius: '7px', cursor: 'pointer',
                                        fontWeight: '700', fontSize: '12px', fontFamily: "'Montserrat', sans-serif",
                                        display: 'inline-flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s'
                                      }}
                                      title="Reject candidate at Final Approval stage"
                                    >
                                      <i className="bx bx-x" style={{ fontSize: '16px' }}></i> Reject
                                    </button>
                                  </div>
                                )}

                                {evalTab === 'onboarding' && (
                                  /* ── Tab 3 Onboarding Actions ── */
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                                      title="Open side drawer to verify requirements and manage contract signing"
                                    >
                                      <i className="bx bx-slider-alt" style={{ fontSize: '16px' }}></i> Manage Onboarding
                                    </button>
                                  </div>
                                )}

                                {evalTab === 'evaluated' && (
                                  /* ── Tab 4 Evaluated Final Status Badges ── */
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    {isContractSigned && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: '#ecfdf5', color: '#047857', border: '1.5px solid #a7f3d0',
                                        borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                      }}>
                                        <i className="bx bx-check-double" style={{ fontSize: '15px', color: '#059669' }}></i> Officially Hired &amp; Signed
                                      </span>
                                    )}

                                    {isPassedApproval && !isContractSigned && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: '#ecfdf5', color: '#047857', border: '1.5px solid #a7f3d0',
                                        borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                      }}>
                                        <i className="bx bx-check-circle" style={{ fontSize: '14px' }}></i> Passed Final Approval (Hired)
                                      </span>
                                    )}

                                    {isFailedInterview && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca',
                                        borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                      }}>
                                        <i className="bx bx-x-circle" style={{ fontSize: '14px' }}></i> Failed Final Interview
                                      </span>
                                    )}

                                    {isFailedApproval && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: '#f1f5f9', color: '#334155', border: '1.5px solid #cbd5e1',
                                        borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                      }}>
                                        <i className="bx bx-block" style={{ fontSize: '14px' }}></i> Failed Final Approval
                                      </span>
                                    )}

                                    {isWithdrawn && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: '#f1f5f9', color: '#475569', border: '1.5px solid #cbd5e1',
                                        borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                      }}>
                                        <i className="bx bx-user-minus" style={{ fontSize: '14px' }}></i> Candidate Withdrew
                                      </span>
                                    )}

                                    {isIncompleteReq && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: '#fff1f2', color: '#be123c', border: '1.5px solid #fecdd3',
                                        borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                      }}>
                                        <i className="bx bx-time-five" style={{ fontSize: '14px' }}></i> Incomplete Requirements
                                      </span>
                                    )}

                                    {isFailedPreEmp && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                        background: '#fef2f2', color: '#b91c1c', border: '1.5px solid #fecaca',
                                        borderRadius: '20px', padding: '4px 12px', fontSize: '11.5px', fontWeight: '700'
                                      }}>
                                        <i className="bx bx-error-circle" style={{ fontSize: '14px' }}></i> Failed Pre-Employment
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Column 5: Action (Available in Onboarding Tab only) */}
                              {evalTab === 'onboarding' && (
                                <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setUpdateStatusTarget({
                                        id: i.application_id,
                                        name: candidateName,
                                        job: i.job_title,
                                        status: i.status
                                      });
                                      setSelectedPostHireStatus('Candidate Withdrew');
                                    }}
                                    style={{
                                      background: '#ffffff',
                                      border: '1.5px solid #cbd5e1',
                                      color: '#0f172a',
                                      padding: '6px 14px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      fontFamily: "'Montserrat', sans-serif",
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
                                    title="Update candidate post-hire status"
                                  >
                                    <i className="bx bx-edit-alt" style={{ fontSize: '15px', color: '#64748b' }}></i>
                                    <span>Update Status</span>
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {filteredList.length > EVAL_PAGE_SIZE && (
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
                              fontWeight: '600'
                            }}
                          >
                            Previous
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

        {/* ── Application Audit Records Tab (Identical to Admin MasterListTab) ── */}
        {activeTab === 'master_list' && <MasterListTab />}

        {/* ── System Audit Records Tab ── */}
        {activeTab === 'audit' && <SuperAdminAuditTab />}

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
                <div><label style={LABEL_STYLE}>First Name</label><input required type="text" placeholder="First Name" value={newAdmin.first_name} onChange={e => setNewAdmin({ ...newAdmin, first_name: autoCapitalize(e.target.value) })} style={FIELD_STYLE} /></div>
                <div><label style={LABEL_STYLE}>Last Name</label><input required type="text" placeholder="Last Name" value={newAdmin.last_name} onChange={e => setNewAdmin({ ...newAdmin, last_name: autoCapitalize(e.target.value) })} style={FIELD_STYLE} /></div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={LABEL_STYLE}>Email Address</label>
                <input required type="email" placeholder="admin@airshipexpress.com" value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} style={FIELD_STYLE} />
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
                <div><label style={LABEL_STYLE}>First Name</label><input required type="text" placeholder="First Name" value={editAdmin.first_name} onChange={e => setEditAdmin({ ...editAdmin, first_name: autoCapitalize(e.target.value) })} style={FIELD_STYLE} /></div>
                <div><label style={LABEL_STYLE}>Last Name</label><input required type="text" placeholder="Last Name" value={editAdmin.last_name} onChange={e => setEditAdmin({ ...editAdmin, last_name: autoCapitalize(e.target.value) })} style={FIELD_STYLE} /></div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={LABEL_STYLE}>Email Address</label>
                <input required type="email" placeholder="admin@airshipexpress.com" value={editAdmin.email} onChange={e => setEditAdmin({ ...editAdmin, email: e.target.value })} style={FIELD_STYLE} />
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
                <label style={LABEL_STYLE}>Interview Date</label>
                <input
                  required type="date" value={newSlot.date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => {
                    setNewSlot({ ...newSlot, date: e.target.value });
                    setSlotError('');
                    fetchSlotDayCount(e.target.value);
                  }}
                  style={FIELD_STYLE}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={LABEL_STYLE}>Start Time</label>
                  <input required type="time" value={newSlot.start_time} onChange={e => handleStartTimeChange(e.target.value)} style={FIELD_STYLE} />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Calculated End Time (Auto)</label>
                  <input
                    type="time"
                    readOnly
                    value={newSlot.end_time || calculateEndTime(newSlot.start_time, newSlot.num_slots || 1)}
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
        <div style={MODAL_OVERLAY} onClick={() => setUpdateStatusTarget(null)}>
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
        <div style={MODAL_OVERLAY} onClick={() => !contractSubmitting && setContractModalCandidate(null)}>
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
              {/* Date with Dynamic Day of the Week calculation */}
              <div style={{ marginBottom: '16px' }}>
                <label style={LABEL_STYLE}>
                  Scheduled Date &amp; Day <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                    style={FIELD_STYLE}
                  />
                  <div style={{
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
                  onChange={(e) => setContractTime(e.target.value)}
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

      {/* ── Onboarding Side Drawer ── */}
      {onboardingDrawerCandidate && (
        <OnboardingDrawer
          candidate={onboardingDrawerCandidate}
          onClose={() => setOnboardingDrawerCandidate(null)}
          onVerifyAndSchedule={async (appId, candName, candJob) => {
            await handleUpdateResult(appId, 'Requirements Verified', candName, candJob);
            setOnboardingDrawerCandidate(prev => prev ? ({ ...prev, status: 'Requirements Verified' }) : null);
            await fetchInterviews(true);
          }}
          onScheduleContract={async (appId, scheduleData) => {
            try {
              const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
              const res = await fetch('http://localhost/Hiring%20System/backend/super_admin/interviews/schedule_contract_signing.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                showSaveToast('Contract signing schedule sent successfully!', 'success');
                setOnboardingDrawerCandidate(null);
                await fetchInterviews(true);
              } else {
                alert(data.message || 'Failed to schedule contract signing.');
              }
            } catch (err) {
              console.error(err);
              alert('Connection error while scheduling contract signing.');
            }
          }}
          onMarkContractSigned={async (appId, candName, candJob) => {
            await handleUpdateResult(appId, 'Contract Signed & Onboarded', candName, candJob);
            setOnboardingDrawerCandidate(null);
            await fetchInterviews(true);
          }}
          onUpdateStatus={(appId, newStatus) => {
            const c = onboardingDrawerCandidate;
            setOnboardingDrawerCandidate(null);
            setUpdateStatusTarget({
              id: appId,
              name: c ? (c.candidate_name || `${c.User_Fname || ''} ${c.User_Lname || ''}`) : 'Candidate',
              job: c ? c.job_title : 'Position',
              status: c ? c.status : ''
            });
            setSelectedPostHireStatus(newStatus);
          }}
        />
      )}

    </div>
  );
};

export default SuperAdminDashboard;
