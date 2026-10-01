import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import AutoScheduleModal from '../modals/AutoScheduleModal';
import ManualScheduleModal from '../modals/ManualScheduleModal';
import LoadingScreen from '../../../../components/LoadingScreen/LoadingScreen';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import { TableSkeleton, DatabaseErrorState } from '../../../../components/Loading';
import { useToast } from '../../../../components/Toast/Toast';

import { API_BASE_URL } from '../../../../utils/apiConfig';
const TABS = [
  { id: 'needs_scheduling', label: 'Pending Scheduling' },
  { id: 'active_queue',     label: 'Active Queue'       },
  { id: 'action_required',  label: 'Rescheduling'       },
];

const InterviewsTab = ({ showToast: propShowToast }) => {
  const { showToast: localShowToast, ToastPortal } = useToast();
  const showToast = propShowToast || localShowToast;

  const [agenda, setAgenda] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [autoScheduleModalOpen, setAutoScheduleModalOpen] = useState(false);
  const [manualScheduleTarget, setManualScheduleTarget] = useState(null);
  const [viewRescheduleTarget, setViewRescheduleTarget] = useState(null);
  const [confirmingReschedule, setConfirmingReschedule] = useState(false);
  const [selectedRescheduleIds, setSelectedRescheduleIds] = useState([]);

  const notify = (msg, type = 'success') => {
    showToast(msg, type);
  };

  const handleConfirmReschedule = async (item) => {
    setConfirmingReschedule(true);
    try {
      const res = await fetch(`${API_BASE_URL}/interviews/confirm_reschedule.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: item.application_id,
          actor_id: actorId,
          actor_name: actorName,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        const candidateName = item.candidate_name || `${item.User_Fname || ''} ${item.User_Lname || ''}`.trim() || data.candidate_name || 'Candidate';
        setViewRescheduleTarget(null);
        setSelectedRescheduleIds(prev => prev.filter(id => id !== item.application_id));
        notify(data.message || `Reschedule Confirmed. ${candidateName}.`, 'success');
        fetchAgenda();
      } else {
        notify(data.message || 'Failed to confirm reschedule.', 'danger');
      }
    } catch (err) {
      console.error('Confirm reschedule error:', err);
      notify('An error occurred. Please try again.', 'danger');
    } finally {
      setConfirmingReschedule(false);
    }
  };

  const handleBatchConfirmReschedule = async () => {
    if (selectedRescheduleIds.length === 0) return;
    const count = selectedRescheduleIds.length;
    setConfirmingReschedule(true);
    try {
      const res = await fetch(`${API_BASE_URL}/interviews/confirm_reschedule.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_ids: selectedRescheduleIds,
          actor_id: actorId,
          actor_name: actorName,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSelectedRescheduleIds([]);
        notify(data.message || `Successfully confirmed reschedule for ${count} candidates.`, 'success');
        fetchAgenda();
      } else {
        notify(data.message || 'Failed to confirm selected reschedules.', 'danger');
      }
    } catch (err) {
      console.error('Batch confirm reschedule error:', err);
      notify('An error occurred during batch reschedule confirmation.', 'danger');
    } finally {
      setConfirmingReschedule(false);
    }
  };

  const toggleSelectReschedule = (id) => {
    setSelectedRescheduleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllReschedule = (pageQueue) => {
    const validIds = pageQueue.filter(x => Boolean(x.requested_date)).map(x => x.application_id);
    const allSelected = validIds.length > 0 && validIds.every(id => selectedRescheduleIds.includes(id));
    if (allSelected) {
      setSelectedRescheduleIds(prev => prev.filter(id => !validIds.includes(id)));
    } else {
      setSelectedRescheduleIds(prev => Array.from(new Set([...prev, ...validIds])));
    }
  };

  const formatRequestedSlot = (item) => {
    if (!item?.requested_date) return 'No slot selected';
    const d = new Date(`${item.requested_date}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const timeStr = item.requested_start_time ? formatTime12h(item.requested_start_time) : '';
    const endStr = item.requested_end_time ? ` - ${formatTime12h(item.requested_end_time)}` : '';
    return `${d} (${timeStr}${endStr})`;
  };
  const [modalConfig, setModalConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('needs_scheduling');

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
    fetchAgenda(false);
    // Silent auto-refresh in background every 30 seconds so newly passed applicants appear without table flickering
    const interval = setInterval(() => {
      fetchAgenda(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAgenda = async (silent = false) => {
    if (!silent) setLoadingAgenda(true);
    if (!silent) setFetchError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/interviews/get_agenda.php`);
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const data = await response.json();
      if (data.status === 'success') {
        setAgenda(data.agenda || []);
      } else {
        throw new Error(data.message || 'Failed to retrieve interview agenda.');
      }
    } catch (err) {
      console.error("Failed to fetch agenda:", err);
      if (!silent) setFetchError(err.message || 'Database connection error while retrieving interview records.');
    } finally {
      if (!silent) setLoadingAgenda(false);
    }
  };

  const handleScheduleSuccess = (message) => {
    const cleanMsg = message || 'Interview scheduled successfully.';
    notify(cleanMsg, 'success');
    fetchAgenda();
  };

  const handleDecision = (appId, status, candidateName) => {
    const isPass = status === 'Passed Final Interview' || status === 'HIRED' || status === 'PASSED';
    const actionTitle = isPass ? 'Pass Final Interview' : 'Fail Final Interview';
    const actionMsg = isPass
      ? `Pass "${candidateName}" in the Final Interview and forward to the President for final approval?`
      : `Mark "${candidateName}" as Failed in the Final Interview?`;

    setModalConfig({
      type: 'confirm',
      confirmType: isPass ? 'pass' : 'reject',
      title: actionTitle,
      message: actionMsg,
      onConfirm: async () => {
        try {
          const targetStatus = isPass ? 'Passed Final Interview' : 'Failed Final Interview';
          const response = await fetch(`${API_BASE_URL}/applications/update_status.php`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
            },
            body: JSON.stringify({ id: appId, status: targetStatus, actor_id: actorId, actor_name: actorName })
          });
          const data = await response.json();
          if (response.ok && data.status === 'success') {
            notify(isPass ? `Final Interview Passed. ${candidateName} moved to President Review.` : `Final Interview Failed. ${candidateName}.`, isPass ? 'success' : 'warning');
            fetchAgenda();
          } else {
            notify(data.message || "Failed to update interview outcome.", 'danger');
          }
        } catch (err) {
          console.error("Error updating interview decision:", err);
          notify("Connection error while updating decision.", 'danger');
        }
        setModalConfig(null);
      }
    });
  };

  const handleMarkNoResponse = (item) => {
    const candidateName = item.candidate_name || `${item.User_Fname || ''} ${item.User_Lname || ''}`.trim();
    setModalConfig({
      type: 'confirm',
      confirmType: 'danger',
      title: 'Mark No Response',
      message: `Are you sure you want to mark "${candidateName}" as No Response? Their status will be updated to Scheduling Expired, their booked slot will be released, and an automated notification will be sent.`,
      confirmText: 'Mark No Response',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/applications/update_status.php`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
            },
            body: JSON.stringify({ id: item.application_id, status: 'SCHEDULING EXPIRED', actor_id: actorId, actor_name: actorName })
          });
          const data = await response.json();
          if (response.ok && data.status === 'success') {
            notify(data.message || `Scheduling Expired. ${candidateName}.`, 'info');
            fetchAgenda();
          } else {
            notify(data.message || "Failed to update status.", 'danger');
          }
        } catch (err) {
          console.error("Error updating scheduling expired status:", err);
          notify("Connection error while updating status.", 'danger');
        }
        setModalConfig(null);
      }
    });
  };


  const formatTime12h = (t) => {
    if (!t) return '';
    const parts = t.split(':');
    if (parts.length < 2) return t;
    const hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${minute} ${ampm}`;
  };

  const PAGE_SIZE = 10;
  const [pendingPage, setPendingPage] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [reschedulePage, setReschedulePage] = useState(1);

  const isPassedInitialStatus = (s) => ['PASSED INITIAL', 'PASSED_INITIAL', 'PASSED INITIAL SCREENING'].includes((s || '').toUpperCase());
  const pendingAutoScheduleQueue = agenda
    .filter(item => isPassedInitialStatus(item.application_status))
    .sort((a, b) => {
      const timeA = a.applied_at ? new Date(a.applied_at).getTime() : 0;
      const timeB = b.applied_at ? new Date(b.applied_at).getTime() : 0;
      return timeA - timeB; // Earliest applicant on top (First-Come, First-Served priority)
    });
  const activeQueue = agenda.filter(item => item.application_status !== 'RESCHEDULING' && !isPassedInitialStatus(item.application_status));
  const rescheduleQueue = agenda.filter(item => item.application_status === 'RESCHEDULING');

  // Tab 1: Pending Scheduling Pagination
  const totalPendingPages = Math.max(1, Math.ceil(pendingAutoScheduleQueue.length / PAGE_SIZE));
  const safePendingPage = Math.min(pendingPage, totalPendingPages);
  const paginatedPendingQueue = pendingAutoScheduleQueue.slice(
    (safePendingPage - 1) * PAGE_SIZE,
    safePendingPage * PAGE_SIZE
  );

  // Tab 2: Active Queue Pagination
  const totalActivePages = Math.max(1, Math.ceil(activeQueue.length / PAGE_SIZE));
  const safeActivePage = Math.min(activePage, totalActivePages);
  const paginatedActiveQueue = activeQueue.slice(
    (safeActivePage - 1) * PAGE_SIZE,
    safeActivePage * PAGE_SIZE
  );

  // Tab 3: Reschedule Queue Pagination
  const totalReschedulePages = Math.max(1, Math.ceil(rescheduleQueue.length / PAGE_SIZE));
  const safeReschedulePage = Math.min(reschedulePage, totalReschedulePages);
  const paginatedRescheduleQueue = rescheduleQueue.slice(
    (safeReschedulePage - 1) * PAGE_SIZE,
    safeReschedulePage * PAGE_SIZE
  );

  const tabCounts = {
    needs_scheduling: pendingAutoScheduleQueue.length,
    active_queue:     activeQueue.length,
    action_required:  rescheduleQueue.length,
  };

  // ── Reusable empty state ──
  const EmptyState = ({ icon, message }) => (
    <div style={{ padding: '52px 24px', textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ marginBottom: '12px', opacity: 0.5 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '500', color: '#64748b' }}>{message}</p>
    </div>
  );

  // ── Badge helper ──
  const StatusBadge = ({ status }) => {
    let bg = '#ffedd5', color = '#c2410c', border = '1px solid #fed7aa', text = 'PENDING SCHEDULE';
    if (status === 'CONFIRMED' || status === 'INTERVIEW_SCHEDULED') {
      bg = '#f0fdf4'; color = '#15803d'; border = '1px solid #a7f3d0'; text = 'CONFIRMED SCHEDULE';
    } else if (status === 'RESCHEDULING' || status === 'RESCHEDULING REQUESTED' || status === 'RESCHEDULE_REQUESTED') {
      bg = '#fff7ed'; color = '#b45309'; border = '1px solid #fed7aa'; text = 'RESCHEDULING REQUESTED';
    } else if (status === 'HIRED' || status === 'OFFICIALLY HIRED') {
      bg = '#ecfdf5'; color = '#047857'; border = '1px solid #6ee7b7'; text = 'OFFICIALLY HIRED';
    } else if (status === 'PASSED INITIAL' || status === 'PASSED_INITIAL' || status === 'PASSED INITIAL SCREENING') {
      bg = '#ecfdf5'; color = '#047857'; border = '1px solid #a7f3d0'; text = 'PASSED INITIAL SCREENING';
    }
    return (
      <span style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '700', letterSpacing: '0.4px',
        background: bg, color, border,
      }}>{text}</span>
    );
  };

  // ── Reusable Pagination Footer ──
  const PaginationFooter = ({
    currentPage,
    totalPages,
    totalRecords,
    pageSize = PAGE_SIZE,
    itemLabel = 'records',
    onPageChange
  }) => {
    if (totalRecords === 0) return null;
    const startIdx = (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, totalRecords);

    const getPageNumbers = () => {
      if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, idx) => idx + 1);
      }
      const pages = [];
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
      return pages;
    };

    return (
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
          Showing <strong>{startIdx}</strong> to <strong>{endIdx}</strong> of <strong>{totalRecords}</strong> {itemLabel}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: currentPage <= 1 ? '#f8fafc' : '#ffffff',
              color: currentPage <= 1 ? '#94a3b8' : '#334155',
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            &lt; Previous
          </button>

          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>
                  ...
                </span>
              );
            }
            const isCurrent = currentPage === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '30px',
                  height: '30px',
                  padding: '0 6px',
                  borderRadius: '6px',
                  border: isCurrent ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                  background: isCurrent ? '#0f172a' : '#ffffff',
                  color: isCurrent ? '#ffffff' : '#334155',
                  fontWeight: isCurrent ? '700' : '500',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {p}
              </button>
            );
          })}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: currentPage >= totalPages ? '#f8fafc' : '#ffffff',
              color: currentPage >= totalPages ? '#94a3b8' : '#334155',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
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
    );
  };

  return (
    <>
      {/* ── Header Bar ── */}
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-header-title">Interview Management</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            Manage auto-scheduling, slot assignments, and candidate interview confirmations.
          </p>
        </div>
        {activeTab === 'needs_scheduling' && (
          <button
            className="admin-btn-primary"
            style={{
              background: '#e6007e', color: '#ffffff', fontFamily: "'Montserrat', sans-serif",
              fontWeight: '700', padding: '10px 22px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(230, 0, 126, 0.3)'
            }}
            onClick={() => setAutoScheduleModalOpen(true)}
          >
            <i className='bx bx-calendar-event' style={{ fontSize: '18px' }}></i> Auto Scheduling
          </button>
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div style={{
        display: 'flex', gap: '0',
        borderBottom: '2px solid #f1f5f9',
        marginBottom: '0',
        background: '#ffffff',
        borderRadius: '10px 10px 0 0',
        overflow: 'hidden',
        boxShadow: '0 1px 0 #f1f5f9',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 24px',
                border: 'none',
                borderBottom: isActive ? '3px solid #e6007e' : '3px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontSize: '13.5px',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#0f172a' : '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap',
                marginBottom: '-2px',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#94a3b8'; }}
            >
              {tab.label}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: '20px', height: '20px', borderRadius: '10px',
                padding: '0 6px',
                fontSize: '11px', fontWeight: '700',
                background: isActive
                  ? (count > 0 ? '#fce7f3' : '#f1f5f9')
                  : '#f1f5f9',
                color: isActive
                  ? (count > 0 ? '#e6007e' : '#94a3b8')
                  : '#94a3b8',
                transition: 'all 0.18s ease',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="admin-table-card" style={{
        borderRadius: '0 0 10px 10px',
        border: '1px solid #e2e8f0',
        borderTop: 'none',
        background: '#ffffff',
        overflowX: 'auto',
      }}>

        {/* ── NEEDS SCHEDULING TAB ── */}
        {activeTab === 'needs_scheduling' && (
          <>
            {loadingAgenda ? (
              <TableSkeleton
                columns={['Candidate', 'Position Applied', 'Date Applied', 'Evaluation Status', 'Scheduling Status', 'Action']}
                columnTypes={['avatar', 'text', 'text', 'status', 'status', 'actions']}
                rows={4}
              />
            ) : fetchError ? (
              <DatabaseErrorState
                title="Unable to Load Interview Agenda"
                message={fetchError}
                onRetry={fetchAgenda}
              />
            ) : pendingAutoScheduleQueue.length === 0 ? (
              <EmptyState
                icon={<i className="bx bx-calendar-x" style={{ fontSize: '40px', color: '#cbd5e1' }}></i>}
                message="No candidates waiting for scheduling. Pass applicants in Resume Screening to push them here."
              />
            ) : (
              <>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Position Applied</th>
                      <th>Date Applied</th>
                      <th>Evaluation Status</th>
                      <th>Scheduling Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPendingQueue.map((item) => (
                      <tr key={item.application_id}>
                        <td>
                          <div className="admin-candidate-cell">
                            <span className="admin-candidate-name">{item.candidate_name || `${item.User_Fname} ${item.User_Lname}`}</span>
                            {(item.candidate_mobile || item.User_Mobile) && (
                              <span
                                style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                              >
                                <i className='bx bx-phone' style={{ fontSize: '12px' }}></i>
                                {item.candidate_mobile || item.User_Mobile}
                              </span>
                            )}
                          </div>
                        </td>
                        <td><strong>{item.job_title}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                              {item.applied_at
                                ? new Date(item.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                            </span>
                            {item.applied_at && (
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                                {new Date(item.applied_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block', padding: '4px 12px', borderRadius: '16px',
                            fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px',
                            background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0'
                          }}>PASSED INITIAL SCREENING</span>
                        </td>
                        <td style={{ color: '#475569', fontWeight: '600', fontSize: '13px' }}>
                          Ready for Auto-Schedule Assignment
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            style={{
                              background: '#0f172a', color: '#ffffff', fontSize: '12px',
                              padding: '6px 14px', borderRadius: '6px', border: 'none',
                              cursor: 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px'
                            }}
                            onClick={() => setManualScheduleTarget(item)}
                          >
                            <i className='bx bx-calendar-edit' style={{ fontSize: '15px' }}></i> Manual Schedule
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <PaginationFooter
                  currentPage={safePendingPage}
                  totalPages={totalPendingPages}
                  totalRecords={pendingAutoScheduleQueue.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="candidates"
                  onPageChange={setPendingPage}
                />
              </>
            )}
          </>
        )}

        {/* ── ACTIVE QUEUE TAB ── */}
        {activeTab === 'active_queue' && (
          <>
            {loadingAgenda ? (
              <TableSkeleton
                columns={['Candidate', 'Position', 'Day', 'Interview Date', 'Time Slot', 'Status']}
                columnTypes={['avatar', 'text', 'text', 'date', 'text', 'status']}
                rows={5}
              />
            ) : fetchError ? (
              <DatabaseErrorState
                title="Unable to Load Active Queue"
                message={fetchError}
                onRetry={fetchAgenda}
              />
            ) : activeQueue.length === 0 ? (
              <EmptyState
                icon={<i className="bx bx-group" style={{ fontSize: '40px', color: '#cbd5e1' }}></i>}
                message='No interviews scheduled yet. Click "Auto Scheduling" to assign candidates to available slots.'
              />
            ) : (
              <>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Position</th>
                      <th>Day</th>
                      <th>Interview Date</th>
                      <th>Time Slot</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedActiveQueue.map((item) => {
                      const cName = item.candidate_name || `${item.User_Fname || ''} ${item.User_Lname || ''}`.trim();
                      const dayName = item.interview_date ? new Date(item.interview_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '—';
                      return (
                        <tr key={item.application_id}>
                          <td>
                            <div className="admin-candidate-cell">
                              <span className="admin-candidate-name">{cName}</span>
                              {(item.candidate_mobile || item.User_Mobile) && (
                                <span
                                  style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                                >
                                  <i className='bx bx-phone' style={{ fontSize: '12px' }}></i>
                                  {item.candidate_mobile || item.User_Mobile}
                                </span>
                              )}
                            </div>
                          </td>
                          <td><strong>{item.job_title}</strong></td>
                          <td><strong style={{ color: '#0f172a' }}>{dayName}</strong></td>
                          <td>
                            {item.interview_date
                              ? new Date(item.interview_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                              : <span style={{ color: '#94a3b8' }}>Awaiting Slot</span>}
                          </td>
                          <td>
                            {item.start_time
                              ? `${formatTime12h(item.start_time)}${item.end_time ? ' – ' + formatTime12h(item.end_time) : ''}`
                              : <span style={{ color: '#94a3b8' }}>Pending Assignment</span>}
                          </td>
                          <td>
                            <StatusBadge status={item.application_status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <PaginationFooter
                  currentPage={safeActivePage}
                  totalPages={totalActivePages}
                  totalRecords={activeQueue.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="interviews"
                  onPageChange={setActivePage}
                />
              </>
            )}
          </>
        )}

        {/* ── ACTION REQUIRED (RESCHEDULING) TAB ── */}
        {activeTab === 'action_required' && (
          <>
            {loadingAgenda ? (
              <TableSkeleton
                columns={['Candidate', 'Position', 'Day', 'Original Date', 'Requested New Slot', 'Flag Status', 'Action']}
                columnTypes={['avatar', 'text', 'text', 'date', 'text', 'status', 'actions']}
                rows={3}
              />
            ) : fetchError ? (
              <DatabaseErrorState
                title="Unable to Load Reschedule Requests"
                message={fetchError}
                onRetry={fetchAgenda}
              />
            ) : rescheduleQueue.length === 0 ? (
              <EmptyState
                icon={<i className="bx bx-history" style={{ fontSize: '40px', color: '#cbd5e1' }}></i>}
                message="No pending reschedule requests from candidates."
              />
            ) : (
              <>
                {/* Batch Reschedule Actions Bar with Reserved Space to Prevent Table Shift */}
                <div style={{
                  minHeight: '62px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease'
                }}>
                  {selectedRescheduleIds.length > 0 && (
                    <div style={{
                      width: '100%',
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '10px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      margin: 0,
                      boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
                      border: '1.5px solid #e2e8f0',
                      color: '#0f172a',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          background: '#fdf2f8',
                          color: '#e6007e',
                          border: '1px solid #fbcfe8',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '800',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <i className="bx bx-check-double" style={{ fontSize: '15px' }}></i>
                          {selectedRescheduleIds.length} Selected
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                          Batch Actions for Reschedule Requests:
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={handleBatchConfirmReschedule}
                          disabled={confirmingReschedule}
                          style={{
                            background: '#059669',
                            color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px',
                            fontWeight: '700', fontSize: '12.5px', cursor: 'pointer', display: 'inline-flex',
                            alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(5,150,105,0.25)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <i className="bx bx-check-circle" style={{ fontSize: '16px' }}></i>
                          {confirmingReschedule ? 'Confirming...' : `Confirm All Selected (${selectedRescheduleIds.length})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedRescheduleIds([])}
                          style={{
                            background: '#f8fafc', color: '#64748b', border: '1.5px solid #cbd5e1',
                            padding: '8px 14px', borderRadius: '8px', fontWeight: '600', fontSize: '12px',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <i className="bx bx-x" style={{ fontSize: '15px' }}></i> Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            title="Select All with Valid Slots on Current Page"
                            checked={paginatedRescheduleQueue.filter(x => Boolean(x.requested_date)).length > 0 && paginatedRescheduleQueue.filter(x => Boolean(x.requested_date)).every(x => selectedRescheduleIds.includes(x.application_id))}
                            onChange={() => toggleSelectAllReschedule(paginatedRescheduleQueue)}
                            style={{ margin: 0, padding: 0, cursor: 'pointer', width: '16px', height: '16px', accentColor: '#e6007e', display: 'block', flexShrink: 0 }}
                          />
                        </div>
                      </th>
                      <th>Candidate</th>
                      <th>Position</th>
                      <th>Day</th>
                      <th>Original Date</th>
                      <th>Requested New Slot</th>
                      <th>Flag Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRescheduleQueue.map((item) => {
                      const origDay = item.interview_date ? new Date(item.interview_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : '—';
                      const isSelected = selectedRescheduleIds.includes(item.application_id);
                      return (
                        <tr key={item.application_id} style={{ background: isSelected ? '#fdf2f8' : 'transparent' }}>
                          <td style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '14px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!item.requested_date}
                                onChange={() => toggleSelectReschedule(item.application_id)}
                                style={{ margin: 0, padding: 0, cursor: item.requested_date ? 'pointer' : 'not-allowed', width: '16px', height: '16px', accentColor: '#e6007e', display: 'block', flexShrink: 0 }}
                                title={item.requested_date ? 'Select for batch confirmation' : 'No requested slot selected'}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="admin-candidate-cell">
                              <span className="admin-candidate-name">{item.candidate_name || `${item.User_Fname} ${item.User_Lname}`}</span>
                              {(item.candidate_mobile || item.User_Mobile) && (
                                <span
                                  style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}
                                >
                                  <i className='bx bx-phone' style={{ fontSize: '12px' }}></i>
                                  {item.candidate_mobile || item.User_Mobile}
                                </span>
                              )}
                            </div>
                          </td>
                          <td><strong>{item.job_title}</strong></td>
                          <td><strong style={{ color: '#0f172a' }}>{origDay}</strong></td>
                          <td>{item.interview_date ? new Date(item.interview_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A'}</td>
                          <td>
                            <span style={{ fontSize: '12.5px', color: item.requested_date ? '#15803d' : '#64748b', fontWeight: item.requested_date ? '600' : '400' }}>
                              {formatRequestedSlot(item)}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block', padding: '4px 12px', borderRadius: '16px',
                              fontSize: '11px', fontWeight: '700', color: '#b45309',
                              background: '#fff7ed', border: '1px solid #fed7aa'
                            }}>RESCHEDULING REQUESTED</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              style={{
                                background: '#ffffff', color: '#0f172a', fontSize: '12px',
                                padding: '6px 13px', borderRadius: '6px', border: '1.5px solid #cbd5e1',
                                cursor: 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => setViewRescheduleTarget(item)}
                            >
                              <i className='bx bx-show' style={{ fontSize: '15px' }}></i> View Request
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <PaginationFooter
                  currentPage={safeReschedulePage}
                  totalPages={totalReschedulePages}
                  totalRecords={rescheduleQueue.length}
                  pageSize={PAGE_SIZE}
                  itemLabel="reschedule requests"
                  onPageChange={setReschedulePage}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* ── View Reschedule Request Modal ── */}
      {viewRescheduleTarget && ReactDOM.createPortal(
        <div
          onClick={() => setViewRescheduleTarget(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '520px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>
                  Candidate Reschedule Request
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Review the applicant's stated reason and requested interview schedule.
                </p>
              </div>
              <button
                onClick={() => setViewRescheduleTarget(null)}
                style={{
                  background: '#f1f5f9', border: 'none', borderRadius: '8px',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: '#475569',
                }}
              >
                <i className='bx bx-x' style={{ fontSize: '20px' }}></i>
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Applicant's Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                  Applicant's Stated Reason:
                </label>
                <div style={{
                  background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px',
                  padding: '14px 16px', fontSize: '13.5px', color: '#1e293b', lineHeight: '1.6', minHeight: '72px',
                  fontStyle: viewRescheduleTarget.reschedule_reason ? 'normal' : 'italic',
                }}>
                  {viewRescheduleTarget.reschedule_reason || 'No specific text reason provided.'}
                </div>
              </div>

              {/* Requested New Schedule */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                  Requested Preferred Schedule:
                </label>
                <div style={{
                  background: viewRescheduleTarget.requested_date ? '#f0fdf4' : '#f8fafc',
                  border: viewRescheduleTarget.requested_date ? '1.5px solid #a7f3d0' : '1.5px solid #e2e8f0',
                  borderRadius: '12px', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: '10px',
                  fontSize: '13.5px', color: viewRescheduleTarget.requested_date ? '#15803d' : '#64748b', fontWeight: '600',
                }}>
                  <i className='bx bx-calendar' style={{ fontSize: '18px' }}></i>
                  <span>{formatRequestedSlot(viewRescheduleTarget)}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px',
            }}>
              <button
                onClick={() => setViewRescheduleTarget(null)}
                disabled={confirmingReschedule}
                style={{
                  padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
                  background: '#f8fafc', color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={() => handleConfirmReschedule(viewRescheduleTarget)}
                disabled={confirmingReschedule || !viewRescheduleTarget.requested_date}
                style={{
                  padding: '9px 20px', borderRadius: '8px', border: 'none',
                  background: (confirmingReschedule || !viewRescheduleTarget.requested_date) ? '#e2e8f0' : '#10b981',
                  color: (confirmingReschedule || !viewRescheduleTarget.requested_date) ? '#94a3b8' : '#ffffff',
                  fontWeight: '700', fontSize: '13px',
                  cursor: (confirmingReschedule || !viewRescheduleTarget.requested_date) ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontFamily: "'Montserrat', sans-serif",
                  boxShadow: (!confirmingReschedule && viewRescheduleTarget.requested_date) ? '0 4px 12px rgba(16,185,129,0.3)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {confirmingReschedule ? (
                  <>
                    <div style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Confirming...
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Confirm Requested Schedule
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Auto Schedule Modal */}
      <AutoScheduleModal
        isOpen={autoScheduleModalOpen}
        onClose={() => setAutoScheduleModalOpen(false)}
        onScheduleSuccess={handleScheduleSuccess}
      />

      {/* Manual Schedule Modal */}
      <ManualScheduleModal
        isOpen={manualScheduleTarget !== null}
        onClose={() => setManualScheduleTarget(null)}
        candidate={manualScheduleTarget}
        onScheduleSuccess={handleScheduleSuccess}
      />

      {/* Reschedule Confirmation Loading Modal */}
      <LoadingScreen
        isOpen={confirmingReschedule}
        title="Confirming Reschedule"
        subtitle="Updating interview schedule..."
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!modalConfig}
        title={modalConfig?.title || 'Confirmation Required'}
        message={modalConfig?.message || ''}
        confirmText={modalConfig?.confirmText || 'Confirm'}
        cancelText={modalConfig?.cancelText || 'Cancel'}
        type={modalConfig?.confirmType || 'danger'}
        onConfirm={() => {
          if (modalConfig?.onConfirm) modalConfig.onConfirm();
        }}
        onCancel={() => setModalConfig(null)}
      />

      {/* Standalone Toast Portal */}
      {!propShowToast && <ToastPortal />}
    </>
  );
};

export default InterviewsTab;
