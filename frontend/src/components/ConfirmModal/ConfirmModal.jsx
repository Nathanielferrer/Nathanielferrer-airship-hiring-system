import React from 'react';
import ReactDOM from 'react-dom';
import './ConfirmModal.css';

/**
 * Reusable modal component for custom user confirmations without standard browser popups.
 * Uses ReactDOM.createPortal to render outside parent DOM transforms (which break fixed positioning).
 */
const ConfirmModal = ({
  isOpen,
  title = 'Confirmation Required',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'primary'
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="custom-confirm-overlay" onClick={onCancel}>
      <div className="custom-confirm-card animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="custom-confirm-header">
          <div className={`custom-confirm-icon ${type}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {type === 'danger' ? (
                <>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              ) : type === 'warning' ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </>
              )}
            </svg>
          </div>
          <h3 className="custom-confirm-title">{title}</h3>
        </div>

        <p className="custom-confirm-message">{message}</p>

        <div className="custom-confirm-actions">
          <button className="custom-confirm-btn cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`custom-confirm-btn confirm ${type}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
