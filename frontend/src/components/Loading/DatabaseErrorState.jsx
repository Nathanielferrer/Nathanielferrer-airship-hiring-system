import React from 'react';
import './LoadingStyles.css';

/**
 * Reusable Database Offline / API Connection Error card with one-click Retry button.
 * @param {string} title - Error heading
 * @param {string} message - Explanatory message
 * @param {Function} onRetry - Function to re-trigger data fetch
 * @param {boolean} isRetrying - Whether retry action is currently executing
 */
const DatabaseErrorState = ({
  title = 'Database Connection Issue',
  message = 'Unable to establish a connection with the server or database. Please ensure your MySQL service is active and try again.',
  onRetry,
  isRetrying = false
}) => {
  return (
    <div className="db-error-card">
      <div className="db-error-icon-wrap">
        <i className="bx bx-server" />
      </div>
      <h4 className="db-error-title">{title}</h4>
      <p className="db-error-message">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="db-error-btn-retry"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <i
            className={`bx ${isRetrying ? 'bx-loader-alt bx-spin' : 'bx-refresh'}`}
            style={{ fontSize: '18px' }}
          />
          {isRetrying ? 'Reconnecting...' : 'Retry Connection'}
        </button>
      )}
    </div>
  );
};

export default DatabaseErrorState;
