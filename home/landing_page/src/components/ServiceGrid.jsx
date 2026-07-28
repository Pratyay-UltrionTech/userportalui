import React from 'react';
import carImg from '../assets/image copy.png';
import img6 from '../assets/vaccume.png';
import img7 from '../assets/windowcleaining.jpg';
import img9 from '../assets/polish.jpg';
import addonServicesBanner from '../assets/addon-services-banner.png';
import tireShineFormerImg from '../assets/head.png';
import { CoffeeIcon } from './CoffeeIcon';
import './ServiceGrid.css';

const services = [
  {
    id: 1,
    name: 'Hand Car Wash',
    img: carImg,
    className: 'sc tall'
  },
  {
    id: 2,
    name: 'Interior Vacuuming',
    img: img6,
    className: 'sc'
  },
  {
    id: 3,
    name: 'Window Cleaning',
    img: img7,
    className: 'sc'
  },
  {
    id: 4,
    name: 'Tire Shining',
    img: addonServicesBanner,
    className: 'sc'
  },
  {
    id: 5,
    name: 'Premium Detailing Packages',
    img: img9,
    className: 'sc'
  }
];

const ServiceGrid = () => {
  return (
    <>
      <div className="strip">
        <span className="stag">COMPLIMENTARY</span>
        <div>
          <p>
            Relax with a complimentary coffee
            <span className="strip-coffee-icon-inline" aria-hidden="true">
              <CoffeeIcon size={16} />
            </span>
            {' '}— available on selected services.
          </p>
        </div>
      </div>

      <section className="sec service-section sec-alt-white" id="svc">
        <div className="lbl">Our Services</div>
        <h2>Choose Your Level of Luxury</h2>
        <p className="sub">Done entirely by hand — no machine brushes, no shortcuts. Skilled care and premium eco-friendly products every time.</p>
        <div className="sg">
          {services.map((svc) => (
            <div key={svc.id} className={svc.className}>
              <img src={svc.img} alt={svc.name} />
              <div className="so">
                <div className="sname">{svc.name}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="addon-banner">
          <img src={tireShineFormerImg} alt="Tire shine and detailing" />
          <div className="addon-banner-ov">
            <h3 className="addon-banner-title">Add-On Services</h3>
          </div>
        </div>
      </section>
    </>
  );
};

export default ServiceGrid;
