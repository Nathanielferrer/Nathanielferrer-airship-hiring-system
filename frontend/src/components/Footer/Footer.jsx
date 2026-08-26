import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import logoImg from '../../assets/images/Logo Airship Express.png';
import './Footer.css';

/**
 * Shared Professional Web Footer for Applicant-facing pages.
 * Features brand info, navigation links (Home, Vacancy, About Us),
 * and social media icon links (Facebook, TikTok, Instagram).
 * Navigation buttons trigger a smooth scroll-to-top animation.
 */
const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (path) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (location.pathname !== path) {
      // Let the scroll animation start before navigating
      setTimeout(() => navigate(path), 80);
    }
  };

  return (
    <footer className="professional-footer">
      <div className="footer-container">
        {/* Brand Section */}
        <div className="footer-brand-col">
          <div className="footer-brand-header">
            <img src={logoImg} alt="Airship Express" className="footer-logo-img" />
            <span className="footer-brand-title">AIRSHIP EXPRESS</span>
          </div>
          <p className="footer-brand-tagline">
            Next-generation logistics &amp; career portal. Delivering excellence across the Philippines.
          </p>
        </div>

        {/* Navigation Links */}
        <div className="footer-nav-col">
          <ul className="footer-nav-list">
            <li><button className="footer-nav-btn" onClick={() => handleNavClick('/applicant-dashboard')}>Home</button></li>
            <li><button className="footer-nav-btn" onClick={() => handleNavClick('/vacancy')}>Vacancy</button></li>
            <li><button className="footer-nav-btn" onClick={() => handleNavClick('/about')}>About Us</button></li>
          </ul>
        </div>

        {/* Contact & Social Section */}
        <div className="footer-social-col">
          <h4 className="footer-col-title">Contact & Connect</h4>
          <div className="footer-contact-info" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: '#cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className='bx bx-phone' style={{ color: '#e6007e', fontSize: '16px' }}></i>
              <span><strong>Number:</strong> 0945 441 8789</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className='bx bx-envelope' style={{ color: '#e6007e', fontSize: '16px' }}></i>
              <span><strong>Email:</strong> airshipexpress.admin@gmail.com</span>
            </div>
          </div>
          <div className="footer-social-links">
            {/* Facebook Link */}
            <a
              href="https://www.facebook.com/profile.php?id=61571986650033"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-icon-btn facebook"
              aria-label="Facebook"
              title="Airship Express on Facebook"
            >
              <i className='bx bxl-facebook' style={{ fontSize: '20px' }}></i>
            </a>

            {/* TikTok Link */}
            <a
              href="https://www.tiktok.com/@hrivie?fbclid=IwY2xjawTo0klwZG9mBWV4dG4DYWVtAjEwAGJyaWQRMVE4TFNNTXpKVXMxZHY2MVFzcnRjBmFwcF9pZBAyMjIwMzkxNzg4MjAwODkyAAEe7j3vJtxzsuvDqysA93XHYPmNP08WR-lhxe2-ZnPvUc3oLR1TIQY8CH0wEwI_aem_UZ7bFuAXbHQEuX66e2jbKA"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-icon-btn tiktok"
              aria-label="TikTok"
              title="Airship Express on TikTok"
            >
              <i className='bx bxl-tiktok' style={{ fontSize: '20px' }}></i>
            </a>

            {/* Instagram Link */}
            <a
              href="https://www.instagram.com/airshipexpresss?fbclid=IwY2xjawTo0jVwZG9mBWV4dG4DYWVtAjEwAGJyaWQRMVE4TFNNTXpKVXMxZHY2MVFzcnRjBmFwcF9pZBAyMjIwMzkxNzg4MjAwODkyAAEeg3U7fdvjFEBm2e2nMnOSEv6HWH9-VXnWo8FOlpCjWOKl4Cd2OG32Pf3G7_k_aem_U2vQKTF402TPgnRdecbbfQ"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-icon-btn instagram"
              aria-label="Instagram"
              title="Airship Express on Instagram"
            >
              <i className='bx bxl-instagram' style={{ fontSize: '20px' }}></i>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom-bar">
        <div className="footer-bottom-container">
          <span>&copy; {new Date().getFullYear()} Airship Express Logistics. All rights reserved.</span>
          <span className="footer-bottom-tag">Precision in every delivery.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
