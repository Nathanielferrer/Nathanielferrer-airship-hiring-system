import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const ONBOARDING_REQUIREMENTS = [
  { id: 'medical', label: 'Medical Certificate', icon: 'bx-plus-medical', desc: 'Fit to work medical clearance from accredited clinic' },
  { id: 'drug_test', label: 'Drug Test Result', icon: 'bx-test-tube', desc: 'Negative 5-panel or 10-panel drug screening certificate' },
  { id: 'nbi', label: 'NBI Clearance', icon: 'bx-shield-quarter', desc: 'Valid government-issued national security clearance' },
  { id: 'police', label: 'Police Clearance', icon: 'bx-badge-check', desc: 'Local municipal or PNP station clearance certificate' },
  { id: 'coe', label: 'Certificate of Employment (if applicable)', icon: 'bx-briefcase-alt-2', desc: 'Previous employer clearance or waiver if first-time worker' },
  { id: 'tor_diploma', label: 'Transcript of Records (TOR) or Diploma', icon: 'bx-certification', desc: 'Certified true copy of educational academic records' }
];

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

const to24hTime = (t) => {
  if (!t) return '09:00';
  const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return t;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = (match[3] || '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
};

const OnboardingDrawer = ({
  candidate,
  onClose,
  onVerifyAndSchedule,
  onScheduleContract,
  onMarkContractSigned
}) => {
  if (!candidate) return null;

  const candidateName = candidate.candidate_name || `${candidate.User_Fname || ''} ${candidate.User_Lname || ''}`.trim() || 'Candidate';
  const candidateEmail = candidate.candidate_email || candidate.User_Email || 'No email provided';
  const candidateJob = candidate.job_title || 'Position';
  const normStatus = (candidate.status || '').toUpperCase();

  const isReqVerified = ['REQUIREMENTS VERIFIED', 'REQUIREMENTS_VERIFIED'].includes(normStatus);
  const isContractScheduled = ['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(normStatus);
  const isCompleted = ['CONTRACT SIGNED & ONBOARDED', 'CONTRACT_SIGNED_AND_ONBOARDED', 'EVALUATED'].includes(normStatus);

  // Scheduling Form State
  const [showScheduleForm, setShowScheduleForm] = useState(isReqVerified && !isContractScheduled);
  const [contractDate, setContractDate] = useState(candidate.contract_signing_date || '');
  const [contractTime, setContractTime] = useState(() => to24hTime(candidate.contract_signing_time));
  const [contractLocation, setContractLocation] = useState(candidate.contract_signing_location || '352 T. Pinpin Escolta St., Binondo, Manila, 1006');
  const [contractNotes, setContractNotes] = useState(candidate.contract_signing_notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isReqVerified && !isContractScheduled) {
      setShowScheduleForm(true);
    }
  }, [normStatus, isReqVerified, isContractScheduled]);

  useEffect(() => {
    if (candidate?.contract_signing_time) {
      setContractTime(to24hTime(candidate.contract_signing_time));
    }
  }, [candidate]);

  const firstInitial = (candidate.User_Fname || candidateName || 'C').charAt(0).toUpperCase();

  const handleVerifySubmit = async () => {
    setIsSubmitting(true);
    try {
      if (onVerifyAndSchedule) {
        await onVerifyAndSchedule(candidate.application_id, candidateName, candidateJob, candidateEmail);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!contractDate) {
      alert('Please select a contract signing date.');
      return;
    }
    const formattedTime = formatTime12h(contractTime);
    setIsSubmitting(true);
    try {
      if (onScheduleContract) {
        await onScheduleContract(candidate.application_id, {
          date: contractDate,
          time: formattedTime,
          location: contractLocation,
          notes: contractNotes,
          candidateName,
          candidateEmail,
          candidateJob
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignContract = async () => {
    setIsSubmitting(true);
    try {
      if (onMarkContractSigned) {
        await onMarkContractSigned(candidate.application_id, candidateName, candidateJob);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="admin-drawer-overlay" onClick={onClose} style={{ zIndex: 2200 }}>
      <div
        className="admin-drawer-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '520px',
          maxWidth: '96vw',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#ffffff',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.12)',
          overflow: 'hidden'
        }}
      >
        {/* ── Top Header ── */}
        <div style={{
          padding: '24px 28px 18px 28px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff'
        }}>
          <div>
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '800',
              color: '#0f172a',
              fontFamily: "'Montserrat', sans-serif",
              letterSpacing: '-0.2px'
            }}>
              Manage Onboarding
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Pre-employment requirements &amp; contract execution
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
              fontSize: '18px',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
          >
            ✕
          </button>
        </div>

        {/* ── Candidate Summary Bar ── */}
        <div style={{
          padding: '16px 28px',
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #e6007e 0%, #be006b 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '16px',
              boxShadow: '0 2px 8px rgba(230, 0, 126, 0.2)'
            }}>
              {firstInitial}
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>
                {candidateName}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                {candidateJob} &bull; {candidateEmail}
              </div>
            </div>
          </div>

          <div>
            {isCompleted ? (
              <span style={{
                background: '#f0fdf4',
                color: '#15803d',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: '1px solid #bbf7d0'
              }}>
                Onboarded
              </span>
            ) : isContractScheduled ? (
              <span style={{
                background: '#f0fdf4',
                color: '#15803d',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: '1px solid #bbf7d0'
              }}>
                Contract Scheduled
              </span>
            ) : isReqVerified ? (
              <span style={{
                background: '#f0fdf4',
                color: '#15803d',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: '1px solid #bbf7d0'
              }}>
                Requirements Complete
              </span>
            ) : (
              <span style={{
                background: '#fffbeb',
                color: '#b45309',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: '1px solid #fde68a'
              }}>
                Awaiting Requirements
              </span>
            )}
          </div>
        </div>

        {/* ── Scrollable Body Content ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          background: '#ffffff'
        }}>
          {/* ── TOP SECTION: Scheduling Form or Scheduled Appointment Details ── */}
          {isContractScheduled ? (
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '700', fontSize: '14px', fontFamily: "'Montserrat', sans-serif" }}>
                <i className="bx bx-calendar-check" style={{ fontSize: '19px', color: '#059669' }} />
                <span>Scheduled Contract Signing Appointment</span>
              </div>
              <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5 }}>
                <div><strong style={{ color: '#0f172a' }}>Date:</strong> {candidate.contract_signing_date ? new Date(candidate.contract_signing_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}</div>
                <div><strong style={{ color: '#0f172a' }}>Time:</strong> {candidate.contract_signing_time || '09:00 AM'}</div>
                <div><strong style={{ color: '#0f172a' }}>Location:</strong> {candidate.contract_signing_location || '352 T. Pinpin Escolta St., Binondo, Manila, 1006'}</div>
                {candidate.contract_signing_notes && (
                  <div><strong style={{ color: '#0f172a' }}>Notes to bring:</strong> {candidate.contract_signing_notes}</div>
                )}
              </div>
            </div>
          ) : (isReqVerified || showScheduleForm) ? (
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '700', fontSize: '14px', fontFamily: "'Montserrat', sans-serif" }}>
                <i className="bx bx-calendar-plus" style={{ fontSize: '20px', color: '#e6007e' }} />
                <span>Schedule Contract Signing Appointment</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Signing Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Signing Date *
                  </label>
                  <input
                    type="date"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '10px 13px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontFamily: "'Inter', sans-serif"
                    }}
                    required
                  />
                </div>

                {/* Signing Time */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Signing Time *
                  </label>
                  <input
                    type="time"
                    value={contractTime}
                    onChange={(e) => setContractTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 13px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontFamily: "'Inter', sans-serif"
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Appointment Location
                </label>
                <input
                  type="text"
                  value={contractLocation}
                  onChange={(e) => setContractLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 13px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontFamily: "'Inter', sans-serif"
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  What to Bring / Notes
                </label>
                <textarea
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  placeholder="e.g. Bring original IDs, 2x2 photos, and black pen."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 13px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontFamily: "'Inter', sans-serif"
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* ── BOTTOM SECTION: Required Documents Checklist ── */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <h4 style={{
                margin: 0,
                fontSize: '14.5px',
                fontWeight: '700',
                color: '#0f172a',
                fontFamily: "'Montserrat', sans-serif"
              }}>
                Pre-Employment Requirements Checklist
              </h4>
              <span style={{
                fontSize: '11.5px',
                fontWeight: '700',
                color: '#475569',
                background: '#f1f5f9',
                padding: '3px 10px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                6 Documents
              </span>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#64748b', lineHeight: '1.5' }}>
              The candidate is required to submit all verified physical documents as a single bundle on or before their deadline.
            </p>

            {/* Checklist items (Pure white cards with clean borders) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ONBOARDING_REQUIREMENTS.map((req) => (
                <div
                  key={req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    padding: '13px 16px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  {/* Clean Emerald Checkmark Icon */}
                  <div style={{
                    marginTop: '1px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    flexShrink: 0,
                    border: '1px solid #a7f3d0'
                  }}>
                    <i className="bx bx-check" style={{ fontWeight: 'bold' }} />
                  </div>

                  {/* Requirement details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13.5px',
                      fontWeight: '700',
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>{req.label}</span>
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      marginTop: '2px',
                      lineHeight: '1.4'
                    }}>
                      {req.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Fixed Bottom Actions Footer ── */}
        <div style={{
          padding: '18px 28px',
          borderTop: '1px solid #f1f5f9',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {isContractScheduled ? (
            <>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', textAlign: 'center' }}>
                Candidate signed the formal contract and onboarding is ready to complete.
              </p>
              <button
                type="button"
                onClick={handleSignContract}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="bx bx-check-double" style={{ fontSize: '18px' }} />
                <span>{isSubmitting ? 'Processing...' : 'Mark Contract Signed & Complete Onboarding'}</span>
              </button>
            </>
          ) : isReqVerified || showScheduleForm ? (
            <>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', textAlign: 'center' }}>
                Submit to set the official appointment date and dispatch notification to candidate.
              </p>
              <button
                type="button"
                onClick={handleScheduleSubmit}
                disabled={isSubmitting || !contractDate}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: contractDate ? 'linear-gradient(135deg, #e6007e 0%, #be006b 100%)' : '#cbd5e1',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: (isSubmitting || !contractDate) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: contractDate ? '0 4px 14px rgba(230, 0, 126, 0.25)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="bx bx-calendar-check" style={{ fontSize: '18px' }} />
                <span>{isSubmitting ? 'Saving Schedule...' : 'Schedule Contract Signing'}</span>
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', textAlign: 'center' }}>
                All 6 requirements verified as submitted. Ready for scheduling.
              </p>
              <button
                type="button"
                onClick={handleVerifySubmit}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #e6007e 0%, #be006b 100%)',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(230, 0, 126, 0.25)',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="bx bx-check-circle" style={{ fontSize: '18px' }} />
                <span>{isSubmitting ? 'Verifying...' : 'Confirm Requirements & Schedule Contract'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingDrawer;
