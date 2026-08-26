import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import bgImage from '../../assets/images/log_bg.png';
import onlyLogoImg from '../../assets/images/only_logo.png'; // Brand logo icon
import './Login.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    document.title = 'Reset Password - Airship Express Hiring Portal';
  }, []);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time password criteria validation helper (same as registration page)
  const passChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numSpecial: /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)
  };

  const isPasswordStrong = Object.values(passChecks).every(Boolean);
  const passwordsMatch = password && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setError('Invalid reset request. Missing token parameter.');
      return;
    }

    if (!isPasswordStrong) {
      setError('Please ensure your password meets all strength requirements.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/auth/update_password.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ token, password })
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

  // Same visual layout as Login/Register pages
  const renderWrapper = (children) => (
    <div className="login-page-wrapper" style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
      <div className="login-video-container">
        <div className="login-video-overlay" />
      </div>

      {/* Brand Navbar */}
      <header className="login-navbar">
        <div className="login-navbar-brand">
          <img src={onlyLogoImg} alt="Airship Express Logo" className="brand-logo-only" />
          <div className="brand-text-stack">
            <span className="brand-melons">AIRSHIP</span>
            <span className="brand-lemons">EXPRESS</span>
          </div>
        </div>
      </header>

      {children}
    </div>
  );

  if (success) {
    return renderWrapper(
      <div className="login-glass-card success-card animate-fade-in" style={{ textAlign: 'center' }}>
        <div className="success-icon" style={{ color: '#16a34a', width: '60px', height: '60px', margin: '0 auto 16px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-check-circle" style={{ width: '100%', height: '100%' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h2 className="login-title">Success!</h2>
        <p className="login-subtitle" style={{ marginBottom: '24px', lineHeight: '1.6' }}>
          Your password has been successfully reset. You can now sign in using your new credentials.
        </p>
        <div style={{ marginTop: '24px', width: '100%', boxSizing: 'border-box' }}>
          <Link to="/login" className="login-submit-button" style={{ textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return renderWrapper(
    <div className="login-glass-card">
      <div className="login-header-group">
        <h2 className="login-title">New Password</h2>
        <p className="login-subtitle">Choose a secure, strong password for your account.</p>
      </div>

      {!token ? (
        <div className="login-alert login-alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-alert-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>No reset token provided. Please request a new recovery link.</span>
        </div>
      ) : (
        <>
          {error && (
            <div className="login-alert login-alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-alert-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-form-group">
              <label htmlFor="password" className="login-label">
                New Password <span style={{ textTransform: 'none', fontWeight: 'normal', color: '#64748b', fontSize: '10.5px' }}>(Must meet strong criteria)</span>
              </label>
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="login-input"
                  style={{ paddingRight: '44px' }}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-form-group">
              <label htmlFor="confirmPassword" className="login-label">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="login-input"
                  style={{ paddingRight: '44px' }}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: '600' }}>
                  ⚠️ Passwords do not match. Please check for typos.
                </p>
              )}
            </div>

            {/* Real-time Password Strength checklist (styled using Login.css structures, customized classes imported) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: passChecks.length ? '#15803d' : '#64748b', fontWeight: passChecks.length ? '600' : 'normal' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  {passChecks.length ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                <span>8+ Characters</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: passChecks.uppercase ? '#15803d' : '#64748b', fontWeight: passChecks.uppercase ? '600' : 'normal' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  {passChecks.uppercase ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                <span>Uppercase (A-Z)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: passChecks.lowercase ? '#15803d' : '#64748b', fontWeight: passChecks.lowercase ? '600' : 'normal' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  {passChecks.lowercase ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                <span>Lowercase (a-z)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: passChecks.numSpecial ? '#15803d' : '#64748b', fontWeight: passChecks.numSpecial ? '600' : 'normal' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  {passChecks.numSpecial ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                </svg>
                <span>Number & Special</span>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-button"
              disabled={loading || !isPasswordStrong || !passwordsMatch}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </>
      )}

      <p className="login-footer">
        Back to{' '}
        <Link to="/login" className="login-register-link">
          Sign In
        </Link>
      </p>
    </div>
  );
};

export default ResetPassword;

