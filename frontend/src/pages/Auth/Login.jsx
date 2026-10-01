import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import onlyLogoImg from '../../assets/images/only_logo.png'; // Brand logo icon
import bgImage from '../../assets/images/log_bg.png';
import './Login.css';

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
        body: JSON.stringify(formData)
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
      // JWT token: used for secure API authentication & session guard heartbeat
      // hiring_user: used for UI display (name, role) only
      if (result.token) {
        localStorage.setItem('hiring_token', result.token);
      }
      localStorage.setItem('hiring_user', JSON.stringify(result.user));
      try { window.dispatchEvent(new CustomEvent('auth_login', { detail: result.user })); } catch (e) {}
      sessionStorage.setItem('just_logged_in', 'true');

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
    <div className="login-page-wrapper" style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
      {/* Dark Tint Overlay Layer */}
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

      {/* Glassmorphism Login Card */}
      <div className="login-glass-card">
        <div className="login-header-group">
          <h2 className="login-title">LOG IN</h2>
          <p className="login-subtitle">
            Welcome to our Hiring Portal. Let's build your future together.
          </p>
        </div>

        {sessionMessage && !error && (
          <div className="login-alert" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.4)', color: '#b45309', marginBottom: '12px', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <i className="bx bx-error" style={{ fontSize: '18px', flexShrink: 0 }}></i>
            <span>{sessionMessage}</span>
          </div>
        )}

        {error && (
          <div className={`login-alert ${unverified ? 'login-alert-warning' : 'login-alert-error'}`}>
            <i className={`bx ${unverified ? 'bx-error' : 'bx-error-circle'}`} style={{ fontSize: '18px', flexShrink: 0 }}></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-form-group">
            <label htmlFor="Email" className="login-label">Email Address</label>
            <input
              type="email"
              id="Email"
              name="Email"
              value={formData.Email}
              onChange={handleChange}
              className="login-input"
              required
            />
          </div>

          <div className="login-form-group">
            <label htmlFor="Password" className="login-label">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="Password"
                name="Password"
                value={formData.Password}
                onChange={handleChange}
                className="login-input"
                style={{ paddingRight: '44px' }}
                required
              />
              <button 
                type="button" 
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`bx ${showPassword ? 'bx-hide' : 'bx-show'}`} style={{ fontSize: '20px' }}></i>
              </button>
            </div>
          </div>

          {/* Right-aligned "Forgot Password?" text link */}
          <div className="login-helper-block">
            <Link to="/forgot-password" className="login-forgot-link">
              Forgot Password?
            </Link>
          </div>

          {/* Premium Gold/Amber Brand Button */}
          <button
            type="submit"
            className="login-submit-button"
            disabled={loading || lockoutSeconds > 0}
          >
            {loading ? 'Signing In...' : lockoutSeconds > 0 ? `Locked (${formatLockoutTime(lockoutSeconds)})` : 'Sign In'}
          </button>
        </form>

        <p className="login-footer">
          Don't have an account?{' '}
          <Link to="/register" className="login-register-link">
            Register Here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;

