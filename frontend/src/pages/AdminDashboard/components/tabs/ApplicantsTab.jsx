import React, { useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import ApplicantDrawer from '../modals/ApplicantDrawer';

const PAGE_SIZE = 10;

const ApplicantsTab = () => {
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({
    total: 0, pending: 0, review_required: 0, rejected: 0, passed_initial: 0, new_today: 0
  });
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerApp, setDrawerApp] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // Default to 'pending' (Inbox Queue mode)
  const [sortBy, setSortBy] = useState('score_desc'); // 'score_desc' | 'score_asc' | 'newest' | 'oldest'
  const [currentPage, setCurrentPage] = useState(1);

  // Get admin identity for audit logging
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('hiring_user') || '{}'); } catch { return {}; }
  })();
  const actorId = adminUser?.id || adminUser?.User_ID || 1;
  const actorName = (adminUser?.first_name || adminUser?.User_Fname)
    ? `${adminUser.first_name || adminUser.User_Fname} ${adminUser.last_name || adminUser.User_Lname}`.trim()
    : (adminUser?.email || adminUser?.User_Email || 'Admin');

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchApplications();
    setCurrentPage(1);
  }, [search, positionFilter, statusFilter, sortBy]);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric'
  });

  const fetchJobs = async () => {
    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/jobs/get_jobs.php');
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to load jobs list:", err);
    }
  };

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        search: search,
        job_id: positionFilter,
        status: statusFilter,
        sort: sortBy
      });

      const response = await fetch(`http://localhost/Hiring%20System/backend/applications/get_applications.php?${queryParams.toString()}`);
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setApplications(data.applications || []);
        if (data.stats) {
          setStats(data.stats);
        }

        // Keep the drawer details updated if it's currently open
        if (drawerApp) {
          const updatedApp = (data.applications || []).find(a => a.id === drawerApp.id);
          if (updatedApp) {
            setDrawerApp(updatedApp);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch applications details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Status update single application
  const handleUpdateStatus = async (appId, newStatus, customToastMessage = null) => {
    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/applications/update_status.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appId, status: newStatus, actor_id: actorId, actor_name: actorName })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        if (drawerApp && drawerApp.id === appId) {
          setDrawerApp(null);
        }
        fetchApplications();
        if (customToastMessage) {
          showToast(customToastMessage, 'success');
        }
      } else {
        setModalConfig({
          type: 'alert',
          title: 'Update Failed',
          message: data.message || "Failed to update candidate status."
        });
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handlePassInitial = (appId) => {
    handleUpdateStatus(appId, 'PASSED INITIAL', 'Screening passed. Candidate moved to the interview queue.');
  };

  const confirmPass = (app) => {
    const candidateName = app ? (app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'this applicant') : 'this applicant';
    setModalConfig({
      type: 'confirm',
      confirmType: 'pass',
      title: 'Confirm Pass Initial Screening',
      message: `Are you sure you want to pass ${candidateName} through initial screening?`,
      onConfirm: () => {
        handlePassInitial(app.id);
        setModalConfig(null);
      }
    });
  };

  const confirmReject = (app) => {
    const candidateName = app ? (app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'this applicant') : 'this applicant';
    setModalConfig({
      type: 'confirm',
      confirmType: 'reject',
      title: 'Confirm Application Rejection',
      message: `Are you sure you want to reject ${candidateName}?`,
      onConfirm: () => {
        handleUpdateStatus(app.id, 'SCREENING_REJECTED');
        setModalConfig(null);
      }
    });
  };

  const confirmArchive = (app) => {
    const candidateName = app ? (app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'this applicant') : 'this applicant';
    setModalConfig({
      type: 'confirm',
      confirmType: 'archive',
      title: 'Confirm Candidate Archiving',
      message: `Are you sure you want to move ${candidateName}'s record into Application Audit Records?`,
      onConfirm: () => {
        handleUpdateStatus(app.id, 'Archived');
        setModalConfig(null);
      }
    });
  };

  // Pagination calculation
  const totalRecords = applications.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedApplications = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return applications.slice(startIndex, startIndex + PAGE_SIZE);
  }, [applications, safeCurrentPage]);

  return (
    <>
      {/* Header Title Section */}
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-header-title">Resume Screening</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            Review, evaluate, and transition candidate resumes through recruitment evaluation stages.
          </p>
        </div>
        <div style={{ color: '#64748b', fontSize: '13.5px', fontWeight: '600', background: '#ffffff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <i className='bx bx-calendar' style={{ marginRight: '6px' }}></i>{formattedDate}
        </div>
      </div>

      {/* Stats / Summary Cards (Interactive and Synced with Filter) */}
      <div className="admin-stats-grid" style={{ marginBottom: '20px' }}>
        <div
          className="admin-stat-card"
          onClick={() => setStatusFilter('')}
          style={{
            cursor: 'pointer',
            border: statusFilter === '' ? '2px solid #6366f1' : '1px solid rgba(226, 232, 240, 0.8)',
            background: statusFilter === '' ? '#f5f7ff' : '#ffffff',
            transition: 'all 0.18s ease'
          }}
          title="Filter by All Evaluation Statuses"
        >
          <span className="admin-stat-label">All Evaluation Statuses</span>
          <span className="admin-stat-value" style={{ color: '#0f172a' }}>{stats.total}</span>
          <span className="admin-stat-subtext success">↑ {stats.new_today || 0} new today</span>
        </div>

        <div
          className="admin-stat-card"
          onClick={() => setStatusFilter('pending')}
          style={{
            cursor: 'pointer',
            border: statusFilter === 'pending' ? '2px solid #f59e0b' : '1px solid rgba(226, 232, 240, 0.8)',
            background: statusFilter === 'pending' ? '#fffbeb' : '#ffffff',
            transition: 'all 0.18s ease'
          }}
          title="Filter by Pending Evaluation"
        >
          <span className="admin-stat-label">Pending Evaluation</span>
          <span className="admin-stat-value" style={{ color: '#f59e0b' }}>{stats.pending ?? stats.review_required ?? 0}</span>
          <span className="admin-stat-subtext" style={{ color: '#d97706', fontWeight: 600 }}>Action required</span>
        </div>

        <div
          className="admin-stat-card"
          onClick={() => setStatusFilter('passed_initial')}
          style={{
            cursor: 'pointer',
            border: statusFilter === 'passed_initial' ? '2px solid #10b981' : '1px solid rgba(226, 232, 240, 0.8)',
            background: statusFilter === 'passed_initial' ? '#f0fdf4' : '#ffffff',
            transition: 'all 0.18s ease'
          }}
          title="Filter by Passed Initial"
        >
          <span className="admin-stat-label">Passed Initial</span>
          <span className="admin-stat-value" style={{ color: '#10b981' }}>{stats.passed_initial || 0}</span>
          <span className="admin-stat-subtext success">Pushed to scheduling</span>
        </div>

        <div
          className="admin-stat-card"
          onClick={() => setStatusFilter('rejected')}
          style={{
            cursor: 'pointer',
            border: statusFilter === 'rejected' ? '2px solid #ef4444' : '1px solid rgba(226, 232, 240, 0.8)',
            background: statusFilter === 'rejected' ? '#fef2f2' : '#ffffff',
            transition: 'all 0.18s ease'
          }}
          title="Filter by Rejected"
        >
          <span className="admin-stat-label">Rejected</span>
          <span className="admin-stat-value" style={{ color: '#ef4444' }}>{stats.rejected}</span>
          <span className="admin-stat-subtext" style={{ color: '#ef4444' }}>Archived applications</span>
        </div>
      </div>

      {/* Filters Bar: Clean, Aligned Search and Filter Dropdowns */}
      <div className="admin-filters-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Search Input on the Left */}
        <div className="admin-search-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 260px', maxWidth: '360px' }}>
          <i className='bx bx-search' style={{ position: 'absolute', left: '12px', fontSize: '18px', color: '#94a3b8', pointerEvents: 'none' }}></i>
          <input
            type="text"
            placeholder="Search applicants by name or email..."
            className="admin-search-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Controls Aligned on the Right */}
        <div className="admin-filter-group" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Position Filter */}
          <select
            className="admin-filter-select"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            title="Filter by Position"
          >
            <option value="">All Positions</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>

          {/* Synced Evaluation Status Filter */}
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontWeight: '600' }}
            title="Filter by Evaluation Status"
          >
            <option value="">All Evaluation Statuses</option>
            <option value="pending">Pending Evaluation</option>
            <option value="passed_initial">Passed Initial</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Dedicated Sort Dropdown */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <i className="bx bx-sort-alt-2" style={{ position: 'absolute', left: '10px', fontSize: '16px', color: '#6366f1', pointerEvents: 'none' }}></i>
            <select
              className="admin-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ paddingLeft: '32px', fontWeight: '600', color: '#1e293b' }}
              title="Sort Applications"
            >
              <option value="score_desc">Highest Match Score</option>
              <option value="score_asc">Lowest Match Score</option>
              <option value="newest">Newest Applications</option>
              <option value="oldest">Oldest Applications</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications Data Table */}
      <div className="admin-table-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div className="spinner" style={{ width: '44px', height: '44px', margin: '0 auto' }}></div>
            <p style={{ marginTop: '14px', color: '#64748b' }}>Refreshing candidate applications...</p>
          </div>
        ) : applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>No candidate applications match the selected filtering criteria.</p>
          </div>
        ) : (
          <>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Applied Position</th>
                  <th style={{ textAlign: 'center' }}>Match Score</th>
                  <th>Evaluation Status</th>
                  <th>Application Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedApplications.map((app) => {
                  let badgeClass = 'admin-status-badge ';
                  let statusLabel = app.status;

                  if (app.status === 'PASSED INITIAL') {
                    badgeClass += 'passed-initial';
                    statusLabel = 'PASSED INITIAL';
                  } else if (app.status === 'Passed Final Interview' || app.status === 'PASSED FINAL INTERVIEW') {
                    badgeClass += 'passed-initial';
                    statusLabel = 'PASSED FINAL INTERVIEW';
                  } else if (app.status === 'Passed Final Approval' || app.status === 'PASSED FINAL APPROVAL' || app.status === 'HIRED') {
                    badgeClass += 'confirmed';
                    statusLabel = 'PASSED FINAL APPROVAL (HIRED)';
                  } else if (app.status === 'Failed Final Interview' || app.status === 'FAILED FINAL INTERVIEW' || app.status === 'INTERVIEW_FAILED') {
                    badgeClass += 'rejected';
                    statusLabel = 'FAILED FINAL INTERVIEW';
                  } else if (app.status === 'Failed Final Approval' || app.status === 'FAILED FINAL APPROVAL') {
                    badgeClass += 'unresponsive';
                    statusLabel = 'FAILED FINAL APPROVAL';
                  } else if (app.status === 'Candidate Withdrew' || app.status === 'CANDIDATE WITHDREW' || app.status === 'CANDIDATE_WITHDREW') {
                    badgeClass += 'unresponsive';
                    statusLabel = 'CANDIDATE WITHDREW';
                  } else if (app.status === 'Incomplete Requirements' || app.status === 'INCOMPLETE REQUIREMENTS' || app.status === 'INCOMPLETE_REQUIREMENTS') {
                    badgeClass += 'rejected';
                    statusLabel = 'INCOMPLETE REQUIREMENTS';
                  } else if (app.status === 'Failed Pre-Employment' || app.status === 'FAILED PRE-EMPLOYMENT' || app.status === 'FAILED_PRE_EMPLOYMENT') {
                    badgeClass += 'rejected';
                    statusLabel = 'FAILED PRE-EMPLOYMENT';
                  } else if (app.status === 'CONFIRMED' || app.status === 'INTERVIEW_SCHEDULED') {
                    badgeClass += 'confirmed';
                    statusLabel = 'CONFIRMED SCHEDULE';
                  } else if (app.status === 'DECLINED - UNRESPONSIVE') {
                    badgeClass += 'unresponsive';
                    statusLabel = 'DECLINED - UNRESPONSIVE';
                  } else if (app.status === 'pending' || app.status === 'review_required') {
                    badgeClass += 'pending';
                    statusLabel = 'PENDING REVIEW';
                  } else if (app.status === 'SCREENING_REJECTED' || app.status === 'rejected') {
                    badgeClass += 'rejected';
                    statusLabel = 'REJECTED';
                  } else if (app.status === 'Archived' || app.status === 'ARCHIVED') {
                    badgeClass += 'unresponsive';
                    statusLabel = 'ARCHIVED RECORD';
                  }

                  // Extract candidate name from parsed AI resume summary if available
                  let resumeName = null;
                  if (app.ai_summary && app.ai_summary.trim().startsWith('{')) {
                    try {
                      const parsedAi = JSON.parse(app.ai_summary);
                      if (parsedAi?.applicant_info?.name && parsedAi.applicant_info.name.trim()) {
                        resumeName = parsedAi.applicant_info.name.trim();
                      }
                    } catch (e) { /* ignore parse error */ }
                  }

                  const displayName = resumeName || app.candidate_name || `${app.User_Fname} ${app.User_Lname}`;
                  const isHired = ['HIRED', 'Hired', 'hired', 'PASSED', 'HIRED / PASSED'].includes(app.status);
                  const rawScore = app.ai_match_score !== null && app.ai_match_score !== undefined ? Number(app.ai_match_score) : null;
                  const scoreValue = rawScore !== null && !isNaN(rawScore) ? (rawScore <= 1 && rawScore > 0 ? Math.round(rawScore * 100) : Math.round(rawScore)) : null;

                  return (
                    <tr key={app.id} className={!app.viewed ? 'admin-row-unread' : ''}>
                      <td>
                        <div className="admin-candidate-cell">
                          <span className="admin-candidate-name">
                            {displayName}
                            {!app.viewed && <span className="admin-unread-dot" title="New Application"></span>}
                          </span>
                        </div>
                      </td>
                      <td><strong>{app.job_title}</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        {scoreValue !== null ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '800',
                            fontFamily: 'Montserrat, sans-serif',
                            background: scoreValue >= 80 ? '#ecfdf5' : (scoreValue >= 50 ? '#fffbeb' : '#fef2f2'),
                            color: scoreValue >= 80 ? '#059669' : (scoreValue >= 50 ? '#b45309' : '#dc2626'),
                            border: `1px solid ${scoreValue >= 80 ? '#a7f3d0' : (scoreValue >= 50 ? '#fde68a' : '#fecaca')}`
                          }}>
                            <i className='bx bx-brain' style={{ fontSize: '13px' }}></i>
                            {scoreValue}%
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>Pending</span>
                        )}
                      </td>
                      <td>
                        <span className={badgeClass}>
                          {statusLabel}
                        </span>
                      </td>
                      <td>
                        {new Date(app.applied_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                      <td>
                        <div className="admin-actions-cell" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className="admin-action-btn"
                            title="View Details in Drawer"
                            onClick={() => {
                              setDrawerApp(app);
                              if (!app.viewed) {
                                fetch('http://localhost/Hiring%20System/backend/applications/mark_viewed.php', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: app.id })
                                });
                                setApplications(applications.map(a => a.id === app.id ? { ...a, viewed: 1 } : a));
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          </button>

                          {isHired && (
                            <button
                              className="admin-action-btn"
                              title="Archive Record"
                              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
                              onClick={() => confirmArchive(app)}
                            >
                              <i className='bx bx-archive-in' style={{ fontSize: '15px' }}></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Standard Pagination Footer (Always Visible) */}
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
                Showing Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong> ({totalRecords} total records)
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: safeCurrentPage <= 1 ? '#f8fafc' : '#ffffff',
                    color: safeCurrentPage <= 1 ? '#94a3b8' : '#334155',
                    cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  &lt; Previous
                </button>

                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      border: safeCurrentPage === p ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                      background: safeCurrentPage === p ? '#0f172a' : '#ffffff',
                      color: safeCurrentPage === p ? '#ffffff' : '#334155',
                      fontWeight: safeCurrentPage === p ? '700' : '500',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: safeCurrentPage >= totalPages ? '#f8fafc' : '#ffffff',
                    color: safeCurrentPage >= totalPages ? '#94a3b8' : '#334155',
                    cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
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
          </>
        )}
      </div>

      <ApplicantDrawer
        drawerApp={drawerApp}
        setDrawerApp={setDrawerApp}
        handleUpdateStatus={handleUpdateStatus}
        confirmPass={confirmPass}
        confirmReject={confirmReject}
        confirmArchive={confirmArchive}
      />

      {/* Toast Notification Banner */}
      {toast && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: toast.type === 'error' ? '#991b1b' : '#047857',
            border: toast.type === 'error' ? '1.5px solid #fca5a5' : '1.5px solid #a7f3d0',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '13.5px',
            fontWeight: '700',
            fontFamily: "'Inter', sans-serif",
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            pointerEvents: 'none'
          }}
        >
          <i className={`bx ${toast.type === 'error' ? 'bx-error-circle' : 'bx-check-circle'}`} style={{ fontSize: '20px' }}></i>
          <span>{toast.message}</span>
        </div>,
        document.body
      )}

      {/* Custom Modal */}
      {modalConfig && ReactDOM.createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="admin-modal-card" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '420px', maxWidth: '92%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#1e293b' }}>{modalConfig.title}</h3>
            <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5', margin: '16px 0' }}>{modalConfig.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              {modalConfig.type === 'confirm' && (
                <button
                  onClick={() => setModalConfig(null)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: '500' }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  if (modalConfig.onConfirm) modalConfig.onConfirm();
                  if (modalConfig.type === 'alert') setModalConfig(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: modalConfig.confirmType === 'pass' ? '#10b981' : (modalConfig.confirmType === 'reject' || modalConfig.type === 'confirm' ? '#ef4444' : '#3b82f6'),
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {modalConfig.type === 'confirm' ? (modalConfig.confirmType === 'pass' ? 'Pass Applicant' : 'Confirm Rejection') : 'OK'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ApplicantsTab;
