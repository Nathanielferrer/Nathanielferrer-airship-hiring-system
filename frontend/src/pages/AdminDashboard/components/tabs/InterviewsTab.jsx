import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import AutoScheduleModal from '../modals/AutoScheduleModal';
import ManualScheduleModal from '../modals/ManualScheduleModal';

const TABS = [
  { id: 'needs_scheduling', label: 'Pending Scheduling' },
  { id: 'active_queue',     label: 'Active Queue'       },
  { id: 'action_required',  label: 'Rescheduling'       },
];

const InterviewsTab = () => {
  const [agenda, setAgenda] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [autoScheduleModalOpen, setAutoScheduleModalOpen] = useState(false);
  const [manualScheduleTarget, setManualScheduleTarget] = useState(null);
  const [viewRescheduleTarget, setViewRescheduleTarget] = useState(null);
  const [confirmingReschedule, setConfirmingReschedule] = useState(false);

  const handleConfirmReschedule = async (item) => {
    setConfirmingReschedule(true);
    try {
      const res = await fetch('http://localhost/Hiring%20System/backend/interviews/confirm_reschedule.php', {
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
        const candidateName = item.candidate_name || `${item.User_Fname} ${item.User_Lname}`.trim();
        setViewRescheduleTarget(null);
        setToastMsg(data.message || `Reschedule confirmed for ${candidateName}.`);
        fetchAgenda();
        setTimeout(() => setToastMsg(''), 4000);
      } else {
        alert(data.message || 'Failed to confirm reschedule.');
      }
    } catch (err) {
      console.error('Confirm reschedule error:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setConfirmingReschedule(false);
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
  const [toastMsg, setToastMsg] = useState('');
  const [modalConfig, setModalConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('active_queue');

  // Get admin identity for audit logging
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('hiring_user') || '{}'); } catch { return {}; }
  })();
  const actorId = adminUser?.id || adminUser?.User_ID || 1;
  const actorName = (adminUser?.first_name || adminUser?.User_Fname)
    ? `${adminUser.first_name || adminUser.User_Fname} ${adminUser.last_name || adminUser.User_Lname}`.trim()
    : (adminUser?.email || adminUser?.User_Email || 'Admin');

  useEffect(() => {
    fetchAgenda();
  }, []);

  const fetchAgenda = async () => {
    setLoadingAgenda(true);
    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/interviews/get_agenda.php');
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setAgenda(data.agenda || []);
      }
    } catch (err) {
      console.error("Failed to fetch agenda:", err);
    } finally {
      setLoadingAgenda(false);
    }
  };

  const handleScheduleSuccess = (message) => {
    const cleanMsg = message || 'Interview scheduled successfully.';
    setToastMsg(cleanMsg);
    fetchAgenda();
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleDecision = (appId, status, candidateName) => {
    const isPass = status === 'Passed Final Interview' || status === 'HIRED' || status === 'PASSED';
    const actionTitle = isPass ? 'Confirm Pass F2F Interview' : 'Confirm Fail F2F Interview';
    const actionMsg = isPass
      ? `Are you sure you want to mark ${candidateName} as Passed Final Interview? This will forward their profile to the President for final executive approval.`
      : `Are you sure you want to mark ${candidateName} as Failed Final Interview?`;

    setModalConfig({
      type: 'confirm',
      confirmType: isPass ? 'pass' : 'reject',
      title: actionTitle,
      message: actionMsg,
      onConfirm: async () => {
        try {
          const targetStatus = isPass ? 'Passed Final Interview' : 'Failed Final Interview';
          const response = await fetch('http://localhost/Hiring%20System/backend/applications/update_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: appId, status: targetStatus, actor_id: actorId, actor_name: actorName })
          });
          const data = await response.json();
          if (response.ok && data.status === 'success') {
            setToastMsg(isPass ? 'Candidate marked as Passed Final Interview & forwarded to President.' : 'Interview decision recorded.');
            fetchAgenda();
            setTimeout(() => setToastMsg(''), 4000);
          } else {
            alert(data.message || "Failed to update interview outcome.");
          }
        } catch (err) {
          console.error("Error updating interview decision:", err);
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

  const pendingAutoScheduleQueue = agenda.filter(item => item.application_status === 'PASSED INITIAL');
  const activeQueue = agenda.filter(item => item.application_status !== 'RESCHEDULING' && item.application_status !== 'PASSED INITIAL');
  const rescheduleQueue = agenda.filter(item => item.application_status === 'RESCHEDULING');

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
    let bg = '#f8fafc', color = '#475569', border = '1px solid #cbd5e1', text = 'PENDING SCHEDULED';
    if (status === 'CONFIRMED' || status === 'INTERVIEW_SCHEDULED') {
      bg = '#f0fdf4'; color = '#15803d'; border = '1px solid #a7f3d0'; text = 'CONFIRMED SCHEDULE';
    } else if (status === 'RESCHEDULING') {
      bg = '#fff7ed'; color = '#b45309'; border = '1px solid #fed7aa'; text = 'RESCHEDULE';
    } else if (status === 'HIRED') {
      bg = '#ecfdf5'; color = '#047857'; border = '1px solid #6ee7b7'; text = 'HIRED';
    }
    return (
      <span style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '700', letterSpacing: '0.4px',
        background: bg, color, border,
      }}>{text}</span>
    );
  };

  return (
    <>
      {/* Toast Notification Banner */}
      {toastMsg && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#f0fdf4', color: '#047857',
          border: '1.5px solid #a7f3d0', padding: '12px 24px',
          borderRadius: '12px', fontSize: '13.5px', fontWeight: '700',
          fontFamily: "'Inter', sans-serif", zIndex: 99999,
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', pointerEvents: 'none',
        }}>
          <i className='bx bx-check-circle' style={{ fontSize: '20px' }}></i>
          <span>{toastMsg}</span>
        </div>,
        document.body
      )}

      {/* ── Header Bar ── */}
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-header-title">Interview Management</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            Manage auto-scheduling, slot assignments, and candidate interview confirmations.
          </p>
        </div>
        {activeTab !== 'action_required' && (
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
        overflow: 'hidden',
      }}>

        {/* ── NEEDS SCHEDULING TAB ── */}
        {activeTab === 'needs_scheduling' && (
          <>
            {loadingAgenda ? (
              <div style={{ textAlign: 'center', padding: '48px' }}>
                <div className="spinner" style={{ width: '36px', height: '36px', margin: '0 auto' }}></div>
                <p style={{ marginTop: '10px', color: '#475569', fontSize: '13.5px' }}>Loading...</p>
              </div>
            ) : pendingAutoScheduleQueue.length === 0 ? (
              <EmptyState
                icon={<i className="bx bx-calendar-x" style={{ fontSize: '40px', color: '#cbd5e1' }}></i>}
                message="No candidates waiting for scheduling. Pass applicants in Resume Screening to push them here."
              />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Position Applied</th>
                    <th>Evaluation Status</th>
                    <th>Scheduling Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingAutoScheduleQueue.map((item) => (
                    <tr key={item.application_id}>
                      <td>
                        <div className="admin-candidate-cell">
                          <span className="admin-candidate-name">{item.candidate_name || `${item.User_Fname} ${item.User_Lname}`}</span>
                        </div>
                      </td>
                      <td><strong>{item.job_title}</strong></td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '4px 12px', borderRadius: '16px',
                          fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px',
                          background: '#f0fdf4', color: '#047857', border: '1px solid #a7f3d0'
                        }}>PASSED INITIAL</span>
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
            )}
          </>
        )}

        {/* ── ACTIVE QUEUE TAB ── */}
        {activeTab === 'active_queue' && (
          <>
            {loadingAgenda ? (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <div className="spinner" style={{ width: '44px', height: '44px', margin: '0 auto' }}></div>
                <p style={{ marginTop: '14px', color: '#64748b' }}>Refreshing agenda...</p>
              </div>
            ) : activeQueue.length === 0 ? (
              <EmptyState
                icon={<i className="bx bx-group" style={{ fontSize: '40px', color: '#cbd5e1' }}></i>}
                message='No interviews scheduled yet. Click "Auto Scheduling" to assign candidates to available slots.'
              />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Position</th>
                    <th>Interview Date</th>
                    <th>Time Slot</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeQueue.map((item) => {
                    const cName = item.candidate_name || `${item.User_Fname || ''} ${item.User_Lname || ''}`.trim();
                    return (
                      <tr key={item.application_id}>
                        <td>
                          <div className="admin-candidate-cell">
                            <span className="admin-candidate-name">{cName}</span>
                          </div>
                        </td>
                        <td><strong>{item.job_title}</strong></td>
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
            )}
          </>
        )}

        {/* ── ACTION REQUIRED (RESCHEDULING) TAB ── */}
        {activeTab === 'action_required' && (
          <>
            {rescheduleQueue.length === 0 ? (
              <EmptyState
                icon={<i className="bx bx-history" style={{ fontSize: '40px', color: '#cbd5e1' }}></i>}
                message="No pending reschedule requests from candidates."
              />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Position</th>
                    <th>Original Date</th>
                    <th>Requested New Slot</th>
                    <th>Flag Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rescheduleQueue.map((item) => (
                    <tr key={item.application_id}>
                      <td>
                        <div className="admin-candidate-cell">
                          <span className="admin-candidate-name">{item.candidate_name || `${item.User_Fname} ${item.User_Lname}`}</span>
                        </div>
                      </td>
                      <td><strong>{item.job_title}</strong></td>
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
                        }}>RESCHEDULE</span>
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
                  ))}
                </tbody>
              </table>
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
              display: 'flex', justifyContent: 'flex-end', gap: '10px',
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
    </>
  );
};

export default InterviewsTab;
