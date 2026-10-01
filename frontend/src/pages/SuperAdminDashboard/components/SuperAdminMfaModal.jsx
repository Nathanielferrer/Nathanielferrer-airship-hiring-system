import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

import { API_BASE_URL } from '../../../utils/apiConfig';
const SuperAdminMfaModal = ({ isOpen, onClose, user, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [mfaStatus, setMfaStatus] = useState(null); // { totp_enabled: bool, backup_codes_remaining: int }
  const [setupStep, setSetupStep] = useState('status'); // 'status', 'setup', 'backup_view', 'disable'
  
  // Setup data
  const [secret, setSecret] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Disable data
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const userId = user?.id || user?.user_id || user?.User_ID;

  // Fetch status whenever modal opens
  useEffect(() => {
    if (!isOpen || !userId) return;
    fetchStatus();
  }, [isOpen, userId]);

  const fetchStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/super_admin_mfa.php?action=get_status&user_id=${userId}`);
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setMfaStatus(data);
        setSetupStep(data.totp_enabled ? 'status' : 'start');
      } else {
        setError(data.message || 'Failed to fetch 2FA status.');
      }
    } catch {
      setError('Network error fetching 2FA status.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/super_admin_mfa.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_secret', user_id: userId })
      });
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Could not generate setup key.');
      }

      setSecret(data.secret);
      setOtpauthUri(data.otpauth_uri);
      setBackupCodes(data.backup_codes || []);
      setConfirmCode('');

      // Generate QR Code image
      try {
        const url = await QRCode.toDataURL(data.otpauth_uri, {
          width: 220,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' }
        });
        setQrDataUrl(url);
      } catch (qrErr) {
        console.error('QR code generation error:', qrErr);
      }

      setSetupStep('setup');
    } catch (err) {
      setError(err.message || 'Setup error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSetup = async (e) => {
    e.preventDefault();
    if (confirmCode.trim().length !== 6) {
      setError('Please enter the 6-digit code shown in Google Authenticator.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/super_admin_mfa.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'confirm_setup', 
          user_id: userId, 
          code: confirmCode.trim() 
        })
      });
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Verification failed.');
      }

      if (showToast) showToast('Two-Factor Authentication successfully enabled!', 'success');
      setMfaStatus({ totp_enabled: true, backup_codes_remaining: backupCodes.length });
      setSetupStep('backup_view'); // Show backup codes to save
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMfa = async (e) => {
    e.preventDefault();
    if (!disablePassword || !disableCode) {
      setError('Please enter both your password and a current verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/auth/super_admin_mfa.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disable',
          user_id: userId,
          password: disablePassword,
          code: disableCode.trim()
        })
      });
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to disable 2FA.');
      }

      if (showToast) showToast('Two-Factor Authentication has been disabled.', 'info');
      setMfaStatus({ totp_enabled: false, backup_codes_remaining: 0 });
      setSetupStep('start');
      setDisablePassword('');
      setDisableCode('');
    } catch (err) {
      setError(err.message || 'Disable error.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackupCodes = () => {
    const text = "AIRSHIP EXPRESS - SUPER ADMIN BACKUP RECOVERY CODES\n" +
                 "Keep these codes in a safe, offline place. Each can be used once.\n\n" +
                 backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '460px',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        border: '1px solid #e2e8f0',
        fontFamily: "'Poppins', 'Inter', sans-serif"
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderTopLeftRadius: '14px',
          borderTopRightRadius: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🛡️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>
                Two-Factor Authentication (TOTP 2FA)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Google Authenticator & Root Password Recovery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '22px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* ── STATE 1: Status (Already Enabled) ── */}
          {setupStep === 'status' && mfaStatus?.totp_enabled && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                margin: '0 auto 16px'
              }}>
                ✓
              </div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a', fontWeight: '700' }}>
                Two-Factor Authentication is Active
              </h4>
              <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#64748b', lineHeight: '1.6' }}>
                Your Super Administrator account is secured with Google Authenticator. Password resets require your 6-digit code or an emergency backup code.
              </p>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 18px',
                textAlign: 'left',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#475569' }}>Emergency Backup Codes:</span>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                    {mfaStatus.backup_codes_remaining} remaining
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => setSetupStep('disable')}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    background: '#fff1f2',
                    color: '#e11d48',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Disable 2FA
                </button>
              </div>
            </div>
          )}

          {/* ── STATE 2: Start Setup (Not Enabled) ── */}
          {setupStep === 'start' && (
            <div>
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <strong style={{ color: '#1e40af', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                  Protect the Root Super Administrator
                </strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#1e3a8a', lineHeight: '1.6' }}>
                  Two-factor authentication adds an essential layer of security. In addition to your password, you will use the free <strong>Google Authenticator</strong> app on your smartphone to authorize password resets and privileged operations.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#334155' }}>
                  <span style={{ background: '#e0e7ff', color: '#4338ca', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</span>
                  <span>Install Google Authenticator from Google Play Store or App Store.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#334155' }}>
                  <span style={{ background: '#e0e7ff', color: '#4338ca', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</span>
                  <span>Scan the QR code shown on screen using your phone's camera.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#334155' }}>
                  <span style={{ background: '#e0e7ff', color: '#4338ca', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</span>
                  <span>Enter the 6-digit confirmation code and save your 8 backup codes.</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartSetup}
                  disabled={loading}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #e6007e 0%, #db2777 100%)',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(230, 0, 126, 0.3)'
                  }}
                >
                  {loading ? 'Preparing...' : 'Set Up Google Authenticator'}
                </button>
              </div>
            </div>
          )}

          {/* ── STATE 3: Setup QR Code & Code Confirmation ── */}
          {setupStep === 'setup' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>
                  Open <strong>Google Authenticator</strong>, tap the <strong>+</strong> button, and scan this QR code:
                </p>

                {qrDataUrl ? (
                  <div style={{
                    display: 'inline-block',
                    padding: '10px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}>
                    <img src={qrDataUrl} alt="2FA QR Code" style={{ width: '160px', height: '160px', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Loading QR...
                  </div>
                )}

                {/* Secret key for manual entry */}
                <div style={{ marginTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Cannot scan? Enter setup key manually:</span>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: '#0f172a',
                    letterSpacing: '1px',
                    marginTop: '2px',
                    userSelect: 'all'
                  }}>
                    {secret}
                  </div>
                </div>
              </div>

              {/* Form to enter 6 digits */}
              <form onSubmit={handleConfirmSetup}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#1e293b', marginBottom: '6px', textAlign: 'center' }}>
                    Enter the 6-Digit Code from Your Phone:
                  </label>
                  <input
                    type="text"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '22px',
                      letterSpacing: '6px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontFamily: 'monospace',
                      borderRadius: '8px',
                      border: '2px solid #e6007e',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setSetupStep('start')}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || confirmCode.length !== 6}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: confirmCode.length === 6 ? '#e6007e' : '#cbd5e1',
                      color: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      cursor: confirmCode.length === 6 ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── STATE 4: Backup Codes Display ── */}
          {setupStep === 'backup_view' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '32px' }}>🎉</span>
                <h4 style={{ margin: '8px 0 4px 0', fontSize: '17px', color: '#0f172a', fontWeight: '700' }}>
                  2FA Activated! Save Your Emergency Backup Codes
                </h4>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: '1.5' }}>
                  If you ever lose or break your phone, each of these 8 codes can be used <strong>once</strong> to authorize password recovery.
                </p>
              </div>

              {/* Codes Grid */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                marginBottom: '16px'
              }}>
                {backupCodes.map((code, idx) => (
                  <div key={idx} style={{
                    fontFamily: 'monospace',
                    fontSize: '13.5px',
                    fontWeight: 'bold',
                    color: '#1e293b',
                    textAlign: 'center',
                    background: '#ffffff',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    letterSpacing: '1px'
                  }}>
                    {code}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleCopyBackupCodes}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #e6007e',
                    background: '#ffffff',
                    color: '#e6007e',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {copied ? '✓ Copied to Clipboard!' : '📋 Copy All Codes'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  I Have Saved My Codes
                </button>
              </div>
            </div>
          )}

          {/* ── STATE 5: Disable 2FA Form ── */}
          {setupStep === 'disable' && (
            <form onSubmit={handleDisableMfa}>
              <div style={{
                background: '#fff1f2',
                border: '1px solid #fecaca',
                padding: '14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                color: '#991b1b',
                marginBottom: '16px'
              }}>
                <strong>Warning:</strong> Disabling Two-Factor Authentication leaves the root Super Admin account protected only by password.
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Current Password:
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="login-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  6-Digit Authenticator or Backup Code:
                </label>
                <input
                  type="text"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  className="login-input"
                  placeholder="000000"
                  style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSetupStep('status')}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#e11d48',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {loading ? 'Disabling...' : 'Confirm Disable 2FA'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default SuperAdminMfaModal;
