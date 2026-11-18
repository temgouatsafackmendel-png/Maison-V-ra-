/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  Search,
  ArrowUpRight,
  Check,
  SlidersHorizontal,
  X,
  Minus,
  Plus,
  Smartphone,
  MapPin,
  Wifi,
  Sparkles,
  ShieldCheck,
  Truck,
  Clock,
  PhoneCall,
  Copy,
  Building2,
  Compass,
  Award,
  Heart,
} from 'lucide-react';
import type {
  CartItemInput,
  CartQuote,
  CurrencyCode,
  DeliveryModeType,
  OrderDTO,
  Product,
  UserProfile,
} from './shared/types.ts';
import { formatDualPrice, formatMoney } from './utils/format.ts';
import { ResilientImage } from './components/ResilientImage.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { OrderSandboxModal } from './components/OrderSandboxModal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { AccountPortal } from './components/AccountPortal.tsx';

type ActiveView = 'storefront' | 'craftsmanship' | 'account' | 'admin';

interface ShowroomInfo {
  id: string;
  city: string;
  country: string;
  district: string;
  address: string;
  landmark: string;
  phone: string;
  hours: string;
  leadTime: string;
  highlight: string;
  specialties: string[];
}

const SHOWROOMS: ShowroomInfo[] = [
  {
    id: 'douala',
    city: 'Douala',
    country: 'Cameroun (CEMAC)',
    district: 'Bonapriso',
    address: 'Rue Njo-Njo, Quartier Bonapriso',
    landmark: 'En face de la Pharmacie du Littoral, Pavillon en pierre sombre',
    phone: '+237 699 45 12 88',
    hours: 'Lun – Sam · 09h30 à 19h00',
    leadTime: 'Livraison Coursier Gants Blancs en 24h (Douala & Yaoundé)',
    highlight:
      'Atelier principal Afrique Centrale — Fonderie de bronze de Foumban & ébénisterie en Iroko massif.',
    specialties: [
      'Retrait immédiat en galerie sur présentation du certificat',
      'Démonstration acoustique privée du Monolithe Aeon I',
      'Règlement MTN MoMo, Orange Money ou espèces en salon',
    ],
  },
  {
    id: 'abidjan',
    city: 'Abidjan',
    country: 'Côte d’Ivoire (UEMOA)',
    district: 'Cocody Riviera 3',
    address: 'Boulevard Arsène Usher Assouan, Cocody Riviera 3',
    landmark: 'À 200m du Lycée International, Villa Architecturale N°14',
    phone: '+225 07 08 44 19 00',
    hours: 'Lun – Sam · 10h00 à 19h30',
    leadTime: 'Livraison Coursier Dédié en 24h sur le Grand Abidjan',
    highlight:
      'Salon d’écoute haute-fidélité et galerie des céramiques de Katiola & travertin naturel.',
    specialties: [
      'Conseil sur-mesure pour cabinets d’architecture et hôtellerie',
      'Écoute stéréo appairée sur rendez-vous privé',
      'Règlement Orange Money, Wave, MTN MoMo et Carte Visa',
    ],
  },
  {
    id: 'dakar',
    city: 'Dakar',
    country: 'Sénégal (UEMOA)',
    district: 'Les Almadies',
    address: 'Route de Ngor, Corniche des Almadies',
    landmark: 'Face à l’océan, à proximité du Phare des Mamelles',
    phone: '+221 77 640 18 90',
    hours: 'Mar – Sam · 10h00 à 19h30',
    leadTime: 'Livraison Gants Blancs en 24h à Dakar, Saly et Diamniadio',
    highlight:
      'Pavillon Atlantique — Finitions oléo-cires et bronzes traités pour les résidences côtières.',
    specialties: [
      'Sélection d’éditions numérotées résistantes à l’air marin',
      'Accompagnement projets résidentiels & villas contemporaines',
      'Règlement Wave Mobile Money, Orange Money et Carte Bancaire',
    ],
  },
  {
    id: 'paris',
    city: 'Paris',
    country: 'France & International',
    district: 'Saint-Germain-des-Prés',
    address: '18 Rue de Seine, 75006 Paris',
    landmark: 'Cour d’honneur pavée, 1er étage noble',
    phone: '+33 1 42 68 55 10',
    hours: 'Mar – Sam · 10h30 à 19h00',
    leadTime: 'Expédition internationale assurée DHL Express (48h–72h)',
    highlight:
      'Bureau de prescription européen et showroom de liaison avec nos ateliers africains.',
    specialties: [
      'Échantillothèque complète (albâtre, bronze, iroko, grès, travertin)',
      'Expédition aérienne sécurisée vers toute l’Europe et l’Afrique',
      'Facturation professionnelle et détaxe internationale',
    ],
  },
];

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('storefront');
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // African Localization & UX Preferences
  const [currency, setCurrency] = useState<CurrencyCode>('XAF');
  const [deliveryMode, setDeliveryMode] =
    useState<DeliveryModeType>('home_express');
  const [dataSaverMode, setDataSaverMode] = useState(false);

  // Selected variant per product ID
  const [selectedVariants, setSelectedVariants] = useState<Record<number, number>>({});
  // Selected product for Contiguous Purchase Module (PDP modal)
  const [pdpProduct, setPdpProduct] = useState<Product | null>(null);
  const [pdpQty, setPdpQty] = useState(1);
  const [pdpCityEstimate, setPdpCityEstimate] = useState<string>('Douala (24h)');
  const [copiedWhatsAppPdp, setCopiedWhatsAppPdp] = useState(false);

  // Showroom interactive state
  const [activeShowroomId, setActiveShowroomId] = useState<string>('douala');
  const [appointmentBookedCity, setAppointmentBookedCity] = useState<string | null>(null);

  // Filters, Search & Wishlist
  const [categoryFilter, setCategoryFilter] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc'>('featured');
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);

  const toggleWishlist = (productId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWishlistIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  // Cart & Quote state
  const [cartItems, setCartItems] = useState<CartItemInput[]>([
    { variantId: 1, quantity: 1 },
  ]);
  const [couponCode, setCouponCode] = useState<string>('');
  const [cartQuote, setCartQuote] = useState<CartQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [justAddedVariantId, setJustAddedVariantId] = useState<number | null>(null);
  const [promoToast, setPromoToast] = useState<string | null>(null);

  // Auth state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Active Order Certificate Modal
  const [sandboxOrder, setSandboxOrder] = useState<OrderDTO | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const res = await fetch('/api/catalog');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur chargement catalogue');
      const loadedProducts: Product[] = data.products || [];
      setProducts(loadedProducts);

      setSelectedVariants((prev) => {
        const next = { ...prev };
        for (const p of loadedProducts) {
          if (!next[p.id] && p.variants.length > 0) {
            const firstInStock = p.variants.find((v) => v.stock > 0) || p.variants[0];
            next[p.id] = firstInStock.id;
          }
        }
        return next;
      });
    } catch (err: unknown) {
      setCatalogError(
        err instanceof Error ? err.message : 'Impossible de charger le catalogue'
      );
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const refreshServerQuote = useCallback(
    async (items: CartItemInput[], code: string, mode: DeliveryModeType) => {
      setQuoteLoading(true);
      try {
        const res = await fetch('/api/cart/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            couponCode: code || null,
            deliveryMode: mode,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setCartQuote(data.quote);
        }
      } finally {
        setQuoteLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    refreshServerQuote(cartItems, couponCode, deliveryMode);
  }, [cartItems, couponCode, deliveryMode, refreshServerQuote]);

  const handleApplyPromoBannerCode = (code: string, label: string) => {
    setCouponCode(code);
    setPromoToast(`Code privilège ${code} (${label}) activé dans votre panier`);
    setTimeout(() => {
      setPromoToast((curr) => (curr?.includes(code) ? null : curr));
    }, 3200);
  };

  const handleAddToCart = (variantId: number, quantityToAdd = 1) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.variantId === variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === variantId
            ? { ...i, quantity: Math.min(20, i.quantity + quantityToAdd) }
            : i
        );
      }
      return [...prev, { variantId, quantity: quantityToAdd }];
    });

    setJustAddedVariantId(variantId);
    setTimeout(() => {
      setJustAddedVariantId((curr) => (curr === variantId ? null : curr));
    }, 1400);
  };

  const handleUpdateCartQuantity = (variantId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCartItems((prev) => prev.filter((i) => i.variantId !== variantId));
    } else {
      setCartItems((prev) =>
        prev.map((i) =>
          i.variantId === variantId ? { ...i, quantity: Math.min(20, newQuantity) } : i
        )
      );
    }
  };

  const handleRemoveCartItem = (variantId: number) => {
    setCartItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const handleQuickAdminLogin = async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@maison-vera.test',
        password: 'AdminVera2026!',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      setAuthToken(data.token);
      setActiveView('admin');
    }
  };

  const handleLogout = async () => {
    if (authToken) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });
    }
    setUser(null);
    setAuthToken(null);
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Tous: products.length };
    for (const p of products) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (categoryFilter === 'Favoris') {
          if (!wishlistIds.includes(p.id)) return false;
        } else if (categoryFilter !== 'Tous' && p.category !== categoryFilter) {
          return false;
        }
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchSub = p.subtitle.toLowerCase().includes(q);
          const matchDesc = p.description.toLowerCase().includes(q);
          const matchSku = p.variants.some((v) => v.sku.toLowerCase().includes(q));
          return matchTitle || matchSub || matchDesc || matchSku;
        }
        return true;
      })
      .sort((a, b) => {
        const priceA = a.variants[0]?.priceCents || 0;
        const priceB = b.variants[0]?.priceCents || 0;
        if (sortBy === 'price_asc') return priceA - priceB;
        if (sortBy === 'price_desc') return priceB - priceA;
        return Number(b.featured) - Number(a.featured);
      });
  }, [products, categoryFilter, searchQuery, sortBy, wishlistIds]);

  const totalCartUnits = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const activeShowroom = useMemo(
    () => SHOWROOMS.find((s) => s.id === activeShowroomId) || SHOWROOMS[0],
    [activeShowroomId]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#141413]">
      {/* Interactive Privilege Notification Toast */}
      {promoToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#141413] text-[#FAF7F2] px-4 py-3 rounded-xl shadow-xl border border-[#2E2D2A] flex items-center gap-3 text-xs">
          <Sparkles className="w-4 h-4 text-[#D4A373] shrink-0" />
          <span>{promoToast}</span>
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="underline underline-offset-4 font-semibold text-[#D4A373] hover:text-white ml-1 cursor-pointer"
          >
            Voir le panier
          </button>
        </div>
      )}

      {/* Top Editorial Hospitality Ribbon */}
      <div className="bg-[#141413] text-[#E6E1D6] px-6 py-2 text-[11px] border-b border-[#27272A]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[#D4A373] font-medium tracking-wide uppercase">
              Galeries Afrique & Europe
            </span>
            <span aria-hidden="true" className="text-[#52525B]">
              ·
            </span>
            <span>Douala (Bonapriso) · Abidjan (Cocody) · Dakar (Almadies) · Paris</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[#A1A1AA] hidden sm:inline">
              Codes privilèges en 1 clic :
            </span>
            <button
              type="button"
              onClick={() => handleApplyPromoBannerCode('AFRIQUE10', '-10%')}
              className={`font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                couponCode === 'AFRIQUE10'
                  ? 'bg-[#D4A373] text-[#141413] border-[#D4A373] font-semibold'
                  : 'border-[#3F3F46] text-[#FAF7F2] hover:border-[#D4A373]'
              }`}
              title="Appliquer -10% sur votre sélection"
            >
              AFRIQUE10 (-10%)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPromoBannerCode('DAKAR25', '-25% dès 600 €')}
              className={`font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                couponCode === 'DAKAR25'
                  ? 'bg-[#D4A373] text-[#141413] border-[#D4A373] font-semibold'
                  : 'border-[#3F3F46] text-[#FAF7F2] hover:border-[#D4A373]'
              }`}
              title="Appliquer -25% dès 600 € (~393 600 FCFA)"
            >
              DAKAR25 (-25%)
            </button>
          </div>
        </div>
      </div>

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-md border-b border-[#E5E0D5] px-6 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveView('storefront')}
          className="text-left group cursor-pointer shrink-0"
        >
          <span className="block text-2xl md:text-[28px] font-display font-semibold tracking-tight text-[#141413] leading-none">
            Maison Véra
          </span>
          <span className="block text-[10px] uppercase tracking-[0.22em] text-[#78746C] mt-1">
            Haute Facture Architecturale
          </span>
        </button>

        {/* Zone 2: Primary Navigation Links */}
        <nav
          aria-label="Navigation principale"
          className="hidden md:flex items-center gap-8 text-xs font-medium text-[#57534E]"
        >
          <button
            type="button"
            onClick={() => setActiveView('storefront')}
            className={`hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeView === 'storefront'
                ? 'text-[#141413] font-semibold underline decoration-[#C86D51] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Collections ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveView('craftsmanship')}
            className={`hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeView === 'craftsmanship'
                ? 'text-[#141413] font-semibold underline decoration-[#C86D51] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            La Maison & Galeries
          </button>
          <button
            type="button"
            onClick={() => setActiveView('account')}
            className={`hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeView === 'account'
                ? 'text-[#141413] font-semibold underline decoration-[#C86D51] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            {user ? `Cercle Privé (${user.name.split(' ')[0]})` : 'Suivi & Cercle Privé'}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className={`hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeView === 'admin'
                ? 'text-[#141413] font-semibold underline decoration-[#C86D51] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Direction
          </button>
        </nav>

        {/* Zone 3: Currency & Primary Shopping Bag Action */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Compact Currency Switcher */}
          <div
            role="group"
            aria-label="Sélectionner la devise"
            className="hidden sm:inline-flex bg-[#F2ECE1] border border-[#DED8CC] rounded-lg p-0.5"
          >
            {(
              [
                { code: 'XAF', label: 'XAF (CEMAC)' },
                { code: 'XOF', label: 'XOF (UEMOA)' },
                { code: 'EUR', label: 'EUR (€)' },
              ] as Array<{ code: CurrencyCode; label: string }>
            ).map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCurrency(c.code)}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currency === c.code
                    ? 'bg-[#141413] text-[#FAF7F2] font-medium shadow-xs'
                    : 'text-[#57534E] hover:text-[#141413]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="inline-flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-all whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Panier</span>
            <span className="font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#292826] text-[#FAF7F2] text-[11px]">
              {totalCartUnits}
            </span>
          </button>
        </div>
      </header>

      {/* Mobile Secondary Navigation & Currency Strip */}
      <div className="md:hidden border-b border-[#E5E0D5] bg-[#F2ECE1] px-4 py-2.5 space-y-2">
        <div className="flex items-center justify-around text-xs font-medium text-[#57534E]">
          <button
            type="button"
            onClick={() => setActiveView('storefront')}
            className={
              activeView === 'storefront'
                ? 'text-[#141413] font-semibold underline decoration-[#C86D51] underline-offset-4'
                : ''
            }
          >
            Collections
          </button>
          <button
            type="button"
            onClick={() => setActiveView('craftsmanship')}
            className={
              activeView === 'craftsmanship'
                ? 'text-[#141413] font-semibold underline decoration-[#C86D51] underline-offset-4'
                : ''
            }
          >
            Galeries
          </button>
          <button
            type="button"
            onClick={() => setActiveView('account')}
            className={
              activeView === 'account'
                ? 'text-[#141413] font-semibold underline decoration-[#C86D51] underline-offset-4'
                : ''
            }
          >
            Suivi & Compte
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className={
              activeView === 'admin'
                ? 'text-[#141413] font-semibold underline decoration-[#C86D51] underline-offset-4'
                : ''
            }
          >
            Direction
          </button>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-[#E5E0D5] text-[11px]">
          <div className="inline-flex bg-white border border-[#DED8CC] rounded-md p-0.5">
            {(['XAF', 'XOF', 'EUR'] as CurrencyCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className={`px-2 py-0.5 font-mono rounded ${
                  currency === code
                    ? 'bg-[#141413] text-[#FAF7F2]'
                    : 'text-[#57534E]'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDataSaverMode((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#DED8CC] bg-white text-[#57534E]"
          >
            <Wifi className="w-3 h-3" />
            <span>{dataSaverMode ? 'Éco Data : Actif' : 'Mode Éco Data'}</span>
          </button>
        </div>
      </div>

      {/* Hospitality & Payment Bar (Desktop) */}
      <div className="hidden md:block bg-[#F2ECE1]/80 border-b border-[#E5E0D5] px-6 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs text-[#57534E]">
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>
                Règlements acceptés :{' '}
                <strong className="text-[#141413] font-medium">
                  MTN MoMo · Orange Money · Wave · À la livraison · Carte Visa
                </strong>
              </span>
            </span>
            <span aria-hidden="true" className="text-[#D6D1C7]">
              |
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#C86D51]" />
              <span>
                Livraison Gants Blancs offerte dès 328 000 FCFA (500 €) ou retrait gratuit en Galerie
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setDataSaverMode((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              dataSaverMode
                ? 'bg-[#141413] text-[#FAF7F2] border-[#141413]'
                : 'bg-white text-[#57534E] border-[#DED8CC] hover:text-[#141413]'
            }`}
          >
            <Wifi className="w-3 h-3" />
            <span>
              {dataSaverMode ? 'Mode Éco Data (3G/4G) : Actif' : 'Mode Éco Data (3G/4G)'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Router */}
      <main className="flex-1">
        {activeView === 'admin' ? (
          <AdminDashboard
            user={user}
            authToken={authToken}
            currency={currency}
            onQuickAdminLogin={handleQuickAdminLogin}
            onCatalogMutated={() => {
              fetchCatalog();
              refreshServerQuote(cartItems, couponCode, deliveryMode);
            }}
            onOpenOrderSandbox={(order) => setSandboxOrder(order)}
          />
        ) : activeView === 'account' ? (
          <AccountPortal
            user={user}
            authToken={authToken}
            currency={currency}
            onAuthSuccess={(loggedUser, token) => {
              setUser(loggedUser);
              setAuthToken(token);
            }}
            onLogout={handleLogout}
            onOpenOrderSandbox={(order) => setSandboxOrder(order)}
            onReorderItems={(itemsToReorder) => {
              setCartItems(itemsToReorder);
              setActiveView('storefront');
              setIsCartOpen(true);
            }}
          />
        ) : activeView === 'craftsmanship' ? (
          /* Interactive La Maison & Galeries View */
          <section className="max-w-7xl mx-auto px-6 py-12 md:py-16 space-y-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end border-b border-[#E5E0D5] pb-10">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#C86D51] font-medium">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Maisons & Ateliers · Afrique & Europe</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-semibold text-[#141413] leading-[1.08]">
                  Matières nobles du continent, dessin architectural et hospitalité privée.
                </h1>
              </div>
              <div className="lg:col-span-5">
                <p className="text-sm text-[#57534E] leading-relaxed">
                  Maison Véra réunit maîtres fondeurs de bronze de Foumban, céramistes de Katiola et ébénistes autour d’une exigence commune : façonner des pièces sculpturales numérotées, conçues pour traverser les générations et sublimer les grandes résidences contemporaines de Douala, Abidjan, Dakar et Paris.
                </p>
              </div>
            </div>

            {/* Interactive Showroom Selector */}
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-display font-semibold text-[#141413]">
                    Nos Galeries & Salons d’Écoute
                  </h2>
                  <p className="text-xs text-[#78746C] mt-0.5">
                    Sélectionnez une ville pour consulter les coordonnées, les horaires et réserver une visite privée.
                  </p>
                </div>

                <div
                  role="tablist"
                  aria-label="Choisir une galerie Maison Véra"
                  className="inline-flex flex-wrap bg-[#F2ECE1] border border-[#E5E0D5] rounded-xl p-1 gap-1"
                >
                  {SHOWROOMS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={activeShowroomId === s.id}
                      onClick={() => {
                        setActiveShowroomId(s.id);
                        setAppointmentBookedCity(null);
                      }}
                      className={`px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                        activeShowroomId === s.id
                          ? 'bg-[#141413] text-[#FAF7F2] shadow-xs'
                          : 'text-[#57534E] hover:text-[#141413]'
                      }`}
                    >
                      {s.city} · {s.district}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Showroom Detail Card */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white border border-[#E5E0D5] rounded-2xl p-8 md:p-10 shadow-xs">
                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-2">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#C86D51]">
                      {activeShowroom.country} · Quartier {activeShowroom.district}
                    </span>
                    <h3 className="text-3xl font-display font-semibold text-[#141413]">
                      Galerie Maison Véra — {activeShowroom.city}
                    </h3>
                    <p className="text-sm text-[#57534E] leading-relaxed">
                      {activeShowroom.highlight}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#E5E0D5] text-xs">
                    <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5E0D5] space-y-1">
                      <div className="font-semibold text-[#141413] flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#C86D51]" />
                        <span>Adresse & Point de repère</span>
                      </div>
                      <p className="text-[#57534E]">{activeShowroom.address}</p>
                      <p className="text-[11px] text-[#78746C] italic">
                        Repère : {activeShowroom.landmark}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E5E0D5] space-y-1">
                      <div className="font-semibold text-[#141413] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#C86D51]" />
                        <span>Horaires & Conciergerie</span>
                      </div>
                      <p className="text-[#57534E]">{activeShowroom.hours}</p>
                      <p className="font-mono text-[#141413] font-medium">
                        Ligne directe / WhatsApp : {activeShowroom.phone}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#141413]">
                      Services exclusifs dans cette galerie :
                    </div>
                    <ul className="space-y-1.5">
                      {activeShowroom.specialties.map((spec) => (
                        <li
                          key={spec}
                          className="text-xs text-[#57534E] flex items-center gap-2"
                        >
                          <Check className="w-3.5 h-3.5 text-[#C86D51] shrink-0" />
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-[#F2ECE1] border border-[#E5E0D5] rounded-xl p-6 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#78746C]">
                      <Building2 className="w-3.5 h-3.5 text-[#141413]" />
                      <span>Rendez-Vous Privé & Prescription</span>
                    </span>
                    <h4 className="text-xl font-display font-semibold text-[#141413]">
                      Réserver un accueil personnalisé à {activeShowroom.city}
                    </h4>
                    <p className="text-xs text-[#57534E] leading-relaxed">
                      Notre directeur de galerie vous reçoit sur rendez-vous pour vous présenter les finitions (albâtre, bronze, iroko, grès) ou organiser le retrait immédiat de votre commande en ligne.
                    </p>
                    <div className="p-3 bg-white/80 rounded-lg border border-[#E5E0D5] text-xs text-[#57534E]">
                      <strong className="text-[#141413] block mb-0.5">
                        Logistique locale :
                      </strong>
                      {activeShowroom.leadTime}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {appointmentBookedCity === activeShowroom.city ? (
                      <div className="p-4 bg-emerald-950 text-emerald-100 rounded-xl text-xs space-y-1">
                        <div className="font-semibold flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Demande d’accueil privé enregistrée ({activeShowroom.city})</span>
                        </div>
                        <p className="text-emerald-200/90 text-[11px]">
                          Notre conciergerie ({activeShowroom.phone}) est prête à vous accueillir au {activeShowroom.address}.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAppointmentBookedCity(activeShowroom.city)}
                        className="w-full py-3 px-4 bg-[#141413] text-[#FAF7F2] text-xs font-medium rounded-xl hover:bg-[#292826] transition-colors cursor-pointer"
                      >
                        Demander un rendez-vous privé à {activeShowroom.city}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryMode('pickup_showroom');
                        setActiveView('storefront');
                        setIsCartOpen(true);
                      }}
                      className="w-full py-2.5 px-4 bg-white border border-[#DED8CC] text-[#141413] text-xs font-medium rounded-xl hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                    >
                      Choisir le retrait gratuit dans cette galerie
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* Storefront View */
          <div className="space-y-16 pb-20">
            {/* Section 1: Storefront Split Architectural Hero */}
            <section className="max-w-7xl mx-auto px-6 pt-6 lg:pt-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch bg-[#F2ECE1] border border-[#E5E0D5] rounded-2xl overflow-hidden shadow-xs">
                <div className="lg:col-span-6 p-8 md:p-12 lg:p-14 flex flex-col justify-between space-y-8">
                  <div className="space-y-5">
                    <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-md bg-white/80 border border-[#DED8CC] text-[11px] text-[#57534E]">
                      <Award className="w-3.5 h-3.5 text-[#C86D51]" />
                      <span className="font-medium text-[#141413]">
                        Collection Permanente 2026
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Pièces Numérotées & Certifiées</span>
                    </div>

                    <h1
                      className="font-display font-semibold text-[#141413] leading-[1.06] tracking-tight"
                      style={{
                        fontSize: 'clamp(2.35rem, 3.9vw, 3.65rem)',
                        textWrap: 'balance',
                      }}
                    >
                      L’élégance minérale et le grand artisanat d’Afrique.
                    </h1>

                    <p className="text-sm md:text-base text-[#57534E] leading-relaxed max-w-xl">
                      Luminaires en bronze coulé de Foumban et albâtre veiné, fauteuils bas en Iroko massif et monoblocs acoustiques en grès de Katiola. Façonnés en série limitée pour les intérieurs de Douala, Abidjan, Dakar et Paris.
                    </p>
                  </div>

                  <div className="space-y-5 pt-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href="#collection-catalogue"
                        className="px-6 py-3.5 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors whitespace-nowrap shrink-0 shadow-xs"
                      >
                        Explorer les créations
                      </a>
                      <button
                        type="button"
                        onClick={() => setIsCartOpen(true)}
                        className="px-5 py-3.5 text-xs font-medium bg-white border border-[#DED8CC] text-[#141413] rounded-xl hover:bg-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Votre Sélection ({totalCartUnits})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveView('craftsmanship')}
                        className="px-4 py-3 text-xs font-medium text-[#57534E] hover:text-[#141413] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Nos Galeries (Douala · Abidjan · Dakar)
                      </button>
                    </div>

                    {/* Key Architectural Trust Metrics */}
                    <div className="grid grid-cols-3 gap-4 pt-5 border-t border-[#DED8CC]/80 text-xs">
                      <div>
                        <div className="font-mono font-semibold text-[#141413]">
                          24h – 48h
                        </div>
                        <div className="text-[11px] text-[#78746C]">
                          Coursier Douala, Abidjan & Dakar
                        </div>
                      </div>
                      <div>
                        <div className="font-mono font-semibold text-[#141413]">
                          XAF · XOF · EUR
                        </div>
                        <div className="text-[11px] text-[#78746C]">
                          Parité fixe & Mobile Money
                        </div>
                      </div>
                      <div>
                        <div className="font-mono font-semibold text-[#141413]">
                          Série Numérotée
                        </div>
                        <div className="text-[11px] text-[#78746C]">
                          Certificat d’atelier inclus
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 min-h-[320px] lg:min-h-[480px] relative bg-[#E6E0D4]">
                  {dataSaverMode ? (
                    <div className="w-full h-full bg-[#EFECE6] p-10 flex flex-col items-center justify-center text-center space-y-3">
                      <Wifi className="w-8 h-8 text-[#57534E]" />
                      <div className="text-sm font-semibold text-[#141413]">
                        Mode Éco Data (3G/4G) activé
                      </div>
                      <p className="text-xs text-[#57534E] max-w-xs">
                        Les photographies haute définition sont mises en pause pour garantir une navigation instantanée sur réseau mobile.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDataSaverMode(false)}
                        className="px-4 py-2 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-lg cursor-pointer"
                      >
                        Afficher les photographies
                      </button>
                    </div>
                  ) : (
                    <>
                      <ResilientImage
                        src="/src/assets/images/hero_architectural_lighting_1794937868913.jpg"
                        alt="Lampe sculpturale en albâtre et bronze sur socle en pierre dans un intérieur architectural"
                        className="w-full h-full object-cover"
                      />
                      {/* Subtle Editorial Caption Overlay */}
                      <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:max-w-xs bg-[#141413]/85 backdrop-blur-md text-[#FAF7F2] p-4 rounded-xl border border-white/10 text-xs space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#D4A373]">
                            Pièce Phare · Édition N°01
                          </span>
                          <span className="font-mono text-[11px] text-white/90">
                            {formatMoney(68000, currency)}
                          </span>
                        </div>
                        <div className="font-display text-base font-medium">
                          Lampe Monolithe Solis — Bronze de Foumban
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Featured Collection & Interactive Filters */}
            <section
              id="collection-catalogue"
              className="max-w-7xl mx-auto px-6 space-y-8"
            >
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#E5E0D5] pb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#C86D51] font-medium">
                    Catalogue Officiel & Stocks d’Atelier en Temps Réel
                  </p>
                  <h2 className="text-3xl md:text-4xl font-display font-semibold text-[#141413] mt-1">
                    Les Créations de la Maison
                  </h2>
                </div>

                {/* Filter & Search Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    role="group"
                    aria-label="Filtrer par catégorie"
                    className="flex flex-wrap items-center gap-1 p-1 bg-[#F2ECE1] border border-[#E5E0D5] rounded-xl"
                  >
                    {['Tous', 'Luminaires', 'Mobilier', 'Acoustique', 'Objets'].map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            categoryFilter === cat
                              ? 'bg-[#141413] text-[#FAF7F2] shadow-xs'
                              : 'text-[#57534E] hover:text-[#141413]'
                          }`}
                        >
                          {cat}{' '}
                          <span className="opacity-70 font-mono text-[10px]">
                            ({categoryCounts[cat] ?? 0})
                          </span>
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('Favoris')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer ${
                        categoryFilter === 'Favoris'
                          ? 'bg-[#C86D51] text-white shadow-xs'
                          : 'text-[#57534E] hover:text-[#141413]'
                      }`}
                    >
                      <Heart className="w-3 h-3" />
                      <span>Favoris ({wishlistIds.length})</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#78746C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher albâtre, iroko, grès..."
                      aria-label="Rechercher dans le catalogue"
                      className="pl-8 pr-3 py-2 text-xs bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413] w-56"
                    />
                  </div>

                  <div className="inline-flex items-center gap-1.5 bg-white border border-[#DED8CC] rounded-xl px-3 py-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#78746C]" />
                    <select
                      aria-label="Trier les produits"
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(
                          e.target.value as 'featured' | 'price_asc' | 'price_desc'
                        )
                      }
                      className="text-xs bg-transparent text-[#141413] focus:outline-none cursor-pointer"
                    >
                      <option value="featured">Sélection de la Maison</option>
                      <option value="price_asc">Prix croissant</option>
                      <option value="price_desc">Prix décroissant</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Loading / Error / Empty / Grid */}
              {loadingCatalog ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="h-[520px] bg-[#EFECE6] rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : catalogError ? (
                <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center space-y-3">
                  <p className="text-sm text-red-900 font-medium">{catalogError}</p>
                  <button
                    type="button"
                    onClick={fetchCatalog}
                    className="px-4 py-2 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl"
                  >
                    Actualiser la collection
                  </button>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-12 bg-white border border-[#E5E0D5] rounded-2xl text-center space-y-3">
                  <p className="text-lg font-display text-[#57534E]">
                    Aucune création ne correspond à votre recherche « {searchQuery} ».
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('Tous');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2.5 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl cursor-pointer"
                  >
                    Afficher toute la collection
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {filteredProducts.map((product) => {
                    const activeVariantId =
                      selectedVariants[product.id] ?? product.variants[0]?.id;
                    const activeVariant =
                      product.variants.find((v) => v.id === activeVariantId) ||
                      product.variants[0];

                    const isOutOfStock = !activeVariant || activeVariant.stock <= 0;
                    const isLowStock =
                      activeVariant && activeVariant.stock > 0 && activeVariant.stock <= 3;
                    const wasJustAdded =
                      activeVariant && justAddedVariantId === activeVariant.id;

                    return (
                      <article
                        key={product.id}
                        className="group bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-[#C86D51]/60 hover:shadow-lg"
                      >
                        <div>
                          {/* Visual Header */}
                          <div
                            onClick={() => {
                              setPdpProduct(product);
                              setPdpQty(1);
                            }}
                            className="aspect-[16/11] w-full bg-[#EFECE6] overflow-hidden cursor-pointer relative"
                          >
                            {dataSaverMode ? (
                              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#57534E]">
                                <span className="text-xs font-mono uppercase tracking-widest text-[#C86D51]">
                                  {product.category}
                                </span>
                                <span className="text-xl font-display font-semibold text-[#141413] mt-1">
                                  {product.title}
                                </span>
                                <span className="text-xs text-[#78746C] mt-1">
                                  Toucher pour consulter la fiche détaillée
                                </span>
                              </div>
                            ) : (
                              <>
                                <ResilientImage
                                  src={product.imageUrl}
                                  alt={product.title}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                />
                                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-md bg-[#141413]/80 backdrop-blur-xs text-[#FAF7F2] text-[10px] uppercase tracking-widest font-medium">
                                      {product.category}
                                    </span>
                                    {isLowStock && (
                                      <span className="px-2.5 py-1 rounded-md bg-[#C86D51] text-white text-[10px] font-medium">
                                        Derniers exemplaires ({activeVariant.stock})
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => toggleWishlist(product.id, e)}
                                    aria-label={`Ajouter ${product.title} aux favoris`}
                                    className={`p-2 rounded-full backdrop-blur-xs transition-colors cursor-pointer ${
                                      wishlistIds.includes(product.id)
                                        ? 'bg-[#C86D51] text-white'
                                        : 'bg-[#141413]/70 text-[#FAF7F2] hover:bg-[#141413]'
                                    }`}
                                  >
                                    <Heart
                                      className={`w-3.5 h-3.5 ${
                                        wishlistIds.includes(product.id) ? 'fill-current' : ''
                                      }`}
                                    />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Card Body */}
                          <div className="p-6 md:p-7 space-y-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-[#78746C] font-medium">
                                  {product.subtitle}
                                </p>
                                <h3
                                  onClick={() => {
                                    setPdpProduct(product);
                                    setPdpQty(1);
                                  }}
                                  className="text-2xl font-display font-semibold text-[#141413] group-hover:text-[#C86D51] transition-colors cursor-pointer"
                                >
                                  {product.title}
                                </h3>
                              </div>

                              <div className="text-right">
                                <div className="text-base font-mono tabular-nums font-semibold text-[#141413]">
                                  {activeVariant
                                    ? formatMoney(activeVariant.priceCents, currency)
                                    : '—'}
                                </div>
                                <div className="text-[11px] font-mono text-[#78746C]">
                                  {activeVariant && currency !== 'EUR'
                                    ? `${(activeVariant.priceCents / 100).toFixed(0)} € TTC`
                                    : activeVariant
                                      ? formatMoney(activeVariant.priceCents, 'XAF')
                                      : ''}
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed">
                              {product.description}
                            </p>

                            {/* Tactile Edition / Finish Selector Buttons */}
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-medium text-[#141413]">
                                  Choisir l’édition ({product.variants.length} finitions) :
                                </span>
                                <span
                                  className={`font-mono ${
                                    isOutOfStock ? 'text-red-700 font-semibold' : 'text-[#78746C]'
                                  }`}
                                >
                                  {isOutOfStock
                                    ? 'Édition épuisée'
                                    : `${activeVariant.stock} en stock · Réf. ${activeVariant.sku}`}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 gap-1.5">
                                {product.variants.map((v) => {
                                  const isSelected = activeVariant?.id === v.id;
                                  return (
                                    <button
                                      key={v.id}
                                      type="button"
                                      onClick={() =>
                                        setSelectedVariants((prev) => ({
                                          ...prev,
                                          [product.id]: v.id,
                                        }))
                                      }
                                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                        isSelected
                                          ? 'border-[#141413] bg-[#FAF7F2] font-medium text-[#141413] shadow-2xs'
                                          : 'border-[#E5E0D5] bg-white text-[#57534E] hover:border-[#C86D51]/50'
                                      }`}
                                    >
                                      <div className="truncate">
                                        <span className="text-[#141413]">{v.name}</span>
                                        <span className="text-[11px] text-[#78746C] ml-1.5">
                                          · {v.finish}
                                        </span>
                                      </div>
                                      <span className="font-mono tabular-nums text-[11px] shrink-0 text-[#141413]">
                                        {formatMoney(v.priceCents, currency)}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="px-6 md:px-7 pb-6 pt-2 flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() =>
                              activeVariant && handleAddToCart(activeVariant.id, 1)
                            }
                            className="flex-1 py-3 px-4 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                          >
                            {wasJustAdded ? (
                              <>
                                <Check className="w-4 h-4 text-[#D4A373]" />
                                <span>Pièce ajoutée à votre sélection</span>
                              </>
                            ) : isOutOfStock ? (
                              <span>Édition momentanément épuisée</span>
                            ) : (
                              <>
                                <ShoppingBag className="w-3.5 h-3.5 text-[#D4A373]" />
                                <span>
                                  Acquérir —{' '}
                                  {activeVariant
                                    ? formatMoney(activeVariant.priceCents, currency)
                                    : ''}
                                </span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPdpProduct(product);
                              setPdpQty(1);
                            }}
                            className="px-3.5 py-3 border border-[#DED8CC] bg-[#FAF7F2] text-[#141413] rounded-xl hover:bg-[#F2ECE1] transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                            aria-label={`Détails de ${product.title}`}
                            title="Inspecter les dimensions, le façonnage et les délais de livraison"
                          >
                            <span>Détails</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section 3: Luxury Hospitality & African Service Guarantees */}
            <section className="max-w-7xl mx-auto px-6">
              <div className="bg-[#F2ECE1] border border-[#E5E0D5] rounded-2xl p-8 md:p-12 space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#DED8CC] pb-6">
                  <div>
                    <span className="text-xs uppercase tracking-[0.2em] text-[#C86D51] font-medium">
                      Les Engagements Maison Véra
                    </span>
                    <h3 className="text-2xl md:text-3xl font-display font-semibold text-[#141413] mt-1">
                      Une expérience d’acquisition pensée pour l’Afrique et l’international
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveView('craftsmanship')}
                    className="text-xs font-medium text-[#141413] underline underline-offset-4 hover:text-[#C86D51] self-start md:self-auto cursor-pointer"
                  >
                    Consulter les adresses de nos 4 galeries →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#141413] text-[#D4A373] flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h4 className="text-lg font-display font-semibold text-[#141413]">
                      01 · Haute Facture & Tropicalisation
                    </h4>
                    <p className="text-xs text-[#57534E] leading-relaxed">
                      Bronze coulé à Foumban, bois d’Iroko étuvé résistant à l’humidité côtière, alimentations stabilisées (110V–250V) et certificat d’authenticité numéroté remis avec chaque création.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#141413] text-[#D4A373] flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <h4 className="text-lg font-display font-semibold text-[#141413]">
                      02 · Mobile Money, Espèces ou Carte
                    </h4>
                    <p className="text-xs text-[#57534E] leading-relaxed">
                      Réglez en Francs CFA (XAF / XOF) ou en Euros via MTN Mobile Money, Orange Money, Wave, carte bancaire internationale ou directement à la réception auprès de notre coursier.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#141413] text-[#D4A373] flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                    <h4 className="text-lg font-display font-semibold text-[#141413]">
                      03 · Livraison sur Point de Repère
                    </h4>
                    <p className="text-xs text-[#57534E] leading-relaxed">
                      Nos coursiers connaissent vos quartiers (Bonapriso, Bastos, Cocody, Almadies) et vous contactent sur WhatsApp avant leur passage selon le point de repère que vous indiquez.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Contiguous Purchase Module (PDP Modal) */}
      {pdpProduct && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Fiche produit ${pdpProduct.title}`}
        >
          <div className="bg-[#FAF7F2] border border-[#E5E0D5] rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-8">
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-6 bg-[#EFECE6] relative min-h-[320px] flex flex-col justify-between">
                <ResilientImage
                  src={pdpProduct.imageUrl}
                  alt={pdpProduct.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 right-3 bg-[#141413]/85 backdrop-blur-xs text-[#FAF7F2] px-3.5 py-2.5 rounded-xl text-[11px] flex items-center justify-between">
                  <span>Certificat d’atelier numéroté inclus</span>
                  <span className="text-[#D4A373] font-mono">Garantie 5 ans</span>
                </div>
              </div>

              <div className="md:col-span-6 p-6 md:p-8 flex flex-col justify-between space-y-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-widest text-[#C86D51] font-medium">
                      {pdpProduct.category} · {pdpProduct.subtitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPdpProduct(null)}
                      className="p-1.5 text-[#57534E] hover:text-[#141413] rounded-lg cursor-pointer"
                      aria-label="Fermer la fiche produit"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {(() => {
                    const activeVarId =
                      selectedVariants[pdpProduct.id] ?? pdpProduct.variants[0]?.id;
                    const activeVar =
                      pdpProduct.variants.find((v) => v.id === activeVarId) ||
                      pdpProduct.variants[0];

                    const handleCopyWhatsAppInquiry = () => {
                      if (!activeVar) return;
                      const text = `Bonjour Maison Véra, je souhaite acquérir la pièce "${pdpProduct.title}" — finition "${activeVar.name}" (Réf. ${activeVar.sku}) au tarif de ${formatMoney(activeVar.priceCents, currency)} (Qté: ${pdpQty}) pour une livraison à ${pdpCityEstimate}.`;
                      navigator.clipboard?.writeText(text);
                      setCopiedWhatsAppPdp(true);
                      setTimeout(() => setCopiedWhatsAppPdp(false), 2500);
                    };

                    return (
                      <>
                        <div>
                          <h2 className="text-2xl md:text-3xl font-display font-semibold text-[#141413]">
                            {pdpProduct.title}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="text-lg font-mono tabular-nums font-semibold text-[#141413]">
                              {activeVar
                                ? formatDualPrice(activeVar.priceCents, currency)
                                : '—'}
                            </span>
                            <span aria-hidden="true" className="text-[#DED8CC]">
                              ·
                            </span>
                            <span className="text-xs font-mono text-[#57534E]">
                              Réf. {activeVar?.sku} ({activeVar?.stock ?? 0} disponible
                              {(activeVar?.stock ?? 0) > 1 ? 's' : ''})
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-[#3F3F46] leading-relaxed">
                          {pdpProduct.description}
                        </p>

                        <div className="space-y-2">
                          <span className="block text-xs font-medium text-[#141413]">
                            Sélectionner l’édition :
                          </span>
                          <div className="space-y-1.5">
                            {pdpProduct.variants.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() =>
                                  setSelectedVariants((prev) => ({
                                    ...prev,
                                    [pdpProduct.id]: v.id,
                                  }))
                                }
                                className={`w-full text-left p-3 rounded-xl border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                  activeVar?.id === v.id
                                    ? 'border-[#141413] bg-white font-medium shadow-2xs'
                                    : 'border-[#E5E0D5] bg-[#F2ECE1] text-[#57534E] hover:border-[#DED8CC]'
                                }`}
                              >
                                <div>
                                  <div className="text-[#141413]">{v.name}</div>
                                  <div className="text-[11px] text-[#78746C]">
                                    {v.finish} · {v.stock} exemplaire{v.stock > 1 ? 's' : ''}
                                  </div>
                                </div>
                                <span className="font-mono tabular-nums text-[#141413]">
                                  {formatMoney(v.priceCents, currency)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Interactive City Lead-Time Estimator */}
                        <div className="p-3 rounded-xl bg-[#F2ECE1] border border-[#E5E0D5] space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[#141413] flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-[#C86D51]" />
                              <span>Estimation livraison & retrait :</span>
                            </span>
                            <select
                              aria-label="Ville de livraison estimée"
                              value={pdpCityEstimate}
                              onChange={(e) => setPdpCityEstimate(e.target.value)}
                              className="bg-white border border-[#DED8CC] rounded-md px-2 py-1 text-[11px] text-[#141413] focus:outline-none"
                            >
                              <option value="Douala (Coursier 24h ou Retrait Bonapriso)">
                                Douala (24h / Galerie)
                              </option>
                              <option value="Yaoundé (Coursier 24h–48h Bastos/Golf)">
                                Yaoundé (24h–48h)
                              </option>
                              <option value="Abidjan (Coursier 24h ou Retrait Cocody)">
                                Abidjan (24h / Galerie)
                              </option>
                              <option value="Dakar (Coursier 24h ou Retrait Almadies)">
                                Dakar (24h / Galerie)
                              </option>
                              <option value="Libreville / Kinshasa / Cotonou (DHL 48h–72h)">
                                Libreville / Kinshasa / Cotonou
                              </option>
                              <option value="Paris & International (48h)">
                                Paris & International (48h)
                              </option>
                            </select>
                          </div>
                          <p className="text-[11px] text-[#57534E]">{pdpCityEstimate}</p>
                        </div>

                        <div className="pt-2 border-t border-[#E5E0D5] space-y-1 text-xs text-[#57534E]">
                          <div>
                            <strong className="text-[#141413]">Façonnage : </strong>
                            {pdpProduct.craftsmanship}
                          </div>
                          <div>
                            <strong className="text-[#141413]">Dimensions : </strong>
                            {pdpProduct.dimensions}
                          </div>
                        </div>

                        <div className="pt-2 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="inline-flex items-center border border-[#DED8CC] rounded-xl bg-white">
                              <button
                                type="button"
                                onClick={() => setPdpQty((q) => Math.max(1, q - 1))}
                                className="p-2.5 text-[#57534E] hover:text-[#141413] cursor-pointer"
                                aria-label="Réduire la quantité"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-4 text-xs font-mono tabular-nums">
                                {pdpQty}
                              </span>
                              <button
                                type="button"
                                disabled={!activeVar || pdpQty >= activeVar.stock}
                                onClick={() =>
                                  setPdpQty((q) =>
                                    Math.min(activeVar?.stock || 1, q + 1)
                                  )
                                }
                                className="p-2.5 text-[#57534E] hover:text-[#141413] disabled:opacity-30 cursor-pointer"
                                aria-label="Augmenter la quantité"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={!activeVar || activeVar.stock <= 0}
                              onClick={() => {
                                if (activeVar) {
                                  handleAddToCart(activeVar.id, pdpQty);
                                  setPdpProduct(null);
                                  setIsCartOpen(true);
                                }
                              }}
                              className="flex-1 py-3 px-4 bg-[#141413] text-[#FAF7F2] text-xs font-medium rounded-xl hover:bg-[#292826] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              {!activeVar || activeVar.stock <= 0
                                ? 'Édition épuisée'
                                : `Acquérir — ${formatMoney(
                                    activeVar.priceCents * pdpQty,
                                    currency
                                  )}`}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={handleCopyWhatsAppInquiry}
                            className="w-full py-2 px-3 bg-white border border-[#DED8CC] text-[#141413] rounded-xl text-[11px] font-medium hover:bg-[#F2ECE1] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {copiedWhatsAppPdp ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Message copié pour notre Conciergerie WhatsApp</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#78746C]" />
                                <span>Copier la référence pour notre Conciergerie WhatsApp</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Cart & Checkout Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        quote={cartQuote}
        quoteLoading={quoteLoading}
        couponCode={couponCode}
        onCouponChange={setCouponCode}
        deliveryMode={deliveryMode}
        onDeliveryModeChange={setDeliveryMode}
        currency={currency}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCartItems([])}
        user={user}
        authToken={authToken}
        onOrderCreated={(createdOrder) => {
          setIsCartOpen(false);
          setCartItems([]);
          setCouponCode('');
          fetchCatalog();
          setSandboxOrder(createdOrder);
        }}
      />

      {/* Order Certificate & Mobile Money Confirmation Modal */}
      <OrderSandboxModal
        order={sandboxOrder}
        authToken={authToken}
        currency={currency}
        onClose={() => setSandboxOrder(null)}
        onOrderUpdated={() => {
          fetchCatalog();
        }}
      />

      {/* Multi-Column Architectural House Footer */}
      <footer className="border-t border-[#E5E0D5] bg-[#141413] text-[#E6E1D6] px-6 py-12 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#292826] text-xs">
          <div className="space-y-3">
            <div className="text-2xl font-display font-semibold text-[#FAF7F2]">
              Maison Véra
            </div>
            <p className="text-[#A1A1AA] leading-relaxed">
              Maison d’édition architecturale — Luminaires en albâtre et bronze de Foumban, mobilier en Iroko massif et acoustique haute-fidélité en grès de Katiola.
            </p>
            <div className="inline-flex items-center gap-2 text-[11px] text-[#D4A373] font-mono">
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Conciergerie : +237 699 45 12 88</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#D4A373]">
              Galeries & Showrooms
            </div>
            <ul className="space-y-1.5 text-[#A1A1AA]">
              <li>Douala · Bonapriso, Rue Njo-Njo</li>
              <li>Abidjan · Cocody Riviera 3</li>
              <li>Dakar · Corniche des Almadies</li>
              <li>Paris · 18 Rue de Seine, 6e</li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#D4A373]">
              Privilèges & Règlements
            </div>
            <p className="text-[#A1A1AA]">
              MTN Mobile Money · Orange Money · Wave · Paiement à la livraison · Visa / Mastercard.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(['BIENVENUE10', 'DAKAR25', 'VIP100'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleApplyPromoBannerCode(code, 'Privilège Maison')}
                  className="px-2 py-1 rounded bg-[#27272A] hover:bg-[#D4A373] hover:text-[#141413] text-[#FAF7F2] font-mono text-[10px] transition-colors cursor-pointer"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#D4A373]">
              Navigation de la Maison
            </div>
            <div className="flex flex-col items-start gap-1.5 text-[#A1A1AA]">
              <button
                type="button"
                onClick={() => setActiveView('storefront')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Collections Permanentes
              </button>
              <button
                type="button"
                onClick={() => setActiveView('craftsmanship')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                La Maison & Rendez-Vous en Galerie
              </button>
              <button
                type="button"
                onClick={() => setActiveView('account')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Suivi Direct de Commande & Cercle Privé
              </button>
              <button
                type="button"
                onClick={() => setActiveView('admin')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Portail de Direction
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#71717A]">
          <span>
            © {new Date().getFullYear()} Maison Véra — Douala · Abidjan · Dakar · Paris. Toutes éditions numérotées.
          </span>
          <span>
            Devises affichées : FCFA CEMAC (XAF) · FCFA UEMOA (XOF) · Euro (EUR)
          </span>
        </div>
      </footer>
    </div>
  );
}
