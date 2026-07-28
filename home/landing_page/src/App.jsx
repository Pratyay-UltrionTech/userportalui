import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ServiceGrid from './components/ServiceGrid';
import PricingSection from './components/PricingSection';
import WhyUs from './components/WhyUs';
import Neighborhood from './components/Neighborhood';
import CoffeePromise from './components/CoffeePromise';
import Testimonial from './components/Testimonial';
import FAQ from './components/FAQ';
import ContactForm from './components/ContactForm';
import Footer from './components/Footer';

function App() {
  return (
    <div className="landing-page App">
      <Navbar />
      <Hero />
      <ServiceGrid />
      <PricingSection />
      <WhyUs />
      <Neighborhood />
      <CoffeePromise />
      <Testimonial />
      <FAQ />
      <ContactForm />
      <Footer />
    </div>
  );
}

export default App;
