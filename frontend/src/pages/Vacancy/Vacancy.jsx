import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ApplicantNavbar from '../../components/ApplicantNavbar/ApplicantNavbar';
import ChatbotWidget from '../../components/ChatbotWidget/ChatbotWidget';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import Footer from '../../components/Footer/Footer';
import './Vacancy.css';

const Vacancy = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // States
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  
  // Auth user state
  const [user, setUser] = useState(null);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [appliedJobsMap, setAppliedJobsMap] = useState({});
  const [hasActiveApp, setHasActiveApp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  // Navbar states
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    document.title = 'Job Vacancies - Airship Express';

    // Retrieve active user if any
    const savedUser = localStorage.getItem('hiring_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setFullName(`${parsedUser.first_name} ${parsedUser.last_name}`);
      setEmail(parsedUser.email);
    }

    // Fetch jobs from backend
    fetchJobs();
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchAppliedJobs();
    }
  }, [user]);

  const fetchAppliedJobs = async () => {
    try {
      const response = await fetch(`http://localhost/Hiring%20System/backend/applications/get_user_applied_jobs.php?user_id=${user.id}`);
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setAppliedJobs(data.job_ids);
        setAppliedJobsMap(data.applied_jobs_map || {});
        setHasActiveApp(data.has_active_application);
      }
    } catch (err) {
      console.error("Failed to fetch applied jobs:", err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`http://localhost/Hiring%20System/backend/notifications/get_notifications.php?user_id=${user.id}`);
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
        await fetch('http://localhost/Hiring%20System/backend/notifications/mark_read.php', {
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

  // Click outside listener for dropdowns
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const fetchJobs = async () => {
    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/jobs/get_jobs.php?active_only=true');
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setJobs(data.jobs);
        if (data.jobs.length > 0) {
          setSelectedJob(null);
        }
      }
    } catch (err) {
      console.error('Failed to load vacancies:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleApplyClick = () => {
    if (!user) {
      // Redirect to login if unauthenticated
      navigate('/login');
      return;
    }
    // Open apply modal
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setSubmitError('Invalid file. Please upload a valid PDF resume under 5MB.');
        setResumeFile(null);
        e.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError('Invalid file. Please upload a valid PDF resume under 5MB.');
        setResumeFile(null);
        e.target.value = '';
        return;
      }
      setResumeFile(file);
      setSubmitError('');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!resumeFile) {
      setSubmitError('Please upload your resume in PDF format.');
      setIsParseError(false);
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

    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/applications/apply.php', {
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
          message: 'Invalid resume format detected. Please upload a standard resume or download our template to guarantee compatibility.',
          confirmText: 'Download Template',
          cancelText: 'Close',
          type: 'primary',
          onConfirm: () => {
            const link = document.createElement('a');
            link.href = '/RESUME TEMPLATE.pdf';
            link.download = 'RESUME TEMPLATE.pdf';
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
    setIsModalOpen(false);
    setResumeFile(null);
    setSubmitError('');
    setIsParseError(false);
    setSubmitSuccess(false);
    setAiScore(null);
    setPrivacyAgreed(false);
    setPrivacyError(false);
    setIsDraggingOver(false);
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
        <div className="loading-container"><div className="spinner"></div></div>
      ) : (
        <div className={`vacancy-dynamic-layout ${selectedJob ? 'has-expanded' : ''}`}>
          {selectedJob && (
            <div className="vacancy-expanded-card">
              <button className="vacancy-close-expanded" onClick={() => setSelectedJob(null)} aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>

              <div className="vacancy-expanded-inner">
                <div className="vacancy-expanded-image">
                  <img src={selectedJob.image_path ? `http://localhost/Hiring%20System/backend/${selectedJob.image_path}` : "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80"} alt="Job Role" style={{objectFit: 'cover'}} />
                  <div className="vacancy-expanded-title-box">
                    <h2>{selectedJob.title}</h2>
                    <p>Available: {selectedJob.availability}</p>
                  </div>
                </div>

                <div className="vacancy-expanded-details">
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

                    if (jobStatus) {
                      disabled = true;
                      const isRejected = ['rejected', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE'].includes(jobStatus);
                      const isHired = ['HIRED', 'Hired', 'hired', 'PASSED', 'HIRED / PASSED'].includes(jobStatus);

                      if (isHired) {
                        btnText = 'Application Accepted';
                        btnStyle = {
                          width: '100%',
                          padding: '12px 20px',
                          borderRadius: '8px',
                          fontSize: '13.5px',
                          fontWeight: '700',
                          fontFamily: "'Montserrat', sans-serif",
                          background: '#f1f5f9',
                          color: '#047857',
                          cursor: 'not-allowed',
                          border: '1px solid #a7f3d0'
                        };
                      } else if (isRejected) {
                        btnText = 'Application Concluded';
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
                        btnText = 'Under Review';
                        btnStyle = {
                          width: '100%',
                          padding: '12px 20px',
                          borderRadius: '8px',
                          fontSize: '13.5px',
                          fontWeight: '700',
                          fontFamily: "'Montserrat', sans-serif",
                          background: '#f1f5f9',
                          color: '#0f172a',
                          cursor: 'not-allowed',
                          border: '1px solid #94a3b8'
                        };
                      }
                    } else if (hasActiveApp) {
                      disabled = true;
                      btnText = 'Application Pending';
                      btnStyle = {
                        width: '100%',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        fontFamily: "'Montserrat', sans-serif",
                        background: '#f1f5f9',
                        color: '#475569',
                        cursor: 'not-allowed',
                        border: '1px solid #cbd5e1'
                      };
                    }

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
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className={`vacancy-cards-grid ${selectedJob ? 'sidebar-mode' : ''}`}>
            {jobs.filter(job => job.id !== selectedJob?.id).map((job) => (
              <div
                key={job.id}
                className="vacancy-job-card"
                onClick={() => setSelectedJob(job)}
              >
                <img src={job.image_path ? `http://localhost/Hiring%20System/backend/${job.image_path}` : "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400&q=80"} alt={job.title} className="vacancy-card-img" style={{objectFit: 'cover'}} />
                <div className="vacancy-card-body">
                  <h4 className="vacancy-card-title">{job.title}</h4>
                  <p className="vacancy-card-avail">Available: {job.availability}</p>
                  <span className="vacancy-card-link">View Details</span>
                </div>
              </div>
            ))}
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
                      className="vacancy-form-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="vacancy-form-group">
                    <label className="vacancy-form-label">Email Address</label>
                    <input
                      type="email"
                      className="vacancy-form-input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="vacancy-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="vacancy-form-label" style={{ marginBottom: 0 }}>Resume (PDF format)</label>
                      <a 
                        href="/RESUME TEMPLATE.pdf" 
                        download 
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
                        Download Standard Template
                      </a>
                    </div>

                    {!resumeFile ? (
                      <div
                        className={`vacancy-file-upload-container ${isDraggingOver ? 'is-dragging' : ''}`}
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
                            const file = e.dataTransfer.files[0];
                            if (file.type !== 'application/pdf') {
                              setSubmitError('Invalid file. Please upload a valid PDF resume under 5MB.');
                              setResumeFile(null);
                              return;
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              setSubmitError('Invalid file. Please upload a valid PDF resume under 5MB.');
                              setResumeFile(null);
                              return;
                            }
                            setResumeFile(file);
                            setSubmitError('');
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
                          onClick={() => setResumeFile(null)}
                          aria-label="Remove file"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
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
                    disabled={!resumeFile || submitting}
                  >
                    {submitting ? 'Submitting Application...' : 'Submit Application'}
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

export default Vacancy;

