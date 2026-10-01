import React, { useState, useEffect } from 'react';
import ApplicantNavbar from '../../components/ApplicantNavbar/ApplicantNavbar';
import useApplicantData from '../../hooks/useApplicantData';
import { PageLoadingScreen } from '../../components/Loading';
import ConfirmModal from '../../components/ConfirmModal/ConfirmModal';
import LoadingScreen from '../../components/LoadingScreen/LoadingScreen';
import useToast from '../../components/Toast/Toast';
import ChangeEmailModal from './components/ChangeEmailModal';
import DeleteAccountModal from './components/DeleteAccountModal';
import './Settings.css';

import { API_BASE_URL } from '../../utils/apiConfig';
const Settings = () => {
  const {
    user,
    setUser,
    notifications,
    showNotifications,
    setShowNotifications,
    showProfileMenu,
    setShowProfileMenu,
    handleNotificationClick,
    handleClearReadNotifications,
    handleMarkAllAsRead,
    handleLogout,
    notifRef,
    dropdownRef,
    confirmModalState,
    setConfirmModalState,
    closeConfirmModal,
    isLoggingOut,
  } = useApplicantData({ navigateOnNotification: false, requireAuth: true });

  const { showToast, ToastPortal } = useToast();

  useEffect(() => {
    document.title = 'Account Settings - Airship Express';

    // Handle feedback from direct email cancel link
    const params = new URLSearchParams(window.location.search);
    if (params.get('email_change_cancelled') === '1') {
      showToast('Pending email change request has been successfully cancelled.', 'info');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [showToast]);

  // ── Profile Information State ──────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    middleInitial: '',
    lastName: ''
  });
  const [savedProfile, setSavedProfile] = useState({
    firstName: '',
    middleInitial: '',
    lastName: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [hasActiveApp, setHasActiveApp] = useState(false);
  const [activeAppTitle, setActiveAppTitle] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // ── Email Change State ─────────────────────────────────────────────────────
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingEmailExpires, setPendingEmailExpires] = useState(null);
  const [emailActionLoading, setEmailActionLoading] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  // Sync profile form once user data is loaded
  useEffect(() => {
    if (user) {
      const fn = (user.first_name || user.User_Fname || '').trim();
      const mi = (user.middle_initial || user.User_MInitial || '').trim();
      const ln = (user.last_name || user.User_Lname || '').trim();
      setProfileForm({ firstName: fn, middleInitial: mi, lastName: ln });
      setSavedProfile({ firstName: fn, middleInitial: mi, lastName: ln });

      const uid = user.id || user.user_id || user.User_ID || 0;
      if (uid > 0) {
        fetch(`${API_BASE_URL}/applications/get_user_applications.php?user_id=${uid}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('hiring_token') || ''}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data.status === 'success' && Array.isArray(data.applications)) {
              const terminalStatuses = [
                'hired', 'officially hired', 'officially_hired', 'officially hired & signed',
                'officially hired & requirements completed', 'completed requirements', 'completed_requirements',
                'contract signed & onboarded', 'contract_signed_and_onboarded', 'archived',
                'screening_rejected', 'screening rejected', 'rejected', 'failed interview', 'failed', 'interview_failed',
                'failed initial', 'failed_initial', 'failed initial interview', 'failed_initial_interview',
                'failed final', 'failed_final', 'failed final interview', 'failed_final_interview',
                'failed final approval', 'failed_final_approval',
                'failed pre-employment', 'failed_pre_employment', 'incomplete requirements', 'incomplete_requirements',
                'candidate withdrew', 'candidate_withdrew', 'withdrawn', 'withdraw',
                'offer declined', 'offer_declined', 'job offer declined', 'job_offer_declined', 'declined',
                'offer expired', 'offer_expired', 'scheduling expired', 'scheduling_expired',
                'declined - unresponsive', 'declined_unresponsive', 'unresponsive',
                'candidate no show', 'candidate_no_show', 'no show', 'no_show'
              ];
              const activeApp = data.applications.find(app => !terminalStatuses.includes((app.status || '').toLowerCase().trim()));
              setHasActiveApp(!!activeApp);
              if (activeApp) {
                setActiveAppTitle(activeApp.job_title || activeApp.title || 'an active position');
              } else {
                setActiveAppTitle('');
              }

              // If Admin updated the candidate's name in the database, sync the fresh name immediately
              if (data.user) {
                const freshFn = (data.user.User_Fname || '').trim();
                const freshMi = (data.user.User_MInitial || data.user.middle_initial || '').trim();
                const freshLn = (data.user.User_Lname || '').trim();
                setProfileForm({ firstName: freshFn, middleInitial: freshMi, lastName: freshLn });
                setSavedProfile({ firstName: freshFn, middleInitial: freshMi, lastName: freshLn });

                if (data.user.pending_email) {
                  setPendingEmail(data.user.pending_email);
                  setPendingEmailExpires(data.user.pending_email_expires);
                } else {
                  setPendingEmail('');
                  setPendingEmailExpires(null);
                }

                const existing = JSON.parse(localStorage.getItem('hiring_user') || '{}');
                if (existing.User_Fname !== freshFn || existing.User_Lname !== freshLn || (existing.User_MInitial || existing.middle_initial || '') !== freshMi) {
                  const updated = {
                    ...existing,
                    first_name: freshFn,
                    middle_initial: freshMi,
                    last_name: freshLn,
                    User_Fname: freshFn,
                    User_MInitial: freshMi,
                    User_Lname: freshLn
                  };
                  localStorage.setItem('hiring_user', JSON.stringify(updated));
                  if (typeof setUser === 'function') {
                    setUser(updated);
                  }
                }
              }
            }
          })
          .catch(err => console.error("Failed to check active applications:", err));
      }
    }
  }, [user]);

  // Handle account deletion completion
  const handleDeleteAccountSuccess = (msg) => {
    localStorage.removeItem('hiring_user');
    localStorage.removeItem('user');
    sessionStorage.clear();
    window.location.href = '/login?reason=account_self_deleted';
  };

  // ── Password Change State ──────────────────────────────────────────────────
  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  const handleProfileChange = (field, value) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
    if (profileMsg.text) {
      setProfileMsg({ type: '', text: '' });
    }
  };

  const handlePassChange = (field, value) => {
    setPassForm(prev => ({ ...prev, [field]: value }));
    if (passMsg.text) {
      setPassMsg({ type: '', text: '' });
    }
  };

  // Password criteria checking for visual indicators
  const passChecks = {
    length: passForm.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(passForm.newPassword),
    lowercase: /[a-z]/.test(passForm.newPassword),
    numSpecial: /[0-9]/.test(passForm.newPassword) && /[^A-Za-z0-9]/.test(passForm.newPassword)
  };

  const passwordsMatch = passForm.newPassword === passForm.confirmPassword && passForm.confirmPassword.length > 0;

  // ── Handle Profile Update ──────────────────────────────────────────────────
  const handleProfileSubmit = (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });

    const trimmedFirst = profileForm.firstName.trim();
    const trimmedLast  = profileForm.lastName.trim();
    const trimmedMi    = profileForm.middleInitial.trim().replace('.', '').toUpperCase().slice(0, 1);

    if (trimmedFirst.length < 2 || trimmedFirst.length > 50 || !/^[a-zA-Z\s\-'\.]+$/.test(trimmedFirst)) {
      setProfileMsg({ type: 'error', text: 'First name must be between 2 and 50 characters (letters, spaces, hyphens, apostrophes, and periods only).' });
      return;
    }

    if (trimmedLast.length < 2 || trimmedLast.length > 50 || !/^[a-zA-Z\s\-'\.]+$/.test(trimmedLast)) {
      setProfileMsg({ type: 'error', text: 'Last name must be between 2 and 50 characters (letters, spaces, hyphens, apostrophes, and periods only).' });
      return;
    }

    if (trimmedMi && !/^[a-zA-Z]$/.test(trimmedMi)) {
      setProfileMsg({ type: 'error', text: 'Middle initial must be a single letter only.' });
      return;
    }

    setConfirmModalState({
      isOpen: true,
      title: 'Confirm Profile Update',
      message: 'Are you sure you want to save these profile changes?',
      confirmText: 'Save Changes',
      cancelText: 'Cancel',
      type: 'primary',
      onConfirm: async () => {
        closeConfirmModal();
        setProfileLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/auth/update_profile.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id || user.user_id || user.User_ID || 0,
              first_name: profileForm.firstName.trim(),
              middle_initial: profileForm.middleInitial.trim().replace('.', '').toUpperCase(),
              last_name: profileForm.lastName.trim()
            })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            const trimmedFirst = profileForm.firstName.trim();
            const trimmedMi    = profileForm.middleInitial.trim().replace('.', '').toUpperCase();
            const trimmedLast  = profileForm.lastName.trim();

            // Immediately sync savedProfile so hasProfileChanges becomes false and button is inactive
            setSavedProfile({
              firstName: trimmedFirst,
              middleInitial: trimmedMi,
              lastName: trimmedLast
            });
            setProfileForm({
              firstName: trimmedFirst,
              middleInitial: trimmedMi,
              lastName: trimmedLast
            });

            // Update localStorage
            const existing = JSON.parse(localStorage.getItem('hiring_user') || '{}');
            const updatedUser = {
              ...existing,
              first_name: trimmedFirst,
              middle_initial: trimmedMi,
              last_name: trimmedLast,
              User_Fname: trimmedFirst,
              User_MInitial: trimmedMi,
              User_Lname: trimmedLast
            };
            localStorage.setItem('hiring_user', JSON.stringify(updatedUser));

            if (typeof setUser === 'function') {
              setUser(updatedUser);
            }
            window.dispatchEvent(new Event('storage'));

            setProfileMsg({ type: 'success', text: 'Profile details saved successfully.' });
            showToast('Your profile details have been updated.', 'success');
          } else {
            setProfileMsg({ type: 'error', text: data.message || 'Failed to update profile.' });
          }
        } catch (err) {
          console.error(err);
          setProfileMsg({ type: 'error', text: 'Connection error while saving profile.' });
        } finally {
          setProfileLoading(false);
        }
      }
    });
  };

  const hasProfileChanges = !hasActiveApp && (
    profileForm.firstName.trim() !== savedProfile.firstName ||
    profileForm.middleInitial.trim() !== savedProfile.middleInitial ||
    profileForm.lastName.trim() !== savedProfile.lastName
  ) && profileForm.firstName.trim().length > 0 && profileForm.lastName.trim().length > 0;

  // ── Handle Email Change Handlers ───────────────────────────────────────────
  const handleEmailChangeSuccess = (newEmail, successMessage) => {
    setPendingEmail(newEmail);
    showToast(successMessage || `Verification email sent to ${newEmail}`, 'success');
  };

  const handleCancelEmailChange = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Cancel Email Change Request',
      message: `Are you sure you want to cancel the pending email change to ${pendingEmail}?`,
      confirmText: 'Yes, Cancel Request',
      cancelText: 'Keep Request',
      type: 'warning',
      onConfirm: async () => {
        closeConfirmModal();
        setEmailActionLoading(true);
        try {
          const uid = user.id || user.user_id || user.User_ID || 0;
          const res = await fetch(`${API_BASE_URL}/auth/cancel_email_change.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: uid })
          });
          const data = await res.json();
          if (res.ok && data.status === 'success') {
            setPendingEmail('');
            setPendingEmailExpires(null);
            showToast('Pending email change request has been cancelled.', 'info');
          } else {
            showToast(data.message || 'Failed to cancel request.', 'error');
          }
        } catch (err) {
          console.error(err);
          showToast('Connection error while cancelling request.', 'error');
        } finally {
          setEmailActionLoading(false);
        }
      }
    });
  };

  const handleResendEmailChange = async () => {
    if (emailActionLoading || isResendingEmail || !pendingEmail) return;
    setIsResendingEmail(true);
    setEmailActionLoading(true);

    try {
      const uid = user.id || user.user_id || user.User_ID || 0;
      const res = await fetch(`${API_BASE_URL}/auth/resend_email_change.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid })
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showToast(data.message || `Verification email has been resent to ${pendingEmail}.`, 'success');
      } else {
        showToast(data.message || 'Failed to resend verification email.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Connection error while resending verification email.', 'error');
    } finally {
      setIsResendingEmail(false);
      setEmailActionLoading(false);
    }
  };

  // ── Handle Password Change ─────────────────────────────────────────────────
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPassMsg({ type: '', text: '' });

    if (!passForm.currentPassword) {
      setPassMsg({ type: 'error', text: 'Please enter your current password.' });
      return;
    }

    if (!passForm.newPassword) {
      setPassMsg({ type: 'error', text: 'Please enter a new password.' });
      return;
    }

    if (passForm.newPassword.length < 8 || passForm.newPassword.length > 64) {
      setPassMsg({ type: 'error', text: 'New password must be between 8 and 64 characters long.' });
      return;
    }

    if (!/[A-Z]/.test(passForm.newPassword)) {
      setPassMsg({ type: 'error', text: 'New password must contain at least one uppercase letter (A-Z).' });
      return;
    }

    if (!/[a-z]/.test(passForm.newPassword)) {
      setPassMsg({ type: 'error', text: 'New password must contain at least one lowercase letter (a-z).' });
      return;
    }

    if (!/[0-9]/.test(passForm.newPassword)) {
      setPassMsg({ type: 'error', text: 'New password must contain at least one number (0-9).' });
      return;
    }

    if (!/[^A-Za-z0-9]/.test(passForm.newPassword)) {
      setPassMsg({ type: 'error', text: 'New password must contain at least one special character (e.g. !@#$%^&*).' });
      return;
    }

    if (!passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: 'Please confirm your new password.' });
      return;
    }

    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassMsg({ type: 'error', text: 'New passwords do not match. Please re-enter.' });
      return;
    }

    if (passForm.newPassword === passForm.currentPassword) {
      setPassMsg({ type: 'error', text: 'New password cannot be the same as your current password.' });
      return;
    }

    setConfirmModalState({
      isOpen: true,
      title: 'Confirm Password Change',
      message: 'Are you sure you want to update your account password?',
      confirmText: 'Change Password',
      cancelText: 'Cancel',
      type: 'primary',
      onConfirm: async () => {
        closeConfirmModal();
        setPassLoading(true);
        try {
          const res = await fetch(`${API_BASE_URL}/auth/change_password.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id || user.user_id || user.User_ID || 0,
              current_password: passForm.currentPassword,
              new_password: passForm.newPassword
            })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            setPassForm({
              currentPassword: '',
              newPassword: '',
              confirmPassword: ''
            });
            setPassMsg({ type: 'success', text: 'Your password has been changed successfully.' });
            showToast('Password updated successfully.', 'success');
          } else {
            setPassMsg({ type: 'error', text: data.message || 'Failed to change password.' });
          }
        } catch (err) {
          console.error(err);
          setPassMsg({ type: 'error', text: 'Connection error while updating password.' });
        } finally {
          setPassLoading(false);
        }
      }
    });
  };

  if (!user) {
    return (
      <PageLoadingScreen
        title="Airship Express"
        subtitle="Loading account settings..."
      />
    );
  }

  const userMi = (user.middle_initial || user.User_MInitial || '').trim();
  const userFullName = `${user.first_name || user.User_Fname || ''} ${userMi ? userMi + '. ' : ''}${user.last_name || user.User_Lname || ''}`.trim() || 'Applicant';
  const userInitial = userFullName.charAt(0).toUpperCase() || 'U';
  const userEmail = user.email || user.User_Email || '';

  return (
    <div className="settings-page-wrapper">
      <ApplicantNavbar
        user={user}
        activePage="settings"
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        showProfileMenu={showProfileMenu}
        setShowProfileMenu={setShowProfileMenu}
        handleNotificationClick={handleNotificationClick}
        handleClearReadNotifications={handleClearReadNotifications}
        handleMarkAllAsRead={handleMarkAllAsRead}
        handleLogout={handleLogout}
        notifRef={notifRef}
        dropdownRef={dropdownRef}
      />

      <main className="settings-main-container">
        <div className="settings-header">
          <h1 className="settings-page-title">Account Settings</h1>
          <p className="settings-page-subtitle">
            Manage your personal profile information and update your account security credentials.
          </p>
        </div>

        <div className="settings-cards-grid">
          {/* ── Card 1: Personal Profile ── */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon">
                <i className="bx bx-user" />
              </div>
              <div>
                <h2 className="settings-card-title">Personal Profile</h2>
                <p className="settings-card-desc">Update your candidate name and contact information.</p>
              </div>
            </div>

            <div className="settings-user-identity">
              <div className="settings-user-avatar">
                {userInitial}
              </div>
              <div className="settings-user-details">
                <div className="settings-user-fullname">{userFullName}</div>
                <div className="settings-user-email">{userEmail}</div>
              </div>
              <span className="settings-badge">
                <i className="bx bx-check-shield" /> Active Account
              </span>
            </div>

            {profileMsg.text && (
              <div className={`settings-alert ${profileMsg.type === 'error' ? 'settings-alert-error' : 'settings-alert-success'}`}>
                <i className={`bx ${profileMsg.type === 'error' ? 'bx-error-circle' : 'bx-check-circle'}`} style={{ fontSize: '18px' }} />
                <span>{profileMsg.text}</span>
              </div>
            )}

            {hasActiveApp && (
              <div className="settings-locked-notice">
                <i className="bx bx-lock-alt" />
                <span>Name editing is locked while you have an active application in progress.</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit}>
              <div className="settings-form-row settings-form-row-name">
                <div className="settings-form-group">
                  <label htmlFor="settings-fname" className="settings-label">First Name</label>
                  <input
                    type="text"
                    id="settings-fname"
                    value={profileForm.firstName}
                    onChange={(e) => handleProfileChange('firstName', e.target.value)}
                    className="settings-input"
                    placeholder="Enter first name"
                    disabled={hasActiveApp}
                    minLength={2}
                    maxLength={50}
                    required
                  />
                </div>
                <div className="settings-form-group settings-form-group-mi">
                  <label htmlFor="settings-minitial" className="settings-label">
                    M.I. <span style={{ fontWeight: 'normal', color: '#64748b', fontSize: '11px' }}>(Opt)</span>
                  </label>
                  <input
                    type="text"
                    id="settings-minitial"
                    value={profileForm.middleInitial}
                    onChange={(e) => handleProfileChange('middleInitial', e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 1))}
                    className="settings-input"
                    placeholder="e.g. M"
                    disabled={hasActiveApp}
                    maxLength={1}
                  />
                </div>
                <div className="settings-form-group">
                  <label htmlFor="settings-lname" className="settings-label">Last Name</label>
                  <input
                    type="text"
                    id="settings-lname"
                    value={profileForm.lastName}
                    onChange={(e) => handleProfileChange('lastName', e.target.value)}
                    className="settings-input"
                    placeholder="Enter last name"
                    disabled={hasActiveApp}
                    minLength={2}
                    maxLength={50}
                    required
                  />
                </div>
              </div>

              <div className="settings-form-group">
                <div className="settings-label-row">
                  <label className="settings-label">Email Address (Login Identifier)</label>
                  <button
                    type="button"
                    className="settings-change-email-btn"
                    onClick={() => setIsChangeEmailOpen(true)}
                  >
                    <i className="bx bx-edit-alt" /> Change Email
                  </button>
                </div>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="settings-input"
                  title="Click 'Change Email' to securely update your email address"
                />

                {/* Pending Email Notice Banner */}
                {pendingEmail && (
                  <div className="settings-pending-email-card">
                    <div className="settings-pending-email-header">
                      <span className="settings-pending-badge">
                        <i className="bx bx-time-five" /> Verification Pending
                      </span>
                      <div className="settings-pending-actions">
                        <button
                          type="button"
                          className="settings-pending-btn resend"
                          onClick={handleResendEmailChange}
                          disabled={emailActionLoading}
                          title="Resend verification link to your new inbox"
                        >
                          <i className={`bx ${emailActionLoading ? 'bx-loader-alt bx-spin' : 'bx-refresh'}`} />
                          {emailActionLoading ? 'Resending...' : 'Resend'}
                        </button>
                        <button
                          type="button"
                          className="settings-pending-btn cancel"
                          onClick={handleCancelEmailChange}
                          disabled={emailActionLoading}
                          title="Cancel this pending request"
                        >
                          <i className="bx bx-x" /> Cancel
                        </button>
                      </div>
                    </div>
                    <div className="settings-pending-email-text">
                      A verification link was dispatched to <strong>{pendingEmail}</strong>. Please click the confirmation link in your new inbox within 24 hours to finalize this change.
                    </div>
                  </div>
                )}
              </div>

              <div className="settings-actions">
                <button
                  type="submit"
                  className="settings-btn-primary"
                  disabled={profileLoading || !hasProfileChanges}
                >
                  {profileLoading ? (
                    <>
                      <i className="bx bx-loader-alt bx-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <i className="bx bx-save" /> Save Profile Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── Card 2: Security & Password ── */}
          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon">
                <i className="bx bx-lock-alt" />
              </div>
              <div>
                <h2 className="settings-card-title">Security & Password</h2>
                <p className="settings-card-desc">Change your password by entering your current valid password.</p>
              </div>
            </div>

            {passMsg.text && (
              <div className={`settings-alert ${passMsg.type === 'error' ? 'settings-alert-error' : 'settings-alert-success'}`}>
                <i className={`bx ${passMsg.type === 'error' ? 'bx-error-circle' : 'bx-check-circle'}`} style={{ fontSize: '18px' }} />
                <span>{passMsg.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              {/* Current Password */}
              <div className="settings-form-group">
                <label htmlFor="settings-curr-pass" className="settings-label">Current Password</label>
                <div className="settings-password-wrapper">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    id="settings-curr-pass"
                    value={passForm.currentPassword}
                    onChange={(e) => handlePassChange('currentPassword', e.target.value)}
                    className="settings-input"
                    placeholder="Enter current valid password"
                    required
                  />
                  <button
                    type="button"
                    className="settings-password-toggle"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    tabIndex="-1"
                    aria-label="Toggle password visibility"
                  >
                    <i className={`bx ${showCurrentPass ? 'bx-show' : 'bx-hide'}`} />
                  </button>
                </div>
              </div>

              <div className="settings-form-row">
                {/* New Password */}
                <div className="settings-form-group">
                  <label htmlFor="settings-new-pass" className="settings-label">New Password</label>
                  <div className="settings-password-wrapper">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      id="settings-new-pass"
                      value={passForm.newPassword}
                      onChange={(e) => handlePassChange('newPassword', e.target.value)}
                      className="settings-input"
                      placeholder="Enter new strong password"
                      minLength={8}
                      maxLength={64}
                      required
                    />
                    <button
                      type="button"
                      className="settings-password-toggle"
                      onClick={() => setShowNewPass(!showNewPass)}
                      tabIndex="-1"
                      aria-label="Toggle password visibility"
                    >
                      <i className={`bx ${showNewPass ? 'bx-show' : 'bx-hide'}`} />
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="settings-form-group">
                  <label htmlFor="settings-conf-pass" className="settings-label">Confirm New Password</label>
                  <div className="settings-password-wrapper">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      id="settings-conf-pass"
                      value={passForm.confirmPassword}
                      onChange={(e) => handlePassChange('confirmPassword', e.target.value)}
                      className="settings-input"
                      placeholder="Re-enter new password"
                      minLength={8}
                      maxLength={64}
                      required
                    />
                    <button
                      type="button"
                      className="settings-password-toggle"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      tabIndex="-1"
                      aria-label="Toggle password visibility"
                    >
                      <i className={`bx ${showConfirmPass ? 'bx-show' : 'bx-hide'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Real-time Password Requirements */}
              <div className="settings-requirements-grid">
                <div className={`settings-req-item ${passChecks.length ? 'met' : 'unmet'}`}>
                  <i className={`bx ${passChecks.length ? 'bx-check-circle' : 'bx-circle'}`} />
                  <span>8+ Characters</span>
                </div>
                <div className={`settings-req-item ${passChecks.uppercase ? 'met' : 'unmet'}`}>
                  <i className={`bx ${passChecks.uppercase ? 'bx-check-circle' : 'bx-circle'}`} />
                  <span>Uppercase (A-Z)</span>
                </div>
                <div className={`settings-req-item ${passChecks.lowercase ? 'met' : 'unmet'}`}>
                  <i className={`bx ${passChecks.lowercase ? 'bx-check-circle' : 'bx-circle'}`} />
                  <span>Lowercase (a-z)</span>
                </div>
                <div className={`settings-req-item ${passChecks.numSpecial ? 'met' : 'unmet'}`}>
                  <i className={`bx ${passChecks.numSpecial ? 'bx-check-circle' : 'bx-circle'}`} />
                  <span>Number & Special</span>
                </div>
              </div>

              {/* Password match indicator */}
              {passForm.confirmPassword.length > 0 && (
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: passwordsMatch ? '#16a34a' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '14px'
                }}>
                  <i className={`bx ${passwordsMatch ? 'bx-check' : 'bx-x'}`} />
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </div>
              )}

              {/* Same as current password indicator */}
              {passForm.currentPassword && passForm.newPassword && passForm.currentPassword === passForm.newPassword && (
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '14px'
                }}>
                  <i className="bx bx-error" />
                  New password must be different from current password
                </div>
              )}

              <div className="settings-actions">
                <button
                  type="submit"
                  className="settings-btn-primary"
                  disabled={passLoading}
                >
                  {passLoading ? (
                    <>
                      <i className="bx bx-loader-alt bx-spin" /> Updating Password...
                    </>
                  ) : (
                    <>
                      <i className="bx bx-key" /> Update Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── Card 3: Delete Account ── */}
          <div className="settings-card settings-card-danger">
            <div className="settings-card-header">
              <div className="settings-card-icon settings-card-icon-danger">
                <i className="bx bx-trash" />
              </div>
              <div>
                <h2 className="settings-card-title settings-card-title-danger">Delete Account</h2>
                <p className="settings-card-desc">Permanently remove your applicant profile and associated personal data. This action is irreversible.</p>
              </div>
            </div>

            <div className="settings-danger-body">
              {hasActiveApp ? (
                <div className="settings-danger-alert">
                  <div className="settings-danger-alert-content">
                    <i className="bx bx-error-circle" />
                    <span>
                      You have an active application in progress{activeAppTitle ? ` for "${activeAppTitle}"` : ''}. You must withdraw your application before you can delete your account.
                    </span>
                  </div>
                  <a href="/application-status" className="settings-danger-link-btn">
                    View Application <i className="bx bx-right-arrow-alt" />
                  </a>
                </div>
              ) : (
                <div className="settings-danger-row">
                  <div className="settings-danger-row-text">
                    <span className="settings-danger-row-title">Delete account and profile</span>
                    <span className="settings-danger-row-desc">
                      Remove your profile credentials, uploaded documents, and platform access.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="settings-btn-danger"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Delete Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <ToastPortal />
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
        cancelText={confirmModalState.cancelText}
        type={confirmModalState.type}
        onConfirm={confirmModalState.onConfirm}
        onCancel={closeConfirmModal}
      />

      <ChangeEmailModal
        isOpen={isChangeEmailOpen}
        onClose={() => setIsChangeEmailOpen(false)}
        currentEmail={userEmail}
        userId={user.id || user.user_id || user.User_ID || 0}
        onSuccess={handleEmailChangeSuccess}
      />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        userId={user?.id || user?.user_id || user?.User_ID || 0}
        userEmail={userEmail}
        onSuccess={handleDeleteAccountSuccess}
      />

      <LoadingScreen
        isOpen={isLoggingOut}
        title="Signing Out"
        subtitle="Clearing your session and redirecting..."
      />

      <LoadingScreen
        isOpen={isResendingEmail}
        title="Resending Verification Link..."
        subtitle={`Please wait while we dispatch a fresh confirmation link to ${pendingEmail}.`}
      />
    </div>
  );
};

export default Settings;
