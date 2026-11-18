import React, { useEffect, useState } from 'react';
import {
  X,
  Minus,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  MapPin,
  Truck,
  Sparkles,
  Gift,
  Check,
  Clock,
} from 'lucide-react';
import type {
  CartItemInput,
  CartQuote,
  CurrencyCode,
  DeliveryModeType,
  OrderDTO,
  PaymentMethodType,
  UserProfile,
} from '../shared/types.ts';
import {
  formatDeliveryModeLabel,
  formatDualPrice,
  formatMoney,
  formatPaymentMethodLabel,
} from '../utils/format.ts';
import { ResilientImage } from './ResilientImage.tsx';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItemInput[];
  quote: CartQuote | null;
  quoteLoading: boolean;
  couponCode: string;
  onCouponChange: (code: string) => void;
  deliveryMode: DeliveryModeType;
  onDeliveryModeChange: (mode: DeliveryModeType) => void;
  currency: CurrencyCode;
  onUpdateQuantity: (variantId: number, quantity: number) => void;
  onRemoveItem: (variantId: number) => void;
  onClearCart: () => void;
  user: UserProfile | null;
  authToken: string | null;
  onOrderCreated: (order: OrderDTO) => void;
}

const SHOWROOM_CITIES = [
  {
    label: 'Douala · Bonapriso',
    country: 'Cameroun',
    city: 'Douala',
    address: 'Quartier Bonapriso, Rue Njo-Njo',
    landmark: 'En face de l’Hôtel Akwa Palace',
    phone: '+237 699 45 12 88',
    postal: 'BP 4022',
    payment: 'mtn_momo' as PaymentMethodType,
  },
  {
    label: 'Yaoundé · Bastos',
    country: 'Cameroun',
    city: 'Yaoundé',
    address: 'Quartier Bastos, Avenue Jean-Paul II',
    landmark: 'À proximité de la Résidence diplomatique',
    phone: '+237 677 81 30 90',
    postal: 'BP 1105',
    payment: 'orange_money' as PaymentMethodType,
  },
  {
    label: 'Abidjan · Cocody',
    country: 'Côte d’Ivoire',
    city: 'Abidjan',
    address: 'Cocody Riviera 3, Boulevard Arsène Usher Assouan',
    landmark: 'À 150m du Lycée Blaise Pascal',
    phone: '+225 07 08 44 91 20',
    postal: '08 BP 204',
    payment: 'orange_money' as PaymentMethodType,
  },
  {
    label: 'Dakar · Almadies',
    country: 'Sénégal',
    city: 'Dakar',
    address: 'Les Almadies, Route de Ngor',
    landmark: 'Corniche Ouest, Résidence Les Palmiers',
    phone: '+221 77 640 18 92',
    postal: 'BP 12500',
    payment: 'wave' as PaymentMethodType,
  },
  {
    label: 'Libreville · Sablière',
    country: 'Gabon',
    city: 'Libreville',
    address: 'Quartier La Sablière, Bord de Mer',
    landmark: 'Près de la Résidence les Acacias',
    phone: '+241 77 32 10 45',
    postal: 'BP 2100',
    payment: 'mtn_momo' as PaymentMethodType,
  },
  {
    label: 'Kinshasa · Gombe',
    country: 'RD Congo',
    city: 'Kinshasa',
    address: 'Commune de la Gombe, Boulevard du 30 Juin',
    landmark: 'Immeuble Crown Tower, Entrée Sud',
    phone: '+243 81 550 22 10',
    postal: 'BP 1040',
    payment: 'orange_money' as PaymentMethodType,
  },
];

const QUICK_PRIVILEGE_CODES = [
  { code: 'AFRIQUE10', label: '-10% Sans min.' },
  { code: 'MOMO15', label: '-15% Mobile Money' },
  { code: 'DAKAR25', label: '-25% dès 600 €' },
  { code: 'VIP100', label: '-100 € dès 1 000 €' },
];

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  quote,
  quoteLoading,
  couponCode,
  onCouponChange,
  deliveryMode,
  onDeliveryModeChange,
  currency,
  onUpdateQuantity,
  onRemoveItem,
  user,
  authToken,
  onOrderCreated,
}) => {
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [customerName, setCustomerName] = useState(
    user?.name || 'Claire Ndongo-Moreau'
  );
  const [customerEmail, setCustomerEmail] = useState(
    user?.email || 'claire.moreau@example.test'
  );
  const [customerPhone, setCustomerPhone] = useState('+237 699 45 12 88');
  const [shippingCountry, setShippingCountry] = useState('Cameroun');
  const [shippingCity, setShippingCity] = useState('Douala');
  const [shippingAddress, setShippingAddress] = useState(
    'Quartier Bonapriso, Rue Njo-Njo'
  );
  const [landmark, setLandmark] = useState(
    'En face de l’Hôtel Akwa Palace'
  );
  const [shippingPostalCode, setShippingPostalCode] = useState('BP 4022');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodType>('mtn_momo');
  const [paymentPhone, setPaymentPhone] = useState('+237 699 45 12 88');
  const [deliverySlot, setDeliverySlot] = useState('Après-midi (14h00 – 18h00)');
  const [includeGiftNote, setIncludeGiftNote] = useState(false);
  const [giftDedication, setGiftDedication] = useState('');

  const [couponDraft, setCouponDraft] = useState(couponCode);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    setCouponDraft(couponCode);
  }, [couponCode]);

  useEffect(() => {
    if (user) {
      setCustomerName(user.name);
      setCustomerEmail(user.email);
    }
  }, [user]);

  if (!isOpen) return null;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    onCouponChange(couponDraft.trim().toUpperCase());
  };

  const applyCitySelection = (preset: (typeof SHOWROOM_CITIES)[number]) => {
    setShippingCountry(preset.country);
    setShippingCity(preset.city);
    setShippingAddress(preset.address);
    setLandmark(preset.landmark);
    setCustomerPhone(preset.phone);
    setPaymentPhone(preset.phone);
    setShippingPostalCode(preset.postal);
    setPaymentMethod(preset.payment);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote || quote.items.length === 0) return;

    setSubmitting(true);
    setCheckoutError(null);

    const idempotencyKey = `chk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const landmarkParts = [landmark.trim()].filter(Boolean);
    landmarkParts.push(`[Créneau souhaité : ${deliverySlot}]`);
    if (includeGiftNote && giftDedication.trim()) {
      landmarkParts.push(`[Certificat dédicacé : ${giftDedication.trim()}]`);
    }
    const enrichedLandmark = landmarkParts.join(' · ');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cartItems,
          couponCode: quote.appliedCoupon?.code || null,
          customerName,
          customerEmail,
          customerPhone,
          shippingAddress,
          shippingCity,
          shippingPostalCode,
          shippingCountry,
          landmark: enrichedLandmark,
          deliveryMode,
          paymentMethod,
          paymentPhone: paymentPhone || customerPhone,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la validation de la commande');
      }

      setStep('cart');
      onOrderCreated(data.order);
    } catch (err: unknown) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Erreur lors du passage de commande'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const items = quote?.items || [];
  const freeShippingThreshold = quote?.freeShippingThresholdCents || 50000;
  const discountedSubtotal = Math.max(
    0,
    (quote?.subtotalCents || 0) - (quote?.discountCents || 0)
  );
  const remainingForFreeShipping = Math.max(
    0,
    freeShippingThreshold - discountedSubtotal
  );
  const freeShippingProgressPct = Math.min(
    100,
    Math.round((discountedSubtotal / freeShippingThreshold) * 100)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="Panier et commande"
    >
      <div className="relative w-full max-w-xl bg-[#FAF7F2] h-full flex flex-col border-l border-[#E5E0D5] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E0D5] bg-[#F2ECE1]">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#C86D51]">
              <span>Étape {step === 'cart' ? '1 / 2' : '2 / 2'}</span>
              <span>·</span>
              <span>{step === 'cart' ? 'Sélection & Privilèges' : 'Livraison & Règlement'}</span>
            </div>
            <h2 className="text-2xl font-display font-semibold text-[#141413] mt-0.5">
              {step === 'cart'
                ? 'Votre Sélection Maison Véra'
                : 'Coordonnées & Règlement'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#57534E] hover:text-[#141413] transition-colors rounded-lg cursor-pointer"
            aria-label="Fermer le panier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-xl font-display text-[#57534E]">
                Votre sélection est actuellement vide.
              </p>
              <p className="text-xs text-[#78746C] max-w-xs mx-auto leading-relaxed">
                Découvrez nos pièces numérotées façonnées pour les intérieurs de Douala, Abidjan, Dakar et Paris.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors cursor-pointer"
              >
                Découvrir la collection
              </button>
            </div>
          ) : step === 'cart' ? (
            <>
              {/* Dynamic White-Glove Free Shipping Progress Bar */}
              <div className="p-4 bg-white border border-[#E5E0D5] rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  {remainingForFreeShipping === 0 || deliveryMode === 'pickup_showroom' ? (
                    <span className="font-medium text-emerald-900 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>
                        Livraison Gants Blancs & Assurance offertes sur votre commande
                      </span>
                    </span>
                  ) : (
                    <span className="text-[#57534E]">
                      Plus que{' '}
                      <strong className="font-mono text-[#141413]">
                        {formatMoney(remainingForFreeShipping, currency)}
                      </strong>{' '}
                      pour bénéficier de la livraison offerte
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-[#78746C]">
                    {deliveryMode === 'pickup_showroom' ? '100%' : `${freeShippingProgressPct}%`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#F2ECE1] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C86D51] transition-all duration-300"
                    style={{
                      width: `${deliveryMode === 'pickup_showroom' ? 100 : freeShippingProgressPct}%`,
                    }}
                  />
                </div>
              </div>

              {/* Delivery Mode Selector */}
              <div className="p-4 bg-[#F2ECE1] border border-[#E5E0D5] rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#141413]">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#C86D51]" />
                    <span>Mode de réception</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {quote?.shippingCents === 0
                      ? 'Offert'
                      : quote
                        ? formatMoney(quote.shippingCents, currency)
                        : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      'home_express',
                      'pickup_showroom',
                      'regional_dhl',
                    ] as DeliveryModeType[]
                  ).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onDeliveryModeChange(mode)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        deliveryMode === mode
                          ? 'bg-white border-[#141413] text-[#141413] font-medium shadow-2xs'
                          : 'bg-[#FAF7F2] border-[#E5E0D5] text-[#57534E] hover:border-[#DED8CC]'
                      }`}
                    >
                      <span>{formatDeliveryModeLabel(mode)}</span>
                      <span className="font-mono text-[11px] shrink-0 ml-2 text-[#78746C]">
                        {mode === 'pickup_showroom'
                          ? 'Offert'
                          : mode === 'home_express'
                            ? 'Offert dès 328 000 FCFA'
                            : 'Afrique & International'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Itemized List */}
              <div className="divide-y divide-[#E5E0D5]">
                {items.map((item) => (
                  <div key={item.variantId} className="py-4 flex gap-4">
                    <ResilientImage
                      src={item.imageUrl}
                      alt={item.productTitle}
                      className="w-20 h-20 object-cover rounded-xl border border-[#E5E0D5] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-[#141413] truncate">
                            {item.productTitle}
                          </h3>
                          <p className="text-xs text-[#57534E] mt-0.5">
                            {item.variantName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.variantId)}
                          className="text-[#78746C] hover:text-red-700 p-1 transition-colors cursor-pointer"
                          aria-label={`Retirer ${item.productTitle}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="inline-flex items-center border border-[#DED8CC] rounded-lg bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(item.variantId, item.quantity - 1)
                            }
                            className="p-1.5 text-[#57534E] hover:text-[#141413] transition-colors cursor-pointer"
                            aria-label="Diminuer la quantité"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-mono tabular-nums text-[#141413]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.availableStock}
                            onClick={() =>
                              onUpdateQuantity(item.variantId, item.quantity + 1)
                            }
                            className="p-1.5 text-[#57534E] hover:text-[#141413] disabled:opacity-30 transition-colors cursor-pointer"
                            aria-label="Augmenter la quantité"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-semibold font-mono tabular-nums text-[#141413]">
                            {formatMoney(item.lineTotalCents, currency)}
                          </div>
                          <div className="text-[11px] text-[#78746C] font-mono tabular-nums">
                            {formatMoney(item.unitPriceCents, currency)} / pièce
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Section with 1-Click Privilege Selector */}
              <div className="pt-3 border-t border-[#E5E0D5] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#141413] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C86D51]" />
                    <span>Code privilège ou invitation Cercle Privé :</span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PRIVILEGE_CODES.map((p) => {
                    const isActive = couponCode === p.code;
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => {
                          setCouponDraft(p.code);
                          onCouponChange(p.code);
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#141413] text-[#FAF7F2] border-[#141413] font-medium'
                            : 'bg-white text-[#57534E] border-[#DED8CC] hover:border-[#141413]'
                        }`}
                      >
                        {p.code} · {p.label}
                      </button>
                    );
                  })}
                </div>

                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponDraft}
                    onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                    placeholder="Saisir un code (ex: AFRIQUE10, DAKAR25)"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413] font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-[#F2ECE1] text-[#141413] border border-[#DED8CC] rounded-xl hover:bg-[#E5E0D5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Appliquer
                  </button>
                  {couponCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setCouponDraft('');
                        onCouponChange('');
                      }}
                      className="px-3 py-2 text-xs text-[#78746C] hover:text-[#141413] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Retirer
                    </button>
                  )}
                </form>

                {quote?.appliedCoupon && (
                  <p className="text-xs text-emerald-800 bg-emerald-50/80 border border-emerald-200 rounded-lg px-3 py-2">
                    Privilège actif :{' '}
                    <span className="font-mono font-semibold">
                      {quote.appliedCoupon.code}
                    </span>{' '}
                    — {quote.appliedCoupon.description}
                  </p>
                )}
                {quote?.couponError && (
                  <p className="text-xs text-red-700" role="alert">
                    {quote.couponError}
                  </p>
                )}
              </div>
            </>
          ) : (
            /* Step 2: Delivery & Payment */
            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-5">
              {/* Showroom City Quick Selection (6 African Hubs) */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-[#57534E] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#C86D51]" />
                  <span>Sélection rapide de votre métropole :</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {SHOWROOM_CITIES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyCitySelection(preset)}
                      className={`px-3 py-2 text-xs rounded-xl border text-left transition-colors cursor-pointer ${
                        shippingCity === preset.city
                          ? 'bg-[#141413] text-[#FAF7F2] border-[#141413] font-medium'
                          : 'bg-white text-[#57534E] border-[#DED8CC] hover:bg-[#F2ECE1]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                    Nom complet du destinataire
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                    Téléphone Mobile / WhatsApp
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      if (!paymentPhone) setPaymentPhone(e.target.value);
                    }}
                    placeholder="+237 699 45 12 88"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                    Pays
                  </label>
                  <select
                    value={shippingCountry}
                    onChange={(e) => setShippingCountry(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
                  >
                    <option value="Cameroun">Cameroun (+237)</option>
                    <option value="Côte d’Ivoire">Côte d’Ivoire (+225)</option>
                    <option value="Sénégal">Sénégal (+221)</option>
                    <option value="Gabon">Gabon (+241)</option>
                    <option value="RD Congo">RD Congo (+243)</option>
                    <option value="Bénin">Bénin (+229)</option>
                    <option value="Togo">Togo (+228)</option>
                    <option value="Maroc">Maroc (+212)</option>
                    <option value="France">France / International</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                    Ville
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                    Adresse email (Certificat)
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Quartier, Commune & Rue
                </label>
                <input
                  type="text"
                  required
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Ex: Quartier Bonapriso, Rue Njo-Njo"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Point de repère précis pour le coursier
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="Ex: En face de l'Hôtel Akwa Palace, 2e portail"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
                />
              </div>

              {/* Preferred Delivery Window */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-[#3F3F46] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#C86D51]" />
                  <span>Créneau de passage souhaité :</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {[
                    'Matin (09h00 – 12h00)',
                    'Après-midi (14h00 – 18h00)',
                    'Soirée Privée (18h00 – 20h00)',
                  ].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setDeliverySlot(slot)}
                      className={`px-2.5 py-2 text-[11px] rounded-xl border text-center transition-colors whitespace-nowrap cursor-pointer ${
                        deliverySlot === slot
                          ? 'bg-[#141413] text-[#FAF7F2] border-[#141413] font-medium'
                          : 'bg-white text-[#57534E] border-[#DED8CC] hover:bg-[#F2ECE1]'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Calligraphed Certificate Dedication */}
              <div className="p-3.5 bg-white border border-[#E5E0D5] rounded-xl space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-[#141413] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeGiftNote}
                    onChange={(e) => setIncludeGiftNote(e.target.checked)}
                    className="rounded border-[#DED8CC]"
                  />
                  <Gift className="w-3.5 h-3.5 text-[#C86D51]" />
                  <span>
                    Dédicacer le certificat d’authenticité ou offrir en cadeau (Offert)
                  </span>
                </label>
                {includeGiftNote && (
                  <input
                    type="text"
                    value={giftDedication}
                    onChange={(e) => setGiftDedication(e.target.value)}
                    placeholder="Nom du bénéficiaire ou message à calligraphier sur le certificat..."
                    className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#DED8CC] rounded-lg focus:outline-none focus:border-[#141413]"
                  />
                )}
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-2.5 pt-2 border-t border-[#E5E0D5]">
                <label className="block text-xs font-semibold text-[#141413] flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#C86D51]" />
                  <span>Mode de règlement :</span>
                </label>

                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      {
                        id: 'mtn_momo',
                        title: 'MTN Mobile Money (MoMo)',
                        desc: 'Confirmation directe sur votre mobile MTN (*126#)',
                      },
                      {
                        id: 'orange_money',
                        title: 'Orange Money',
                        desc: 'Confirmation directe sur votre mobile Orange (#150#)',
                      },
                      {
                        id: 'wave',
                        title: 'Wave Mobile Money',
                        desc: 'Validation instantanée depuis votre application Wave',
                      },
                      {
                        id: 'cash_on_delivery',
                        title: 'Paiement à la livraison',
                        desc: 'Règlement en espèces ou Mobile Money à la réception de vos pièces',
                      },
                      {
                        id: 'card',
                        title: 'Carte Bancaire Visa / Mastercard',
                        desc: 'Transaction internationale sécurisée 3D-Secure',
                      },
                    ] as Array<{ id: PaymentMethodType; title: string; desc: string }>
                  ).map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`text-left p-3 rounded-xl border text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        paymentMethod === pm.id
                          ? 'bg-white border-[#141413] ring-1 ring-[#141413]'
                          : 'bg-[#FAF7F2] border-[#E5E0D5] hover:border-[#DED8CC]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-[#141413]">{pm.title}</div>
                        <div className="text-[11px] text-[#78746C] mt-0.5">{pm.desc}</div>
                      </div>
                      <span className="text-[11px] font-medium text-[#57534E] shrink-0 ml-2">
                        {paymentMethod === pm.id ? 'Sélectionné' : 'Choisir'}
                      </span>
                    </button>
                  ))}
                </div>

                {(paymentMethod === 'mtn_momo' ||
                  paymentMethod === 'orange_money' ||
                  paymentMethod === 'wave') && (
                  <div className="p-3.5 bg-[#F2ECE1] border border-[#DED8CC] rounded-xl space-y-1.5">
                    <label className="block text-xs font-medium text-[#141413]">
                      Numéro {formatPaymentMethodLabel(paymentMethod)} :
                    </label>
                    <input
                      type="tel"
                      required
                      value={paymentPhone}
                      onChange={(e) => setPaymentPhone(e.target.value)}
                      placeholder="+237 6..."
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#DED8CC] rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-[#F2ECE1] border border-[#E5E0D5] rounded-xl text-xs text-[#57534E] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#C86D51] shrink-0 mt-0.5" />
                <span>
                  Certificat d’authenticité numéroté et garantie 5 ans inclus avec chaque pièce Maison Véra.
                </span>
              </div>

              {checkoutError && (
                <div
                  className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800"
                  role="alert"
                >
                  {checkoutError}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer Totals & Primary CTA */}
        {items.length > 0 && quote && (
          <div className="px-6 py-5 bg-[#F2ECE1] border-t border-[#E5E0D5] space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#57534E]">
                <span>Sous-total pièces</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(quote.subtotalCents, currency)}
                </span>
              </div>
              {quote.discountCents > 0 && (
                <div className="flex justify-between text-emerald-800 font-medium">
                  <span>Remise privilège ({quote.appliedCoupon?.code})</span>
                  <span className="font-mono tabular-nums">
                    -{formatMoney(quote.discountCents, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[#57534E]">
                <span>Livraison & Assurance</span>
                <span className="font-mono tabular-nums">
                  {quote.shippingCents === 0
                    ? 'Offerte'
                    : formatMoney(quote.shippingCents, currency)}
                </span>
              </div>
              <div className="flex justify-between text-[#78746C]">
                <span>Dont taxes incluses (20%)</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(quote.taxCents, currency)}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-base font-semibold text-[#141413] pt-2 border-t border-[#DED8CC]">
                <span>Total TTC</span>
                <span className="font-mono tabular-nums">
                  {quoteLoading
                    ? 'Calcul...'
                    : formatDualPrice(quote.totalCents, currency)}
                </span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full py-3.5 px-4 bg-[#141413] text-[#FAF7F2] text-xs font-medium rounded-xl hover:bg-[#292826] transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <span>Poursuivre vers la livraison & le règlement</span>
                <ArrowRight className="w-4 h-4 text-[#D4A373]" />
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="px-4 py-3 text-xs font-medium border border-[#DED8CC] bg-white text-[#141413] rounded-xl hover:bg-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-[#141413] text-[#FAF7F2] text-xs font-medium rounded-xl hover:bg-[#292826] disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {submitting
                    ? 'Validation en cours...'
                    : `Confirmer la commande (${formatMoney(quote.totalCents, currency)})`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
