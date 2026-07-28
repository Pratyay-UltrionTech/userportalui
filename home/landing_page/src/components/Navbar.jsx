import React, { useState } from 'react';
import { BRAND_NAME, TAGLINE } from '../../../../src/app/lib/branding';
import { AppLogo } from '../../../../src/app/components/AppLogo';
import { scrollToLandingSection } from '../utils/scrollToContact';
import './Navbar.css';

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (sectionId, event) => {
    scrollToLandingSection(sectionId, event);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="nb">
        <div className="ni">
          <AppLogo variant="landingNav" className="ni-logo" />
        </div>
        <div className="nn">
          {BRAND_NAME}
          <small>{TAGLINE}</small>
        </div>
      </div>
      <div className="nr">
        <button
          type="button"
          className="nmenu-toggle"
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="landing-mobile-nav"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <ul className="nl">
          <li><a href="#svc" onClick={(e) => handleNavClick('svc', e)}>Services</a></li>
          <li><a href="#pricing" onClick={(e) => handleNavClick('pricing', e)}>Pricing</a></li>
          <li><a href="#why" onClick={(e) => handleNavClick('why', e)}>Why Us</a></li>
          <li><a href="#nbhd" onClick={(e) => handleNavClick('nbhd', e)}>Community</a></li>
          <li><a href="#faq" onClick={(e) => handleNavClick('faq', e)}>FAQ</a></li>
          <li><a href="#contact" onClick={(e) => handleNavClick('contact', e)}>Contact</a></li>
        </ul>
        <a href="#/login" className="nbtn">Book Now</a>
      </div>
      <div
        id="landing-mobile-nav"
        className={`nmobile ${isMobileMenuOpen ? 'open' : ''}`}
      >
        <ul className="nmobile-list">
          <li><a href="#svc" onClick={(e) => handleNavClick('svc', e)}>Services</a></li>
          <li><a href="#pricing" onClick={(e) => handleNavClick('pricing', e)}>Pricing</a></li>
          <li><a href="#why" onClick={(e) => handleNavClick('why', e)}>Why Us</a></li>
          <li><a href="#nbhd" onClick={(e) => handleNavClick('nbhd', e)}>Community</a></li>
          <li><a href="#faq" onClick={(e) => handleNavClick('faq', e)}>FAQ</a></li>
          <li><a href="#contact" onClick={(e) => handleNavClick('contact', e)}>Contact</a></li>
          <li><a href="#/login" onClick={() => setIsMobileMenuOpen(false)}>Book Now</a></li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
