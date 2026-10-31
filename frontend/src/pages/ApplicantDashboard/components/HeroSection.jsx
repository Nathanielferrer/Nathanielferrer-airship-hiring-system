import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import bgDay from '../../../assets/images/Airship Exporess - BG.webp';
import bgNight from '../../../assets/images/Background_night.webp';

/**
 * Hero landing banner with CTA button navigating to Vacancies.
 * Displays dynamic personalized greeting for authenticated applicants vs guest callout.
 */
const HeroSection = ({ user }) => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  const getApplicantName = () => {
    if (!user) return '';
    const fname = (user.first_name || user.User_Fname || '').trim();
    const lname = (user.last_name || user.User_Lname || '').trim();
    const minit = (user.middle_initial || user.User_MInitial || user.middle_name || '').trim();

    if (fname || lname) {
      const midFormatted = minit ? (minit.endsWith('.') ? `${minit} ` : `${minit}. `) : '';
      return `${fname} ${midFormatted}${lname}`.trim();
    }
    return user.candidate_name || user.name || user.User_Name || user.email || '';
  };

  const applicantName = getApplicantName();
  const activeBg = isDarkMode ? bgNight : bgDay;

  return (
    <section className="hero-section">
      <img
        className="hero-image-bg"
        src={activeBg}
        alt="Hero Background"
        fetchPriority="high"
        decoding="async"
        width="1548"
        height="1016"
      />
      <div className="hero-overlay"></div>
      <div className="hero-content">
        <div className="hero-text-block">
          {applicantName ? (
            <h1 className="hero-title">
              Welcome,<br />
              <span className="hero-name-accent">{applicantName}</span>
            </h1>
          ) : (
            <h1 className="hero-title">Start Your Career<br />Journey</h1>
          )}
          <p className="hero-subtitle">
            Step into a career that always <br className="hero-br-desktop" />
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
