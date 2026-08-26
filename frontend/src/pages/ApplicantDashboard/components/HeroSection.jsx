import React from 'react';
import { useNavigate } from 'react-router-dom';
import bgImage from '../../../assets/images/Airship Exporess - BG.png';

/**
 * Hero landing banner with CTA button navigating to Vacancies.
 */
const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="hero-section">
      <img className="hero-image-bg" src={bgImage} alt="Hero Background" />
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <div className="hero-text-block">
          <h1 className="hero-title">Start Your Career<br />Journey</h1>
          <p className="hero-subtitle">
            Step into a career that always <br />
            keeps you moving forward
          </p>
          <button
            className="hero-cta-btn"
            onClick={() => navigate('/vacancy')}
            aria-label="Explore Openings"
          >
            <span className="hero-cta-main">Explore Openings</span>
            <span className="hero-cta-accent"></span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
