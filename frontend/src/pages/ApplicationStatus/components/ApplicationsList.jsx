import React from 'react';
import { useNavigate } from 'react-router-dom';
import ApplicationCard from './ApplicationCard';
import { CardSkeleton } from '../../../components/Loading';

const ApplicationsList = ({
  applications,
  loadingApps,
  interviewDetails,
  scheduleActionLoading,
  scheduleActionFeedback,
  onScheduleResponse,
  onWithdrawApplication,
  onRespondJobOffer,
  isHiredUser,
}) => {
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = React.useState(false);

  if (loadingApps) {
    return <CardSkeleton count={3} layout="list" />;
  }

  if (applications.length === 0) {
    return (
      <div className="apps-empty">
        <i className="bx bx-briefcase apps-empty__icon"></i>
        <p className="apps-empty__text">You haven’t applied to any job postings yet.</p>
        <button
          className="apps-empty__btn"
          onClick={() => navigate('/vacancy')}
        >
          Explore Vacancies
        </button>
      </div>
    );
  }

  const closedStatuses = [
    'REJECTED', 'SCREENING_REJECTED',
    'SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'DECLINED - UNRESPONSIVE', 'UNRESPONSIVE',
    'FAILED FINAL INTERVIEW', 'INTERVIEW_FAILED', 'FAILED INTERVIEW',
    'FAILED FINAL APPROVAL',
    'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'Candidate No Show', 'NO SHOW', 'NO_SHOW', 'CANDIDATE NO-SHOW',
    'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN',
    'OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED',
    'OFFER EXPIRED', 'OFFER_EXPIRED',
    'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'
  ];

  // Sort applications newest first (by applied_at or id descending)
  const sortedApps = [...applications].sort((a, b) => {
    const timeA = new Date(a.applied_at || a.created_at || 0).getTime();
    const timeB = new Date(b.applied_at || b.created_at || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return (b.id || b.application_id || 0) - (a.id || a.application_id || 0);
  });

  const activeApps = [];
  const closedApps = [];

  // Check if candidate has submitted any non-closed (active/in-progress) application
  const hasActiveApp = sortedApps.some(app => {
    const s = (app.status || '').toUpperCase();
    return !closedStatuses.includes(s);
  });

  sortedApps.forEach((app, idx) => {
    const status = (app.status || '').toUpperCase();
    const isClosed = closedStatuses.includes(status);

    if (!isClosed) {
      activeApps.push(app);
    } else {
      // If applicant was rejected, don't place them in application history yet.
      // Only place them in application history if they have submitted another application again.
      if (!hasActiveApp && idx === 0) {
        activeApps.push(app);
      } else {
        closedApps.push(app);
      }
    }
  });

  return (
    <div className="applications-list">
      {activeApps.length === 0 && closedApps.length > 0 && (
        <div className="apps-empty" style={{ padding: '20px', background: '#f8fafc', borderRadius: '8px', marginBottom: '20px' }}>
          <p className="apps-empty__text" style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            You have no active applications.
          </p>
        </div>
      )}

      {activeApps.map(app => (
        <ApplicationCard
          key={app.id}
          app={app}
          interviewDetails={interviewDetails}
          scheduleActionLoading={scheduleActionLoading}
          scheduleActionFeedback={scheduleActionFeedback}
          onScheduleResponse={onScheduleResponse}
          onWithdrawApplication={onWithdrawApplication}
          onRespondJobOffer={onRespondJobOffer}
          isHiredUser={isHiredUser}
        />
      ))}

      {closedApps.length > 0 && (
        <div className="app-history-section" style={{ marginTop: '32px' }}>
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#334155',
              fontWeight: 600,
              fontSize: '15px',
              transition: 'background 0.2s'
            }}
          >
            <span><i className="bx bx-history" style={{ marginRight: '8px' }} /> Application History ({closedApps.length})</span>
            <i className={`bx bx-chevron-${historyOpen ? 'up' : 'down'}`} style={{ fontSize: '20px' }} />
          </button>

          {historyOpen && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {closedApps.map(app => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  interviewDetails={interviewDetails}
                  scheduleActionLoading={scheduleActionLoading}
                  scheduleActionFeedback={scheduleActionFeedback}
                  onScheduleResponse={onScheduleResponse}
                  onWithdrawApplication={onWithdrawApplication}
                  onRespondJobOffer={onRespondJobOffer}
                  isHiredUser={isHiredUser}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApplicationsList;
