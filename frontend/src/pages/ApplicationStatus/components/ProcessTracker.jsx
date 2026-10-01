import React from 'react';
import './ProcessTracker.css';

/**
 * ProcessTracker Component
 *
 * Visualises the 7-stage recruitment pipeline:
 *   1. Applied  →  2. Screening  →  3. Final Interview  →  4. President Review  →  5. Job Offer  →  6. Contract Signed  →  7. Officially Hired
 *
 * Props:
 *   status {string} - Raw application status string (e.g. 'PASSED FINAL INTERVIEW', 'JOB OFFER PENDING', 'CONTRACT SIGNED', 'OFFICIALLY HIRED')
 */
const ProcessTracker = ({ status = 'pending', app = null }) => {
  const normStatus = (status || '').toUpperCase();

  // Determine step states and sub-labels
  let activeStep = 1;
  let step1State = 'completed'; // Applied is always "completed" for submitted applications
  let step2State = 'upcoming';
  let step3State = 'upcoming';
  let step4State = 'upcoming';
  let step5State = 'upcoming';
  let step6State = 'upcoming';
  let step7State = 'upcoming';

  let step1Sub = 'Submitted';
  let step2Sub = 'Pending';
  let step3Sub = 'Pending';
  let step4Sub = 'Pending';
  let step5Sub = 'Pending';
  let step6Sub = 'Pending';
  let step7Sub = 'Pending';

  const isWithdrawnStatus = ['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'APPLICATION WITHDRAWN', 'APPLICATION_WITHDRAWN', 'WITHDRAWN'].includes(normStatus);

  // Determine which step was the withdrawal point (2 to 7)
  const withdrawnStage = (() => {
    if (!isWithdrawnStatus) return null;

    const remarks = app?.remarks || '';
    const stageMatch = remarks.match(/\[WITHDRAWN_STAGE:(\d+)\]/);
    if (stageMatch) return parseInt(stageMatch[1], 10);

    const fromMatch = remarks.match(/\[WITHDRAWN_FROM:([^\]]+)\]/);
    if (fromMatch) {
      const fromSt = fromMatch[1].toUpperCase();
      if (['PASSED INITIAL', 'PENDING SCHEDULED', 'CONFIRMED', 'INTERVIEW_SCHEDULED', 'RESCHEDULING'].includes(fromSt)) return 3;
      if (['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(fromSt)) return 4;
      if (['APPROVED FOR JOB OFFER', 'PRESIDENT APPROVED', 'READY FOR OFFER', 'READY_FOR_OFFER', 'JOB OFFER PENDING', 'OFFER EXTENDED', 'JOB_OFFER_PENDING'].includes(fromSt)) return 5;
      if (['JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(fromSt)) return 6;
      if (['CONTRACT SIGNED', 'CONTRACT_SIGNED', 'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'HIRED', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED'].includes(fromSt)) return 7;
      return 2;
    }

    if (normStatus.includes('INTERVIEW')) return 3;
    if (normStatus.includes('PRESIDENT')) return 4;
    if (normStatus.includes('OFFER') || normStatus.includes('READY')) return 5;
    if (normStatus.includes('CONTRACT')) return 6;
    if (normStatus.includes('HIRED')) return 7;

    // Default voluntary withdrawal at screening
    return 2;
  })();

  if (['PENDING', 'REVIEW_REQUIRED'].includes(normStatus)) {
    activeStep = 2;
    step2State = 'current';
    step2Sub = normStatus === 'REVIEW_REQUIRED' ? 'Action Required' : 'Under Review';

  } else if (isWithdrawnStatus) {
    const stage = withdrawnStage || 2;
    activeStep = stage;
    step1State = 'completed'; step1Sub = 'Submitted';

    // Step 2
    if (stage === 2) {
      step2State = 'withdrawn'; step2Sub = 'Withdrawn';
    } else {
      step2State = 'completed'; step2Sub = 'Passed';
    }

    // Step 3
    if (stage === 3) {
      step3State = 'withdrawn'; step3Sub = 'Withdrawn';
    } else if (stage > 3) {
      step3State = 'completed'; step3Sub = 'Passed Interview';
    } else {
      step3State = 'cancelled'; step3Sub = 'Cancelled';
    }

    // Step 4
    if (stage === 4) {
      step4State = 'withdrawn'; step4Sub = 'Withdrawn';
    } else if (stage > 4) {
      step4State = 'completed'; step4Sub = 'Approved by Pres.';
    } else {
      step4State = 'cancelled'; step4Sub = 'Cancelled';
    }

    // Step 5
    if (stage === 5) {
      step5State = 'withdrawn'; step5Sub = 'Withdrawn';
    } else if (stage > 5) {
      step5State = 'completed'; step5Sub = 'Offer Accepted';
    } else {
      step5State = 'cancelled'; step5Sub = 'Cancelled';
    }

    // Step 6
    if (stage === 6) {
      step6State = 'withdrawn'; step6Sub = 'Withdrawn';
    } else if (stage > 6) {
      step6State = 'completed'; step6Sub = 'Contract Signed';
    } else {
      step6State = 'cancelled'; step6Sub = 'Cancelled';
    }

    // Step 7
    if (stage === 7) {
      step7State = 'withdrawn'; step7Sub = 'Withdrawn';
    } else {
      step7State = 'cancelled'; step7Sub = 'Cancelled';
    }

  } else if (['REJECTED', 'SCREENING_REJECTED'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'rejected'; step2Sub = 'Not Selected';
    step3State = 'rejected'; step3Sub = 'Not Selected';
    step4State = 'rejected'; step4Sub = 'Not Selected';
    step5State = 'rejected'; step5Sub = 'Not Selected';
    step6State = 'rejected'; step6Sub = 'Not Selected';
    step7State = 'rejected'; step7Sub = 'Declined';

  } else if (normStatus === 'PASSED INITIAL') {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'current'; step3Sub = 'Queue for Slot';

  } else if (normStatus === 'PENDING SCHEDULED') {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'action_required'; step3Sub = 'Action Required';

  } else if (normStatus === 'CONFIRMED' || normStatus === 'INTERVIEW_SCHEDULED') {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'current'; step3Sub = 'Scheduled';

  } else if (normStatus === 'RESCHEDULING') {
    activeStep = 3;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'current'; step3Sub = 'Rescheduling';

  } else if (['PASSED FINAL INTERVIEW', 'PASSED_FINAL_INTERVIEW'].includes(normStatus)) {
    activeStep = 4;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'current'; step4Sub = 'Awaiting President';
    step5State = 'upcoming'; step5Sub = 'Pending Decision';
    step6State = 'upcoming'; step6Sub = 'Pending';
    step7State = 'upcoming'; step7Sub = 'Pending';

  } else if (['PASSED FINAL — WAITING FOR SLOT', 'PASSED FINAL - WAITING FOR SLOT', 'WAITING_FOR_SLOT'].includes(normStatus)) {
    activeStep = 4;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'current'; step4Sub = 'Priority Standby';
    step5State = 'upcoming'; step5Sub = 'Pending Opening';
    step6State = 'upcoming'; step6Sub = 'Pending';
    step7State = 'upcoming'; step7Sub = 'Pending';

  } else if (['APPROVED FOR JOB OFFER', 'PRESIDENT APPROVED', 'APPROVED', 'READY FOR OFFER', 'READY_FOR_OFFER'].includes(normStatus)) {
    activeStep = 5;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'current'; step5Sub = 'Preparing Offer';
    step6State = 'upcoming'; step6Sub = 'Pending';
    step7State = 'upcoming'; step7Sub = 'Pending';

  } else if (['JOB OFFER PENDING', 'JOB_OFFER_PENDING', 'OFFER EXTENDED', 'JOB OFFER EXTENDED'].includes(normStatus)) {
    activeStep = 5;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'action_required'; step5Sub = 'Action: Review Offer';
    step6State = 'upcoming'; step6Sub = 'Pending Acceptance';
    step7State = 'upcoming'; step7Sub = 'Pending';

  } else if (['OFFER EXPIRED', 'OFFER_EXPIRED', 'JOB OFFER EXPIRED'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'rejected'; step5Sub = 'Offer Expired';
    step6State = 'rejected'; step6Sub = 'Closed';
    step7State = 'rejected'; step7Sub = 'Closed';

  } else if (['INTERVIEW_FAILED', 'FAILED INTERVIEW', 'FAILED FINAL INTERVIEW', 'FAILED_FINAL_INTERVIEW', 'FAILED'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'rejected'; step3Sub = 'Interview Failed';
    step4State = 'rejected'; step4Sub = 'Not Selected';
    step5State = 'rejected'; step5Sub = 'Not Selected';
    step6State = 'rejected'; step6Sub = 'Not Selected';
    step7State = 'rejected'; step7Sub = 'Not Selected';

  } else if (['CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'NO SHOW', 'NO_SHOW'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'rejected'; step3Sub = 'No Show';
    step4State = 'rejected'; step4Sub = 'Not Selected';
    step5State = 'rejected'; step5Sub = 'Not Selected';
    step6State = 'rejected'; step6Sub = 'Not Selected';
    step7State = 'rejected'; step7Sub = 'Not Selected';

  } else if (['CONTRACT SIGNING NO SHOW', 'CONTRACT_SIGNING_NO_SHOW', 'CONTRACT NO SHOW', 'CONTRACT_NO_SHOW'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'rejected'; step6Sub = 'No Show';
    step7State = 'rejected'; step7Sub = 'Not Selected';

  } else if (['FAILED FINAL APPROVAL', 'FAILED_FINAL_APPROVAL'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'rejected'; step4Sub = 'Declined by Pres.';
    step5State = 'rejected'; step5Sub = 'Not Selected';
    step6State = 'rejected'; step6Sub = 'Not Selected';
    step7State = 'rejected'; step7Sub = 'Not Selected';

  } else if (['JOB OFFER ACCEPTED', 'JOB_OFFER_ACCEPTED', 'OFFER ACCEPTED', 'OFFER_ACCEPTED', 'PASSED FINAL APPROVAL', 'PASSED_FINAL_APPROVAL', 'HIRED', 'PASSED', 'PASSED INTERVIEW', 'HIRED / PASSED'].includes(normStatus)) {
    activeStep = 6;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'active'; step6Sub = 'Awaiting Sched.';
    step7State = 'upcoming'; step7Sub = 'Pending';

  } else if (['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(normStatus)) {
    activeStep = 6;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'active'; step6Sub = 'Signing Sched.';
    step7State = 'upcoming'; step7Sub = 'Pending';

  } else if (['CONTRACT SIGNED', 'CONTRACT_SIGNED', 'REQUIREMENT PENDING', 'REQUIREMENTS PENDING', 'REQUIREMENT_PENDING', 'REQUIREMENTS_PENDING', 'CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'HIRED - PRE-EMPLOYMENT', 'HIRED_PRE_EMPLOYMENT'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'completed'; step6Sub = 'Contract Signed';
    step7State = 'active'; step7Sub = 'Req. Pending';

  } else if (['REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'completed'; step6Sub = 'Contract Signed';
    step7State = 'active'; step7Sub = 'Req. Verified';

  } else if (['PARTIALLY COMPLIANT', 'PARTIALLY_COMPLIANT'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'completed'; step6Sub = 'Contract Signed';
    step7State = 'active'; step7Sub = 'Partially Compliant';

  } else if (['OFFICIALLY HIRED', 'OFFICIALLY_HIRED', 'OFFICIALLY HIRED & SIGNED', 'COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'completed'; step6Sub = 'Contract Signed';
    step7State = 'completed'; step7Sub = 'Officially Hired';

  } else if (['OFFER DECLINED', 'OFFER_DECLINED', 'JOB OFFER DECLINED', 'JOB_OFFER_DECLINED'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'rejected'; step5Sub = 'Declined';
    step6State = 'rejected'; step6Sub = 'Closed';
    step7State = 'rejected'; step7Sub = 'Closed';

  } else if (['INCOMPLETE REQUIREMENTS', 'INCOMPLETE_REQUIREMENTS'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'completed'; step6Sub = 'Contract Signed';
    step7State = 'rejected'; step7Sub = 'Incomplete Req.';

  } else if (['FAILED PRE-EMPLOYMENT', 'FAILED_PRE_EMPLOYMENT'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'completed'; step3Sub = 'Passed Interview';
    step4State = 'completed'; step4Sub = 'Approved by Pres.';
    step5State = 'completed'; step5Sub = 'Offer Accepted';
    step6State = 'completed'; step6Sub = 'Contract Signed';
    step7State = 'rejected'; step7Sub = 'Pre-Emp. Failed';

  } else if (['SCHEDULING EXPIRED', 'SCHEDULING_EXPIRED', 'DECLINED - UNRESPONSIVE', 'UNRESPONSIVE', 'DECLINED_UNRESPONSIVE'].includes(normStatus)) {
    activeStep = 7;
    step2State = 'completed'; step2Sub = 'Passed';
    step3State = 'rejected'; step3Sub = 'Schedule Expired';
    step4State = 'rejected'; step4Sub = 'Not Selected';
    step5State = 'rejected'; step5Sub = 'Not Selected';
    step6State = 'rejected'; step6Sub = 'Closed';
    step7State = 'rejected'; step7Sub = 'Closed';
  }

  // 7 Step definitions — using Boxicons class names (with non-breaking space after step number)
  const steps = [
    { num: 1, title: '1.\u00A0Applied', subtext: step1Sub, state: step1State, icon: 'bx bx-file-blank' },
    { num: 2, title: '2.\u00A0Screening', subtext: step2Sub, state: step2State, icon: 'bx bx-search-alt-2' },
    { num: 3, title: '3.\u00A0Final Interview', subtext: step3Sub, state: step3State, icon: 'bx bx-group' },
    { num: 4, title: '4.\u00A0President Review', subtext: step4Sub, state: step4State, icon: 'bx bx-user-check' },
    { num: 5, title: '5.\u00A0Job Offer', subtext: step5Sub, state: step5State, icon: 'bx bx-envelope-open' },
    { num: 6, title: '6.\u00A0Contract Signed', subtext: step6Sub, state: step6State, icon: 'bx bx-edit' },
    { num: 7, title: '7.\u00A0Officially Hired', subtext: step7Sub, state: step7State, icon: 'bx bx-party' },
  ];

  // ── Helper: derive CSS class names from step state ──
  const circleClass = (state) => `process-tracker__circle process-tracker__circle--${state}`;

  const titleClass = (state) => {
    if (state === 'cancelled') return 'process-tracker__title process-tracker__title--cancelled';
    if (state === 'withdrawn') return 'process-tracker__title process-tracker__title--withdrawn';
    if (state === 'rejected') return 'process-tracker__title process-tracker__title--rejected';
    if (state === 'action_required') return 'process-tracker__title process-tracker__title--action_required';
    const prominent = ['current', 'completed', 'active'].includes(state);
    return `process-tracker__title ${prominent ? 'process-tracker__title--prominent' : 'process-tracker__title--faint'}`;
  };

  const subClass = (state) => `process-tracker__subtext process-tracker__subtext--${state}`;

  const getConnectorState = (stepNum) => {
    // stepNum is 2..7, representing the incoming line from stepNum - 1 to stepNum
    if (isWithdrawnStatus) {
      const stage = withdrawnStage || 2;
      if (stepNum < stage) return 'green';
      if (stepNum === stage) return 'red';
      return 'gray';
    }

    const stepStates = [step1State, step2State, step3State, step4State, step5State, step6State, step7State];
    const currentState = stepStates[stepNum - 1];
    const prevState = stepStates[stepNum - 2];

    if (currentState === 'rejected') {
      return (prevState === 'completed' || prevState === 'active') ? 'red' : 'gray';
    }
    if (currentState === 'completed' || currentState === 'active' || currentState === 'current') {
      return 'green';
    }
    if (currentState === 'action_required') {
      return 'green';
    }

    return 'gray';
  };

  return (
    <div className="process-tracker">
      <div className="process-tracker__rail">

        {/* Step nodes with direct precision connecting segments */}
        {steps.map((step, idx) => (
          <div key={step.num} className="process-tracker__step">
            {/* Start line before Step 1 */}
            {idx === 0 && (
              <div className="process-tracker__line-start process-tracker__line-start--green" />
            )}

            {/* Connecting line from previous step to this step (steps 2 to 7) */}
            {idx > 0 && (
              <div
                className={`process-tracker__line-connector process-tracker__line-connector--${getConnectorState(step.num)}`}
              />
            )}

            <div className={circleClass(step.state)}>
              <i className={step.icon} />
            </div>
            <div className="process-tracker__labels">
              <span className={titleClass(step.state)}>{step.title}</span>
              <span className={subClass(step.state)}>{step.subtext}</span>
            </div>

            {/* End line after Step 7 */}
            {idx === steps.length - 1 && (
              <div
                className={`process-tracker__line-end process-tracker__line-end--${step7State === 'completed' || step7State === 'active' ? 'green' : 'gray'}`}
              />
            )}
          </div>
        ))}

      </div>
    </div>
  );
};

export default ProcessTracker;
