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

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState<string>('Tous');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc'>('featured');

  // Cart & Quote state
  const [cartItems, setCartItems] = useState<CartItemInput[]>([
    { variantId: 1, quantity: 1 },
  ]);
  const [couponCode, setCouponCode] = useState<string>('');
  const [cartQuote, setCartQuote] = useState<CartQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [justAddedVariantId, setJustAddedVariantId] = useState<number | null>(null);

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

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (categoryFilter !== 'Tous' && p.category !== categoryFilter) {
          return false;
        }
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          const matchTitle = p.title.toLowerCase().includes(q);
          const matchSub = p.subtitle.toLowerCase().includes(q);
          const matchSku = p.variants.some((v) => v.sku.toLowerCase().includes(q));
          return matchTitle || matchSub || matchSku;
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
  }, [products, categoryFilter, searchQuery, sortBy]);

  const totalCartUnits = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#18181B]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#FAF8F5]/95 backdrop-blur-xs border-b border-[#E4E0D8] px-6 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => setActiveView('storefront')}
          className="text-2xl font-display font-semibold tracking-tight text-[#18181B] whitespace-nowrap shrink-0 cursor-pointer"
        >
          Maison Véra
        </button>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Navigation principale"
          className="hidden md:flex items-center gap-8 text-xs font-medium text-[#52525B]"
        >
          <button
            type="button"
            onClick={() => setActiveView('storefront')}
            className={`hover:text-[#18181B] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeView === 'storefront'
                ? 'text-[#18181B] underline underline-offset-8'
                : ''
            }`}
          >
            Collections
          </button>
          <button
            type="button"
            onClick={() => setActiveView('craftsmanship')}
            className={`hover:text-[#18181B] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeView === 'craftsmanship'
                ? 'text-[#18181B] underline underline-offset-8'
                : ''
            }`}
          >
            La Maison & Showrooms
          </button>
          <button
            type="button"
            onClick={() => setActiveView('account')}
            className={`hover:text-[#18181B] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeView === 'account'
                ? 'text-[#18181B] underline underline-offset-8'
                : ''
            }`}
          >
            {user ? `Espace Privé (${user.name.split(' ')[0]})` : 'Suivi & Espace Client'}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className={`hover:text-[#18181B] transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeView === 'admin'
                ? 'text-[#18181B] underline underline-offset-8'
                : ''
            }`}
          >
            Direction
          </button>
        </nav>

        {/* Zone 3: 1 primary action button */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Panier</span>
            <span className="font-mono tabular-nums">({totalCartUnits})</span>
          </button>
        </div>
      </header>

      {/* Mobile Secondary Navigation Strip */}
      <div className="md:hidden flex items-center justify-around border-b border-[#E4E0D8] bg-[#F3EFEA] px-4 py-2 text-xs font-medium text-[#52525B]">
        <button
          type="button"
          onClick={() => setActiveView('storefront')}
          className={activeView === 'storefront' ? 'text-[#18181B] font-semibold' : ''}
        >
          Collections
        </button>
        <button
          type="button"
          onClick={() => setActiveView('craftsmanship')}
          className={activeView === 'craftsmanship' ? 'text-[#18181B] font-semibold' : ''}
        >
          La Maison
        </button>
        <button
          type="button"
          onClick={() => setActiveView('account')}
          className={activeView === 'account' ? 'text-[#18181B] font-semibold' : ''}
        >
          Espace Client
        </button>
        <button
          type="button"
          onClick={() => setActiveView('admin')}
          className={activeView === 'admin' ? 'text-[#18181B] font-semibold' : ''}
        >
          Direction
        </button>
      </div>

      {/* Hospitality & Currency Bar */}
      <div className="bg-[#F3EFEA] border-b border-[#E4E0D8] px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-[#52525B]">
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#18181B]" />
            <span>Showrooms : Douala (Bonapriso) · Abidjan (Cocody) · Dakar (Almadies)</span>
            <span aria-hidden="true">·</span>
            <Smartphone className="w-3.5 h-3.5 text-[#18181B]" />
            <span>Orange Money · MTN MoMo · Wave · Paiement à la livraison</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Currency Switcher */}
            <div className="flex items-center gap-1.5">
              <span className="text-[#71717A]">Devise :</span>
              <div
                role="group"
                aria-label="Sélectionner la devise"
                className="inline-flex bg-white border border-[#D6D1C7] rounded-md p-0.5"
              >
                {(
                  [
                    { code: 'XAF', label: 'FCFA (CEMAC)' },
                    { code: 'XOF', label: 'FCFA (UEMOA)' },
                    { code: 'EUR', label: 'EUR (€)' },
                  ] as Array<{ code: CurrencyCode; label: string }>
                ).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setCurrency(c.code)}
                    className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 ${
                      currency === c.code
                        ? 'bg-[#18181B] text-[#FAF8F5] font-medium'
                        : 'text-[#52525B] hover:text-[#18181B]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Light Connection Toggle */}
            <button
              type="button"
              onClick={() => setDataSaverMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                dataSaverMode
                  ? 'bg-[#18181B] text-[#FAF8F5] border-[#18181B]'
                  : 'bg-white text-[#52525B] border-[#D6D1C7] hover:text-[#18181B]'
              }`}
            >
              <Wifi className="w-3 h-3" />
              <span>
                {dataSaverMode ? 'Navigation allégée : Active' : 'Navigation allégée'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Router */}
      <main className="flex-1">
        {activeView === 'admin' ? (
          <AdminDashboard
            user={user}
            authToken={authToken}
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
          />
        ) : activeView === 'craftsmanship' ? (
          <section className="max-w-5xl mx-auto px-6 py-16 space-y-12">
            <div className="space-y-4 max-w-3xl">
              <p className="text-xs text-[#71717A]">
                Ateliers de Haute Facture · Douala · Abidjan · Dakar · Paris
              </p>
              <h1 className="text-4xl md:text-5xl font-display font-semibold text-[#18181B] leading-tight">
                Matières nobles du continent, dessin architectural et pérennité.
              </h1>
              <p className="text-base text-[#52525B] leading-relaxed">
                Maison Véra réunit maîtres fondeurs de Foumban, céramistes de Katiola et ébénistes autour d’une vision commune : façonner des pièces sculpturales numérotées, conçues pour traverser les générations et sublimer les grandes résidences contemporaines d’Afrique et d’ailleurs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-[#E4E0D8]">
              <div className="space-y-2">
                <span className="text-xs font-mono text-[#71717A]">
                  01. Douala · Bonapriso
                </span>
                <h2 className="text-xl font-display font-semibold text-[#18181B]">
                  Galerie & Atelier Afrique Centrale
                </h2>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  Rue Njo-Njo, Bonapriso. Présentation permanente de nos luminaires en bronze et mobilier en Iroko massif. Retrait sur place ou livraison par coursier dédié à Douala et Yaoundé.
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-mono text-[#71717A]">
                  02. Abidjan · Cocody Riviera
                </span>
                <h2 className="text-xl font-display font-semibold text-[#18181B]">
                  Salon d’Écoute & Mobilier
                </h2>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  Boulevard Arsène Usher Assouan, Cocody Riviera 3. Auditorium dédié au Monolithe Acoustique Aeon I et conseil en aménagement d’intérieur sur rendez-vous.
                </p>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-mono text-[#71717A]">
                  03. Dakar · Les Almadies
                </span>
                <h2 className="text-xl font-display font-semibold text-[#18181B]">
                  Pavillon Atlantique
                </h2>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  Route de Ngor, Les Almadies. Sélection d’éditions limitées résistantes aux climats côtiers, accompagnement des cabinets d’architecture et livraison gants blancs.
                </p>
              </div>
            </div>
          </section>
        ) : (
          /* Storefront View */
          <div className="space-y-16 pb-20">
            {/* Section 1: Storefront Split Hero */}
            <section className="max-w-7xl mx-auto px-6 pt-8 lg:pt-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-[#F3EFEA] border border-[#E4E0D8] rounded-2xl overflow-hidden">
                <div className="lg:col-span-6 p-8 md:p-12 flex flex-col justify-between space-y-8">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#52525B]">
                      <span>Collection Permanente 2026</span>
                      <span aria-hidden="true">·</span>
                      <span>Éditions Numérotées</span>
                      <span aria-hidden="true">·</span>
                      <span>Privilège -10% : AFRIQUE10</span>
                    </div>

                    <h1
                      className="font-display font-semibold text-[#18181B] leading-[1.08]"
                      style={{
                        fontSize: 'clamp(2.25rem, 3.8vw, 3.5rem)',
                        textWrap: 'balance',
                      }}
                    >
                      Haute facture architecturale & design contemporain africain.
                    </h1>

                    <p className="text-sm md:text-base text-[#52525B] leading-relaxed max-w-xl">
                      Luminaires en bronze de Foumban et albâtre naturel, assises basses en Iroko massif et monoblocs acoustiques en grès de Katiola. Façonnés à la main et livrés dans toute la zone CEMAC, l’UEMOA et à l’international.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <a
                      href="#collection-catalogue"
                      className="px-6 py-3 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors whitespace-nowrap shrink-0"
                    >
                      Découvrir la collection
                    </a>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(true)}
                      className="px-5 py-3 text-xs font-medium bg-white border border-[#D6D1C7] text-[#18181B] rounded-lg hover:bg-[#EFECE6] transition-colors whitespace-nowrap shrink-0"
                    >
                      Votre Sélection ({totalCartUnits})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveView('account')}
                      className="px-4 py-3 text-xs font-medium text-[#52525B] hover:text-[#18181B] underline underline-offset-4 whitespace-nowrap shrink-0"
                    >
                      Suivre une commande
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6 min-h-[300px] lg:min-h-[450px] relative">
                  {dataSaverMode ? (
                    <div className="w-full h-full bg-[#EFECE6] p-10 flex flex-col items-center justify-center text-center space-y-3">
                      <Wifi className="w-8 h-8 text-[#52525B]" />
                      <div className="text-sm font-semibold text-[#18181B]">
                        Navigation allégée activée
                      </div>
                      <p className="text-xs text-[#52525B] max-w-xs">
                        Les visuels haute définition sont masqués pour privilégier la fluidité sur réseau mobile.
                      </p>
                      <button
                        type="button"
                        onClick={() => setDataSaverMode(false)}
                        className="px-4 py-2 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg"
                      >
                        Afficher les photographies
                      </button>
                    </div>
                  ) : (
                    <ResilientImage
                      src="/src/assets/images/hero_architectural_lighting_1794937868913.jpg"
                      alt="Lampe sculpturale en albâtre et bronze sur socle en pierre dans un intérieur architectural"
                      className="w-full h-full lg:h-full object-cover"
                    />
                  )}
                </div>
              </div>
            </section>

            {/* Section 2: Featured Collection & Interactive Filters */}
            <section
              id="collection-catalogue"
              className="max-w-7xl mx-auto px-6 space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E4E0D8] pb-6">
                <div>
                  <p className="text-xs text-[#71717A]">
                    Pièces Numérotées · Livraison offerte dès 328 000 FCFA ou retrait gratuit en Showroom
                  </p>
                  <h2 className="text-3xl font-display font-semibold text-[#18181B] mt-1">
                    Les Créations de la Maison
                  </h2>
                </div>

                {/* Filter & Search Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    role="group"
                    aria-label="Filtrer par catégorie"
                    className="flex items-center gap-1 p-1 bg-[#EFECE6] border border-[#E4E0D8] rounded-lg"
                  >
                    {['Tous', 'Luminaires', 'Mobilier', 'Acoustique', 'Objets'].map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            categoryFilter === cat
                              ? 'bg-white text-[#18181B] shadow-xs'
                              : 'text-[#52525B] hover:text-[#18181B]'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher une pièce, matière..."
                      aria-label="Rechercher dans le catalogue"
                      className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B] w-52"
                    />
                  </div>

                  <div className="inline-flex items-center gap-1.5 bg-white border border-[#D6D1C7] rounded-lg px-2.5 py-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#71717A]" />
                    <select
                      aria-label="Trier les produits"
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(
                          e.target.value as 'featured' | 'price_asc' | 'price_desc'
                        )
                      }
                      className="text-xs bg-transparent text-[#18181B] focus:outline-none"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-[460px] bg-[#EFECE6] rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : catalogError ? (
                <div className="p-8 bg-red-50 border border-red-200 rounded-xl text-center space-y-3">
                  <p className="text-sm text-red-900 font-medium">{catalogError}</p>
                  <button
                    type="button"
                    onClick={fetchCatalog}
                    className="px-4 py-2 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg"
                  >
                    Actualiser
                  </button>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-12 bg-white border border-[#E4E0D8] rounded-xl text-center space-y-3">
                  <p className="text-base font-display text-[#52525B]">
                    Aucune création ne correspond à votre recherche.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryFilter('Tous');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg"
                  >
                    Afficher toute la collection
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredProducts.map((product) => {
                    const activeVariantId =
                      selectedVariants[product.id] ?? product.variants[0]?.id;
                    const activeVariant =
                      product.variants.find((v) => v.id === activeVariantId) ||
                      product.variants[0];

                    const isOutOfStock = !activeVariant || activeVariant.stock <= 0;
                    const wasJustAdded =
                      activeVariant && justAddedVariantId === activeVariant.id;

                    return (
                      <article
                        key={product.id}
                        className="group bg-white border border-[#E4E0D8] rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div>
                          <div
                            onClick={() => {
                              setPdpProduct(product);
                              setPdpQty(1);
                            }}
                            className="aspect-[4/3] w-full bg-[#EFECE6] overflow-hidden cursor-pointer relative"
                          >
                            {dataSaverMode ? (
                              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-[#52525B]">
                                <span className="text-xs font-mono uppercase">
                                  {product.category}
                                </span>
                                <span className="text-sm font-display font-semibold text-[#18181B] mt-1">
                                  {product.title}
                                </span>
                                <span className="text-[11px] text-[#71717A] mt-1">
                                  Toucher pour ouvrir la fiche détaillée
                                </span>
                              </div>
                            ) : (
                              <ResilientImage
                                src={product.imageUrl}
                                alt={product.title}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                              />
                            )}
                          </div>

                          {/* Card Body */}
                          <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between text-xs text-[#71717A]">
                              <div className="flex items-center gap-1.5">
                                <span className="uppercase tracking-wider">
                                  {product.category}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">
                                  {activeVariant?.sku}
                                </span>
                              </div>
                              <span
                                className={`font-mono tabular-nums ${
                                  isOutOfStock ? 'text-red-700' : 'text-[#52525B]'
                                }`}
                              >
                                {isOutOfStock
                                  ? 'Édition épuisée'
                                  : `${activeVariant.stock} exemplaire${activeVariant.stock > 1 ? 's' : ''}`}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <h3
                                onClick={() => {
                                  setPdpProduct(product);
                                  setPdpQty(1);
                                }}
                                className="text-base font-semibold text-[#18181B] hover:underline cursor-pointer"
                              >
                                {product.title}
                              </h3>
                              <div className="text-sm font-semibold font-mono tabular-nums text-[#18181B]">
                                {activeVariant
                                  ? formatDualPrice(activeVariant.priceCents, currency)
                                  : '—'}
                              </div>
                            </div>

                            <p className="text-xs text-[#52525B] line-clamp-2 leading-relaxed">
                              {product.description}
                            </p>

                            {/* Variant Selector */}
                            <div className="space-y-1.5 pt-1">
                              <label
                                htmlFor={`variant-select-${product.id}`}
                                className="block text-[11px] text-[#71717A]"
                              >
                                Finition & Édition ({product.variants.length}) :
                              </label>
                              <select
                                id={`variant-select-${product.id}`}
                                value={activeVariant?.id || ''}
                                onChange={(e) =>
                                  setSelectedVariants((prev) => ({
                                    ...prev,
                                    [product.id]: Number(e.target.value),
                                  }))
                                }
                                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg text-[#18181B] focus:outline-none focus:border-[#18181B]"
                              >
                                {product.variants.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name} — {formatMoney(v.priceCents, currency)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer Actions */}
                        <div className="px-6 pb-6 pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() =>
                              activeVariant && handleAddToCart(activeVariant.id, 1)
                            }
                            className="flex-1 py-2.5 px-4 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            {wasJustAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Ajouté à votre sélection</span>
                              </>
                            ) : isOutOfStock ? (
                              <span>Indisponible</span>
                            ) : (
                              <span>Acquérir cette pièce</span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPdpProduct(product);
                              setPdpQty(1);
                            }}
                            className="p-2.5 border border-[#D6D1C7] bg-white text-[#18181B] rounded-lg hover:bg-[#EFECE6] transition-colors"
                            aria-label={`Détails de ${product.title}`}
                            title="Voir les détails & dimensions"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Section 3: Luxury Hospitality & Service Pillars */}
            <section className="max-w-7xl mx-auto px-6">
              <div className="bg-[#F3EFEA] border border-[#E4E0D8] rounded-2xl p-8 md:p-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#71717A]">
                    01 · Savoir-Faire & Matières
                  </span>
                  <h3 className="text-lg font-display font-semibold text-[#18181B]">
                    Bronze de Foumban, Iroko & Grès de Katiola
                  </h3>
                  <p className="text-xs text-[#52525B] leading-relaxed">
                    Chaque création est façonnée à la main en série limitée, numérotée et accompagnée de son certificat d’authenticité signé par l’atelier.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#71717A]">
                    02 · Règlement Sur-Mesure
                  </span>
                  <h3 className="text-lg font-display font-semibold text-[#18181B]">
                    Mobile Money, Carte ou À la Livraison
                  </h3>
                  <p className="text-xs text-[#52525B] leading-relaxed">
                    Réglez en Francs CFA (XAF / XOF) ou en Euros via Orange Money, MTN Mobile Money, Wave, carte bancaire internationale ou directement à la réception auprès de notre coursier.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#71717A]">
                    03 · Livraison Gants Blancs
                  </span>
                  <h3 className="text-lg font-display font-semibold text-[#18181B]">
                    Showrooms & Coursier Dédié
                  </h3>
                  <p className="text-xs text-[#52525B] leading-relaxed">
                    Retirez gratuitement vos pièces dans nos galeries de Douala, Abidjan et Dakar, ou bénéficiez d’une livraison assurée jusqu’à votre porte avec prise de rendez-vous téléphonique.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Contiguous Purchase Module (PDP Modal) */}
      {pdpProduct && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Fiche produit ${pdpProduct.title}`}
        >
          <div className="bg-[#FAF8F5] border border-[#E4E0D8] rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-8">
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-6 bg-[#EFECE6] relative min-h-[300px]">
                <ResilientImage
                  src={pdpProduct.imageUrl}
                  alt={pdpProduct.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="md:col-span-6 p-6 md:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-[#71717A]">
                      {pdpProduct.category} · {pdpProduct.subtitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPdpProduct(null)}
                      className="p-1.5 text-[#52525B] hover:text-[#18181B] rounded-lg"
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

                    return (
                      <>
                        <div>
                          <h2 className="text-2xl md:text-3xl font-display font-semibold text-[#18181B]">
                            {pdpProduct.title}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-lg font-mono tabular-nums font-semibold text-[#18181B]">
                              {activeVar
                                ? formatDualPrice(activeVar.priceCents, currency)
                                : '—'}
                            </span>
                            <span aria-hidden="true" className="text-[#D6D1C7]">
                              ·
                            </span>
                            <span className="text-xs font-mono text-[#52525B]">
                              Réf. {activeVar?.sku} ({activeVar?.stock ?? 0} disponible
                              {(activeVar?.stock ?? 0) > 1 ? 's' : ''})
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-[#3F3F46] leading-relaxed">
                          {pdpProduct.description}
                        </p>

                        <div className="space-y-2">
                          <span className="block text-xs font-medium text-[#18181B]">
                            Choisir la finition :
                          </span>
                          <div className="space-y-2">
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
                                className={`w-full text-left p-3 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                                  activeVar?.id === v.id
                                    ? 'border-[#18181B] bg-white font-medium'
                                    : 'border-[#E4E0D8] bg-[#F3EFEA] text-[#52525B] hover:border-[#D6D1C7]'
                                }`}
                              >
                                <div>
                                  <div className="text-[#18181B]">{v.name}</div>
                                  <div className="text-[11px] text-[#71717A]">
                                    {v.finish} · {v.stock} exemplaire{v.stock > 1 ? 's' : ''}
                                  </div>
                                </div>
                                <span className="font-mono tabular-nums text-[#18181B]">
                                  {formatMoney(v.priceCents, currency)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[#E4E0D8] space-y-1.5 text-xs text-[#52525B]">
                          <div>
                            <strong className="text-[#18181B]">Façonnage : </strong>
                            {pdpProduct.craftsmanship}
                          </div>
                          <div>
                            <strong className="text-[#18181B]">Dimensions : </strong>
                            {pdpProduct.dimensions}
                          </div>
                        </div>

                        <div className="pt-4 flex items-center gap-3">
                          <div className="inline-flex items-center border border-[#D6D1C7] rounded-lg bg-white">
                            <button
                              type="button"
                              onClick={() => setPdpQty((q) => Math.max(1, q - 1))}
                              className="p-2.5 text-[#52525B] hover:text-[#18181B]"
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
                              className="p-2.5 text-[#52525B] hover:text-[#18181B] disabled:opacity-30"
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
                            className="flex-1 py-3 px-4 bg-[#18181B] text-[#FAF8F5] text-xs font-medium rounded-lg hover:bg-[#27272A] disabled:opacity-40 transition-colors whitespace-nowrap"
                          >
                            {!activeVar || activeVar.stock <= 0
                              ? 'Édition épuisée'
                              : `Acquérir — ${formatMoney(
                                  activeVar.priceCents * pdpQty,
                                  currency
                                )}`}
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

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E4E0D8] bg-[#F3EFEA] px-6 py-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
          <div>
            <span className="font-display font-semibold text-sm text-[#18181B]">
              Maison Véra
            </span>
            <span className="mx-2">·</span>
            <span>
              Douala · Abidjan · Dakar · Paris — Haute Facture Architecturale & Mobilier Contemporain
            </span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveView('storefront')}
              className="hover:text-[#18181B] transition-colors"
            >
              Collections
            </button>
            <button
              type="button"
              onClick={() => setActiveView('craftsmanship')}
              className="hover:text-[#18181B] transition-colors"
            >
              Showrooms
            </button>
            <button
              type="button"
              onClick={() => setActiveView('account')}
              className="hover:text-[#18181B] transition-colors"
            >
              Suivi & Espace Client
            </button>
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className="hover:text-[#18181B] transition-colors"
            >
              Direction
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
