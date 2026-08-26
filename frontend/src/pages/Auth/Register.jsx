import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import onlyLogoImg from '../../assets/images/only_logo.png'; // Brand logo icon
import bgImage from '../../assets/images/log_bg.png';
import './Register.css';

const Register = () => {
  useEffect(() => {
    document.title = 'Create Account - Hiring Management System';
  }, []);

  const [formData, setFormData] = useState({
    User_Fname: '',
    User_Lname: '',
    User_Email: '',
    User_Mobile: '',
    User_Pass: '',
    User_Bday: '',
    User_Gender: 'Male'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Real-time password criteria validation helper
  const passChecks = {
    length: formData.User_Pass.length >= 8,
    uppercase: /[A-Z]/.test(formData.User_Pass),
    lowercase: /[a-z]/.test(formData.User_Pass),
    numSpecial: /[0-9]/.test(formData.User_Pass) && /[^A-Za-z0-9]/.test(formData.User_Pass)
  };

  const isPasswordStrong = Object.values(passChecks).every(Boolean);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Enforce Password Strength requirements
    if (!isPasswordStrong) {
      setError('Please ensure your password meets all strength requirements.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost/Hiring%20System/backend/auth/register.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Registration failed.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Common wrapper components for matching visual style
  const renderWrapper = (children) => (
    <div 
      className="register-page-wrapper" 
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
        .register-page-wrapper::-webkit-scrollbar {
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
      <header className="register-navbar" style={{ zIndex: 100 }}>
        <div className="register-navbar-brand">
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

  if (success) {
    return renderWrapper(
      <div className="register-glass-card success-card animate-fade-in" style={{ textAlign: 'center' }}>
        <div className="success-icon" style={{ color: '#16a34a', width: '60px', height: '60px', margin: '0 auto 16px' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-check-circle" style={{ width: '100%', height: '100%' }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <h2 className="register-title">Registration Successful!</h2>
        <p className="register-subtitle" style={{ marginBottom: '20px' }}>
          Please check your email (<strong>{formData.User_Email}</strong>) to verify your account.
        </p>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
          Once verified, you will be able to log in to your dashboard.
        </p>
        <div style={{ marginTop: '24px', width: '100%', boxSizing: 'border-box' }}>
          <Link to="/login" className="register-submit-button" style={{ textDecoration: 'none', width: '100%', boxSizing: 'border-box' }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return renderWrapper(
    <div className="register-glass-card">
      <div className="register-header-group">
        <h2 className="register-title">Create Account</h2>
        <p className="register-subtitle">Join our team. Build your future today!</p>
      </div>

      {error && (
        <div className="register-alert register-alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="register-alert-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="register-form">
        <div className="register-form-row">
          <div className="register-form-group">
            <label htmlFor="User_Fname" className="register-label">First Name</label>
            <input
              type="text"
              id="User_Fname"
              name="User_Fname"
              value={formData.User_Fname}
              onChange={handleChange}
              className="register-input"
              required
            />
          </div>
          <div className="register-form-group">
            <label htmlFor="User_Lname" className="register-label">Last Name</label>
            <input
              type="text"
              id="User_Lname"
              name="User_Lname"
              value={formData.User_Lname}
              onChange={handleChange}
              className="register-input"
              required
            />
          </div>
        </div>

        <div className="register-form-group">
          <label htmlFor="User_Email" className="register-label">Email Address</label>
          <input
            type="email"
            id="User_Email"
            name="User_Email"
            value={formData.User_Email}
            onChange={handleChange}
            className="register-input"
            required
          />
        </div>

        <div className="register-form-group">
          <label htmlFor="User_Mobile" className="register-label">Mobile Number</label>
          <input
            type="tel"
            id="User_Mobile"
            name="User_Mobile"
            value={formData.User_Mobile}
            onChange={handleChange}
            className="register-input"
            required
          />
        </div>

        <div className="register-form-row">
          <div className="register-form-group">
            <label htmlFor="User_Bday" className="register-label">Date of Birth</label>
            <input
              type="date"
              id="User_Bday"
              name="User_Bday"
              value={formData.User_Bday}
              onChange={handleChange}
              className="register-input"
              required
            />
          </div>
          <div className="register-form-group">
            <label htmlFor="User_Gender" className="register-label">Gender</label>
            <select
              id="User_Gender"
              name="User_Gender"
              value={formData.User_Gender}
              onChange={handleChange}
              className="register-input"
              required
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="register-form-group">
          <label htmlFor="User_Pass" className="register-label">
            Password <span style={{ textTransform: 'none', fontWeight: 'normal', color: '#64748b', fontSize: '10.5px' }}>(Must meet strong criteria)</span>
          </label>
          {/* Input field with Eye Visibility toggle icon */}
          <div className="password-input-container">
            <input
              type={showPassword ? 'text' : 'password'}
              id="User_Pass"
              name="User_Pass"
              value={formData.User_Pass}
              onChange={handleChange}
              className="register-input"
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

          {/* Real-time Password Strength checklist - always visible to guide the user */}
          <div className="password-requirements-grid">
            <div className={`requirement-item ${passChecks.length ? 'met' : 'unmet'}`}>
              <svg className="requirement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                {passChecks.length ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
              </svg>
              <span>8+ Characters</span>
            </div>
            <div className={`requirement-item ${passChecks.uppercase ? 'met' : 'unmet'}`}>
              <svg className="requirement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                {passChecks.uppercase ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
              </svg>
              <span>Uppercase (A-Z)</span>
            </div>
            <div className={`requirement-item ${passChecks.lowercase ? 'met' : 'unmet'}`}>
              <svg className="requirement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                {passChecks.lowercase ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
              </svg>
              <span>Lowercase (a-z)</span>
            </div>
            <div className={`requirement-item ${passChecks.numSpecial ? 'met' : 'unmet'}`}>
              <svg className="requirement-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                {passChecks.numSpecial ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
              </svg>
              <span>Number & Special</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="register-submit-button"
          disabled={loading || !isPasswordStrong}
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>

      <p className="register-footer">
        Already have an account?{' '}
        <Link to="/login" className="register-signin-link">
          Sign In
        </Link>
      </p>
    </div>
  );
};

export default Register;

