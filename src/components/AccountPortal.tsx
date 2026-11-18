import React, { useEffect, useState } from 'react';
import {
  LogOut,
  Mail,
  PackageCheck,
  Search,
  MapPin,
  Sparkles,
  RotateCcw,
  Award,
  Navigation,
} from 'lucide-react';
import type {
  CartItemInput,
  CurrencyCode,
  OrderDTO,
  SimulatedEmailDTO,
  UserProfile,
} from '../shared/types.ts';
import {
  formatDateTime,
  formatDualPrice,
  formatMoney,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
} from '../utils/format.ts';
import { CourierLiveMap } from './CourierLiveMap.tsx';

interface AccountPortalProps {
  user: UserProfile | null;
  authToken: string | null;
  currency?: CurrencyCode;
  onAuthSuccess: (user: UserProfile, token: string) => void;
  onLogout: () => void;
  onOpenOrderSandbox: (order: OrderDTO) => void;
  onReorderItems?: (items: CartItemInput[]) => void;
}

export const AccountPortal: React.FC<AccountPortalProps> = ({
  user,
  authToken,
  currency = 'XAF',
  onAuthSuccess,
  onLogout,
  onOpenOrderSandbox,
  onReorderItems,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Direct Order Tracking
  const [trackNumber, setTrackNumber] = useState('');
  const [trackContact, setTrackContact] = useState('');
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [emails, setEmails] = useState<SimulatedEmailDTO[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedTrackingOrderId, setSelectedTrackingOrderId] = useState<number | null>(null);

  const fetchMyOrders = async () => {
    if (!authToken) return;
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders/my', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const loadedOrders: OrderDTO[] = data.orders || [];
        setOrders(loadedOrders);
        setEmails(data.emails || []);

        const preferredOrder =
          loadedOrders.find((o) => o.status === 'shipped') ??
          loadedOrders.find((o) => o.status === 'preparing' || o.status === 'paid') ??
          loadedOrders.find((o) => o.status !== 'cancelled' && o.status !== 'payment_failed') ??
          null;
        setSelectedTrackingOrderId((prev) =>
          prev && loadedOrders.some((o) => o.id === prev)
            ? prev
            : preferredOrder?.id ?? null
        );
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (user && authToken) {
      fetchMyOrders();
    }
  }, [user, authToken]);

  const activeTrackingOrder =
    orders.find((o) => o.id === selectedTrackingOrderId) ??
    orders.find((o) => o.status === 'shipped') ??
    orders.find((o) => o.status !== 'cancelled' && o.status !== 'payment_failed') ??
    null;

  const handleOrderUpdated = (updated: OrderDTO) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackNumber.trim()) return;
    setTrackError(null);
    setTrackingLoading(true);
    try {
      const res = await fetch(
        `/api/orders/track?orderNumber=${encodeURIComponent(
          trackNumber.trim()
        )}&contact=${encodeURIComponent(trackContact.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Commande introuvable');
      }
      onOpenOrderSandbox(data.order);
    } catch (err: unknown) {
      setTrackError(
        err instanceof Error ? err.message : 'Impossible de trouver cette commande'
      );
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login' ? { email, password } : { email, password, name };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Échec d’authentification');
      }
      onAuthSuccess(data.user, data.token);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConciergeAccess = async (demoEmail: string, demoPass: string) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onAuthSuccess(data.user, data.token);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const totalMemberAcquisitionCents = orders
    .filter((o) => o.status !== 'cancelled' && o.status !== 'payment_failed')
    .reduce((sum, o) => sum + o.totalCents, 0);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
      {/* Direct Order Tracker */}
      <div className="bg-[#F2ECE1] border border-[#E5E0D5] rounded-2xl p-6 md:p-8 space-y-4">
        <div className="max-w-2xl space-y-1">
          <span className="text-xs uppercase tracking-[0.18em] text-[#C86D51] font-medium">
            Service Conciergerie & Expéditions
          </span>
          <h2 className="text-2xl font-display font-semibold text-[#141413]">
            Suivi Direct de Commande & Livraison
          </h2>
          <p className="text-xs text-[#57534E]">
            Renseignez le numéro figurant sur votre certificat de commande (ex.{' '}
            <span className="font-mono">MV-2026-...</span>) ainsi que votre numéro de téléphone WhatsApp ou email pour consulter l’acheminement de vos pièces.
          </p>
        </div>

        <form
          onSubmit={handleTrackOrder}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1"
        >
          <input
            type="text"
            required
            value={trackNumber}
            onChange={(e) => setTrackNumber(e.target.value.toUpperCase())}
            placeholder="Référence (ex: MV-2026-...)"
            className="px-4 py-2.5 text-xs font-mono uppercase bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
          />
          <input
            type="text"
            value={trackContact}
            onChange={(e) => setTrackContact(e.target.value)}
            placeholder="Téléphone WhatsApp ou Email"
            className="px-4 py-2.5 text-xs bg-white border border-[#DED8CC] rounded-xl focus:outline-none focus:border-[#141413]"
          />
          <button
            type="submit"
            disabled={trackingLoading}
            className="px-5 py-2.5 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>
              {trackingLoading ? 'Recherche...' : 'Consulter ma commande'}
            </span>
          </button>
        </form>

        {trackError && (
          <p className="text-xs text-red-700" role="alert">
            {trackError}
          </p>
        )}
      </div>

      {!user ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white border border-[#E5E0D5] rounded-2xl p-8 space-y-6">
            <div>
              <h1 className="text-3xl font-display font-semibold text-[#141413]">
                {mode === 'login' ? 'Espace Clientèle' : 'Créer un Compte Privé'}
              </h1>
              <p className="text-xs text-[#78746C] mt-1">
                Accédez à vos certificats d’authenticité, factures et suivis d’expédition.
              </p>
            </div>

            <div className="flex gap-1 p-1 bg-[#F2ECE1] rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#141413] text-[#FAF7F2] shadow-xs'
                    : 'text-[#57534E]'
                }`}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-[#141413] text-[#FAF7F2] shadow-xs'
                    : 'text-[#57534E]'
                }`}
              >
                Créer un compte
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Amadou Diallo"
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#DED8CC] rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@domaine.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#DED8CC] rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF7F2] border border-[#DED8CC] rounded-xl"
                />
              </div>

              {authError && (
                <div
                  className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800"
                  role="alert"
                >
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#141413] text-[#FAF7F2] text-xs font-medium rounded-xl hover:bg-[#292826] transition-colors cursor-pointer"
              >
                {submitting
                  ? 'Connexion en cours...'
                  : mode === 'login'
                    ? 'Accéder à mon espace'
                    : 'Créer mon compte personnel'}
              </button>
            </form>
          </div>

          {/* Concierge & Member Privileges Card */}
          <div className="bg-[#F2ECE1] border border-[#E5E0D5] rounded-2xl p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#141413]">
                <Sparkles className="w-4 h-4 text-[#C86D51]" />
                <span>Cercle Privé Maison Véra · Douala, Abidjan & Dakar</span>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Les membres du Cercle Maison Véra bénéficient d’un accompagnement architectural personnalisé, de la livraison prioritaire avec installation à domicile et d’invitations aux présentations privées dans nos galeries.
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-5 bg-white border border-[#E5E0D5] rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-[#141413]">
                    Espace Membre Collectionneur — Claire Ndongo-Moreau
                  </div>
                  <p className="text-xs text-[#78746C]">
                    Accès direct à l’espace client (suivi de commandes, certificats téléchargeables et courriers de la Maison).
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleConciergeAccess('claire.moreau@example.test', 'ClientVera2026!')
                    }
                    className="px-4 py-2 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors cursor-pointer"
                  >
                    Ouvrir l’espace Membre
                  </button>
                </div>

                <div className="p-5 bg-white border border-[#E5E0D5] rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-[#141413]">
                    Direction des Galeries — Éléonore Véra
                  </div>
                  <p className="text-xs text-[#78746C]">
                    Accès réservé à la gestion des collections, des stocks d’atelier, de l’export CSV et des expéditions.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleConciergeAccess('admin@maison-vera.test', 'AdminVera2026!')
                    }
                    className="px-4 py-2 text-xs font-medium border border-[#DED8CC] bg-[#FAF7F2] text-[#141413] rounded-xl hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                  >
                    Ouvrir l’espace Direction
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#DED8CC] text-xs text-[#78746C]">
              Conciergerie ouverte du lundi au samedi · Douala Bonapriso · Abidjan Cocody · Dakar Almadies
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Digital Collector Membership Card */}
          <div className="bg-[#141413] text-[#FAF7F2] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4A373]">
                <Award className="w-4 h-4" />
                <span>Carte Membre Cercle Privé Maison Véra</span>
              </div>
              <h1 className="text-3xl font-display font-semibold">
                {user.name}
              </h1>
              <p className="text-xs text-[#A1A1AA]">
                {user.email} · Privilèges actifs :{' '}
                <span className="font-mono text-[#D4A373]">
                  AFRIQUE10 (-10%) · DAKAR25 (-25%) · VIP100 (-100 €)
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="px-4 py-3 rounded-xl bg-[#27272A] border border-[#3F3F46] text-xs">
                <span className="text-[#A1A1AA] block">Acquisitions cumulées</span>
                <strong className="font-mono text-sm text-[#FAF7F2] mt-0.5 block">
                  {formatDualPrice(totalMemberAcquisitionCents, currency)}
                </strong>
              </div>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium border border-[#3F3F46] bg-[#1F1F22] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-[#D4A373]" />
                <span>Se déconnecter</span>
              </button>
            </div>
          </div>

          {/* Real-Time Courier GPS Map Section in Member Account */}
          {activeTrackingOrder && (
            <div id="member-live-gps-panel" className="space-y-3">
              {orders.filter((o) => o.status !== 'cancelled' && o.status !== 'payment_failed').length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#57534E]">
                    Expédition suivie en direct sur la carte :
                  </span>
                  <select
                    aria-label="Choisir la commande à suivre sur la carte GPS"
                    value={activeTrackingOrder.id}
                    onChange={(e) => setSelectedTrackingOrderId(Number(e.target.value))}
                    className="px-3 py-1.5 text-xs font-mono bg-white border border-[#DED8CC] rounded-xl text-[#141413]"
                  >
                    {orders
                      .filter((o) => o.status !== 'cancelled' && o.status !== 'payment_failed')
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber} — {o.shippingCity} ({formatOrderStatusLabel(o.status)})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <CourierLiveMap
                order={activeTrackingOrder}
                authToken={authToken}
                onOrderUpdated={handleOrderUpdated}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Orders History */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#141413]">
                <PackageCheck className="w-4 h-4 text-[#C86D51]" />
                <span>Vos Commandes & Certificats ({orders.length})</span>
              </div>

              {loadingOrders ? (
                <div className="p-8 bg-white border border-[#E5E0D5] rounded-2xl text-xs text-[#78746C]">
                  Chargement de vos commandes...
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 bg-white border border-[#E5E0D5] rounded-2xl text-xs text-[#78746C]">
                  Aucune commande enregistrée sur votre espace pour le moment.
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white border border-[#E5E0D5] rounded-2xl p-5 space-y-4 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E0D5] pb-3">
                        <div>
                          <span className="font-mono font-semibold text-sm text-[#141413]">
                            {o.orderNumber}
                          </span>
                          <span className="mx-2 text-[#DED8CC]">·</span>
                          <span className="text-xs text-[#57534E]">
                            {formatDateTime(o.createdAt)}
                          </span>
                        </div>
                        <div className="px-2.5 py-0.5 rounded bg-[#F2ECE1] border border-[#DED8CC] text-xs font-medium text-[#141413]">
                          {formatOrderStatusLabel(o.status)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                        <MapPin className="w-3.5 h-3.5 text-[#C86D51]" />
                        <span>
                          {o.shippingAddress}, {o.shippingCity} ({o.shippingCountry})
                        </span>
                        <span>·</span>
                        <span>{formatPaymentMethodLabel(o.paymentMethod)}</span>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {o.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between text-[#3F3F46]"
                          >
                            <span>
                              {item.quantity}× {item.productTitle} — {item.variantName}
                            </span>
                            <span className="font-mono tabular-nums">
                              {formatMoney(item.lineTotalCents, currency)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E0D5]">
                        <div className="text-xs">
                          <span className="text-[#78746C]">Montant Total TTC : </span>
                          <strong className="font-mono tabular-nums text-sm text-[#141413]">
                            {formatDualPrice(o.totalCents, currency)}
                          </strong>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {o.status !== 'cancelled' && o.status !== 'payment_failed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTrackingOrderId(o.id);
                                document
                                  .getElementById('member-live-gps-panel')
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                                activeTrackingOrder?.id === o.id
                                  ? 'bg-[#C86D51] text-white border-[#C86D51]'
                                  : 'border-[#DED8CC] bg-[#FAF7F2] text-[#141413] hover:bg-[#F2ECE1]'
                              }`}
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>
                                {o.tracking?.status === 'en_route' || o.tracking?.status === 'arriving_soon'
                                  ? `Coursier Live (${o.tracking.etaMinutes} min)`
                                  : 'Suivi GPS'}
                              </span>
                            </button>
                          )}
                          {onReorderItems && (
                            <button
                              type="button"
                              onClick={() =>
                                onReorderItems(
                                  o.items.map((i) => ({
                                    variantId: i.variantId,
                                    quantity: i.quantity,
                                  }))
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#DED8CC] bg-[#FAF7F2] text-[#141413] rounded-xl hover:bg-[#F2ECE1] transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-[#C86D51]" />
                              <span>Recommander</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenOrderSandbox(o)}
                            className="px-4 py-2 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors cursor-pointer"
                          >
                            Certificat & Suivi
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Communications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#141413]">
                <Mail className="w-4 h-4 text-[#C86D51]" />
                <span>Courriers & Confirmations ({emails.length})</span>
              </div>

              {emails.length === 0 ? (
                <div className="p-6 bg-white border border-[#E5E0D5] rounded-2xl text-xs text-[#78746C]">
                  Aucun courrier reçu pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {emails.map((e) => (
                    <div
                      key={e.id}
                      className="bg-white border border-[#E5E0D5] rounded-2xl p-4 text-xs space-y-2"
                    >
                      <div className="font-semibold text-[#141413]">{e.subject}</div>
                      <div className="text-[11px] text-[#78746C]">
                        {formatDateTime(e.sentAt)}
                      </div>
                      <pre className="font-sans whitespace-pre-wrap text-[#3F3F46] bg-[#FAF7F2] p-3 rounded-xl border border-[#E5E0D5] leading-relaxed">
                        {e.bodyText}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
