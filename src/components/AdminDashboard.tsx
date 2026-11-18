import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Plus,
  ShieldCheck,
  Download,
  Search,
  Navigation,
} from 'lucide-react';
import type {
  AppointmentStatus,
  ConciergeAppointmentDTO,
  CouponDTO,
  CurrencyCode,
  InventoryAnalyticsDTO,
  OrderDTO,
  OrderStatus,
  Product,
  SimulatedEmailDTO,
  UserProfile,
} from '../shared/types.ts';
import {
  centsToFcfa,
  formatCents,
  formatDateTime,
  formatDualPrice,
  formatMoney,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
} from '../utils/format.ts';
import { StockForecastChart } from './StockForecastChart.tsx';

interface AdminDashboardProps {
  user: UserProfile | null;
  authToken: string | null;
  currency?: CurrencyCode;
  onQuickAdminLogin: () => Promise<void>;
  onCatalogMutated: () => void;
  onOpenOrderSandbox: (order: OrderDTO) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  authToken,
  currency = 'XAF',
  onQuickAdminLogin,
  onCatalogMutated,
  onOpenOrderSandbox,
}) => {
  const [activeTab, setActiveTab] = useState<
    'inventory' | 'orders' | 'appointments' | 'coupons' | 'communications'
  >('inventory');

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [appointments, setAppointments] = useState<ConciergeAppointmentDTO[]>([]);
  const [coupons, setCoupons] = useState<CouponDTO[]>([]);
  const [emails, setEmails] = useState<SimulatedEmailDTO[]>([]);
  const [inventoryAnalytics, setInventoryAnalytics] =
    useState<InventoryAnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Order filters
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('ALL');
  const [orderSearch, setOrderSearch] = useState<string>('');

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
      setAppointments(data.appointments || []);
      setCoupons(data.coupons || []);
      setEmails(data.emails || []);
      setInventoryAnalytics(data.inventoryAnalytics || null);

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

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderStatusFilter !== 'ALL' && o.status !== orderStatusFilter) {
        return false;
      }
      if (orderSearch.trim() !== '') {
        const q = orderSearch.toLowerCase();
        const matchRef = o.orderNumber.toLowerCase().includes(q);
        const matchName = o.customerName.toLowerCase().includes(q);
        const matchCity = o.shippingCity.toLowerCase().includes(q);
        const matchPhone = o.customerPhone.toLowerCase().includes(q);
        return matchRef || matchName || matchCity || matchPhone;
      }
      return true;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto py-16 px-6">
        <div className="bg-white border border-[#E5E0D5] rounded-2xl p-8 md:p-10 space-y-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-[#57534E]">
            <ShieldCheck className="w-4 h-4 text-[#C86D51]" />
            <span>Portail de Direction · Showrooms Douala, Abidjan, Dakar & Paris</span>
          </div>
          <h1 className="text-3xl font-display font-semibold text-[#141413]">
            Direction des Collections & Expéditions
          </h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            Cet espace est réservé à la direction de Maison Véra pour le pilotage des stocks d’atelier, le suivi des commandes clients, l’export comptable et la gestion des codes privilèges.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onQuickAdminLogin}
              className="px-6 py-3 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors cursor-pointer"
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
        `Édition ${data.variant.sku} mise à jour (${data.variant.stock} exemplaires · ${formatDualPrice(data.variant.priceCents, currency)})`
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

  const handleAdvanceCourierGps = async (order: OrderDTO) => {
    setError(null);
    setFeedbackMessage(null);
    try {
      const currentPct = order.tracking?.progressPct ?? 0;
      const nextProgress = Math.min(100, currentPct === 0 ? 25 : currentPct + 25);
      const res = await fetch(`/api/admin/orders/${order.id}/tracking`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ progressPct: nextProgress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de mise à jour GPS');

      setFeedbackMessage(
        `Coursier ${data.tracking.courierName} (${order.orderNumber}) : ${data.tracking.progressPct}% — ${data.tracking.lastCheckpoint}`
      );
      await fetchAdminData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur GPS');
    }
  };

  const handleAppointmentStatusChange = async (
    appointmentId: number,
    status: AppointmentStatus
  ) => {
    setError(null);
    setFeedbackMessage(null);
    try {
      const res = await fetch(`/api/admin/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de mise à jour du rendez-vous');

      setFeedbackMessage(
        `Rendez-vous ${data.appointment.referenceCode} (${data.appointment.showroomCity}) mis à jour.`
      );
      await fetchAdminData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleExportOrdersCsv = () => {
    const header = [
      'Reference',
      'Date',
      'Client',
      'Telephone_WhatsApp',
      'Email',
      'Ville',
      'Pays',
      'Mode_Paiement',
      'Statut',
      'Total_EUR',
      'Total_FCFA',
    ].join(';');

    const rows = filteredOrders.map((o) =>
      [
        o.orderNumber,
        o.createdAt,
        `"${o.customerName.replace(/"/g, '""')}"`,
        `"${o.customerPhone}"`,
        o.customerEmail,
        `"${o.shippingCity}"`,
        `"${o.shippingCountry}"`,
        o.paymentMethod,
        o.status,
        (o.totalCents / 100).toFixed(2),
        centsToFcfa(o.totalCents),
      ].join(';')
    );

    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Maison-Vera-Commandes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
    .filter(
      (o) =>
        o.status === 'paid' || o.status === 'preparing' || o.status === 'shipped'
    )
    .reduce((acc, o) => acc + o.totalCents, 0);

  const totalUnitsInStock = products.reduce(
    (acc, p) => acc + p.variants.reduce((s, v) => s + v.stock, 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header & KPIs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E0D5] pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#C86D51] font-medium">
            Portail de Direction · {user.name}
          </p>
          <h1 className="text-3xl font-display font-semibold text-[#141413] mt-1">
            Pilotage des Collections, Stocks & Commandes
          </h1>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={handleExportOrdersCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#D4A373]" />
            <span>Exporter CSV Comptable</span>
          </button>
          <button
            type="button"
            onClick={fetchAdminData}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-white border border-[#DED8CC] rounded-xl hover:bg-[#F2ECE1] transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-[#E5E0D5] rounded-2xl">
          <span className="text-xs text-[#78746C] block">
            Chiffre d’Affaires Confirmé
          </span>
          <span className="text-xl font-semibold font-mono tabular-nums text-[#141413] mt-1 block">
            {formatMoney(totalRevenueCents, currency)}
          </span>
          <span className="text-[11px] font-mono text-[#78746C] mt-0.5 block">
            {formatCents(totalRevenueCents)} TTC
          </span>
        </div>
        <div className="p-5 bg-white border border-[#E5E0D5] rounded-2xl">
          <span className="text-xs text-[#78746C] block">Commandes Clients</span>
          <span className="text-xl font-semibold font-mono tabular-nums text-[#141413] mt-1 block">
            {orders.length}
          </span>
          <span className="text-[11px] text-[#78746C] mt-0.5 block">
            Douala · Abidjan · Dakar · Paris
          </span>
        </div>
        <div className="p-5 bg-white border border-[#E5E0D5] rounded-2xl">
          <span className="text-xs text-[#78746C] block">
            Pièces Numérotées en Stock
          </span>
          <span className="text-xl font-semibold font-mono tabular-nums text-[#141413] mt-1 block">
            {totalUnitsInStock}
          </span>
          <span className="text-[11px] text-[#78746C] mt-0.5 block">
            Sur {products.length} collections actives
          </span>
        </div>
        <div className="p-5 bg-white border border-[#E5E0D5] rounded-2xl">
          <span className="text-xs text-[#78746C] block">
            Codes Privilèges Actifs
          </span>
          <span className="text-xl font-semibold font-mono tabular-nums text-[#141413] mt-1 block">
            {coupons.filter((c) => c.active).length}
          </span>
          <span className="text-[11px] text-[#78746C] mt-0.5 block">
            Sur {coupons.length} codes configurés
          </span>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className="p-3.5 bg-[#F2ECE1] border border-[#DED8CC] rounded-xl text-xs text-[#141413]"
          role="status"
        >
          {feedbackMessage}
        </div>
      )}
      {error && (
        <div
          className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2ECE1] border border-[#E5E0D5] rounded-xl w-fit">
        {[
          { id: 'inventory', label: 'Stocks & Éditions' },
          { id: 'orders', label: `Commandes & Expéditions (${orders.length})` },
          { id: 'appointments', label: `Rendez-Vous Galeries (${appointments.length})` },
          { id: 'coupons', label: `Codes Privilèges (${coupons.length})` },
          { id: 'communications', label: `Courriers Clients (${emails.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#141413] text-[#FAF7F2] shadow-xs'
                : 'text-[#57534E] hover:text-[#141413]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Inventory & Variants */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <StockForecastChart
            analytics={inventoryAnalytics}
            loading={loading}
            onApplyRestockSuggestion={(variantId, recommendedNewStock) => {
              setVariantDrafts((prev) => {
                const current = prev[variantId] || { stock: '0', priceEuros: '0.00' };
                return {
                  ...prev,
                  [variantId]: {
                    ...current,
                    stock: String(recommendedNewStock),
                  },
                };
              });
              setFeedbackMessage(
                `Suggestion de réapprovisionnement pré-remplie (${recommendedNewStock} unités). Cliquez sur « Mettre à jour » dans le tableau ci-dessous pour enregistrer.`
              );
            }}
          />

          <div className="bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E0D5] flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#141413]">
              Inventaire des Ateliers & Galeries
            </h2>
            <span className="text-xs text-[#78746C]">
              Devise active : {currency}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2ECE1] text-[#57534E] border-b border-[#E5E0D5]">
                <tr>
                  <th className="py-3 px-4 font-medium">Création & Collection</th>
                  <th className="py-3 px-4 font-medium">Référence</th>
                  <th className="py-3 px-4 font-medium">Édition & Finition</th>
                  <th className="py-3 px-4 font-medium">Tarif (€ & {currency})</th>
                  <th className="py-3 px-4 font-medium">Exemplaires Dispo</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5]">
                {products.flatMap((product) =>
                  product.variants.map((variant) => {
                    const draft = variantDrafts[variant.id] || {
                      stock: String(variant.stock),
                      priceEuros: (variant.priceCents / 100).toFixed(2),
                    };
                    return (
                      <tr key={variant.id} className="hover:bg-[#FAF7F2]">
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#141413]">{product.title}</div>
                          <div className="text-[#78746C]">{product.category}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#57534E]">{variant.sku}</td>
                        <td className="py-3 px-4">
                          <div className="text-[#141413]">{variant.name}</div>
                          <div className="text-[#78746C]">{variant.finish}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
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
                              className="w-24 px-2.5 py-1.5 font-mono tabular-nums bg-white border border-[#DED8CC] rounded-lg"
                            />
                            <span className="font-mono text-[11px] text-[#78746C]">
                              ({formatMoney(variant.priceCents, currency)})
                            </span>
                          </div>
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
                            className="w-20 px-2.5 py-1.5 font-mono tabular-nums bg-white border border-[#DED8CC] rounded-lg"
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleSaveVariant(variant.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-lg hover:bg-[#292826] transition-colors whitespace-nowrap cursor-pointer"
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
        </div>
      )}

      {/* Tab 2: Orders */}
      {activeTab === 'orders' && (
        <div className="bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-[#141413]">
              Registre des Commandes & Expéditions ({filteredOrders.length})
            </h2>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#78746C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Réf, client, ville, tél..."
                  aria-label="Rechercher une commande"
                  className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#DED8CC] rounded-lg focus:outline-none focus:border-[#141413]"
                />
              </div>

              <select
                aria-label="Filtrer par statut de commande"
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#DED8CC] rounded-lg text-[#141413]"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="pending_payment">En attente de règlement</option>
                <option value="paid">Payée · Confirmée</option>
                <option value="preparing">En préparation à l’atelier</option>
                <option value="shipped">En cours de livraison</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#78746C]">
              Aucune commande ne correspond à vos critères.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F2ECE1] text-[#57534E] border-b border-[#E5E0D5]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Référence</th>
                    <th className="py-3 px-4 font-medium">Client & Destination</th>
                    <th className="py-3 px-4 font-medium">Règlement</th>
                    <th className="py-3 px-4 font-medium text-right">Total TTC</th>
                    <th className="py-3 px-4 font-medium">Statut d’avancement</th>
                    <th className="py-3 px-4 font-medium">Coursier & GPS</th>
                    <th className="py-3 px-4 font-medium text-right">Certificat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D5]">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-[#FAF7F2]">
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-[#141413]">
                          {o.orderNumber}
                        </div>
                        <div className="text-[11px] text-[#78746C]">
                          {formatDateTime(o.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#141413]">
                          {o.customerName} ({o.customerPhone})
                        </div>
                        <div className="text-[#78746C]">
                          {o.shippingAddress}, {o.shippingCity} ({o.shippingCountry})
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#3F3F46]">
                        {formatPaymentMethodLabel(o.paymentMethod)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#141413]">
                        <div>{formatMoney(o.totalCents, currency)}</div>
                        <div className="text-[10px] text-[#78746C] font-normal">
                          {formatCents(o.totalCents)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Statut commande ${o.orderNumber}`}
                          value={o.status}
                          onChange={(e) =>
                            handleOrderStatusChange(o.id, e.target.value as OrderStatus)
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-[#DED8CC] rounded-lg text-[#141413]"
                        >
                          <option value="pending_payment">En attente de règlement</option>
                          <option value="paid">Payée · Confirmée</option>
                          <option value="preparing">En préparation à l’atelier</option>
                          <option value="shipped">En cours de livraison</option>
                          <option value="cancelled">Annulée (Remise en rayon)</option>
                          <option value="payment_failed">Échec transaction</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        {o.status !== 'cancelled' && o.status !== 'payment_failed' ? (
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium text-[#141413]">
                              {o.tracking?.courierName || 'Coursier Maison Véra'} ·{' '}
                              <span className="font-mono">{o.tracking?.progressPct ?? 0}%</span>
                            </div>
                            {(o.tracking?.progressPct ?? 0) < 100 && o.status !== 'pending_payment' && (
                              <button
                                type="button"
                                onClick={() => handleAdvanceCourierGps(o)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[#FAF7F2] border border-[#DED8CC] rounded-md hover:bg-[#F2ECE1] text-[#141413] cursor-pointer"
                              >
                                <Navigation className="w-3 h-3 text-[#C86D51]" />
                                <span>Avancer GPS +25%</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#78746C]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenOrderSandbox(o)}
                          className="px-3 py-1.5 text-xs font-medium border border-[#DED8CC] bg-white text-[#141413] rounded-lg hover:bg-[#F2ECE1] transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Voir le certificat
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

      {/* Tab 3: Showroom Private Appointments */}
      {activeTab === 'appointments' && (
        <div className="bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E0D5] flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#141413]">
              Demandes d’Accueil Privé en Galeries ({appointments.length})
            </h2>
            <span className="text-xs text-[#78746C]">
              Douala · Abidjan · Dakar · Paris
            </span>
          </div>

          {appointments.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#78746C]">
              Aucune demande de rendez-vous enregistrée pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F2ECE1] text-[#57534E] border-b border-[#E5E0D5]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Référence</th>
                    <th className="py-3 px-4 font-medium">Galerie & Date</th>
                    <th className="py-3 px-4 font-medium">Visiteur</th>
                    <th className="py-3 px-4 font-medium">Projet / Pièces</th>
                    <th className="py-3 px-4 font-medium text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D5]">
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-[#FAF7F2]">
                      <td className="py-3 px-4 font-mono font-semibold text-[#141413]">
                        {apt.referenceCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#141413]">
                          Galerie {apt.showroomCity}
                        </div>
                        <div className="font-mono text-[11px] text-[#78746C]">
                          Souhaité le {apt.preferredDate}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#141413]">
                          {apt.customerName}
                        </div>
                        <div className="text-[#78746C] font-mono text-[11px]">
                          {apt.customerPhone} · {apt.customerEmail}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#3F3F46] max-w-xs">
                        {apt.projectNote || 'Visite générale de la collection'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <select
                          aria-label={`Statut rendez-vous ${apt.referenceCode}`}
                          value={apt.status}
                          onChange={(e) =>
                            handleAppointmentStatusChange(
                              apt.id,
                              e.target.value as AppointmentStatus
                            )
                          }
                          className="px-2.5 py-1.5 text-xs bg-white border border-[#DED8CC] rounded-lg text-[#141413]"
                        >
                          <option value="pending">En attente</option>
                          <option value="confirmed">Confirmé</option>
                          <option value="completed">Honoré</option>
                          <option value="rescheduled">À replanifier</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Coupons */}
      {activeTab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E0D5]">
              <h2 className="text-base font-semibold text-[#141413]">
                Codes Privilèges & Invitations
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F2ECE1] text-[#57534E] border-b border-[#E5E0D5]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">Avantage</th>
                    <th className="py-3 px-4 font-medium">Seuil Minimum</th>
                    <th className="py-3 px-4 font-medium">Utilisations</th>
                    <th className="py-3 px-4 font-medium text-right">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D5]">
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-[#141413]">
                          {c.code}
                        </div>
                        <div className="text-[#78746C]">{c.description}</div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {c.discountType === 'percentage'
                          ? `-${c.discountValue}%`
                          : `-${formatMoney(c.discountValue, currency)}`}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {formatMoney(c.minSubtotalCents, currency)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {c.usedCount} / {c.maxUses ?? '∞'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleCoupon(c.id, !c.active)}
                          className="px-3 py-1 text-xs border border-[#DED8CC] rounded-lg bg-white hover:bg-[#F2ECE1] cursor-pointer"
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
            className="bg-white border border-[#E5E0D5] rounded-2xl p-6 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#141413]">
              <Plus className="w-4 h-4 text-[#C86D51]" />
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
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-[#FAF7F2] border border-[#DED8CC] rounded-lg"
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
                className="w-full px-3 py-2 text-xs bg-[#FAF7F2] border border-[#DED8CC] rounded-lg"
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
                  className="w-full px-2.5 py-2 text-xs bg-[#FAF7F2] border border-[#DED8CC] rounded-lg"
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
                  className="w-full px-3 py-2 text-xs font-mono bg-[#FAF7F2] border border-[#DED8CC] rounded-lg"
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
                  className="w-full px-3 py-2 text-xs font-mono bg-[#FAF7F2] border border-[#DED8CC] rounded-lg"
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
                  className="w-full px-3 py-2 text-xs font-mono bg-[#FAF7F2] border border-[#DED8CC] rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-medium bg-[#141413] text-[#FAF7F2] rounded-xl hover:bg-[#292826] transition-colors cursor-pointer"
            >
              Activer le code privilège
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Customer Communications */}
      {activeTab === 'communications' && (
        <div className="bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E0D5]">
            <h2 className="text-base font-semibold text-[#141413]">
              Courriers, Certificats & Notifications Expédiés ({emails.length})
            </h2>
          </div>
          <div className="divide-y divide-[#E5E0D5] max-h-[540px] overflow-y-auto">
            {emails.map((e) => (
              <div key={e.id} className="p-5 text-xs space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold text-[#141413]">{e.subject}</span>
                  <span className="text-[11px] text-[#78746C] shrink-0">
                    {formatDateTime(e.sentAt)}
                  </span>
                </div>
                <div className="text-[#57534E]">
                  Destinataire : <span className="font-mono">{e.recipientEmail}</span>
                </div>
                <pre className="font-sans whitespace-pre-wrap text-[#3F3F46] bg-[#FAF7F2] p-3.5 rounded-xl border border-[#E5E0D5] leading-relaxed">
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
