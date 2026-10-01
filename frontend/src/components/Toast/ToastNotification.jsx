import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './ToastNotification.css';

const DEFAULT_TITLES = {
  success: 'Success',
  danger: 'Error',
  error: 'Error',
  warning: 'Warning',
  info: 'Notice'
};

const DEFAULT_ICONS = {
  success: 'bx-check-circle',
  danger: 'bx-x-circle',
  error: 'bx-x-circle',
  warning: 'bx-error-circle',
  info: 'bx-info-circle'
};

export const ToastItem = ({ id, type = 'success', title, message, duration = 3500, onClose }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!duration) return;
    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setLeaving(true);
    setTimeout(() => {
      if (onClose) onClose(id);
    }, 220);
  };

  const resolvedType = ['error', 'danger'].includes(type) ? 'danger' : (['warning', 'info'].includes(type) ? type : 'success');
  const resolvedTitle = title || DEFAULT_TITLES[resolvedType] || 'Notification';
  const iconClass = DEFAULT_ICONS[resolvedType] || 'bx-bell';

  return (
    <div className={`toast-item toast-item--${resolvedType} ${leaving ? 'toast-item--leaving' : ''}`} role="alert">
      <div className="toast-icon">
        <i className={`bx ${iconClass}`} />
      </div>
      <div className="toast-content">
        <h5 className="toast-title">{resolvedTitle}</h5>
        <p className="toast-message">{message}</p>
      </div>
      <button type="button" className="toast-close-btn" onClick={handleClose} aria-label="Close notification">
        <i className="bx bx-x" />
      </button>
      {duration > 0 && (
        <div
          className="toast-progress"
          style={{
            color: resolvedType === 'success' ? '#10b981' : (resolvedType === 'danger' ? '#ef4444' : (resolvedType === 'warning' ? '#f59e0b' : '#3b82f6')),
            animationDuration: `${duration}ms`
          }}
        />
      )}
    </div>
  );
};

export const ToastContainer = ({ toasts = [], onClose }) => {
  if (!toasts || toasts.length === 0) return null;

  return ReactDOM.createPortal(
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          type={toast.type}
          title={toast.title}
          message={toast.message}
          duration={toast.duration !== undefined ? toast.duration : 3500}
          onClose={onClose}
        />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
