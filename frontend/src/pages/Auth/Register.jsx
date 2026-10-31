import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import { API_BASE_URL } from '../../utils/apiConfig';

const Register = () => {
  useEffect(() => {
    document.title = 'Create Account - Airship Express Hiring Portal';
  }, []);

  const [formData, setFormData] = useState({
    User_Fname: '',
    User_MInitial: '',
    User_Lname: '',
    User_Email: '',
    User_Pass: '',
    User_Bday: '',
    User_Gender: 'Male'
  });

  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time password criteria validation helper
  const passChecks = {
    length: formData.User_Pass.length >= 8 && formData.User_Pass.length <= 64,
    uppercase: /[A-Z]/.test(formData.User_Pass),
    lowercase: /[a-z]/.test(formData.User_Pass),
    numSpecial: /[0-9]/.test(formData.User_Pass) && /[^A-Za-z0-9]/.test(formData.User_Pass)
  };

  const isPasswordStrong = Object.values(passChecks).every(Boolean);
  const passwordsMatch = formData.User_Pass === confirmPass;
  const isFormValid = isPasswordStrong && passwordsMatch && confirmPass.length > 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'User_MInitial') {
      const cleaned = value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 1);
      setFormData(prev => ({ ...prev, [name]: cleaned }));
      return;
    }
    // Cap year to 4 digits max to prevent invalid years
    if (name === 'User_Bday' && value) {
      const parts = value.split('-');
      if (parts[0] && parts[0].length > 4) {
        parts[0] = parts[0].slice(0, 4);
        setFormData(prev => ({ ...prev, [name]: parts.join('-') }));
        return;
      }
    }
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate First Name (2 - 50 chars)
    const trimmedFname = (formData.User_Fname || '').trim();
    if (trimmedFname.length < 2 || trimmedFname.length > 50 || !/^[a-zA-Z\s\-'\.]+$/.test(trimmedFname)) {
      setError('First name must be between 2 and 50 characters (letters, spaces, hyphens, apostrophes, and periods only).');
      return;
    }

    // Validate Last Name (2 - 50 chars)
    const trimmedLname = (formData.User_Lname || '').trim();
    if (trimmedLname.length < 2 || trimmedLname.length > 50 || !/^[a-zA-Z\s\-'\.]+$/.test(trimmedLname)) {
      setError('Last name must be between 2 and 50 characters (letters, spaces, hyphens, apostrophes, and periods only).');
      return;
    }

    // Validate Middle Initial (optional, max 1 letter)
    const mi = (formData.User_MInitial || '').trim();
    if (mi && !/^[a-zA-Z]$/.test(mi)) {
      setError('Middle initial must be a single letter only.');
      return;
    }

    // Validate Date of Birth
    if (formData.User_Bday) {
      const bdayDate = new Date(formData.User_Bday);
      const bdayYear = bdayDate.getFullYear();
      const currentYear = new Date().getFullYear();
      const today = new Date();

      if (isNaN(bdayDate.getTime()) || bdayYear < 1900 || bdayYear > currentYear) {
        setError('Please enter a valid date of birth (year must be between 1900 and ' + currentYear + ').');
        return;
      }

      // Minimum age check (15 years)
      const age = today.getFullYear() - bdayDate.getFullYear();
      const monthDiff = today.getMonth() - bdayDate.getMonth();
      const dayDiff = today.getDate() - bdayDate.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

      if (actualAge < 15) {
        setError('You must be at least 15 years old to create an account.');
        return;
      }
    }

    // Enforce Password Strength requirements
    if (!isPasswordStrong) {
      setError('Please ensure your password meets all strength requirements (8-64 characters).');
      return;
    }

    // Enforce password confirmation match
    if (!passwordsMatch) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register.php`, {
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

  // If successfully registered, show clear confirmation
  if (success) {
    return (
      <AuthLayout>
        <div className="auth-success-box">
          <div className="auth-success-icon-wrap" aria-hidden="true">
            <i className="bx bx-check-circle" />
          </div>
          <h2 className="auth-success-title">Registration Successful!</h2>
          <p className="auth-success-desc">
            Please check your email (<strong>{formData.User_Email}</strong>) to verify your account.
            Once verified, you will be able to log in to your dashboard.
          </p>
          <Link to="/login" className="auth-primary-btn" style={{ textDecoration: 'none' }}>
            Go to Login <i className="bx bx-right-arrow-alt auth-btn-arrow" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout isScrollable={true}>
      {/* Form Header */}
      <div className="auth-form-header">
        <h2 className="auth-title">Create Your Account</h2>
        <p className="auth-subtitle">Join our team. Build your future today!</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <i className="bx bx-error-circle auth-alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {/* Row 1 – Personal Information: First Name, M.I., Last Name */}
        <div className="auth-form-row">
          <div className="auth-input-group">
            <label htmlFor="User_Fname" className="auth-label">
              First Name
            </label>
            <input
              type="text"
              id="User_Fname"
              name="User_Fname"
              value={formData.User_Fname}
              onChange={handleChange}
              className="auth-input"
              minLength={2}
              maxLength={50}
              placeholder="First Name"
              autoComplete="given-name"
              required
            />
          </div>

          <div className="auth-input-group auth-form-col-mi">
            <label htmlFor="User_MInitial" className="auth-label">
              M.I. <span className="auth-label-opt">(Opt)</span>
            </label>
            <input
              type="text"
              id="User_MInitial"
              name="User_MInitial"
              value={formData.User_MInitial}
              onChange={handleChange}
              className="auth-input"
              maxLength={1}
              placeholder="M"
              autoComplete="additional-name"
              style={{ textAlign: 'center' }}
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="User_Lname" className="auth-label">
              Last Name
            </label>
            <input
              type="text"
              id="User_Lname"
              name="User_Lname"
              value={formData.User_Lname}
              onChange={handleChange}
              className="auth-input"
              minLength={2}
              maxLength={50}
              placeholder="Last Name"
              autoComplete="family-name"
              required
            />
          </div>
        </div>

        {/* Row 2 – Email Address */}
        <div className="auth-input-group">
          <label htmlFor="User_Email" className="auth-label">
            Email Address
          </label>
          <div className="auth-input-wrapper">
            <i className="bx bx-envelope auth-input-icon" aria-hidden="true" />
            <input
              type="email"
              id="User_Email"
              name="User_Email"
              value={formData.User_Email}
              onChange={handleChange}
              className="auth-input has-left-icon"
              placeholder="Enter your email address"
              maxLength={254}
              autoComplete="email"
              required
            />
          </div>
        </div>

        {/* Row 3 – Personal Details: Date of Birth & Gender */}
        <div className="auth-form-row">
          <div className="auth-input-group">
            <label htmlFor="User_Bday" className="auth-label">
              Date of Birth
            </label>
            <div className="auth-input-wrapper">
              <i className="bx bx-calendar auth-input-icon" aria-hidden="true" />
              <input
                type="date"
                id="User_Bday"
                name="User_Bday"
                value={formData.User_Bday}
                onChange={handleChange}
                className="auth-input has-left-icon"
                min="1900-01-01"
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
          </div>

          <div className="auth-input-group">
            <label htmlFor="User_Gender" className="auth-label">
              Gender
            </label>
            <div className="auth-input-wrapper">
              <i className="bx bx-user auth-input-icon" aria-hidden="true" />
              <select
                id="User_Gender"
                name="User_Gender"
                value={formData.User_Gender}
                onChange={handleChange}
                className="auth-input has-left-icon"
                style={{ cursor: 'pointer' }}
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Row 4 – Password with Dynamic Validation Indicator */}
        <div className="auth-input-group">
          <label htmlFor="User_Pass" className="auth-label">
            Password <span className="auth-label-opt">(8-64 characters)</span>
          </label>
          <div className="auth-input-wrapper">
            <i className="bx bx-lock-alt auth-input-icon" aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              id="User_Pass"
              name="User_Pass"
              value={formData.User_Pass}
              onChange={handleChange}
              className="auth-input has-left-icon has-right-btn"
              minLength={8}
              maxLength={64}
              placeholder="Enter your password"
              autoComplete="new-password"
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

          {/* Two-Column Dynamic Password Requirements Checklist */}
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

        {/* Row 5 – Confirm Password */}
        <div className="auth-input-group">
          <label htmlFor="User_Pass_Confirm" className="auth-label">
            Confirm Password
          </label>
          <div className="auth-input-wrapper">
            <i className="bx bx-lock auth-input-icon" aria-hidden="true" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              id="User_Pass_Confirm"
              name="User_Pass_Confirm"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              className="auth-input has-left-icon has-right-btn"
              minLength={8}
              maxLength={64}
              placeholder="Confirm your password"
              autoComplete="new-password"
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

          {/* Password Match Status */}
          {confirmPass.length > 0 && (
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

        {/* Full-width Magenta Gradient Button */}
        <button
          type="submit"
          className="auth-primary-btn"
          disabled={loading || !isFormValid}
        >
          {loading ? (
            'Creating Account...'
          ) : (
            <>
              Create Account <i className="bx bx-right-arrow-alt auth-btn-arrow" />
            </>
          )}
        </button>
      </form>

      {/* Bottom Navigation */}
      <p className="auth-bottom-nav">
        Already have an account?{' '}
        <Link to="/login" className="auth-link-magenta">
          Sign In <i className="bx bx-right-arrow-alt" />
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
