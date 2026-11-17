import React, { useEffect, useState } from 'react';
import { RefreshCw, Plus, ShieldCheck } from 'lucide-react';
import type {
  CouponDTO,
  OrderDTO,
  OrderStatus,
  Product,
  SimulatedEmailDTO,
  UserProfile,
} from '../shared/types.ts';
import {
  formatCents,
  formatDateTime,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
} from '../utils/format.ts';

interface AdminDashboardProps {
  user: UserProfile | null;
  authToken: string | null;
  onQuickAdminLogin: () => Promise<void>;
  onCatalogMutated: () => void;
  onOpenOrderSandbox: (order: OrderDTO) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  authToken,
  onQuickAdminLogin,
  onCatalogMutated,
  onOpenOrderSandbox,
}) => {
  const [activeTab, setActiveTab] = useState<
    'inventory' | 'orders' | 'coupons' | 'communications'
  >('inventory');

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [coupons, setCoupons] = useState<CouponDTO[]>([]);
  const [emails, setEmails] = useState<SimulatedEmailDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [variantDrafts, setVariantDrafts] = useState<
    Record<number, { stock: string; priceEuros: string }>
  >({});

  // New coupon form
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'percentage' | 'fixed_cents'>('percentage');
  const [newVal, setNewVal] = useState('15');
  const [newMinEuros, setNewMinEuros] = useState('200');
  const [newMaxUses, setNewMaxUses] = useState('50');

  const fetchAdminData = async () => {
    if (!authToken || user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors du chargement des données');
      }
      setProducts(data.products || []);
      setOrders(data.orders || []);
      setCoupons(data.coupons || []);
      setEmails(data.emails || []);

      const drafts: Record<number, { stock: string; priceEuros: string }> = {};
      for (const p of data.products || []) {
        for (const v of p.variants) {
          drafts[v.id] = {
            stock: String(v.stock),
            priceEuros: (v.priceCents / 100).toFixed(2),
          };
        }
      }
      setVariantDrafts(drafts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de communication');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' && authToken) {
      fetchAdminData();
    }
  }, [user, authToken]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6">
        <div className="bg-white border border-[#E4E0D8] rounded-2xl p-8 md:p-10 space-y-5">
          <div className="flex items-center gap-2 text-xs text-[#52525B]">
            <ShieldCheck className="w-4 h-4 text-[#18181B]" />
            <span>Portail de Direction · Showrooms Douala, Abidjan & Dakar</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-[#18181B]">
            Direction des Collections & Expéditions
          </h1>
          <p className="text-sm text-[#52525B] leading-relaxed">
            Cet espace est réservé à la direction de Maison Véra pour le pilotage des stocks d’atelier, le suivi des commandes clients et la gestion des codes privilèges.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onQuickAdminLogin}
              className="px-6 py-3 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors"
            >
              Accéder au portail de Direction (Éléonore Véra)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveVariant = async (variantId: number) => {
    const draft = variantDrafts[variantId];
    if (!draft) return;
    setError(null);
    setFeedbackMessage(null);

    try {
      const stock = Number(draft.stock);
      const priceCents = Math.round(Number(draft.priceEuros) * 100);
      const res = await fetch(`/api/admin/variants/${variantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ stock, priceCents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de mise à jour');

      setFeedbackMessage(
        `Édition ${data.variant.sku} mise à jour (${data.variant.stock} exemplaires · ${formatCents(data.variant.priceCents)})`
      );
      await fetchAdminData();
      onCatalogMutated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    }
  };

  const handleOrderStatusChange = async (orderId: number, status: OrderStatus) => {
    setError(null);
    setFeedbackMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de changement de statut');

      setFeedbackMessage(
        `Commande ${data.order.orderNumber} : statut mis à jour (${formatOrderStatusLabel(data.order.status)})`
      );
      await fetchAdminData();
      onCatalogMutated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFeedbackMessage(null);
    try {
      const discountValue =
        newType === 'percentage'
          ? Number(newVal)
          : Math.round(Number(newVal) * 100);
      const minSubtotalCents = Math.round(Number(newMinEuros || '0') * 100);
      const maxUses = newMaxUses ? Number(newMaxUses) : null;

      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          code: newCode.trim().toUpperCase(),
          description: newDesc.trim(),
          discountType: newType,
          discountValue,
          minSubtotalCents,
          maxUses,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la création');

      setNewCode('');
      setNewDesc('');
      setFeedbackMessage(`Code privilège ${data.coupon.code} créé.`);
      await fetchAdminData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleToggleCoupon = async (couponId: number, active: boolean) => {
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Erreur');
      }
      await fetchAdminData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const totalRevenueCents = orders
    .filter((o) => o.status === 'paid' || o.status === 'preparing' || o.status === 'shipped')
    .reduce((acc, o) => acc + o.totalCents, 0);

  const totalUnitsInStock = products.reduce(
    (acc, p) => acc + p.variants.reduce((s, v) => s + v.stock, 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header & KPIs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E4E0D8] pb-6">
        <div>
          <p className="text-xs text-[#71717A]">
            Portail de Direction · {user.name}
          </p>
          <h1 className="text-3xl font-display font-semibold text-[#18181B] mt-1">
            Pilotage des Collections, Stocks & Commandes
          </h1>
        </div>
        <button
          type="button"
          onClick={fetchAdminData}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-white border border-[#D6D1C7] rounded-lg hover:bg-[#EFECE6] transition-colors self-start md:self-auto whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-[#E4E0D8] rounded-xl">
          <span className="text-xs text-[#71717A] block">Ventes Confirmées</span>
          <span className="text-xl font-semibold font-mono tabular-nums text-[#18181B] mt-1 block">
            {formatCents(totalRevenueCents)}
          </span>
        </div>
        <div className="p-5 bg-white border border-[#E4E0D8] rounded-xl">
          <span className="text-xs text-[#71717A] block">Commandes Clients</span>
          <span className="text-xl font-semibold font-mono tabular-nums text-[#18181B] mt-1 block">
            {orders.length}
          </span>
        </div>
        <div className="p-5 bg-white border border-[#E4E0D8] rounded-xl">
          <span className="text-xs text-[#71717A] block">Pièces Disponibles</span>
          <span className="text-xl font-semibold font-mono tabular-nums text-[#18181B] mt-1 block">
            {totalUnitsInStock}
          </span>
        </div>
        <div className="p-5 bg-white border border-[#E4E0D8] rounded-xl">
          <span className="text-xs text-[#71717A] block">Codes Privilèges Actifs</span>
          <span className="text-xl font-semibold font-mono tabular-nums text-[#18181B] mt-1 block">
            {coupons.filter((c) => c.active).length}
          </span>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className="p-3.5 bg-[#F3EFEA] border border-[#D6D1C7] rounded-lg text-xs text-[#18181B]"
          role="status"
        >
          {feedbackMessage}
        </div>
      )}
      {error && (
        <div
          className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EFECE6] border border-[#E4E0D8] rounded-lg w-fit">
        {[
          { id: 'inventory', label: 'Stocks & Éditions' },
          { id: 'orders', label: `Commandes & Expéditions (${orders.length})` },
          { id: 'coupons', label: `Codes Privilèges (${coupons.length})` },
          { id: 'communications', label: `Courriers Clients (${emails.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white text-[#18181B] shadow-xs'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Inventory & Variants */}
      {activeTab === 'inventory' && (
        <div className="bg-white border border-[#E4E0D8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E0D8]">
            <h2 className="text-base font-semibold text-[#18181B]">
              Inventaire des Ateliers & Showrooms
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3EFEA] text-[#52525B] border-b border-[#E4E0D8]">
                <tr>
                  <th className="py-3 px-4 font-medium">Création & Collection</th>
                  <th className="py-3 px-4 font-medium">Référence</th>
                  <th className="py-3 px-4 font-medium">Édition & Finition</th>
                  <th className="py-3 px-4 font-medium">Tarif de référence (€)</th>
                  <th className="py-3 px-4 font-medium">Exemplaires Dispo</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E0D8]">
                {products.flatMap((product) =>
                  product.variants.map((variant) => {
                    const draft = variantDrafts[variant.id] || {
                      stock: String(variant.stock),
                      priceEuros: (variant.priceCents / 100).toFixed(2),
                    };
                    return (
                      <tr key={variant.id} className="hover:bg-[#FAF8F5]">
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#18181B]">{product.title}</div>
                          <div className="text-[#71717A]">{product.category}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#52525B]">{variant.sku}</td>
                        <td className="py-3 px-4">
                          <div className="text-[#18181B]">{variant.name}</div>
                          <div className="text-[#71717A]">{variant.finish}</div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            step="0.01"
                            min="1"
                            aria-label={`Prix ${variant.sku}`}
                            value={draft.priceEuros}
                            onChange={(e) =>
                              setVariantDrafts((prev) => ({
                                ...prev,
                                [variant.id]: { ...draft, priceEuros: e.target.value },
                              }))
                            }
                            className="w-28 px-2.5 py-1.5 font-mono tabular-nums bg-white border border-[#D6D1C7] rounded-md"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            min="0"
                            aria-label={`Stock ${variant.sku}`}
                            value={draft.stock}
                            onChange={(e) =>
                              setVariantDrafts((prev) => ({
                                ...prev,
                                [variant.id]: { ...draft, stock: e.target.value },
                              }))
                            }
                            className="w-20 px-2.5 py-1.5 font-mono tabular-nums bg-white border border-[#D6D1C7] rounded-md"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveVariant(variant.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-md hover:bg-[#27272A] transition-colors whitespace-nowrap"
                          >
                            Mettre à jour
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Orders */}
      {activeTab === 'orders' && (
        <div className="bg-white border border-[#E4E0D8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E0D8]">
            <h2 className="text-base font-semibold text-[#18181B]">
              Registre des Commandes & Expéditions
            </h2>
          </div>
          {orders.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#71717A]">
              Aucune commande enregistrée pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F3EFEA] text-[#52525B] border-b border-[#E4E0D8]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Référence</th>
                    <th className="py-3 px-4 font-medium">Client & Destination</th>
                    <th className="py-3 px-4 font-medium">Règlement</th>
                    <th className="py-3 px-4 font-medium text-right">Total TTC</th>
                    <th className="py-3 px-4 font-medium">Statut d’avancement</th>
                    <th className="py-3 px-4 font-medium text-right">Certificat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E0D8]">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#FAF8F5]">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-[#18181B]">
                          {o.orderNumber}
                        </div>
                        <div className="text-[11px] text-[#71717A]">
                          {formatDateTime(o.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#18181B]">
                          {o.customerName} ({o.customerPhone})
                        </div>
                        <div className="text-[#71717A]">
                          {o.shippingAddress}, {o.shippingCity} ({o.shippingCountry})
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#3F3F46]">
                        {formatPaymentMethodLabel(o.paymentMethod)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#18181B]">
                        {formatCents(o.totalCents)}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Statut commande ${o.orderNumber}`}
                          value={o.status}
                          onChange={(e) =>
                            handleOrderStatusChange(o.id, e.target.value as OrderStatus)
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-[#D6D1C7] rounded-md text-[#18181B]"
                        >
                          <option value="pending_payment">En attente de règlement</option>
                          <option value="paid">Payée · Confirmée</option>
                          <option value="preparing">En préparation à l’atelier</option>
                          <option value="shipped">En cours de livraison</option>
                          <option value="cancelled">Annulée (Remise en rayon)</option>
                          <option value="payment_failed">Échec transaction</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenOrderSandbox(o)}
                          className="px-3 py-1.5 text-xs font-medium border border-[#D6D1C7] bg-white text-[#18181B] rounded-md hover:bg-[#EFECE6] transition-colors whitespace-nowrap"
                        >
                          Voir le dossier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Coupons */}
      {activeTab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-[#E4E0D8] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E0D8]">
              <h2 className="text-base font-semibold text-[#18181B]">
                Codes Privilèges & Invitations
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F3EFEA] text-[#52525B] border-b border-[#E4E0D8]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">Avantage</th>
                    <th className="py-3 px-4 font-medium">Seuil Minimum</th>
                    <th className="py-3 px-4 font-medium">Utilisations</th>
                    <th className="py-3 px-4 font-medium text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E0D8]">
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-[#18181B]">
                          {c.code}
                        </div>
                        <div className="text-[#71717A]">{c.description}</div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {c.discountType === 'percentage'
                          ? `-${c.discountValue}%`
                          : `-${formatCents(c.discountValue)}`}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {formatCents(c.minSubtotalCents)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {c.usedCount} / {c.maxUses ?? '∞'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleCoupon(c.id, !c.active)}
                          className="px-3 py-1 text-xs border border-[#D6D1C7] rounded-md bg-white hover:bg-[#EFECE6]"
                        >
                          {c.active ? 'Actif (Suspendre)' : 'Inactif (Activer)'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={handleCreateCoupon}
            className="bg-white border border-[#E4E0D8] rounded-xl p-6 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#18181B]">
              <Plus className="w-4 h-4" />
              <span>Nouveau code privilège</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                Code
              </label>
              <input
                type="text"
                required
                placeholder="EX: DOUALA20"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                Intitulé de l’offre
              </label>
              <input
                type="text"
                required
                placeholder="Invitation Salon Privé Bonapriso -20%"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Nature
                </label>
                <select
                  value={newType}
                  onChange={(e) =>
                    setNewType(e.target.value as 'percentage' | 'fixed_cents')
                  }
                  className="w-full px-2.5 py-2 text-xs bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
                >
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="fixed_cents">Montant fixe (€)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Valeur ({newType === 'percentage' ? '%' : '€'})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Seuil minimum (€)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newMinEuros}
                  onChange={(e) => setNewMinEuros(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#3F3F46] mb-1">
                  Nombre d’invitations
                </label>
                <input
                  type="number"
                  min="1"
                  value={newMaxUses}
                  onChange={(e) => setNewMaxUses(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#FAF8F5] border border-[#D6D1C7] rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors"
            >
              Activer le code privilège
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Customer Communications */}
      {activeTab === 'communications' && (
        <div className="bg-white border border-[#E4E0D8] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4E0D8]">
            <h2 className="text-base font-semibold text-[#18181B]">
              Courriers, Certificats & Notifications Expédiés ({emails.length})
            </h2>
          </div>
          <div className="divide-y divide-[#E4E0D8] max-h-[540px] overflow-y-auto">
            {emails.map((e) => (
              <div key={e.id} className="p-5 text-xs space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-[#18181B]">{e.subject}</span>
                  <span className="text-[11px] text-[#71717A] shrink-0">
                    {formatDateTime(e.sentAt)}
                  </span>
                </div>
                <div className="text-[#52525B]">
                  Destinataire : <span className="font-mono">{e.recipientEmail}</span>
                </div>
                <pre className="font-sans whitespace-pre-wrap text-[#3F3F46] bg-[#FAF8F5] p-3.5 rounded-lg border border-[#E4E0D8] leading-relaxed">
                  {e.bodyText}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
