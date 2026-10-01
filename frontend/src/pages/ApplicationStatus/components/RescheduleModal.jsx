import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './RescheduleModal.css';

import { API_BASE_URL } from '../../../utils/apiConfig';
/**
 * RescheduleModal — Single-screen reschedule flow:
 * - Top section: Scrollable table of available interview schedules
 * - Bottom section: Reason textarea (styled like a chat input)
 * - Confirm button is only active when BOTH a slot is selected AND a reason is provided
 *
 * Props:
 *   isOpen       {boolean}
 *   onClose      {() => void}
 *   onConfirm    {(reason: string, slotId: number) => void}
 *   isSubmitting {boolean}
 */
const RescheduleModal = ({ isOpen, onClose, onConfirm, isSubmitting }) => {
  const [reason,       setReason]       = useState('');
  const [slots,        setSlots]        = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Reset and fetch slots each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setSelectedSlot(null);
      setSlots([]);
      fetchSlots();
    }
  }, [isOpen]);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/interviews/get_available_slots.php`);
      const data = await res.json();
      if (data.status === 'success') setSlots(data.slots || []);
    } catch (err) {
      console.error('Failed to fetch available slots:', err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedSlot || !reason.trim() || isSubmitting) return;
    onConfirm(reason.trim(), selectedSlot.slot_id);
  };

  const canConfirm = Boolean(selectedSlot && reason.trim() && !isSubmitting);

  // ── Time formatting helpers ──
  const formatTime12h = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${m} ${ampm}`;
  };

  const formatSlot = (slot) => {
    const dateStr = new Date(`${slot.date}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
    const timeStr = `${formatTime12h(slot.start_time)}${slot.end_time ? ` - ${formatTime12h(slot.end_time)}` : ''}`;
    return { dateStr, timeStr };
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="reschedule-overlay" onClick={onClose}>
      <div className="reschedule-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="reschedule-modal__header">
          <div>
            <h3 className="reschedule-modal__title">Request a Reschedule</h3>
            <p className="reschedule-modal__subtitle">
              Select your preferred new schedule and provide a reason.
            </p>
          </div>
          <button className="reschedule-modal__close-btn" onClick={onClose} aria-label="Close">
            <i className="bx bx-x" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="reschedule-modal__body">

          {/* 2-Day Rescheduling Policy Notice */}
          <div style={{
            background: '#fffbeb',
            border: '1.5px solid #fef3c7',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <i className="bx bx-error-circle" style={{ color: '#d97706', fontSize: '20px', marginTop: '1px', flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.5', fontFamily: "'Inter', sans-serif" }}>
              <strong style={{ display: 'block', marginBottom: '2px', color: '#78350f', fontWeight: '700' }}>Important Rescheduling Notice</strong>
              Rescheduling requests are <strong>only valid within 2 days</strong> of receiving your schedule assignment. If exceeded, your reschedule request will be void and invalid.
            </div>
          </div>

          {/* SECTION 1: Available Schedule Table */}
          <div>
            <div className="reschedule-modal__section-label">
              <i className="bx bx-calendar" />
              <span className="reschedule-modal__section-title">Select a New Schedule</span>
            </div>

            {loadingSlots ? (
              <div className="reschedule-modal__loading">
                <div className="reschedule-modal__spinner" />
                Loading available schedules...
              </div>
            ) : slots.length === 0 ? (
              <div className="reschedule-modal__empty-slots">
                No available schedules at the moment. Our recruitment team will contact you.
              </div>
            ) : (
              <div className="reschedule-modal__table-wrap">
                {/* Table Header */}
                <div className="reschedule-modal__table-head">
                  <span />
                  <span>Interview Date</span>
                  <span>Time Slot</span>
                </div>

                {/* Table Body */}
                <div className="reschedule-modal__table-body">
                  {slots.map((slot) => {
                    const { dateStr, timeStr } = formatSlot(slot);
                    const isSelected = selectedSlot?.slot_id === slot.slot_id;

                    return (
                      <div
                        key={slot.slot_id}
                        className={`reschedule-modal__slot-row ${
                          isSelected
                            ? 'reschedule-modal__slot-row--selected'
                            : 'reschedule-modal__slot-row--default'
                        }`}
                        onClick={() => setSelectedSlot(isSelected ? null : slot)}
                      >
                        {/* Radio indicator */}
                        <div className={`reschedule-modal__radio ${
                          isSelected
                            ? 'reschedule-modal__radio--selected'
                            : 'reschedule-modal__radio--default'
                        }`}>
                          {isSelected && <i className="bx bx-check" />}
                        </div>

                        {/* Date */}
                        <span className={isSelected
                          ? 'reschedule-modal__slot-date--selected'
                          : 'reschedule-modal__slot-date'
                        }>
                          {dateStr}
                        </span>

                        {/* Time */}
                        <span className={isSelected
                          ? 'reschedule-modal__slot-time--selected'
                          : 'reschedule-modal__slot-time'
                        }>
                          {timeStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Reason Textarea */}
          <div>
            <div className="reschedule-modal__reason-label-row">
              <i className="bx bxs-send" />
              <span className="reschedule-modal__section-title">Reason for Rescheduling</span>
            </div>

            <div className="reschedule-modal__textarea-wrap">
              <textarea
                className={`reschedule-modal__textarea ${reason.trim() ? 'reschedule-modal__textarea--filled' : ''}`}
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                placeholder="Type your reason for rescheduling here..."
                rows={4}
              />
              <div className={`reschedule-modal__textarea-icon ${
                reason.trim()
                  ? 'reschedule-modal__textarea-icon--active'
                  : 'reschedule-modal__textarea-icon--inactive'
              }`}>
                <i className="bx bxs-send" />
              </div>
            </div>

            <div className="reschedule-modal__char-count">
              <span>{reason.length}/300</span>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="reschedule-modal__footer">
          <button
            className="reschedule-modal__cancel-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            className={`reschedule-modal__confirm-btn ${
              canConfirm
                ? 'reschedule-modal__confirm-btn--active'
                : 'reschedule-modal__confirm-btn--disabled'
            }`}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isSubmitting ? (
              <>
                <div className="reschedule-modal__btn-spinner" />
                Processing...
              </>
            ) : (
              <>
                <i className="bx bx-check" />
                Confirm New Schedule
              </>
            )}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default RescheduleModal;
