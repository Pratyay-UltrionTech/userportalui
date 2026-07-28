/**
 * Landing page brand config — plain JS so the Vite/esbuild pipeline
 * never needs to cross into the TypeScript src tree.
 *
 * BRAND_PHONE: E.164 digits only, no "+" or spaces.
 * Update this to the real business number.
 * Hero.jsx will also try to fetch the live branch phone from the API and
 * override this value at runtime if one is stored there.
 */
export const BRAND_PHONE = '61449957777';
