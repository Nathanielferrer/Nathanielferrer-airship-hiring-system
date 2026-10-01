import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import LoadingScreen from '../../../components/LoadingScreen/LoadingScreen';

import { API_BASE_URL } from '../../../utils/apiConfig';
const getDefaultOfferDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  // Shift past weekend if landing on Saturday or Sunday
  if (d.getDay() === 6) {
    d.setDate(d.getDate() + 2); // Saturday -> Monday
  } else if (d.getDay() === 0) {
    d.setDate(d.getDate() + 1); // Sunday -> Monday
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getMinOfferDate = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const JobOfferModal = ({
  isOpen,
  onClose,
  candidate, // { application_id, candidate_name, candidate_email, candidate_mobile, job_title, job_offer_details }
  user,
  onSuccess,
  showToast,
}) => {
  const [salary, setSalary] = useState('₱25,000.00 / month');
  const [employmentType, setEmploymentType] = useState('Full-Time');
  const [department, setDepartment] = useState('Operations & Logistics Department');
  const [offerDate, setOfferDate] = useState(getDefaultOfferDate());
  const [offerTime, setOfferTime] = useState('08:00');
  const [specialProvisions, setSpecialProvisions] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);

  useEffect(() => {
    if (candidate) {
      // Parse existing offer details if present (for Edit mode)
      let existing = {};
      try {
        if (candidate.job_offer_details) {
          existing = typeof candidate.job_offer_details === 'string'
            ? JSON.parse(candidate.job_offer_details)
            : candidate.job_offer_details;
        }
      } catch (e) {
        existing = {};
      }

      setSalary(existing.salary || '₱25,000.00 / month');
      // Normalize to Full-Time or Part-Time
      const rawType = existing.employment_type || '';
      if (rawType.toLowerCase().includes('part')) {
        setEmploymentType('Part-Time');
      } else {
        setEmploymentType('Full-Time');
      }

      setDepartment(existing.department || 'Operations & Logistics Department');
      // Special provisions start empty with no automatic placeholder text
      setSpecialProvisions(existing.special_provisions || '');

      if (existing.offer_expires_at) {
        try {
          const expDate = new Date(existing.offer_expires_at);
          if (!isNaN(expDate.getTime())) {
            const pad = (n) => String(n).padStart(2, '0');
            setOfferDate(`${expDate.getFullYear()}-${pad(expDate.getMonth() + 1)}-${pad(expDate.getDate())}`);
            setOfferTime(`${pad(expDate.getHours())}:${pad(expDate.getMinutes())}`);
          } else {
            setOfferDate(getDefaultOfferDate());
            setOfferTime('08:00');
          }
        } catch (_) {
          setOfferDate(getDefaultOfferDate());
          setOfferTime('08:00');
        }
      } else {
        setOfferDate(getDefaultOfferDate());
        setOfferTime('08:00');
      }
      setFormError('');
    }
  }, [candidate]);

  if (!isOpen || !candidate) return null;

  const candidateName = candidate.candidate_name || `${candidate.User_Fname || ''} ${candidate.User_Lname || ''}`.trim() || 'Candidate';
  const candidateEmail = candidate.candidate_email || candidate.User_Email || '';
  const jobTitle = candidate.job_title || 'Position';
  const appId = candidate.application_id || candidate.id;

  const isOutOfOfficeHours = (() => {
    if (!offerTime) return false;
    const [h, m] = offerTime.split(':').map(Number);
    const mins = (h || 0) * 60 + (m || 0);
    return mins < 480 || mins >= 1020;
  })();

  const validateAllInputs = () => {
    if (!salary.trim()) {
      setFormError('Monthly Base Salary is required.');
      return false;
    }
    if (!employmentType.trim()) {
      setFormError('Employment Type is required (must be Full-Time or Part-Time).');
      return false;
    }
    if (!department.trim()) {
      setFormError('Department / Division is required.');
      return false;
    }

    // 1. Date validation (Weekdays only)
    if (!offerDate) {
      if (dateInputRef.current) {
        dateInputRef.current.setCustomValidity('Please select an expiration date (weekdays only).');
        dateInputRef.current.reportValidity();
      }
      setFormError('Please select an expiration date (weekdays only).');
      return false;
    }
    const dayOfWeek = new Date(offerDate + 'T00:00:00').getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (dateInputRef.current) {
        dateInputRef.current.setCustomValidity('Weekends are disabled. Please select a weekday (Monday to Friday).');
        dateInputRef.current.reportValidity();
      }
      setFormError('Weekends are disabled. Please select a weekday (Monday to Friday).');
      return false;
    }

    // 2. Time validation (8:00 AM to before 5:00 PM only)
    if (!offerTime) {
      if (timeInputRef.current) {
        timeInputRef.current.setCustomValidity('Please select an expiration time.');
        timeInputRef.current.reportValidity();
      }
      setFormError('Please select an expiration time.');
      return false;
    }
    const [h, m] = offerTime.split(':').map(Number);
    const mins = (h || 0) * 60 + (m || 0);
    if (mins < 480 || mins >= 1020) {
      if (timeInputRef.current) {
        timeInputRef.current.setCustomValidity('Expiration time must follow office hours only (between 8:00 AM and before 5:00 PM).');
        timeInputRef.current.reportValidity();
      }
      setFormError('Expiration time must follow office hours only (between 8:00 AM and before 5:00 PM).');
      return false;
    }

    // 3. Future timestamp validation
    const expiryTime = new Date(`${offerDate}T${offerTime}:00`).getTime();
    if (isNaN(expiryTime) || expiryTime <= Date.now()) {
      setFormError('Offer Expiration Date & Time must be set to a future date and time.');
      return false;
    }

    setFormError('');
    return true;
  };

  const handlePreviewPdf = () => {
    if (!validateAllInputs()) {
      return;
    }

    const formattedSqlExpiry = `${offerDate} ${offerTime}:00`;
    const params = new URLSearchParams({
      application_id: appId,
      salary: salary.trim(),
      employment_type: employmentType.trim(),
      department: department.trim(),
      special_provisions: specialProvisions.trim(),
      offer_expires_at: formattedSqlExpiry
    });
    window.open(`${API_BASE_URL}/super_admin/generate_job_offer_pdf.php?${params.toString()}`, '_blank');
  };

  const handleSendOffer = async (e) => {
    e.preventDefault();
    if (!validateAllInputs()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const superAdminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || (user.email || 'Super Admin') : 'Super Admin';
      const formattedSqlExpiry = `${offerDate} ${offerTime}:00`;

      const res = await fetch(`${API_BASE_URL}/super_admin/send_job_offer.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}`
        },
        body: JSON.stringify({
          application_id: appId,
          salary: salary.trim(),
          employment_type: employmentType.trim(),
          department: department.trim(),
          special_provisions: specialProvisions.trim(),
          offer_expires_at: formattedSqlExpiry,
          actor_id: user?.id,
          actor_name: superAdminName
        })
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        if (showToast) showToast(`Job Offer Sent. ${candidateName}.`, 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        if (showToast) showToast(data.message || 'Failed to send Job Offer Letter.', 'danger');
      }
    } catch (err) {
      console.error('Job offer send error:', err);
      if (showToast) showToast('Connection error while sending Job Offer Letter.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Video Loading Screen using Splash_loading_screen.mp4 */}
      <LoadingScreen
        isOpen={isSubmitting}
        title="Generating &amp; Sending Offer..."
        subtitle={`Preparing official PDF job offer letterhead and sending notification to ${candidateName}...`}
      />

      {ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto'
          }}
          /* Modal backdrop: onClick removed so clicking outside will not close the modal */
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '640px',
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              animation: 'scaleInModal 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Dark Navy Background & Accent */}
            <div style={{ background: '#0f172a', padding: '20px 24px', color: '#ffffff', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e6007e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px' }}>
                  <i className="bx bx-file" />
                </div>
                <div>
                  <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '16px', fontWeight: '800', margin: 0, color: '#ffffff', letterSpacing: '-0.2px' }}>
                    Generate Official Job Offer Letter (PDF)
                  </h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                    Custom details added here will be embedded into the candidate's PDF Job Offer Letter
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '18px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  transition: 'all 0.15s'
                }}
                aria-label="Close"
              >
                <i className="bx bx-x" />
              </button>
            </div>

            {/* Candidate Info Highlight Box */}
            <div style={{ padding: '16px 24px 0 24px' }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                    {candidateName}{' '}
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>
                      Applying for <strong style={{ color: '#0f172a' }}>{jobTitle}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                    ({candidateEmail})
                  </div>
                </div>
                <span style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#059669',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="bx bx-check-shield" /> Final Approval Verified
                </span>
              </div>
            </div>

            {/* Error Validation Banner */}
            {formError && (
              <div style={{
                margin: '12px 24px 0 24px',
                padding: '10px 14px',
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '12.5px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="bx bx-error-circle" style={{ fontSize: '17px' }} />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleSendOffer} style={{ padding: '16px 24px 22px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* Monthly Base Salary */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Monthly Base Salary / Rate <span style={{ color: '#e6007e' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={salary}
                    onChange={(e) => { setSalary(e.target.value); setFormError(''); }}
                    placeholder="₱25,000.00 / month"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Employment Type (Full-Time or Part-Time) */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Employment Type <span style={{ color: '#e6007e' }}>*</span>
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) => { setEmploymentType(e.target.value); setFormError(''); }}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#0f172a',
                      outline: 'none',
                      background: '#ffffff',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                  </select>
                </div>
              </div>

              {/* Department / Division */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Department / Division <span style={{ color: '#e6007e' }}>*</span>
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => { setDepartment(e.target.value); setFormError(''); }}
                  placeholder="Operations & Logistics Department"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Offer Expiration Date & Time (Weekdays only, 8:00 AM to 5:00 PM) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '14px', marginBottom: '14px' }}>
                {/* Expiration Date */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Expiration Date <span style={{ color: '#e6007e' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="date"
                      ref={dateInputRef}
                      value={offerDate}
                      min={getMinOfferDate()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOfferDate(val);
                        setFormError('');
                        if (val) {
                          const day = new Date(val + 'T00:00:00').getDay();
                          if (day === 0 || day === 6) {
                            if (dateInputRef.current) {
                              dateInputRef.current.setCustomValidity('Weekends are disabled. Please select a weekday (Monday to Friday).');
                              setTimeout(() => dateInputRef.current?.reportValidity(), 50);
                            }
                            setFormError('Weekends are disabled. Please select a weekday (Monday to Friday).');
                            return;
                          }
                        }
                        if (dateInputRef.current) dateInputRef.current.setCustomValidity('');
                      }}
                      required
                      style={{
                        flex: 1,
                        padding: '8.5px 12px',
                        borderRadius: '8px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: '#0f172a',
                        outline: 'none',
                        background: '#ffffff',
                        boxSizing: 'border-box',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{
                      minWidth: '78px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: offerDate ? '#e6007e' : '#94a3b8',
                      padding: '0 8px'
                    }}>
                      {offerDate
                        ? new Date(offerDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
                        : 'Day'}
                    </div>
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Weekdays only (Monday to Friday)
                  </span>
                </div>

                {/* Expiration Time */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Expiration Time <span style={{ color: '#e6007e' }}>*</span>
                  </label>
                  <input
                    type="time"
                    ref={timeInputRef}
                    min="08:00"
                    max="16:59"
                    value={offerTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setOfferTime(val);
                      setFormError('');
                      if (val) {
                        const [h, m] = val.split(':').map(Number);
                        const mins = (h || 0) * 60 + (m || 0);
                        if (mins < 480 || mins >= 1020) {
                          if (timeInputRef.current) {
                            timeInputRef.current.setCustomValidity('Expiration time must follow office hours only (between 8:00 AM and before 5:00 PM).');
                            setTimeout(() => timeInputRef.current?.reportValidity(), 50);
                          }
                          setFormError('Expiration time must follow office hours only (between 8:00 AM and before 5:00 PM).');
                          return;
                        }
                      }
                      if (timeInputRef.current) timeInputRef.current.setCustomValidity('');
                    }}
                    onInvalid={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const [h, m] = val.split(':').map(Number);
                        const mins = (h || 0) * 60 + (m || 0);
                        if (mins < 480 || mins >= 1020) {
                          e.target.setCustomValidity('Expiration time must follow office hours only (between 8:00 AM and before 5:00 PM).');
                        }
                      }
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '8.5px 12px',
                      borderRadius: '8px',
                      border: isOutOfOfficeHours ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: isOutOfOfficeHours ? '#dc2626' : '#0f172a',
                      outline: 'none',
                      background: isOutOfOfficeHours ? '#fef2f2' : '#ffffff',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  />
                  {isOutOfOfficeHours ? (
                    <span style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                      <i className="bx bx-error-circle" style={{ fontSize: '14px' }} />
                      Expiration time must follow office hours only (between 8:00 AM and before 5:00 PM).
                    </span>
                  ) : (
                    <span style={{ fontSize: '10.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Office hours: 8:00 AM – before 5:00 PM
                    </span>
                  )}
                </div>
              </div>

              {/* Special Provisions Textarea (Starts completely empty) */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Special Benefits &amp; Additional Terms
                </label>
                <textarea
                  rows={3}
                  value={specialProvisions}
                  onChange={(e) => { setSpecialProvisions(e.target.value); setFormError(''); }}
                  placeholder="Enter custom terms, benefits, or provisions (optional)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#0f172a',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                />
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                  <span>ℹ️</span> Optional: Custom terms entered here will appear in the official generated PDF Job Offer Letter.
                </p>
              </div>

              {/* Bottom Actions Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={handlePreviewPdf}
                  style={{
                    background: '#f8fafc',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '9px 16px',
                    color: '#334155',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: "'Montserrat', sans-serif"
                  }}
                >
                  <i className="bx bx-printer" style={{ fontSize: '16px' }} /> Preview Job Offer PDF
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '9px 14px'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '9px 20px',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                      fontFamily: "'Montserrat', sans-serif"
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <i className="bx bx-loader-alt bx-spin" /> Generating &amp; Sending...
                      </>
                    ) : (
                      <>
                        <i className="bx bx-send" /> Generate &amp; Send PDF Offer
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default JobOfferModal;
