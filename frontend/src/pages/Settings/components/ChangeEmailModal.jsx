import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import LoadingScreen from '../../../components/LoadingScreen/LoadingScreen';
import './ChangeEmailModal.css';

import { API_BASE_URL } from '../../../utils/apiConfig';
/**
 * ChangeEmailModal - Secure modal requiring new email and current account password.
 * Dispatches verification request to backend to initiate the dual-email verification workflow.
 */
const ChangeEmailModal = ({
  isOpen,
  onClose,
  currentEmail = '',
  userId,
  onSuccess
}) => {
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset form whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setNewEmail('');
      setCurrentPassword('');
      setShowPassword(false);
      setErrorMsg('');
    }
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedNewEmail = newEmail.trim().toLowerCase();
    const trimmedCurrentEmail = currentEmail.trim().toLowerCase();

    // Client-side validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedNewEmail || !emailRegex.test(trimmedNewEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (trimmedNewEmail === trimmedCurrentEmail) {
      setErrorMsg('The new email address cannot be identical to your current email address.');
      return;
    }

    if (!currentPassword) {
      setErrorMsg('Please enter your current account password to authorize this change.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/request_email_change.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          current_password: currentPassword,
          new_email: trimmedNewEmail
        })
      });

      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to submit email change request.');
      }

      if (typeof onSuccess === 'function') {
        onSuccess(trimmedNewEmail, data.message);
      }
      onClose();

    } catch (err) {
      setErrorMsg(err.message || 'A network error occurred while submitting your request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingScreen
        isOpen={loading}
        title="Sending Verification Link..."
        subtitle="Please wait while we secure your account and dispatch your confirmation email."
      />

      {ReactDOM.createPortal(
        <div className="change-email-overlay">
          <div className="change-email-card">
        {/* Header */}
        <div className="change-email-header">
          <div className="change-email-header-text">
            <h3 className="change-email-title">Change Account Email</h3>
            <p className="change-email-subtitle">
              Update your login identifier and primary notification address.
            </p>
          </div>
          <button
            type="button"
            className="change-email-close-btn"
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
          >
            <i className="bx bx-x" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="change-email-body">
            {/* Information Banner (The Two-Step Notice) */}
            <div className="change-email-security-note">
              <i className="bx bx-shield-quarter" />
              <span>
                To ensure account security, a verification link will be sent to your new email, and an alert will be sent to your current email. The change will not occur until verified.
              </span>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="change-email-alert change-email-alert-error">
                <i className="bx bx-error-circle" style={{ fontSize: '18px', flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Current Email (Read-only) */}
            <div className="change-email-form-group">
              <label className="change-email-label">Current Email Address</label>
              <div className="change-email-current-box">
                <div className="change-email-current-info">
                  <i className="bx bx-lock-alt" />
                  <span className="change-email-current-text">{currentEmail || 'Not specified'}</span>
                </div>
                <span className="change-email-readonly-badge">Current</span>
              </div>
            </div>

            {/* New Email */}
            <div className="change-email-form-group">
              <label htmlFor="modal-new-email" className="change-email-label">
                New Email Address
              </label>
              <input
                id="modal-new-email"
                type="email"
                className="change-email-input"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                disabled={loading}
                autoFocus
                required
              />
              <p className="change-email-field-hint">
                A 24-hour verification link will be dispatched to this inbox.
              </p>
            </div>

            {/* Current Password */}
            <div className="change-email-form-group">
              <label htmlFor="modal-current-password" className="change-email-label">
                Current Password
              </label>
              <div className="change-email-pass-wrapper">
                <input
                  id="modal-current-password"
                  type={showPassword ? 'text' : 'password'}
                  className="change-email-input"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="change-email-pass-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`bx ${showPassword ? 'bx-show' : 'bx-hide'}`} />
                </button>
              </div>
              <p className="change-email-field-hint">
                Proves you are the authorized owner of this account.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="change-email-actions">
            <button
              type="button"
              className="change-email-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="change-email-btn-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="change-email-spinner" />
                  <span>Sending Verification...</span>
                </>
              ) : (
                <>
                  <i className="bx bx-paper-plane" />
                  <span>Send Verification Link</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )}
    </>
  );
};

export default ChangeEmailModal;
