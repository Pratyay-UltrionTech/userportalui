/**
 * Canonical site origin for meta tags and JSON-LD.
 * Set VITE_SITE_URL in production (e.g. https://www.example.com) when the app is not served from that host.
 */
export function getSiteOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return String(window.location.origin).replace(/\/$/, '');
  }
  const v = import.meta.env.VITE_SITE_URL;
  if (typeof v === 'string' && v.trim()) {
    return v.trim().replace(/\/$/, '');
  }
  return 'https://www.coonaraprofessionalhandcarwash.com.au';
}

/** Resolve a Vite asset path (e.g. /assets/...) to an absolute URL. */
export function absoluteAssetUrl(assetPath, origin = getSiteOrigin()) {
  const p = String(assetPath || '').startsWith('/') ? String(assetPath) : `/${assetPath}`;
  return `${origin}${p}`;
}
