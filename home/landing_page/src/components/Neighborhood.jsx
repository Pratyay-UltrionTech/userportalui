import React from 'react';
import './Neighborhood.css';

import imgCafe from '../assets/sunnyside.png';
import imgWoolies from '../assets/metro.webp';
import imgShops from '../assets/Backree.jpg';
import imgRelax from '../assets/grapacoffee.png';

const neighbors = [
  {
    icon: '☕',
    title: 'Sunnyside',
    desc: 'Enjoy your complimentary coffee nearby while your car is being cared for.',
    img: imgCafe,
    mapsUrl: 'https://maps.app.goo.gl/HQtwAzsNptEzWu1i6'
  },
  {
    icon: '🛒',
    title: 'Woolworths Metro',
    desc: 'Steps away — get your groceries done while we handle your car. Two errands, one trip.',
    img: imgWoolies,
    mapsUrl: 'https://maps.app.goo.gl/7xSgon7Z7NtAq83A6'
  },
  {
    icon: '🏪',
    title: 'Coonara Bakery',
    desc: 'Fresh bakes and a quick bite just around the corner while you wait.',
    img: imgShops,
    pos: 'top',
    mapsUrl: 'https://maps.app.goo.gl/eqvPUgXXMUAmAyRcA'
  },
  {
    icon: '🌿',
    title: 'Just Sit & Relax',
    desc: "Grab your coffee, sit outside. We'll call you when your car is gleaming.",
    img: imgRelax,
    pos: 'top',
    mapsUrl: 'https://maps.app.goo.gl/nfCmqeFuN32ZjAnH7?g_st=ic'
  }
];

const Neighborhood = () => {
  return (
    <section className="sec nbsec" id="nbhd">
      <div className="lbl lbldk">Your Neighbourhood</div>
      <h2 className="dk">Drop your car. Enjoy the precinct.</h2>
      <p className="sub subdk">At 16/35 Coonara Avenue you're steps from everything West Pennant Hills has to offer. Your wait time becomes your free time.</p>
      
      <div className="nbgrid">
        {neighbors.map((item, idx) => (
          <a
            key={idx}
            className="nc"
            href={item.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${item.title} in Google Maps`}
          >
            <img src={item.img} alt={item.title} style={{ objectPosition: item.pos || 'center' }} />
            <div className="nov">
              <div className="nic">{item.icon}</div>
              <div className="nt">{item.title}</div>
              <div className="nd">{item.desc}</div>
              <div className="nmh" aria-hidden="true">View on Maps ↗</div>
            </div>
          </a>
        ))}
      </div>

      <div className="nbcta">
        <a href="#/login" className="bg">Book Now</a>
        <p>Enjoy a complimentary coffee voucher with selected services, redeemable at our local café.</p>
      </div>
    </section>
  );
};

export default Neighborhood;
