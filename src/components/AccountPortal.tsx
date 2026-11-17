import React, { useEffect, useState } from 'react';
import {
  LogOut,
  Mail,
  PackageCheck,
  Search,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type {
  CurrencyCode,
  OrderDTO,
  SimulatedEmailDTO,
  UserProfile,
} from '../shared/types.ts';
import {
  formatDateTime,
  formatMoney,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
} from '../utils/format.ts';

interface AccountPortalProps {
  user: UserProfile | null;
  authToken: string | null;
  currency?: CurrencyCode;
  onAuthSuccess: (user: UserProfile, token: string) => void;
  onLogout: () => void;
  onOpenOrderSandbox: (order: OrderDTO) => void;
}

export const AccountPortal: React.FC<AccountPortalProps> = ({
  user,
  authToken,
  currency = 'XAF',
  onAuthSuccess,
  onLogout,
  onOpenOrderSandbox,
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

  const fetchMyOrders = async () => {
    if (!authToken) return;
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/orders/my', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setEmails(data.emails || []);
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-10">
      {/* Direct Order Tracker */}
      <div className="bg-[#F3EFEA] border border-[#E4E0D8] rounded-2xl p-6 md:p-8 space-y-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-2xl font-display font-semibold text-[#18181B]">
            Suivi Direct de Commande & Livraison
          </h2>
          <p className="text-xs text-[#52525B]">
            Renseignez le numéro figurant sur votre certificat de commande (ex. <span className="font-mono">MV-2026-...</span>) ainsi que votre numéro de téléphone ou email pour consulter l’acheminement de vos pièces.
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
            className="px-4 py-2.5 text-xs font-mono uppercase bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
          />
          <input
            type="text"
            value={trackContact}
            onChange={(e) => setTrackContact(e.target.value)}
            placeholder="Téléphone Mobile ou Email"
            className="px-4 py-2.5 text-xs bg-white border border-[#D6D1C7] rounded-lg focus:outline-none focus:border-[#18181B]"
          />
          <button
            type="submit"
            disabled={trackingLoading}
            className="px-5 py-2.5 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors flex items-center justify-center gap-2"
          >
            <Search className="w-3.5 h-3.5" />
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
          <div className="bg-white border border-[#E4E0D8] rounded-2xl p-8 space-y-6">
            <div>
              <h1 className="text-3xl font-display font-semibold text-[#18181B]">
                {mode === 'login' ? 'Espace Clientèle' : 'Créer un Compte Privé'}
              </h1>
              <p className="text-xs text-[#71717A] mt-1">
                Accédez à vos certificats d’authenticité, factures et suivis d’expédition.
              </p>
            </div>

            <div className="flex gap-1 p-1 bg-[#EFECE6] rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-[#18181B] shadow-xs'
                    : 'text-[#52525B]'
                }`}
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-[#18181B] shadow-xs'
                    : 'text-[#52525B]'
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
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
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
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
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
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
                />
              </div>

              {authError && (
                <div
                  className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
                  role="alert"
                >
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#18181B] text-[#FAF8F5] text-xs font-medium rounded-lg hover:bg-[#27272A] transition-colors"
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
          <div className="bg-[#F3EFEA] border border-[#E4E0D8] rounded-2xl p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#18181B]">
                <Sparkles className="w-4 h-4" />
                <span>Cercle Privé Maison Véra · Douala, Abidjan & Dakar</span>
              </div>
              <p className="text-xs text-[#52525B] leading-relaxed">
                Les membres du Cercle Maison Véra bénéficient d’un accompagnement architectural personnalisé, de la livraison prioritaire avec installation à domicile et d’invitations aux présentations privées dans nos showrooms.
              </p>

              <div className="space-y-3 pt-2">
                <div className="p-5 bg-white border border-[#E4E0D8] rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-[#18181B]">
                    Espace Membre Collectionneur — Claire Ndongo-Moreau
                  </div>
                  <p className="text-xs text-[#71717A]">
                    Accès direct à l’espace client (suivi de commandes, certificats et courriers de la Maison).
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleConciergeAccess('claire.moreau@example.test', 'ClientVera2026!')
                    }
                    className="px-4 py-2 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors"
                  >
                    Ouvrir l’espace Membre
                  </button>
                </div>

                <div className="p-5 bg-white border border-[#E4E0D8] rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-[#18181B]">
                    Direction des Showrooms — Éléonore Véra
                  </div>
                  <p className="text-xs text-[#71717A]">
                    Accès réservé à la gestion des collections, des stocks d’atelier et des expéditions.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleConciergeAccess('admin@maison-vera.test', 'AdminVera2026!')
                    }
                    className="px-4 py-2 text-xs font-medium border border-[#D6D1C7] bg-[#FAF8F5] text-[#18181B] rounded-lg hover:bg-[#EFECE6] transition-colors"
                  >
                    Ouvrir l’espace Direction
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4E0D8] text-xs text-[#71717A]">
              Conciergerie ouverte du lundi au samedi · Douala Bonapriso · Abidjan Cocody · Dakar Almadies
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E0D8] pb-6">
            <div>
              <p className="text-xs text-[#71717A]">
                Cercle Privé Maison Véra
              </p>
              <h1 className="text-3xl font-display font-semibold text-[#18181B] mt-0.5">
                Bienvenue, {user.name}
              </h1>
              <p className="text-xs text-[#52525B] mt-0.5">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border border-[#D6D1C7] bg-white text-[#18181B] rounded-lg hover:bg-[#EFECE6] transition-colors self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Orders History */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#18181B]">
                <PackageCheck className="w-4 h-4" />
                <span>Vos Commandes & Acquisitions ({orders.length})</span>
              </div>

              {loadingOrders ? (
                <div className="p-8 bg-white border border-[#E4E0D8] rounded-xl text-xs text-[#71717A]">
                  Chargement de vos commandes...
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 bg-white border border-[#E4E0D8] rounded-xl text-xs text-[#71717A]">
                  Aucune commande enregistrée sur votre espace pour le moment.
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      className="bg-white border border-[#E4E0D8] rounded-xl p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E0D8] pb-3">
                        <div>
                          <span className="font-mono font-semibold text-sm text-[#18181B]">
                            {o.orderNumber}
                          </span>
                          <span className="mx-2 text-[#D6D1C7]">·</span>
                          <span className="text-xs text-[#52525B]">
                            {formatDateTime(o.createdAt)}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-[#18181B]">
                          {formatOrderStatusLabel(o.status)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#52525B]">
                        <MapPin className="w-3.5 h-3.5" />
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

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E4E0D8]">
                        <div className="text-xs">
                          <span className="text-[#71717A]">Montant Total TTC : </span>
                          <strong className="font-mono tabular-nums text-sm text-[#18181B]">
                            {formatMoney(o.totalCents, currency)}
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenOrderSandbox(o)}
                          className="px-4 py-2 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors"
                        >
                          Détails, Certificat & Règlement
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Communications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#18181B]">
                <Mail className="w-4 h-4" />
                <span>Courriers & Confirmations ({emails.length})</span>
              </div>

              {emails.length === 0 ? (
                <div className="p-6 bg-white border border-[#E4E0D8] rounded-xl text-xs text-[#71717A]">
                  Aucun courrier reçu pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {emails.map((e) => (
                    <div
                      key={e.id}
                      className="bg-white border border-[#E4E0D8] rounded-xl p-4 text-xs space-y-2"
                    >
                      <div className="font-semibold text-[#18181B]">{e.subject}</div>
                      <div className="text-[11px] text-[#71717A]">
                        {formatDateTime(e.sentAt)}
                      </div>
                      <pre className="font-sans whitespace-pre-wrap text-[#3F3F46] bg-[#FAF8F5] p-3 rounded-lg border border-[#E4E0D8] leading-relaxed">
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
