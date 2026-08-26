import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import onlyLogoImg from '../../assets/images/only_logo.png'; // Brand logo icon
import bgImage from '../../assets/images/log_bg.png';
import './Login.css';

const ForgotPassword = () => {
  useEffect(() => {
    document.title = 'Forgot Password - Airship Express Applicant Portal';
  }, []);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/auth/forgot_password.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to submit recovery request.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Same visual layout as Login and Register pages
  const renderWrapper = (children) => (
    <div 
      className="login-page-wrapper" 
      style={{ 
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
        padding: '110px 24px 40px 24px', 
        fontFamily: "'Poppins', 'Inter', sans-serif", 
        zIndex: 9999, 
        boxSizing: 'border-box', 
        msOverflowStyle: 'none', 
        scrollbarWidth: 'none' 
      }}
    >
      <style>{`
        .login-page-wrapper::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      {/* Fixed Background Image */}
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundImage: `url(${bgImage})`, 
          backgroundSize: 'cover', 
          backgroundPosition: 'center', 
          backgroundRepeat: 'no-repeat',
          zIndex: 1
        }} 
      />
      
      {/* Fixed Dark Tint Overlay Layer */}
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.45)', 
          zIndex: 2 
        }} 
      />

      {/* Brand Navbar */}
      <header className="login-navbar" style={{ zIndex: 100 }}>
        <div className="login-navbar-brand">
          <img src={onlyLogoImg} alt="Airship Express Logo" className="brand-logo-only" />
          <div className="brand-text-stack">
            <span className="brand-melons">AIRSHIP</span>
            <span className="brand-lemons">EXPRESS</span>
          </div>
        </div>
      </header>

      {/* Content wrapper to ensure it renders on top of the fixed background */}
      <div style={{ position: 'relative', zIndex: 3, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );

  if (submitted) {
    return renderWrapper(
      <div className="login-glass-card success-card animate-fade-in" style={{ textAlign: 'center' }}>
        <div className="success-icon" style={{ color: '#16a34a', width: '60px', height: '60px', margin: '0 auto 16px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-check-circle" style={{ width: '100%', height: '100%' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h2 className="login-title">Request Processed</h2>
        <p className="login-subtitle" style={{ marginBottom: '16px', lineHeight: '1.6' }}>
          If an applicant account exists for this email, password recovery instructions have been sent.
        </p>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
          Please check your inbox and spam folder. Links expire in <strong>15 minutes</strong>.
        </p>
        <div style={{ marginTop: '24px', width: '100%', boxSizing: 'border-box' }}>
          <Link to="/login" className="login-submit-button" style={{ textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return renderWrapper(
    <div className="login-glass-card">
      <div className="login-header-group">
        <h2 className="login-title">Forgot Password?</h2>
        <p className="login-subtitle">Enter your registered applicant email address and we'll send you a password reset link.</p>
      </div>

      {error && (
        <div className="login-alert login-alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-alert-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-form-group">
          <label htmlFor="email" className="login-label">Email Address</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-input"
            required
          />
        </div>

        <button type="submit" className="login-submit-button" disabled={loading}>
          {loading ? 'Submitting...' : 'Send Recovery Link'}
        </button>
      </form>

      <p className="login-footer">
        Remember your password?{' '}
        <Link to="/login" className="login-register-link">
          Sign In
        </Link>
      </p>
    </div>
  );
};

export default ForgotPassword;

