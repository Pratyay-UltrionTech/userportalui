import React from 'react';
import { CoffeeIcon } from './CoffeeIcon';
import './CoffeePromise.css';

const CoffeePromise = () => {
  return (
    <section className="sec vsec sec-alt-cream">
      <div className="lbl" style={{ textAlign: 'center' }}>Included With Selected Wash</div>
      <h2 style={{ textAlign: 'center' }}>The Lumi Coffee Promise</h2>
      <p className="sub" style={{ margin: '0 auto', textAlign: 'center' }}>
        Complimentary coffee is available on selected services.
      </p>

      <div className="vc">
        <div className="vct">
          <div className="vct-head">
            <span className="vct-coffee-icon">
              <CoffeeIcon size={32} />
            </span>
            <div className="vct-lbl">COMPLIMENTARY</div>
          </div>
          <h3>Coffee on Us</h3>
          <p>
            Relax with a complimentary coffee — available on selected services.
          </p>
        </div>
        <div className="vd"></div>
        <div className="vcb">
          <div className="vi"><span>Included with:</span><strong>Eligible services</strong></div>
          <div className="vi"><span>Redeemable at:</span><strong>Our café partner</strong></div>
          <div className="vi"><span>No catch:</span><strong>Completely free</strong></div>
        </div>
      </div>
    </section>
  );
};

export default CoffeePromise;
