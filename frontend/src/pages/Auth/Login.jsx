import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import { API_BASE_URL } from '../../utils/apiConfig';

const Login = () => {
  useEffect(() => {
    document.title = 'Sign In - Airship Express Hiring Portal';
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    Email: '',
    Password: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionMessage, setSessionMessage] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Show message when redirected from session guard
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reason = params.get('reason');
    if (reason === 'password_reset') {
      setSessionMessage('Your password was reset by an administrator. Please log in with your new credentials.');
    } else if (reason === 'account_deleted') {
      setSessionMessage('Your account has been removed. Please contact your Super Administrator.');
    } else if (reason === 'account_self_deleted') {
      setSessionMessage('Your account and personal data have been successfully deleted. Thank you for your interest in Airship Express.');
    } else if (reason === 'account_deactivated') {
      setSessionMessage('Your account has been deactivated. Please contact your Super Administrator.');
    } else if (reason === 'inactivity') {
      setSessionMessage('You were automatically signed out due to 30 minutes of inactivity. Please log in again.');
    }
  }, [location.search]);

  // Countdown timer for brute-force lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const formatLockoutTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    }
    return `${secs}s`;
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error && lockoutSeconds <= 0) setError('');
    if (sessionMessage) setSessionMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    // ── CLIENT-SIDE INPUT VALIDATION ──────────────────────────────────────────
    const trimmedEmail = (formData.Email || '').trim();
    const trimmedPassword = formData.Password || '';

    if (!trimmedEmail && !trimmedPassword) {
      setError('Please enter your email address and password.');
      return;
    }
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!trimmedPassword) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');
    setSessionMessage('');
    setUnverified(false);

    // Clean URL query parameters so session reason doesn't re-trigger
    if (location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          Email: trimmedEmail,
          Password: trimmedPassword
        })
      });

      const result = await response.json();

      // ── FORCED RESET INTERCEPT ────────────────────────────────────────────
      // Server signals admin must set a new password before accessing dashboard
      if (result.status === 'password_reset_required') {
        navigate('/admin-setup-password', {
          state: {
            token: result.setup_token,
            user:  result.user,
          },
        });
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      if (!response.ok) {
        if (response.status === 429 && result.lockout_remaining) {
          const remaining = parseInt(result.lockout_remaining, 10);
          const tier = result.lockout_tier || 1;
          setLockoutSeconds(remaining);
          const tierPrefixes = {
            1: '🔒 Too many failed attempts.',
            2: '⚠️ Repeated failures detected.',
            3: '🛑 Security lockout triggered.',
          };
          const prefix = tierPrefixes[tier] || tierPrefixes[1];
          throw new Error(`${prefix} Please wait ${formatLockoutTime(remaining)} before trying again.`);
        }
        // Check if error is due to unverified email
        if (response.status === 403 && result.message?.includes('verify your email')) {
          setUnverified(true);
        }
        throw new Error(result.message || 'Login failed.');
      }

      // Success - Save JWT token and user data in local storage
      if (result.token) {
        localStorage.setItem('hiring_token', result.token);
      }
      localStorage.setItem('hiring_user', JSON.stringify(result.user));
      try { window.dispatchEvent(new CustomEvent('auth_login', { detail: result.user })); } catch (e) {}
      sessionStorage.setItem('just_logged_in', 'true');
      sessionStorage.setItem('trigger_dashboard_stagger', 'true');

      // Redirect based on role
      if (result.user.is_admin === 3) {
        navigate('/super-admin-dashboard');
      } else if (result.user.is_admin === 1) {
        navigate('/admin-dashboard');
      } else {
        navigate('/applicant-dashboard');
      }

    } catch (err) {
      setError(err.message || 'Incorrect credentials or network connection failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {/* Form Header Group */}
      <div className="auth-form-header">
        <h2 className="auth-title">Welcome Back!</h2>
        <p className="auth-subtitle">
          Sign in to your account to manage your applications and stay updated on your hiring progress.
        </p>
      </div>

      {/* Session Notification Alert (e.g. timeout, forced reset) */}
      {sessionMessage && !error && (
        <div className="auth-alert auth-alert-warning" role="alert">
          <i className="bx bx-error auth-alert-icon" />
          <span>{sessionMessage}</span>
        </div>
      )}

      {/* Error / Lockout Alert */}
      {error && (
        <div className={`auth-alert ${unverified ? 'auth-alert-warning' : 'auth-alert-error'}`} role="alert">
          <i className={`bx ${unverified ? 'bx-error' : 'bx-error-circle'} auth-alert-icon`} />
          <span>{error}</span>
        </div>
      )}

      {/* Sign In Form */}
      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {/* Email Address */}
        <div className="auth-input-group">
          <label htmlFor="Email" className="auth-label">
            Email Address
          </label>
          <div className="auth-input-wrapper">
            <i className="bx bx-envelope auth-input-icon" aria-hidden="true" />
            <input
              type="email"
              id="Email"
              name="Email"
              value={formData.Email}
              onChange={handleChange}
              className="auth-input has-left-icon"
              placeholder="Enter your email address"
              autoComplete="email"
            />
          </div>
        </div>

        {/* Password */}
        <div className="auth-input-group">
          <label htmlFor="Password" className="auth-label">
            Password
          </label>
          <div className="auth-input-wrapper">
            <i className="bx bx-lock-alt auth-input-icon" aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              id="Password"
              name="Password"
              value={formData.Password}
              onChange={handleChange}
              className="auth-input has-left-icon has-right-btn"
              placeholder="Enter your password"
              autoComplete="current-password"
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
        </div>

        {/* Right-aligned "Forgot Password?" Link */}
        <div className="auth-helper-row">
          <Link to="/forgot-password" className="auth-forgot-link">
            Forgot Password?
          </Link>
        </div>

        {/* Full-width Magenta Gradient Submit Button */}
        <button
          type="submit"
          className="auth-primary-btn"
          disabled={loading || lockoutSeconds > 0}
        >
          {loading ? (
            'Signing In...'
          ) : lockoutSeconds > 0 ? (
            `Locked (${formatLockoutTime(lockoutSeconds)})`
          ) : (
            <>
              Sign In <i className="bx bx-right-arrow-alt auth-btn-arrow" />
            </>
          )}
        </button>
      </form>

      {/* Bottom Navigation */}
      <p className="auth-bottom-nav">
        Don't have an account?{' '}
        <Link to="/register" className="auth-link-magenta">
          Create an Account <i className="bx bx-right-arrow-alt" />
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
