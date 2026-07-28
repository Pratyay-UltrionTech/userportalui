export const BRAND_NAME = "Lumi Car Spa";
export const BRAND_NAME_SHORT = "Lumi";
/** Central public asset — copy stays in sync under each app's `public/branding/`. */
export const LOGO_PATH = "/branding/company-logo.png";
export const TAGLINE = "Your Hills Shine Specialist · West Pennant Hills";

/** Display headings — matches landing / hero (Bebas Neue). */
export const HEADING_FONT_FAMILY = "'Bebas Neue', sans-serif";
export const headingFontStyle = { fontFamily: HEADING_FONT_FAMILY, fontWeight: 400, letterSpacing: "0.03em" } as const;

/** Hero / landing sticky nav — keep booking pages in sync with `home/landing_page/Navbar.css`. */
export const LANDING_NAV_HEIGHT = "clamp(84px, 10vh, 96px)";
export const landingNavBrandNameStyle = {
  fontFamily: HEADING_FONT_FAMILY,
  fontSize: "clamp(22px, 1.65rem, 28px)",
  fontWeight: 400,
  letterSpacing: "0.04em",
  lineHeight: 1.2,
} as const;
export const landingNavTaglineStyle = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: "clamp(12px, 0.85rem, 14px)",
  fontWeight: 500,
  letterSpacing: "1.5px",
  lineHeight: 1.35,
  marginTop: 3,
} as const;
/** Muted navy for tagline on white app headers (hero uses gold on navy background). */
export const landingNavTaglineLightColor = "#4f627a";
