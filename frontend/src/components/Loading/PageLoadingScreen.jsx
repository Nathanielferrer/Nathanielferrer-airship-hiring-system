import React from 'react';
import logoImg from '../../assets/images/only_logo.webp';
import './LoadingStyles.css';

/**
 * Full-page application loader for authentication guards and route transitions.
 */
const PageLoadingScreen = ({
  title = 'Airship Express',
  subtitle = 'Initializing secure workspace...'
}) => {
  return (
    <div className="page-loader-overlay">
      <div className="page-loader-content">
        <img
          src={logoImg}
          alt="Airship Express"
          className="page-loader-brand-logo"
          decoding="async"
          width="64"
          height="64"
        />
        <div className="page-loader-progress-track">
          <div className="page-loader-progress-bar" />
        </div>
        <h3 className="page-loader-title">{title}</h3>
        <p className="page-loader-subtitle">{subtitle}</p>
      </div>
    </div>
  );
};

export default PageLoadingScreen;
