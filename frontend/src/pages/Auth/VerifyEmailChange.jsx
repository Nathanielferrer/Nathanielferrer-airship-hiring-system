import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import bgImage from '../../assets/images/log_bg.png';
import onlyLogoImg from '../../assets/images/only_logo.png';
import './Login.css';

import { API_BASE_URL } from '../../utils/apiConfig';
const VerifyEmailChange = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    document.title = 'Confirm Email Update - Airship Express';

    const verifyToken = async () => {
      if (hasRun.current) return;
      hasRun.current = true;

      if (!token) {
        setError('No verification token found in the URL. Please make sure you opened the complete link from your confirmation email.');
        setSuccess(false);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify_email_change.php?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        const result = await response.json();

        if (!response.ok || result.status !== 'success') {
          throw new Error(result.message || 'Email change verification failed.');
        }

        // Wipe old active session from localStorage so applicant signs in fresh
        localStorage.removeItem('hiring_user');
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('storage'));

        setNewEmail(result.new_email || '');
        setError('');
        setSuccess(true);

      } catch (err) {
        setSuccess(false);
        setError(err.message || 'Verification failed due to a network connection error.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const renderWrapper = (children) => (
    <div
      className="login-page-wrapper"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="login-video-container">
        <div className="login-video-overlay" />
      </div>

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

  if (loading) {
    return renderWrapper(
      <div className="login-glass-card success-card animate-fade-in" style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ borderTopColor: '#e6007e', margin: '0 auto 20px' }}></div>
        <h2 className="login-title">Verifying Account</h2>
        <p className="login-subtitle">Please wait while we verify your email address...</p>
      </div>
    );
  }

  if (success) {
    return renderWrapper(
      <div className="login-glass-card success-card animate-fade-in" style={{ textAlign: 'center' }}>
        <div className="success-icon" style={{ color: '#16a34a', width: '60px', height: '60px', margin: '0 auto 16px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-check-circle" style={{ width: '100%', height: '100%' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h2 className="login-title">Verified!</h2>
        <p className="login-subtitle" style={{ marginBottom: '24px' }}>
          Your email has been verified. You can now log in to the Hiring System.
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
    <div className="login-glass-card success-card animate-fade-in" style={{ textAlign: 'center' }}>
      <div className="error-icon" style={{ color: '#dc2626', width: '60px', height: '60px', margin: '0 auto 16px' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-alert-triangle" style={{ width: '100%', height: '100%' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </div>
      <h2 className="login-title">Verification Failed</h2>
      <p className="login-subtitle" style={{ color: '#dc2626', marginBottom: '12px' }}>{error}</p>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
        The link might be expired or already used. If you continue to have trouble, please contact support.
      </p>
      <div style={{ marginTop: '24px', width: '100%', boxSizing: 'border-box' }}>
        <Link to="/login" className="login-submit-button" style={{ textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
          Back to Login
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailChange;
