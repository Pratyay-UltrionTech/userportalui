import React, { useEffect, useRef, useState } from 'react';
import { scrollToContactSection } from '../utils/scrollToContact';
import './FAQ.css';

const FAQ_SECTIONS = [
  {
    id: 'booking',
    title: 'Booking',
    items: [
      {
        q: 'Can I book a car wash online?',
        a: 'Yes — online booking is the fastest and easiest way to secure your spot at Lumi Car Spa. Visit lumicarspa.com.au any time — day or night — to choose your service, pick a time that suits you, and confirm your booking instantly. No phone calls, no waiting. You can also reach us via WhatsApp (0449 957 777), email (lumicarspa@gmail.com), phone call, or simply walk in.',
      },
      {
        q: 'Do I need to book ahead or can I walk in?',
        a: 'Walk-ins are always welcome during opening hours (Mon–Sun, 9am–5pm). However, for detailing or custom packages, booking in advance online is recommended to guarantee your preferred time slot — especially on weekends.',
      },
      {
        q: 'How do I contact Lumi Car Spa?',
        a: 'Phone: 0449 957 777 | WhatsApp: 0449 957 777 | Email: lumicarspa@gmail.com | Book online: lumicarspa.com.au',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing & Member Deals',
    items: [
      {
        q: 'Is Lumi Car Spa the cheapest car wash in the Hills District?',
        a: 'Yes. Lumi Car Spa offers the most competitive pricing for premium hand car washing and detailing across the entire Hills District — including West Pennant Hills, Castle Hill, Cherrybrook, Pennant Hills, Thornleigh, Beecroft, and surrounding suburbs. Unlike automated car washes that use harsh brushes damaging paintwork, Lumi Car Spa delivers a genuine hand wash by trained experts at unbeatable prices. As a member, your prices get even better.',
      },
      {
        q: 'What discounts and deals do members get?',
        a: 'Signing up as a Lumi Car Spa member unlocks exclusive benefits including discount coupons, day-specific offers, seasonal promotions, free coffee every visit, and your 10th wash FREE. New deals and offers are added regularly. Membership is completely free.',
      },
      {
        q: 'How do I access member coupons and offers?',
        a: 'Once you sign up through the Lumi Car Spa app or website, all active coupons and day-specific offers are displayed in your member dashboard. Simply show your phone to the team on arrival to redeem any current deal.',
      },
    ],
  },
  {
    id: 'custom-packages',
    title: 'Custom Packages',
    items: [
      {
        q: 'Can I customise my car wash or detailing package?',
        a: 'Absolutely. Every car is different, and services are tailored to exactly what your vehicle needs. The expert on-site team can build a custom package combining any mix of: hand exterior wash, interior vacuum, window cleaning, tyre dressing, full detailing, paint protection, and seat & upholstery cleaning. Just drive in or email lumicarspa@gmail.com ahead of time to discuss requirements and get a quote.',
      },
      {
        q: "Do you have expert staff who can assess my car's needs?",
        a: "Yes. The on-site team includes experienced car care professionals who can assess your vehicle's condition, identify problem areas, and recommend the right treatment — with no obligation, just honest advice.",
      },
      {
        q: 'How long does a custom detailing package take?',
        a: 'A standard hand wash takes 20–40 minutes. Add-ons like vacuuming and window cleaning add 15–20 minutes. Full detailing packages can take 2–4 hours. A clear time estimate is given before starting so you can plan your day.',
      },
    ],
  },
  {
    id: 'home-service',
    title: 'Home Service',
    items: [
      {
        q: 'Do you offer home or mobile car wash service?',
        a: 'Yes — Lumi Car Spa now offers home car wash service, bringing the professional hand wash directly to your driveway. To check availability, timings, and pricing for your area, contact via WhatsApp (0449 957 777) or email lumicarspa@gmail.com. Primary service areas include West Pennant Hills, Pennant Hills, Cherrybrook, Castle Hill, Beecroft, and Carlingford.',
      },
      {
        q: 'How do I enquire about home service pricing and availability?',
        a: 'The easiest way is via WhatsApp (0449 957 777) — send your suburb, vehicle type, and preferred day/time. You can also email lumicarspa@gmail.com and the team will get back to you promptly with availability and a quote.',
      },
    ],
  },
  {
    id: 'loyalty',
    title: 'Loyalty & Perks',
    items: [
      {
        q: 'How does the loyalty program work?',
        a: 'Every 10th wash is completely FREE. Sign up through the Lumi Car Spa app or in-store and your washes are tracked automatically — no stamps, no paper cards. The free wash is applied at the same service level as your regular visits.',
      },
      {
        q: 'Do I get free coffee every time I visit?',
        a: 'Yes. Through a partnership with Sunny Side Cafe, all Lumi Car Spa members enjoy a complimentary coffee on every visit. Drop your car off, grab your coffee, and relax while the team takes care of the rest.',
      },
      {
        q: 'How do I sign up for Lumi Car Spa membership?',
        a: 'Sign up at lumicarspa.com.au or ask the team in-store. Membership is completely free and gives instant access to your loyalty wash tracker, the free coffee perk, and all member-exclusive coupons and deals from your very first visit.',
      },
    ],
  },
  {
    id: 'services',
    title: 'Services',
    items: [
      {
        q: 'What services does Lumi Car Spa offer?',
        a: 'Lumi Car Spa offers premium hand car washing, interior vacuuming, window cleaning, tyre dressing, and full detailing packages. All services are carried out by hand using eco-safe, car-safe products. Custom packages tailored to your vehicle are also available.',
      },
      {
        q: 'Why is a hand car wash better than an automatic car wash?',
        a: "Automatic car washes use rotating brushes and high-pressure machines that can cause micro-scratches and swirl marks on paintwork over time. A hand car wash uses trained staff, soft microfibre cloths, and carefully chosen products — cleaning gently and thoroughly, reaching areas machines miss, and protecting the vehicle's finish long-term.",
      },
    ],
  },
  {
    id: 'location',
    title: 'Location & Hours',
    items: [
      {
        q: 'Where is Lumi Car Spa located?',
        a: '16/35 Coonara Avenue, West Pennant Hills NSW 2125 — conveniently close to local shops, cafes, and the Sunny Side Cafe.',
      },
      {
        q: 'What are your opening hours?',
        a: '7 days a week, Monday to Sunday, 9am – 5pm. Public holiday hours may vary — call ahead on 0449 957 777 to confirm.',
      },
      {
        q: 'Which suburbs near West Pennant Hills do you serve?',
        a: 'The car wash location serves customers from across the Hills District including West Pennant Hills, Pennant Hills, Cherrybrook, Castle Hill, Beecroft, Carlingford, Thornleigh, Dural, Rouse Hill, and Kellyville. The home service also covers these suburbs.',
      },
    ],
  },
  {
    id: 'products',
    title: 'Products & Safety',
    items: [
      {
        q: 'What products do you use? Are they safe for my car?',
        a: 'Only eco-safe, car-safe, pH-neutral products are used — gentle on paintwork, clear coats, rubber seals, and interior surfaces while delivering a thorough clean. No harsh chemicals, no abrasives.',
      },
      {
        q: 'Will a hand wash scratch my paint?',
        a: "No. The team uses soft microfibre cloths and a two-bucket wash method to minimise any risk of scratching or swirl marks. Done by trained professionals with the right products, a hand wash is the safest method for your car's paintwork.",
      },
    ],
  },
  {
    id: 'about',
    title: 'About Lumi Car Spa',
    items: [
      {
        q: 'Is Lumi Car Spa under new management?',
        a: 'Yes. Lumi Car Spa is the rebranded business formerly known as Coonara Professional Hand Car Wash. Under new management, every aspect of the experience has been elevated — better products, custom packages, member deals, home service, and free coffee — at the same trusted Coonara Avenue location the community has relied on for 4+ years.',
      },
      {
        q: 'How can I leave a Google review for Lumi Car Spa?',
        a: 'Search "Lumi Car Spa" on Google Maps and tap "Write a review." Your review helps other Hills District locals find a trusted hand car wash and helps the team keep improving.',
      },
    ],
  },
];

function useCollapsibleHeight(isOpen, deps = []) {
  const innerRef = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const updateHeight = () => {
      setHeight(isOpen ? el.scrollHeight : 0);
    };

    updateHeight();

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, ...deps]);

  return { innerRef, height };
}

function FAQQuestion({ item, entryId, isOpen, onToggle }) {
  const { innerRef, height } = useCollapsibleHeight(isOpen, [item.a]);

  return (
    <div className={`faq-entry${isOpen ? ' faq-entry--open' : ''}`}>
      <button
        type="button"
        className="faq-entry-trigger"
        aria-expanded={isOpen}
        aria-controls={`faq-panel-${entryId}`}
        id={`faq-trigger-${entryId}`}
        onClick={onToggle}
      >
        <span className="faq-entry-q">{item.q}</span>
        <span className="faq-entry-toggle" aria-hidden="true" />
      </button>
      <div
        id={`faq-panel-${entryId}`}
        role="region"
        aria-labelledby={`faq-trigger-${entryId}`}
        className="faq-entry-panel"
        style={{ '--faq-panel-h': `${height}px` }}
      >
        <div ref={innerRef} className="faq-entry-panel-inner">
          <p>{item.a}</p>
        </div>
      </div>
    </div>
  );
}

function FAQSectionBlock({ section, isOpen, onToggle, openQuestionKey, onQuestionToggle }) {
  const { innerRef, height } = useCollapsibleHeight(isOpen, [section.items.length, openQuestionKey]);

  return (
    <div className={`faq-section-block${isOpen ? ' faq-section-block--open' : ''}`}>
      <button
        type="button"
        className="faq-section-trigger"
        aria-expanded={isOpen}
        aria-controls={`faq-section-panel-${section.id}`}
        id={`faq-section-trigger-${section.id}`}
        onClick={onToggle}
      >
        <span className="faq-section-trigger-label">{section.title}</span>
        <span className="faq-section-toggle" aria-hidden="true" />
      </button>
      <div
        id={`faq-section-panel-${section.id}`}
        role="region"
        aria-labelledby={`faq-section-trigger-${section.id}`}
        className="faq-section-panel"
        style={{ '--faq-panel-h': `${height}px` }}
      >
        <div ref={innerRef} className="faq-section-panel-inner">
          {section.items.map((item, index) => {
            const entryId = `${section.id}-${index}`;
            return (
              <FAQQuestion
                key={entryId}
                item={item}
                entryId={entryId}
                isOpen={openQuestionKey === entryId}
                onToggle={() => onQuestionToggle(entryId)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

const FAQ = () => {
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [openQuestionKey, setOpenQuestionKey] = useState(null);

  const toggleSection = (sectionId) => {
    if (activeSectionId === sectionId) {
      setActiveSectionId(null);
      setOpenQuestionKey(null);
      return;
    }
    setActiveSectionId(sectionId);
    setOpenQuestionKey(null);
  };

  const toggleQuestion = (entryId) => {
    setOpenQuestionKey((prev) => (prev === entryId ? null : entryId));
  };

  return (
    <section className="sec faq-section sec-alt-cream" id="faq" aria-labelledby="faq-heading">
      <div className="faq-shell">
        <aside className="faq-intro">
          <p className="lbl">Got questions?</p>
          <h2 id="faq-heading" className="faq-heading">
            Answers before<br />you visit
          </h2>
          <p className="faq-intro-text">
            Choose a topic, then tap a question to read the answer.
          </p>
          <p className="faq-intro-hint">
            <a href="#contact" className="faq-intro-link" onClick={scrollToContactSection}>
              Contact us
            </a>{' '}
            if you need more help.
          </p>
        </aside>

        <div className="faq-nested" aria-label="FAQ topics">
          {FAQ_SECTIONS.map((section) => (
            <FAQSectionBlock
              key={section.id}
              section={section}
              isOpen={activeSectionId === section.id}
              onToggle={() => toggleSection(section.id)}
              openQuestionKey={openQuestionKey}
              onQuestionToggle={toggleQuestion}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
