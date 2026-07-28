import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './Testimonial.css';

const REVIEWS = [
  {
    initials: 'JA',
    name: 'Jorja Alexandrov',
    role: 'Verified customer',
    text:
      'I just had my car washed, and they did an amazing job in a short amount of time. The staff was really nice, and the price was very reasonable. I\'ll definitely be coming back again.',
  },
  {
    initials: 'JC',
    name: 'James Carpenter',
    role: 'Verified customer',
    text:
      'They did a great job on my ute — inside and outside, plus a polish to remove marks I hadn\'t been able to get off for ages. The price was very good too.',
  },
  {
    initials: 'RV',
    name: 'Robert V',
    role: 'Verified customer',
    text:
      'Exceptional customer service! Raj was very friendly, polite, and started on time. Great value for money — I got exactly what I paid for with the full detail service. Highly recommended!',
  },
  {
    initials: 'ME',
    name: 'Mystiqulae E',
    role: 'Verified customer',
    text:
      'Quick, easy, and efficient car wash in a nice little spot by the shopping village. Raj and the team were both pleasant, and the prices are very fair compared to other big-name car washes. Highly recommend.',
  },
  {
    initials: 'PT',
    name: 'Phil Tierney',
    role: 'Verified customer',
    text:
      'Outstanding service. I just got my car back from them, and it looks brand new. I purchased the premium package and will definitely be doing so again. Tremendous value and great service.',
  },
];

const AUTO_INTERVAL_MS = 2500;
const SWIPE_THRESHOLD_PX = 48;

function buildVisibleSlots(activeIndex) {
  const len = REVIEWS.length;
  const prevIdx = (activeIndex - 1 + len) % len;
  const nextIdx = (activeIndex + 1) % len;
  return [
    { review: REVIEWS[prevIdx], position: 'prev', index: prevIdx },
    { review: REVIEWS[activeIndex], position: 'active', index: activeIndex },
    { review: REVIEWS[nextIdx], position: 'next', index: nextIdx },
  ];
}

function TestimonialCard({ review, position, onSelect }) {
  const isActive = position === 'active';

  return (
    <article
      className={`t-card t-card--${position}`}
      aria-hidden={!isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => {
        if (!isActive) onSelect();
      }}
      onKeyDown={(e) => {
        if (!isActive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="t-quote" aria-hidden="true">
        &ldquo;
      </span>
      <div className="tst" aria-label="5 out of 5 stars">
        ★★★★★
      </div>
      <p className="tt">{review.text}</p>
      <footer className="ta">
        <div className="tav" aria-hidden="true">
          {review.initials}
        </div>
        <div className="ta-meta">
          <div className="tan">{review.name}</div>
          <div className="tar">{review.role}</div>
        </div>
      </footer>
    </article>
  );
}

const Testimonial = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(null);
  const timerRef = useRef(null);

  const goTo = useCallback((index) => {
    const next = ((index % REVIEWS.length) + REVIEWS.length) % REVIEWS.length;
    setActiveIndex(next);
  }, []);

  const goNext = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const goPrev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  const visibleSlots = useMemo(() => buildVisibleSlots(activeIndex), [activeIndex]);

  useEffect(() => {
    if (isPaused) return undefined;
    timerRef.current = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % REVIEWS.length);
    }, AUTO_INTERVAL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isPaused]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  return (
    <section
      className="sec tsec sec-alt-white"
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsPaused(false);
      }}
    >
      <header className="t-head">
        <div className="lbl">What Locals Are Saying</div>
        <h2>Our community loves us</h2>
      </header>

      <div
        className="t-stage"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="t-row" key={activeIndex}>
          {visibleSlots.map(({ review, position, index }) => (
            <TestimonialCard
              key={`${index}-${position}`}
              review={review}
              position={position}
              onSelect={() => goTo(index)}
            />
          ))}
        </div>
      </div>

      <div className="tdots" role="tablist" aria-label="Choose a review">
        {REVIEWS.map((r, i) => (
          <button
            key={r.initials + r.name}
            type="button"
            role="tab"
            aria-selected={i === activeIndex}
            aria-label={`Show review from ${r.name}`}
            className={`tdot ${i === activeIndex ? 'tdot-active' : ''}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </section>
  );
};

export default Testimonial;
