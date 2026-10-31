import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ApplicantNavbar from '../../components/ApplicantNavbar/ApplicantNavbar';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import LoadingScreen from '../../components/LoadingScreen/LoadingScreen';
import { CardSkeleton, DatabaseErrorState } from '../../components/Loading';
import useToast from '../../components/Toast/Toast';
import Footer from '../../components/Footer/Footer';
import './Vacancy.css';

import { API_BASE_URL } from '../../utils/apiConfig';
const Vacancy = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { showToast, ToastPortal } = useToast();

  // States
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auth user state
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('hiring_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const formatCandidateFullName = (u) => {
    if (!u) return '';
    const fn = (u.first_name || u.User_Fname || '').trim();
    const mi = (u.middle_initial || u.User_MInitial || u.middleInitial || '').trim();
    const ln = (u.last_name || u.User_Lname || '').trim();
    const miFormatted = mi ? `${mi.replace(/\./g, '')}. ` : '';
    return `${fn} ${miFormatted}${ln}`.trim();
  };

  const [appliedJobs, setAppliedJobs] = useState([]);
  const [appliedJobsMap, setAppliedJobsMap] = useState({});
  const [cooldownJobsMap, setCooldownJobsMap] = useState({});
  const [hasActiveApp, setHasActiveApp] = useState(false);
  const [fullName, setFullName] = useState(() => {
    try {
      const saved = localStorage.getItem('hiring_user');
      if (saved) {
        return formatCandidateFullName(JSON.parse(saved));
      }
    } catch {}
    return '';
  });
  const [email, setEmail] = useState(() => {
    try {
      const saved = localStorage.getItem('hiring_user');
      if (saved) return JSON.parse(saved).email || JSON.parse(saved).User_Email || '';
    } catch {}
    return '';
  });
  const [mobile, setMobile] = useState(() => {
    try {
      const saved = localStorage.getItem('hiring_user');
      if (saved) {
        const u = JSON.parse(saved);
        return u.User_Mobile || u.mobile || u.phone || '';
      }
    } catch {}
    return '';
  });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [aiScore, setAiScore] = useState(null);
  
  // Application Form States
  const [resumeFile, setResumeFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isParseError, setIsParseError] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isPreScreening, setIsPreScreening] = useState(false);
  const [preScreenResult, setPreScreenResult] = useState(null);
  const [mobileTouched, setMobileTouched] = useState(false);

  // Navbar states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isHiredUser, setIsHiredUser] = useState(false);
  const [hiredJobTitle, setHiredJobTitle] = useState('');

  // Category Filter Dropdown State
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef(null);

  // Employment Type Filter Dropdown State
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef(null);

  // Dynamic active application template
  const [activeTemplateInfo, setActiveTemplateInfo] = useState({
    download_url: `${API_BASE_URL}/jobs/download_template.php`,
    original_filename: 'RESUME TEMPLATE.docx'
  });

  useEffect(() => {
    document.title = 'Job Vacancies - Airship Express';

    // Retrieve active user if any
    const savedUser = localStorage.getItem('hiring_user');
    let initialUser = null;
    if (savedUser) {
      initialUser = JSON.parse(savedUser);
      setUser(initialUser);
      setFullName(`${initialUser.first_name} ${initialUser.last_name}`);
      setEmail(initialUser.email);
      setMobile(initialUser.User_Mobile || initialUser.mobile || initialUser.phone || '');
    }

    // Fetch jobs from backend
    fetchJobs(initialUser);

    // Fetch active template info
    fetch(`${API_BASE_URL}/jobs/get_template_info.php`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success' && data.template) {
          setActiveTemplateInfo(data.template);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      const name = formatCandidateFullName(user);
      if (name) setFullName(name);
      if (user.email || user.User_Email) setEmail(user.email || user.User_Email);
      const mob = user.User_Mobile || user.mobile || user.phone;
      if (mob) setMobile(mob);

      fetchNotifications();
      fetchAppliedJobs();
      fetchJobs(user);
    }
  }, [user]);

  // Keep synced with changes from Settings or other tabs
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('hiring_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          setUser(parsed);
          const formatted = formatCandidateFullName(parsed);
          if (formatted) setFullName(formatted);
          if (parsed.email || parsed.User_Email) setEmail(parsed.email || parsed.User_Email);
          const mob = parsed.User_Mobile || parsed.mobile || parsed.phone;
          if (mob) setMobile(mob);
        }
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchAppliedJobs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/applications/get_user_applied_jobs.php?user_id=${user.id}`);
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setAppliedJobs(data.job_ids);
        setAppliedJobsMap(data.applied_jobs_map || {});
        setCooldownJobsMap(data.cooldown_jobs_map || {});
        setHasActiveApp(data.has_active_application);
        setIsHiredUser(Boolean(data.is_hired));
        setHiredJobTitle(data.hired_job_title || '');

        // Sync fresh user profile from users_tbl (including User_MInitial)
        if (data.user) {
          const freshFn = (data.user.User_Fname || '').trim();
          const freshMi = (data.user.User_MInitial || '').trim();
          const freshLn = (data.user.User_Lname || '').trim();
          const freshUserObj = {
            ...user,
            ...data.user,
            first_name: freshFn,
            middle_initial: freshMi,
            last_name: freshLn,
            User_Fname: freshFn,
            User_MInitial: freshMi,
            User_Lname: freshLn
          };
          const formatted = formatCandidateFullName(freshUserObj);
          if (formatted) setFullName(formatted);
          if (data.user.User_Email) setEmail(data.user.User_Email);
          if (data.user.User_Mobile) setMobile(data.user.User_Mobile);
          localStorage.setItem('hiring_user', JSON.stringify(freshUserObj));
        }
      }
    } catch (err) {
      console.error("Failed to fetch applied jobs:", err);
    }
  };

  const isJobActive = (jobId) => {
    if (cooldownJobsMap[jobId]?.in_cooldown) return false;
    const st = (appliedJobsMap[jobId] || '').trim().toUpperCase();
    const closed = [
      'REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED',
      'DECLINED - UNRESPONSIVE', 'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'UNRESPONSIVE',
      'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN',
      'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED',
      'OFFER EXPIRED', 'OFFER_EXPIRED', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS',
      'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL',
      'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW',
      'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW', 'CANDIDATE NO-SHOW'
    ];
    if (closed.includes(st)) return false;
    if (appliedJobs.includes(jobId)) return true;
    if (!st) return false;
    return !closed.includes(st);
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/get_notifications.php?user_id=${user.id}`);
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await fetch(`${API_BASE_URL}/notifications/mark_read.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notif.id })
        });
        setNotifications(notifications.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
    setShowNotifications(false);
    const targetPath = (notif?.link && notif.link !== '/applicant-dashboard') ? notif.link : '/application-status';
    navigate(targetPath);
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

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const handleWithdrawApplication = (job) => {
    if (!user || !job) return;
    setConfirmModalState({
      isOpen: true,
      title: 'Cancel & Withdraw Application',
      message: `Are you sure you want to cancel and withdraw your submitted application for "${job.title}"? Your application will be withdrawn.`,
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
              job_id: job.id,
              reason: 'Candidate cancelled application from vacancy portal'
            })
          });
          const data = await res.json();
          if (res.ok && data.status === 'success') {
            await fetchAppliedJobs();
            await fetchJobs();
            showToast('Application successfully withdrawn.', 'info');
          } else {
            showToast(data.message || 'Failed to withdraw application.', 'danger');
          }
        } catch (err) {
          console.error('Failed to withdraw application:', err);
          showToast('Connection error while withdrawing application.', 'danger');
        }
      }
    });
  };

  const fetchJobs = async (targetUser = null) => {
    setLoadingJobs(true);
    setJobsError(null);
    try {
      const activeUser = targetUser !== null ? targetUser : (user || (() => {
        try {
          const saved = localStorage.getItem('hiring_user');
          return saved ? JSON.parse(saved) : null;
        } catch { return null; }
      })());
      const userParam = activeUser?.id ? `&user_id=${activeUser.id}` : '';
      const response = await fetch(`${API_BASE_URL}/jobs/get_jobs.php?active_only=true${userParam}`);
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const data = await response.json();
      if (data.status === 'success') {
        setJobs(data.jobs || []);
        if (data.jobs && data.jobs.length > 0) {
          setSelectedJob(null);
        }
      } else {
        throw new Error(data.message || 'Failed to load job listings.');
      }
    } catch (err) {
      console.error('Failed to load vacancies:', err);
      setJobsError(err.message || 'Database connection error while retrieving job listings.');
    } finally {
      setLoadingJobs(false);
    }
  };

  const categoryOptions = useMemo(() => {
    const counts = {};
    jobs.forEach(j => {
      const cat = (j.category && j.category.trim()) ? j.category.trim() : 'Operations';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.keys(counts).sort().map(name => ({
      name,
      count: counts[name]
    }));
  }, [jobs]);

  const employmentTypeOptions = useMemo(() => {
    const counts = {};
    jobs.forEach(j => {
      const type = (j.employment_type && j.employment_type.trim()) ? j.employment_type.trim() : 'Full Time';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts).sort().map(name => ({
      name,
      count: counts[name]
    }));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const cat = (job.category && job.category.trim()) ? job.category.trim() : 'Operations';
      const matchesCategory = selectedCategory === 'All' || cat.toLowerCase() === selectedCategory.toLowerCase();

      const jobType = (job.employment_type && job.employment_type.trim()) ? job.employment_type.trim() : 'Full Time';
      const matchesType = selectedEmploymentType === 'All' || jobType.toLowerCase() === selectedEmploymentType.toLowerCase();
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (job.title && job.title.toLowerCase().includes(q)) ||
        (job.category && job.category.toLowerCase().includes(q)) ||
        (job.location && job.location.toLowerCase().includes(q)) ||
        (job.requirements && job.requirements.toLowerCase().includes(q));

      return matchesCategory && matchesType && matchesSearch;
    });
  }, [jobs, selectedCategory, selectedEmploymentType, searchQuery]);

  const handleApplyClick = () => {
    if (!user) {
      // Block application process and display clear auth reminder modal
      setShowAuthModal(true);
      return;
    }

    // Check if the selected job is in 6-month cooldown (withdrawn, evaluated/rejected, or declined)
    const cooldownInfo = selectedJob ? cooldownJobsMap[selectedJob.id] : null;
    if (cooldownInfo && cooldownInfo.in_cooldown) {
      let desc = `You previously withdrew your application for "${selectedJob.title}" on ${cooldownInfo.withdrawn_date}.`;
      if (cooldownInfo.type === 'rejected') {
        desc = `Your application for "${selectedJob.title}" was evaluated on ${cooldownInfo.event_date || cooldownInfo.withdrawn_date}.`;
      } else if (cooldownInfo.type === 'declined') {
        desc = `You previously declined the job offer for "${selectedJob.title}" on ${cooldownInfo.event_date || cooldownInfo.withdrawn_date}.`;
      } else if (cooldownInfo.type === 'no_show') {
        desc = `You missed your scheduled Final Interview for "${selectedJob.title}" on ${cooldownInfo.event_date || cooldownInfo.withdrawn_date}.`;
      }
      setConfirmModalState({
        isOpen: true,
        title: '6-Month Waiting Period',
        message: `${desc} Under company policy, candidates must wait 6 months before re-applying for the same role. You will be eligible to re-apply on ${cooldownInfo.eligible_date} (approx. ${cooldownInfo.days_remaining} days remaining). You are welcome to explore and apply to other open positions!`,
        confirmText: 'Understood',
        cancelText: '',
        type: 'primary',
        onConfirm: () => closeConfirmModal(),
      });
      return;
    }

    // Freshly recalculate candidate info immediately before opening the apply modal
    try {
      const saved = localStorage.getItem('hiring_user');
      const u = saved ? JSON.parse(saved) : user;
      const formatted = formatCandidateFullName(u);
      if (formatted) setFullName(formatted);
      if (u?.email || u?.User_Email) setEmail(u.email || u.User_Email);
      const mob = u?.User_Mobile || u?.mobile || u?.phone;
      if (mob) setMobile(mob);
    } catch {}

    // Open apply modal
    setIsModalOpen(true);
  };

  const processSelectedFile = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setSubmitError('Unsupported or unformatted file detected. Please upload a standard PDF resume (up to 5MB).');
      setResumeFile(null);
      setPreScreenResult(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('File too large. Please upload a standard PDF resume under 5MB.');
      setResumeFile(null);
      setPreScreenResult(null);
      return;
    }

    setResumeFile(file);
    setSubmitError('');
    setIsPreScreening(true);
    setPreScreenResult(null);

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('candidate_name', fullName);
    if (user?.id) {
      formData.append('user_id', user.id);
    }
    const mi = (user?.middle_initial || user?.User_MInitial || '').trim();
    if (mi) {
      formData.append('middle_initial', mi);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/applications/pre_screen_resume.php`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        setPreScreenResult({
          matched: false,
          is_parse_error: data.is_parse_error || false,
          message: data.message || 'Unable to parse resume format.',
          extractedName: data.extracted_name || '',
          accountName: data.account_name || fullName
        });
      } else {
        setPreScreenResult({
          matched: data.matched,
          discrepancyType: data.discrepancy_type,
          extractedName: data.extracted_name,
          accountName: data.account_name || fullName,
          message: data.message
        });
      }
    } catch (err) {
      console.error('Pre-screening error:', err);
      setPreScreenResult({
        matched: false,
        message: 'Could not connect to pre-screening service. Please verify your network.',
        extractedName: '',
        accountName: fullName
      });
    } finally {
      setIsPreScreening(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!resumeFile) {
      setSubmitError('Unsupported or unformatted file detected. Please upload a standard PDF resume (up to 5MB).');
      setIsParseError(false);
      return;
    }

    if (isPreScreening) {
      setSubmitError('Please wait for resume pre-screening to finish.');
      return;
    }

    if (preScreenResult && !preScreenResult.matched) {
      setSubmitError('Resume name does not match your registered account. Please attach your own resume or update your account name in Settings before applying.');
      return;
    }

    const cleanMobile = (mobile || '').replace(/\D/g, '');
    if (cleanMobile.length !== 11) {
      setMobileTouched(true);
      return;
    }

    if (!privacyAgreed) {
      setPrivacyError(true);
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setPrivacyError(false);
    setIsParseError(false);

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('job_id', selectedJob.id);
    formData.append('user_id', user.id);
    formData.append('candidate_name', fullName);
    formData.append('candidate_email', email);
    formData.append('candidate_mobile', mobile);

    try {
      const response = await fetch(`${API_BASE_URL}/applications/apply.php`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.message || 'Failed to submit application.';
        const err = new Error(errorMsg);
        err.is_parse_error = result.is_parse_error;
        throw err;
      }

      setAiScore(result.application?.ai_match_score ?? null);
      setSubmitSuccess(true);
      // Immediately add to applied jobs
      if (selectedJob?.id) {
        setAppliedJobs(prev => [...prev, selectedJob.id]);
      }
    } catch (err) {
      if (err.is_parse_error) {
        setConfirmModalState({
          isOpen: true,
          title: 'Invalid Resume Format',
          message: 'Unsupported or unformatted file detected. Please upload a standard PDF resume (up to 5MB) or download our template to guarantee compatibility.',
          confirmText: 'Download Word Template',
          cancelText: 'Close',
          type: 'primary',
          onConfirm: () => {
            const link = document.createElement('a');
            link.href = activeTemplateInfo?.download_url || `${API_BASE_URL}/jobs/download_template.php`;
            link.download = activeTemplateInfo?.original_filename || 'RESUME TEMPLATE.docx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            closeConfirmModal();
          },
        });
      } else {
        setSubmitError(err.message || 'Connection error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (submitSuccess) {
      fetchAppliedJobs();
      fetchJobs(user);
    }
    setIsModalOpen(false);
    setResumeFile(null);
    setSubmitError('');
    setIsParseError(false);
    setSubmitSuccess(false);
    setAiScore(null);
    setPrivacyAgreed(false);
    setPrivacyError(false);
    setIsDraggingOver(false);
    setMobileTouched(false);
  };

  return (
    <div className="vacancy-wrapper">
      <ApplicantNavbar
        user={user}
        activePage="vacancy"
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

      {/* Main Banner */}
      <div className="vacancy-banner-container">
        <h1 className="vacancy-page-title">Job Openings</h1>
        <p className="vacancy-page-subtitle">
          Explore exciting opportunities to join the Airship Express team. We're looking for passionate, motivated individuals to help us grow!
        </p>
      </div>

      {loadingJobs ? (
        <div style={{ padding: '0 24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
          <CardSkeleton count={6} layout="grid" />
        </div>
      ) : jobsError ? (
        <div style={{ padding: '0 24px', maxWidth: '700px', margin: '0 auto', width: '100%' }}>
          <DatabaseErrorState
            title="Unable to Load Job Listings"
            message={jobsError}
            onRetry={fetchJobs}
          />
        </div>
      ) : (
        <>
        <div className="vacancy-filter-bar-container">
          <div className="vacancy-search-box">
            <i className="bx bx-search vacancy-search-icon"></i>
            <input
              type="text"
              className="vacancy-search-input"
              placeholder="Search position title, category, or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="vacancy-search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear Search"
              >
                <i className="bx bx-x"></i>
              </button>
            )}
          </div>

          <div className="vacancy-category-dropdown-box" ref={categoryDropdownRef}>
            <button
              type="button"
              className={`vacancy-category-dropdown-btn ${isCategoryDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsCategoryDropdownOpen(prev => !prev)}
              aria-expanded={isCategoryDropdownOpen}
              aria-haspopup="listbox"
            >
              <div className="vacancy-category-btn-left">
                <i className="bx bx-folder vacancy-category-dropdown-icon"></i>
                <span className="vacancy-category-selected-text">
                  {selectedCategory === 'All' ? 'All Categories' : selectedCategory}
                </span>
              </div>
              <i className={`bx bx-chevron-down vacancy-dropdown-arrow ${isCategoryDropdownOpen ? 'open' : ''}`}></i>
            </button>

            {isCategoryDropdownOpen && (
              <div className="vacancy-category-dropdown-menu" role="listbox">
                <div
                  className={`vacancy-category-dropdown-item ${selectedCategory === 'All' ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedCategory('All');
                    setIsCategoryDropdownOpen(false);
                  }}
                  role="option"
                  aria-selected={selectedCategory === 'All'}
                >
                  <div className="vacancy-category-item-label">
                    <i className="bx bx-grid-alt"></i>
                    <span>All Categories</span>
                  </div>
                </div>

                {categoryOptions.map(cat => {
                  const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                  return (
                    <div
                      key={cat.name}
                      className={`vacancy-category-dropdown-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedCategory(cat.name);
                        setIsCategoryDropdownOpen(false);
                      }}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="vacancy-category-item-label">
                        <i className="bx bx-briefcase-alt-2"></i>
                        <span>{cat.name}</span>
                      </div>
                      {cat.count > 0 && (
                        <div className="vacancy-category-item-right">
                          <span className="vacancy-category-count-badge">
                            {cat.count}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="vacancy-category-dropdown-box" ref={typeDropdownRef}>
            <button
              type="button"
              className={`vacancy-category-dropdown-btn ${isTypeDropdownOpen ? 'active' : ''}`}
              onClick={() => setIsTypeDropdownOpen(prev => !prev)}
              aria-expanded={isTypeDropdownOpen}
              aria-haspopup="listbox"
            >
              <div className="vacancy-category-btn-left">
                <i className="bx bx-time-five vacancy-category-dropdown-icon"></i>
                <span className="vacancy-category-selected-text">
                  {selectedEmploymentType === 'All' ? 'All Types' : selectedEmploymentType}
                </span>
              </div>
              <i className={`bx bx-chevron-down vacancy-dropdown-arrow ${isTypeDropdownOpen ? 'open' : ''}`}></i>
            </button>

            {isTypeDropdownOpen && (
              <div className="vacancy-category-dropdown-menu" role="listbox">
                <div
                  className={`vacancy-category-dropdown-item ${selectedEmploymentType === 'All' ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedEmploymentType('All');
                    setIsTypeDropdownOpen(false);
                  }}
                  role="option"
                  aria-selected={selectedEmploymentType === 'All'}
                >
                  <div className="vacancy-category-item-label">
                    <i className="bx bx-grid-alt"></i>
                    <span>All Types</span>
                  </div>
                </div>

                {employmentTypeOptions.map(type => {
                  const isSelected = selectedEmploymentType.toLowerCase() === type.name.toLowerCase();
                  return (
                    <div
                      key={type.name}
                      className={`vacancy-category-dropdown-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedEmploymentType(type.name);
                        setIsTypeDropdownOpen(false);
                      }}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className="vacancy-category-item-label">
                        <i className="bx bx-time-five"></i>
                        <span>{type.name}</span>
                      </div>
                      {type.count > 0 && (
                        <div className="vacancy-category-item-right">
                          <span className="vacancy-category-count-badge">
                            {type.count}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            className={`vacancy-filter-reset-btn ${(searchQuery || selectedCategory !== 'All' || selectedEmploymentType !== 'All') ? 'active' : ''}`}
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setSelectedEmploymentType('All');
              setIsCategoryDropdownOpen(false);
              setIsTypeDropdownOpen(false);
            }}
            title="Reset Filters"
            aria-hidden={!(searchQuery || selectedCategory !== 'All' || selectedEmploymentType !== 'All')}
            tabIndex={(searchQuery || selectedCategory !== 'All' || selectedEmploymentType !== 'All') ? 0 : -1}
          >
            <i className="bx bx-reset"></i>
            <span>Clear</span>
          </button>
        </div>

        <div className={`vacancy-dynamic-layout ${selectedJob ? 'has-expanded' : ''}`}>
          {selectedJob && (
            <div className="vacancy-expanded-card">
              <button className="vacancy-close-expanded" onClick={() => setSelectedJob(null)} aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>

              <div className="vacancy-expanded-inner">
                <div className="vacancy-expanded-image">
                  {selectedJob.image_path ? (
                    <img
                      src={selectedJob.image_path.startsWith('data:') || selectedJob.image_path.startsWith('http') ? selectedJob.image_path : `${API_BASE_URL}/${selectedJob.image_path}`}
                      alt={selectedJob.title || "Job Role"}
                      style={{objectFit: 'cover'}}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    </div>
                  )}
                </div>

                <div className="vacancy-expanded-header-info">
                  {/* Category (Top Left) & Date (Top Right) */}
                  <div className="vacancy-expanded-meta-bar">
                    <span className="vacancy-expanded-category-badge">
                      <i className="bx bx-briefcase-alt-2"></i>
                      {selectedJob.category || 'Operations'}
                    </span>
                    <span className="vacancy-expanded-date-badge">
                      <i className="bx bx-calendar"></i>
                      Posted: {selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                    </span>
                  </div>

                  <h2 className="vacancy-expanded-title">{selectedJob.title}</h2>

                  {/* Company Location & Availability Bar */}
                  <div className="vacancy-expanded-location-row">
                    <div className="vacancy-expanded-location-bar">
                      <i className="bx bx-map vacancy-expanded-location-icon"></i>
                      <span className="vacancy-expanded-location-text">{selectedJob.location || 'Airship Express HQ'}</span>
                    </div>
                    <span className="vacancy-expanded-avail-badge">
                      <i className="bx bx-user-check"></i>
                      Availability: <strong>{selectedJob.availability} {selectedJob.availability === 1 ? 'Slot' : 'Slots'}</strong>
                    </span>
                  </div>

                  {/* Badges: Employment Type & Salary */}
                  <div className="vacancy-expanded-pill-row">
                    <span className={`vacancy-type-badge ${selectedJob.employment_type === 'Part Time' ? 'part-time' : 'full-time'}`}>
                      <i className="bx bx-time-five" />
                      <span>{selectedJob.employment_type || 'Full Time'}</span>
                    </span>

                    {selectedJob.salary && (
                      <span className="vacancy-salary-badge">
                        <i className="bx bx-wallet" />
                        <span>₱ {selectedJob.salary}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="vacancy-expanded-details">
                  {selectedJob.description && (
                    <div style={{ marginBottom: '18px' }}>
                      <h3 className="vacancy-detail-heading">Job Description:</h3>
                      <p className="vacancy-detail-p" style={{ whiteSpace: 'pre-line' }}>
                        {selectedJob.description}
                      </p>
                    </div>
                  )}

                  <h3 className="vacancy-detail-heading">Qualification:</h3>
                  <ul className="vacancy-detail-ul">
                    {(selectedJob.requirements || '')
                      .split(/\r?\n|\.\s+|•|\*|;/)
                      .map(str => str.replace(/^[•\-\*\s]+/, '').trim())
                      .filter(str => str.length > 0)
                      .map((req, idx) => (
                        <li key={idx} style={{ marginBottom: '8px', lineHeight: '1.5' }}>{req}</li>
                      ))}
                  </ul>

                  {(() => {
                    const jobStatus = appliedJobsMap[selectedJob.id];
                    const cooldownInfo = cooldownJobsMap[selectedJob.id];
                    const isActive = selectedJob.status.toLowerCase() === 'active';
                    
                    let btnText = isActive ? 'Apply Now' : 'Position Closed';
                    let btnStyle = {
                      width: '100%',
                      padding: '12px 20px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      fontFamily: "'Montserrat', sans-serif",
                      cursor: isActive ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease',
                      border: 'none',
                      background: isActive ? 'linear-gradient(135deg, #e6007e 0%, #c4006b 100%)' : '#cbd5e1',
                      color: '#ffffff',
                      boxShadow: isActive ? '0 4px 12px rgba(230, 0, 126, 0.3)' : 'none'
                    };
                    let disabled = !isActive;

                    const normSt = (jobStatus || '').trim().toUpperCase();
                    const isRejected = [
                      'REJECTED', 'SCREENING_REJECTED',
                      'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED',
                      'DECLINED - UNRESPONSIVE', 'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'UNRESPONSIVE',
                      'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW',
                      'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'
                    ].includes(normSt) || cooldownInfo?.type === 'rejected';

                    const isDeclined = [
                      'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED'
                    ].includes(normSt) || cooldownInfo?.type === 'declined';

                    const isNoShow = [
                      'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW', 'CANDIDATE NO-SHOW'
                    ].includes(normSt) || normSt.includes('NO SHOW') || normSt.includes('NO_SHOW') || cooldownInfo?.type === 'no_show';

                    const isHiredForThisJob = [
                      'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED',
                      'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED',
                      'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
                      'HIRED', 'PASSED', 'HIRED / PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL'
                    ].includes(normSt);

                    if (isHiredForThisJob) {
                      disabled = true;
                      btnText = 'You have been hired for this position!';
                      btnStyle = {
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', sans-serif",
                        background: '#ecfdf5',
                        color: '#059669',
                        cursor: 'not-allowed',
                        border: '1.5px solid #a7f3d0'
                      };
                    } else if (isNoShow) {
                      disabled = true;
                      btnText = 'Application Closed — Missed Scheduled Final Interview';
                      btnStyle = {
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', sans-serif",
                        background: '#fef2f2',
                        color: '#b91c1c',
                        cursor: 'not-allowed',
                        border: '1px solid #fecaca'
                      };
                    } else if (isRejected) {
                      disabled = true;
                      btnText = 'Application Closed';
                      btnStyle = {
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', sans-serif",
                        background: '#f1f5f9',
                        color: '#64748b',
                        cursor: 'not-allowed',
                        border: '1px solid #cbd5e1'
                      };
                    } else if (isDeclined && cooldownInfo && cooldownInfo.in_cooldown) {
                      disabled = true;
                      btnText = 'Job Offer Declined';
                      btnStyle = {
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', sans-serif",
                        background: '#f1f5f9',
                        color: '#64748b',
                        cursor: 'not-allowed',
                        border: '1px solid #cbd5e1'
                      };
                    } else if (cooldownInfo && cooldownInfo.in_cooldown) {
                      disabled = true;
                      btnText = 'Cooldown Active';
                      btnStyle = {
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', sans-serif",
                        background: '#f1f5f9',
                        color: '#64748b',
                        cursor: 'not-allowed',
                        border: '1px solid #cbd5e1'
                      };
                    } else if (jobStatus) {
                      const isWithdrawn = ['Candidate Withdrew', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'Offer Declined', 'OFFER DECLINED', 'OFFER_DECLINED', 'Job Offer Declined', 'JOB OFFER DECLINED'].includes(jobStatus);

                      if (isWithdrawn) {
                        // Candidate withdrew: allow re-application if cooldown expired and job is active
                        if (isActive) {
                          btnText = 'Apply Now';
                          disabled = false;
                          btnStyle = {
                            width: '100%',
                            padding: '12px 20px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '700',
                            fontFamily: "'Montserrat', sans-serif",
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            border: 'none',
                            background: 'linear-gradient(135deg, #e6007e 0%, #c4006b 100%)',
                            color: '#ffffff',
                            boxShadow: '0 4px 12px rgba(230, 0, 126, 0.3)'
                          };
                        } else {
                          btnText = isDeclined ? 'Job Offer Declined' : 'Application Withdrawn (Closed)';
                          disabled = true;
                          btnStyle = {
                            width: '100%',
                            padding: '12px 20px',
                            borderRadius: '8px',
                            fontSize: '13.5px',
                            fontWeight: '700',
                            fontFamily: "'Montserrat', sans-serif",
                            background: '#f1f5f9',
                            color: '#64748b',
                            cursor: 'not-allowed',
                            border: '1px solid #cbd5e1'
                          };
                        }
                      } else {
                        if (isNoShow) {
                          disabled = true;
                          btnText = 'Application Closed — Missed Scheduled Final Interview';
                          btnStyle = {
                            width: '100%',
                            padding: '12px 20px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '700',
                            fontFamily: "'Montserrat', sans-serif",
                            background: '#fef2f2',
                            color: '#b91c1c',
                            cursor: 'not-allowed',
                            border: '1px solid #fecaca'
                          };
                        } else if (isRejected) {
                          disabled = true;
                          btnText = 'Application Closed';
                          btnStyle = {
                            width: '100%',
                            padding: '12px 20px',
                            borderRadius: '8px',
                            fontSize: '13.5px',
                            fontWeight: '700',
                            fontFamily: "'Montserrat', sans-serif",
                            background: '#f1f5f9',
                            color: '#64748b',
                            cursor: 'not-allowed',
                            border: '1px solid #cbd5e1'
                          };
                        } else {
                          disabled = true;
                          btnText = 'You have an active application for this position';
                          btnStyle = {
                            width: '100%',
                            padding: '12px 20px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: '700',
                            fontFamily: "'Montserrat', sans-serif",
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            cursor: 'not-allowed',
                            border: '1.5px solid #bfdbfe'
                          };
                        }
                      }
                    } else if (isHiredUser) {
                      disabled = true;
                      btnText = 'Already Hired (Active Employee)';
                      btnStyle = {
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', sans-serif",
                        background: '#f8fafc',
                        color: '#64748b',
                        cursor: 'not-allowed',
                        border: '1.5px solid #cbd5e1'
                      };
                    } else if (hasActiveApp) {
                      disabled = true;
                      btnText = 'Cannot Apply (Application Pending)';
                      btnStyle = {
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', sans-serif",
                        background: '#f8fafc',
                        color: '#64748b',
                        cursor: 'not-allowed',
                        border: '1.5px solid #cbd5e1'
                      };
                    }

                    const showTrackNav = Boolean(jobStatus) || Boolean(appliedJobsMap[selectedJob.id]);

                    return (
                      <div style={{ marginTop: '18px' }}>
                        <button
                          className="vacancy-expanded-apply-btn"
                          onClick={handleApplyClick}
                          disabled={disabled}
                          style={btnStyle}
                        >
                          {btnText}
                        </button>

                        {(isNoShow || isRejected || (isDeclined && cooldownInfo && cooldownInfo.in_cooldown) || (cooldownInfo && cooldownInfo.in_cooldown)) && (
                          <div style={{
                            marginTop: '10px',
                            padding: '10px 14px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#64748b',
                            lineHeight: '1.5'
                          }}>
                            <i className="bx bx-info-circle" style={{ marginRight: '6px', verticalAlign: 'middle', color: '#0d9488', fontSize: '14px' }} />
                            {cooldownInfo?.eligible_date
                              ? `Re-applying for this position is available after a 6-month waiting period (Eligible on ${cooldownInfo.eligible_date}). You are welcome to explore and apply to other open positions!`
                              : 'Under company policy, candidates may re-apply for this role after a 6-month waiting period. You are welcome to explore and apply to other open positions!'}
                          </div>
                        )}

                        {showTrackNav && (
                          <div style={{ marginTop: '10px' }}>
                            <button
                              type="button"
                              onClick={() => navigate('/application-status')}
                              style={{
                                width: '100%',
                                padding: '12px 20px',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: '700',
                                fontFamily: "'Montserrat', sans-serif",
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                border: 'none',
                                background: 'linear-gradient(135deg, #e6007e 0%, #c4006b 100%)',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px rgba(230, 0, 126, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>Track Application Status ➔</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className={`vacancy-cards-grid ${selectedJob ? 'sidebar-mode' : ''}`}>
            {filteredJobs.length === 0 ? (
              <div className="vacancy-no-results-card">
                <div className="vacancy-no-results-icon-wrap">
                  <i className="bx bx-search-alt vacancy-no-results-icon"></i>
                </div>
                <h3 className="vacancy-no-results-title">No Vacancies Found</h3>
                <p className="vacancy-no-results-desc">
                  No open positions match your search criteria. Try selecting another category or clear your search query.
                </p>
                <button
                  type="button"
                  className="vacancy-reset-btn-pill"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setSelectedEmploymentType('All');
                  }}
                >
                  <i className="bx bx-reset"></i>
                  <span>Show All Openings</span>
                </button>
              </div>
            ) : (
              filteredJobs
                .filter(job => job.id !== selectedJob?.id)
                .map((job) => (
                <div
                  key={job.id}
                  className="vacancy-job-card"
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="vacancy-card-img-wrapper">
                    <img
                      src={job.image_path ? (job.image_path.startsWith('data:') || job.image_path.startsWith('http') ? job.image_path : `${API_BASE_URL}/${job.image_path}`) : ''}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      alt={job.title}
                      className="vacancy-card-img"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  <div className="vacancy-card-body">
                    {/* Top Row: Category Badge & Availability Slots */}
                    <div className="vacancy-card-meta-bar">
                      <span className="vacancy-meta-category-badge" title="Department">
                        <i className="bx bx-briefcase-alt-2"></i>
                        <span>{job.category || 'Operations'}</span>
                      </span>
                      <span className="vacancy-card-avail-badge" title="Available Slots">
                        <i className="bx bx-user-check"></i>
                        <span>{job.availability} {job.availability === 1 ? 'Slot' : 'Slots'}</span>
                      </span>
                    </div>

                    {/* Job Title */}
                    <h4 className="vacancy-card-title">{job.title}</h4>

                    {/* Company Location Row */}
                    <div className="vacancy-card-location-row" title="Company Location">
                      <i className="bx bx-map vacancy-card-location-icon"></i>
                      <span className="vacancy-card-location-text">{job.location || 'Airship Express HQ'}</span>
                    </div>

                    {(job.employment_type || job.salary) && (
                      <div className="vacancy-card-meta-badges">
                        <span className={`vacancy-card-type-badge ${job.employment_type === 'Part Time' ? 'part-time' : 'full-time'}`}>
                          {job.employment_type || 'Full Time'}
                        </span>
                        {job.salary && (
                          <span className="vacancy-card-salary-badge">
                            <i className="bx bx-wallet" /> ₱ {job.salary}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer: Date Posted on Left | Action Link on Right */}
                    <div className="vacancy-card-footer">
                      <span className="vacancy-meta-date-badge" title="Date Posted">
                        <i className="bx bx-calendar"></i>
                        <span>{job.created_at ? new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</span>
                      </span>
                      {cooldownJobsMap[job.id]?.in_cooldown && cooldownJobsMap[job.id]?.type !== 'rejected' && cooldownJobsMap[job.id]?.type !== 'declined' && cooldownJobsMap[job.id]?.type !== 'no_show' ? (
                        <span className="vacancy-card-link vacancy-card-link--cooldown" title={`Cooldown Active until ${cooldownJobsMap[job.id]?.eligible_date || ''}`}>
                          <i className="bx bx-lock-alt" style={{ fontSize: '15px' }}></i> Cooldown Active
                        </span>
                      ) : (cooldownJobsMap[job.id]?.type === 'no_show' || (appliedJobsMap[job.id] && (['CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW', 'CANDIDATE NO-SHOW'].includes((appliedJobsMap[job.id] || '').trim().toUpperCase()) || (appliedJobsMap[job.id] || '').trim().toUpperCase().includes('NO SHOW') || (appliedJobsMap[job.id] || '').trim().toUpperCase().includes('NO_SHOW')))) ? (
                        <span className="vacancy-card-link" style={{ color: '#b91c1c', fontWeight: '600' }} title="Application Closed — Missed Scheduled Final Interview">
                          Application Closed <i className="bx bx-right-arrow-alt"></i>
                        </span>
                      ) : (cooldownJobsMap[job.id]?.type === 'rejected' || (appliedJobsMap[job.id] && ['REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes((appliedJobsMap[job.id] || '').trim().toUpperCase()))) ? (
                        <span className="vacancy-card-link" style={{ color: '#64748b' }} title="Application Closed">
                          Application Closed <i className="bx bx-right-arrow-alt"></i>
                        </span>
                      ) : (cooldownJobsMap[job.id]?.type === 'declined' || (appliedJobsMap[job.id] && ['OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED'].includes((appliedJobsMap[job.id] || '').trim().toUpperCase()))) ? (
                        <span className="vacancy-card-link" style={{ color: '#64748b' }} title="Job Offer Declined">
                          Offer Declined <i className="bx bx-right-arrow-alt"></i>
                        </span>
                      ) : (appliedJobsMap[job.id] && [
                        'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED',
                        'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED',
                        'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED',
                        'HIRED', 'PASSED', 'HIRED / PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL'
                      ].includes((appliedJobsMap[job.id] || '').toUpperCase())) ? (
                        <span className="vacancy-card-link" style={{ color: '#059669', fontWeight: '700' }} title="Hired for this position">
                          <i className="bx bx-check-shield" style={{ fontSize: '15px', verticalAlign: 'middle', marginRight: '4px' }}></i>Hired <i className="bx bx-right-arrow-alt"></i>
                        </span>
                      ) : isJobActive(job.id) ? (
                        <span
                          className="vacancy-card-link vacancy-card-link--active"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/application-status');
                          }}
                          title="Track Application Status"
                        >
                          View Status <i className="bx bx-right-arrow-alt"></i>
                        </span>
                      ) : (
                        <span className="vacancy-card-link">
                          View Details <i className="bx bx-right-arrow-alt"></i>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}

      {/* Guest Auth Reminder Modal */}
      {showAuthModal && (
        <div className="vacancy-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="vacancy-modal-card animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', textAlign: 'center', padding: '32px 24px' }}>
            <button className="vacancy-modal-close-btn" onClick={() => setShowAuthModal(false)} aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(230, 0, 126, 0.1)', color: '#e6007e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '30px' }}>
              <i className="bx bx-lock-alt" />
            </div>

            <h3 className="vacancy-modal-title" style={{ fontSize: '20px', marginBottom: '10px' }}>
              Authentication Required
            </h3>
            <p className="vacancy-modal-subtitle" style={{ fontSize: '13.5px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
              You need a candidate account to apply for <strong>{selectedJob?.title || 'this position'}</strong>. Please log in or sign up to submit your application and track your hiring status.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="vacancy-submit-btn"
                style={{ width: '100%', margin: 0, padding: '12px 20px', fontSize: '14px' }}
                onClick={() => navigate('/login')}
              >
                Log In to Proceed
              </button>
              <button
                type="button"
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1.5px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#ffffff'; }}
                onClick={() => navigate('/register')}
              >
                Create an Account (Sign Up)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Form Modal */}
      {isModalOpen && (
        <div className="vacancy-modal-overlay" onClick={closeModal}>
          <div className="vacancy-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="vacancy-modal-close-btn" onClick={closeModal} aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            {submitting ? (
              <div className="vacancy-loading-overlay">
                <div className="vacancy-spinner"></div>
                <h3 className="vacancy-modal-title" style={{ textAlign: 'center', fontFamily: 'Montserrat, sans-serif' }}>
                  Processing Your Application
                </h3>
                <p className="vacancy-modal-subtitle" style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                  Extracting your details to save you time... Please wait while we process your resume.
                </p>
              </div>
            ) : submitSuccess ? (
              <div className="vacancy-success-card">
                <div className="vacancy-success-icon" style={{ color: '#10b981' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <h3 className="vacancy-success-title" style={{ fontFamily: 'Montserrat, sans-serif' }}>Success!</h3>
                <p className="vacancy-success-text" style={{ fontFamily: 'Inter, sans-serif', color: '#334155' }}>
                  Success! Your resume has been uploaded and your application is now under review.
                </p>
                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                  <Link to="/applicant-dashboard" className="vacancy-dashboard-btn" style={{ background: '#ec4899', color: '#ffffff' }}>
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <h3 className="vacancy-modal-title">Apply for Position</h3>
                <p className="vacancy-modal-subtitle">Upload your resume to apply for <strong>{selectedJob?.title}</strong>.</p>

                {submitError && (
                  <div className="login-alert login-alert-error" style={{ marginBottom: '16px', flexDirection: 'column', alignItems: 'flex-start', borderLeft: '4px solid #ef4444', backgroundColor: '#fef2f2', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, width: '22px', height: '22px', marginTop: '2px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      <span style={{ lineHeight: '1.5', color: '#991b1b', fontWeight: '500', fontSize: '13.5px' }}>{submitError}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleFormSubmit} className="vacancy-form">
                  <div className="vacancy-form-group">
                    <label className="vacancy-form-label">Full Name</label>
                    <input
                      type="text"
                      className="vacancy-form-input vacancy-form-input-disabled"
                      value={fullName || 'Candidate'}
                      disabled
                    />
                  </div>

                  <div className="vacancy-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label className="vacancy-form-label" style={{ marginBottom: 0 }}>Email Address</label>
                      <button
                        type="button"
                        onClick={() => navigate('/settings')}
                        style={{
                          fontSize: '11.5px',
                          color: '#e6007e',
                          fontWeight: '600',
                          fontFamily: "'Inter', sans-serif",
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0',
                          transition: 'opacity 0.15s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.opacity = '0.7'; }}
                        onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
                      >
                        Edit Profile
                      </button>
                    </div>
                    <input
                      type="email"
                      className="vacancy-form-input vacancy-form-input-disabled"
                      value={email}
                      disabled
                    />
                  </div>

                  <div className="vacancy-form-group">
                    <label className="vacancy-form-label">Contact Number</label>
                    <input
                      type="tel"
                      className="vacancy-form-input"
                      placeholder="e.g. 09123456789"
                      maxLength={11}
                      minLength={11}
                      pattern="[0-9]{11}"
                      value={mobile}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                        setMobile(val);
                        setMobileTouched(true);
                        if (submitError && submitError.includes('Contact number')) {
                          setSubmitError('');
                        }
                      }}
                      onBlur={() => setMobileTouched(true)}
                      required
                      style={{
                        borderColor: ((mobile && mobile.length > 0 && mobile.length < 11) || (mobileTouched && (!mobile || mobile.length < 11))) ? '#f87171' : undefined
                      }}
                    />
                    {((mobile && mobile.length > 0 && mobile.length < 11) || (mobileTouched && (!mobile || mobile.length < 11))) && (
                      <span style={{ fontSize: '11.5px', color: '#ef4444', marginTop: '4px', display: 'block', fontWeight: '500' }}>
                        Contact number must be exactly 11 digits ({11 - (mobile || '').length} more digit{11 - (mobile || '').length > 1 ? 's' : ''} needed).
                      </span>
                    )}
                  </div>

                  <div className="vacancy-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="vacancy-form-label" style={{ marginBottom: 0 }}>Resume (PDF format)</label>
                      <a 
                        href={activeTemplateInfo?.download_url || `${API_BASE_URL}/jobs/download_template.php`} 
                        download={activeTemplateInfo?.original_filename || "RESUME TEMPLATE.docx"}
                        style={{ 
                          fontSize: '12px', 
                          color: '#ffffff',
                          backgroundColor: '#e6007e',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontWeight: '600', 
                          textDecoration: 'none', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(230, 0, 126, 0.3)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(230, 0, 126, 0.4)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(230, 0, 126, 0.3)'; }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download Word Template
                      </a>
                    </div>

                    {!resumeFile ? (
                      <div
                        className={`vacancy-file-upload-container ${isDraggingOver ? 'is-dragging' : ''} ${submitError ? 'has-error' : ''}`}
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingOver(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            processSelectedFile(e.dataTransfer.files[0]);
                          }
                        }}
                      >
                        <div className="vacancy-file-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <p className="vacancy-file-upload-text">
                          <span>Click to upload</span> or drag and drop
                        </p>
                        <p className="vacancy-file-subtext">PDF Files only (max 5MB)</p>
                      </div>
                    ) : (
                      <div className="vacancy-selected-file-banner">
                        <div className="vacancy-selected-file-info">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                          <span>{resumeFile.name}</span>
                        </div>
                        <button
                          type="button"
                          className="vacancy-remove-file-btn"
                          onClick={() => {
                            setResumeFile(null);
                            setPreScreenResult(null);
                            setIsPreScreening(false);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          aria-label="Remove file"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                      </div>
                    )}

                    {/* Pre-Screening Status & Verification Badges */}
                    {isPreScreening && (
                      <div className="vacancy-prescreen-box vacancy-prescreen-loading">
                        <i className='bx bx-loader-alt bx-spin' style={{ fontSize: '18px', color: '#0284c7' }}></i>
                        <span>Pre-screening resume identity... verifying candidate name.</span>
                      </div>
                    )}

                    {preScreenResult?.matched === true && (
                      <div className="vacancy-prescreen-box vacancy-prescreen-success">
                        <i className='bx bx-check-circle' style={{ fontSize: '18px', color: '#059669', flexShrink: 0 }}></i>
                        <div>
                          <strong>Identity Verified:</strong> Resume matches registered account (<strong>{preScreenResult.accountName || fullName}</strong>).
                        </div>
                      </div>
                    )}

                    {preScreenResult && !preScreenResult.matched && (
                      <div className="vacancy-prescreen-box vacancy-prescreen-warning">
                        <i className='bx bx-error-circle' style={{ fontSize: '18px', color: '#d97706', flexShrink: 0, marginTop: '2px' }}></i>
                        <div>
                          <strong style={{ display: 'block', marginBottom: '3px' }}>Resume Name Mismatch Detected</strong>
                          The uploaded resume appears to belong to <strong>"{preScreenResult.extractedName || 'different candidate'}"</strong>, which does not match your registered account name (<strong>"{preScreenResult.accountName || fullName}"</strong>).
                          <div style={{ marginTop: '6px', fontSize: '12px' }}>
                            Please upload your own resume or update your account name in <button type="button" onClick={() => { setIsModalOpen(false); navigate('/settings'); }} style={{ background: 'none', border: 'none', padding: 0, color: '#e6007e', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Settings</button> before submitting.
                          </div>
                        </div>
                      </div>
                    )}

                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      accept=".pdf"
                    />
                  </div>

                  {/* Data Privacy Checkbox Integration */}
                  <div className="vacancy-privacy-group">
                    <label 
                      className="vacancy-privacy-label"
                      onClick={(e) => {
                        if (!privacyAgreed) {
                          e.preventDefault();
                          setShowTermsModal(true);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        className={`vacancy-privacy-checkbox ${privacyError ? 'has-error' : ''}`}
                        checked={privacyAgreed}
                        style={privacyError ? {
                          outline: '2.5px solid #ef4444',
                          outlineOffset: '2px',
                          borderRadius: '4px',
                          borderColor: '#ef4444',
                          boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.15)',
                        } : {}}
                        onChange={(e) => {
                          if (privacyAgreed) {
                            setPrivacyAgreed(false);
                          } else {
                            e.preventDefault();
                            setShowTermsModal(true);
                          }
                        }}
                      />
                      <span 
                        className="vacancy-privacy-text"
                        style={{
                          color: privacyError ? '#ef4444' : '#475569',
                          fontWeight: privacyError ? '600' : 'normal',
                          transition: 'color 0.2s ease',
                        }}
                      >
                        I have read and agree to the{' '}
                        <button
                          type="button"
                          className="vacancy-privacy-link"
                          style={{
                            color: privacyError ? '#dc2626' : '#ec4899',
                            fontWeight: '700',
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowTermsModal(true);
                          }}
                        >
                          Data Privacy Agreement
                        </button>
                        .
                      </span>
                    </label>
                    {privacyError && (
                      <p style={{
                        color: '#ef4444',
                        fontSize: '12px',
                        fontWeight: '600',
                        margin: '6px 0 0 27px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontFamily: "'Inter', sans-serif",
                      }}>
                        <span>This field is required</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="vacancy-submit-btn"
                    disabled={!resumeFile || submitting || isPreScreening || (preScreenResult && !preScreenResult.matched) || ((mobile || '').replace(/\D/g, '').length !== 11)}
                    style={(!resumeFile || submitting || isPreScreening || (preScreenResult && !preScreenResult.matched) || ((mobile || '').replace(/\D/g, '').length !== 11)) ? {
                      opacity: 0.65,
                      cursor: 'not-allowed'
                    } : {}}
                  >
                    {submitting 
                      ? 'Submitting Application...' 
                      : isPreScreening 
                        ? 'Verifying Resume Name...' 
                        : (preScreenResult && !preScreenResult.matched) 
                          ? 'Name Mismatch (Fix to Submit)' 
                          : 'Submit Application'
                    }
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {showTermsModal && (
        <div className="vacancy-terms-overlay" onClick={() => { setShowTermsModal(false); setHasScrolledToBottom(false); }}>
          <div className="vacancy-terms-container" onClick={(e) => e.stopPropagation()}>
            <div className="vacancy-terms-header">
              <h3 className="vacancy-terms-title">Terms & Conditions & Data Privacy Agreement</h3>
              <button
                type="button"
                className="vacancy-terms-close"
                onClick={() => { setShowTermsModal(false); setHasScrolledToBottom(false); }}
                aria-label="Close Terms Modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div
              className="vacancy-terms-body"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
                  setHasScrolledToBottom(true);
                }
              }}
            >
              <p className="vacancy-terms-intro">
                This agreement is a legally binding contract between you (the Applicant) and Airship Express regarding your use of the AI-Driven Hiring Management System.
              </p>

              <h4>1. Acceptance of Terms</h4>
              <p>
                By registering, logging in, submitting your application/resume, or using this system, you explicitly agree to these Terms & Conditions and consent to the collection and processing of your personal data for recruitment purposes.
              </p>

              <h4>2. Collection and Use of Personal Data</h4>
              <p>
                We only collect information that is strictly necessary for the recruitment, screening, and onboarding process.
              </p>
              <p>
                <strong>Data Collected:</strong> This includes, but is not limited to, your contact details, resume/CV contents, location data, AI-parsed qualifications, interview schedules, and interaction logs (e.g., text/call responses, chatbot interactions).
              </p>
              <p>
                <strong>Purpose:</strong> Your data is used exclusively to evaluate your qualifications, facilitate our automated interview scheduling (Initial Screening and Final Face-to-Face), and communicate application status updates.
              </p>
              <p>
                <strong>Consent & Rights:</strong> We process your data based on your explicit consent. You have the right to access your data, correct inaccuracies, request deletion, object to its use, ask for a copy (data portability), and claim damages if your rights are violated under the Data Privacy Act of 2012 (RA 10173).
              </p>
              <p>
                <strong>Retention:</strong> Data will be kept only as long as necessary for the active hiring cycle, unless a longer retention period is required by law, after which it will be securely archived or disposed of.
              </p>

              <h4>3. Security Measures</h4>
              <p>
                We implement rigorous technical, physical, and organizational security measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. If a serious data breach occurs that risks your identity or personal safety, we will notify you and the National Privacy Commission (NPC) within 72 hours, as required by law.
              </p>

              <h4>4. Admin & Third-Party Processing</h4>
              <p>
                <strong>Confidentiality:</strong> Airship Express administrators, interviewers, and authorized system users are bound by strict confidentiality agreements and must treat all applicant data with the utmost privacy.
              </p>
              <p>
                <strong>Third-Party Services:</strong> If we utilize third-party services (such as cloud hosting or external API processing), we ensure they adhere to the same stringent data protection standards through legally binding contracts.
              </p>
              <p>
                <strong>External Links:</strong> The system may occasionally contain links to external sites. We are not responsible for the privacy practices of third-party platforms, and users should review their respective policies.
              </p>

              <h4>5. Prohibited Actions</h4>
              <p>As a user of the Airship Express hiring platform, you are strictly prohibited from:</p>
              <ul>
                <li>Submitting false, forged, or misleading personal data or credentials.</li>
                <li>Copying, sharing, or altering system content, code, or interface designs without explicit written permission.</li>
                <li>Attempting to hack, bypass security, or otherwise damage the system infrastructure.</li>
                <li>Misusing administrative rights or exploiting system vulnerabilities.</li>
              </ul>

              <h4>6. System Availability & Liability</h4>
              <p>
                <strong>Availability:</strong> We strive to maintain continuous system uptime; however, access may be temporarily interrupted for maintenance, updates, or unforeseen technical issues.
              </p>
              <p>
                <strong>Liability:</strong> Airship Express is not liable for missed interview slots, application delays, data loss, or damages resulting from system errors, user negligence (e.g., failing to respond to scheduling prompts), or force majeure events.
              </p>
              <p>
                <strong>User Responsibility:</strong> Applicants are entirely responsible for ensuring the accuracy of submitted data and actively monitoring their Applicant Dashboard for schedule updates.
              </p>

              <h4>7. Changes to Terms & Policy</h4>
              <p>
                These Terms & Conditions may be updated periodically to remain compliant with evolving legal requirements, specifically RA 10173. Users will be notified of any significant changes prior to their implementation.
              </p>

              <div className="vacancy-terms-contact">
                <h4>Contact Information</h4>
                <p style={{ marginBottom: '8px' }}>
                  If you have questions, requests, or inquiries regarding your personal data and privacy rights under RA 10173, please contact our Data Protection and HR team:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#475569' }}>
                  <div><strong>Address:</strong> 352 T. Pinpin Escolta st. Binondo Manila, 1006</div>
                  <div><strong>Phone:</strong> 0945 441 8789</div>
                  <div><strong>Email:</strong> airshipexpress.admin@gmail.com</div>
                </div>
              </div>
            </div>

            <div className="vacancy-terms-footer">
              <button
                type="button"
                className="vacancy-terms-accept-btn"
                disabled={!hasScrolledToBottom}
                style={{ opacity: hasScrolledToBottom ? 1 : 0.45, cursor: hasScrolledToBottom ? 'pointer' : 'not-allowed' }}
                onClick={() => {
                  setPrivacyAgreed(true);
                  setPrivacyError(false);
                  setShowTermsModal(false);
                  setHasScrolledToBottom(false);
                }}
              >
                I Understand & Agree
              </button>
            </div>
          </div>
        </div>
      )}

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
        isOpen={submitting}
        title="Submitting Application"
        subtitle="Uploading your resume and application details..."
      />

      <LoadingScreen
        isOpen={isLoggingOut}
        title="Signing Out"
        subtitle="Clearing your candidate session..."
      />

      {/* Global Card Toast Notifications */}
      <ToastPortal />
    </div>
  );
};

export default Vacancy;

