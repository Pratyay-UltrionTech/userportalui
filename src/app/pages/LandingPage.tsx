import { HelmetProvider } from 'react-helmet-async';
import LandingHeroApp from '../../../home/landing_page/src/App.jsx';
import '../../../home/landing_page/src/index.css';

export function LandingPage() {
  return (
    <HelmetProvider>
      <LandingHeroApp />
    </HelmetProvider>
  );
}
