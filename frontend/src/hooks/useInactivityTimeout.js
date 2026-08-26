import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useInactivityTimeout — Session Auto-Timeout Hook
 *
 * Monitors user activity (mouse, keyboard, touch, scroll).
 * If no activity is detected for `timeoutMs`, calls `onTimeout()`.
 * At `warningMs` before timeout, sets `sessionExpiring = true` to show a warning.
 *
 * Usage: Admin and Super Admin dashboards only.
 * Security Standard: OWASP Session Management (30-minute idle timeout).
 *
 * @param {number}   timeoutMs  - Total inactivity duration before logout (default: 30 min)
 * @param {number}   warningMs  - How many ms before timeout to show warning (default: 2 min)
 * @param {Function} onTimeout  - Callback to call when the timeout fires (perform logout)
 * @returns {{ sessionExpiring: boolean, resetTimer: Function }}
 */
const useInactivityTimeout = ({
  timeoutMs = 30 * 60 * 1000,   // 30 minutes
  warningMs  = 2  * 60 * 1000,  // Show warning at 28 minutes
  onTimeout,
}) => {
  const [sessionExpiring, setSessionExpiring] = useState(false);
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    setSessionExpiring(false); // Dismiss warning if user resumes activity

    // Warning fires at (timeoutMs - warningMs) = 28 minutes
    warningRef.current = setTimeout(() => {
      setSessionExpiring(true);
    }, timeoutMs - warningMs);

    // Logout fires at timeoutMs = 30 minutes
    timeoutRef.current = setTimeout(() => {
      setSessionExpiring(false);
      if (typeof onTimeout === 'function') {
        onTimeout();
      }
    }, timeoutMs);
  }, [timeoutMs, warningMs, onTimeout, clearAllTimers]);

  useEffect(() => {
    // Activity events that reset the timer
    const ACTIVITY_EVENTS = [
      'mousemove',
      'mousedown',
      'keypress',
      'touchstart',
      'scroll',
      'click',
    ];

    // Throttle resets to once every 10 seconds to avoid performance issues on mousemove
    let lastReset = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 10000) {
        lastReset = now;
        resetTimer();
      }
    };

    // Attach all activity listeners
    ACTIVITY_EVENTS.forEach(event =>
      window.addEventListener(event, throttledReset, { passive: true })
    );

    // Start the initial timer on mount
    resetTimer();

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach(event =>
        window.removeEventListener(event, throttledReset)
      );
    };
  }, [resetTimer, clearAllTimers]);

  return { sessionExpiring, resetTimer };
};

export default useInactivityTimeout;
