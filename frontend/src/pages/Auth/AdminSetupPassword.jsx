import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import bgImage from '../../assets/images/log_bg.webp';
import onlyLogoImg from '../../assets/images/only_logo.webp';
import './Login.css';

import { API_BASE_URL } from '../../utils/apiConfig';
const AdminSetupPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve token + user from navigation state (set by Login.jsx on intercept)
  const setupToken = location.state?.token;
  const pendingUser = location.state?.user;

  useEffect(() => {
    document.title = 'Setup Your Password - Airship Express';
    // Guard: redirect if no valid token in state (direct URL access)
    if (!setupToken || !pendingUser) {
      navigate('/login', { replace: true });
    }
  }, [setupToken, pendingUser, navigate]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Real-time password strength checks
  const passChecks = {
    length:    newPassword.length >= 8 && newPassword.length <= 64,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    numSpecial: /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword),
  };
  const isPasswordStrong = Object.values(passChecks).every(Boolean);
  const passwordsMatch   = newPassword && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8 || newPassword.length > 64) {
      setError('Password must be between 8 and 64 characters long.');
      return;
    }
    if (!isPasswordStrong) {
      setError('Your password does not meet all the strength requirements below.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/setup_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: setupToken, new_password: newPassword }),
      });
      const result = await response.json();

      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || 'Failed to update password.');
      }

      // Save to localStorage and redirect to dashboard
      // Save JWT token and user data to localStorage
      if (result.token) {
        localStorage.setItem('hiring_token', result.token);
      }
      localStorage.setItem('hiring_user', JSON.stringify(result.user));
      sessionStorage.setItem('just_logged_in', 'true');
      setSuccess(true);

      setTimeout(() => {
        if (result.user.is_admin === 3) {
          navigate('/super-admin-dashboard', { replace: true });
        } else {
          navigate('/admin-dashboard', { replace: true });
        }
      }, 1500);

    } catch (err) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const CheckItem = ({ passed, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: passed ? '#22c55e' : '#94a3b8', transition: 'color 0.2s' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {passed
          ? <><polyline points="20 6 9 17 4 12" /></>
          : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>}
      </svg>
      <span>{label}</span>
    </div>
  );

  if (!setupToken || !pendingUser) return null;

  return (
    <div
      className="login-page-wrapper"
      style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
    >
      <div className="login-video-overlay" />

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

      {/* Glassmorphism Card */}
      <div className="login-glass-card" style={{ maxWidth: '480px' }}>
        <div className="login-header-group">
          {/* Lock icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <h2 className="login-title" style={{ fontSize: '20px' }}>Set Your New Password</h2>
          <p className="login-subtitle">
            Welcome, <strong>{pendingUser.first_name}</strong>. Your account was set up by a Super Admin.
            Please create a secure password to continue.
          </p>
        </div>

        {/* Success state */}
        {success && (
          <div className="login-alert" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Password set! Redirecting to your dashboard…</span>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div className="login-alert login-alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-alert-icon">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="login-form">
            {/* New Password */}
            <div className="login-form-group">
              <label className="login-label">New Password</label>
              <div className="password-input-container">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                  className="login-input"
                  style={{ paddingRight: '44px' }}
                  placeholder="Create a strong password"
                  minLength={8}
                  maxLength={64}
                  required
                />
                <button type="button" className="password-toggle-btn" onClick={() => setShowNew(!showNew)}>
                  {showNew
                    ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  }
                </button>
              </div>
            </div>

            {/* Strength checklist */}
            {newPassword.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <CheckItem passed={passChecks.length}    label="8 to 64 characters" />
                <CheckItem passed={passChecks.uppercase} label="Contains uppercase letter (A-Z)" />
                <CheckItem passed={passChecks.lowercase} label="Contains lowercase letter (a-z)" />
                <CheckItem passed={passChecks.numSpecial} label="Contains number and special character" />
              </div>
            )}

            {/* Confirm Password */}
            <div className="login-form-group">
              <label className="login-label">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  className="login-input"
                  style={{ paddingRight: '44px', borderColor: confirmPassword && !passwordsMatch ? '#ef4444' : '' }}
                  placeholder="Re-enter your password"
                  minLength={8}
                  maxLength={64}
                  required
                />
                <button type="button" className="password-toggle-btn" onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm
                    ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  }
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>Passwords do not match.</p>
              )}
            </div>

            <button
              type="submit"
              className="login-submit-button"
              disabled={loading || !isPasswordStrong || !passwordsMatch}
              style={{ boxSizing: 'border-box', opacity: (!isPasswordStrong || !passwordsMatch) ? 0.5 : 1 }}
            >
              {loading ? 'Saving…' : 'Set Password & Continue'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminSetupPassword;
