import React from 'react';
import expressPayLogo from '../../../assets/images/company partners/expressPay.png';
import gcashLogo      from '../../../assets/images/company partners/gcash.png';
import lbcLogo        from '../../../assets/images/company partners/lbc.png';
import partner1       from '../../../assets/images/company partners/Screenshot 2026-07-26 181903.png';
import partner2       from '../../../assets/images/company partners/Screenshot 2026-07-26 181924.png';
import partner3       from '../../../assets/images/company partners/Screenshot 2026-07-26 182017.png';
import partner4       from '../../../assets/images/company partners/Screenshot 2026-07-26 182029.png';
import partner5       from '../../../assets/images/company partners/Screenshot 2026-07-26 182046.png';
import partner6       from '../../../assets/images/company partners/Screenshot 2026-07-26 182104.png';
import partner7       from '../../../assets/images/company partners/Screenshot 2026-07-26 182137.png';
import partner8       from '../../../assets/images/company partners/Screenshot 2026-07-26 182233.png';
import partner9       from '../../../assets/images/company partners/Screenshot 2026-07-26 182435.png';

const partnerLogos = [
  expressPayLogo, gcashLogo, lbcLogo,
  partner1, partner2, partner3, partner4, partner5,
  partner6, partner7, partner8, partner9,
];

/**
 * Scrolling brand / recruitment-partner logos carousel.
 */
const PartnersCarousel = () => (
  <section className="brand-carousel-section">
    <h2 className="brand-carousel-title">Our Recruitment Partners</h2>
    <div className="brand-carousel-container">
      <div className="brand-carousel-track">
        {[...partnerLogos, ...partnerLogos].map((logo, index) => (
          <div key={index} className="brand-card">
            <img src={logo} alt={`Partner brand ${index + 1}`} className="brand-card-img" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PartnersCarousel;
