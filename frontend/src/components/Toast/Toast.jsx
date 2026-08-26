import React, { useState, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import './Toast.css';

/**
 * useToast — Universal standard toast notification
 */
const useToast = () => {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const message = typeof msg === 'object' ? (msg.message || msg.title || '') : msg;
    const toastType = typeof msg === 'object' ? (msg.type || type) : type;

    setToast({ message, type: toastType });

    timerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const ToastPortal = () => {
    if (!toast) return null;

    return ReactDOM.createPortal(
      <div className={`system-toast system-toast--${toast.type || 'success'}`}>
        <i
          className={`bx ${
            toast.type === 'error' || toast.type === 'danger'
              ? 'bx-error-circle'
              : 'bx-check-circle'
          }`}
          style={{ fontSize: '20px' }}
        />
        <span>{toast.message}</span>
      </div>,
      document.body
    );
  };

  return { showToast, ToastPortal };
};

export default useToast;

