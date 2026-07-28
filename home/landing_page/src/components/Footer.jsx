import React from 'react';
import { scrollToContactSection } from '../utils/scrollToContact';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="fbar">
        <p>© 2026 Lumi Car Spa · 16/35 Coonara Ave, West Pennant Hills NSW 2125</p>
        <div className="footer-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms</a>
          <a href="#contact" onClick={scrollToContactSection}>
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
