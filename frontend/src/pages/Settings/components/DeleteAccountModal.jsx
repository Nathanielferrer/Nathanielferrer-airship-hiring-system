import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import LoadingScreen from '../../../components/LoadingScreen/LoadingScreen';
import './DeleteAccountModal.css';

import { API_BASE_URL } from '../../../utils/apiConfig';
/**
 * DeleteAccountModal - High-security modal requiring account password
 * and explicit confirmation keyword ("DELETE") before triggering soft delete & anonymization.
 */
const DeleteAccountModal = ({
  isOpen,
  onClose,
  userId,
  userEmail = '',
  onSuccess
}) => {
  const [password, setPassword] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Reset form whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setConfirmPhrase('');
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

  const isPhraseMatched = confirmPhrase.trim().toUpperCase() === 'DELETE';
  const isSubmitDisabled = !password || !isPhraseMatched || loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password) {
      setErrorMsg('Please enter your current account password to authorize deletion.');
      return;
    }

    if (!isPhraseMatched) {
      setErrorMsg('Please type "DELETE" exactly to confirm account deletion.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/delete_account.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          password: password,
          confirm_phrase: confirmPhrase.trim().toUpperCase()
        })
      });

      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to delete account. Please try again.');
      }

      if (typeof onSuccess === 'function') {
        onSuccess(data.message || 'Your account and personal data have been successfully deleted.');
      }
      onClose();

    } catch (err) {
      setErrorMsg(err.message || 'A network error occurred while processing your request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingScreen
        isOpen={loading}
        title="Deleting Account..."
        subtitle="Erasing your uploaded documents, personal credentials, and securing your data."
      />

      {ReactDOM.createPortal(
        <div className="delete-account-overlay" role="dialog" aria-modal="true">
          <div className="delete-account-card">
            {/* Header */}
            <div className="delete-account-header">
              <div className="delete-account-icon-wrapper">
                <i className="bx bx-error-alt" />
              </div>
              <div className="delete-account-header-text">
                <h3 className="delete-account-title">Delete Account</h3>
                <p className="delete-account-subtitle">
                  Permanently delete your account and erase your personal data.
                </p>
              </div>
              <button
                type="button"
                className="delete-account-close-btn"
                onClick={onClose}
                disabled={loading}
                aria-label="Close dialog"
              >
                <i className="bx bx-x" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit}>
              <div className="delete-account-body">
                {/* Warning Card */}
                <div className="delete-account-warning-card">
                  <div className="delete-account-warning-title">
                    <i className="bx bx-shield-x" />
                    <span>This action is permanent and cannot be undone</span>
                  </div>
                  <ul className="delete-account-warning-list">
                    <li>Your uploaded resume files and profile photos will be <strong>permanently erased</strong> from server storage.</li>
                    <li>Your personal contact details and password will be <strong>scrubbed</strong> and anonymized.</li>
                    <li>You will be immediately logged out and will <strong>no longer be able to log in</strong> with this account.</li>
                    <li>Your email (<code>{userEmail}</code>) will be freed up if you wish to apply again in the future.</li>
                  </ul>
                </div>

                {/* Error Alert */}
                {errorMsg && (
                  <div className="delete-account-alert delete-account-alert-error">
                    <i className="bx bx-error-circle" style={{ fontSize: '18px', flexShrink: 0 }} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Password Input */}
                <div className="delete-account-form-group">
                  <label htmlFor="delete-account-password" className="delete-account-label">
                    Confirm Your Password
                  </label>
                  <div className="delete-account-password-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="delete-account-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMsg('');
                      }}
                      className="delete-account-input"
                      placeholder="Enter your current password"
                      disabled={loading}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="delete-account-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex="-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'}`} />
                    </button>
                  </div>
                </div>

                {/* Phrase Confirmation Input */}
                <div className="delete-account-form-group">
                  <label htmlFor="delete-account-phrase" className="delete-account-label">
                    Type <span className="delete-account-highlight">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    id="delete-account-phrase"
                    value={confirmPhrase}
                    onChange={(e) => {
                      setConfirmPhrase(e.target.value);
                      setErrorMsg('');
                    }}
                    className={`delete-account-input ${confirmPhrase && !isPhraseMatched ? 'input-error' : ''}`}
                    placeholder="Type DELETE"
                    disabled={loading}
                    required
                    autoComplete="off"
                  />
                  {confirmPhrase && !isPhraseMatched && (
                    <span className="delete-account-field-hint">
                      Please enter the word "DELETE" in capital letters.
                    </span>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="delete-account-footer">
                <button
                  type="button"
                  className="delete-account-btn-cancel"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="delete-account-btn-delete"
                  disabled={isSubmitDisabled}
                >
                  {loading ? (
                    <>
                      <i className="bx bx-loader-alt bx-spin" /> Deleting Account...
                    </>
                  ) : (
                    <>
                      <i className="bx bx-trash" /> Permanently Delete Account
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

export default DeleteAccountModal;
