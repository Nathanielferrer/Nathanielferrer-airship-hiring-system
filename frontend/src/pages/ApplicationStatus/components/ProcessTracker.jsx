import React from 'react';
import './ProcessTracker.css';

/**
 * ProcessTracker Component
 *
 * Visualises the 5-stage recruitment pipeline:
 *   1. Applied  →  2. Screening  →  3. Final Interview  →  4. Final Approval  →  5. Officially Hired
 *
 * Props:
 *   status {string} - Raw application status string (e.g. 'PASSED FINAL INTERVIEW', 'PASSED FINAL APPROVAL')
 */
const ProcessTracker = ({ status = 'pending' }) => {
  const normStatus = (status || '').toUpperCase();

  // Determine step states and sub-labels
  let activeStep = 1;
  let step1State = 'completed'; // Applied is always "completed" for submitted applications
  let step2State = 'upcoming';
  let step3State = 'upcoming';
  let step4State = 'upcoming';
  let step5State = 'upcoming';

  let step1Sub = 'Submitted';
  let step2Sub = 'Pending';
  let step3Sub = 'Pending';
  let step4Sub = 'Pending';
  let step5Sub = 'Pending';

  if (['PENDING', 'REVIEW_REQUIRED'].includes(normStatus)) {
    activeStep = 2;
    step2State = 'current';
    step2Sub   = normStatus === 'REVIEW_REQUIRED' ? 'Action Required' : 'Under Review';

  } else if (['REJECTED', 'SCREENING_REJECTED'].includes(normStatus)) {
    activeStep = 2;
    step2State = 'rejected'; step2Sub = 'Not Selected';
    step3State = 'upcoming';
    step4State = 'upcoming';
    step5State = 'rejected'; step5Sub = 'Declined';

  } else if (normStatus === 'PASSED INITIAL') {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'current';   step3Sub = 'Queue for Slot';

  } else if (normStatus === 'PENDING SCHEDULED') {
    activeStep = 3;
    step2State = 'completed';       step2Sub = 'Passed';
    step3State = 'action_required'; step3Sub = 'Action Required';

  } else if (normStatus === 'CONFIRMED' || normStatus === 'INTERVIEW_SCHEDULED') {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'current';   step3Sub = 'Scheduled';

  } else if (normStatus === 'RESCHEDULING') {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'current';   step3Sub = 'Rescheduling';

  } else if (['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(normStatus)) {
    activeStep = 4;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'current';   step4Sub = 'Awaiting President';
    step5State = 'upcoming';  step5Sub = 'Pending Decision';

  } else if (['INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED'].includes(normStatus)) {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'rejected';  step3Sub = 'Interview Failed';
    step4State = 'upcoming';
    step5State = 'rejected';  step5Sub = 'Not Selected';

  } else if (['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes(normStatus)) {
    activeStep = 4;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'rejected';  step4Sub = 'Declined by Pres.';
    step5State = 'rejected';  step5Sub = 'Not Selected';

  } else if (['PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'PASSED', 'PASSED INTERVIEW', 'HIRED / PASSED'].includes(normStatus)) {
    activeStep = 5;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Officially Hired';

  } else if (['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW'].includes(normStatus)) {
    activeStep = 5;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved';
    step5State = 'rejected';  step5Sub = 'Withdrawn';

  } else if (['INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS'].includes(normStatus)) {
    activeStep = 5;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved';
    step5State = 'rejected';  step5Sub = 'Incomplete Req.';

  } else if (['FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes(normStatus)) {
    activeStep = 5;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved';
    step5State = 'rejected';  step5Sub = 'Pre-Emp. Failed';

  } else if (normStatus === 'DECLINED - UNRESPONSIVE') {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'rejected';  step3Sub = 'Unresponsive';
    step5State = 'rejected';  step5Sub = 'Declined';
  }

  // Progress bar width percentage
  const progressPercent = { 1: 0, 2: 25, 3: 50, 4: 75, 5: 100 }[activeStep] || 0;
  const progressRejected = (step2State === 'rejected' || step3State === 'rejected' || step4State === 'rejected' || step5State === 'rejected') && progressPercent === 100;

  // 5 Step definitions — using Boxicons class names
  const steps = [
    { num: 1, title: '1. Applied',         subtext: step1Sub, state: step1State, icon: 'bx bx-file-blank'  },
    { num: 2, title: '2. Screening',       subtext: step2Sub, state: step2State, icon: 'bx bx-search-alt-2' },
    { num: 3, title: '3. Final Interview', subtext: step3Sub, state: step3State, icon: 'bx bx-group'        },
    { num: 4, title: '4. Final Approval',  subtext: step4Sub, state: step4State, icon: 'bx bx-user-check'   },
    { num: 5, title: '5. Officially Hired',subtext: step5Sub, state: step5State, icon: 'bx bx-award'        },
  ];

  // ── Helper: derive CSS class names from step state ──
  const circleClass = (state) => `process-tracker__circle process-tracker__circle--${state}`;

  const titleClass = (state) => {
    const prominent = ['current', 'action_required', 'completed'].includes(state);
    if (state === 'action_required') return 'process-tracker__title process-tracker__title--action_required';
    return `process-tracker__title ${prominent ? 'process-tracker__title--prominent' : 'process-tracker__title--faint'}`;
  };

  const subClass = (state) => `process-tracker__subtext process-tracker__subtext--${state}`;

  return (
    <div className="process-tracker">
      <div className="process-tracker__rail">

        {/* Background track line */}
        <div className="process-tracker__track-bg" />

        {/* Animated progress fill */}
        <div
          className={`process-tracker__track-fill ${
            progressRejected
              ? 'process-tracker__track-fill--rejected'
              : 'process-tracker__track-fill--success'
          }`}
          style={{ width: `calc((100% - 60px) * ${progressPercent / 100})` }}
        />

        {/* Step nodes */}
        {steps.map((step) => (
          <div key={step.num} className="process-tracker__step">
            <div className={circleClass(step.state)}>
              <i className={step.icon} />
            </div>
            <div className="process-tracker__labels">
              <span className={titleClass(step.state)}>{step.title}</span>
              <span className={subClass(step.state)}>{step.subtext}</span>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
};

export default ProcessTracker;

