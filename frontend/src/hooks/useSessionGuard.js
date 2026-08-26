import { useEffect } from 'react';

/**
 * useSessionGuard — Real-Time Session Termination Hook
 *
 * Polls check_session.php every 10 seconds.
 * If Super Admin deletes or resets an admin account, the active session is
 * immediately terminated and the browser is hard-redirected to /login.
 *
 * Security Standards: ISO 27001 A.8.5, OWASP A07
 */
const useSessionGuard = () => {
  useEffect(() => {
    const POLL_INTERVAL_MS = 3500; // 3.5 seconds for rapid termination

    const checkSession = async () => {
      // Read user_id from localStorage
      const savedUser = localStorage.getItem('hiring_user');
      if (!savedUser) {
        return;
      }

      let userId = null;
      try {
        const parsed = JSON.parse(savedUser);
        userId = parsed?.id || parsed?.User_ID || parsed?.sub;
      } catch (err) {
        console.error('[SessionGuard] Failed to parse hiring_user:', err);
        return;
      }

      if (!userId) {
        return;
      }

      try {
        const response = await fetch(
          'http://localhost/Hiring%20System/backend/auth/check_session.php',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
          }
        );

        // Read raw text first — if response is not JSON (PHP error), log it
        const rawText = await response.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch {
          console.error('[SessionGuard] Non-JSON response from check_session.php:', rawText);
          return; 
        }

        // Hard redirect bypasses React Router state issues
        if (data.status === 'account_deleted') {
          localStorage.removeItem('hiring_token');
          localStorage.removeItem('hiring_user');
          sessionStorage.clear();
          window.location.href = '/login?reason=account_deleted';

        } else if (data.status === 'account_deactivated') {
          // Super Admin deactivated (soft-disabled) this account
          localStorage.removeItem('hiring_token');
          localStorage.removeItem('hiring_user');
          sessionStorage.clear();
          window.location.href = '/login?reason=account_deactivated';

        } else if (data.status === 'password_reset_required') {
          localStorage.removeItem('hiring_token');
          localStorage.removeItem('hiring_user');
          sessionStorage.clear();
          window.location.href = '/login?reason=password_reset';
          
        } else if (data.status === 'invalid_token') {
          // If the token itself is rejected (tampered/expired)
          if (localStorage.getItem('hiring_token')) {
            localStorage.removeItem('hiring_token');
            localStorage.removeItem('hiring_user');
            sessionStorage.clear();
            window.location.href = '/login';
          }
        }
        // 'valid' and 'error' statuses: do nothing

      } catch (err) {
        console.error('[SessionGuard] Network error:', err.message);
      }
    };

    // Run immediately on mount
    checkSession();

    // Poll every 3.5 seconds
    const intervalId = setInterval(checkSession, POLL_INTERVAL_MS);

    // Also check immediately when window gains focus or tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkSession();
    };
    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', checkSession);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
};

export default useSessionGuard;
