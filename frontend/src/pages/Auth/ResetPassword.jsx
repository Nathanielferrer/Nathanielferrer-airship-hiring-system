import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import { API_BASE_URL } from '../../utils/apiConfig';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Reset Password - Airship Express Hiring Portal';
  }, []);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Token metadata
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setVerifyingToken(false);
      setTokenError('Missing password reset token. Please request a new recovery link.');
      return;
    }

    const checkToken = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify_reset_token.php?token=${encodeURIComponent(token)}`);
        const result = await response.json();

        if (response.ok && result.valid) {
          setIsSuperAdmin(result.is_super_admin);
          setTotpEnabled(result.totp_enabled);
          setMaskedEmail(result.masked_email || '');
        } else {
          setTokenError(result.message || 'The reset link is invalid or has expired. Please request a new one.');
        }
      } catch {
        setTokenError('Connection error verifying reset link. Please check your network.');
      } finally {
        setVerifyingToken(false);
      }
    };

    checkToken();
  }, [token]);

  // Real-time password criteria validation helper
  const passChecks = {
    length: password.length >= 8 && password.length <= 64,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numSpecial: /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)
  };

  const isPasswordStrong = Object.values(passChecks).every(Boolean);
  const passwordsMatch = password && password === confirmPassword;

  const isTotpValid = !isSuperAdmin || !totpEnabled || (
    isBackupMode ? totpCode.trim().length >= 8 : totpCode.trim().length === 6
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError('Invalid reset request. Missing token parameter.');
      return;
    }

    if (!password) {
      setError('Please enter a new password.');
      return;
    }

    if (password.length < 8 || password.length > 64) {
      setError('Password must be between 8 and 64 characters long.');
      return;
    }

    if (!isPasswordStrong) {
      setError('Please ensure your password meets all strength requirements (8-64 characters).');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    if (isSuperAdmin && totpEnabled && !totpCode.trim()) {
      setError(isBackupMode
        ? 'Please enter an emergency backup recovery code.'
        : 'Please enter the 6-digit verification code from Google Authenticator.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/update_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          token,
          password,
          totp_code: totpCode.trim(),
          is_backup_code: isBackupMode
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to reset password.');
      }

      setSuccess(true);
      // Optional smooth auto-redirect after 3.5 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3500);
    } catch (err) {
      setError(err.message || 'Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Success Confirmation Screen
  if (success) {
    return (
      <AuthLayout showExplore={false}>
        <div className="auth-success-box">
          <div className="auth-success-icon-wrap" aria-hidden="true">
            <i className="bx bx-check-circle" />
          </div>
          <h2 className="auth-success-title">Password Reset!</h2>
          <p className="auth-success-desc">
            Your password has been successfully updated.{' '}
            {isSuperAdmin ? 'Two-factor authorization confirmed. ' : ''}
            You can now sign in using your new credentials.
          </p>
          <Link to="/login" className="auth-primary-btn" style={{ textDecoration: 'none' }}>
            Go to Login <i className="bx bx-right-arrow-alt auth-btn-arrow" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout isScrollable={true} showExplore={false}>
      {/* Form Header */}
      <div className="auth-form-header">
        <h2 className="auth-title">
          {isSuperAdmin ? 'Super Admin Password Reset' : 'New Password'}
        </h2>
        <p className="auth-subtitle">
          {isSuperAdmin
            ? 'Root authorization: Set a new password and verify your Authenticator code.'
            : 'Choose a secure, strong password for your account.'}
        </p>
      </div>

      {verifyingToken ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748b' }}>
          <div
            style={{
              display: 'inline-block',
              width: '32px',
              height: '32px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#e6007e',
              borderRadius: '50%',
              animation: 'authSpin 0.8s linear infinite'
            }}
          />
          <style>{`
            @keyframes authSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ marginTop: '12px', fontSize: '13.5px' }}>Verifying reset authorization link...</p>
        </div>
      ) : tokenError ? (
        <div style={{ textAlign: 'center' }}>
          <div className="auth-alert auth-alert-error" role="alert">
            <i className="bx bx-error-circle auth-alert-icon" />
            <span>{tokenError}</span>
          </div>
          <Link
            to="/forgot-password"
            className="auth-primary-btn"
            style={{ textDecoration: 'none', marginTop: '16px' }}
          >
            Request New Reset Link <i className="bx bx-right-arrow-alt auth-btn-arrow" />
          </Link>
        </div>
      ) : (
        <>
          {/* Super Admin Privileged Security Badge */}
          {isSuperAdmin && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(230, 0, 126, 0.06) 0%, rgba(59, 130, 246, 0.06) 100%)',
                border: '1px solid rgba(230, 0, 126, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>🛡️</span>
              <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.45 }}>
                <strong style={{ color: '#0f172a' }}>Super Administrator Identity Gate: </strong>
                <span>{maskedEmail}</span>
                <span style={{ display: 'block', color: '#64748b', fontSize: '11.5px', marginTop: '2px' }}>
                  {totpEnabled
                    ? 'Two-Factor Authentication (2FA) is enforced.'
                    : '2FA not yet active. Please set up 2FA after signing in.'}
                </span>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <i className="bx bx-error-circle auth-alert-icon" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {/* New Password */}
            <div className="auth-input-group">
              <label htmlFor="password" className="auth-label">
                New Password <span className="auth-label-opt">(8-64 characters)</span>
              </label>
              <div className="auth-input-wrapper">
                <i className="bx bx-lock-alt auth-input-icon" aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className="auth-input has-left-icon has-right-btn"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={64}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'}`} />
                </button>
              </div>

              {/* Dynamic Password Requirements Checklist */}
              <div className="auth-password-requirements">
                <div className={`auth-req-item ${passChecks.length ? 'is-met' : ''}`}>
                  <i className={`bx ${passChecks.length ? 'bx-check-circle' : 'bx-circle'} auth-req-icon`} />
                  <span>8–64 Characters</span>
                </div>
                <div className={`auth-req-item ${passChecks.uppercase ? 'is-met' : ''}`}>
                  <i className={`bx ${passChecks.uppercase ? 'bx-check-circle' : 'bx-circle'} auth-req-icon`} />
                  <span>Uppercase (A–Z)</span>
                </div>
                <div className={`auth-req-item ${passChecks.lowercase ? 'is-met' : ''}`}>
                  <i className={`bx ${passChecks.lowercase ? 'bx-check-circle' : 'bx-circle'} auth-req-icon`} />
                  <span>Lowercase (a–z)</span>
                </div>
                <div className={`auth-req-item ${passChecks.numSpecial ? 'is-met' : ''}`}>
                  <i className={`bx ${passChecks.numSpecial ? 'bx-check-circle' : 'bx-circle'} auth-req-icon`} />
                  <span>Number & Special</span>
                </div>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="auth-input-group">
              <label htmlFor="confirmPassword" className="auth-label">
                Confirm Password
              </label>
              <div className="auth-input-wrapper">
                <i className="bx bx-lock auth-input-icon" aria-hidden="true" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className="auth-input has-left-icon has-right-btn"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={64}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`bx ${showConfirmPassword ? 'bx-hide' : 'bx-show'}`} />
                </button>
              </div>

              {/* Match Feedback */}
              {confirmPassword.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', fontWeight: '600' }}>
                  {passwordsMatch ? (
                    <>
                      <i className="bx bx-check-circle" style={{ color: '#16a34a', fontSize: '15px' }} />
                      <span style={{ color: '#16a34a' }}>Passwords match</span>
                    </>
                  ) : (
                    <>
                      <i className="bx bx-x-circle" style={{ color: '#dc2626', fontSize: '15px' }} />
                      <span style={{ color: '#dc2626' }}>Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Super Admin 2FA Verification Input */}
            {isSuperAdmin && totpEnabled && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginTop: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="auth-label" style={{ margin: 0, fontSize: '12px' }}>
                    {isBackupMode ? 'Emergency Backup Recovery Code' : 'Google Authenticator 6-Digit Code'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBackupMode(!isBackupMode);
                      setTotpCode('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e6007e',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      padding: 0,
                      textDecoration: 'underline'
                    }}
                  >
                    {isBackupMode ? 'Use Authenticator Code' : 'Use Backup Code'}
                  </button>
                </div>

                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => {
                    const val = isBackupMode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6);
                    setTotpCode(val);
                  }}
                  placeholder={isBackupMode ? 'e.g. A3B4-C5D6' : '000000'}
                  className="auth-input"
                  maxLength={isBackupMode ? 12 : 6}
                  style={{
                    letterSpacing: isBackupMode ? '2px' : '6px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    padding: '8px'
                  }}
                  required
                />
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                  {isBackupMode
                    ? 'Enter one of your 8 single-use emergency backup recovery codes.'
                    : 'Open Google Authenticator on your phone to view your current 6-digit code.'}
                </p>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              className="auth-primary-btn"
              disabled={loading || !isPasswordStrong || !passwordsMatch || !isTotpValid}
            >
              {loading ? (
                'Authorizing & Updating...'
              ) : (
                <>
                  Update Password <i className="bx bx-right-arrow-alt auth-btn-arrow" />
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;
