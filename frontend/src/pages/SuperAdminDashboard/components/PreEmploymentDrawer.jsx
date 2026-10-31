import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import WeekdayCalendarPicker from '../../../components/WeekdayCalendarPicker/WeekdayCalendarPicker';

import { API_BASE_URL } from '../../../utils/apiConfig';
const ONBOARDING_REQUIREMENTS = [
  { id: 'medical', label: 'Medical Certificate', icon: 'bx-plus-medical', desc: 'Fit to work medical clearance from accredited clinic' },
  { id: 'drug_test', label: 'Drug Test Result', icon: 'bx-test-tube', desc: 'Negative 5-panel or 10-panel drug screening certificate' },
  { id: 'nbi', label: 'NBI Clearance', icon: 'bx-shield-quarter', desc: 'Valid government-issued national security clearance' },
  { id: 'police', label: 'Police Clearance', icon: 'bx-badge-check', desc: 'Local municipal or PNP station clearance certificate' },
  { id: 'coe', label: 'Certificate of Employment', icon: 'bx-briefcase-alt-2', desc: 'Previous employer clearance certificate' },
  { id: 'tor_diploma', label: 'Transcript of Records / Diploma', icon: 'bx-certification', desc: 'Certified true copy of educational academic records' }
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
  if (!t) return '08:00';
  const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return t;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = (match[3] || '').toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
};

const PreEmploymentDrawer = ({
  candidate,
  onClose,
  onCompleteRequirements,
  onScheduleUpdated
}) => {
  if (!candidate) return null;

  const candidateName = candidate.candidate_name || `${candidate.User_Fname || ''} ${candidate.User_Lname || ''}`.trim() || 'Candidate';
  const candidateEmail = candidate.candidate_email || candidate.User_Email || 'No email provided';
  const candidateJob = candidate.job_title || 'Position';
  const normStatus = (candidate.status || '').toUpperCase();

  const isCompletedReq = (['COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS', 'OFFICIALLY HIRED & REQUIREMENTS COMPLETED', 'OFFICIALLY HIRED', 'OFFICIALLY_HIRED'].includes(normStatus) && Boolean(candidate.work_start_date)) || (['COMPLETED REQUIREMENTS', 'COMPLETED_REQUIREMENTS'].includes(normStatus));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState(null);

  // Schedule form state
  const [startDate, setStartDate] = useState(candidate.work_start_date || '');
  const [startTime, setStartTime] = useState(() => to24hTime(candidate.work_start_time || '08:00'));
  const [location, setLocation] = useState(candidate.work_start_location || 'Airship Express HQ - Manila Hub, 352 T. Pinpin St., Binondo, Manila');
  const [reportingTo, setReportingTo] = useState(candidate.work_start_reporting_to || 'HR Department / Branch Operations Manager');
  const [notes, setNotes] = useState(candidate.work_start_notes || 'Please bring 2 valid government-issued IDs, wear business casual attire, and report to the 2nd Floor Reception.');
  const [isEditingSchedule, setIsEditingSchedule] = useState(!candidate.work_start_date);

  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);

  // Pre-employment requirements checklist state (Verified vs Pending only - Waive removed)
  const [checklist, setChecklist] = useState(() => {
    try {
      if (candidate.pre_employment_checklist) {
        const parsed = JSON.parse(candidate.pre_employment_checklist);
        const normalized = {};
        Object.keys(parsed).forEach(k => {
          normalized[k] = (parsed[k] === true || parsed[k] === 'verified') ? 'verified' : 'pending';
        });
        return normalized;
      }
    } catch (e) {
      console.error(e);
    }
    return { medical: 'pending', drug_test: 'pending', nbi: 'pending', police: 'pending', coe: 'pending', tor_diploma: 'pending' };
  });

  useEffect(() => {
    if (candidate) {
      try {
        if (candidate.pre_employment_checklist) {
          const parsed = JSON.parse(candidate.pre_employment_checklist);
          const normalized = {};
          Object.keys(parsed).forEach(k => {
            normalized[k] = (parsed[k] === true || parsed[k] === 'verified') ? 'verified' : 'pending';
          });
          setChecklist(normalized);
        } else {
          setChecklist({ medical: 'pending', drug_test: 'pending', nbi: 'pending', police: 'pending', coe: 'pending', tor_diploma: 'pending' });
        }
      } catch (e) {
        console.error(e);
      }

      if (candidate.work_start_date) setStartDate(candidate.work_start_date);
      if (candidate.work_start_time) setStartTime(to24hTime(candidate.work_start_time));
      if (candidate.work_start_location) setLocation(candidate.work_start_location);
      if (candidate.work_start_reporting_to) setReportingTo(candidate.work_start_reporting_to);
      if (candidate.work_start_notes) setNotes(candidate.work_start_notes);
      setIsEditingSchedule(!candidate.work_start_date);
    }
  }, [candidate]);

  const firstInitial = (candidate.User_Fname || candidateName || 'C').charAt(0).toUpperCase();

  const handleToggleVerify = async (reqId) => {
    const current = checklist[reqId];
    const newStatus = (current === 'verified') ? 'pending' : 'verified';
    const updatedChecklist = { ...checklist, [reqId]: newStatus };
    setChecklist(updatedChecklist);
    
    try {
      await fetch(`${API_BASE_URL}/super_admin/interviews/update_checklist.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({
          application_id: candidate.application_id,
          checklist: updatedChecklist
        })
      });
      candidate.pre_employment_checklist = JSON.stringify(updatedChecklist);
    } catch (err) {
      console.error("Failed to update checklist:", err);
    }
  };

  const handleToggleSelectAll = async () => {
    const targetStatus = isFullyVerified ? 'pending' : 'verified';
    const updatedChecklist = {};
    ONBOARDING_REQUIREMENTS.forEach(req => {
      updatedChecklist[req.id] = targetStatus;
    });
    setChecklist(updatedChecklist);

    try {
      await fetch(`${API_BASE_URL}/super_admin/interviews/update_checklist.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({
          application_id: candidate.application_id,
          checklist: updatedChecklist
        })
      });
      candidate.pre_employment_checklist = JSON.stringify(updatedChecklist);
    } catch (err) {
      console.error("Failed to update checklist:", err);
    }
  };

  const verifiedCount = ONBOARDING_REQUIREMENTS.filter(req => checklist[req.id] === 'verified').length;
  const isFullyVerified = verifiedCount === ONBOARDING_REQUIREMENTS.length;

  // Minimum date for scheduling: tomorrow
  const minDateStr = (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  })();

  const validateSchedule = () => {
    if (!startDate) {
      if (dateInputRef.current) {
        dateInputRef.current.setCustomValidity('Please select an official start date.');
        dateInputRef.current.reportValidity();
      }
      return false;
    }
    const day = new Date(startDate + 'T00:00:00').getDay();
    if (day === 0 || day === 6) {
      if (dateInputRef.current) {
        dateInputRef.current.setCustomValidity('Weekends are disabled. Work start date must be a weekday (Monday to Friday).');
        dateInputRef.current.reportValidity();
      }
      return false;
    }
    if (!startTime) {
      if (timeInputRef.current) {
        timeInputRef.current.setCustomValidity('Please select a start time.');
        timeInputRef.current.reportValidity();
      }
      return false;
    }
    const [h, m] = startTime.split(':').map(Number);
    const totalMins = h * 60 + m;
    if (totalMins < 480) {
      if (timeInputRef.current) {
        timeInputRef.current.setCustomValidity('Value must be 8:00 AM or later.');
        timeInputRef.current.reportValidity();
      }
      return false;
    }
    if (totalMins >= 1020) {
      if (timeInputRef.current) {
        timeInputRef.current.setCustomValidity('Value must be earlier than 5:00 PM.');
        timeInputRef.current.reportValidity();
      }
      return false;
    }
    if (timeInputRef.current) timeInputRef.current.setCustomValidity('');
    return true;
  };

  const handleMarkComplete = async () => {
    if (!validateSchedule()) return;

    setIsSubmitting(true);
    try {
      if (onCompleteRequirements) {
        await onCompleteRequirements(
          candidate.application_id,
          'Officially Hired',
          candidateName,
          candidateJob,
          {
            work_start_date: startDate,
            work_start_time: startTime,
            work_start_location: location,
            work_start_reporting_to: reportingTo,
            work_start_notes: notes
          }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveScheduleOnly = async (e) => {
    if (e) e.preventDefault();
    if (!validateSchedule()) return;

    setIsUpdatingSchedule(true);
    setScheduleFeedback(null);
    try {
      const res = await fetch(`${API_BASE_URL}/super_admin/interviews/update_start_schedule.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({
          application_id: candidate.application_id,
          work_start_date: startDate,
          work_start_time: startTime,
          work_start_location: location,
          work_start_reporting_to: reportingTo,
          work_start_notes: notes
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        candidate.work_start_date = startDate;
        candidate.work_start_time = startTime;
        candidate.work_start_location = location;
        candidate.work_start_reporting_to = reportingTo;
        candidate.work_start_notes = notes;
        setIsEditingSchedule(false);
        setScheduleFeedback({ type: 'success', message: 'Day 1 Start Schedule saved & updated notification sent!' });
        if (onScheduleUpdated) onScheduleUpdated();
      } else {
        setScheduleFeedback({ type: 'error', message: data.message || 'Failed to update start schedule.' });
      }
    } catch (err) {
      console.error(err);
      setScheduleFeedback({ type: 'error', message: 'Connection error while saving schedule.' });
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="admin-drawer-overlay" onClick={onClose} style={{ zIndex: 2200 }}>
      <div
        className="admin-drawer-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '580px',
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
          padding: '20px 28px 18px 28px',
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
              Pre-Employment Requirements
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Verify mandatory physical documents and schedule official Day 1 start
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
          padding: '14px 28px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '800',
              fontSize: '16px',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)',
              flexShrink: 0
            }}>
              {firstInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a' }}>
                {candidateName}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{candidateJob}</span>
                <span>&bull;</span>
                <span>{candidateEmail}</span>
                {(candidate.candidate_mobile || candidate.User_Mobile) && (
                  <>
                    <span>&bull;</span>
                    <span style={{ color: '#334155', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                      <i className='bx bx-phone' style={{ fontSize: '13px', color: '#64748b' }}></i>
                      {candidate.candidate_mobile || candidate.User_Mobile}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            {isCompletedReq ? (
              <span style={{
                background: '#ecfdf5',
                color: '#047857',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: '1.5px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <i className="bx bx-check-double" style={{ fontSize: '15px' }} />
                <span style={{ whiteSpace: 'nowrap' }}>Cleared for Day 1 (6/6 Verified)</span>
              </span>
            ) : isFullyVerified ? (
              <span style={{
                background: '#ecfdf5',
                color: '#047857',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: '1.5px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <i className="bx bx-check-circle" style={{ fontSize: '15px' }} />
                <span style={{ whiteSpace: 'nowrap' }}>6 of 6 Verified — Ready to Schedule</span>
              </span>
            ) : (
              <span style={{
                background: '#fffbeb',
                color: '#b45309',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: '700',
                border: '1.5px solid #fde68a',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}>
                <i className="bx bx-time" style={{ fontSize: '14px' }} />
                <span style={{ whiteSpace: 'nowrap' }}>{verifiedCount} of 6 Verified</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Scrollable Body Content ── */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '22px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          background: '#ffffff'
        }}>
          {/* ── WORK START SCHEDULE CARD (Appears when all 6 verified or already completed) ── */}
          {(isFullyVerified || isCompletedReq) && (
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
              position: 'relative',
              animation: 'fadeInSchedule 0.25s ease'
            }}>
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    <i className="bx bx-calendar-star" />
                  </div>
                  <div>
                    <h4 style={{
                      margin: 0,
                      fontSize: '14.5px',
                      fontWeight: '800',
                      color: '#0f172a',
                      fontFamily: "'Montserrat', sans-serif"
                    }}>
                      Day 1 Work Start Schedule
                    </h4>
                    <p style={{ margin: '1px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                      Configure official reporting schedule for candidate's first day
                    </p>
                  </div>
                </div>

                {isCompletedReq && !isEditingSchedule && (
                  <button
                    type="button"
                    onClick={() => setIsEditingSchedule(true)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      color: '#0f172a',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <i className="bx bx-edit" /> Edit Schedule
                  </button>
                )}
              </div>

              {scheduleFeedback && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '12px',
                  background: scheduleFeedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
                  color: scheduleFeedback.type === 'success' ? '#047857' : '#b91c1c',
                  border: scheduleFeedback.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca'
                }}>
                  {scheduleFeedback.message}
                </div>
              )}

              {/* Form Mode vs Confirmed Display Mode */}
              {(!isCompletedReq || isEditingSchedule) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#334155', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Start Date <span style={{ color: '#e11d48' }}>*</span>
                      </label>
                      <WeekdayCalendarPicker
                        value={startDate}
                        min={minDateStr}
                        onChange={(val) => {
                          setStartDate(val);
                        }}
                        placeholder="Select start date..."
                        required
                      />
                      <span style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                        Weekdays only (Monday to Friday)
                      </span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#334155', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Arrival Time <span style={{ color: '#e11d48' }}>*</span>
                      </label>
                      <input
                        type="time"
                        ref={timeInputRef}
                        min="08:00"
                        max="16:59"
                        value={startTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStartTime(val);
                          if (val) {
                            const [h, m] = val.split(':').map(Number);
                            const mins = h * 60 + m;
                            if (mins < 480) {
                              if (timeInputRef.current) {
                                timeInputRef.current.setCustomValidity('Value must be 8:00 AM or later.');
                                setTimeout(() => timeInputRef.current?.reportValidity(), 50);
                              }
                              return;
                            } else if (mins >= 1020) {
                              if (timeInputRef.current) {
                                timeInputRef.current.setCustomValidity('Value must be earlier than 5:00 PM.');
                                setTimeout(() => timeInputRef.current?.reportValidity(), 50);
                              }
                              return;
                            }
                          }
                          if (timeInputRef.current) timeInputRef.current.setCustomValidity('');
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
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#0f172a',
                          background: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      />
                      <span style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                        Office hours: 8:00 AM – 5:00 PM
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#334155', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Location (Branch / Hub Name)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Branch or Hub Name and Address"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '13px',
                        color: '#0f172a',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#334155', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Reporting To (Manager's Name / Title)
                    </label>
                    <input
                      type="text"
                      value={reportingTo}
                      onChange={(e) => setReportingTo(e.target.value)}
                      placeholder="e.g. John Doe (Operations Head) or HR Team"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '13px',
                        color: '#0f172a',
                        background: '#ffffff',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '800', color: '#334155', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Day 1 Notes / Reporting Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="First day instructions, dress code, items to bring..."
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '12.5px',
                        color: '#0f172a',
                        background: '#ffffff',
                        boxSizing: 'border-box',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  {isCompletedReq && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingSchedule(false)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveScheduleOnly}
                        disabled={isUpdatingSchedule}
                        style={{
                          background: '#059669',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#ffffff',
                          cursor: isUpdatingSchedule ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <i className="bx bx-save" />
                        <span>{isUpdatingSchedule ? 'Saving...' : 'Save & Update Notifications'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Confirmed Grid Display */
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '14px 16px'
                }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      START DATE
                    </span>
                    <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px', display: 'block' }}>
                      {startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                    </span>
                  </div>

                  <div>
                    <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ARRIVAL TIME
                    </span>
                    <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginTop: '2px', display: 'block' }}>
                      {formatTime12h(startTime) || '08:00 AM'}
                    </span>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      LOCATION
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px', display: 'block', lineHeight: '1.4' }}>
                      {location || 'Head Office'}
                    </span>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      REPORTING TO
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a', marginTop: '2px', display: 'block' }}>
                      {reportingTo || 'HR Department'}
                    </span>
                  </div>

                  {notes && (
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #e2e8f0', paddingTop: '8px' }}>
                      <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        DAY 1 INSTRUCTIONS
                      </span>
                      <span style={{ fontSize: '12px', color: '#334155', marginTop: '2px', display: 'block', lineHeight: '1.4' }}>
                        {notes}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Requirements Section ── */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <h4 style={{
                margin: 0,
                fontSize: '14px',
                fontWeight: '800',
                color: '#0f172a',
                fontFamily: "'Montserrat', sans-serif"
              }}>
                Mandatory Physical Documents
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!isCompletedReq && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    style={{
                      background: isFullyVerified ? '#f8fafc' : '#eff6ff',
                      border: isFullyVerified ? '1px solid #cbd5e1' : '1px solid #bfdbfe',
                      color: isFullyVerified ? '#475569' : '#1d4ed8',
                      padding: '3px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    title={isFullyVerified ? 'Unmark all requirements' : 'Verify all requirements at once'}
                  >
                    <i className={`bx ${isFullyVerified ? 'bx-checkbox-checked' : 'bx-check-double'}`} style={{ fontSize: '14px' }} />
                    <span>{isFullyVerified ? 'Unselect All' : 'Select All (Verify All)'}</span>
                  </button>
                )}
                <span style={{
                  fontSize: '11.5px',
                  fontWeight: '700',
                  color: isFullyVerified ? '#047857' : '#475569',
                  background: isFullyVerified ? '#ecfdf5' : '#f1f5f9',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: isFullyVerified ? '1px solid #a7f3d0' : '1px solid #e2e8f0'
                }}>
                  {verifiedCount} of {ONBOARDING_REQUIREMENTS.length} Verified
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
              {isCompletedReq 
                ? 'All mandatory pre-employment documents have been verified and candidate is cleared for Day 1.'
                : 'All 6 requirements must be physically verified by HR before the candidate can be cleared for Day 1 start.'}
            </p>

            {/* Checklist items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ONBOARDING_REQUIREMENTS.map((req) => {
                const status = checklist[req.id] || 'pending';
                const isVerified = status === 'verified' || status === true;

                return (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: isVerified ? '1.5px solid #a7f3d0' : '1.5px solid #e2e8f0',
                      background: isVerified ? '#f0fdf4' : '#ffffff',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13.5px',
                        fontWeight: '700',
                        color: isVerified ? '#065f46' : '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <i className={`bx ${req.icon}`} style={{ fontSize: '16px', color: isVerified ? '#059669' : '#64748b' }} />
                        <span>{req.label}</span>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: isVerified ? '#047857' : '#64748b',
                        marginTop: '2px',
                        lineHeight: '1.4'
                      }}>
                        {req.desc}
                      </div>
                    </div>

                    {/* Single action button: Verify / Verified (Waive removed) */}
                    {isCompletedReq ? (
                      <span style={{
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1.5px solid #a7f3d0',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}>
                        <i className="bx bx-check" style={{ fontSize: '15px' }} />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleVerify(req.id)}
                        title={isVerified ? 'Click to reset to pending' : 'Mark as physically verified'}
                        style={{
                          width: '100px',
                          height: '34px',
                          background: isVerified ? '#059669' : '#f8fafc',
                          color: isVerified ? '#ffffff' : '#0f172a',
                          border: isVerified ? '1.5px solid #059669' : '1.5px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                          flexShrink: 0,
                          boxSizing: 'border-box',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <i className={`bx ${isVerified ? 'bx-check-double' : 'bx-check'}`} style={{ fontSize: '16px' }} />
                        <span>{isVerified ? 'Verified' : 'Verify'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
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
          {isCompletedReq ? (
            <>
              <p style={{ margin: 0, fontSize: '12px', color: '#059669', textAlign: 'center', fontWeight: '600' }}>
                Candidate is cleared for Day 1. Start date &amp; notifications are active.
              </p>
              <div
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: '1.5px solid #a7f3d0',
                  background: '#ecfdf5',
                  color: '#047857',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  fontFamily: "'Montserrat', sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxSizing: 'border-box'
                }}
              >
                <i className="bx bx-badge-check" style={{ fontSize: '18px', color: '#059669' }} />
                <span>Cleared for Day 1: Requirements Verified (Viewing Only)</span>
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: '12px', color: isFullyVerified ? '#059669' : '#64748b', textAlign: 'center', lineHeight: '1.4', fontWeight: isFullyVerified ? '700' : 'normal' }}>
                {isFullyVerified
                  ? 'All 6 requirements verified! Review start schedule above and click below to clear candidate for Day 1.'
                  : `Please verify all 6 requirements above (${verifiedCount}/6 verified). Once completed, configure the start date above.`}
              </p>

              <button
                type="button"
                onClick={handleMarkComplete}
                disabled={isSubmitting || !isFullyVerified}
                style={{
                  width: '100%',
                  padding: '13px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isFullyVerified
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : '#e2e8f0',
                  color: isFullyVerified ? '#ffffff' : '#94a3b8',
                  fontWeight: '800',
                  fontSize: '13.5px',
                  fontFamily: "'Montserrat', sans-serif",
                  cursor: (isSubmitting || !isFullyVerified) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isFullyVerified ? '0 4px 14px rgba(5, 150, 105, 0.28)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="bx bx-calendar-check" style={{ fontSize: '19px' }} />
                <span>
                  {isSubmitting
                    ? 'Saving & Scheduling Day 1...'
                    : (isFullyVerified
                      ? 'Mark All Completed & Schedule Day 1'
                      : `Verify Remaining Documents (${verifiedCount}/6 Verified)`)}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PreEmploymentDrawer;
