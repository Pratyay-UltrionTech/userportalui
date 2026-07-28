import React, { useState } from 'react';
import { API_BASE } from '../../../../src/app/lib/apiBase';
import { CoffeeIcon } from './CoffeeIcon';
import './ContactForm.css';

const ContactForm = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'success' | 'error'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() && !phone.trim() && !service.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch(`${API_BASE}/public/contact-inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          service: service.trim(),
          preferred_date: preferredDate,
        }),
      });
      if (!res.ok) throw new Error('server error');
      setStatus('success');
      setName('');
      setPhone('');
      setEmail('');
      setService('');
      setPreferredDate('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <section className="sec csec" id="contact">
      <div className="cgrid">
        <div className="contact-info">
          <div className="lbl lbldk">Find Us & Get in Touch</div>
          <h2 className="dk" style={{ marginBottom: '1.75rem' }}>Visit us in<br />West Pennant Hills</h2>

          <div className="cir">
            <div className="cic">📍</div>
            <div>
              <div className="cil">Address</div>
              <div className="civ">16/35 Coonara Avenue<br />West Pennant Hills NSW 2125</div>
            </div>
          </div>

          <div className="cir">
            <div className="cic">📞</div>
            <div>
              <div className="cil">Phone</div>
              <div className="civ">+61 449 957 777</div>
            </div>
          </div>

          <div className="cir">
            <div className="cic">✉️</div>
            <div>
              <div className="cil">Email</div>
              <div className="civ">lumicarspa@gmail.com</div>
            </div>
          </div>

          <div className="cir">
            <div className="cic">🕐</div>
            <div>
              <div className="cil">Hours</div>
              <div className="civ">Monday – Sunday: 9:00am – 5:00pm</div>
            </div>
          </div>

          <div className="cir">
            <div className="cic" style={{ color: 'rgba(255,255,255,0.9)' }}>
              <CoffeeIcon size={20} />
            </div>
            <div>
              <div className="cil">Free Coffee</div>
              <div className="civ">Included with selected wash</div>
            </div>
          </div>
        </div>

        <div className="qf">
          <h3>Get a Free Quote</h3>

          {status === 'success' ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '40px 24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px' }}>✅</div>
              <p style={{ color: '#fff', fontWeight: 600, fontSize: '17px', margin: 0 }}>
                Inquiry sent successfully!
              </p>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                We'll get back to you shortly.
              </p>
              <button
                onClick={() => setStatus('idle')}
                style={{
                  marginTop: '8px',
                  padding: '10px 28px',
                  background: 'transparent',
                  border: '1px solid #94a3b8',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="fr">
                <label>Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="fr">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 0400 000 000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s()-]/g, ''))}
                  required
                />
              </div>
              <div className="fr">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="fr">
                <label>Service Required</label>
                <input
                  type="text"
                  placeholder="e.g. Exterior Hand Wash & Dry"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                />
              </div>
              <div className="fr fr--date">
                <label>Preferred Date</label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                />
              </div>

              {status === 'error' && (
                <p style={{ color: '#f87171', fontSize: '13px', margin: '0 0 12px', textAlign: 'center' }}>
                  Something went wrong. Please try again or contact us directly.
                </p>
              )}

              <button type="submit" className="fsub" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Submit'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
