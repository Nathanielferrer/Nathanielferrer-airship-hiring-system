import React, { useState, useEffect } from 'react';
import { TableSkeleton, DatabaseErrorState } from '../../../../components/Loading';

import { API_BASE_URL } from '../../../../utils/apiConfig';

const OverviewTab = ({ setActiveTab }) => {
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [stats, setStats] = useState({
    hiredCount: 0,
    activeRolesCount: 0,
    activePipelineCount: 0,
    pendingResumesCount: 0,
    pendingInterviewsCount: 0,
    unansweredChatbotCount: 0
  });

  useEffect(() => {
    fetchDashboardOverviewData();
  }, []);

  const fetchDashboardOverviewData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [jobsRes, appsRes, agendaRes, kbRes] = await Promise.all([
        fetch(`${API_BASE}/jobs/get_jobs.php`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/applications/get_all_applications.php`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
        }).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/interviews/get_agenda.php`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/chatbot/get_unanswered.php`).then(r => r.json()).catch(() => ({}))
      ]);

      const jobsList = jobsRes.status === 'success' ? (jobsRes.jobs || []) : [];
      const appsList = appsRes.status === 'success' ? (appsRes.applications || []) : [];
      const agendaList = agendaRes.status === 'success' ? (agendaRes.agenda || []) : [];
      const kbList = kbRes.status === 'success' ? (kbRes.entries || []) : [];

      if (!jobsRes.status && !appsRes.status && !agendaRes.status) {
        throw new Error('Database services unavailable.');
      }

      // Calculate Metrics
      const hiredCount = appsList.filter(a => a.status === 'HIRED' || a.status === 'Hired' || a.status === 'PASSED INTERVIEW').length;
      const activeRoles = jobsList.filter(j => j.status === 'active' || j.is_active === 1 || j.is_active === '1');
      const totalRoles = jobsList.length;
      
      const activePipeline = appsList.filter(a => 
        ['pending', 'review_required', 'PASSED INITIAL', 'INTERVIEW_SCHEDULED', 'PENDING SCHEDULED', 'CONFIRMED', 'RESCHEDULING'].includes(a.status)
      ).length;

      const pendingResumes = appsList.filter(a => a.status === 'pending' || a.status === 'review_required').length;
      const pendingInterviews = agendaList.filter(a => a.application_status === 'PASSED INITIAL').length;
      const unansweredChatbot = kbList.length;

      setStats({
        hiredCount,
        activeRolesCount: activeRoles.length > 0 ? activeRoles.length : totalRoles,
        activePipelineCount: activePipeline,
        pendingResumesCount: pendingResumes,
        pendingInterviewsCount: pendingInterviews,
        unansweredChatbotCount: unansweredChatbot
      });

      // Filter for Active Pipeline only (Exclude HIRED, REJECTED, ARCHIVED)
      const agendaMap = {};
      agendaList.forEach(item => {
        if (item.application_id) {
          agendaMap[item.application_id] = item;
        }
      });

      const activeStatuses = ['pending', 'review_required', 'PASSED INITIAL', 'PENDING SCHEDULED', 'CONFIRMED', 'RESCHEDULING', 'INTERVIEW_SCHEDULED'];
      const activeOnly = appsList
        .filter(a => activeStatuses.includes(a.status))
        .slice(0, 6)
        .map(app => {
          const agendaItem = agendaMap[app.id] || {};
          const isScreening = ['pending', 'review_required'].includes(app.status);
          
          let stage = isScreening ? 'Resume Screening' : 'Interview Phase';
          let schedule = '';

          if (isScreening) {
            schedule = `Applied ${new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
          } else if (agendaItem.interview_date) {
            const dStr = new Date(agendaItem.interview_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
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
            const tStr = formatTime12h(agendaItem.start_time);
            schedule = `${dStr}${tStr ? ` • ${tStr}` : ''}`;
          } else if (app.status === 'PASSED INITIAL') {
            schedule = 'Slot Assignment Pending';
          } else {
            schedule = `Applied ${new Date(app.applied_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}`;
          }

          return {
            ...app,
            stage,
            schedule,
            isScreening
          };
        });

      setRecentApps(activeOnly);
    } catch (err) {
      console.error('Failed to load overview data:', err);
      setFetchError(err.message || 'Database connection error while retrieving overview metrics.');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getStatusBadge = (status) => {
    let badgeColor = '#475569';
    let badgeBg = '#f1f5f9';
    let badgeBorder = '#cbd5e1';
    let statusText = status ? status.toUpperCase() : 'PENDING';
    let label = statusText;

    if (['HIRED', 'PASSED INTERVIEW', 'PASSED', 'HIRED / PASSED', 'OFFICIALLY HIRED'].includes(statusText)) {
      badgeColor = '#065f46';
      badgeBg = '#d1fae5';
      badgeBorder = '#a7f3d0';
      label = 'OFFICIALLY HIRED';
    } else if (['APPROVED FOR JOB OFFER', 'APPROVED_FOR_JOB_OFFER', 'PRESIDENT APPROVED', 'PRESIDENT_APPROVED', 'READY FOR OFFER', 'READY_FOR_OFFER'].includes(statusText)) {
      badgeColor = '#047857';
      badgeBg = '#d1fae5';
      badgeBorder = '#a7f3d0';
      label = 'READY FOR OFFER';
    } else if (['JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING', 'OFFER_EXTENDED'].includes(statusText)) {
      badgeColor = '#c2410c';
      badgeBg = '#ffedd5';
      badgeBorder = '#fed7aa';
      label = 'JOB OFFER PENDING';
    } else if (['JOB OFFER ACCEPTED', 'OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL'].includes(statusText)) {
      badgeColor = '#047857';
      badgeBg = '#d1fae5';
      badgeBorder = '#a7f3d0';
      label = 'JOB OFFER ACCEPTED';
    } else if (['JOB OFFER DECLINED', 'OFFER DECLINED', 'JOB_OFFER_DECLINED'].includes(statusText)) {
      badgeColor = '#991b1b';
      badgeBg = '#fee2e2';
      badgeBorder = '#fecaca';
      label = 'JOB OFFER DECLINED';
    } else if (['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(statusText)) {
      badgeColor = '#0369a1';
      badgeBg = '#e0f2fe';
      badgeBorder = '#bae6fd';
      label = 'CONTRACT SIGNING SCHEDULED';
    } else if (['REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED'].includes(statusText)) {
      badgeColor = '#b45309';
      badgeBg = '#fffbeb';
      badgeBorder = '#fde68a';
      label = 'REQUIREMENT PENDING';
    } else if (['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(statusText)) {
      badgeColor = '#6b21a8';
      badgeBg = '#f3e8ff';
      badgeBorder = '#d8b4fe';
      label = 'PASSED FINAL INTERVIEW';
    } else if (['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes(statusText)) {
      badgeColor = '#334155';
      badgeBg = '#f1f5f9';
      badgeBorder = '#cbd5e1';
      label = 'FAILED FINAL APPROVAL';
    } else if (['FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED INTERVIEW', 'INTERVIEW_FAILED'].includes(statusText)) {
      badgeColor = '#991b1b';
      badgeBg = '#fee2e2';
      badgeBorder = '#fecaca';
      label = 'FAILED INTERVIEW';
    } else if (['PASSED INITIAL', 'PASSED_INITIAL', 'PASSED INITIAL SCREENING'].includes(statusText)) {
      badgeColor = '#0369a1';
      badgeBg = '#e0f2fe';
      badgeBorder = '#bae6fd';
      label = 'PASSED INITIAL SCREENING';
    } else if (['PENDING SCHEDULED', 'PENDING SCHEDULE', 'PENDING_SCHEDULED'].includes(statusText)) {
      badgeColor = '#c2410c';
      badgeBg = '#ffedd5';
      badgeBorder = '#fed7aa';
      label = 'PENDING SCHEDULE';
    } else if (['CONFIRMED', 'INTERVIEW_SCHEDULED', 'CONFIRMED SCHEDULE'].includes(statusText)) {
      badgeColor = '#15803d';
      badgeBg = '#dcfce7';
      badgeBorder = '#bbf7d0';
      label = 'CONFIRMED SCHEDULE';
    } else if (['RESCHEDULING', 'RESCHEDULING REQUESTED', 'RESCHEDULE_REQUESTED'].includes(statusText)) {
      badgeColor = '#b45309';
      badgeBg = '#fff7ed';
      badgeBorder = '#fed7aa';
      label = 'RESCHEDULING REQUESTED';
    } else if (['SCREENING_REJECTED', 'REJECTED'].includes(statusText)) {
      badgeColor = '#991b1b';
      badgeBg = '#fee2e2';
      badgeBorder = '#fecaca';
      label = 'REJECTED';
    } else if (['INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS'].includes(statusText)) {
      badgeColor = '#9f1239';
      badgeBg = '#ffe4e6';
      badgeBorder = '#fecdd3';
      label = 'INCOMPLETE REQUIREMENTS';
    } else {
      badgeColor = '#b45309';
      badgeBg = '#fef3c7';
      badgeBorder = '#fde68a';
      label = 'PENDING';
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        padding: '5px 12px',
        borderRadius: '20px',
        background: badgeBg,
        color: badgeColor,
        border: `1px solid ${badgeBorder}`,
        letterSpacing: '0.04em',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        {label}
      </span>
    );
  };

  // Candidate Avatar Initial Helper
  const getInitials = (name) => {
    if (!name) return 'AP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarBg = (idx) => {
    const bgs = [
      'linear-gradient(135deg, #e6007e, #be123c)',
      'linear-gradient(135deg, #0284c7, #0369a1)',
      'linear-gradient(135deg, #7c3aed, #6d28d9)',
      'linear-gradient(135deg, #059669, #047857)',
      'linear-gradient(135deg, #d97706, #b45309)',
    ];
    return bgs[idx % bgs.length];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px', animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* ── Page Header ── */}
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-header-title">Overview</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            Real-time candidate metrics, evaluation queues, and recruitment module shortcuts.
          </p>
        </div>
        
        <div style={{
          color: '#334155',
          fontSize: '13px',
          fontWeight: '700',
          background: '#ffffff',
          padding: '9px 18px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className='bx bx-calendar-check' style={{ fontSize: '16px', color: '#e6007e' }}></i>
          {formattedDate}
        </div>
      </div>

      {/* ── TIER 1: High-Energy Hero Gradient Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '22px' }}>
        
        {/* Hero Card 1: Total Hired Candidates */}
        <div className="admin-hero-card admin-hero-card-pink">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
            <div>
              <span className="admin-hero-label">Total Placed Candidates</span>
              <div className="admin-hero-value">
                {loading ? <span className="skeleton-shimmer" style={{ width: '45px', height: '32px', borderRadius: '6px' }} /> : stats.hiredCount}
              </div>
            </div>
            <div className="admin-hero-icon-circle">
              <i className='bx bx-trophy' style={{ fontSize: '24px' }}></i>
            </div>
          </div>

          <div className="admin-hero-footer" style={{ position: 'relative', zIndex: 2, marginTop: '16px' }}>
            <i className='bx bx-check-double' style={{ fontSize: '16px' }}></i>
            <span>Successfully placed candidates across all job openings</span>
          </div>
        </div>

        {/* Hero Card 2: Active Evaluation Pipeline */}
        <div className="admin-hero-card admin-hero-card-navy">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="admin-hero-label">Active Candidate Pipeline</span>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#e6007e',
                  boxShadow: '0 0 8px #e6007e',
                  display: 'inline-block'
                }}></span>
              </div>
              <div className="admin-hero-value" style={{ color: '#f8fafc' }}>
                {loading ? <span className="skeleton-shimmer" style={{ width: '45px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.15)' }} /> : stats.activePipelineCount}
              </div>
            </div>
            <div className="admin-hero-icon-circle">
              <i className='bx bx-user-voice' style={{ fontSize: '24px' }}></i>
            </div>
          </div>

          <div className="admin-hero-footer" style={{ color: '#94a3b8', position: 'relative', zIndex: 2, marginTop: '16px' }}>
            <i className='bx bx-pulse' style={{ color: '#f472b6', fontSize: '16px' }}></i>
            <span>Applicants currently moving through screening &amp; interview rounds</span>
          </div>
        </div>

      </div>

      {/* ── TIER 2: Modern Action Launchpad Tiles ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recruitment Modules &amp; Pending Queues
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Direct shortcuts to screening, interview scheduling, chatbot KB, and vacancies</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          
          {/* Card 1: Resume Screening (Cyan Accent) */}
          <div 
            className="admin-action-tile tile-cyan"
            onClick={() => setActiveTab('applicants')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className='bx bx-file-find' style={{ fontSize: '20px', color: '#0284c7' }}></i>
                </div>
                <span style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '800' }}>
                  {stats.pendingResumesCount} Pending
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>
                Resume Screening
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Review incoming resumes and evaluate applicant qualification scores.
              </p>
            </div>
            
            <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              Launch Screening &rarr;
            </div>
          </div>

          {/* Card 2: Interview Management (Emerald Accent) */}
          <div 
            className="admin-action-tile tile-emerald"
            onClick={() => setActiveTab('interviews')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className='bx bx-calendar-check' style={{ fontSize: '20px', color: '#059669' }}></i>
                </div>
                <span style={{ background: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '800' }}>
                  {stats.pendingInterviewsCount} Ready
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>
                Interview Management
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Assign schedule slots and track applicant interview outcomes.
              </p>
            </div>

            <div style={{ fontSize: '12px', color: '#059669', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              Manage Schedules &rarr;
            </div>
          </div>

          {/* Card 3: Chatbot Intelligence (Amber Accent) */}
          <div 
            className="admin-action-tile tile-amber"
            onClick={() => setActiveTab('chatbot_kb')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className='bx bx-bot' style={{ fontSize: '20px', color: '#c2410c' }}></i>
                </div>
                <span style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '800' }}>
                  {stats.unansweredChatbotCount} Inquiries
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>
                Chatbot Intelligence
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Train AI knowledge base and respond to unmatched candidate queries.
              </p>
            </div>

            <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              Train Knowledge Base &rarr;
            </div>
          </div>

          {/* Card 4: Job Posting (Purple Accent) */}
          <div 
            className="admin-action-tile tile-purple"
            onClick={() => setActiveTab('jobs')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className='bx bx-briefcase-alt-2' style={{ fontSize: '20px', color: '#7c3aed' }}></i>
                </div>
                <span style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '4px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '800' }}>
                  {stats.activeRolesCount} Published
                </span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>
                Job Posting
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Publish new career vacancies, salary ranges, and job criteria.
              </p>
            </div>

            <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              Manage Vacancies &rarr;
            </div>
          </div>

        </div>
      </div>

      {/* ── TIER 4: Bottom Row — Active Candidate Pipeline Table ── */}
      <div className="admin-table-card">
        {/* Table Header Section */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Candidate Pipeline
              </h3>
              <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '12px' }}>
                {recentApps.length} In-Progress
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'block' }}>
              Live candidates actively undergoing resume screening and interview evaluations
            </span>
          </div>
          
          <button 
            onClick={() => setActiveTab('master_list')}
            style={{
              background: 'rgba(230, 0, 126, 0.08)',
              border: '1px solid rgba(230, 0, 126, 0.25)',
              color: '#e6007e',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontFamily: "'Montserrat', sans-serif",
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#e6007e';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(230, 0, 126, 0.08)';
              e.currentTarget.style.color = '#e6007e';
            }}
          >
            View All Audit Records &rarr;
          </button>
        </div>

        {/* Table Body */}
        {loading ? (
          <TableSkeleton
            columns={['Candidate', 'Applied Position', 'Current Stage', 'Schedule', 'Status']}
            columnTypes={['avatar', 'text', 'text', 'date', 'status']}
            rows={4}
          />
        ) : fetchError ? (
          <DatabaseErrorState
            title="Unable to Load Pipeline Data"
            message={fetchError}
            onRetry={fetchDashboardOverviewData}
          />
        ) : recentApps.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', background: '#ffffff' }}>
            <i className='bx bx-check-circle' style={{ fontSize: '40px', color: '#10b981', marginBottom: '8px' }}></i>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>All Clear! No Active Pending Candidates</div>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>All candidates have been evaluated and recorded in audit records.</div>
          </div>
        ) : (
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Candidate</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Applied Position</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Current Stage</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Schedule</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentApps.map((app, idx) => {
                const candidateName = app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'Applicant';
                const candidateEmail = app.candidate_email || app.User_Email || '—';
                const initials = getInitials(candidateName);
                const avatarBg = getAvatarBg(idx);

                return (
                  <tr key={app.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}>
                    
                    {/* Candidate Name, Avatar & Email */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="admin-avatar-initials" style={{ background: avatarBg }}>
                          {initials}
                        </div>
                        <div className="admin-candidate-cell">
                          <span className="admin-candidate-name" style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                            {candidateName}
                          </span>
                          <span className="admin-candidate-email" style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {candidateEmail}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Applied Position */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-block', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 10px' }}>
                        <strong style={{ fontSize: '12.5px', color: '#1e293b' }}>
                          {app.job_title || 'General Position'}
                        </strong>
                      </div>
                    </td>

                    {/* Current Stage */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      {app.isScreening ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: '#f0f9ff',
                          color: '#0369a1',
                          border: '1px solid #bae6fd'
                        }}>
                          <i className='bx bx-file-blank' style={{ color: '#0284c7', fontSize: '14px' }}></i>
                          Resume Screening
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: '#fdf2f8',
                          color: '#be123c',
                          border: '1px solid #fbcfe8'
                        }}>
                          <i className='bx bx-calendar-event' style={{ color: '#e6007e', fontSize: '14px' }}></i>
                          Interview Phase
                        </span>
                      )}
                    </td>

                    {/* Schedule / Date */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle', fontSize: '12.5px', color: '#475569', fontWeight: app.isScreening ? '500' : '600' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className={app.isScreening ? 'bx bx-time-five' : 'bx bx-alarm'} style={{ color: '#94a3b8' }}></i>
                        {app.schedule}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '16px 24px', verticalAlign: 'middle' }}>
                      {getStatusBadge(app.status)}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
};

export default OverviewTab;

