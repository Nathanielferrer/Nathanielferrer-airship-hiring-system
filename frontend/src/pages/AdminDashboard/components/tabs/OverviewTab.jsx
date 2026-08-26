import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost/Hiring%20System/backend';

const OverviewTab = ({ setActiveTab }) => {
  const [loading, setLoading] = useState(true);
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
    try {
      const [jobsRes, appsRes, agendaRes, kbRes] = await Promise.all([
        fetch(`${API_BASE}/jobs/get_jobs.php`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/applications/get_all_applications.php`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/interviews/get_agenda.php`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_BASE}/chatbot/get_unanswered.php`).then(r => r.json()).catch(() => ({}))
      ]);

      const jobsList = jobsRes.status === 'success' ? (jobsRes.jobs || []) : [];
      const appsList = appsRes.status === 'success' ? (appsRes.applications || []) : [];
      const agendaList = agendaRes.status === 'success' ? (agendaRes.agenda || []) : [];
      const kbList = kbRes.status === 'success' ? (kbRes.entries || []) : [];

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

    if (['HIRED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'PASSED INTERVIEW', 'PASSED', 'HIRED / PASSED'].includes(statusText)) {
      badgeColor = '#047857';
      badgeBg = '#d1fae5';
      badgeBorder = '#a7f3d0';
      label = 'PASSED FINAL APPROVAL (HIRED)';
    } else if (['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(statusText)) {
      badgeColor = '#7c3aed';
      badgeBg = '#f3e8ff';
      badgeBorder = '#d8b4fe';
      label = 'PASSED FINAL INTERVIEW';
    } else if (['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes(statusText)) {
      badgeColor = '#334155';
      badgeBg = '#f1f5f9';
      badgeBorder = '#cbd5e1';
      label = 'FAILED FINAL APPROVAL';
    } else if (['FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED INTERVIEW', 'INTERVIEW_FAILED'].includes(statusText)) {
      badgeColor = '#b91c1c';
      badgeBg = '#fee2e2';
      badgeBorder = '#fecaca';
      label = 'FAILED FINAL INTERVIEW';
    } else if (statusText === 'PASSED INITIAL' || statusText === 'SHORTLISTED') {
      badgeColor = '#047857';
      badgeBg = '#d1fae5';
      badgeBorder = '#a7f3d0';
      label = 'PASSED INITIAL';
    } else if (statusText === 'PENDING SCHEDULED') {
      badgeColor = '#c2410c';
      badgeBg = '#ffedd5';
      badgeBorder = '#fed7aa';
      label = 'PENDING SCHEDULE';
    } else if (['CONFIRMED', 'INTERVIEW_SCHEDULED'].includes(statusText)) {
      badgeColor = '#15803d';
      badgeBg = '#dcfce7';
      badgeBorder = '#bbf7d0';
      label = 'CONFIRMED SCHEDULE';
    } else if (statusText === 'RESCHEDULING') {
      badgeColor = '#b45309';
      badgeBg = '#fff7ed';
      badgeBorder = '#fed7aa';
      label = 'RESCHEDULING';
    } else if (['SCREENING_REJECTED', 'REJECTED'].includes(statusText)) {
      badgeColor = '#b91c1c';
      badgeBg = '#fee2e2';
      badgeBorder = '#fecaca';
      label = 'REJECTED';
    } else if (statusText === 'DECLINED - UNRESPONSIVE') {
      badgeColor = '#475569';
      badgeBg = '#f1f5f9';
      badgeBorder = '#cbd5e1';
    } else if (['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW'].includes(statusText)) {
      badgeColor = '#475569';
      badgeBg = '#f1f5f9';
      badgeBorder = '#cbd5e1';
      label = 'CANDIDATE WITHDREW';
    } else if (['INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS'].includes(statusText)) {
      badgeColor = '#be123c';
      badgeBg = '#fff1f2';
      badgeBorder = '#fecdd3';
      label = 'INCOMPLETE REQUIREMENTS';
    } else if (['FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes(statusText)) {
      badgeColor = '#b91c1c';
      badgeBg = '#fef2f2';
      badgeBorder = '#fecaca';
      label = 'FAILED PRE-EMPLOYMENT';
    } else if (statusText === 'ARCHIVED') {
      badgeColor = '#64748b';
      badgeBg = '#f1f5f9';
      badgeBorder = '#cbd5e1';
      label = 'ARCHIVED';
    } else {
      badgeColor = '#b45309';
      badgeBg = '#fef3c7';
      badgeBorder = '#fde68a';
      label = 'PENDING';
    }

    return (
      <span style={{
        display: 'inline-block',
        fontSize: '11px',
        fontWeight: '700',
        textTransform: 'uppercase',
        padding: '4px 12px',
        borderRadius: '20px',
        background: badgeBg,
        color: badgeColor,
        border: `1px solid ${badgeBorder}`,
        letterSpacing: '0.04em'
      }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* ── Page Header ── */}
      <div className="admin-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="admin-header-title">Overview</h1>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: '4px 0 0 0' }}>
            High-level recruitment metrics and urgent task action launchpad.
          </p>
        </div>
        <div style={{ color: '#64748b', fontSize: '13.5px', fontWeight: '600', background: '#ffffff', padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <i className='bx bx-calendar' style={{ marginRight: '6px', color: '#e6007e' }}></i>{formattedDate}
        </div>
      </div>

      {/* ── TIER 1: Overall Hiring Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
        
        {/* Metric Card 1: Total Hired Candidates */}
        <div className="admin-stat-card" style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="admin-stat-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Hired Candidates</span>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className='bx bx-user-check' style={{ fontSize: '22px', color: '#059669' }}></i>
              </div>
            </div>
            <span className="admin-stat-value" style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>
              {loading ? '…' : stats.hiredCount}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <i className='bx bx-trending-up'></i> Placed candidates across all positions
          </span>
        </div>

        {/* Metric Card 2: Active Applicants in Progress */}
        <div className="admin-stat-card" style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="admin-stat-label" style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Applicants in Progress</span>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className='bx bx-user-voice' style={{ fontSize: '22px', color: '#e6007e' }}></i>
              </div>
            </div>
            <span className="admin-stat-value" style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', fontFamily: 'Montserrat, sans-serif' }}>
              {loading ? '…' : stats.activePipelineCount}
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#e6007e', fontWeight: '600', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <i className='bx bx-layer'></i> Candidates currently undergoing evaluation
          </span>
        </div>

      </div>

      {/* ── TIER 2: Middle Row — Pending Tasks & Quick Actions ── */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '8px 0 14px 0', fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Pending Tasks &amp; Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          
          {/* Card 1: Resume Screening */}
          <div 
            onClick={() => setActiveTab('applicants')}
            style={{
              background: '#ffffff', borderRadius: '14px', padding: '20px',
              border: '1.5px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '12px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#0284c7';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(2,132,199,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resume Screening</span>
              <span style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: '800' }}>
                {stats.pendingResumesCount}
              </span>
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
              Awaiting Resume Screening
            </div>
            <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Go to Resume Screening &rarr;
            </span>
          </div>

          {/* Card 2: Interview Management */}
          <div 
            onClick={() => setActiveTab('interviews')}
            style={{
              background: '#ffffff', borderRadius: '14px', padding: '20px',
              border: '1.5px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '12px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#059669';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(5,150,105,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Interview Management</span>
              <span style={{ background: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0', padding: '4px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: '800' }}>
                {stats.pendingInterviewsCount}
              </span>
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
              Candidates Ready for Scheduling
            </div>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Go to Interview Management &rarr;
            </span>
          </div>

          {/* Card 3: Chatbot Intelligence */}
          <div 
            onClick={() => setActiveTab('chatbot_kb')}
            style={{
              background: '#ffffff', borderRadius: '14px', padding: '20px',
              border: '1.5px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '12px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#c2410c';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(194,65,12,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Chatbot Intelligence</span>
              <span style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', padding: '4px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: '800' }}>
                {stats.unansweredChatbotCount}
              </span>
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
              Unmatched Candidate Queries
            </div>
            <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Go to Chatbot Intelligence &rarr;
            </span>
          </div>

          {/* Card 4: Job Posting */}
          <div 
            onClick={() => setActiveTab('jobs')}
            style={{
              background: '#ffffff', borderRadius: '14px', padding: '20px',
              border: '1.5px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '12px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#7c3aed';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(124,58,237,0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Job Posting</span>
              <span style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '4px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: '800' }}>
                {stats.activeRolesCount}
              </span>
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
              Published Job Openings
            </div>
            <span style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Go to Job Posting &rarr;
            </span>
          </div>

        </div>
      </div>

      {/* ── TIER 3: Bottom Row — Active Candidate Pipeline Table ── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden'
      }}>
        {/* Table Header Section */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1.5px solid #cbd5e1',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0f172a', margin: 0, fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active Candidate Pipeline
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Real-time candidate progress across screening and interview phases
            </span>
          </div>
          <button 
            onClick={() => setActiveTab('master_list')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#e6007e',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: "'Montserrat', sans-serif"
            }}
          >
            View All Records &rarr;
          </button>
        </div>

        {/* Table Body */}
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Loading active pipeline data…
          </div>
        ) : recentApps.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: '#ffffff' }}>
            <i className='bx bx-check-circle' style={{ fontSize: '36px', color: '#10b981', marginBottom: '8px' }}></i>
            <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#475569' }}>No Active Candidates in Pipeline</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>All candidates have been evaluated or recorded in audit records.</div>
          </div>
        ) : (
          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: '14px 24px', background: '#f8fafc', color: '#475569', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>Candidate Name</th>
                <th style={{ padding: '14px 24px', background: '#f8fafc', color: '#475569', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>Applied Position</th>
                <th style={{ padding: '14px 24px', background: '#f8fafc', color: '#475569', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>Current Stage</th>
                <th style={{ padding: '14px 24px', background: '#f8fafc', color: '#475569', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>Schedule / Date</th>
                <th style={{ padding: '14px 24px', background: '#f8fafc', color: '#475569', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentApps.map((app) => {
                const candidateName = app.candidate_name || `${app.User_Fname || ''} ${app.User_Lname || ''}`.trim() || 'Applicant';
                const candidateEmail = app.candidate_email || app.User_Email || '—';

                return (
                  <tr key={app.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.15s ease' }}>
                    
                    {/* Candidate Name & Email */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle' }}>
                      <div className="admin-candidate-cell">
                        <span className="admin-candidate-name" style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f172a' }}>
                          {candidateName}
                        </span>
                        <span className="admin-candidate-email" style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {candidateEmail}
                        </span>
                      </div>
                    </td>

                    {/* Applied Position */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle' }}>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                        {app.job_title || 'General Position'}
                      </strong>
                    </td>

                    {/* Current Stage */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle' }}>
                      {app.isScreening ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: '#f8fafc',
                          color: '#475569',
                          border: '1px solid #e2e8f0'
                        }}>
                          <i className='bx bx-file-blank' style={{ color: '#0284c7', fontSize: '14px' }}></i>
                          Resume Screening
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          background: '#fdf2f8',
                          color: '#be185d',
                          border: '1px solid #fbcfe8'
                        }}>
                          <i className='bx bx-calendar-event' style={{ color: '#e6007e', fontSize: '14px' }}></i>
                          Interview Phase
                        </span>
                      )}
                    </td>

                    {/* Schedule / Date */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle', fontSize: '12.5px', color: '#475569', fontWeight: app.isScreening ? '500' : '600' }}>
                      {app.schedule}
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '14px 24px', verticalAlign: 'middle' }}>
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
