import { useEffect, useState } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  hydratePublicCatalogFromApi,
  getPublicCatalogState,
  subscribePublicCatalog,
} from '../lib/publicDataStore';
import { HEADING_FONT_FAMILY } from '../lib/branding';

interface Service {
  id: string;
  name: string;
  category: string;
  vehicleTypes: string[];
  variants: number;
  startingPrice: number;
  freeCoffees: number;
  loyalty: boolean;
  recommended: boolean;
  active: boolean;
}

function extractServicesFromCatalog(): Service[] {
  const { dataByBranchId } = getPublicCatalogState();
  const seen = new Map<string, Service>();

  for (const branchData of Object.values(dataByBranchId)) {
    for (const block of branchData.vehicleServices) {
      for (const svc of block.services) {
        if (!svc.active) continue;
        if (seen.has(svc.id)) {
          // Merge vehicle types across blocks for the same service
          const existing = seen.get(svc.id)!;
          const merged = Array.from(new Set([...existing.vehicleTypes, block.vehicleType]));
          seen.set(svc.id, { ...existing, vehicleTypes: merged });
        } else {
          seen.set(svc.id, {
            id: svc.id,
            name: svc.name,
            category: svc.category ?? 'Washing',
            vehicleTypes: block.vehicleType ? [block.vehicleType] : [],
            variants: 1,
            startingPrice: Number(svc.price ?? 0),
            freeCoffees: Number(svc.freeCoffeeCount ?? 0),
            loyalty: !!(svc.eligibleForLoyaltyPoints),
            recommended: !!(svc.recommended),
            active: svc.active !== false,
          });
        }
      }
    }
  }

  return Array.from(seen.values());
}

export function ServicesPage() {
  const { hasCustomerSession } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Washing');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hydrate from API, then subscribe to future changes
    void hydratePublicCatalogFromApi().then(() => {
      setServices(extractServicesFromCatalog());
      setLoading(false);
    });

    const unsub = subscribePublicCatalog(() => {
      setServices(extractServicesFromCatalog());
    });

    return unsub;
  }, []);

  const categories = Array.from(new Set(services.map((s) => s.category))).sort();
  // If the currently selected category no longer exists, fall back to first
  const activeCategory = categories.includes(selectedCategory)
    ? selectedCategory
    : (categories[0] ?? 'Washing');

  const filteredServices = services.filter((s) => s.category === activeCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Sparkles className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-slate-600">Loading services...</p>
        </div>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h1 className="text-2xl font-normal text-slate-900 mb-2 tracking-wide" style={{ fontFamily: HEADING_FONT_FAMILY }}>No Services Available</h1>
            <p className="text-slate-600">Services will appear here once they're added by the admin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-normal text-slate-900 mb-2 tracking-wide" style={{ fontFamily: HEADING_FONT_FAMILY }}>Our Services</h1>
          <p className="text-slate-600">Choose from our washing and detailing services</p>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat} ({services.filter((s) => s.category === cat).length})
            </button>
          ))}
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div key={service.id} className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-lg transition-shadow">
              {/* Recommended Badge */}
              {service.recommended && (
                <div className="mb-3">
                  <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                    ⭐ Recommended
                  </span>
                </div>
              )}

              {/* Service Name */}
              <h3 className="text-lg font-normal text-slate-900 mb-2 tracking-wide" style={{ fontFamily: HEADING_FONT_FAMILY }}>{service.name}</h3>

              {/* Vehicle Types */}
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-1">Available for:</p>
                <div className="flex flex-wrap gap-1">
                  {service.vehicleTypes.map((vehicle) => (
                    <span key={vehicle} className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">
                      {vehicle}
                    </span>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div className="mb-4 pb-4 border-b border-slate-200">
                <p className="text-slate-600 text-sm">Starting from</p>
                <p className="text-2xl font-bold text-slate-900">${service.startingPrice.toFixed(2)}</p>
              </div>

              {/* Features */}
              <div className="space-y-2 text-sm mb-6">
                {service.variants > 1 && (
                  <p className="text-slate-600">📦 {service.variants} variant{service.variants !== 1 ? 's' : ''}</p>
                )}
                {service.freeCoffees > 0 && (
                  <p className="text-slate-600">☕ Free coffee{service.freeCoffees !== 1 ? 's' : ''} included</p>
                )}
                {hasCustomerSession && service.loyalty && (
                  <p className="text-slate-600">💳 Loyalty points awarded</p>
                )}
              </div>

              {/* Action Button */}
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                Book Now
              </button>
            </div>
          ))}
        </div>

        {/* No Services in Category */}
        {filteredServices.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <p className="text-slate-600 text-lg">No {activeCategory} services available at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
