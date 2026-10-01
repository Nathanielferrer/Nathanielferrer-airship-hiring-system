import React, { useState, useCallback } from 'react';
import { ToastContainer } from './ToastNotification';

/**
 * useToast — Universal Standard Toast Notification Hook
 * Provides consistent, high-fidelity card toast notifications across
 * Applicant, Admin, and Superadmin dashboards.
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((msg, type = 'success', title = null, duration = 3500) => {
    const message = typeof msg === 'object' ? (msg.message || msg.title || '') : String(msg || '');
    const toastType = typeof msg === 'object' ? (msg.type || type) : type;
    const toastTitle = typeof msg === 'object' ? (msg.title || title) : title;
    const toastDuration = typeof msg === 'object' && msg.duration !== undefined ? msg.duration : duration;
    const id = Date.now() + Math.random().toString(36).substring(2, 9);

    setToasts((prev) => [...prev, { id, message, type: toastType, title: toastTitle, duration: toastDuration }]);
    return id;
  }, []);

  const ToastPortal = useCallback(() => {
    return <ToastContainer toasts={toasts} onClose={removeToast} />;
  }, [toasts, removeToast]);

  return { toasts, showToast, removeToast, ToastPortal };
};

export default useToast;
