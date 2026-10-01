import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import bgImage from '../../assets/images/log_bg.png';
import onlyLogoImg from '../../assets/images/only_logo.png'; // Brand logo icon
import './Login.css';

import { API_BASE_URL } from '../../utils/apiConfig';
const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

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
    } catch (err) {
      setError(err.message || 'Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fixed wrapper layout: scrollable, prevents clipping behind fixed navbar
  const renderWrapper = (children) => (
    <div
      className="login-page-wrapper"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '88px 16px 36px',
        boxSizing: 'border-box'
      }}
    >
      <div className="login-video-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none' }}>
        <div className="login-video-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.45)' }} />
      </div>

      {/* Brand Navbar - fixed at top */}
      <header className="login-navbar" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '75px', zIndex: 100 }}>
        <div className="login-navbar-brand">
          <img src={onlyLogoImg} alt="Airship Express Logo" className="brand-logo-only" />
          <div className="brand-text-stack">
            <span className="brand-melons">AIRSHIP</span>
            <span className="brand-lemons">EXPRESS</span>
          </div>
        </div>
      </header>

      {/* Centered responsive card container */}
      <div style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', justifyContent: 'center', margin: 'auto 0' }}>
        {children}
      </div>
    </div>
  );

  if (success) {
    return renderWrapper(
      <div className="login-glass-card success-card animate-fade-in" style={{ textAlign: 'center', maxWidth: '440px', width: '100%', padding: '28px 24px' }}>
        <div className="success-icon" style={{ color: '#16a34a', width: '54px', height: '54px', margin: '0 auto 14px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-check-circle" style={{ width: '100%', height: '100%' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h2 className="login-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Password Reset!</h2>
        <p className="login-subtitle" style={{ marginBottom: '20px', lineHeight: '1.6', fontSize: '13.5px' }}>
          Your password has been successfully updated. {isSuperAdmin ? 'Two-factor authorization confirmed.' : ''} You can now sign in using your new credentials.
        </p>
        <div style={{ marginTop: '16px', width: '100%', boxSizing: 'border-box' }}>
          <Link to="/login" className="login-submit-button" style={{ textDecoration: 'none', width: '100%', boxSizing: 'border-box', display: 'inline-block' }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return renderWrapper(
    <div className="login-glass-card" style={{ maxWidth: '450px', width: '100%', padding: '24px 28px', boxSizing: 'border-box' }}>
      <div className="login-header-group" style={{ marginBottom: '14px', textAlign: 'center' }}>
        <h2 className="login-title" style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>
          {isSuperAdmin ? 'Super Admin Password Reset' : 'New Password'}
        </h2>
        <p className="login-subtitle" style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
          {isSuperAdmin
            ? 'Root authorization: Set a new password and verify your Authenticator code.'
            : 'Choose a secure, strong password for your account.'}
        </p>
      </div>

      {verifyingToken ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
          <div style={{ display: 'inline-block', width: '26px', height: '26px', border: '3px solid #e2e8f0', borderTopColor: '#e6007e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: '10px', fontSize: '12.5px' }}>Verifying reset authorization link...</p>
        </div>
      ) : tokenError ? (
        <div style={{ textAlign: 'center' }}>
          <div className="login-alert login-alert-error" style={{ marginBottom: '16px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-alert-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span style={{ fontSize: '12.5px' }}>{tokenError}</span>
          </div>
          <Link to="/forgot-password" className="login-submit-button" style={{ textDecoration: 'none', display: 'inline-block', width: '100%', boxSizing: 'border-box' }}>
            Request New Reset Link
          </Link>
        </div>
      ) : (
        <>
          {/* Super Admin Privileged Security Badge */}
          {isSuperAdmin && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(230, 0, 126, 0.06) 0%, rgba(59, 130, 246, 0.06) 100%)',
              border: '1px solid rgba(230, 0, 126, 0.25)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '18px', lineHeight: 1 }}>🛡️</span>
              <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4 }}>
                <strong style={{ color: '#0f172a' }}>Super Administrator Identity Gate: </strong>
                <span>{maskedEmail}</span>
                <span style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                  {totpEnabled
                    ? 'Two-Factor Authentication (2FA) is enforced.'
                    : '2FA not yet active. Please set up 2FA after signing in.'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="login-alert login-alert-error" style={{ marginBottom: '12px', padding: '10px 12px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-alert-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span style={{ fontSize: '12px' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form-group" style={{ marginBottom: '10px' }}>
              <label htmlFor="password" className="login-label" style={{ fontSize: '11.5px', marginBottom: '3px' }}>
                New Password <span style={{ textTransform: 'none', fontWeight: 'normal', color: '#64748b', fontSize: '10px' }}>(8-64 chars, upper, lower, num, special)</span>
              </label>
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                  style={{ paddingRight: '40px', padding: '9px 12px', fontSize: '13.5px' }}
                  minLength={8}
                  maxLength={64}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-form-group" style={{ marginBottom: '8px' }}>
              <label htmlFor="confirmPassword" className="login-label" style={{ fontSize: '11.5px', marginBottom: '3px' }}>Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="login-input"
                  style={{ paddingRight: '40px', padding: '9px 12px', fontSize: '13.5px' }}
                  minLength={8}
                  maxLength={64}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', fontWeight: '600' }}>
                  ⚠️ Passwords do not match.
                </p>
              )}
            </div>

            {/* Compact Real-time Password Strength checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px', margin: '2px 0 10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: passChecks.length ? '#15803d' : '#64748b', fontWeight: passChecks.length ? '600' : 'normal' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  {passChecks.length ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                <span>8-64 Characters</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: passChecks.uppercase ? '#15803d' : '#64748b', fontWeight: passChecks.uppercase ? '600' : 'normal' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  {passChecks.uppercase ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                <span>Uppercase (A-Z)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: passChecks.lowercase ? '#15803d' : '#64748b', fontWeight: passChecks.lowercase ? '600' : 'normal' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  {passChecks.lowercase ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                <span>Lowercase (a-z)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: passChecks.numSpecial ? '#15803d' : '#64748b', fontWeight: passChecks.numSpecial ? '600' : 'normal' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  {passChecks.numSpecial ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                <span>Number & Special</span>
              </div>
            </div>

            {/* Super Admin 2FA Verification Input */}
            {isSuperAdmin && totpEnabled && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="login-label" style={{ margin: 0, color: '#0f172a', fontWeight: '600', fontSize: '11px' }}>
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
                      fontSize: '11px',
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
                  className="login-input"
                  maxLength={isBackupMode ? 12 : 6}
                  style={{
                    letterSpacing: isBackupMode ? '2px' : '5px',
                    fontSize: '17px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    backgroundColor: '#ffffff',
                    padding: '8px'
                  }}
                  required
                />
                <p style={{ margin: '4px 0 0 0', fontSize: '10.5px', color: '#64748b', textAlign: 'center' }}>
                  {isBackupMode
                    ? 'Enter one of your 8 single-use emergency backup recovery codes.'
                    : 'Open Google Authenticator on your phone to view your current 6-digit code.'}
                </p>
              </div>
            )}

            <button
              type="submit"
              className="login-submit-button"
              disabled={loading || !isPasswordStrong || !passwordsMatch || !isTotpValid}
              style={{ padding: '11px 20px', fontSize: '14px', marginTop: '2px' }}
            >
              {loading ? 'Authorizing & Updating...' : 'Update Password'}
            </button>
          </form>
        </>
      )}

      <p className="login-footer" style={{ marginTop: '14px', marginBottom: 0, fontSize: '12.5px' }}>
        Back to{' '}
        <Link to="/login" className="login-register-link">
          Sign In
        </Link>
      </p>
    </div>
  );
};

export default ResetPassword;
