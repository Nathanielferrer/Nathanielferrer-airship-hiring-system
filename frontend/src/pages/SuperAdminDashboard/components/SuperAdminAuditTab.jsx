import React, { useState, useEffect } from 'react';
import DateRangePicker from './DateRangePicker';
import { TableSkeleton, DatabaseErrorState } from '../../../components/Loading';

import { API_BASE_URL } from '../../../utils/apiConfig';
const SuperAdminAuditTab = () => {
  const [logs, setLogs] = useState([]);
  const [fetchError, setFetchError] = useState(null);
  const [meta, setMeta] = useState({
    total_records: 0,
    total_pages: 1,
    current_page: 1,
    has_next_page: false,
    has_prev_page: false,
    per_page: 20
  });
  const [filterOptions, setFilterOptions] = useState({ admins: [], categories: [] });
  const [loading, setLoading] = useState(true);

  // Streamlined Filter States
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchAuditLogs(currentPage);

    // Auto-refresh when tab/window receives focus and every 8 seconds
    const interval = setInterval(() => {
      fetchAuditLogs(currentPage, false);
    }, 8000);

    const onFocus = () => fetchAuditLogs(currentPage, false);
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentPage, search, startDate, endDate, adminFilter, categoryFilter]);

  const fetchAuditLogs = async (page = 1, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    if (showSpinner) setFetchError(null);
    try {
      const params = new URLSearchParams({
        page: page,
        search: search,
        start_date: startDate,
        end_date: endDate,
        admin_name: adminFilter,
        action_category: categoryFilter
      });

      const res = await fetch(`${API_BASE_URL}/super_admin/get_audit_logs.php?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const data = await res.json();

      if (data.status === 'success') {
        const receivedLogs = data.logs || (data.data && data.data.logs) || [];
        const receivedMeta = data.meta || (data.data ? {
          total_records: data.data.total_records || 0,
          total_pages: data.data.total_pages || 1,
          current_page: data.data.current_page || 1,
          has_next_page: (data.data.current_page || 1) < (data.data.total_pages || 1),
          has_prev_page: (data.data.current_page || 1) > 1,
          per_page: 20
        } : { total_records: 0, total_pages: 1, current_page: 1, has_next_page: false, has_prev_page: false, per_page: 20 });
        const receivedFilters = data.filter_options || (data.data && data.data.filters) || { admins: [], categories: [] };

        setLogs(receivedLogs);
        setMeta(receivedMeta);
        setFilterOptions(receivedFilters);
        setFetchError(null);
      } else {
        throw new Error(data.message || 'Unable to retrieve system audit logs.');
      }
    } catch (err) {
      console.error("Failed to fetch system audit logs:", err);
      if (showSpinner) setFetchError(err.message || 'Could not connect to database for audit records.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setAdminFilter('');
    setCategoryFilter('');
    setCurrentPage(1);
  };

  const handleGenerateReport = (format = 'csv') => {
    const params = new URLSearchParams({
      format: format,
      start_date: startDate || '',
      end_date: endDate || '',
      admin_name: adminFilter || '',
      action_category: categoryFilter || '',
      search: search || ''
    });
    const token = localStorage.getItem('hiring_token') || '';
    if (token) params.set('token', token);
    window.open(`${API_BASE_URL}/super_admin/generate_audit_report.php?${params.toString()}`, '_blank');
  };

  // Parse and separate Event Description (Action Summary) and Modification Details (Change Details)
  const parseAuditDetails = (details, category) => {
    if (!details) return { eventDescription: category || 'Action recorded.', modificationDetails: '' };
    let text = String(details).trim();

    // 1. Job Updates: e.g. 'Updated job vacancy "Macho dancer". Renamed title from "Macho dancers" to "Macho dancer". Added requirement...'
    const jobUpdateMatch = text.match(/^(Updated job vacancy\s*(?:"[^"]*"|'[^']*'|\S+)\.)\s*(.*)$/i);
    if (jobUpdateMatch) {
      return {
        eventDescription: jobUpdateMatch[1],
        modificationDetails: jobUpdateMatch[2].trim()
      };
    }

    // 1b. Closed job: e.g. 'Closed job vacancy "Macho dancer". Auto-archived 2 candidate application(s). Changed status...'
    const jobCloseMatch = text.match(/^(Closed job vacancy\s*(?:"[^"]*"|'[^']*'|\S+)\.)\s*(.*)$/i);
    if (jobCloseMatch) {
      return {
        eventDescription: jobCloseMatch[1],
        modificationDetails: jobCloseMatch[2].trim()
      };
    }

    // 2. Job Creation: e.g. 'Posted new job vacancy: Title="Macho dancer", Openings=1, Status=Active.'
    const jobCreateMatch = text.match(/^(Posted new job vacancy(?::\s*Title="([^"]+)")?)\s*,?\s*(.*)$/i);
    if (jobCreateMatch) {
      const title = jobCreateMatch[2] ? ` "${jobCreateMatch[2]}"` : '';
      return {
        eventDescription: `Posted new job vacancy${title}.`,
        modificationDetails: jobCreateMatch[3] ? jobCreateMatch[3].replace(/,\s*/g, ' | ') : ''
      };
    }

    // 3. Job Deletion: e.g. 'Deleted job vacancy "Macho dancer". Details: Availability was 1, Status was Active.'
    const jobDelMatch = text.match(/^(Deleted job vacancy\s*(?:"[^"]*"|'[^']*'|\S+)\.)\s*(?:Details:\s*)?(.*)$/i);
    if (jobDelMatch) {
      return {
        eventDescription: jobDelMatch[1],
        modificationDetails: jobDelMatch[2].trim()
      };
    }

    // 4. Candidate Status Change (New format with job title):
    const statusArrowMatch = text.match(/^Status changed for candidate "([^"]+)" \(applying for "([^"]+)"\):\s*(.*)$/i);
    if (statusArrowMatch) {
      return {
        eventDescription: `Status changed for candidate "${statusArrowMatch[1]}" (${statusArrowMatch[2]}).`,
        modificationDetails: `Status updated: ${statusArrowMatch[3].trim()}`
      };
    }

    // 4b. Candidate Evaluation & President's Approval actions:
    const contractScheduleMatch = text.match(/^Scheduled contract signing for candidate "([^"]+)" \(applying for "([^"]+)"\) on ([^a]+) at ([^a]+) at "([^"]+)".*$/i);
    if (contractScheduleMatch) {
      return {
        eventDescription: `Scheduled contract signing for candidate "${contractScheduleMatch[1]}" (${contractScheduleMatch[2]}).`,
        modificationDetails: `Appointment: ${contractScheduleMatch[3].trim()} at ${contractScheduleMatch[4].trim()} (${contractScheduleMatch[5].trim()}). Status set to Contract Signing Scheduled.`
      };
    }

    const reqVerifyMatch = text.match(/^Verified all pre-employment documents for candidate "([^"]+)" \(applying for "([^"]+)"\):\s*(.*)$/i);
    if (reqVerifyMatch) {
      return {
        eventDescription: `Verified pre-employment documents for candidate "${reqVerifyMatch[1]}" (${reqVerifyMatch[2]}).`,
        modificationDetails: `Status updated: Requirements Verified (Ready for Contract Signing).`
      };
    }

    const evalMatch = text.match(/^Candidate "([^"]+)" \(applying for "([^"]+)"\)\s+(passed final interview|received President's Executive Approval|received President's Approval|failed final interview|was not approved at President's Final Approval|was marked as no show for final interview|was marked no show|withdrew from consideration|missed the 1-week pre-employment submission deadline|did not pass pre-employment clearance \(medical\/drug screening\)|completed contract signing and onboarding|withdrew):\s*(.*)$/i);
    if (evalMatch) {
      const actionType = (evalMatch[3] || '').toLowerCase();
      let eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) evaluated.`;
      if (actionType.includes('passed final interview')) eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) passed final interview.`;
      else if (actionType.includes('received president')) eventTitle = `President approved candidate "${evalMatch[1]}" (${evalMatch[2]}).`;
      else if (actionType.includes('failed final interview')) eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) failed final interview.`;
      else if (actionType.includes('no show')) eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) marked No Show for final interview.`;
      else if (actionType.includes('was not approved')) eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) rejected at President final review.`;
      else if (actionType.includes('completed contract signing')) eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) signed contract & onboarded.`;
      else if (actionType.includes('withdrew')) eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) withdrew from consideration.`;
      else if (actionType.includes('missed the 1-week')) eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) marked Incomplete Requirements (deadline passed).`;
      else if (actionType.includes('pre-employment clearance')) eventTitle = `Candidate "${evalMatch[1]}" (${evalMatch[2]}) marked Failed Pre-Employment (clearance not met).`;

      return {
        eventDescription: eventTitle,
        modificationDetails: `Decision: ${evalMatch[4] ? evalMatch[4].trim() : ''}`
      };
    }

    // 4c. Reverted Candidate Decision:
    const revertMatch = text.match(/^Reverted candidate "([^"]+)" \(applying for "([^"]+)"\) evaluation decision:\s*(.*)$/i);
    if (revertMatch) {
      return {
        eventDescription: `Reverted evaluation decision for candidate "${revertMatch[1]}" (${revertMatch[2]}).`,
        modificationDetails: `Status restored: ${revertMatch[3].trim()}`
      };
    }

    // 4d. Manually Scheduled Interview:
    const manualSchedMatch = text.match(/^Manually scheduled interview for candidate "([^"]+)"(?:\s*\([^)]*\))?\s*(?:on|at)\s*(.*)$/i);
    if (manualSchedMatch) {
      return {
        eventDescription: `Manually scheduled interview for candidate "${manualSchedMatch[1]}".`,
        modificationDetails: `Scheduled on ${manualSchedMatch[2].trim()}`
      };
    }

    // 4e. Confirmed Reschedule Request:
    const rescheduleMatch = text.match(/^Confirmed reschedule request for candidate "([^"]+)"(?:\s*\([^)]*\))?\s*(?:to|on)\s*(.*)$/i);
    if (rescheduleMatch) {
      return {
        eventDescription: `Confirmed reschedule request for candidate "${rescheduleMatch[1]}".`,
        modificationDetails: `Rescheduled to ${rescheduleMatch[2].trim()}`
      };
    }

    // 4f. Slot Creation:
    const slotCreateMatch = text.match(/^Created (\d+) interview slot\(s\) for (.*)$/i);
    if (slotCreateMatch) {
      return {
        eventDescription: `Created ${slotCreateMatch[1]} interview slot(s).`,
        modificationDetails: `Time window: ${slotCreateMatch[2].trim()}`
      };
    }

    // 5. Legacy candidate status change:
    const legacyStatusMatch = text.match(/^Updated candidate '([^']+)' status from '([^']+)' to '([^']+)'/i);
    if (legacyStatusMatch) {
      return {
        eventDescription: `Updated candidate "${legacyStatusMatch[1]}" status.`,
        modificationDetails: `Status updated: "${legacyStatusMatch[2]}" → "${legacyStatusMatch[3]}".`
      };
    }

    // 6. Knowledge Base Update: e.g. 'Updated Chatbot KB entry (Q: "What are hours?"): Added tag... Modified answer...'
    const kbUpdateMatch = text.match(/^Updated Chatbot KB entry \(Q:\s*"([^"]+)"\):\s*(.*)$/i);
    if (kbUpdateMatch) {
      return {
        eventDescription: `Updated Chatbot KB entry (Q: "${kbUpdateMatch[1]}").`,
        modificationDetails: kbUpdateMatch[2].trim()
      };
    }

    // 7. Knowledge Base Creation:
    const kbCreateMatch = text.match(/^Added new Chatbot KB entry:\s*Q="([^"]+)"\s*\|\s*(.*)$/i);
    if (kbCreateMatch) {
      return {
        eventDescription: `Added new Chatbot KB entry (Q: "${kbCreateMatch[1]}").`,
        modificationDetails: kbCreateMatch[2].trim()
      };
    }

    // 8. Knowledge Base Deletion:
    const kbDelMatch = text.match(/^Deleted Chatbot KB entry(?:\s*#\d+)?:?\s*Q="([^"]+)"\s*\|\s*(.*)$/i);
    if (kbDelMatch) {
      return {
        eventDescription: `Deleted Chatbot KB entry (Q: "${kbDelMatch[1]}").`,
        modificationDetails: kbDelMatch[2].trim()
      };
    }

    // 9. Auto-Schedule:
    if (/auto-schedule/i.test(text)) {
      const match = text.match(/(\d+)\s*(?:screened\s*)?candidate/i) || text.match(/assigned\s*(\d+)/i);
      const count = match ? match[1] : '1';
      return {
        eventDescription: `Auto-scheduled ${count} candidate(s) for interview.`,
        modificationDetails: 'Assigned screened candidates in "PASSED INITIAL" to available interview slots.'
      };
    }

    // 10. Clean technical IDs and split on sentence boundary safely (ignoring dots inside quotes & middle initials)
    text = text.replace(/\s*\((?:App\s*ID\s*|App\s*|Application\s*ID\s*|Application\s*|User\s*ID:?\s*|Slot\s*ID:?\s*)#?\d+\)/gi, '');
    text = text.replace(/#\d+\s*/g, '');
    text = text.replace(/\s*\(\s*\)/g, '');

    const quoteDotMatch = text.match(/^([^"]*"[^"]*"[^.]*)\.\s+(.+)$/);
    if (quoteDotMatch) {
      return {
        eventDescription: quoteDotMatch[1].trim() + '.',
        modificationDetails: quoteDotMatch[2].trim()
      };
    }

    return {
      eventDescription: text,
      modificationDetails: ''
    };
  };

  // ── Helper: Highlight only important values (candidate names, job titles, status values, dates) ──
  const renderHighlightedText = (text) => {
    if (!text) return null;
    const str = String(text);

    // Split on quoted text e.g. "NATHANIEL D. FERRER" or "PASSED INITIAL" without nested capturing groups
    const parts = str.split(/("[^"]+")/g);

    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith('"') && part.endsWith('"')) {
        return (
          <strong key={i} style={{ color: '#0f172a', fontWeight: '700' }}>
            {part}
          </strong>
        );
      }
      return <span key={i} style={{ color: '#475569', fontWeight: '400' }}>{part}</span>;
    });
  };

  const renderHighlightedDetails = (text) => {
    if (!text) return null;
    let str = String(text);

    // Match prefixes like "Scheduled on ", "Rescheduled to ", "Status updated: ", "Appointment: ", "Status restored: "
    const prefixMatch = str.match(/^(Scheduled on|Rescheduled to|Status updated:|Appointment:|Status restored:|Decision:)\s*(.*)$/i);
    if (prefixMatch) {
      return (
        <span style={{ color: '#475569', fontWeight: '400', fontSize: '13px', lineHeight: '1.5' }}>
          {prefixMatch[1]}{' '}
          {renderHighlightedText(prefixMatch[2])}
        </span>
      );
    }

    return (
      <span style={{ color: '#475569', fontWeight: '400', fontSize: '13px', lineHeight: '1.5' }}>
        {renderHighlightedText(str)}
      </span>
    );
  };

  const getCategoryColor = (cat) => {
    const category = (cat || '').toLowerCase();
    if (category.includes('delete') || category.includes('fail') || category.includes('deletion')) return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', dot: '#ef4444' };
    if (category.includes('archive') || category.includes('warn')) return { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' };
    if (category.includes('schedule') || category.includes('interview')) return { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe', dot: '#8b5cf6' };
    if (category.includes('create') || category.includes('hired') || category.includes('pass') || category.includes('creation')) return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', dot: '#10b981' };
    if (category.includes('knowledge base') || category.includes('chatbot') || category.includes('kb')) return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' };
    if (category.includes('update') || category.includes('status')) return { bg: '#f0f9ff', text: '#0369a1', border: '#bae6fd', dot: '#0ea5e9' };
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', dot: '#64748b' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* 1. Header Bar with Export Buttons */}
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div>
          <h1 className="admin-header-title">Audit Trail</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            Track and review all administrative activities, hiring updates, and system events.
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

      {/* 2. Streamlined Filter Toolbar */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '14px 18px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Search Field */}
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <i className="bx bx-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '17px', color: '#94a3b8' }}></i>
          <input
            type="text"
            placeholder="Search by action or administrator..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 38px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
              color: '#0f172a',
              boxSizing: 'border-box'
            }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {/* Modern Single-Input Dual-Month Date Range Picker */}
        <div style={{ flex: '0 0 auto' }}>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={({ startDate, endDate }) => {
              setStartDate(startDate || '');
              setEndDate(endDate || '');
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Administrator Dropdown */}
        <div style={{ minWidth: '150px', flex: '0 0 auto' }}>
          <select
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              color: '#0f172a',
              background: '#ffffff',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '500',
              cursor: 'pointer'
            }}
            value={adminFilter}
            onChange={(e) => { setAdminFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Administrators</option>
            {filterOptions.admins && filterOptions.admins.map((adm, idx) => (
              <option key={idx} value={adm}>{adm}</option>
            ))}
          </select>
        </div>

        {/* Action Category Dropdown */}
        <div style={{ minWidth: '150px', flex: '0 0 auto' }}>
          <select
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1.5px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              color: '#0f172a',
              background: '#ffffff',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '500',
              cursor: 'pointer'
            }}
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Categories</option>
            {filterOptions.categories && filterOptions.categories.length > 0 ? (
              filterOptions.categories.map((cat, idx) => (
                <option key={idx} value={cat}>{cat}</option>
              ))
            ) : (
              <>
                <option value="Status Change">Status Change</option>
                <option value="Job Creation">Job Creation</option>
                <option value="Job Update">Job Update</option>
                <option value="Job Deletion">Job Deletion</option>
                <option value="Interview Scheduling">Interview Scheduling</option>
                <option value="Schedule Management">Schedule Management</option>
                <option value="Candidate Archiving">Candidate Archiving</option>
                <option value="Admin Management">Admin Management</option>
              </>
            )}
          </select>
        </div>

        {/* Reset Button */}
        <button
          onClick={handleResetFilters}
          style={{
            padding: '9px 16px',
            borderRadius: '8px',
            border: '1.5px solid #cbd5e1',
            background: '#f8fafc',
            color: '#475569',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
          title="Reset search and filters"
        >
          <i className="bx bx-refresh" style={{ fontSize: '16px' }}></i> Reset
        </button>
      </div>

      {/* 3. Professional 4-Column Table */}
      <div className="admin-table-card" style={{
        background: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
        overflowX: 'auto'
      }}>
        {loading ? (
          <TableSkeleton
            columns={['Date & Time', 'Administrator', 'Action Category', 'Event Description', 'Modification Details']}
            rows={6}
            hasAvatar={true}
            hasActions={false}
          />
        ) : fetchError ? (
          <DatabaseErrorState
            title="Unable to Load System Audit Trail"
            message={fetchError}
            onRetry={() => fetchAuditLogs(currentPage, true)}
          />
        ) : logs.length === 0 ? (
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
              <i className="bx bx-history" style={{ fontSize: '28px', color: '#94a3b8' }}></i>
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>No Audit Records Found</h4>
            <p style={{ margin: 0, fontSize: '13.5px' }}>
              {startDate && endDate
                ? `No activity recorded between ${startDate} and ${endDate}.`
                : (startDate
                  ? `No activity recorded from ${startDate}.`
                  : 'No audit entries match the current search or filters.')}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                  <th style={{ width: '150px', padding: '14px 16px', textAlign: 'center', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Date & Time
                  </th>
                  <th style={{ width: '170px', padding: '14px 16px', textAlign: 'center', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Administrator
                  </th>
                  <th style={{ width: '170px', padding: '14px 16px', textAlign: 'center', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Action Category
                  </th>
                  <th style={{ width: '260px', padding: '14px 18px', textAlign: 'left', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Event Description
                  </th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '11.5px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Modification Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const catStyle = getCategoryColor(log.action_category);
                  const { eventDescription, modificationDetails } = parseAuditDetails(log.details, log.action_category);

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* 1. Date & Time */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ color: '#0f172a', fontWeight: '600', fontSize: '13px' }}>
                          {new Date(log.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '11.5px', marginTop: '2px' }}>
                          {new Date(log.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* 2. Administrator */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#f8fafc',
                            border: '1.5px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: '800',
                            color: '#1e293b',
                            flexShrink: 0
                          }}>
                            {(log.admin_name?.[0] || 'A').toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px', textAlign: 'left' }}>
                            {log.admin_name}
                          </span>
                        </div>
                      </td>

                      {/* 3. Action Category */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: catStyle.text,
                          background: catStyle.bg,
                          border: `1px solid ${catStyle.border}`,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: catStyle.dot }}></span>
                          {log.action_category}
                        </span>
                      </td>

                      {/* 4. Event Description */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'left' }}>
                        <div style={{ fontSize: '13px', lineHeight: '1.45' }}>
                          {renderHighlightedText(eventDescription)}
                        </div>
                      </td>

                      {/* 5. Modification Details */}
                      <td style={{ padding: '14px 18px', verticalAlign: 'middle', textAlign: 'left' }}>
                        {modificationDetails ? (
                          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            {renderHighlightedDetails(modificationDetails)}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Pagination Controls */}
        {meta.total_pages > 0 && (
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
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
              Showing Page <strong style={{ color: '#0f172a' }}>{meta.current_page}</strong> of <strong style={{ color: '#0f172a' }}>{meta.total_pages}</strong> ({meta.total_records} total records)
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                disabled={!meta.has_prev_page}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: '1.5px solid #cbd5e1',
                  background: meta.has_prev_page ? '#ffffff' : '#f8fafc',
                  color: meta.has_prev_page ? '#0f172a' : '#94a3b8',
                  fontWeight: '700',
                  fontSize: '12.5px',
                  cursor: meta.has_prev_page ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <i className="bx bx-chevron-left" style={{ fontSize: '17px' }}></i> Previous
              </button>

              <div style={{ display: 'flex', gap: '4px' }}>
                {Array.from({ length: meta.total_pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === meta.total_pages || Math.abs(p - meta.current_page) <= 1)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '7px',
                            border: p === meta.current_page ? 'none' : '1px solid #cbd5e1',
                            background: p === meta.current_page ? '#e6007e' : '#ffffff',
                            color: p === meta.current_page ? '#ffffff' : '#334155',
                            fontWeight: '700',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif'
                          }}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              <button
                disabled={!meta.has_next_page}
                onClick={() => setCurrentPage(prev => prev + 1)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '7px',
                  border: '1.5px solid #cbd5e1',
                  background: meta.has_next_page ? '#ffffff' : '#f8fafc',
                  color: meta.has_next_page ? '#0f172a' : '#94a3b8',
                  fontWeight: '700',
                  fontSize: '12.5px',
                  cursor: meta.has_next_page ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                Next <i className="bx bx-chevron-right" style={{ fontSize: '17px' }}></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminAuditTab;
