/** Sticky landing nav height — keep scroll targets below the header. */
function getLandingNavOffset() {
  const navHeight = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--landing-nav-height') || '88',
    10,
  );
  return Number.isNaN(navHeight) ? 88 : navHeight;
}

/** Smooth-scroll to any landing section, offset for sticky nav. */
export function scrollToLandingSection(sectionId, event) {
  event?.preventDefault();
  const section = document.getElementById(sectionId);
  if (!section) return;
  const top = section.getBoundingClientRect().top + window.scrollY - getLandingNavOffset();
  window.scrollTo({ top, behavior: 'smooth' });
}

/** Smooth-scroll to the contact form, offset for sticky landing nav. */
export function scrollToContactSection(event) {
  scrollToLandingSection('contact', event);
}
