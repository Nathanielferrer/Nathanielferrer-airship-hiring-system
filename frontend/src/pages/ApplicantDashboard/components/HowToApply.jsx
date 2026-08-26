import React from 'react';

const steps = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
        fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    ),
    title: '1. Browse Jobs',
    desc:  'Use the Browse button to find roles that match your skills and interests.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
        fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    ),
    title: '2. Apply Online',
    desc:  'Complete your applicant profile and submit your online application in just minutes.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
        fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    ),
    title: '3. Get Notified',
    desc:  'Receive real-time notifications and status updates as our recruitment team reviews your application.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
        fill="none" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
      </svg>
    ),
    title: '4. Start Your Career',
    desc:  'Accept your offer, attend onboarding orientation, and step into your exciting new career.',
  },
];

/**
 * "How to Apply" 4-step guide section.
 */
const HowToApply = () => (
  <section className="how-to-apply-section" id="applicant-portal-content">
    <h2 className="section-title">How to Apply</h2>
    <p className="section-subtitle">Getting hired on Airship Express is simple and quick.</p>
    <div className="steps-grid">
      {steps.map((step, i) => (
        <div className="step-item" key={i}>
          <div className="step-icon-circle">{step.icon}</div>
          <h4 className="step-title">{step.title}</h4>
          <p className="step-desc">{step.desc}</p>
        </div>
      ))}
    </div>
  </section>
);

export default HowToApply;
