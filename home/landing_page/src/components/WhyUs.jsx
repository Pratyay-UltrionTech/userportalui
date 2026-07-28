import React from 'react';

import carImg from '../assets/hone2.jpg';
import './WhyUs.css';

const WhyUs = () => {
  return (
    <section className="sec why-layout sec-alt-white" id="why">
      <div className="wi-wrap">
        <img className="wi" src={carImg} alt="Detailing" />
        <div className="wbadge">
          <div className="wbn">100%</div>
          <div className="wbl">Eco & car-safe<br />products every time</div>
        </div>
      </div>
      <div>
        <div className="lbl">Why Choose Lumi</div>
        <h2>Handcrafted care,<br />every single wash</h2>
        <p className="sub">Not a drive-through. Every car washed by hand by people who care about the result as much as you do.</p>
        <div className="wps">
          <div className="wp">
            <div className="wpic g">🌿</div>
            <div>
              <h3>Eco-Friendly & Car-Safe Products</h3>
              <p>Biodegradable, non-toxic formulas gentle on your paint and safe for the environment.</p>
            </div>
          </div>
          <div className="wp">
            <div className="wpic go">✋</div>
            <div>
              <h3>Genuine Hand Wash — No Machines</h3>
              <p>Every panel washed by hand with premium microfibre cloths. No scratching, no swirl marks.</p>
            </div>
          </div>
          <div className="wp">
            <div className="wpic g">💎</div>
            <div>
              <h3>Luxury Treatment for Every Car</h3>
              <p>Hatchback or prestige — every car receives the same meticulous showroom finish.</p>
            </div>
          </div>
          <div className="wp">
            <div className="wpic b">🏘️</div>
            <div>
              <h3>Your Local Community Business</h3>
              <p>Based in West Pennant Hills, serving West Pennant Hills. Your dollars stay local.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyUs;
