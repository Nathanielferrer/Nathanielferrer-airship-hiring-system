import React from 'react';
import { useNavigate } from 'react-router-dom';
import ApplicationCard from './ApplicationCard';

const ApplicationsList = ({
  applications,
  loadingApps,
  interviewDetails,
  scheduleActionLoading,
  scheduleActionFeedback,
  onScheduleResponse,
  onWithdrawApplication,
}) => {
  const navigate = useNavigate();

  if (loadingApps) {
    return (
      <div className="apps-loading">
        <div className="spinner"></div>
      </div>
    );
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

  return (
    <div className="applications-list">
      {applications.map(app => (
        <ApplicationCard
          key={app.id}
          app={app}
          interviewDetails={interviewDetails}
          scheduleActionLoading={scheduleActionLoading}
          scheduleActionFeedback={scheduleActionFeedback}
          onScheduleResponse={onScheduleResponse}
          onWithdrawApplication={onWithdrawApplication}
        />
      ))}
    </div>
  );
};

export default ApplicationsList;
