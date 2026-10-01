import React from 'react';
import './LoadingStyles.css';

/**
 * Modern In-Card Loading state with branded dual-ring glowing spinner.
 * @param {string} title - Heading text
 * @param {string} subtitle - Subtitle/contextual text
 * @param {string} minHeight - Optional min height
 */
const DataLoadingState = ({
  title = 'Loading Data...',
  subtitle = 'Please wait a moment while the system synchronizes records.',
  minHeight = '320px'
}) => {
  return (
    <div className="data-loading-card" style={{ minHeight }}>
      <div className="data-loading-spinner-wrap">
        <span className="data-loading-spinner-ring" />
        <span className="data-loading-spinner-ring" />
        <span className="data-loading-spinner-core" />
      </div>
      <h4 className="data-loading-title">{title}</h4>
      {subtitle && <p className="data-loading-subtitle">{subtitle}</p>}
    </div>
  );
};

export default DataLoadingState;
