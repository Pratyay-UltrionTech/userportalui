import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../../src/app/context/AuthContext';
import { API_BASE } from '../../../../src/app/lib/apiBase';
import { normalizeLandingCatalogService } from '../../../../src/app/lib/catalogServiceNormalize';
import { ServicePricingCard } from '../../../../src/app/components/ServicePricingCard';
import './PricingSection.css';

function IconCar({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h10l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
    </svg>
  );
}
function IconTruck({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11v15M16 3h3l3 4v5h-6V3z"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  );
}
function IconCarFront({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2"/>
      <path d="M3 8h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/>
      <path d="M7 14h.01M17 14h.01"/><path d="M8 11h8"/>
    </svg>
  );
}
function IconChevronLeft({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}
function IconChevronRight({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

const SCROLL_THRESHOLD = 8;

function getCarouselVisibleCount() {
  if (typeof window === 'undefined') return 1;
  if (window.matchMedia('(min-width: 768px)').matches) return 3;
  return 1;
}

function useCarouselVisibleCount() {
  const [visibleCount, setVisibleCount] = useState(getCarouselVisibleCount);

  useEffect(() => {
    const mqMd = window.matchMedia('(min-width: 768px)');
    const sync = () => setVisibleCount(getCarouselVisibleCount());
    sync();
    mqMd.addEventListener('change', sync);
    return () => mqMd.removeEventListener('change', sync);
  }, []);

  return visibleCount;
}

const NAVY = '#0c1d3a';

function getVehicleIcon(type) {
  const key = String(type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Keep UTE/truck-like types distinct from SUV so tabs don't show identical icons.
  if (/ute|truck|pickup|van/.test(key)) return IconTruck;
  if (/suv|4wd/.test(key)) return IconCar;
  if (/sedan|saloon/.test(key)) return IconCarFront;
  return IconCar;
}

const PricingSection = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleBookNow = (e) => {
    e.preventDefault();
    signOut();
    navigate('/home');
  };

  const [vehicleBlocks, setVehicleBlocks] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [activeTab, setActiveTab] = useState('wash');
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const scrollerRef = useRef(null);
  /** After arrow crosses Wash ↔ Detailing: scroll to first or last card (not always 0). */
  const pendingTabScrollRef = useRef(null);
  const visibleCardCount = useCarouselVisibleCount();

  useEffect(() => {
    (async () => {
      try {
        const branchRes = await fetch(`${API_BASE}/public/branches`);
        if (!branchRes.ok) throw new Error('Failed to load branches');
        const branches = await branchRes.json();
        if (!branches.length) return;
        const branchId = branches[0].id;
        const blocksRes = await fetch(`${API_BASE}/public/branches/${branchId}/vehicle-blocks`);
        if (!blocksRes.ok) throw new Error('Failed to load services');
        const blocks = await blocksRes.json();
        setVehicleBlocks(blocks);
        if (blocks.length) setSelectedVehicle(blocks[0].vehicle_type);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const allServices = useMemo(() => {
    const block = vehicleBlocks.find((b) => b.vehicle_type === selectedVehicle);
    if (!block) return [];
    return block.services
      .filter((s) => s.active && s.catalog_group_id)
      .map((s) => normalizeLandingCatalogService(s))
      .sort((a, b) => a.sequence - b.sequence);
  }, [vehicleBlocks, selectedVehicle]);

  const washServices = useMemo(
    () => allServices.filter((s) => (s.category?.toLowerCase() || '') !== 'detailing'),
    [allServices],
  );
  const detailServices = useMemo(
    () => allServices.filter((s) => (s.category?.toLowerCase() || '') === 'detailing'),
    [allServices],
  );
  const hasDetailing = detailServices.length > 0;
  const activeServices = activeTab === 'wash' ? washServices : detailServices;

  useEffect(() => {
    if (!activeServices.length) {
      setSelectedServiceId(null);
      return;
    }
    setSelectedServiceId((prev) => {
      if (prev && activeServices.some((s) => s.id === prev)) return prev;
      const recommended = activeServices.find((s) => s.recommended === true);
      return (recommended ?? activeServices[0]).id;
    });
  }, [activeServices]);

  const updateScrollBtns = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }
    setCanScrollPrev(el.scrollLeft > SCROLL_THRESHOLD);
    setCanScrollNext(el.scrollLeft < el.scrollWidth - el.clientWidth - SCROLL_THRESHOLD);
  }, []);

  const getCards = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return [];
    const track = el.firstElementChild;
    return track ? Array.from(track.children) : [];
  }, []);

  const maxScrollIdx = useCallback(
    (cardLen) => Math.max(0, cardLen - visibleCardCount),
    [visibleCardCount],
  );

  const scrollToIdx = useCallback((idx) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = getCards();
    if (!cards.length) return;
    const pad = cards[0].offsetLeft;
    const i = Math.max(0, Math.min(maxScrollIdx(cards.length), idx));
    el.scrollTo({ left: cards[i].offsetLeft - pad, behavior: 'smooth' });
  }, [getCards, maxScrollIdx]);

  /** Scroll to an exact card (used when crossing tabs — e.g. land on last Wash card). */
  const scrollToCardIndex = useCallback((idx) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = getCards();
    if (!cards.length) return;
    const pad = cards[0].offsetLeft;
    const i = Math.max(0, Math.min(cards.length - 1, idx));
    el.scrollTo({ left: cards[i].offsetLeft - pad, behavior: 'smooth' });
  }, [getCards]);

  const getCurrentIdx = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const cards = getCards();
    if (!cards.length) return 0;
    const pad = cards[0].offsetLeft;
    let idx = 0;
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].offsetLeft - pad <= el.scrollLeft + 1) idx = i;
      else break;
    }
    return Math.min(maxScrollIdx(cards.length), idx);
  }, [getCards, maxScrollIdx]);

  const doScrollPrev = useCallback(() => {
    const current = getCurrentIdx();
    if (current > 0) {
      scrollToIdx(current - 1);
      return;
    }
    if (activeTab === 'detail' && washServices.length > 0) {
      pendingTabScrollRef.current = 'last';
      setActiveTab('wash');
    }
  }, [scrollToIdx, getCurrentIdx, activeTab, washServices.length]);

  const doScrollNext = useCallback(() => {
    const cards = getCards();
    const current = getCurrentIdx();
    const maxIdx = maxScrollIdx(cards.length);
    if (current < maxIdx) {
      scrollToIdx(current + 1);
      return;
    }
    if (activeTab === 'wash' && hasDetailing && detailServices.length > 0) {
      pendingTabScrollRef.current = 'first';
      setActiveTab('detail');
    }
  }, [scrollToIdx, getCurrentIdx, getCards, maxScrollIdx, activeTab, hasDetailing, detailServices.length]);

  const canGoLeft = canScrollPrev || activeTab === 'detail';
  const canGoRight = canScrollNext || (activeTab === 'wash' && hasDetailing);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const pending = pendingTabScrollRef.current;
    pendingTabScrollRef.current = null;

    const applyInitialScroll = () => {
      const cards = getCards();
      if (!cards.length) {
        updateScrollBtns();
        return;
      }
      if (pending === 'last') {
        scrollToCardIndex(cards.length - 1);
      } else {
        el.scrollLeft = 0;
      }
      updateScrollBtns();
    };

    if (pending) {
      requestAnimationFrame(() => requestAnimationFrame(applyInitialScroll));
    } else {
      el.scrollLeft = 0;
      setCanScrollPrev(false);
      setCanScrollNext(false);
      requestAnimationFrame(() => requestAnimationFrame(updateScrollBtns));
    }
  }, [activeTab, selectedVehicle, updateScrollBtns, getCards, scrollToCardIndex]);

  useEffect(() => {
    let ro = null;
    const t = requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (!el) return;
      ro = new ResizeObserver(updateScrollBtns);
      ro.observe(el);
      updateScrollBtns();
    });
    return () => {
      cancelAnimationFrame(t);
      ro?.disconnect();
    };
  }, [activeTab, activeServices.length, selectedVehicle, visibleCardCount, updateScrollBtns]);

  return (
    <section className="ps-section sec sec-alt-cream" id="pricing">
      <div className="ps-section-inner">
        <h2>Service Pricing</h2>

        {loading && (
          <div className="ps-loading">
            <div className="ps-spinner" />
            <span>Loading services…</span>
          </div>
        )}

        {error && (
          <div className="ps-error">
            Unable to load live pricing. <a href="#/home" onClick={handleBookNow}>Book online</a> to see all services.
          </div>
        )}

        {!loading && !error && vehicleBlocks.length > 0 && (
          <div className="ps-panel">
            <div className="ps-panel-toolbar">
              <div className="ps-toolbar-block ps-toolbar-block--vehicles">
                <div className="ps-vehicles" role="group" aria-label="Select vehicle type">
                  {vehicleBlocks.map((b) => {
                    const Icon = getVehicleIcon(b.vehicle_type);
                    const isSelected = selectedVehicle === b.vehicle_type;
                    return (
                      <button
                        key={b.vehicle_type}
                        type="button"
                        className={`ps-vbtn${isSelected ? ' ps-vbtn--active' : ''}`}
                        onClick={() => { setSelectedVehicle(b.vehicle_type); setActiveTab('wash'); }}
                        aria-pressed={isSelected}
                      >
                        <Icon size={15} color={isSelected ? '#fff' : NAVY} />
                        <span>{b.vehicle_type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {hasDetailing ? (
                <div className="ps-toolbar-block ps-toolbar-block--tabs">
                  <div className="ps-tabs" role="tablist" aria-label="Service category">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'wash'}
                      className={`ps-tab${activeTab === 'wash' ? ' ps-tab--active' : ''}`}
                      onClick={() => setActiveTab('wash')}
                    >
                      Wash
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'detail'}
                      className={`ps-tab${activeTab === 'detail' ? ' ps-tab--active' : ''}`}
                      onClick={() => setActiveTab('detail')}
                    >
                      Detailing
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ps-panel-body">
              {activeServices.length > 0 ? (
                <div className="ps-carousel-wrap">
                  <button
                    type="button"
                    className={`ps-arrow ps-arrow--prev${!canGoLeft ? ' ps-arrow--disabled' : ''}`}
                    onClick={doScrollPrev}
                    disabled={!canGoLeft}
                    aria-label="Previous services"
                  >
                    <IconChevronLeft size={20} color={NAVY} />
                  </button>
                  <div className="ps-clip">
                    <div
                      ref={scrollerRef}
                      className="ps-scroller"
                      onScroll={updateScrollBtns}
                    >
                      <div className="ps-track">
                        {activeServices.map((svc) => (
                          <div key={svc.id} className="ps-slide">
                            <ServicePricingCard
                              title={svc.name}
                              price={svc.price}
                              durationMinutes={svc.durationMinutes}
                              descriptionPoints={svc.descriptionPoints}
                              excludedPoints={svc.excludedPoints}
                              recommended={svc.recommended === true}
                              freeCoffeeCount={svc.freeCoffeeCount}
                              eligibleForLoyaltyPoints={svc.eligibleForLoyaltyPoints === true}
                              takeawayCoffeeIcon
                              isSelected={selectedServiceId === svc.id}
                              onClick={() => setSelectedServiceId(svc.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`ps-arrow ps-arrow--next${!canGoRight ? ' ps-arrow--disabled' : ''}`}
                    onClick={doScrollNext}
                    disabled={!canGoRight}
                    aria-label="Next services"
                  >
                    <IconChevronRight size={20} color={NAVY} />
                  </button>
                </div>
              ) : (
                <p className="ps-empty">
                  No {activeTab === 'wash' ? 'wash' : 'detailing'} services available for this vehicle type.
                </p>
              )}
            </div>

            {activeServices.length > 0 ? (
              <div className="ps-panel-footer">
                <a href="#/home" className="ps-book-btn" onClick={handleBookNow}>Book Now</a>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
};

export default PricingSection;
