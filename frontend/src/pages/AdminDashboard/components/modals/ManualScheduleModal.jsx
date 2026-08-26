import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';

const ManualScheduleModal = ({ isOpen, onClose, candidate, onScheduleSuccess }) => {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch open slots when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSlotId('');
      setDate('');
      setStartTime('');
      setEndTime('');
      setErrorMsg('');
      fetchSlots();
    }
  }, [isOpen, candidate]);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const res = await fetch('http://localhost/Hiring%20System/backend/interviews/get_available_slots.php');
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setAvailableSlots(data.slots || []);
      }
    } catch (err) {
      console.error("Failed to fetch available slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSlotSelect = (slotIdStr) => {
    setSelectedSlotId(slotIdStr);
    if (!slotIdStr) {
      setDate('');
      setStartTime('');
      setEndTime('');
      return;
    }
    const found = availableSlots.find(s => String(s.slot_id) === String(slotIdStr));
    if (found) {
      setDate(found.date);
      setStartTime(found.start_time);
      setEndTime(found.end_time || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlotId || !date || !startTime) {
      setErrorMsg('Please select an available admin slot.');
      return;
    }

    setExecuting(true);
    setErrorMsg('');

    try {
      const adminUser = (() => {
        try { return JSON.parse(localStorage.getItem('hiring_user') || '{}'); } catch { return {}; }
      })();
      const actorId = adminUser?.id || 1;
      const actorName = adminUser?.first_name && adminUser?.last_name
        ? `${adminUser.first_name} ${adminUser.last_name}`
        : (adminUser?.email || 'Admin');

      const response = await fetch('http://localhost/Hiring%20System/backend/interviews/manual_schedule.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: candidate.application_id,
          user_id: candidate.user_id,
          slot_id: parseInt(selectedSlotId),
          date,
          start_time: startTime,
          end_time: endTime,
          actor_id: actorId,
          actor_name: actorName
        })
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        onScheduleSuccess(data.message);
        onClose();
      } else {
        setErrorMsg(data.message || 'Manual scheduling failed. Please try again.');
      }
    } catch (err) {
      console.error('Manual schedule error:', err);
      setErrorMsg('Network error. Could not connect to the scheduling service.');
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen || !candidate) return null;

  const candidateName = candidate.candidate_name || `${candidate.User_Fname || ''} ${candidate.User_Lname || ''}`.trim();

  const formatTime12h = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '16px', width: '500px', maxWidth: '92%',
        maxHeight: '90vh', overflowY: 'auto',
        padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.12), 0 10px 10px -5px rgba(0,0,0,0.06)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>
              Manual Interview Schedule
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Scheduling candidate: <strong style={{ color: '#0f172a' }}>{candidateName}</strong>
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Position: <strong>{candidate.job_title}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '22px', color: '#64748b', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Admin Available Open Slots Selector */}
          <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📅 Select Available Admin Slot <span style={{ color: '#e6007e' }}>*</span>
            </label>
            {loadingSlots ? (
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>Loading open slots...</p>
            ) : availableSlots.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: '#b45309', margin: 0, fontWeight: '600' }}>
                No open interview slots available. Please ask Superadmin to create slots first.
              </p>
            ) : (
              <select
                value={selectedSlotId}
                onChange={(e) => handleSlotSelect(e.target.value)}
                required
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: '8px',
                  border: '1.5px solid #0f172a', background: '#ffffff', fontSize: '13.5px',
                  fontWeight: '600', color: '#0f172a', outline: 'none', fontFamily: 'Inter, sans-serif'
                }}
              >
                <option value="">-- Select an Available Slot --</option>
                {availableSlots.map((s) => (
                  <option key={s.slot_id} value={s.slot_id}>
                    📅 {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' })} | 🕒 {formatTime12h(s.start_time)} - {formatTime12h(s.end_time)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={executing}
              style={{
                padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1',
                background: '#ffffff', color: '#475569', fontWeight: '600', fontSize: '14px',
                cursor: 'pointer', fontFamily: "'Inter', sans-serif"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={executing || !selectedSlotId}
              style={{
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                background: (executing || !selectedSlotId) ? '#94a3b8' : '#e6007e',
                color: '#ffffff', fontWeight: '700', fontSize: '14px',
                cursor: (executing || !selectedSlotId) ? 'not-allowed' : 'pointer',
                fontFamily: "'Montserrat', sans-serif",
                boxShadow: (!executing && selectedSlotId) ? '0 4px 12px rgba(230, 0, 126, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {executing ? '⏳ Scheduling...' : '📅 Confirm Manual Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ManualScheduleModal;
