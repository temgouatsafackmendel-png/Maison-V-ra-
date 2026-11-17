import React, { useState } from 'react';
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

  const [couponDraft, setCouponDraft] = useState(couponCode);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
          landmark,
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

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px] transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label="Panier et commande"
    >
      <div className="relative w-full max-w-xl bg-[#FAF8F5] h-full flex flex-col border-l border-[#E4E0D8] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E4E0D8] bg-[#F3EFEA]">
          <div>
            <h2 className="text-2xl font-display font-semibold text-[#18181B]">
              {step === 'cart'
                ? 'Votre Sélection'
                : 'Coordonnées & Règlement'}
            </h2>
            <p className="text-xs text-[#52525B] mt-0.5">
              Maison Véra · Expédition assurée & emballage sur-mesure
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#52525B] hover:text-[#18181B] transition-colors rounded-lg"
            aria-label="Fermer le panier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <p className="text-lg font-display text-[#52525B]">
                Votre sélection est actuellement vide.
              </p>
              <p className="text-xs text-[#71717A] max-w-xs mx-auto">
                Découvrez nos collections façonnées pour les intérieurs de Douala, Abidjan, Dakar et Paris.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors"
              >
                Découvrir la collection
              </button>
            </div>
          ) : step === 'cart' ? (
            <>
              {/* Delivery Mode Selector */}
              <div className="p-4 bg-[#F3EFEA] border border-[#E4E0D8] rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-[#18181B]">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
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
                      className={`text-left px-3 py-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                        deliveryMode === mode
                          ? 'bg-white border-[#18181B] text-[#18181B] font-medium'
                          : 'bg-[#FAF8F5] border-[#E4E0D8] text-[#52525B] hover:border-[#D6D1C7]'
                      }`}
                    >
                      <span>{formatDeliveryModeLabel(mode)}</span>
                      <span className="font-mono text-[11px] shrink-0 ml-2 text-[#71717A]">
                        {mode === 'pickup_showroom'
                          ? 'Offert'
                          : mode === 'home_express'
                            ? 'Offert dès 328 000 FCFA'
                            : 'International'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Itemized List */}
              <div className="divide-y divide-[#E4E0D8]">
                {items.map((item) => (
                  <div key={item.variantId} className="py-4 flex gap-4">
                    <ResilientImage
                      src={item.imageUrl}
                      alt={item.productTitle}
                      className="w-20 h-20 object-cover rounded-md border border-[#E4E0D8] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-[#18181B] truncate">
                            {item.productTitle}
                          </h3>
                          <p className="text-xs text-[#52525B] mt-0.5">
                            {item.variantName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.variantId)}
                          className="text-[#71717A] hover:text-red-700 p-1 transition-colors"
                          aria-label={`Retirer ${item.productTitle}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="inline-flex items-center border border-[#D6D1C7] rounded-md bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateQuantity(item.variantId, item.quantity - 1)
                            }
                            className="p-1.5 text-[#52525B] hover:text-[#18181B] transition-colors"
                            aria-label="Diminuer la quantité"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-3 text-xs font-mono tabular-nums text-[#18181B]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.availableStock}
                            onClick={() =>
                              onUpdateQuantity(item.variantId, item.quantity + 1)
                            }
                            className="p-1.5 text-[#52525B] hover:text-[#18181B] disabled:opacity-30 transition-colors"
                            aria-label="Augmenter la quantité"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-semibold font-mono tabular-nums text-[#18181B]">
                            {formatMoney(item.lineTotalCents, currency)}
                          </div>
                          <div className="text-[11px] text-[#71717A] font-mono tabular-nums">
                            {formatMoney(item.unitPriceCents, currency)} / pièce
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coupon Section */}
              <div className="pt-3 border-t border-[#E4E0D8] space-y-2.5">
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <input
                    type="text"
                    value={couponDraft}
                    onChange={(e) => setCouponDraft(e.target.value.toUpperCase())}
                    placeholder="Code privilège (ex: AFRIQUE10, MOMO15)"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B] font-mono uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium bg-[#EFECE6] text-[#18181B] border border-[#D6D1C7] rounded-lg hover:bg-[#E4E0D8] transition-colors whitespace-nowrap shrink-0"
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
                      className="px-3 py-2 text-xs text-[#71717A] hover:text-[#18181B] whitespace-nowrap shrink-0"
                    >
                      Retirer
                    </button>
                  )}
                </form>

                {quote?.appliedCoupon && (
                  <p className="text-xs text-emerald-800">
                    Privilège appliqué :{' '}
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
              {/* Showroom City Quick Selection */}
              <div className="space-y-2">
                <span className="text-xs font-medium text-[#52525B] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#18181B]" />
                  <span>Sélection rapide de votre métropole :</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SHOWROOM_CITIES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyCitySelection(preset)}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                        shippingCity === preset.city
                          ? 'bg-[#18181B] text-[#FAF8F5] border-[#18181B]'
                          : 'bg-white text-[#52525B] border-[#D6D1C7] hover:bg-[#EFECE6]'
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
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
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
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
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
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
                  >
                    <option value="Cameroun">Cameroun (+237)</option>
                    <option value="Côte d’Ivoire">Côte d’Ivoire (+225)</option>
                    <option value="Sénégal">Sénégal (+221)</option>
                    <option value="Gabon">Gabon (+241)</option>
                    <option value="Bénin">Bénin (+229)</option>
                    <option value="RD Congo">RD Congo (+243)</option>
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
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                    Adresse email (Facture)
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
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
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Point de repère pour le coursier
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="Ex: En face de l'Hôtel Akwa Palace, 2e portail"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
                />
              </div>

              {/* Payment Method Selection */}
              <div className="space-y-2.5 pt-2 border-t border-[#E4E0D8]">
                <label className="block text-xs font-semibold text-[#18181B] flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
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
                      className={`text-left p-3 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                        paymentMethod === pm.id
                          ? 'bg-white border-[#18181B] ring-1 ring-[#18181B]'
                          : 'bg-[#FAF8F5] border-[#E4E0D8] hover:border-[#D6D1C7]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-[#18181B]">{pm.title}</div>
                        <div className="text-[11px] text-[#71717A] mt-0.5">{pm.desc}</div>
                      </div>
                      <span className="text-[11px] font-medium text-[#52525B] shrink-0 ml-2">
                        {paymentMethod === pm.id ? 'Sélectionné' : 'Choisir'}
                      </span>
                    </button>
                  ))}
                </div>

                {(paymentMethod === 'mtn_momo' ||
                  paymentMethod === 'orange_money' ||
                  paymentMethod === 'wave') && (
                  <div className="p-3.5 bg-[#F3EFEA] border border-[#D6D1C7] rounded-lg space-y-1.5">
                    <label className="block text-xs font-medium text-[#18181B]">
                      Numéro {formatPaymentMethodLabel(paymentMethod)} :
                    </label>
                    <input
                      type="tel"
                      required
                      value={paymentPhone}
                      onChange={(e) => setPaymentPhone(e.target.value)}
                      placeholder="+237 6..."
                      className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#D6D1C7] rounded-lg"
                    />
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-[#F3EFEA] border border-[#E4E0D8] rounded-lg text-xs text-[#52525B] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#18181B] shrink-0 mt-0.5" />
                <span>
                  Certificat d’authenticité numéroté et garantie décennale inclus avec chaque pièce Maison Véra.
                </span>
              </div>

              {checkoutError && (
                <div
                  className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
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
          <div className="px-6 py-5 bg-[#F3EFEA] border-t border-[#E4E0D8] space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#52525B]">
                <span>Sous-total pièces</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(quote.subtotalCents, currency)}
                </span>
              </div>
              {quote.discountCents > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Remise privilège ({quote.appliedCoupon?.code})</span>
                  <span className="font-mono tabular-nums">
                    -{formatMoney(quote.discountCents, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[#52525B]">
                <span>Livraison & Assurance</span>
                <span className="font-mono tabular-nums">
                  {quote.shippingCents === 0
                    ? 'Offerte'
                    : formatMoney(quote.shippingCents, currency)}
                </span>
              </div>
              <div className="flex justify-between text-[#71717A]">
                <span>Dont taxes incluses (20%)</span>
                <span className="font-mono tabular-nums">
                  {formatMoney(quote.taxCents, currency)}
                </span>
              </div>
              <div className="flex justify-between text-base font-semibold text-[#18181B] pt-2 border-t border-[#D6D1C7]">
                <span>Total TTC</span>
                <span className="font-mono tabular-nums">
                  {quoteLoading
                    ? 'Calcul...'
                    : formatMoney(quote.totalCents, currency)}
                </span>
              </div>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full py-3 px-4 bg-[#18181B] text-[#FAF8F5] text-xs font-medium rounded-lg hover:bg-[#27272A] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <span>Poursuivre la commande</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="px-4 py-3 text-xs font-medium border border-[#D6D1C7] bg-white text-[#18181B] rounded-lg hover:bg-[#EFECE6] transition-colors whitespace-nowrap shrink-0"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-[#18181B] text-[#FAF8F5] text-xs font-medium rounded-lg hover:bg-[#27272A] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {submitting
                    ? 'Traitement en cours...'
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
