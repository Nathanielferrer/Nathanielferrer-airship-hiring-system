import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import { API_BASE_URL } from '../../utils/apiConfig';

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

    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot_password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email: trimmedEmail })
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

  // If request successfully submitted, show clear instructions
  if (submitted) {
    return (
      <AuthLayout>
        <div className="auth-success-box">
          <div className="auth-success-icon-wrap" aria-hidden="true">
            <i className="bx bx-check-circle" />
          </div>
          <h2 className="auth-success-title">Request Processed</h2>
          <p className="auth-success-desc">
            If an applicant account exists for <strong>{email}</strong>, password recovery instructions have been sent.
          </p>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px', lineHeight: '1.5' }}>
            Please check your inbox and spam folder. Links expire in <strong>15 minutes</strong>.
          </p>
          <Link to="/login" className="auth-primary-btn" style={{ textDecoration: 'none' }}>
            Back to Login <i className="bx bx-right-arrow-alt auth-btn-arrow" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {/* Form Header Group */}
      <div className="auth-form-header">
        <h2 className="auth-title">Forgot Your Password?</h2>
        <p className="auth-subtitle">
          Enter your registered applicant email address and we'll send you a password reset link.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <i className="bx bx-error-circle auth-alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* Recovery Form */}
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {/* Email Address Field */}
        <div className="auth-input-group">
          <label htmlFor="email" className="auth-label">
            Email Address
          </label>
          <div className="auth-input-wrapper">
            <i className="bx bx-envelope auth-input-icon" aria-hidden="true" />
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              className="auth-input has-left-icon"
              placeholder="Enter your email address"
              autoComplete="email"
            />
          </div>
        </div>

        {/* Full-width Magenta Gradient Recovery Button */}
        <button
          type="submit"
          className="auth-primary-btn"
          disabled={loading}
        >
          {loading ? (
            'Sending Recovery Link...'
          ) : (
            <>
              Send Recovery Link <i className="bx bx-right-arrow-alt auth-btn-arrow" />
            </>
          )}
        </button>
      </form>

      {/* Bottom Navigation */}
      <p className="auth-bottom-nav">
        Remember your password?{' '}
        <Link to="/login" className="auth-link-magenta">
          Sign In <i className="bx bx-right-arrow-alt" />
        </Link>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
