import React, { useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import ApplicantDrawer from '../modals/ApplicantDrawer';
import LoadingScreen from '../../../../components/LoadingScreen/LoadingScreen';
import { TableSkeleton } from '../../../../components/Loading';
import { useToast } from '../../../../components/Toast/Toast';

import { API_BASE_URL } from '../../../../utils/apiConfig';
const PAGE_SIZE = 10;

const ApplicantsTab = ({ showToast: externalShowToast }) => {
  const { showToast: localShowToast, ToastPortal } = useToast();
  const triggerToast = externalShowToast || localShowToast;

  const [applications, setApplications] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [stats, setStats] = useState({
    total: 0, pending: 0, review_required: 0, rejected: 0, passed_initial: 0, new_today: 0
  });
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerApp, setDrawerApp] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);
  const [loadingScreenState, setLoadingScreenState] = useState({
    isOpen: false,
    title: 'Processing Request...',
    subtitle: 'Please wait while the system completes your request.'
  });

  const showToast = (message, type = 'success') => {
    triggerToast(message, type);
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
  const rawActorName = (adminUser?.first_name || adminUser?.User_Fname)
    ? `${adminUser.first_name || adminUser.User_Fname} ${adminUser.last_name || adminUser.User_Lname}`.trim()
    : (adminUser?.email || adminUser?.User_Email || 'Admin');
  const actorName = rawActorName.toLowerCase().startsWith('hr admin') || rawActorName.toLowerCase().startsWith('super admin')
    ? rawActorName
    : `${adminUser?.is_admin === 3 ? 'Super Admin' : 'HR Admin'} ${rawActorName}`;

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
      const response = await fetch(`${API_BASE_URL}/jobs/get_jobs.php`);
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
    setFetchError(null);
    try {
      const queryParams = new URLSearchParams({
        search: search,
        job_id: positionFilter,
        status: statusFilter,
        sort: sortBy
      });

      const response = await fetch(`${API_BASE_URL}/applications/get_applications.php?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
      });
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const data = await response.json();
      if (data.status === 'success') {
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
      } else {
        throw new Error(data.message || 'Failed to retrieve candidate applications.');
      }
    } catch (err) {
      console.error("Failed to fetch applications details:", err);
      setFetchError(err.message || 'Database connection error while retrieving applicants.');
    } finally {
      setLoading(false);
    }
  };

  // Status update single application (supports optional remarks)
  const handleUpdateStatus = async (appId, newStatus, customToastMessage = null, remarks = '') => {
    try {
      const response = await fetch(`${API_BASE_URL}/applications/update_status.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({ id: appId, status: newStatus, actor_id: actorId, actor_name: actorName, remarks })
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        if (drawerApp && drawerApp.id === appId) {
          setDrawerApp(null);
        }
        fetchApplications();
        if (customToastMessage) {
          showToast(customToastMessage, 'success');
        } else if (data.message) {
          showToast(data.message, 'success');
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

  const handlePassInitial = (appId, remarks = '', customName = '') => {
    const candidateName = customName || drawerApp?.candidate_name || 'Candidate';
    handleUpdateStatus(appId, 'PASSED INITIAL', `Screening Passed. ${candidateName} moved to Interview Scheduling.`, remarks);
  };

  const confirmPass = (app) => {
    setDrawerApp(null);
    const candidateName = app ? (app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'Candidate') : 'Candidate';
    setModalConfig({
      type: 'confirm',
      confirmType: 'pass',
      title: 'Confirm Pass Initial Screening',
      message: `Are you sure you want to pass ${candidateName}? They will be moved to the interview scheduling queue.`,
      onConfirm: async () => {
        setModalConfig(null); // Close the confirm modal first
        setLoadingScreenState({
          isOpen: true,
          title: 'Passing Initial Screening...',
          subtitle: 'Updating status and moving candidate to interview queue...'
        });
        try {
          await handleUpdateStatus(app.id, 'PASSED INITIAL', `Screening Passed. ${candidateName} moved to Interview Scheduling.`);
        } finally {
          setLoadingScreenState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const confirmReject = (app) => {
    setDrawerApp(null);
    const candidateName = app ? (app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'Candidate') : 'Candidate';
    setModalConfig({
      type: 'confirm',
      confirmType: 'reject',
      title: 'Confirm Reject Initial Screening',
      message: `Are you sure you want to reject ${candidateName}? This will update their status to Screening Rejected and notify the applicant.`,
      onConfirm: async () => {
        setModalConfig(null);
        setLoadingScreenState({
          isOpen: true,
          title: 'Rejecting Candidate...',
          subtitle: 'Updating status and sending email notification...'
        });
        try {
          await handleUpdateStatus(app.id, 'SCREENING_REJECTED', `Screening Rejected. ${candidateName}.`, '');
        } finally {
          setLoadingScreenState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const confirmArchive = (app) => {
    const candidateName = app ? (app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'Candidate') : 'Candidate';
    setModalConfig({
      type: 'confirm',
      confirmType: 'archive',
      title: 'Confirm Candidate Archiving',
      message: `Are you sure you want to move ${candidateName}'s record into Application Audit Records?`,
      onConfirm: () => {
        handleUpdateStatus(app.id, 'Archived', `Candidate Archived. ${candidateName}.`);
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
            placeholder="Search applicants by name, email, or contact #..."
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
          <TableSkeleton
            columns={[
              'Candidate Name',
              'Contact Details',
              'Applied Position',
              'Match Score',
              'Evaluation Status',
              'Applied Date',
              'Actions'
            ]}
            columnTypes={[
              'avatar',
              'text-with-subtitle',
              'text',
              'text',
              'status',
              'date',
              'actions'
            ]}
            rows={5}
          />
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: '#64748b' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: '1px solid #e2e8f0'
            }}>
              <i className="bx bx-user-x" style={{ fontSize: '28px', color: '#94a3b8' }}></i>
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>No Candidate Applications Found</h4>
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {search
                ? `No candidates match "${search}". Try checking for spelling or clear your search query.`
                : 'No candidate applications match the selected filtering criteria.'}
            </p>
          </div>
        ) : applications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: '#64748b' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              border: '1px solid #e2e8f0'
            }}>
              <i className="bx bx-user-x" style={{ fontSize: '28px', color: '#94a3b8' }}></i>
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>No Candidate Applications Found</h4>
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {search
                ? `No candidates match "${search}". Try checking for spelling or clear your search query.`
                : 'No candidate applications match the selected filtering criteria.'}
            </p>
          </div>
        ) : (
          <>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Contact Details</th>
                  <th>Applied Position</th>
                  <th style={{ textAlign: 'center' }}>Match Score</th>
                  <th>Evaluation Status</th>
                  <th>Applied Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedApplications.map((app) => {
                  let badgeClass = 'admin-status-badge ';
                  let statusLabel = app.status;

                  if (app.status === 'PASSED INITIAL' || app.status === 'PASSED INITIAL SCREENING' || app.status === 'PENDING SCHEDULED' || app.status === 'PENDING SCHEDULE') {
                    badgeClass += 'passed-initial';
                    statusLabel = 'PASSED INITIAL SCREENING';
                  } else if (app.status === 'Passed Final Interview' || app.status === 'PASSED FINAL INTERVIEW') {
                    badgeClass += 'passed-initial';
                    statusLabel = 'PASSED FINAL INTERVIEW';
                  } else if (['Approved for Job Offer', 'APPROVED FOR JOB OFFER', 'President Approved', 'PRESIDENT APPROVED'].includes(app.status)) {
                    badgeClass += 'confirmed';
                    statusLabel = 'APPROVED FOR JOB OFFER';
                  } else if (['Job Offer Pending', 'JOB OFFER PENDING', 'Offer Extended', 'OFFER EXTENDED'].includes(app.status)) {
                    badgeClass += 'pending';
                    statusLabel = 'JOB OFFER PENDING';
                  } else if (['Job Offer Accepted', 'JOB OFFER ACCEPTED', 'Offer Accepted', 'OFFER ACCEPTED'].includes(app.status)) {
                    badgeClass += 'confirmed';
                    statusLabel = 'JOB OFFER ACCEPTED';
                  } else if (['Job Offer Declined', 'JOB OFFER DECLINED', 'Offer Declined', 'OFFER DECLINED'].includes(app.status)) {
                    badgeClass += 'rejected';
                    statusLabel = 'JOB OFFER DECLINED';
                  } else if (['Contract Signing Scheduled', 'CONTRACT SIGNING SCHEDULED'].includes(app.status)) {
                    badgeClass += 'confirmed';
                    statusLabel = 'CONTRACT SIGNING SCHEDULED';
                  } else if (['Officially Hired', 'OFFICIALLY HIRED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED'].includes(app.status)) {
                    badgeClass += 'confirmed';
                    statusLabel = 'OFFICIALLY HIRED';
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
                  } else if (app.status === 'CONFIRMED' || app.status === 'INTERVIEW_SCHEDULED' || app.status === 'CONFIRMED SCHEDULE') {
                    badgeClass += 'confirmed';
                    statusLabel = 'CONFIRMED SCHEDULE';
                  } else if (app.status === 'PENDING SCHEDULED' || app.status === 'PENDING SCHEDULE') {
                    badgeClass += 'pending';
                    statusLabel = 'PENDING SCHEDULE';
                  } else if (app.status === 'RESCHEDULING' || app.status === 'RESCHEDULING REQUESTED' || app.status === 'RESCHEDULE_REQUESTED') {
                    badgeClass += 'pending';
                    statusLabel = 'RESCHEDULING REQUESTED';
                  } else if (app.status === 'DECLINED - UNRESPONSIVE' || app.status === 'SCHEDULING EXPIRED' || app.status === 'SCHEDULING_EXPIRED' || app.status === 'UNRESPONSIVE') {
                    badgeClass += 'unresponsive';
                    statusLabel = 'SCHEDULING EXPIRED';
                  } else if (app.status === 'pending' || app.status === 'review_required') {
                    badgeClass += 'pending';
                    statusLabel = 'PENDING REVIEW';
                  } else if (app.status === 'SCREENING_REJECTED' || app.status === 'rejected') {
                    badgeClass += 'rejected';
                    statusLabel = 'SCREENING REJECTED';
                  } else if (app.status === 'Archived' || app.status === 'ARCHIVED') {
                    badgeClass += 'unresponsive';
                    statusLabel = 'ARCHIVED RECORD';
                  }

                  const displayName = app.candidate_name || `${app.User_Fname} ${app.User_Lname}`;
                  const isHired = ['HIRED', 'Hired', 'hired', 'PASSED', 'HIRED / PASSED'].includes(app.status);
                  const rawScore = app.ai_match_score !== null && app.ai_match_score !== undefined ? Number(app.ai_match_score) : null;
                  const scoreValue = rawScore !== null && !isNaN(rawScore) ? (rawScore <= 1 && rawScore > 0 ? Math.round(rawScore * 100) : Math.round(rawScore)) : null;

                  return (
                    <tr key={app.id} className={!app.viewed ? 'admin-row-unread' : ''}>
                      <td>
                        <div className="admin-candidate-cell">
                          <span className="admin-candidate-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {displayName}
                            {!app.viewed && <span className="admin-unread-dot" title="New Application"></span>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {(app.candidate_email || app.User_Email) ? (
                            <span style={{ fontSize: '12px', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <i className='bx bx-envelope' style={{ fontSize: '13px', color: '#64748b' }}></i>
                              {app.candidate_email || app.User_Email}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>No email</span>
                          )}
                          {(app.candidate_mobile || app.User_Mobile) ? (
                            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <i className='bx bx-phone' style={{ fontSize: '12px', color: '#64748b' }}></i>
                              {app.candidate_mobile || app.User_Mobile}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>No contact #</span>
                          )}
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
                                fetch(`${API_BASE_URL}/applications/mark_viewed.php`, {
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
                {modalConfig.type === 'confirm' ? (modalConfig.confirmType === 'pass' ? 'Pass Applicant' : (modalConfig.confirmType === 'archive' ? 'Archive Record' : 'Confirm Rejection')) : 'OK'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Splash Video Processing Loading Screen */}
      <LoadingScreen
        isOpen={loadingScreenState.isOpen}
        title={loadingScreenState.title}
        subtitle={loadingScreenState.subtitle}
      />

      {/* Standalone Toast Portal */}
      {!externalShowToast && <ToastPortal />}

    </>
  );
};

export default ApplicantsTab;
