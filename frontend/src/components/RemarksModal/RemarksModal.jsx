import React, { useState, useEffect, useRef } from 'react';
import './RemarksModal.css';

/**
 * RemarksModal — Reusable evaluator remarks/feedback modal.
 *
 * Props:
 *  - isOpen       {boolean}   Whether the modal is visible.
 *  - onClose      {function}  Called when the user cancels.
 *  - onConfirm    {function}  Called with (remarks) when user confirms.
 *  - actionType   {string}    One of: 'pass', 'fail', 'approve', 'reject'
 *  - candidateName {string}   Name of the candidate.
 *  - jobTitle     {string}    Title of the position.
 *  - currentStatus {string}   Current application status.
 *  - loading      {boolean}   Show loading spinner on confirm button.
 */

const ACTION_CONFIG = {
  pass: {
    icon: 'bx bx-check-circle',
    title: 'Pass Initial Screening',
    subtitle: 'Move this candidate to the interview scheduling queue.',
    confirmText: 'Confirm & Pass',
    btnClass: 'remarks-modal__btn--pass',
    titleClass: 'remarks-modal__title--pass',
    placeholder: 'Enter your remarks for this candidate...',
    hint: 'Provide custom remarks, or leave this field blank to issue a standard status update.'
  },
  fail: {
    icon: 'bx bx-x-circle',
    title: 'Reject Initial Screening',
    subtitle: 'This candidate will not advance to the interview stage.',
    confirmText: 'Confirm & Reject',
    btnClass: 'remarks-modal__btn--fail',
    titleClass: 'remarks-modal__title--fail',
    placeholder: 'Enter your reason for rejection...',
    hint: 'Provide optional remarks regarding the rejection decision.'
  },
  approve: {
    icon: 'bx bx-check-double',
    title: "Grant President's Approval",
    subtitle: 'Approve this candidate for official hiring and pre-employment requirements.',
    confirmText: 'Approve & Hire',
    btnClass: 'remarks-modal__btn--approve',
    titleClass: 'remarks-modal__title--approve',
    placeholder: 'Enter final approval remarks...',
    hint: 'Provide custom remarks, or leave this field blank to issue a standard status update.'
  },
  reject: {
    icon: 'bx bx-block',
    title: "Decline President's Approval",
    subtitle: 'This candidate will not receive final approval.',
    confirmText: 'Decline Approval',
    btnClass: 'remarks-modal__btn--reject',
    titleClass: 'remarks-modal__title--reject',
    label: 'Reason for Declining (Internal Record)',
    placeholder: 'Enter internal reason or notes for declining approval...',
    hint: 'Internal note for audit purposes. This comment is recorded for management records and will NOT be sent or shown to the applicant.'
  },
  pass_final: {
    icon: 'bx bx-check-circle',
    title: 'Pass Final Interview',
    subtitle: "Forward this candidate to the President's Final Approval.",
    confirmText: 'Confirm & Pass',
    btnClass: 'remarks-modal__btn--pass',
    titleClass: 'remarks-modal__title--pass',
    placeholder: "Enter evaluation remarks. These will be reviewed by the President...",
    hint: "Provide detailed remarks regarding the candidate's performance. These remarks will be forwarded to the President for final review."
  },
  fail_final: {
    icon: 'bx bx-x-circle',
    title: 'Fail Final Interview',
    subtitle: 'This candidate did not pass the final interview stage.',
    confirmText: 'Confirm & Fail',
    btnClass: 'remarks-modal__btn--fail',
    titleClass: 'remarks-modal__title--fail',
    placeholder: 'Enter your reason for failing the candidate...',
    hint: 'Provide optional remarks regarding the interview failure.'
  },
  no_show: {
    icon: 'bx bx-user-x',
    title: 'Record Interview No Show',
    subtitle: 'Mark this candidate as a No Show for their scheduled interview.',
    confirmText: 'Record No Show',
    btnClass: 'remarks-modal__btn--fail',
    titleClass: 'remarks-modal__title--fail',
    placeholder: 'Enter any additional details...',
    hint: 'Provide custom remarks, or leave this field blank to issue a standard status update.'
  },
};

const RemarksModal = ({
  isOpen,
  onClose,
  onConfirm,
  actionType = 'pass',
  candidateName = '',
  jobTitle = '',
  currentStatus = '',
  evaluatorName = '',
  loading = false,
}) => {
  const [remarks, setRemarks] = useState('');
  const textareaRef = useRef(null);
  const config = ACTION_CONFIG[actionType] || ACTION_CONFIG.pass;

  // Resolve evaluator name from prop or localStorage
  const currentEvaluator = evaluatorName || (() => {
    try {
      const user = JSON.parse(localStorage.getItem('hiring_user') || '{}');
      const rawName = (user?.first_name || user?.User_Fname)
        ? `${user.first_name || user.User_Fname} ${user.last_name || user.User_Lname}`.trim()
        : (user?.email || user?.User_Email || '');
      if (!rawName) return '';
      const rolePrefix = user?.is_admin === 3 ? 'Super Admin' : 'HR Admin';
      return rawName.toLowerCase().startsWith('hr admin') || rawName.toLowerCase().startsWith('super admin')
        ? rawName
        : `${rolePrefix} ${rawName}`;
    } catch {
      return '';
    }
  })();

  useEffect(() => {
    if (isOpen) {
      setRemarks('');
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen, actionType]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!loading) onConfirm(remarks.trim());
  };

  return (
    <div className="remarks-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="remarks-modal">

        <div className="remarks-modal__header">
          <h3 className={`remarks-modal__title ${config.titleClass}`}>
            <i className={config.icon} />
            {config.title}
          </h3>
          <p className="remarks-modal__subtitle">{config.subtitle}</p>
        </div>

        <div className="remarks-modal__body">
          <div className="remarks-modal__candidate">
            <div className="remarks-modal__candidate-row">
              <strong>Candidate:</strong> {candidateName || 'N/A'}
            </div>
            <div className="remarks-modal__candidate-row">
              <strong>Position:</strong> {jobTitle || 'N/A'}
            </div>
            {currentEvaluator && (
              <div className="remarks-modal__candidate-row" style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1', color: '#475569' }}>
                <strong>Interviewed by:</strong> {currentEvaluator}
              </div>
            )}
          </div>

          <label className="remarks-modal__label">
            {config.label || "Evaluator Remarks & Feedback (Optional)"}
          </label>
          <textarea
            ref={textareaRef}
            className="remarks-modal__textarea"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={config.placeholder || "Enter your remarks for this candidate..."}
            disabled={loading}
          />
          {actionType === 'reject' ? (
            <div className="remarks-modal__audit-notice">
              <i className="bx bx-shield-quarter" />
              <span>{config.hint}</span>
            </div>
          ) : (
            <p className="remarks-modal__hint">
              {config.hint || "Provide custom remarks, or leave this field blank to issue a standard status update."}
            </p>
          )}
        </div>

        <div className="remarks-modal__footer">
          <button
            className="remarks-modal__btn remarks-modal__btn--cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={`remarks-modal__btn remarks-modal__btn--confirm ${config.btnClass}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <><i className="bx bx-loader-alt" /> Processing...</>
            ) : (
              <><i className={config.icon} /> {config.confirmText}</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default RemarksModal;
