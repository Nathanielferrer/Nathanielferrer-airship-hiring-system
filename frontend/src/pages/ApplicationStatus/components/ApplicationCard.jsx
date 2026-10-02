import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import ProcessTracker from './ProcessTracker';
import RescheduleModal from './RescheduleModal';
import './ApplicationCard.css';

import { API_BASE_URL } from '../../../utils/apiConfig';
const formatTime12h = (t) => {
  if (!t) return '';
  if (/AM|PM/i.test(t)) return t;
  const parts = t.split(':');
  if (parts.length < 2) return t;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
};

/**
 * Maps raw application status strings to badge display config.
 * bg/color are applied via inline style on the badge only (color tokens, not layout).
 */
const STATUS_CONFIG = {
  // 1. Screening
  'pending': { bg: '#fef3c7', color: '#b45309', label: 'UNDER REVIEW' },
  'review_required': { bg: '#fff7ed', color: '#c2410c', label: 'UNDER REVIEW' },
  'PASSED INITIAL': { bg: '#d1fae5', color: '#047857', label: 'Passed Initial Screening' },
  'Passed Initial Screening': { bg: '#d1fae5', color: '#047857', label: 'Passed Initial Screening' },
  'PASSED INITIAL SCREENING': { bg: '#d1fae5', color: '#047857', label: 'Passed Initial Screening' },
  'rejected': { bg: '#fee2e2', color: '#b91c1c', label: 'Screening Rejected' },
  'SCREENING_REJECTED': { bg: '#fee2e2', color: '#b91c1c', label: 'Screening Rejected' },

  // 2. Final Interview & Scheduling
  'PENDING SCHEDULED': { bg: '#fef3c7', color: '#b45309', label: 'Pending Schedule' },
  'Pending Schedule': { bg: '#fef3c7', color: '#b45309', label: 'Pending Schedule' },
  'PENDING SCHEDULE': { bg: '#fef3c7', color: '#b45309', label: 'Pending Schedule' },
  'CONFIRMED': { bg: '#dcfce7', color: '#15803d', label: 'Confirmed Schedule' },
  'INTERVIEW_SCHEDULED': { bg: '#dcfce7', color: '#15803d', label: 'Confirmed Schedule' },
  'Confirmed Schedule': { bg: '#dcfce7', color: '#15803d', label: 'Confirmed Schedule' },
  'CONFIRMED SCHEDULE': { bg: '#dcfce7', color: '#15803d', label: 'Confirmed Schedule' },
  'RESCHEDULING': { bg: '#fef3c7', color: '#b45309', label: 'Rescheduling Requested' },
  'Rescheduling Requested': { bg: '#fef3c7', color: '#b45309', label: 'Rescheduling Requested' },
  'RESCHEDULING REQUESTED': { bg: '#fef3c7', color: '#b45309', label: 'Rescheduling Requested' },
  'SCHEDULING EXPIRED': { bg: '#fee2e2', color: '#b91c1c', label: 'Scheduling Expired' },
  'SCHEDULING_EXPIRED': { bg: '#fee2e2', color: '#b91c1c', label: 'Scheduling Expired' },
  'Scheduling Expired': { bg: '#fee2e2', color: '#b91c1c', label: 'Scheduling Expired' },
  'DECLINED - UNRESPONSIVE': { bg: '#fee2e2', color: '#b91c1c', label: 'Scheduling Expired' },
  'UNRESPONSIVE': { bg: '#fee2e2', color: '#b91c1c', label: 'Scheduling Expired' },
  'Passed Final Interview': { bg: '#dcfce7', color: '#15803d', label: 'Passed Final Interview' },
  'PASSED FINAL INTERVIEW': { bg: '#dcfce7', color: '#15803d', label: 'Passed Final Interview' },
  'Failed Final Interview': { bg: '#fee2e2', color: '#b91c1c', label: 'Final Interview Failed' },
  'FAILED FINAL INTERVIEW': { bg: '#fee2e2', color: '#b91c1c', label: 'Final Interview Failed' },
  'INTERVIEW_FAILED': { bg: '#fee2e2', color: '#b91c1c', label: 'Final Interview Failed' },
  'FAILED INTERVIEW': { bg: '#fee2e2', color: '#b91c1c', label: 'Final Interview Failed' },

  // 3. Final Approval (President Review)
  'Job Offer Accepted': { bg: '#eff6ff', color: '#1d4ed8', label: 'Job Offer Accepted' },
  'JOB OFFER ACCEPTED': { bg: '#eff6ff', color: '#1d4ed8', label: 'Job Offer Accepted' },
  'Offer Accepted': { bg: '#eff6ff', color: '#1d4ed8', label: 'Job Offer Accepted' },
  'OFFER ACCEPTED': { bg: '#eff6ff', color: '#1d4ed8', label: 'Job Offer Accepted' },
  'Passed Final Approval': { bg: '#eff6ff', color: '#1d4ed8', label: 'Job Offer Accepted' },
  'PASSED FINAL APPROVAL': { bg: '#eff6ff', color: '#1d4ed8', label: 'Job Offer Accepted' },
  'Approved for Job Offer': { bg: '#ecfdf5', color: '#047857', label: 'Ready for Offer' },
  'APPROVED FOR JOB OFFER': { bg: '#ecfdf5', color: '#047857', label: 'Ready for Offer' },
  'President Approved': { bg: '#ecfdf5', color: '#047857', label: 'Ready for Offer' },
  'PRESIDENT APPROVED': { bg: '#ecfdf5', color: '#047857', label: 'Ready for Offer' },
  'Ready for Offer': { bg: '#ecfdf5', color: '#047857', label: 'Ready for Offer' },
  'READY FOR OFFER': { bg: '#ecfdf5', color: '#047857', label: 'Ready for Offer' },
  'Failed Final Approval': { bg: '#f1f5f9', color: '#334155', label: 'President: Rejected' },
  'FAILED FINAL APPROVAL': { bg: '#f1f5f9', color: '#334155', label: 'President: Rejected' },
  'Candidate No Show': { bg: '#fffbeb', color: '#b45309', label: 'Interview: No Show' },
  'CANDIDATE NO SHOW': { bg: '#fffbeb', color: '#b45309', label: 'Interview: No Show' },
  'CANDIDATE_NO_SHOW': { bg: '#fffbeb', color: '#b45309', label: 'Interview: No Show' },
  'Contract Signing No Show': { bg: '#fff1f2', color: '#be123c', label: 'Contract: No Show' },
  'CONTRACT SIGNING NO SHOW': { bg: '#fff1f2', color: '#be123c', label: 'Contract: No Show' },
  'CONTRACT_SIGNING_NO_SHOW': { bg: '#fff1f2', color: '#be123c', label: 'Contract: No Show' },
  'CONTRACT NO SHOW': { bg: '#fff1f2', color: '#be123c', label: 'Contract: No Show' },
  'CONTRACT_NO_SHOW': { bg: '#fff1f2', color: '#be123c', label: 'Contract: No Show' },
  'Passed Final — Waiting for Slot': { bg: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', label: 'Waitlisted' },
  'PASSED FINAL — WAITING FOR SLOT': { bg: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', label: 'Waitlisted' },
  'PASSED FINAL - WAITING FOR SLOT': { bg: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', label: 'Waitlisted' },
  'WAITING_FOR_SLOT': { bg: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', label: 'Waitlisted' },
  'Waitlisted': { bg: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', label: 'Waitlisted' },
  'WAITLISTED': { bg: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', label: 'Waitlisted' },

  // 3.5 Job Offer
  'Job Offer Pending': { bg: '#fff7ed', color: '#c2410c', label: 'Job Offer Pending' },
  'JOB OFFER PENDING': { bg: '#fff7ed', color: '#c2410c', label: 'Job Offer Pending' },
  'JOB_OFFER_PENDING': { bg: '#fff7ed', color: '#c2410c', label: 'Job Offer Pending' },
  'Offer Extended': { bg: '#fff7ed', color: '#c2410c', label: 'Job Offer Pending' },
  'Offer Expired': { bg: '#fee2e2', color: '#b91c1c', label: 'Offer Expired' },
  'OFFER EXPIRED': { bg: '#fee2e2', color: '#b91c1c', label: 'Offer Expired' },
  'OFFER_EXPIRED': { bg: '#fee2e2', color: '#b91c1c', label: 'Offer Expired' },

  // 4. Onboarding & Contract Signing
  'Contract Signing Scheduled': { bg: '#dcfce7', color: '#15803d', label: 'Contract Signing Scheduled' },
  'CONTRACT_SIGNING_SCHEDULED': { bg: '#dcfce7', color: '#15803d', label: 'Contract Signing Scheduled' },

  // 5. Evaluated & Officially Hired / Concluded
  'Officially Hired': { bg: '#ecfdf5', color: '#047857', label: 'Officially Hired' },
  'OFFICIALLY HIRED': { bg: '#ecfdf5', color: '#047857', label: 'Officially Hired' },
  'HIRED': { bg: '#ecfdf5', color: '#047857', label: 'Officially Hired' },
  'Requirement Pending': { bg: '#fffbeb', color: '#b45309', label: 'Requirement Pending' },
  'REQUIREMENT PENDING': { bg: '#fffbeb', color: '#b45309', label: 'Requirement Pending' },
  'Requirements Pending': { bg: '#fffbeb', color: '#b45309', label: 'Requirement Pending' },
  'REQUIREMENTS PENDING': { bg: '#fffbeb', color: '#b45309', label: 'Requirement Pending' },
  'Contract Signed & Onboarded': { bg: '#fffbeb', color: '#b45309', label: 'Requirement Pending' },
  'CONTRACT_SIGNED_AND_ONBOARDED': { bg: '#fffbeb', color: '#b45309', label: 'Requirement Pending' },
  'Officially Hired & Signed': { bg: '#ecfdf5', color: '#047857', label: 'Officially Hired' },
  'Completed Requirements': { bg: '#dcfce7', color: '#15803d', label: 'Officially Hired' },
  'COMPLETED REQUIREMENTS': { bg: '#dcfce7', color: '#15803d', label: 'Officially Hired' },
  'Partially Compliant': { bg: '#fef3c7', color: '#b45309', label: 'Partially Compliant' },
  'PARTIALLY COMPLIANT': { bg: '#fef3c7', color: '#b45309', label: 'Partially Compliant' },
  'Candidate Withdrew': { bg: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'APPLICATION WITHDRAWN' },
  'CANDIDATE WITHDREW': { bg: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'APPLICATION WITHDRAWN' },
  'CANDIDATE_WITHDREW': { bg: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'APPLICATION WITHDRAWN' },
  'Application Withdrawn': { bg: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'APPLICATION WITHDRAWN' },
  'APPLICATION WITHDRAWN': { bg: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'APPLICATION WITHDRAWN' },
  'APPLICATION_WITHDRAWN': { bg: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'APPLICATION WITHDRAWN' },
  'Withdrawn': { bg: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'APPLICATION WITHDRAWN' },
  'WITHDRAWN': { bg: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', label: 'APPLICATION WITHDRAWN' },
  'Offer Declined': { bg: '#fff1f2', color: '#e11d48', label: 'OFFER DECLINED' },
  'OFFER DECLINED': { bg: '#fff1f2', color: '#e11d48', label: 'OFFER DECLINED' },
  'OFFER_DECLINED': { bg: '#fff1f2', color: '#e11d48', label: 'OFFER DECLINED' },
  'Job Offer Declined': { bg: '#fff1f2', color: '#e11d48', label: 'OFFER DECLINED' },
  'JOB OFFER DECLINED': { bg: '#fff1f2', color: '#e11d48', label: 'OFFER DECLINED' },
  'Incomplete Requirements': { bg: '#fff1f2', color: '#be123c', label: 'Incomplete Requirements' },
  'INCOMPLETE REQUIREMENTS': { bg: '#fff1f2', color: '#be123c', label: 'Incomplete Requirements' },
  'INCOMPLETE_REQUIREMENTS': { bg: '#fff1f2', color: '#be123c', label: 'Incomplete Requirements' },
  'Failed Pre-Employment': { bg: '#fee2e2', color: '#b91c1c', label: 'Failed Pre-Employment' },
  'FAILED PRE-EMPLOYMENT': { bg: '#fee2e2', color: '#b91c1c', label: 'Failed Pre-Employment' },
  'FAILED_PRE_EMPLOYMENT': { bg: '#fee2e2', color: '#b91c1c', label: 'Failed Pre-Employment' },
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
  onRespondJobOffer,
  isHiredUser,
}) => {
  const normStatus = (app.status || '').toUpperCase();
  const badge = STATUS_CONFIG[app.status] || STATUS_CONFIG[normStatus] || { bg: '#f1f5f9', color: '#475569', label: app.status };
  const details = interviewDetails[app.id];
  const feedback = scheduleActionFeedback[app.id];
  const isLoading = scheduleActionLoading[app.id];

  // Normalised status flags
  const isInitialScreening = ['PENDING', 'REVIEW_REQUIRED'].includes(normStatus);
  const isPassedInitial = normStatus === 'PASSED INITIAL';
  const hasPendingAction = normStatus === 'PENDING SCHEDULED';
  const isConfirmed = normStatus === 'CONFIRMED' || normStatus === 'INTERVIEW_SCHEDULED';
  const isRescheduling = normStatus === 'RESCHEDULING';
  const isPassedFinalInterview = ['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(normStatus);
  const isWaitingForSlot = ['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT'].includes(normStatus);
  const isApprovedForOffer = ['APPROVED FOR JOB OFFER', 'PRESIDENT APPROVED', 'READY FOR OFFER', 'READY_FOR_OFFER'].includes(normStatus);
  const isJobOfferPending = ['JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'OFFER EXTENDED', 'JOB OFFER EXTENDED'].includes(normStatus);
  const isOfferExpired = ['OFFER EXPIRED', 'OFFER_EXPIRED', 'JOB OFFER EXPIRED'].includes(normStatus);
  const isHired = ['HIRED', 'PASSED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED / PASSED', 'JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED'].includes(normStatus);
  const isContractScheduled = ['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(normStatus);
  const isRequirementPending = ['REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING'].includes(normStatus);
  const isOfficiallyHired = ['OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED'].includes(normStatus);
  const isCompletedRequirements = (['COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED'].includes(normStatus) && Boolean(app.work_start_date)) || ['COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS'].includes(normStatus);
  const isPartiallyCompliant = ['PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'].includes(normStatus);
  const isHiredPreEmp = ['REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING', 'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED', 'PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'].includes(normStatus);
  const isContractSigned = ['CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'OFFICIALLY HIRED & SIGNED', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'REQUIREMENT PENDING', 'REQUIREMENTS PENDING'].includes(normStatus);
  const isScreeningRejected = ['REJECTED', 'SCREENING_REJECTED'].includes(normStatus);
  const isInterviewFailed = ['INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED'].includes(normStatus);
  const isFailedFinalApproval = ['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes(normStatus);
  const isWithdrawn = ['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN'].includes(normStatus);
  const isOfferDeclined = ['OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED'].includes(normStatus);
  const isSchedulingExpired = ['SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'DECLINED - UNRESPONSIVE', 'UNRESPONSIVE', 'DECLINED_UNRESPONSIVE'].includes(normStatus);
  const isNoShow = ['CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'Candidate No Show', 'NO SHOW', 'NO_SHOW', 'CANDIDATE NO-SHOW'].includes(normStatus);
  const isContractNoShow = ['CONTRACT SIGNING NO SHOW', 'CONTRACT_SIGNING_NO_SHOW', 'Contract Signing No Show', 'CONTRACT NO SHOW', 'CONTRACT_NO_SHOW'].includes(normStatus);
  const isIncompleteRequirements = ['INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS'].includes(normStatus);
  const isFailedPreEmployment = ['FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes(normStatus);

  // Application withdrawal is only allowed during early screening & interview evaluation stages.
  // It is hidden once the application reaches Job Offer, Contract Signing, Onboarding, Hired, or Concluded.
  const canWithdraw = !isHiredUser && Boolean(onWithdrawApplication) && [
    'PENDING', 
    'REVIEW_REQUIRED', 
    'PASSED INITIAL', 
    'PENDING SCHEDULED', 
    'CONFIRMED', 
    'INTERVIEW_SCHEDULED', 
    'RESCHEDULING', 
    'PASSED FINAL INTERVIEW', 
    'PASSED_FINAL_INTERVIEW'
  ].includes(normStatus);

  // Resolve candidate display name
  const candidateName = (() => {
    if (app.candidate_name?.trim()) return app.candidate_name.trim();
    try {
      const u = JSON.parse(localStorage.getItem('hiring_user') || '{}');
      const name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      if (name) return name;
    } catch (_) { }
    return 'Applicant';
  })();

  // 6-month cooldown calculation for withdrawn and rejected/evaluated applications
  const reapplyEligibleDate = (() => {
    const rawDate = app.withdrawn_at || app.updated_at || app.applied_at;
    if (!rawDate) return null;
    try {
      const d = new Date(rawDate);
      d.setMonth(d.getMonth() + 6);
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  })();

  // Resolve interview schedule date & time for notices (e.g. No-Show, Confirmed, etc.)
  const rawInterviewDate = app.interview_date || details?.scheduled_date || details?.date;
  const rawInterviewTime = app.interview_time || details?.scheduled_time || details?.time || details?.start_time;

  const formattedInterviewDate = useMemo(() => {
    if (!rawInterviewDate) return null;
    try {
      const d = new Date(rawInterviewDate + (rawInterviewDate.includes('T') ? '' : 'T00:00:00'));
      if (isNaN(d.getTime())) return rawInterviewDate;
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return rawInterviewDate;
    }
  }, [rawInterviewDate]);

  const formattedInterviewTime = useMemo(() => {
    if (!rawInterviewTime) return null;
    return formatTime12h(rawInterviewTime);
  }, [rawInterviewTime]);

  // Resolve requested reschedule slot date & time and reason
  const rawRequestedDate = app.requested_interview_date || details?.requested_date;
  const rawRequestedStart = app.requested_interview_start_time || details?.requested_start_time;
  const rawRequestedEnd = app.requested_interview_end_time || details?.requested_end_time;
  const rescheduleReason = app.reschedule_reason || details?.reschedule_reason;

  const formattedRequestedDate = useMemo(() => {
    if (!rawRequestedDate) return null;
    try {
      const d = new Date(rawRequestedDate + (rawRequestedDate.includes('T') ? '' : 'T00:00:00'));
      if (isNaN(d.getTime())) return rawRequestedDate;
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return rawRequestedDate;
    }
  }, [rawRequestedDate]);

  const formattedRequestedTime = useMemo(() => {
    if (!rawRequestedStart) return null;
    const start = formatTime12h(rawRequestedStart);
    const end = rawRequestedEnd ? formatTime12h(rawRequestedEnd) : '';
    return end ? `${start} - ${end}` : start;
  }, [rawRequestedStart, rawRequestedEnd]);

  // Reschedule modal state
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  // Job Offer action state
  const [offerActionLoading, setOfferActionLoading] = useState(false);
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('Accepted another offer');
  const [customDeclineReason, setCustomDeclineReason] = useState('');
  const [declineError, setDeclineError] = useState('');

  const parsedOfferDetails = useMemo(() => {
    try {
      if (app.job_offer_details) {
        return typeof app.job_offer_details === 'string'
          ? JSON.parse(app.job_offer_details)
          : app.job_offer_details;
      }
    } catch (e) { }
    return {};
  }, [app.job_offer_details]);

  const handleAcceptOffer = () => {
    setAcceptModalOpen(true);
  };

  const handleConfirmAcceptOffer = async () => {
    setOfferActionLoading(true);
    try {
      if (onRespondJobOffer) {
        const res = await onRespondJobOffer(app.id || app.application_id, 'accept');
        if (res?.status === 'success' || !res) {
          setAcceptModalOpen(false);
        }
      }
    } finally {
      setOfferActionLoading(false);
    }
  };

  const handleDeclineOffer = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setDeclineError('');
    const finalReason = (declineReason === 'Other (specify reason)' || declineReason === 'Other') ? customDeclineReason.trim() : declineReason;
    if (!finalReason) {
      setDeclineError('Please select or provide a reason for declining the job offer.');
      return;
    }
    setOfferActionLoading(true);
    try {
      if (onRespondJobOffer) {
        await onRespondJobOffer(app.id || app.application_id, 'decline', finalReason);
      }
      setDeclineModalOpen(false);
    } finally {
      setOfferActionLoading(false);
    }
  };

  // Mobile checklist collapse state (collapsed by default on mobile)
  const [checklistOpen, setChecklistOpen] = useState(() => window.innerWidth > 640);

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
  const ScheduleDetails = () => {
    const requirementsList = details.requirements && details.requirements.length > 0
      ? details.requirements.map(req => req === 'Resume' ? 'Printed Resume' : req)
      : ['Printed Resume'];

    return (
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
          <span>{requirementsList.join(', ')}</span>
        </div>
        <div className="app-card__detail-row">
          <div className="app-card__detail-label" style={{ color: '#475569' }}>
            <i className="bx bx-info-circle" />
            <span>Note:</span>
          </div>
          <span style={{ color: '#475569', fontStyle: 'italic' }}>
            Please arrive at the location early for your scheduled interview.
          </span>
        </div>
      </div>
    );
  };

  // ── Shared: Rejection letter wrapper ──
  const RejectionLetter = ({ subject, children, greeting, regardsSender }) => (
    <div className="app-card__letter">
      <div className="app-card__letter-subject">
        <span className="app-card__letter-subject-label">Subject:</span>
        <span className="app-card__letter-subject-title">{subject}</span>
      </div>
      <div className="app-card__letter-body">
        <p className="app-card__letter-greeting">{greeting || `Dear ${candidateName || 'Applicant'},`}</p>
        {children}
        <div className="app-card__letter-regards">
          <p>Regards,</p>
          <p className="app-card__letter-sender">{regardsSender || 'Airship Express Recruitment Team'}</p>
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
          style={{ background: badge.bg, color: badge.color, border: badge.border || 'none' }}
        >
          {badge.label}
        </span>
      </div>

      {/* ── 4-Stage Process Tracker ── */}
      <ProcessTracker status={app.status} app={app} />

      {/* ── PENDING / REVIEW_REQUIRED: Resume Under Review Notice ── */}
      {isInitialScreening && (
        <div className="app-card__notice app-card__notice--pending">
          <div className="app-card__notice-icon app-card__notice-icon--pending">
            <i className="bx bx-time-five" />
          </div>
          <div>
            <p className="app-card__notice-title">Application Under Initial Review</p>
            <p className="app-card__notice-body">
              Thank you for applying to Airship Express! Our team is currently reviewing your resume. If your profile is a match for this position, we will contact you shortly to set up a 10-minute screening call.
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
              Congratulations! Initial Interview Passed
            </p>
            <p className="app-card__notice-body app-card__notice-body--passed">
              Congratulations! You have successfully passed the initial interview. Our recruitment team is currently assigning schedules for your final interview, and you will be notified here shortly with your designated date and time.
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
              Final Interview Passed 🎉
            </p>
            <p className="app-card__notice-body app-card__notice-body--passed-interview" style={{ margin: 0 }}>
              Congratulations! You have successfully passed your final interview. Your application has been forwarded to the President for final approval, and you will receive an official update as soon as a decision is reached.
            </p>
          </div>
        </div>
      )}

      {/* ── PASSED FINAL — WAITING FOR SLOT: Plain Professional Waitlist Notice ── */}
      {isWaitingForSlot && (
        <div className="app-card__notice" style={{ background: '#f8faff', borderColor: '#bfdbfe', borderLeft: '4px solid #2563eb', padding: '16px 20px', borderRadius: '8px' }}>
          <div className="app-card__notice-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            <i className="bx bx-time-five" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <p className="app-card__notice-title" style={{ margin: 0, color: '#1e40af', fontWeight: 700, fontSize: '15px' }}>
                Application Status: Priority Waitlist
              </p>
              <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>
                Interviews Completed
              </span>
            </div>
            <p className="app-card__notice-body" style={{ margin: '0 0 8px 0', color: '#334155', lineHeight: 1.6, fontSize: '13.5px' }}>
              Congratulations on successfully passing the interview stages for <strong>{app.job_title || 'this position'}</strong>. All current openings for this role are currently filled. Your application has been placed on our priority waitlist, and you will be notified if an opening becomes available.
            </p>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
              Your passed scores remain on record, and no re-interview is required.
            </p>
          </div>
        </div>
      )}

      {/* ── APPROVED FOR JOB OFFER: Notice ── */}
      {isApprovedForOffer && (
        <div className="app-card__notice app-card__notice--passed-interview" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
          <div className="app-card__notice-icon app-card__notice-icon--passed-interview" style={{ background: '#d1fae5', color: '#059669' }}>
            <i className="bx bx-award" />
          </div>
          <div>
            <p className="app-card__notice-title app-card__notice-title--passed-interview" style={{ margin: '0 0 4px 0', color: '#065f46' }}>
              Ready for Offer — Preparing Your Job Offer 🎉
            </p>
            <p className="app-card__notice-body app-card__notice-body--passed-interview" style={{ margin: 0, color: '#047857' }}>
              Congratulations! Your application has been approved. The HR team is currently preparing your formal Job Offer letter. You will receive an in-app and email notification once your offer letter is ready for review.
            </p>
          </div>
        </div>
      )}

      {/* ── SCREENING REJECTED: Rejection Letter ── */}
      {isScreeningRejected && (
        <RejectionLetter
          subject={`Update on your application for ${app.job_title || 'Marketing Staff'}`}
          greeting={`Dear ${candidateName || 'Nathaniel D. Ferrer'},`}
          regardsSender="Airship Express Recruitment Team"
        >
          <p>
            Thank you for taking the time to apply for the {app.job_title || 'Marketing Staff'} position at Airship Express. We sincerely appreciate your interest in our company and the effort you put into your application.
          </p>
          <p>
            Our team has thoroughly reviewed your resume and background. While we greatly value the skills and experiences you shared with us, we are unable to move forward with your application for this specific role at this time.
          </p>
          <p>
            Thank you again for giving us the opportunity to learn about your professional journey. We wish you great success in your job search and future career endeavors.
          </p>
          {reapplyEligibleDate && (
            <p style={{ marginTop: '14px', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              <i className="bx bx-info-circle" style={{ marginRight: '5px', verticalAlign: 'middle', color: '#0d9488' }} />
              <strong>Re-application Policy:</strong> Re-applying for this position is available after a 6-month cooling period (Eligible on <strong>{reapplyEligibleDate}</strong>). You may explore and apply for other open opportunities anytime.
            </p>
          )}
        </RejectionLetter>
      )}

      {/* ── INTERVIEW FAILED: Rejection Letter ── */}
      {isInterviewFailed && (
        <RejectionLetter
          subject={`Final Interview Update - ${app.job_title || 'Marketing Staff'}`}
          greeting={`Hi ${candidateName || 'Nathaniel D. Ferrer'},`}
          regardsSender="Airship Express Recruitment Team"
        >
          <p>
            Thank you for coming in and completing your face-to-face interview for the {app.job_title || 'Marketing Staff'} position. We sincerely appreciate the time and effort you took to travel and meet with our team.
          </p>
          <p>
            It was a pleasure getting to know you and learning more about your background. However, after careful deliberation, we will not be moving forward with your application for this specific vacancy at this time.
          </p>
          <p>
            We are very grateful for your interest in our company and the effort you dedicated to our interview process. We wish you great success in your future professional endeavors.
          </p>
          {reapplyEligibleDate && (
            <p style={{ marginTop: '14px', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              <i className="bx bx-info-circle" style={{ marginRight: '5px', verticalAlign: 'middle', color: '#0d9488' }} />
              <strong>Re-application Policy:</strong> Re-applying for this position is available after a 6-month cooling period (Eligible on <strong>{reapplyEligibleDate}</strong>). You may explore and apply for other open opportunities anytime.
            </p>
          )}
        </RejectionLetter>
      )}

      {/* ── FAILED FINAL APPROVAL: President's Rejection Letter ── */}
      {isFailedFinalApproval && (
        <RejectionLetter subject={`Application Update for ${app.job_title || 'Position'}`}>
          <p>Thank you for taking part in our recruitment and interview process for the {app.job_title || 'position'} role at Airship Express.</p>
          <p>
            You performed commendably throughout our interview stages. However, following final review by our Company President and leadership team, we regret to inform you that we will not be extending an employment offer at this time.
          </p>
          <p>
            We sincerely appreciate the effort, time, and dedication you invested in meeting with us, and we wish you continued success in your career journey.
          </p>
          {reapplyEligibleDate && (
            <p style={{ marginTop: '14px', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              <i className="bx bx-info-circle" style={{ marginRight: '5px', verticalAlign: 'middle', color: '#0d9488' }} />
              <strong>Re-application Policy:</strong> Re-applying for this position is available after a 6-month cooling period (Eligible on <strong>{reapplyEligibleDate}</strong>). You may explore and apply for other open opportunities anytime.
            </p>
          )}
        </RejectionLetter>
      )}

      {/* ── PENDING SCHEDULED: Interview Action Card ── */}
      {hasPendingAction && details && !feedback && (
        <div className="app-card__action-panel">
          <div className="app-card__action-heading">
            <p className="app-card__action-title">Final Interview Scheduled — Action Required</p>
            <p className="app-card__action-subtitle">
              Please accept your schedule or request a reschedule within 24 hours (1 day). Unconfirmed schedules expire automatically.
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
        <div className={`app-card__feedback ${feedback.type === 'confirm'
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
            <span>Your interview schedule is confirmed. We look forward to meeting you.</span>
          </p>
          <ScheduleDetails />
        </div>
      )}

      {/* ── RESCHEDULING: Pending Request Notice & Requested Schedule Details ── */}
      {isRescheduling && !feedback && (
        <div className="app-card__confirmed-panel" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
                padding: '3px 10px', borderRadius: '16px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase'
              }}>
                <i className="bx bx-time-five" style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Pending HR Review
              </span>
            </div>
            <p style={{ margin: '8px 0 0 0', color: '#0f172a', fontSize: '15px', fontWeight: '700' }}>
              Reschedule Request Submitted
            </p>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '13px' }}>
              Our recruitment team is reviewing your requested interview schedule. You will receive an update once confirmed.
            </p>
          </div>

          {/* Requested Schedule Highlight */}
          <div style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '16px 18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            boxShadow: 'none'
          }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                Requested New Date
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: '700', fontSize: '14.5px' }}>
                <i className="bx bx-calendar-event" style={{ color: '#0284c7', fontSize: '18px' }} />
                <span>{formattedRequestedDate || 'Preferred date requested'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                Requested Time Slot
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: '700', fontSize: '14.5px' }}>
                <i className="bx bx-time" style={{ color: '#0284c7', fontSize: '18px' }} />
                <span>{formattedRequestedTime || 'Pending assignment'}</span>
              </div>
            </div>

            {formattedInterviewDate && (
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                  Original Schedule
                </span>
                <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '600' }}>
                  <del>{formattedInterviewDate} {formattedInterviewTime ? `(${formattedInterviewTime})` : ''}</del>
                </div>
              </div>
            )}
          </div>

          {rescheduleReason && (
            <div style={{ padding: '12px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px', letterSpacing: '0.05em' }}>
                Reason for Rescheduling:
              </span>
              <p style={{ margin: 0, fontSize: '13px', color: '#334155', fontStyle: 'italic', lineHeight: 1.4 }}>
                "{rescheduleReason}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── APPLICATION WITHDRAWN: Notice ── */}
      {isWithdrawn && (() => {
        const withdrawnDateStr = app.withdrawn_at || app.updated_at || app.applied_at;
        const eligibleDateStr = withdrawnDateStr
          ? new Date(new Date(withdrawnDateStr).setMonth(new Date(withdrawnDateStr).getMonth() + 6)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : null;

        return (
          <div className="app-card__notice app-card__notice--withdrawn">
            <div className="app-card__notice-icon app-card__notice-icon--withdrawn">
              <i className="bx bx-user-minus" />
            </div>
            <div>
              <p className="app-card__notice-title app-card__notice-title--withdrawn">
                Application Withdrawn
              </p>
              <p className="app-card__notice-body app-card__notice-body--withdrawn">
                You have withdrawn your application for this position. We appreciate your time and your interest in joining Airship Express.
              </p>
              {eligibleDateStr && (
                <p className="app-card__notice-body app-card__notice-body--withdrawn" style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                  <i className="bx bx-info-circle" style={{ marginRight: '5px', verticalAlign: 'middle', color: '#0d9488' }} />
                  <strong>Re-application Policy:</strong> Re-applying for this position is available after a 6-month cooling period (Eligible on <strong>{eligibleDateStr}</strong>). You may explore and apply for other open opportunities anytime.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── JOB OFFER DECLINED: Notice ── */}
      {isOfferDeclined && (() => {
        const declinedDateStr = app.withdrawn_at || app.updated_at || app.applied_at;
        const eligibleDateStr = declinedDateStr
          ? new Date(new Date(declinedDateStr).setMonth(new Date(declinedDateStr).getMonth() + 6)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : reapplyEligibleDate;

        return (
          <div className="app-card__notice app-card__notice--withdrawn">
            <div className="app-card__notice-icon app-card__notice-icon--withdrawn">
              <i className="bx bx-x-circle" />
            </div>
            <div>
              <p className="app-card__notice-title app-card__notice-title--withdrawn">
                Job Offer Declined
              </p>
              <p className="app-card__notice-body app-card__notice-body--withdrawn">
                You have officially declined the job offer for this position. We appreciate the time and effort you invested during the hiring process with Airship Express. We wish you the best in your career endeavors, and you are always welcome to apply for future roles with us when you are ready.
              </p>
              {eligibleDateStr && (
                <p className="app-card__notice-body app-card__notice-body--withdrawn" style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                  <i className="bx bx-info-circle" style={{ marginRight: '5px', verticalAlign: 'middle', color: '#0d9488' }} />
                  <strong>Re-application Policy:</strong> Re-applying for this position is available after a 6-month waiting period (Eligible on <strong>{eligibleDateStr}</strong>). You may explore and apply for other open opportunities anytime.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── SCHEDULING EXPIRED: Notice ── */}
      {isSchedulingExpired && (
        <div className="app-card__notice app-card__notice--withdrawn">
          <div className="app-card__notice-icon app-card__notice-icon--withdrawn">
            <i className="bx bx-calendar-x" />
          </div>
          <div>
            <p className="app-card__notice-title app-card__notice-title--withdrawn">
              Application Closed (Scheduling Expired)
            </p>
            <p className="app-card__notice-body app-card__notice-body--withdrawn">
              Your application for {app.job_title || 'this position'} was marked as closed because the interview scheduling period expired without a confirmed response. If you have questions or wish to apply for future roles, please feel free to reach out to HR.
            </p>
          </div>
        </div>
      )}

      {/* ── CANDIDATE NO SHOW (Final Interview): Notice ── */}
      {isNoShow && (() => {
        const noShowDateStr = app.withdrawn_at || app.updated_at || app.applied_at;
        const eligibleDateStr = noShowDateStr
          ? new Date(new Date(noShowDateStr).setMonth(new Date(noShowDateStr).getMonth() + 6)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : reapplyEligibleDate;

        return (
          <div className="app-card__notice app-card__notice--withdrawn">
            <div className="app-card__notice-icon app-card__notice-icon--withdrawn">
              <i className="bx bx-calendar-x" />
            </div>
            <div>
              <p className="app-card__notice-title app-card__notice-title--withdrawn">
                Application Closed — Interview No-Show
              </p>
              <p className="app-card__notice-body app-card__notice-body--withdrawn">
                {formattedInterviewDate && formattedInterviewTime ? (
                  <>
                    Our records indicate that you were unable to attend your scheduled Final Interview on <strong>{formattedInterviewDate}</strong> at <strong>{formattedInterviewTime}</strong>, and your active application for the <strong>{app.job_title || 'designated'}</strong> role has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.
                  </>
                ) : formattedInterviewDate ? (
                  <>
                    Our records indicate that you were unable to attend your scheduled Final Interview on <strong>{formattedInterviewDate}</strong>, and your active application for the <strong>{app.job_title || 'designated'}</strong> role has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.
                  </>
                ) : (
                  <>
                    Our records indicate that you were unable to attend your scheduled Final Interview, and your active application for the <strong>{app.job_title || 'designated'}</strong> role has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.
                  </>
                )}
              </p>
              {eligibleDateStr && (
                <p className="app-card__notice-body app-card__notice-body--withdrawn" style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                  <i className="bx bx-info-circle" style={{ marginRight: '5px', verticalAlign: 'middle', color: '#0d9488' }} />
                  <strong>Re-application Policy:</strong> Re-applying for this position is available after a 6-month waiting period (Eligible on <strong>{eligibleDateStr}</strong>). You may explore and apply for other open opportunities anytime.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── CONTRACT SIGNING NO SHOW: Notice ── */}
      {isContractNoShow && (() => {
        const noShowDateStr = app.withdrawn_at || app.updated_at || app.applied_at;
        const eligibleDateStr = noShowDateStr
          ? new Date(new Date(noShowDateStr).setMonth(new Date(noShowDateStr).getMonth() + 6)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          : reapplyEligibleDate;

        return (
          <div className="app-card__notice app-card__notice--withdrawn">
            <div className="app-card__notice-icon app-card__notice-icon--withdrawn">
              <i className="bx bx-file-blank" />
            </div>
            <div>
              <p className="app-card__notice-title app-card__notice-title--withdrawn">
                Application Closed — Contract Signing No-Show
              </p>
              <p className="app-card__notice-body app-card__notice-body--withdrawn">
                Our records indicate that you were unable to attend your scheduled Contract Signing appointment for the <strong>{app.job_title || 'designated'}</strong> role. As a result, your application has been closed. Thank you for your interest in Airship Express, and we welcome you to re-apply for future openings.
              </p>
              {eligibleDateStr && (
                <p className="app-card__notice-body app-card__notice-body--withdrawn" style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                  <i className="bx bx-info-circle" style={{ marginRight: '5px', verticalAlign: 'middle', color: '#0d9488' }} />
                  <strong>Re-application Policy:</strong> Re-applying for this position is available after a 6-month waiting period (Eligible on <strong>{eligibleDateStr}</strong>). You may explore and apply for other open opportunities anytime.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── OFFER EXPIRED: Notice ── */}
      {isOfferExpired && (
        <div className="app-card__notice app-card__notice--withdrawn">
          <div className="app-card__notice-icon app-card__notice-icon--withdrawn">
            <i className="bx bx-time-five" />
          </div>
          <div>
            <p className="app-card__notice-title app-card__notice-title--withdrawn">
              Application Closed (Offer Expired)
            </p>
            <p className="app-card__notice-body app-card__notice-body--withdrawn">
              Your official employment offer for {app.job_title || 'this position'} was marked as closed because the offer confirmation deadline passed without response. If you have questions or wish to apply for future vacancies, please feel free to reach out to the HR Department.
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

      {/* ── CONTRACT SIGNING SCHEDULED: Dedicated Appointment Card ── */}
      {isContractScheduled && (() => {
        const dateObj = app.contract_signing_date ? new Date(app.contract_signing_date + 'T00:00:00') : null;
        const formattedSigningDate = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Scheduled Date Pending';
        const signingTime = app.contract_signing_time || '—';
        const signingLocation = app.contract_signing_location || 'Airship Express Main Office - HR Department (352 T. Pinpin Escolta St., Binondo, Manila)';
        const signingNotes = app.contract_signing_notes || '';

        return (
          <div className="app-card__hired-panel">
            <div className="app-card__hired-headline">
              <i className="bx bx-calendar-check app-card__hired-badge-icon" style={{ background: '#ecfdf5', color: '#059669' }} />
              <h4 className="app-card__hired-title">Employment Contract Signing Appointment</h4>
            </div>
            <p className="app-card__hired-welcome">
              Welcome to the team! Please be advised of your scheduled appointment to sign your official employment contract for the <strong>{app.job_title || 'Marketing Staff'}</strong> position. Kindly review the details below and prepare the necessary documents prior to your visit.
            </p>

            {/* Appointment Details Grid */}
            <div className="app-card__signing-container">
              <div className="app-card__signing-grid">
                <div className="app-card__signing-item">
                  <i className="bx bx-calendar app-card__signing-icon" />
                  <div>
                    <span className="app-card__signing-label">Date</span>
                    <strong className="app-card__signing-val">{formattedSigningDate}</strong>
                  </div>
                </div>

                <div className="app-card__signing-item">
                  <i className="bx bx-time app-card__signing-icon" />
                  <div>
                    <span className="app-card__signing-label">Time</span>
                    <strong className="app-card__signing-val">{signingTime}</strong>
                  </div>
                </div>

                <div className="app-card__signing-item app-card__signing-item--full">
                  <i className="bx bx-map-pin app-card__signing-icon" />
                  <div>
                    <span className="app-card__signing-label">Venue / Location</span>
                    <strong className="app-card__signing-val">{signingLocation}</strong>
                  </div>
                </div>
              </div>

              {signingNotes && (
                <div className="app-card__signing-notes">
                  <span className="app-card__signing-notes-label">
                    Instructions &amp; What to Bring:
                  </span>
                  <p className="app-card__signing-notes-text">
                    {signingNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── JOB OFFER EXTENDED: Official Letter Extended & Candidate Decision (High-Fidelity UI/UX Mockup Style) ── */}
      {isJobOfferPending && (() => {
        const offerDetails = parsedOfferDetails;

        const pdfUrl = `${API_BASE_URL}/super_admin/generate_job_offer_pdf.php?application_id=${app.id || app.application_id}`;

        const formattedExpiry = (() => {
          if (offerDetails.offer_expires_at) {
            try {
              const d = new Date(offerDetails.offer_expires_at);
              if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                });
              }
            } catch (_) { }
          }
          return 'Sept 20, 2026, 5:00 PM';
        })();

        return (
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '26px 28px',
            marginTop: '18px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
            position: 'relative'
          }}>
            {/* Header Section */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              marginBottom: '20px'
            }}>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '800',
                  color: '#0f172a',
                  letterSpacing: '-0.2px',
                  fontFamily: "'Inter', -apple-system, sans-serif"
                }}>
                  Action Required: Official Job Offer
                </h3>
                <p style={{
                  margin: '4px 0 0 0',
                  fontSize: '13.5px',
                  color: '#475569',
                  lineHeight: '1.4'
                }}>
                  Congratulations! Airship Express has prepared an official job offer for you.
                </p>
              </div>

              {/* View PDF Button */}
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontWeight: '600',
                  fontSize: '13px',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                <i className="bx bx-file" style={{ fontSize: '17px', color: '#475569' }} />
                <span>View Official Offer Letter (PDF)</span>
              </a>
            </div>

            {/* Details Grid (4-Column Horizontal Data Grid) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
              marginBottom: '20px',
              background: '#ffffff'
            }}>
              {/* Column 1: POSITION OFFERED */}
              <div style={{
                padding: '16px 20px',
                borderRight: '1.5px solid #e2e8f0',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px'
                }}>
                  POSITION OFFERED
                </span>
                <span style={{
                  fontSize: '14.5px',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginTop: '4px'
                }}>
                  {app.job_title || 'Customer Service Associate'}
                </span>
              </div>

              {/* Column 2: EMPLOYMENT TYPE */}
              <div style={{
                padding: '16px 20px',
                borderRight: '1.5px solid #e2e8f0',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px'
                }}>
                  EMPLOYMENT TYPE
                </span>
                <span style={{
                  fontSize: '14.5px',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginTop: '4px'
                }}>
                  {offerDetails.employment_type || 'Full-Time'}
                </span>
              </div>

              {/* Column 3: STARTING COMPENSATION */}
              <div style={{
                padding: '16px 20px',
                borderRight: '1.5px solid #e2e8f0',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px'
                }}>
                  STARTING COMPENSATION
                </span>
                <span style={{
                  fontSize: '14.5px',
                  fontWeight: '800',
                  color: '#16a34a',
                  marginTop: '4px'
                }}>
                  {offerDetails.salary || '₱25,000.00 / month'}
                </span>
              </div>

              {/* Column 4: OFFER EXPIRES */}
              <div style={{
                padding: '16px 20px',
                background: '#fff7ed',
                borderBottom: '1px solid #fed7aa',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#9a3412',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px'
                }}>
                  OFFER EXPIRES
                </span>
                <span style={{
                  fontSize: '14.5px',
                  fontWeight: '800',
                  color: '#c2410c',
                  marginTop: '4px'
                }}>
                  {formattedExpiry}
                </span>
              </div>
            </div>

            {/* Special Provisions note if provided */}
            {offerDetails.special_provisions && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '11px 16px',
                marginBottom: '16px',
                fontSize: '12.5px',
                color: '#475569',
                lineHeight: '1.5'
              }}>
                <strong style={{ color: '#0f172a', marginRight: '6px' }}>
                  📌 Special Terms &amp; Provisions:
                </strong>
                {offerDetails.special_provisions}
              </div>
            )}

            {/* Body Text */}
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '13.5px',
              color: '#475569',
              lineHeight: '1.6',
              fontFamily: "'Inter', sans-serif"
            }}>
              Please review the attached PDF for complete details regarding your compensation package, schedule, and terms of employment. You must submit your decision by the expiration date above. Accepting will advance your application to the final contract signing phase.
            </p>

            {/* Action Buttons: perfectly aligned at bottom left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Primary: Solid Vibrant Green with Checkmark reading "Accept Offer" */}
              <button
                type="button"
                onClick={handleAcceptOffer}
                disabled={offerActionLoading}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 22px',
                  fontSize: '14px',
                  fontWeight: '700',
                  fontFamily: "'Inter', sans-serif",
                  cursor: offerActionLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
                  opacity: offerActionLoading ? 0.7 : 1,
                  transition: 'background 0.15s'
                }}
              >
                <i className="bx bx-check" style={{ fontSize: '19px' }} />
                <span>{offerActionLoading ? 'Processing...' : 'Accept Offer'}</span>
              </button>

              {/* Secondary: White background, Red outline, Red "X" icon reading "Decline Offer" */}
              <button
                type="button"
                onClick={() => setDeclineModalOpen(true)}
                disabled={offerActionLoading}
                style={{
                  background: '#ffffff',
                  color: '#dc2626',
                  border: '1.5px solid #dc2626',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '700',
                  fontFamily: "'Inter', sans-serif",
                  cursor: offerActionLoading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.15s'
                }}
              >
                <i className="bx bx-x" style={{ fontSize: '18px' }} />
                <span>Decline Offer</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── HIRED: Awaiting Contract Signing Schedule ── */}
      {isHired && !isHiredPreEmp && !isContractScheduled && !isContractSigned && (() => {
        return (
          <div className="app-card__hired-panel">
            <div>
              <div className="app-card__hired-headline">
                <i className="bx bx-check-shield app-card__hired-badge-icon" />
                <h4 className="app-card__hired-title">Job Offer Confirmed — Next Step: Contract Signing</h4>
              </div>
              <p className="app-card__hired-welcome">
                Thank you for accepting the official job offer for the <strong>{app.job_title || 'Position'}</strong> position! We are incredibly excited to welcome you to the Airship Express team!
              </p>
              <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>
                Our HR department is currently preparing your official employment contract. You will be notified here as soon as your contract signing schedule is ready.
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── HIRED PRE-EMPLOYMENT: Contract Signed, Docs Submission Pending ── */}
      {isHiredPreEmp && (() => {
        const checklist = (() => {
          try {
            if (app.pre_employment_checklist) return JSON.parse(app.pre_employment_checklist);
          } catch (e) { }
          return {};
        })();

        const items = [
          { id: 'medical', label: 'Medical Certificate', desc: 'Fit to work medical clearance from accredited clinic' },
          { id: 'drug_test', label: 'Drug Test Result', desc: 'Negative 5-panel or 10-panel drug screening certificate' },
          { id: 'nbi', label: 'NBI Clearance', desc: 'Valid government-issued national security clearance' },
          { id: 'police', label: 'Police Clearance', desc: 'Local municipal or PNP station clearance certificate' },
          { id: 'coe', label: 'Certificate of Employment', desc: 'Previous employer clearance or waiver if first-time worker' },
          { id: 'tor_diploma', label: 'Transcript of Records (TOR) / Diploma', desc: 'Certified true copy of educational academic records' }
        ];

        if (isCompletedRequirements) {
          const startDateStr = app.work_start_date
            ? new Date(app.work_start_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
            : 'To be confirmed by HR';
          const arrivalTimeStr = app.work_start_time ? formatTime12h(app.work_start_time) : '08:00 AM';
          const locationStr = app.work_start_location || 'Airship Express HQ - Manila Hub, 352 T. Pinpin St., Binondo, Manila';
          const reportingToStr = app.work_start_reporting_to || 'HR Department / Branch Operations Manager';

          return (
            <div className="app-card__hired-panel" style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #059669',
              borderRadius: '10px',
              padding: '22px 24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}>
              {/* Header Section */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                paddingBottom: '16px',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px', lineHeight: 1 }}>🎉</span>
                    <h4 style={{
                      margin: 0,
                      fontSize: '16.5px',
                      fontWeight: '800',
                      color: '#0f172a',
                      fontFamily: "'Montserrat', sans-serif",
                      letterSpacing: '-0.2px'
                    }}>
                      Cleared for Day 1: Welcome to Airship Express! You are Officially Hired
                    </h4>
                  </div>
                  <p style={{
                    margin: '4px 0 0 26px',
                    fontSize: '13.5px',
                    fontWeight: '500',
                    color: '#64748b'
                  }}>
                    Your pre-employment requirements are verified.
                  </p>
                </div>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569'
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                  Ready to Start
                </div>
              </div>

              {/* Details Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '12px',
                padding: '16px 0',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="bx bx-calendar" style={{ fontSize: '13px', color: '#64748b' }} />
                    START DATE
                  </span>
                  <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', marginTop: '4px', display: 'block' }}>
                    {startDateStr}
                  </span>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="bx bx-time-five" style={{ fontSize: '13px', color: '#64748b' }} />
                    ARRIVAL TIME
                  </span>
                  <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', marginTop: '4px', display: 'block' }}>
                    {arrivalTimeStr}
                  </span>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="bx bx-map" style={{ fontSize: '13px', color: '#64748b' }} />
                    LOCATION
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
                    {locationStr}
                  </span>
                </div>

                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <i className="bx bx-user-check" style={{ fontSize: '13px', color: '#64748b' }} />
                    REPORTING TO
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginTop: '4px', display: 'block' }}>
                    {reportingToStr}
                  </span>
                </div>
              </div>

              {/* Day 1 Special Instructions Note (if provided by HR) */}
              {app.work_start_notes && app.work_start_notes.trim() && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '12.5px',
                  color: '#475569',
                  lineHeight: '1.5'
                }}>
                  <strong style={{ color: '#0f172a', display: 'block', marginBottom: '2px', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    HR Instructions / Notes:
                  </strong>
                  {app.work_start_notes}
                </div>
              )}

              {/* Verified Pre-Employment Documents Collapsible Checklist */}
              <div className="app-card__requirements-list-container" style={{ marginTop: '6px', marginBottom: 0 }}>
                <p
                  className="app-card__requirements-list-heading app-card__checklist-toggle"
                  onClick={() => setChecklistOpen(o => !o)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setChecklistOpen(o => !o)}
                  aria-expanded={checklistOpen}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none', margin: 0, paddingBottom: checklistOpen ? '8px' : '0', borderBottom: checklistOpen ? '1px solid #e2e8f0' : 'none' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: '700', fontSize: '13.5px' }}>
                    <i className="bx bx-check-shield" style={{ fontSize: '17px', color: '#059669' }} />
                    Verified Pre-Employment Documents (6 of 6 Verified)
                  </span>
                  <i className={`bx bx-chevron-${checklistOpen ? 'up' : 'down'} app-card__checklist-chevron`} style={{ fontSize: '20px', color: '#64748b' }} />
                </p>

                {checklistOpen && (
                  <div className="app-card__checklist-wrap" style={{ marginTop: '10px' }}>
                    {items.map((req, idx) => (
                      <div
                        key={req.id}
                        className={`app-card__checklist-row ${idx === items.length - 1 ? 'app-card__checklist-row--last' : ''}`}
                      >
                        <div className="app-card__checklist-circle app-card__checklist-circle--verified">
                          <i className="bx bx-check" />
                        </div>
                        <div className="app-card__checklist-text">
                          <span className="app-card__checklist-name">{req.label}</span>
                          <div className="app-card__checklist-desc">{req.desc}</div>
                        </div>
                        <span className="app-card__checklist-badge app-card__checklist-badge--verified">
                          Verified
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }

        return (
          <div className="app-card__hired-panel">
            <div>
              <div className="app-card__hired-headline">
                <i className="bx bx-time-five app-card__hired-badge-icon" style={{ background: '#fffbeb', color: '#b45309' }} />
                <h4 className="app-card__hired-title">
                  {isPartiallyCompliant
                    ? 'Onboarding Active: Partially Compliant'
                    : 'Employment Contract Executed — Requirements Pending'}
                </h4>
              </div>
              <p className="app-card__hired-welcome">
                {isPartiallyCompliant
                  ? 'Your onboarding is active with partially submitted requirements. Please submit your remaining physical pre-employment documents to HR as soon as possible.'
                  : 'Your employment contract has been signed and executed! Your status is now Requirement Pending. Please submit your 6 mandatory physical pre-employment documents below to HR for verification. You will be officially hired once your requirements are complete and your first day start schedule is confirmed.'}
              </p>
            </div>

            <div className="app-card__requirements-list-container" style={{ marginTop: '16px' }}>
              <p
                className="app-card__requirements-list-heading app-card__checklist-toggle"
                onClick={() => setChecklistOpen(o => !o)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setChecklistOpen(o => !o)}
                aria-expanded={checklistOpen}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Pre-Employment Verification Checklist:
                  <i className="bx bx-down-arrow-alt" style={{ fontSize: '18px', color: '#e6007e' }} />
                </span>
                <i className={`bx bx-chevron-${checklistOpen ? 'up' : 'down'} app-card__checklist-chevron`} style={{ fontSize: '20px', color: '#64748b' }} />
              </p>

              {checklistOpen && (
                <div className="app-card__checklist-wrap">
                  {items.map((req, idx) => {
                    const status = checklist[req.id];
                    const isVerified = status === 'verified' || status === true;
                    const isWaived = status === 'waived';

                    return (
                      <div
                        key={req.id}
                        className={`app-card__checklist-row ${idx === items.length - 1 ? 'app-card__checklist-row--last' : ''}`}
                      >
                        <div className={`app-card__checklist-circle ${isVerified ? 'app-card__checklist-circle--verified' : isWaived ? 'app-card__checklist-circle--waived' : 'app-card__checklist-circle--pending'}`}>
                          <i className={`bx ${isVerified ? 'bx-check' : isWaived ? 'bx-x' : 'bx-time'}`} />
                        </div>
                        <div className="app-card__checklist-text">
                          <span className={`app-card__checklist-name ${isWaived ? 'app-card__checklist-name--waived' : ''}`}>{req.label}</span>
                          <div className="app-card__checklist-desc">{req.desc}</div>
                        </div>
                        <span className={`app-card__checklist-badge ${isVerified ? 'app-card__checklist-badge--verified' : isWaived ? 'app-card__checklist-badge--waived' : 'app-card__checklist-badge--pending'}`}>
                          {isVerified ? 'Verified' : isWaived ? 'Waived' : 'Pending'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="app-card__hired-footer-note" style={{ marginTop: '14px' }}>
              <i className="bx bx-info-circle" style={{ fontSize: '17px', color: '#047857', flexShrink: 0 }} />
              <span>
                Please submit all physical documents directly to our HR Main Office during business hours.
              </span>
            </div>
          </div>
        );
      })()}

      {/* ── Active Application Withdrawal Option (Hidden once in Job Offer, Contract Signing, Onboarding, Hired, or Concluded) ── */}
      {canWithdraw && (
        <div className="app-card__withdraw-wrap">
          <button
            type="button"
            className="app-card__withdraw-btn"
            onClick={() => onWithdrawApplication(app.id, app.job_title)}
            title="Withdraw your application for this position"
          >
            <i className="bx bx-user-minus" />
            <span>Withdraw Application</span>
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

      {/* ── Decline Job Offer Modal ── */}
      {declineModalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '480px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)', overflow: 'hidden'
          }}>
            <div style={{
              background: '#fef2f2', padding: '18px 24px', borderBottom: '1px solid #fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="bx bx-x-circle" style={{ fontSize: '24px', color: '#dc2626' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#991b1b', fontFamily: "'Montserrat', sans-serif" }}>
                  Decline Job Offer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeclineModalOpen(false)}
                disabled={offerActionLoading}
                style={{ background: 'none', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleDeclineOffer} style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
                Please select the primary reason you are declining the job offer for <strong>{app.job_title || 'this position'}</strong>. This helps our recruitment team improve:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                {[
                  'Accepted another offer',
                  'Compensation or benefits below expectations',
                  'Location, commute, or work schedule',
                  'Personal or career reasons',
                  'Other (specify reason)'
                ].map((reasonOption) => (
                  <label
                    key={reasonOption}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '8px',
                      border: declineReason === reasonOption ? '1.5px solid #dc2626' : '1px solid #e2e8f0',
                      background: declineReason === reasonOption ? '#fef2f2' : '#ffffff',
                      cursor: 'pointer', fontSize: '13px', color: '#1e293b'
                    }}
                  >
                    <input
                      type="radio"
                      name="decline_reason"
                      value={reasonOption}
                      checked={declineReason === reasonOption}
                      onChange={() => setDeclineReason(reasonOption)}
                      style={{ accentColor: '#dc2626' }}
                    />
                    <span>{reasonOption}</span>
                  </label>
                ))}
              </div>

              {(declineReason === 'Other (specify reason)' || declineReason === 'Other') && (
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Specify Reason: <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={customDeclineReason}
                    onChange={(e) => setCustomDeclineReason(e.target.value)}
                    placeholder="Briefly state your reason..."
                    required
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px',
                      border: '1.5px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical'
                    }}
                  />
                </div>
              )}

              {declineError && (
                <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: '500', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="bx bx-error-circle" style={{ fontSize: '16px' }} />
                  <span>{declineError}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setDeclineModalOpen(false)}
                  disabled={offerActionLoading}
                  style={{
                    padding: '9px 18px', background: '#f1f5f9', color: '#475569',
                    border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Keep Offer
                </button>
                <button
                  type="submit"
                  disabled={offerActionLoading}
                  style={{
                    padding: '9px 20px', background: '#dc2626', color: '#ffffff',
                    border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px',
                    cursor: offerActionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)', opacity: offerActionLoading ? 0.7 : 1
                  }}
                >
                  {offerActionLoading ? 'Declining...' : 'Confirm Decline'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── Accept Job Offer Confirmation Modal ── */}
      {acceptModalOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '14px', width: '100%', maxWidth: '490px',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.2)', overflow: 'hidden'
          }}>
            <div style={{
              background: '#f0fdf4', padding: '18px 24px', borderBottom: '1px solid #dcfce7',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="bx bx-check-shield" style={{ fontSize: '24px', color: '#16a34a' }} />
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: '#14532d', fontFamily: "'Montserrat', sans-serif" }}>
                  Accept Job Offer Confirmation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAcceptModalOpen(false)}
                disabled={offerActionLoading}
                style={{ background: 'none', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#334155', lineHeight: '1.5' }}>
                You are about to accept the official Job Offer from <strong>Airship Express</strong> for the following position:
              </p>

              {/* Offer Summary Box */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Position:</span>
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>{app.job_title || 'Applicant Position'}</span>
                </div>
                <div style={{ height: '1px', background: '#e2e8f0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Employment Type:</span>
                  <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#334155' }}>{parsedOfferDetails.employment_type || 'Full-Time'}</span>
                </div>
                <div style={{ height: '1px', background: '#e2e8f0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Starting Salary:</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#16a34a' }}>{parsedOfferDetails.salary || '₱25,000.00 / month'}</span>
                </div>
              </div>

              {/* Next Steps Note */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#1e40af',
                lineHeight: '1.5',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                marginBottom: '22px'
              }}>
                <i className="bx bx-info-circle" style={{ fontSize: '18px', marginTop: '1px', flexShrink: 0, color: '#2563eb' }} />
                <span>
                  <strong>Next Phase:</strong> By confirming acceptance, your application will advance to <strong>Contract Signing</strong>. Our HR team will finalize your signing appointment schedule at our office.
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAcceptModalOpen(false)}
                  disabled={offerActionLoading}
                  style={{
                    padding: '9px 18px', background: '#f1f5f9', color: '#475569',
                    border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Review Again
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAcceptOffer}
                  disabled={offerActionLoading}
                  style={{
                    padding: '9px 20px', background: '#16a34a', color: '#ffffff',
                    border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px',
                    cursor: offerActionLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)', opacity: offerActionLoading ? 0.7 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <i className="bx bx-check" style={{ fontSize: '17px' }} />
                  <span>{offerActionLoading ? 'Accepting Offer...' : 'Confirm & Accept Offer'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}


    </div>
  );
};

export default ApplicationCard;
