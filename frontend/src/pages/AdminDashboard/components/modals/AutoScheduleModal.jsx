import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

const AutoScheduleModal = ({ isOpen, onClose, onScheduleSuccess }) => {
  const [slots, setSlots] = useState([]);
  const [passedCount, setPassedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchSlotsAndCandidates();
    }
  }, [isOpen]);

  const fetchSlotsAndCandidates = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Fetch open slots
      const slotsRes = await fetch('http://localhost/Hiring%20System/backend/interviews/get_available_slots.php');
      const slotsData = await slotsRes.json();
      if (slotsData.status === 'success') {
        setSlots(slotsData.slots || []);
      }

      // Fetch count of PASSED INITIAL candidates only (fresh candidates)
      // Exclude those in the RESCHEDULING flow
      const passedRes = await fetch('http://localhost/Hiring%20System/backend/applications/get_applications.php?status=PASSED%20INITIAL').then(r => r.json()).catch(() => ({}));
      
      const c1 = (passedRes.status === 'success' && passedRes.applications) ? passedRes.applications.length : 0;
      setPassedCount(c1);
    } catch (err) {
      console.error("Failed to load scheduling data:", err);
      setErrorMsg("Failed to load available slots from server.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAndAssign = async () => {
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

      const response = await fetch('http://localhost/Hiring%20System/backend/interviews/auto_schedule.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_id: actorId, actor_name: actorName })
      });
      const data = await response.json();
      if (response.ok && (data.status === 'success' || data.status === 'info')) {
        onScheduleSuccess(data.message);
        onClose();
      } else {
        setErrorMsg(data.message || 'Auto-scheduling failed.');
      }
    } catch (err) {
      console.error("Auto scheduling error:", err);
      setErrorMsg("Failed to execute auto-scheduling algorithm.");
    } finally {
      setExecuting(false);
    }
  };

  const formatTime12h = (t) => {
    if (!t) return '';
    const parts = t.split(':');
    if (parts.length < 2) return t;
    const hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${minute} ${ampm}`;
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="admin-modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div className="admin-modal-container" style={{
        background: '#ffffff', borderRadius: '16px', width: '560px', maxWidth: '90%',
        padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Confirm Auto-Scheduling
            </h2>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0 0' }}>
              Assign candidates in 'PASSED INITIAL' to available interview slots.
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {errorMsg}
          </div>
        )}

        {/* Capacity Summary Stats */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Candidates Pending</span>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '2px', fontFamily: "'Montserrat', sans-serif" }}>
              {passedCount} <span style={{ fontSize: '12px', fontWeight: '500', color: '#10b981' }}>(Passed Initial)</span>
            </div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Open Slots Available</span>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '2px', fontFamily: "'Montserrat', sans-serif" }}>
              {slots.length} <span style={{ fontSize: '12px', fontWeight: '500', color: '#0284c7' }}>(Capacity)</span>
            </div>
          </div>
        </div>

        {/* Availability Overview List */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ fontFamily: "'Montserrat', sans-serif", fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: '0 0 10px 0' }}>
            Available Slots Overview
          </h4>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading open slots...</div>
          ) : slots.length === 0 ? (
            <div style={{ padding: '20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', color: '#b45309', fontSize: '13px', textAlign: 'center' }}>
              No open interview slots available. Please ask Superadmin to create slots first.
            </div>
          ) : (
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              {slots.map((s, idx) => (
                <div key={s.slot_id || idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderBottom: idx === slots.length - 1 ? 'none' : '1px solid #f1f5f9',
                  background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', fontSize: '13px'
                }}>
                  <span style={{ fontWeight: '600', color: '#1e293b' }}>
                    📅 {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                  </span>
                  <span style={{ color: '#475569', fontWeight: '500' }}>
                    🕒 {formatTime12h(s.start_time)}{s.end_time ? ' - ' + formatTime12h(s.end_time) : ''}
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: '600', color: '#059669', background: '#d1fae5',
                    padding: '2px 8px', borderRadius: '12px'
                  }}>
                    Available
                  </span>
                </div>
              ))}
            </div>
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
              background: '#ffffff', color: '#475569', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleConfirmAndAssign}
            disabled={executing || slots.length === 0 || passedCount === 0}
            style={{
              padding: '10px 24px', borderRadius: '8px', border: 'none',
              background: (executing || slots.length === 0 || passedCount === 0) ? '#94a3b8' : '#e6007e',
              color: '#ffffff', fontWeight: '700', fontSize: '14px', cursor: (executing || slots.length === 0 || passedCount === 0) ? 'not-allowed' : 'pointer',
              fontFamily: "'Montserrat', sans-serif", boxShadow: '0 4px 12px rgba(230, 0, 126, 0.3)'
            }}
          >
            {executing ? 'Assigning Slots...' : 'Confirm & Assign Slots'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AutoScheduleModal;
