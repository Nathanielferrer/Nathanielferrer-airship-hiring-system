import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import ConfirmModal from '../../../components/ConfirmModal/ConfirmModal';

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
  allCandidates = [],
  onClose,
  onScheduleContract,
  onSignContract,
  onWithdrawContract
}) => {
  if (!candidate) return null;

  const candidateName = candidate.candidate_name || `${candidate.User_Fname || ''} ${candidate.User_Lname || ''}`.trim() || 'Candidate';
  const candidateEmail = candidate.candidate_email || candidate.User_Email || 'No email provided';
  const candidateJob = candidate.job_title || 'Position';
  const normStatus = (candidate.status || '').toUpperCase();

  const isContractScheduled = ['CONTRACT SIGNING SCHEDULED', 'CONTRACT_SIGNING_SCHEDULED'].includes(normStatus);

  // Scheduling Form State
  const [contractDate, setContractDate] = useState(candidate.contract_signing_date || '');
  const [contractTime, setContractTime] = useState(() => to24hTime(candidate.contract_signing_time));
  const [contractLocation, setContractLocation] = useState(candidate.contract_signing_location || '352 T. Pinpin Escolta St., Binondo, Manila, 1006');
  const [contractNotes, setContractNotes] = useState(candidate.contract_signing_notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const drawerDateRef = useRef(null);
  const drawerTimeRef = useRef(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'primary',
    onConfirm: null
  });

  useEffect(() => {
    if (candidate?.contract_signing_time) {
      setContractTime(to24hTime(candidate.contract_signing_time));
    }
    if (candidate?.contract_signing_date) {
      setContractDate(candidate.contract_signing_date);
    }
    if (candidate?.contract_signing_location) {
      setContractLocation(candidate.contract_signing_location);
    }
    if (candidate?.contract_signing_notes) {
      setContractNotes(candidate.contract_signing_notes);
    }
    setScheduleError(null);
    setShowEditForm(!isContractScheduled);
  }, [candidate, isContractScheduled]);

  // Find all occupied contract signing slots on the selected date by other candidates
  const bookedSlotsForDate = React.useMemo(() => {
    if (!contractDate || !Array.isArray(allCandidates)) return [];
    return allCandidates.filter(c => {
      if (c.application_id === candidate.application_id) return false;
      if (!c.contract_signing_date || c.contract_signing_date !== contractDate) return false;
      const s = (c.status || '').toUpperCase();
      if (['CANDIDATE WITHDREW', 'CANDIDATE_WITHDREW', 'CANDIDATE NO SHOW', 'CANDIDATE_NO_SHOW', 'FAILED FINAL APPROVAL', 'REJECTED'].includes(s)) return false;
      return Boolean(c.contract_signing_time);
    }).map(c => {
      const name = c.candidate_name || `${c.User_Fname || ''} ${c.User_Lname || ''}`.trim() || 'Candidate';
      return {
        time: formatTime12h(c.contract_signing_time),
        time24: to24hTime(c.contract_signing_time),
        name,
        job: c.job_title || 'Position'
      };
    });
  }, [contractDate, allCandidates, candidate.application_id]);

  const firstInitial = (candidate.User_Fname || candidateName || 'C').charAt(0).toUpperCase();

  const handleScheduleSubmit = (e) => {
    if (e) e.preventDefault();
    setScheduleError(null);

    if (!contractDate) {
      if (drawerDateRef.current) {
        drawerDateRef.current.setCustomValidity('Please select a contract signing date.');
        drawerDateRef.current.reportValidity();
      }
      return;
    }
    const cDay = new Date(contractDate + 'T00:00:00').getDay();
    if (cDay === 0 || cDay === 6) {
      if (drawerDateRef.current) {
        drawerDateRef.current.setCustomValidity('Weekends are disabled. Contract signing can only be scheduled on weekdays (Monday to Friday).');
        drawerDateRef.current.reportValidity();
      }
      return;
    }
    if (drawerDateRef.current) drawerDateRef.current.setCustomValidity('');

    if (!contractTime) {
      if (drawerTimeRef.current) {
        drawerTimeRef.current.setCustomValidity('Please select a contract signing time.');
        drawerTimeRef.current.reportValidity();
      }
      return;
    }
    const [h, m] = contractTime.split(':').map(Number);
    const totalMins = h * 60 + m;
    if (totalMins < 480) {
      if (drawerTimeRef.current) {
        drawerTimeRef.current.setCustomValidity('Value must be 8:00 AM or later.');
        drawerTimeRef.current.reportValidity();
      }
      return;
    }
    if (totalMins >= 1020) {
      if (drawerTimeRef.current) {
        drawerTimeRef.current.setCustomValidity('Value must be earlier than 5:00 PM.');
        drawerTimeRef.current.reportValidity();
      }
      return;
    }
    if (drawerTimeRef.current) drawerTimeRef.current.setCustomValidity('');

    const formattedTime = formatTime12h(contractTime);
    const dateFormatted = new Date(contractDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Check for client-side schedule collision
    const existingConflict = bookedSlotsForDate.find(b => b.time24 === contractTime);
    if (existingConflict) {
      const fullDate = new Date(contractDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
      setScheduleError(`Schedule Conflict: A contract signing appointment is already scheduled for "${existingConflict.name}" (${existingConflict.job}) on ${fullDate} at ${formattedTime}. You cannot schedule multiple candidates at the same time.`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: isContractScheduled ? 'Confirm Schedule Update' : 'Confirm Contract Signing Schedule',
      message: `Send contract signing appointment to "${candidateName}" for ${dateFormatted} at ${formattedTime}?`,
      confirmText: isContractScheduled ? 'Update Schedule' : 'Confirm & Send',
      cancelText: 'Cancel',
      type: 'primary',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        setScheduleError(null);
        try {
          if (onScheduleContract) {
            const result = await onScheduleContract(candidate.application_id, {
              date: contractDate,
              time: formattedTime,
              location: contractLocation,
              notes: contractNotes,
              candidateName,
              candidateEmail,
              candidateJob
            });
            if (result && result.success === false) {
              setScheduleError(result.message || 'Schedule conflict: An appointment already exists at this date and time.');
              return;
            }
            setShowEditForm(false);
          }
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const handleSignContract = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Contract Execution',
      message: `Confirm that "${candidateName}" has signed the official employment contract for ${candidateJob}? This will advance their status to Requirement Pending and move them to Onboarding.`,
      confirmText: 'Mark Contract Signed',
      cancelText: 'Cancel',
      type: 'primary',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        try {
          if (onSignContract) {
            await onSignContract(candidate.application_id, candidateName, candidateJob);
          }
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const handleNoShow = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Record Contract Signing No Show',
      message: `Are you sure you want to mark "${candidateName}" as No Show for contract signing? This indicates the candidate did not show up to sign their contract.`,
      confirmText: 'Record Contract No Show',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsSubmitting(true);
        try {
          if (onWithdrawContract) {
            await onWithdrawContract(candidate.application_id, candidateName, candidateJob);
          }
        } finally {
          setIsSubmitting(false);
        }
      }
    });
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
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden'
        }}
      >
        {/* ── Top Header ── */}
        <div style={{
          padding: '22px 28px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: '#475569',
              marginBottom: '3px'
            }}>
              <i className="bx bx-briefcase" style={{ fontSize: '14px', color: '#059669' }}></i>
              <span>Contract Signing Stage</span>
            </div>
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '800',
              color: '#0f172a',
              fontFamily: "'Montserrat', sans-serif",
              letterSpacing: '-0.3px'
            }}>
              Contract Signing
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
              fontSize: '18px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
          >
            <i className="bx bx-x" style={{ fontSize: '20px' }} />
          </button>
        </div>

        {/* ── Candidate & Status Summary Bar ── */}
        <div style={{
          padding: '20px 28px',
          background: '#ffffff',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '18px',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)'
            }}>
              {firstInitial}
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a', fontFamily: "'Montserrat', sans-serif" }}>
                {candidateName}
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '600', color: '#334155' }}>{candidateJob}</span>
                <span>&bull;</span>
                <span>{candidateEmail}</span>
                {(candidate.candidate_mobile || candidate.User_Mobile) && (
                  <>
                    <span>&bull;</span>
                    <span 
                      style={{ color: '#334155', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <i className='bx bx-phone' style={{ fontSize: '14px', color: '#64748b' }}></i>
                      {candidate.candidate_mobile || candidate.User_Mobile}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div>
            {isContractScheduled ? (
              <span style={{
                background: '#ecfdf5',
                color: '#047857',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <i className="bx bx-check-circle" style={{ fontSize: '15px' }} />
                <span>Contract Scheduled</span>
              </span>
            ) : (
              <span style={{
                background: '#fffbeb',
                color: '#b45309',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid #fde68a',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <i className="bx bx-time-five" style={{ fontSize: '15px' }} />
                <span>Awaiting Schedule</span>
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
          gap: '20px',
          background: '#ffffff'
        }}>
          {/* Appointment Information Card if Scheduled */}
          {isContractScheduled && !showEditForm && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '800', fontSize: '14px', fontFamily: "'Montserrat', sans-serif" }}>
                  <i className="bx bx-calendar-check" style={{ fontSize: '20px', color: '#059669' }} />
                  <span>Scheduled Appointment Details</span>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '12px',
                fontSize: '13px',
                color: '#334155'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="bx bx-calendar" style={{ fontSize: '17px', color: '#059669', marginTop: '1px' }} />
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Date</div>
                    <div style={{ fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                      {candidate.contract_signing_date ? new Date(candidate.contract_signing_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) : 'Pending'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="bx bx-time" style={{ fontSize: '17px', color: '#059669', marginTop: '1px' }} />
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Time</div>
                    <div style={{ fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                      {candidate.contract_signing_time || '09:00 AM'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <i className="bx bx-map-pin" style={{ fontSize: '17px', color: '#059669', marginTop: '1px' }} />
                  <div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Location</div>
                    <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                      {candidate.contract_signing_location || '352 T. Pinpin Escolta St., Binondo, Manila, 1006'}
                    </div>
                  </div>
                </div>

                {candidate.contract_signing_notes && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <i className="bx bx-note" style={{ fontSize: '17px', color: '#059669', marginTop: '1px' }} />
                    <div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Notes / Instructions</div>
                      <div style={{ color: '#334155', marginTop: '2px' }}>
                        {candidate.contract_signing_notes}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Schedule Form (Shown when not scheduled or when HR clicks Reschedule) */}
          {(!isContractScheduled || showEditForm) && (
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '800', fontSize: '14px', fontFamily: "'Montserrat', sans-serif" }}>
                  <i className="bx bx-calendar-plus" style={{ fontSize: '20px', color: '#059669' }} />
                  <span>{isContractScheduled ? 'Update Appointment Schedule' : 'Schedule Contract Signing Appointment'}</span>
                </div>
                {isContractScheduled && (
                  <button
                    type="button"
                    onClick={() => setShowEditForm(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'flex-start' }}>
                {/* Signing Date */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', height: '28px', boxSizing: 'border-box' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                      Signing Date <span style={{ color: '#e6007e' }}>*</span>
                    </label>
                  </div>
                  <input
                    ref={drawerDateRef}
                    type="date"
                    value={contractDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setContractDate(val);
                      setScheduleError(null);
                      if (val) {
                        const day = new Date(val + 'T00:00:00').getDay();
                        if (day === 0 || day === 6) {
                          if (drawerDateRef.current) {
                            drawerDateRef.current.setCustomValidity('Weekends are disabled. Contract signing can only be scheduled on weekdays (Monday to Friday).');
                            setTimeout(() => drawerDateRef.current?.reportValidity(), 50);
                          }
                          return;
                        }
                      }
                      if (drawerDateRef.current) drawerDateRef.current.setCustomValidity('');
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', height: '28px', boxSizing: 'border-box', gap: '6px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                      Signing Time <span style={{ color: '#e6007e' }}>*</span>
                    </label>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', color: '#0284c7', background: '#e0f2fe', padding: '0 7px', height: '20px', borderRadius: '4px', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0, boxSizing: 'border-box' }}>
                      8:00 AM – 5:00 PM
                    </span>
                  </div>
                  <input
                    ref={drawerTimeRef}
                    type="time"
                    min="08:00"
                    max="16:59"
                    value={contractTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setContractTime(val);
                      setScheduleError(null);
                      if (val) {
                        const [h, m] = val.split(':').map(Number);
                        const mins = h * 60 + m;
                        if (mins < 480) {
                          if (drawerTimeRef.current) {
                            drawerTimeRef.current.setCustomValidity('Value must be 8:00 AM or later.');
                            setTimeout(() => drawerTimeRef.current?.reportValidity(), 50);
                          }
                          return;
                        } else if (mins >= 1020) {
                          if (drawerTimeRef.current) {
                            drawerTimeRef.current.setCustomValidity('Value must be earlier than 5:00 PM.');
                            setTimeout(() => drawerTimeRef.current?.reportValidity(), 50);
                          }
                          return;
                        }
                      }
                      if (drawerTimeRef.current) drawerTimeRef.current.setCustomValidity('');
                    }}
                    onInvalid={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const [h, m] = val.split(':').map(Number);
                        const mins = h * 60 + m;
                        if (mins < 480) {
                          e.target.setCustomValidity('Value must be 8:00 AM or later.');
                        } else if (mins >= 1020) {
                          e.target.setCustomValidity('Value must be earlier than 5:00 PM.');
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
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

              {/* Booked Slots Indicator on Selected Date */}
              {bookedSlotsForDate.length > 0 && (
                <div style={{
                  fontSize: '12px',
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '8px',
                  padding: '9px 12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  lineHeight: 1.45
                }}>
                  <i className="bx bx-calendar-event" style={{ fontSize: '16px', color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong>Booked time(s) on this date:</strong>{' '}
                    {bookedSlotsForDate.map(b => `${b.time} (${b.name})`).join(', ')}
                  </div>
                </div>
              )}

              {/* Duplicate Schedule Error Banner */}
              {scheduleError && (
                <div style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fecaca',
                  borderRadius: '10px',
                  padding: '13px 16px',
                  color: '#991b1b',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)'
                }}>
                  <i className="bx bx-error-circle" style={{ fontSize: '22px', color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: '13.5px', marginBottom: '2px', color: '#b91c1c' }}>
                      Cannot Schedule: Slot Already Booked
                    </strong>
                    <span>{scheduleError}</span>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Appointment Location
                </label>
                <input
                  type="text"
                  value={contractLocation}
                  onChange={(e) => setContractLocation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontFamily: "'Inter', sans-serif"
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  What to Bring / Notes
                </label>
                <textarea
                  value={contractNotes}
                  onChange={(e) => setContractNotes(e.target.value)}
                  placeholder="e.g. Bring 2 valid IDs and 1 black ballpen."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
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
          )}
        </div>

        {/* ── Fixed Bottom Actions Footer ── */}
        <div style={{
          padding: '18px 28px',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {showEditForm ? (
            <>
              <button
                type="button"
                onClick={handleScheduleSubmit}
                disabled={isSubmitting || !contractDate}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '9px',
                  border: 'none',
                  background: contractDate ? '#0f172a' : '#cbd5e1',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: (isSubmitting || !contractDate) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: contractDate ? '0 4px 14px rgba(15, 23, 42, 0.2)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="bx bx-calendar-check" style={{ fontSize: '18px' }} />
                <span>{isSubmitting ? 'Saving Schedule...' : (isContractScheduled ? 'Update Schedule' : 'Save & Send Schedule')}</span>
              </button>

              {isContractScheduled && (
                <button
                  type="button"
                  onClick={handleNoShow}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid #fecdd3',
                    background: '#fff1f2',
                    color: '#e11d48',
                    fontWeight: '700',
                    fontSize: '12.5px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  title="Candidate did not show up to sign the contract"
                >
                  <i className="bx bx-calendar-x" style={{ fontSize: '16px' }} />
                <span>Contract Signing No Show</span>
                </button>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                Marking the contract as signed moves the candidate to <strong>Onboarding</strong> with status <strong>Requirement Pending</strong> to complete their pre-employment requirements.
              </p>
              <button
                type="button"
                onClick={handleSignContract}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '9px',
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
                <span>{isSubmitting ? 'Processing...' : 'Mark Contract Signed'}</span>
              </button>
              <button
                type="button"
                onClick={handleNoShow}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #fecdd3',
                  background: '#fff1f2',
                  color: '#e11d48',
                  fontWeight: '700',
                  fontSize: '12.5px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
                title="Candidate did not show up to sign the contract"
              >
                <i className="bx bx-calendar-x" style={{ fontSize: '16px' }} />
                <span>Contract Signing No Show</span>
              </button>
            </>
          )}
        </div>
      </div>

      {confirmModal.isOpen && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
          type={confirmModal.type}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>,
    document.body
  );
};

export default OnboardingDrawer;
