import React from 'react';
import ReactDOM from 'react-dom';

const ScheduleModal = ({ 
  scheduleModalOpen, 
  setScheduleModalOpen, 
  scheduleApp, 
  handleConfirmSchedule, 
  selectedSlotId, 
  setSelectedSlotId, 
  availableSlots, 
  scheduleLocation, 
  setScheduleLocation, 
  scheduleRequirements, 
  setScheduleRequirements 
}) => {
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

  if (!scheduleModalOpen) return null;

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
      <div className="admin-modal-card" style={{ background: 'white', padding: '24px', borderRadius: '12px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0, fontSize: '20px', color: '#1e293b' }}>Schedule Interview</h3>
        <p style={{ color: '#475569', fontSize: '14px', marginBottom: '20px' }}>
          Set up an interview for <strong>{scheduleApp?.candidate_name || `${scheduleApp?.User_Fname} ${scheduleApp?.User_Lname}`}</strong> for the <strong>{scheduleApp?.job_title}</strong> position.
        </p>
        
        <form onSubmit={handleConfirmSchedule}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Available Slots</label>
            <select required value={selectedSlotId} onChange={(e) => setSelectedSlotId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: '#f8fafc', color: '#1e293b' }}>
              <option value="" disabled>-- Select a slot --</option>
              {availableSlots.map(slot => (
                <option key={slot.slot_id} value={slot.slot_id}>
                  {new Date(slot.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })} ({formatTime12h(slot.start_time)}{slot.end_time ? ' - ' + formatTime12h(slot.end_time) : ''})
                </option>
              ))}
            </select>
            {availableSlots.length === 0 && <p style={{color: 'red', fontSize: '12px', marginTop: '4px'}}>No open slots available. Please ask Super Admin to create slots.</p>}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Location</label>
            <input type="text" required value={scheduleLocation} onChange={(e) => setScheduleLocation(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', background: '#f8fafc', color: '#1e293b' }} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>Requirements to Bring (One per line)</label>
            <textarea 
              required 
              value={scheduleRequirements} 
              onChange={(e) => setScheduleRequirements(e.target.value)} 
              rows="4" 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', background: '#f8fafc', color: '#1e293b' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={() => setScheduleModalOpen(false)} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: '500' }}>
              Cancel
            </button>
            <button type="submit" style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: '500' }}>
              Schedule Interview
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ScheduleModal;
