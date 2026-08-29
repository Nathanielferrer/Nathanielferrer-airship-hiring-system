import React, { useState } from 'react';
import ProcessTracker from './ProcessTracker';
import RescheduleModal from './RescheduleModal';
import './ApplicationCard.css';

/**
 * Maps raw application status strings to badge display config.
 * bg/color are applied via inline style on the badge only (color tokens, not layout).
 */
const STATUS_CONFIG = {
  'pending':                  { bg: '#fef3c7', color: '#b45309',  label: 'Under Review'                      },
  'review_required':          { bg: '#fff7ed', color: '#c2410c',  label: 'Action Required'                    },
  'PASSED INITIAL':           { bg: '#d1fae5', color: '#047857',  label: 'Passed Screening'                   },
  'PENDING SCHEDULED':        { bg: '#fef3c7', color: '#b45309',  label: 'Pending Confirmation'               },
  'CONFIRMED':                { bg: '#dcfce7', color: '#15803d',  label: 'Interview Confirmed'                },
  'RESCHEDULING':             { bg: '#fef3c7', color: '#b45309',  label: 'Reschedule Requested'               },
  'INTERVIEW_SCHEDULED':      { bg: '#dcfce7', color: '#15803d',  label: 'Interview Scheduled'                },
  'Passed Final Interview':   { bg: '#dcfce7', color: '#15803d',  label: 'Passed Final Interview'             },
  'PASSED FINAL INTERVIEW':   { bg: '#dcfce7', color: '#15803d',  label: 'Passed Final Interview'             },
  'Passed Final Approval':    { bg: '#ecfdf5', color: '#047857',  label: 'Officially Hired'                   },
  'PASSED FINAL APPROVAL':    { bg: '#ecfdf5', color: '#047857',  label: 'Officially Hired'                   },
  'HIRED':                    { bg: '#ecfdf5', color: '#047857',  label: 'Officially Hired'                   },
  'Requirements Verified':    { bg: '#dcfce7', color: '#15803d',  label: 'Requirements Verified'             },
  'REQUIREMENTS_VERIFIED':    { bg: '#dcfce7', color: '#15803d',  label: 'Requirements Verified'             },
  'Contract Signing Scheduled': { bg: '#dcfce7', color: '#15803d', label: 'Contract Signing Scheduled'       },
  'CONTRACT_SIGNING_SCHEDULED': { bg: '#dcfce7', color: '#15803d', label: 'Contract Signing Scheduled'       },
  'Contract Signed & Onboarded': { bg: '#ecfdf5', color: '#047857', label: 'Officially Hired & Onboarded'    },
  'CONTRACT_SIGNED_AND_ONBOARDED': { bg: '#ecfdf5', color: '#047857', label: 'Officially Hired & Onboarded'  },
  'Officially Hired & Signed': { bg: '#ecfdf5', color: '#047857', label: 'Officially Hired & Onboarded'      },
  'Failed Final Interview':   { bg: '#fee2e2', color: '#b91c1c',  label: 'Interview Not Passed'               },
  'FAILED FINAL INTERVIEW':   { bg: '#fee2e2', color: '#b91c1c',  label: 'Interview Not Passed'               },
  'Failed Final Approval':    { bg: '#f1f5f9', color: '#334155',  label: 'Not Selected (Executive Review)'   },
  'FAILED FINAL APPROVAL':    { bg: '#f1f5f9', color: '#334155',  label: 'Not Selected (Executive Review)'   },
  'Candidate Withdrew':       { bg: '#f1f5f9', color: '#475569',  label: 'Candidate Withdrew'                 },
  'CANDIDATE WITHDREW':       { bg: '#f1f5f9', color: '#475569',  label: 'Candidate Withdrew'                 },
  'CANDIDATE_WITHDREW':       { bg: '#f1f5f9', color: '#475569',  label: 'Candidate Withdrew'                 },
  'Incomplete Requirements':   { bg: '#fff1f2', color: '#be123c',  label: 'Incomplete Requirements'            },
  'INCOMPLETE REQUIREMENTS':   { bg: '#fff1f2', color: '#be123c',  label: 'Incomplete Requirements'            },
  'INCOMPLETE_REQUIREMENTS':   { bg: '#fff1f2', color: '#be123c',  label: 'Incomplete Requirements'            },
  'Failed Pre-Employment':     { bg: '#fee2e2', color: '#b91c1c',  label: 'Failed Pre-Employment'              },
  'FAILED PRE-EMPLOYMENT':     { bg: '#fee2e2', color: '#b91c1c',  label: 'Failed Pre-Employment'              },
  'FAILED_PRE_EMPLOYMENT':     { bg: '#fee2e2', color: '#b91c1c',  label: 'Failed Pre-Employment'              },
  'rejected':                 { bg: '#fee2e2', color: '#b91c1c',  label: 'Not Selected'                       },
  'SCREENING_REJECTED':       { bg: '#fee2e2', color: '#b91c1c',  label: 'Not Selected'                       },
  'INTERVIEW_FAILED':         { bg: '#fee2e2', color: '#b91c1c',  label: 'Interview Not Passed'               },
  'FAILED INTERVIEW':         { bg: '#fee2e2', color: '#b91c1c',  label: 'Interview Not Passed'               },
  'DECLINED - UNRESPONSIVE':  { bg: '#f1f5f9', color: '#475569',  label: 'Declined'                           },
};

/**
 * Renders a single application status card:
 * - Job title + applied date header with status badge
 * - 5-stage Process Tracker
 * - Contextual panels per status (notices, rejection letters, interview cards, hired roadmap)
 * - Reschedule modal trigger
 */
const ApplicationCard = ({
  app,
  interviewDetails,
  scheduleActionLoading,
  scheduleActionFeedback,
  onScheduleResponse,
  onWithdrawApplication,
}) => {
  const badge     = STATUS_CONFIG[app.status] || { bg: '#f1f5f9', color: '#475569', label: app.status };
  const details   = interviewDetails[app.id];
  const feedback  = scheduleActionFeedback[app.id];
  const isLoading = scheduleActionLoading[app.id];

  // Normalised status flags
  const normStatus                 = (app.status || '').toUpperCase();
  const isInitialScreening         = ['PENDING', 'REVIEW_REQUIRED'].includes(normStatus);
  const isPassedInitial            = normStatus === 'PASSED INITIAL';
  const hasPendingAction           = normStatus === 'PENDING SCHEDULED';
  const isConfirmed                = normStatus === 'CONFIRMED' || normStatus === 'INTERVIEW_SCHEDULED';
  const isRescheduling             = normStatus === 'RESCHEDULING';
  const isPassedFinalInterview     = ['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(normStatus);
  const isHired                    = ['HIRED', 'PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED / PASSED'].includes(normStatus);
  const isReqVerified              = ['REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED'].includes(normStatus);
  const isContractScheduled        = ['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(normStatus);
  const isContractSigned           = ['CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED'].includes(normStatus);
  const isScreeningRejected        = ['REJECTED', 'SCREENING_REJECTED'].includes(normStatus);
  const isInterviewFailed          = ['INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED'].includes(normStatus);
  const isFailedFinalApproval      = ['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes(normStatus);
  const isWithdrawn                = ['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW'].includes(normStatus);
  const isIncompleteRequirements   = ['INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS'].includes(normStatus);
  const isFailedPreEmployment       = ['FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes(normStatus);

  // Resolve candidate display name
  const candidateName = (() => {
    if (app.candidate_name?.trim()) return app.candidate_name.trim();
    try {
      const u = JSON.parse(localStorage.getItem('hiring_user') || '{}');
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      if (name) return name;
    } catch (_) {}
    return 'Applicant';
  })();

  // Reschedule modal state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const handleRescheduleConfirm = async (reason, slotId) => {
    setRescheduleSubmitting(true);
    try {
      await onScheduleResponse(app.id, 'reschedule', { reason, slotId });
    } finally {
      setRescheduleSubmitting(false);
      setRescheduleModalOpen(false);
    }
  };

  /** Formats raw date + optional time strings into a readable schedule label. */
  const formatSchedule = (date, time, endTime) => {
    if (!date) return '';
    const datePart = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    if (!time) return datePart;
    const fmt = (t) => new Date(`1970-01-01T${t}`).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });
    const timePart = endTime ? `${fmt(time)} - ${fmt(endTime)}` : fmt(time);
    return `${datePart}, ${timePart}`;
  };

  // ── Shared: Schedule detail rows (used in both action card and confirmed card) ──
  const ScheduleDetails = () => (
    <div className="app-card__details">
      <div className="app-card__detail-row">
        <div className="app-card__detail-label">
          <i className="bx bx-calendar" />
          <span>Schedule:</span>
        </div>
        <span className="app-card__detail-value--bold">
          {formatSchedule(details.scheduled_date, details.scheduled_time, details.end_time)}
        </span>
      </div>
      <div className="app-card__detail-row">
        <div className="app-card__detail-label">
          <i className="bx bx-map-pin" />
          <span>Location:</span>
        </div>
        <span>{details.location}</span>
      </div>
      <div className="app-card__detail-row">
        <div className="app-card__detail-label">
          <i className="bx bx-file" />
          <span>Bring:</span>
        </div>
        <span>{(details.requirements || ['Resume']).join(', ')}</span>
      </div>
    </div>
  );

  // ── Shared: Rejection letter wrapper ──
  const RejectionLetter = ({ subject, children }) => (
    <div className="app-card__letter">
      <div className="app-card__letter-subject">
        <span className="app-card__letter-subject-label">Subject:</span>
        <span className="app-card__letter-subject-title">{subject}</span>
      </div>
      <div className="app-card__letter-body">
        <p className="app-card__letter-greeting">Hi {candidateName},</p>
        {children}
        <div className="app-card__letter-regards">
          <p>Regards,</p>
          <p className="app-card__letter-sender">The Hiring Team at Airship Express</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-card">

      {/* ── Card Header: Job title, applied date, status badge ── */}
      <div className="app-card__header">
        <div className="app-card__header-info">
          <div className="app-card__title-row">
            <i className="bx bx-briefcase app-card__title-icon" />
            <span className="app-card__job-title">{app.job_title}</span>
          </div>
          <span className="app-card__applied-date">
            Applied on: {new Date(app.applied_at).toLocaleDateString()}
          </span>
        </div>

        <span
          className="app-card__badge"
          style={{ background: badge.bg, color: badge.color }}
        >
          {badge.label}
        </span>
      </div>

      {/* ── 4-Stage Process Tracker ── */}
      <ProcessTracker status={app.status} />

      {/* ── PENDING / REVIEW_REQUIRED: Resume Under Review Notice ── */}
      {isInitialScreening && (
        <div className="app-card__notice app-card__notice--pending">
          <div className="app-card__notice-icon app-card__notice-icon--pending">
            <i className="bx bx-time-five" />
          </div>
          <div>
            <p className="app-card__notice-title">Application Under Initial Review</p>
            <p className="app-card__notice-body">
              Your resume is currently under review. If your qualifications pass the initial
              screening, our HR team will call you to schedule a 10-minute initial phone screening.
            </p>
          </div>
        </div>
      )}

      {/* ── PASSED INITIAL: Awaiting Interview Slot ── */}
      {isPassedInitial && (
        <div className="app-card__notice app-card__notice--passed">
          <div className="app-card__notice-icon app-card__notice-icon--passed">
            <i className="bx bx-check-circle" />
          </div>
          <div>
            <p className="app-card__notice-title app-card__notice-title--passed">
              Initial Screening Passed
            </p>
            <p className="app-card__notice-body app-card__notice-body--passed">
              Your resume screening is complete. Our recruitment team is preparing your interview
              schedule and you will be notified shortly.
            </p>
          </div>
        </div>
      )}

      {/* ── PASSED FINAL INTERVIEW: Notice ── */}
      {isPassedFinalInterview && (
        <div className="app-card__notice app-card__notice--passed-interview">
          <div className="app-card__notice-icon app-card__notice-icon--passed-interview">
            <i className="bx bx-check-shield" />
          </div>
          <div>
            <p className="app-card__notice-title app-card__notice-title--passed-interview" style={{ margin: '0 0 4px 0' }}>
              Congratulations! You Passed the Final Interview
            </p>
            <p className="app-card__notice-body app-card__notice-body--passed-interview" style={{ margin: 0 }}>
              You have successfully passed your final interview. Your application is now undergoing final approval, and you will receive an official update once concluded.
            </p>
          </div>
        </div>
      )}

      {/* ── SCREENING REJECTED: Rejection Letter ── */}
      {isScreeningRejected && (
        <RejectionLetter subject={`Update on your application for ${app.job_title || 'Position'}`}>
          <p>Thank you for applying to be a {app.job_title || 'team member'} at Airship Express.</p>
          <p>
            We have reviewed your resume during our initial screening. Unfortunately, we will not
            be moving forward with your application at this time. We are currently looking for
            candidates whose experience is a closer match for what we need right now.
          </p>
          <p>Thank you for your time, and we wish you the best of luck in finding a great job.</p>
        </RejectionLetter>
      )}

      {/* ── INTERVIEW FAILED: Rejection Letter ── */}
      {isInterviewFailed && (
        <RejectionLetter subject="Thank you from Airship Express">
          <p>
            Thank you for coming in today and completing your face-to-face interview for the{' '}
            {app.job_title || 'position'} position. We really appreciate the time and effort you
            took to travel and meet with our team.
          </p>
          <p>
            We are grateful that you considered joining Airship Express. It was a pleasure getting
            to know you, and we wish you the very best of luck in your future work!
          </p>
        </RejectionLetter>
      )}

      {/* ── FAILED FINAL APPROVAL: Executive Rejection Letter ── */}
      {isFailedFinalApproval && (
        <RejectionLetter subject={`Application Update for ${app.job_title || 'Position'}`}>
          <p>Thank you for taking part in our recruitment and interview process for the {app.job_title || 'position'} role at Airship Express.</p>
          <p>
            You performed commendably throughout our interview stages. However, following final executive review by our Company President and leadership team, we regret to inform you that we will not be extending an employment offer at this time.
          </p>
          <p>
            We sincerely appreciate the effort, time, and dedication you invested in meeting with us, and we wish you continued success in your career journey.
          </p>
        </RejectionLetter>
      )}

      {/* ── PENDING SCHEDULED: Interview Action Card ── */}
      {hasPendingAction && details && !feedback && (
        <div className="app-card__action-panel">
          <div className="app-card__action-heading">
            <p className="app-card__action-title">Final Interview Scheduled — Action Required</p>
            <p className="app-card__action-subtitle">
              Please accept your schedule or request a reschedule below.
            </p>
          </div>

          <ScheduleDetails />

          <div className="app-card__action-btns">
            <button
              className="app-card__btn app-card__btn--accept"
              disabled={isLoading}
              onClick={() => onScheduleResponse(app.id, 'confirm')}
            >
              <i className="bx bx-check" />
              <span>{isLoading ? 'Processing...' : 'Accept Schedule'}</span>
            </button>

            <button
              className="app-card__btn app-card__btn--reschedule"
              disabled={isLoading}
              onClick={() => setRescheduleModalOpen(true)}
            >
              <i className="bx bx-calendar-x" />
              <span>{isLoading ? 'Processing...' : 'Reschedule'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Post-action feedback banner ── */}
      {feedback && (
        <div className={`app-card__feedback ${
          feedback.type === 'confirm'
            ? 'app-card__feedback--confirm'
            : 'app-card__feedback--default'
        }`}>
          {feedback.type === 'confirm'
            ? <i className="bx bx-check-circle" />
            : <i className="bx bx-time-five" />
          }
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── CONFIRMED / INTERVIEW_SCHEDULED: Confirmed Details Card ── */}
      {isConfirmed && details && !feedback && (
        <div className="app-card__confirmed-panel">
          <p className="app-card__confirmed-header">
            <i className="bx bx-check-circle" />
            <span>You have confirmed your schedule. See you there!</span>
          </p>
          <ScheduleDetails />
        </div>
      )}

      {/* ── RESCHEDULING: Pending Request Notice ── */}
      {isRescheduling && !feedback && (
        <div className="app-card__notice app-card__notice--rescheduling">
          <i className="bx bx-time-five app-card__notice-icon--rescheduling" />
          <span>
            Your reschedule request has been submitted. Our recruitment team will contact you
            with a new schedule.
          </span>
        </div>
      )}

      {/* ── CANDIDATE WITHDREW: Notice ── */}
      {isWithdrawn && (
        <div className="app-card__notice app-card__notice--withdrawn">
          <div className="app-card__notice-icon app-card__notice-icon--withdrawn">
            <i className="bx bx-user-minus" />
          </div>
          <div>
            <p className="app-card__notice-title app-card__notice-title--withdrawn">
              Application Withdrawn
            </p>
            <p className="app-card__notice-body app-card__notice-body--withdrawn">
              This application has been recorded as withdrawn. If you wish to apply for future opportunities at Airship Express, you are welcome to submit a new application when job openings are active.
            </p>
          </div>
        </div>
      )}

      {/* ── INCOMPLETE REQUIREMENTS: Notice ── */}
      {isIncompleteRequirements && (
        <div className="app-card__notice app-card__notice--incomplete-req">
          <div className="app-card__notice-icon app-card__notice-icon--incomplete-req">
            <i className="bx bx-time-five" />
          </div>
          <div>
            <p className="app-card__notice-title app-card__notice-title--incomplete-req">
              Submission Deadline Passed (Incomplete Requirements)
            </p>
            <p className="app-card__notice-body app-card__notice-body--incomplete-req">
              The 7-day submission window for your pre-employment requirements has lapsed without complete document submission. As a result, your conditional employment offer for {app.job_title || 'this position'} has expired. For assistance or inquiries, please contact the HR Department.
            </p>
          </div>
        </div>
      )}

      {/* ── FAILED PRE-EMPLOYMENT: Notice ── */}
      {isFailedPreEmployment && (
        <div className="app-card__notice app-card__notice--failed-pre-emp">
          <div className="app-card__notice-icon app-card__notice-icon--failed-pre-emp">
            <i className="bx bx-error-circle" />
          </div>
          <div>
            <p className="app-card__notice-title app-card__notice-title--failed-pre-emp">
              Pre-Employment Clearance Not Met
            </p>
            <p className="app-card__notice-body app-card__notice-body--failed-pre-emp">
              Thank you for your cooperation during the pre-employment verification phase. Based on the evaluation of mandatory medical and pre-employment requirements, we are unable to proceed with your onboarding for {app.job_title || 'this position'}. We wish you success in your future endeavors.
            </p>
          </div>
        </div>
      )}

      {/* ── CONTRACT SIGNED & ONBOARDED: Official Welcome Banner ── */}
      {isContractSigned && (
        <div className="app-card__hired-panel" style={{ borderLeft: '4px solid #059669', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' }}>
          <div className="app-card__hired-headline">
            <i className="bx bx-check-double app-card__hired-badge-icon" style={{ background: '#dcfce7', color: '#059669' }} />
            <h4 className="app-card__hired-title" style={{ color: '#065f46' }}>Welcome to Airship Express! Employment Contract Executed</h4>
          </div>
          <p className="app-card__hired-welcome" style={{ color: '#334155', lineHeight: 1.6 }}>
            Congratulations <strong>{candidateName}</strong>! Your employment contract for <strong>{app.job_title || 'Position'}</strong> has been signed, and you are officially hired. Your new hire training will begin the following next week. Welcome aboard!
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0', marginTop: '14px' }}>
            <i className="bx bx-party" style={{ fontSize: '18px', color: '#059669' }} />
            <span style={{ fontSize: '12.5px', color: '#065f46', fontWeight: '600' }}>
              Your training will begin the following next week. Your HR onboarding coordinator will provide your first-day reporting instructions and orientation schedule.
            </span>
          </div>
        </div>
      )}

      {/* ── CONTRACT SIGNING SCHEDULED: Dedicated Appointment Card ── */}
      {isContractScheduled && !isContractSigned && (() => {
        const dateObj = app.contract_signing_date ? new Date(app.contract_signing_date + 'T00:00:00') : null;
        const formattedSigningDate = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Scheduled Date Pending';
        const signingTime = app.contract_signing_time || '—';
        const signingLocation = app.contract_signing_location || 'Airship Express Main Office - HR Department (352 T. Pinpin Escolta St., Binondo, Manila)';
        const signingNotes = app.contract_signing_notes || '';

        return (
          <div className="app-card__hired-panel" style={{ borderLeft: '4px solid #059669', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' }}>
            <div className="app-card__hired-headline">
              <i className="bx bx-calendar-check app-card__hired-badge-icon" style={{ background: '#dcfce7', color: '#059669' }} />
              <h4 className="app-card__hired-title" style={{ color: '#065f46' }}>Employment Contract Signing &amp; Onboarding Orientation</h4>
            </div>
            <p className="app-card__hired-welcome" style={{ color: '#334155' }}>
              All your pre-employment documents have been verified. You are scheduled to execute your official employment contract for <strong>{app.job_title || 'Position'}</strong>.
            </p>

            {/* Appointment Details Grid */}
            <div style={{ background: '#ffffff', border: '1.5px solid #a7f3d0', borderRadius: '10px', padding: '16px', margin: '16px 0', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="bx bx-calendar" style={{ fontSize: '18px', color: '#059669', marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Date</span>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{formattedSigningDate}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="bx bx-time" style={{ fontSize: '18px', color: '#059669', marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Time</span>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{signingTime}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', gridColumn: '1 / -1' }}>
                  <i className="bx bx-map-pin" style={{ fontSize: '18px', color: '#059669', marginTop: '2px' }} />
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Venue / Location</span>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{signingLocation}</strong>
                  </div>
                </div>
              </div>

              {signingNotes && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #d1fae5' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    Instructions &amp; What to Bring:
                  </span>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>
                    {signingNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── REQUIREMENTS VERIFIED: Next Contract Signing Notice ── */}
      {isReqVerified && !isContractScheduled && !isContractSigned && (
        <div className="app-card__hired-panel" style={{ borderLeft: '4px solid #10b981', background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)' }}>
          <div className="app-card__hired-headline">
            <i className="bx bx-check-circle app-card__hired-badge-icon" style={{ background: '#d1fae5', color: '#059669' }} />
            <h4 className="app-card__hired-title" style={{ color: '#065f46' }}>Physical Pre-Employment Requirements Verified</h4>
          </div>
          <p className="app-card__hired-welcome" style={{ color: '#334155', lineHeight: 1.6 }}>
            All your mandatory pre-employment physical documents have been submitted and verified by HR. 
            Our recruitment team is currently preparing your employment contract and will notify you with your official contract signing schedule shortly.
          </p>
        </div>
      )}

      {/* ── HIRED: Pre-Employment Requirements & Onboarding Panel (Merged Clean Layout) ── */}
      {isHired && !isReqVerified && !isContractScheduled && !isContractSigned && (() => {
        const baseDate = app.updated_at || app.applied_at || new Date().toISOString();
        const dObj = new Date(baseDate);
        const deadlineObj = new Date(dObj.getTime() + 7 * 24 * 60 * 60 * 1000);
        const deadlineDateFormatted = deadlineObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

        return (
          <div className="app-card__hired-panel">
            <div>
              <div className="app-card__hired-headline">
                <i className="bx bx-award app-card__hired-badge-icon" />
                <h4 className="app-card__hired-title">Official Notice: Final Executive Approval &amp; Employment Offer</h4>
              </div>
              <p className="app-card__hired-welcome">
                Congratulations! Your application for <strong>{app.job_title || 'Position'}</strong> has received final executive approval. We are excited to welcome you to the Airship Express team.
              </p>
            </div>

            {/* Merged Single Container: Prominent Deadline Header + Requirements Checklist */}
            <div className="app-card__requirements-list-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0', marginBottom: '14px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Submission Deadline</span>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>{deadlineDateFormatted}</strong>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: '700', background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: '12px' }}>
                  Within 7 Calendar Days
                </span>
              </div>

              <p className="app-card__requirements-list-heading">
                Mandatory Pre-Employment Document Checklist:
              </p>

              <ol className="app-card__requirements-clean-list">
                <li className="app-card__requirements-clean-item">
                  <strong>Medical Certificate:</strong> Fit to Work assessment issued by an accredited clinic.
                </li>
                <li className="app-card__requirements-clean-item">
                  <strong>Drug Test Result:</strong> Official negative screening result from an accredited diagnostic center.
                </li>
                <li className="app-card__requirements-clean-item">
                  <strong>NBI Clearance:</strong> Valid, updated original clearance document.
                </li>
                <li className="app-card__requirements-clean-item">
                  <strong>Police Clearance:</strong> Issued by your local police station or precinct.
                </li>
                <li className="app-card__requirements-clean-item">
                  <strong>Certificate of Employment (COE):</strong> From your most recent employer (if previously employed).
                </li>
                <li className="app-card__requirements-clean-item">
                  <strong>Transcript of Records (TOR) or Diploma:</strong> Photocopy (please bring original document for verification).
                </li>
              </ol>
            </div>

            <div className="app-card__hired-footer-note">
              <i className="bx bx-info-circle" style={{ fontSize: '18px', color: '#047857', flexShrink: 0 }} />
              <span>
                Please submit all physical documents directly to our HR Main Office during business hours on or before your deadline.
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── Active Application Withdrawal Option (Excluded once Contract is Signed or Concluded) ── */}
      {!['REJECTED', 'SCREENING_REJECTED', 'INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED', 'DECLINED - UNRESPONSIVE', 'CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED', 'FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS', 'FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes(normStatus) && onWithdrawApplication && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #f1f5f9'
        }}>
          <button
            type="button"
            onClick={() => onWithdrawApplication(app.id, app.job_title)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: '600',
              fontFamily: "'Inter', sans-serif",
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'color 0.2s ease',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#ef4444'; }}
            onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
            title="Cancel and withdraw your application for this position"
          >
            <i className="bx bx-trash" style={{ fontSize: '14px' }} />
            <span>Cancel / Withdraw Application</span>
          </button>
        </div>
      )}

      {/* ── Reschedule Modal (portal) ── */}
      <RescheduleModal
        isOpen={rescheduleModalOpen}
        onClose={() => setRescheduleModalOpen(false)}
        onConfirm={handleRescheduleConfirm}
        isSubmitting={rescheduleSubmitting}
      />
    </div>
  );
};

export default ApplicationCard;
