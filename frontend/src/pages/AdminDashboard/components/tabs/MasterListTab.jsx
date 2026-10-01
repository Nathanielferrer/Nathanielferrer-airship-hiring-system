import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { TableSkeleton, DatabaseErrorState } from '../../../../components/Loading';
import { useToast } from '../../../../components/Toast/Toast';

import { API_BASE_URL } from '../../../../utils/apiConfig';
const getProcessInfo = (status) => {
  const norm = (status || '').toUpperCase();
  if (['REJECTED', 'SCREENING_REJECTED'].includes(norm)) {
    return { label: 'Rejected (Initial Screening)', bg: '#fef2f2', color: '#dc2626', icon: 'bx-x-circle' };
  }
  if (['PASSED INITIAL', 'PASSED_INITIAL'].includes(norm)) {
    return { label: 'Passed Initial Screening', bg: '#ecfdf5', color: '#059669', icon: 'bx-check-circle' };
  }
  if (['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(norm)) {
    return { label: 'Passed Final Interview', bg: '#eff6ff', color: '#2563eb', icon: 'bx-check-circle' };
  }
  if (['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes(norm)) {
    return { label: 'Waitlisted', bg: '#eff6ff', color: '#1d4ed8', icon: 'bx-time-five' };
  }
  if (['FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'INTERVIEW_FAILED', 'FAILED INTERVIEW'].includes(norm)) {
    return { label: 'Failed Final Interview', bg: '#fef2f2', color: '#dc2626', icon: 'bx-x-circle' };
  }
  if (['APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PRESIDENT APPROVED', 'PRESIDENT_APPROVED', 'PASSED FINAL APPROVAL'].includes(norm)) {
    return { label: "President's Approval Granted (Job Offer Queue)", bg: '#ecfdf5', color: '#047857', icon: 'bx-check-double' };
  }
  if (['JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING', 'OFFER_EXTENDED'].includes(norm)) {
    return { label: 'Job Offer Sent (Awaiting Candidate)', bg: '#fff7ed', color: '#c2410c', icon: 'bx-file' };
  }
  if (['JOB OFFER ACCEPTED', 'OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED'].includes(norm)) {
    return { label: 'Job Offer Accepted (Awaiting Contract Signing)', bg: '#ecfdf5', color: '#047857', icon: 'bx-check-shield' };
  }
  if (['JOB OFFER DECLINED', 'OFFER DECLINED', 'JOB_OFFER_DECLINED'].includes(norm)) {
    return { label: 'Job Offer Declined by Candidate', bg: '#fef2f2', color: '#dc2626', icon: 'bx-x-circle' };
  }
  if (['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes(norm)) {
    return { label: "President's Approval Declined", bg: '#fef2f2', color: '#dc2626', icon: 'bx-block' };
  }
  if (['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(norm)) {
    return { label: 'Contract Signing Scheduled', bg: '#f0fdf4', color: '#16a34a', icon: 'bx-calendar-check' };
  }
  if (['REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED'].includes(norm)) {
    return { label: 'Contract Signed (Requirement Pending)', bg: '#fffbeb', color: '#b45309', icon: 'bx-time' };
  }
  if (['OFFICIALLY HIRED', 'OFFICIALLY_HIRED'].includes(norm)) {
    return { label: 'Officially Hired', bg: '#ecfdf5', color: '#059669', icon: 'bx-badge-check' };
  }
  if (['COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED'].includes(norm)) {
    return { label: 'Officially Hired (Requirements Completed)', bg: '#ecfdf5', color: '#047857', icon: 'bx-check-shield' };
  }
  if (['PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'].includes(norm)) {
    return { label: 'Partially Compliant', bg: '#fffbeb', color: '#b45309', icon: 'bx-time' };
  }
  if (['OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED'].includes(norm)) {
    return { label: 'Offer Declined', bg: '#fff1f2', color: '#e11d48', icon: 'bx-x-circle' };
  }
  if (['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN'].includes(norm)) {
    return { label: 'Application Withdrawn', bg: '#f1f5f9', color: '#334155', icon: 'bx-user-minus' };
  }
  if (['CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW'].includes(norm)) {
    return { label: 'Candidate No Show', bg: '#fffbeb', color: '#b45309', icon: 'bx-user-x' };
  }
  if (['OFFER EXPIRED', 'OFFER_EXPIRED', 'JOB OFFER EXPIRED'].includes(norm)) {
    return { label: 'Offer Expired', bg: '#fee2e2', color: '#b91c1c', icon: 'bx-time-five' };
  }
  return { label: status || 'Evaluation Process', bg: '#f1f5f9', color: '#475569', icon: 'bx-git-commit' };
};

const MasterListTab = ({ showToast: propShowToast }) => {
  const { showToast: localShowToast, ToastPortal } = useToast();
  const showToast = propShowToast || localShowToast;

  const [masterList, setMasterList] = useState([]);
  const [loadingMasterList, setLoadingMasterList] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [masterSearch, setMasterSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Get admin identity for audit logging (kept for consistency or future use)
  const adminUser = (() => {
    try { return JSON.parse(localStorage.getItem('hiring_user') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    setPage(1); // reset to page 1 on filter changes
  }, [selectedDate, selectedYear, statusFilter, masterSearch]);

  useEffect(() => {
    fetchMasterList();
  }, [selectedDate, selectedYear, statusFilter, masterSearch, page]);

  const fetchMasterList = async () => {
    setLoadingMasterList(true);
    setFetchError(null);
    try {
      let url = `${API_BASE_URL}/applications/get_all_applications.php?page=${page}`;
      if (selectedDate) url += `&selected_date=${encodeURIComponent(selectedDate)}`;
      if (selectedYear) url += `&selected_year=${encodeURIComponent(selectedYear)}`;
      if (statusFilter) url += `&status_filter=${encodeURIComponent(statusFilter)}`;
      if (masterSearch) url += `&search=${encodeURIComponent(masterSearch)}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
      });
      if (!res.ok) {
        throw new Error(`Server returned response ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'success') {
        setMasterList(data.applications || []);
        setTotalPages(data.total_pages || 1);
        setTotalRecords(data.total_records !== undefined ? data.total_records : (data.applications || []).length);
        if (data.available_years && Array.isArray(data.available_years)) {
          setAvailableYears(data.available_years);
        }
      } else {
        throw new Error(data.message || 'Unable to retrieve audit records.');
      }
    } catch (e) {
      console.error(e);
      setFetchError(e.message || 'Could not connect to the database. Please verify your connection or MySQL status.');
    } finally {
      setLoadingMasterList(false);
    }
  };


  const handleGenerateReport = (format = 'csv') => {
    if (showToast) showToast(`Generating Application Audit ${format.toUpperCase()} report...`, 'info');
    const adminName = adminUser ? (adminUser.first_name ? `${adminUser.first_name} ${adminUser.last_name || ''}` : `${adminUser.User_Fname || ''} ${adminUser.User_Lname || ''}`).trim() : '';
    window.open(`${API_BASE_URL}/applications/generate_status_report.php?format=${format}&search=${encodeURIComponent(masterSearch)}&selected_date=${encodeURIComponent(selectedDate)}&selected_year=${encodeURIComponent(selectedYear)}&status_filter=${encodeURIComponent(statusFilter)}&admin_name=${encodeURIComponent(adminName)}`, '_blank');
  };

  return (
    <>
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="admin-header-title">Application Audit Records</h1>
            {totalRecords > 0 && (
              <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11.5px', fontWeight: '800', padding: '3px 10px', borderRadius: '12px' }}>
                {totalRecords} Records
              </span>
            )}
          </div>
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
              <option value="pending_evaluation">Pending Review</option>
              <option value="passed_initial">Passed Initial Screening</option>
              <option value="pending_scheduled">Pending Schedule</option>
              <option value="confirmed_schedule">Confirmed Schedule</option>
              <option value="rescheduling">Rescheduling Requested</option>
              <option value="scheduling_expired">Scheduling Expired</option>
              <option value="no_show">Interview No Show</option>
              <option value="passed_final_interview">Passed Final Interview</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="ready_for_offer">Ready for Offer</option>
              <option value="job_offer_pending">Job Offer Pending</option>
              <option value="job_offer_accepted">Job Offer Accepted</option>
              <option value="job_offer_declined">Job Offer Declined</option>
              <option value="contract_signing">Contract Signing Scheduled</option>
              <option value="hired">Officially Hired</option>
              <option value="completed_requirements">Completed Requirements</option>
              <option value="withdrawn">Application Withdrawn</option>
              <option value="offer_expired">Offer Expired</option>
              <option value="rejected">Rejected</option>
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
              onChange={(e) => {
                setSelectedDate(e.target.value);
                if (e.target.value) setSelectedYear('');
              }}
              title="Filter by Applied Date"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Year:</span>
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
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                if (e.target.value) setSelectedDate('');
              }}
              title="Filter by Applied Year"
            >
              <option value="">All Years</option>
              {(() => {
                const currentYr = new Date().getFullYear();
                const yearSet = new Set(availableYears);
                // Dynamically includes the current year (e.g., 2026, then 2027 next year) plus all historical years with records
                yearSet.add(currentYr);
                return Array.from(yearSet).sort((a, b) => b - a).map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ));
              })()}
            </select>
          </div>

          {(selectedDate || selectedYear || statusFilter || masterSearch) && (
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
              onClick={() => { setMasterSearch(''); setStatusFilter(''); setSelectedDate(''); setSelectedYear(''); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="admin-table-card">
        {loadingMasterList ? (
          <TableSkeleton
            columns={[
              'Candidate Name',
              'Contact Details',
              'Applied Position',
              'Applied Date',
              'Last Updated',
              'Applicant Status'
            ]}
            columnTypes={[
              'avatar',
              'text-with-subtitle',
              'text',
              'date',
              'date',
              'status'
            ]}
            rows={6}
          />
        ) : fetchError ? (
          <DatabaseErrorState
            title="Unable to Load Audit Records"
            message={fetchError}
            onRetry={fetchMasterList}
          />
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
                  <th>Contact Details</th>
                  <th>Applied Position</th>
                  <th>Applied Date</th>
                  <th>Last Updated</th>
                  <th>Applicant Status</th>
                </tr>
              </thead>
              <tbody>
                {masterList.map(app => {
                  let badgeColor = '#475569';
                  let badgeBg = '#f1f5f9';
                  let badgeBorder = '#cbd5e1';
                  let statusText = app.status ? app.status.toUpperCase() : 'PENDING';
                  let statusLabel = statusText;

                  if (statusText === 'COMPLETED REQUIREMENTS' || statusText === 'COMPLETED_REQUIREMENTS' || statusText === 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED' || statusText === 'OFFICIALLY HIRED' || statusText === 'OFFICIALLY_HIRED' || statusText === 'OFFICIALLY HIRED & SIGNED') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'OFFICIALLY HIRED';
                  } else if (statusText === 'PARTIALLY COMPLIANT' || statusText === 'PARTIALLY_COMPLIANT') {
                    badgeColor = '#b45309';
                    badgeBg = '#fef3c7';
                    badgeBorder = '#fde68a';
                    statusLabel = 'OFFICIALLY HIRED';
                  } else if (statusText === 'REQUIREMENT PENDING' || statusText === 'REQUIREMENTS PENDING' || statusText === 'REQUIREMENT_PENDING' || statusText === 'REQUIREMENTS_PENDING' || statusText === 'CONTRACT SIGNED & ONBOARDED' || statusText === 'CONTRACT_SIGNED_AND_ONBOARDED' || statusText === 'HIRED - PRE-EMPLOYMENT') {
                    badgeColor = '#b45309';
                    badgeBg = '#fffbeb';
                    badgeBorder = '#fde68a';
                    statusLabel = 'REQUIREMENT PENDING';
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
                  } else if (statusText === 'PRESIDENT APPROVED' || statusText === 'PRESIDENT_APPROVED' || statusText === 'APPROVED FOR JOB OFFER' || statusText === 'APPROVED_FOR_JOB_OFFER' || statusText === 'READY FOR OFFER' || statusText === 'READY_FOR_OFFER') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'READY FOR OFFER';
                  } else if (statusText === 'JOB OFFER PENDING' || statusText === 'OFFER EXTENDED' || statusText === 'JOB_OFFER_PENDING' || statusText === 'OFFER_EXTENDED') {
                    badgeColor = '#c2410c';
                    badgeBg = '#fff7ed';
                    badgeBorder = '#fed7aa';
                    statusLabel = 'JOB OFFER PENDING';
                  } else if (statusText === 'JOB OFFER ACCEPTED' || statusText === 'OFFER ACCEPTED' || statusText === 'JOB_OFFER_ACCEPTED' || statusText === 'PASSED FINAL APPROVAL' || statusText === 'PASSED_FINAL_APPROVAL') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'JOB OFFER ACCEPTED';
                  } else if (statusText === 'JOB OFFER DECLINED' || statusText === 'OFFER DECLINED' || statusText === 'JOB_OFFER_DECLINED') {
                    badgeColor = '#b91c1c';
                    badgeBg = '#fee2e2';
                    badgeBorder = '#fecaca';
                    statusLabel = 'JOB OFFER DECLINED';
                  } else if (statusText === 'HIRED' || statusText === 'PASSED' || statusText === 'HIRED / PASSED') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'OFFICIALLY HIRED';
                  } else if (statusText === 'PASSED FINAL INTERVIEW' || statusText === 'PASSED_FINAL_INTERVIEW') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'PASSED FINAL INTERVIEW';
                  } else if (statusText === 'CANDIDATE NO SHOW' || statusText === 'CANDIDATE_NO_SHOW') {
                    badgeColor = '#b45309';
                    badgeBg = '#fffbeb';
                    badgeBorder = '#fde68a';
                    statusLabel = 'INTERVIEW NO SHOW';
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
                  } else if (statusText === 'CANDIDATE WITHDREW' || statusText === 'CANDIDATE_WITHDREW' || statusText === 'APPLICATION WITHDRAWN' || statusText === 'APPLICATION_WITHDRAWN' || statusText === 'WITHDRAWN') {
                    badgeColor = '#334155';
                    badgeBg = '#f1f5f9';
                    badgeBorder = '#cbd5e1';
                    statusLabel = 'APPLICATION WITHDRAWN';
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
                  } else if (statusText === 'PASSED INITIAL' || statusText === 'PASSED_INITIAL' || statusText === 'PASSED INITIAL SCREENING') {
                    badgeColor = '#047857';
                    badgeBg = '#d1fae5';
                    badgeBorder = '#a7f3d0';
                    statusLabel = 'PASSED INITIAL SCREENING';
                  } else if (statusText === 'PENDING SCHEDULED' || statusText === 'PENDING SCHEDULE' || statusText === 'PENDING_SCHEDULED') {
                    badgeColor = '#c2410c';
                    badgeBg = '#ffedd5';
                    badgeBorder = '#fed7aa';
                    statusLabel = 'PENDING SCHEDULE';
                  } else if (statusText === 'CONFIRMED' || statusText === 'INTERVIEW_SCHEDULED' || statusText === 'CONFIRMED SCHEDULE') {
                    badgeColor = '#15803d';
                    badgeBg = '#dcfce7';
                    badgeBorder = '#bbf7d0';
                    statusLabel = 'CONFIRMED SCHEDULE';
                  } else if (statusText === 'RESCHEDULING' || statusText === 'RESCHEDULING REQUESTED' || statusText === 'RESCHEDULE_REQUESTED') {
                    badgeColor = '#b45309';
                    badgeBg = '#fff7ed';
                    badgeBorder = '#fed7aa';
                    statusLabel = 'RESCHEDULING REQUESTED';
                  } else if (['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT', 'WAITLIST', 'WAITLISTED'].includes(statusText)) {
                    badgeColor = '#1d4ed8';
                    badgeBg = '#eff6ff';
                    badgeBorder = '#bfdbfe';
                    statusLabel = 'WAITLISTED';
                  } else if (statusText === 'OFFER EXPIRED' || statusText === 'OFFER_EXPIRED' || statusText === 'JOB OFFER EXPIRED') {
                    badgeColor = '#b91c1c';
                    badgeBg = '#fee2e2';
                    badgeBorder = '#fecaca';
                    statusLabel = 'OFFER EXPIRED';
                  } else if (statusText === 'SCREENING_REJECTED' || statusText === 'REJECTED') {
                    badgeColor = '#b91c1c';
                    badgeBg = '#fee2e2';
                    badgeBorder = '#fecaca';
                    statusLabel = 'SCREENING REJECTED';
                  } else if (statusText === 'SCHEDULING EXPIRED' || statusText === 'SCHEDULING_EXPIRED' || statusText === 'DECLINED - UNRESPONSIVE' || statusText === 'UNRESPONSIVE') {
                    badgeColor = '#dc2626';
                    badgeBg = '#fee2e2';
                    badgeBorder = '#fecaca';
                    statusLabel = 'SCHEDULING EXPIRED';
                  } else if (statusText === 'ARCHIVED') {
                    badgeColor = '#64748b';
                    badgeBg = '#f1f5f9';
                    badgeBorder = '#cbd5e1';
                    statusLabel = 'ARCHIVED';
                  } else if (statusText === 'PENDING' || statusText === 'REVIEW_REQUIRED') {
                    badgeColor = '#b45309';
                    badgeBg = '#fef3c7';
                    badgeBorder = '#fde68a';
                    statusLabel = 'PENDING REVIEW';
                  } else {
                    badgeColor = '#475569';
                    badgeBg = '#f1f5f9';
                    badgeBorder = '#cbd5e1';
                    statusLabel = statusText;
                  }

                  const rawName = app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'Applicant';
                  const candidateEmail = app.candidate_email || app.User_Email || '';
                  const candidatePhone = app.User_Mobile || app.candidate_mobile || '';

                  const isDeletedOrAnonymized = 
                    app.user_status === 'Deleted' || 
                    app.resume_path === '[DELETED]' ||
                    /^deleted applicant/i.test(rawName) ||
                    /^anonymized applicant/i.test(rawName) ||
                    app.User_Fname === 'Deleted' ||
                    app.User_Fname === 'Anonymized';

                  const anonymizedId = app.user_id || (rawName.match(/\d+/) ? rawName.match(/\d+/)[0] : (app.id || ''));
                  const displayName = isDeletedOrAnonymized
                    ? `Anonymized Applicant #${anonymizedId}`
                    : rawName;

                  return (
                    <tr key={app.id}>
                      {/* 1. Candidate Name */}
                      <td>
                        <div className="admin-candidate-cell" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span className="admin-candidate-name" style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                            {displayName}
                          </span>
                          {isDeletedOrAnonymized && (
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                              (Account Deleted)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Contact Details */}
                      <td>
                        {isDeletedOrAnonymized ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{
                              fontSize: '11.5px',
                              color: '#64748b',
                              fontWeight: '600',
                              fontStyle: 'italic',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <i className='bx bx-shield-quarter' style={{ fontSize: '12px', color: '#94a3b8' }}></i>
                              Redacted
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {candidateEmail ? (
                              <span style={{ fontSize: '12px', color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <i className='bx bx-envelope' style={{ fontSize: '13px', color: '#64748b' }}></i>
                                {candidateEmail}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>No email</span>
                            )}
                            {candidatePhone ? (
                              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <i className='bx bx-phone' style={{ fontSize: '12px', color: '#64748b' }}></i>
                                {candidatePhone}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>No contact #</span>
                            )}
                          </div>
                        )}
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
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: badgeColor,
                          backgroundColor: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          fontFamily: "'Montserrat', sans-serif",
                          letterSpacing: '0.4px',
                          whiteSpace: 'nowrap'
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {masterList.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{textAlign:'center', padding:'30px', color: '#64748b'}}>No application records found matching the specified filters.</td>
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



      {/* Standalone Toast Portal */}
      {!propShowToast && <ToastPortal />}
    </>
  );
};

export default MasterListTab;
