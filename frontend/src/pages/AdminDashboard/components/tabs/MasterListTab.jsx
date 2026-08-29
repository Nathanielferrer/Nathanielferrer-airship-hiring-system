import React, { useState, useEffect } from 'react';

const MasterListTab = () => {
  const [masterList, setMasterList] = useState([]);
  const [loadingMasterList, setLoadingMasterList] = useState(false);
  const [masterSearch, setMasterSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Get admin identity for audit logging (kept for consistency or future use)
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('hiring_user') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    setPage(1); // reset to page 1 on filter changes
  }, [selectedDate, statusFilter, masterSearch]);

  useEffect(() => {
    fetchMasterList();
  }, [selectedDate, statusFilter, masterSearch, page]);

  const fetchMasterList = async () => {
    setLoadingMasterList(true);
    try {
      let url = `http://localhost/Hiring%20System/backend/applications/get_all_applications.php?page=${page}`;
      if (selectedDate) url += `&selected_date=${encodeURIComponent(selectedDate)}`;
      if (statusFilter) url += `&status_filter=${encodeURIComponent(statusFilter)}`;
      if (masterSearch) url += `&search=${encodeURIComponent(masterSearch)}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'success') {
        setMasterList(data.applications || []);
        setTotalPages(data.total_pages || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMasterList(false);
    }
  };

  const handleGenerateReport = (format = 'csv') => {
    window.open(`http://localhost/Hiring%20System/backend/applications/generate_status_report.php?format=${format}&search=${encodeURIComponent(masterSearch)}&selected_date=${encodeURIComponent(selectedDate)}&status_filter=${encodeURIComponent(statusFilter)}`, '_blank');
  };

  return (
    <>
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-header-title">Application Audit Records</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            Comprehensive historical log of candidate application lifecycles, status evaluations, and audit reports.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="admin-btn-secondary" 
            style={{
              background: '#ffffff', color: '#0f172a', border: '1.5px solid #cbd5e1',
              padding: '9px 18px', borderRadius: '8px', fontWeight: '700', fontSize: '13.5px',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontFamily: "'Montserrat', sans-serif", boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
            onClick={() => handleGenerateReport('csv')}
          >
            <i className='bx bx-export' style={{ fontSize: '18px', color: '#475569' }}></i> Export CSV
          </button>
          <button 
            className="admin-btn-primary" 
            style={{
              background: '#e6007e', color: '#ffffff', border: 'none',
              padding: '9px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '13.5px',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px',
              fontFamily: "'Montserrat', sans-serif", boxShadow: '0 4px 12px rgba(230, 0, 126, 0.3)'
            }}
            onClick={() => handleGenerateReport('pdf')}
          >
            <i className='bx bxs-file-pdf' style={{ fontSize: '18px' }}></i> Save as PDF
          </button>
        </div>
      </div>

      <div style={{
        background: '#ffffff',
        padding: '14px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', width: '360px', maxWidth: '100%', display: 'flex', alignItems: 'center' }}>
          <i className='bx bx-search' style={{ position: 'absolute', left: '12px', fontSize: '18px', color: '#94a3b8', pointerEvents: 'none' }}></i>
          <input 
            type="text" 
            placeholder="Search candidates by name, email, or position..." 
            style={{
              padding: '9px 14px 9px 38px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '13px',
              width: '100%',
              outline: 'none',
              background: '#ffffff',
              color: '#0f172a',
              fontFamily: 'Inter, sans-serif'
            }}
            value={masterSearch}
            onChange={(e) => setMasterSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status:</span>
            <select
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="hired">Officially Hired / Passed Final Approval</option>
              <option value="contract_signing">Contract Signing & Onboarding</option>
              <option value="passed_final_interview">Passed Final Interview (Awaiting President)</option>
              <option value="withdrawn">Candidate Withdrew</option>
              <option value="incomplete_requirements">Incomplete Requirements</option>
              <option value="failed_pre_employment">Failed Pre-Employment</option>
              <option value="rejected">Rejected / Failed</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date:</span>
            <input
              type="date"
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              title="Filter by Application Date"
            />
          </div>

          {(selectedDate || statusFilter || masterSearch) && (
            <button
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#ef4444',
                cursor: 'pointer'
              }}
              onClick={() => { setMasterSearch(''); setStatusFilter(''); setSelectedDate(''); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="admin-table-card">
        {loadingMasterList ? (
          <div className="admin-loading">Loading audit records...</div>
        ) : masterList.length === 0 ? (
          <div className="admin-empty-state" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <i className='bx bx-history' style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}></i>
            <h3>No Application Records Found</h3>
            <p>No historical application data matches the selected filters.</p>
          </div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Applied Position</th>
                  <th>Application Date</th>
                  <th>Decision / Updated Date</th>
                  <th>Lifecycle Status</th>
                </tr>
              </thead>
              <tbody>
                {masterList.map(app => {
                  let badgeColor = '#475569';
                  let badgeBg = '#f1f5f9';
                  let badgeBorder = '#cbd5e1';
                  let statusText = app.status ? app.status.toUpperCase() : 'PENDING';
                  let statusLabel = statusText;

                  if (statusText === 'CONTRACT SIGNED & ONBOARDED' || statusText === 'CONTRACT_SIGNED_AND_ONBOARDED' || statusText === 'OFFICIALLY HIRED & SIGNED' || statusText === 'OFFICIALLY HIRED') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'OFFICIALLY HIRED';
                  } else if (statusText === 'CONTRACT SIGNING SCHEDULED' || statusText === 'CONTRACT_SIGNING_SCHEDULED') {
                    badgeColor = '#0369a1';
                    badgeBg = '#e0f2fe';
                    badgeBorder = '#bae6fd';
                    statusLabel = 'CONTRACT SIGNING SCHEDULED';
                  } else if (statusText === 'REQUIREMENTS VERIFIED' || statusText === 'REQUIREMENTS_VERIFIED') {
                    badgeColor = '#15803d';
                    badgeBg = '#dcfce7';
                    badgeBorder = '#bbf7d0';
                    statusLabel = 'REQUIREMENTS VERIFIED';
                  } else if (statusText === 'HIRED' || statusText === 'PASSED FINAL APPROVAL' || statusText === 'PASSED_FINAL_APPROVAL' || statusText === 'PASSED' || statusText === 'HIRED / PASSED') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'OFFICIALLY HIRED';
                  } else if (statusText === 'PASSED FINAL INTERVIEW' || statusText === 'PASSED_FINAL_INTERVIEW') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'PASSED FINAL INTERVIEW';
                  } else if (statusText === 'FAILED FINAL APPROVAL' || statusText === 'FAILED_FINAL_APPROVAL') {
                    badgeColor = '#334155';
                    badgeBg = '#f1f5f9';
                    badgeBorder = '#cbd5e1';
                    statusLabel = 'FAILED FINAL APPROVAL';
                  } else if (statusText === 'FAILED FINAL INTERVIEW' || statusText === 'FAILED_FINAL_INTERVIEW' || statusText === 'FAILED INTERVIEW' || statusText === 'INTERVIEW_FAILED') {
                    badgeColor = '#b91c1c';
                    badgeBg = '#fee2e2';
                    badgeBorder = '#fecaca';
                    statusLabel = 'FAILED FINAL INTERVIEW';
                  } else if (statusText === 'CANDIDATE WITHDREW' || statusText === 'CANDIDATE_WITHDREW') {
                    badgeColor = '#475569';
                    badgeBg = '#f1f5f9';
                    badgeBorder = '#cbd5e1';
                    statusLabel = 'CANDIDATE WITHDREW';
                  } else if (statusText === 'INCOMPLETE REQUIREMENTS' || statusText === 'INCOMPLETE_REQUIREMENTS') {
                    badgeColor = '#be123c';
                    badgeBg = '#fff1f2';
                    badgeBorder = '#fecdd3';
                    statusLabel = 'INCOMPLETE REQUIREMENTS';
                  } else if (statusText === 'FAILED PRE-EMPLOYMENT' || statusText === 'FAILED_PRE_EMPLOYMENT') {
                    badgeColor = '#b91c1c';
                    badgeBg = '#fef2f2';
                    badgeBorder = '#fecaca';
                    statusLabel = 'FAILED PRE-EMPLOYMENT';
                  } else if (statusText === 'PASSED INITIAL') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'PASSED INITIAL';
                  } else if (statusText === 'PENDING SCHEDULED') {
                    badgeColor = '#c2410c';
                    badgeBg = '#ffedd5';
                    badgeBorder = '#fed7aa';
                    statusLabel = 'PENDING SCHEDULE';
                  } else if (statusText === 'CONFIRMED' || statusText === 'INTERVIEW_SCHEDULED') {
                    badgeColor = '#15803d';
                    badgeBg = '#dcfce7';
                    badgeBorder = '#bbf7d0';
                    statusLabel = 'CONFIRMED SCHEDULE';
                  } else if (statusText === 'RESCHEDULING') {
                    badgeColor = '#b45309';
                    badgeBg = '#fff7ed';
                    badgeBorder = '#fed7aa';
                    statusLabel = 'RESCHEDULING';
                  } else if (statusText === 'SHORTLISTED') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'SHORTLISTED';
                  } else if (statusText === 'SCREENING_REJECTED' || statusText === 'REJECTED') {
                    badgeColor = '#b91c1c';
                    badgeBg = '#fee2e2';
                    badgeBorder = '#fecaca';
                    statusLabel = 'REJECTED';
                  } else if (statusText === 'DECLINED - UNRESPONSIVE') {
                    badgeColor = '#475569';
                    badgeBg = '#f1f5f9';
                    badgeBorder = '#cbd5e1';
                    statusLabel = 'DECLINED';
                  } else if (statusText === 'ARCHIVED') {
                    badgeColor = '#64748b';
                    badgeBg = '#f1f5f9';
                    badgeBorder = '#cbd5e1';
                    statusLabel = 'ARCHIVED';
                  } else {
                    badgeColor = '#b45309';
                    badgeBg = '#fef3c7';
                    badgeBorder = '#fde68a';
                    statusLabel = 'PENDING REVIEW';
                  }

                  return (
                    <tr key={app.id}>
                      <td>
                        <div className="admin-candidate-cell">
                          <span className="admin-candidate-name">{app.candidate_name || `${app.User_Fname} ${app.User_Lname}`}</span>
                        </div>
                      </td>
                      <td><strong>{app.job_title}</strong></td>
                      <td>{app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}</td>
                      <td>
                        {app.updated_at ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '13px' }}>
                              {new Date(app.updated_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              {new Date(app.updated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 14px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: badgeColor,
                          backgroundColor: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          fontFamily: "'Montserrat', sans-serif",
                          letterSpacing: '0.4px'
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {masterList.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{textAlign:'center', padding:'30px', color: '#64748b'}}>No application records found matching the specified filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
            
            {/* Pagination Controls */}
            {totalPages > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === 1 ? '#f1f5f9' : '#ffffff', color: page === 1 ? '#94a3b8' : '#0f172a', cursor: page === 1 ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  &larr; Previous
                </button>
                <div style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>
                  Page {page} of {totalPages}
                </div>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: page === totalPages ? '#f1f5f9' : '#ffffff', color: page === totalPages ? '#94a3b8' : '#0f172a', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px' }}
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default MasterListTab;
