import React from 'react';
import expressPayLogo from '../../../assets/images/company partners/expressPay.webp';
import lbcLogo        from '../../../assets/images/company partners/lbc.webp';
import partner1       from '../../../assets/images/company partners/Screenshot 2026-07-26 181903.webp';
import partner2       from '../../../assets/images/company partners/Screenshot 2026-07-26 181924.webp';
import partner3       from '../../../assets/images/company partners/Screenshot 2026-07-26 182017.webp';
import partner4       from '../../../assets/images/company partners/Screenshot 2026-07-26 182029.webp';
import partner5       from '../../../assets/images/company partners/Screenshot 2026-07-26 182046.webp';
import partner6       from '../../../assets/images/company partners/Screenshot 2026-07-26 182104.webp';
import partner7       from '../../../assets/images/company partners/Screenshot 2026-07-26 182137.webp';
import partner8       from '../../../assets/images/company partners/Screenshot 2026-07-26 182233.webp';
import partner9       from '../../../assets/images/company partners/Screenshot 2026-07-26 182435.webp';

const partnerLogos = [
  expressPayLogo, lbcLogo,
  partner1, partner2, partner3, partner4, partner5,
  partner6, partner7, partner8, partner9,
];

/**
 * Scrolling brand / recruitment-partner logos carousel.
 */
const PartnersCarousel = () => (
  <section className="brand-carousel-section">
    <h2 className="brand-carousel-title">Our Company Partners</h2>
    <div className="brand-carousel-container">
      <div className="brand-carousel-track">
        {[...partnerLogos, ...partnerLogos].map((logo, index) => (
          <div key={index} className="brand-card">
            <img
              src={logo}
              alt={`Partner brand ${index + 1}`}
              className="brand-card-img"
              loading="lazy"
              decoding="async"
              width="120"
              height="50"
            />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PartnersCarousel;
