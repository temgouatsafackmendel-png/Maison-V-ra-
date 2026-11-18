import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  TrendingDown,
  AlertTriangle,
  PackagePlus,
  BarChart3,
  Activity,
} from 'lucide-react';
import type {
  InventoryAnalyticsDTO,
  RestockUrgency,
  StockHistoryPointDTO,
  VariantRestockPredictionDTO,
} from '../shared/types.ts';

interface StockForecastChartProps {
  analytics: InventoryAnalyticsDTO | null;
  loading: boolean;
  onApplyRestockSuggestion: (variantId: number, recommendedNewStock: number) => void;
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: StockHistoryPointDTO & {
    sku?: string;
    currentStock?: number;
    soldLast30d?: number;
    recommendedRestockQty?: number;
    projectedStock14d?: number;
  };
}

const TimelineTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="bg-[#141413] text-[#FAF7F2] px-3.5 py-2.5 rounded-xl border border-[#2E2D2A] shadow-xl text-xs space-y-1.5 min-w-[205px]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1">
        <span className="font-mono font-semibold text-[#D4A373]">{label}</span>
        <span className="text-[10px] text-[#A1A1AA]">
          {point.isForecast ? 'Prévision (+14j)' : 'Historique 30j'}
        </span>
      </div>
      <div className="space-y-1 font-mono tabular-nums">
        {point.actualStock !== null && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#E6E1D6]">Stock réel :</span>
            <span className="font-semibold text-white">{point.actualStock} u.</span>
          </div>
        )}
        {point.projectedStock !== null && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[#E6E1D6]">Stock projeté :</span>
            <span className="font-semibold text-[#C86D51]">
              {point.projectedStock} u.
            </span>
          </div>
        )}
        {!point.isForecast && point.unitsSold > 0 && (
          <div className="flex items-center justify-between gap-3 text-amber-300">
            <span>Ventes du jour :</span>
            <span>-{point.unitsSold} u.</span>
          </div>
        )}
        {!point.isForecast && point.restockUnits > 0 && (
          <div className="flex items-center justify-between gap-3 text-emerald-300">
            <span>Entrée atelier :</span>
            <span>+{point.restockUnits} u.</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 text-[11px] text-[#A1A1AA] pt-0.5 border-t border-white/10">
          <span>Seuil sécurité :</span>
          <span>{point.safetyThreshold} u.</span>
        </div>
      </div>
    </div>
  );
};

const VariantBarTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="bg-[#141413] text-[#FAF7F2] px-3.5 py-2.5 rounded-xl border border-[#2E2D2A] shadow-xl text-xs space-y-1.5 min-w-[220px]">
      <div className="font-mono font-semibold text-[#D4A373] border-b border-white/10 pb-1">
        {row.sku}
      </div>
      <div className="space-y-1 font-mono tabular-nums">
        <div className="flex justify-between gap-3">
          <span className="text-[#E6E1D6]">Stock actuel :</span>
          <span className="font-semibold">{row.currentStock} u.</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[#E6E1D6]">Ventes (30j) :</span>
          <span className="text-[#C86D51] font-semibold">{row.soldLast30d} u.</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[#E6E1D6]">Réassort conseillé :</span>
          <span className="text-emerald-300 font-semibold">
            +{row.recommendedRestockQty} u.
          </span>
        </div>
      </div>
    </div>
  );
};

function formatUrgencyBadge(urgency: RestockUrgency): {
  label: string;
  className: string;
} {
  switch (urgency) {
    case 'critical':
      return {
        label: 'Critique (≤ 7j)',
        className: 'bg-red-50 text-[#DC2626] border-red-200',
      };
    case 'warning':
      return {
        label: 'À anticiper',
        className: 'bg-amber-50 text-[#D97706] border-amber-200',
      };
    default:
      return {
        label: 'Nominal',
        className: 'bg-emerald-50 text-[#16A34A] border-emerald-200',
      };
  }
}

export const StockForecastChart: React.FC<StockForecastChartProps> = ({
  analytics,
  loading,
  onApplyRestockSuggestion,
}) => {
  const [selectedScope, setSelectedScope] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<'timeline' | 'variants'>('timeline');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'ACTIONABLE'>('ALL');

  const selectedVariant: VariantRestockPredictionDTO | null = useMemo(() => {
    if (!analytics || selectedScope === 'ALL' || selectedScope.startsWith('CAT:')) {
      return null;
    }
    const id = Number(selectedScope.replace('VAR:', ''));
    return analytics.variants.find((v) => v.variantId === id) ?? null;
  }, [analytics, selectedScope]);

  const activeSeries: StockHistoryPointDTO[] = useMemo(() => {
    if (!analytics) return [];
    if (selectedScope === 'ALL') return analytics.globalSeries;
    if (selectedVariant) return selectedVariant.series;

    if (selectedScope.startsWith('CAT:')) {
      const cat = selectedScope.replace('CAT:', '');
      const matching = analytics.variants.filter((v) => v.category === cat);
      if (matching.length === 0) return analytics.globalSeries;
      const len = matching[0].series.length;
      const agg: StockHistoryPointDTO[] = [];
      for (let idx = 0; idx < len; idx++) {
        const ref = matching[0].series[idx];
        let actualSum = 0;
        let projSum = 0;
        let hasActual = false;
        let hasProj = false;
        let sold = 0;
        let restock = 0;
        for (const m of matching) {
          const p = m.series[idx];
          if (!p) continue;
          if (p.actualStock !== null) {
            actualSum += p.actualStock;
            hasActual = true;
          }
          if (p.projectedStock !== null) {
            projSum += p.projectedStock;
            hasProj = true;
          }
          sold += p.unitsSold;
          restock += p.restockUnits;
        }
        agg.push({
          date: ref.date,
          label: ref.label,
          isForecast: ref.isForecast,
          actualStock: hasActual ? actualSum : null,
          projectedStock: hasProj ? Number(projSum.toFixed(1)) : null,
          safetyThreshold: matching.length * 3,
          unitsSold: sold,
          restockUnits: restock,
        });
      }
      return agg;
    }
    return analytics.globalSeries;
  }, [analytics, selectedScope, selectedVariant]);

  const filteredVariants = useMemo(() => {
    if (!analytics) return [];
    return analytics.variants.filter((v) => {
      if (selectedScope.startsWith('CAT:')) {
        if (v.category !== selectedScope.replace('CAT:', '')) return false;
      } else if (selectedVariant && v.variantId !== selectedVariant.variantId) {
        return false;
      }
      if (urgencyFilter === 'ACTIONABLE') {
        return v.urgency !== 'nominal' || v.recommendedRestockQty > 0;
      }
      return true;
    });
  }, [analytics, selectedScope, selectedVariant, urgencyFilter]);

  const barChartData = useMemo(() => {
    return (analytics?.variants || []).map((v) => ({
      sku: v.sku.replace('MV-', ''),
      fullSku: v.sku,
      currentStock: v.currentStock,
      soldLast30d: v.soldLast30d,
      recommendedRestockQty: v.recommendedRestockQty,
      projectedStock14d: v.projectedStock14d,
    }));
  }, [analytics]);

  const activeSafetyThreshold =
    activeSeries.length > 0 ? activeSeries[0].safetyThreshold : 3;

  if (loading && !analytics) {
    return (
      <div className="bg-white border border-[#E5E0D5] rounded-2xl p-6 space-y-4">
        <div className="h-5 w-72 bg-[#EFECE6] rounded animate-pulse" />
        <div className="h-[300px] w-full bg-[#FAF7F2] rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!analytics || analytics.variants.length === 0) {
    return (
      <div className="bg-white border border-[#E5E0D5] rounded-2xl p-8 text-center text-xs text-[#78746C]">
        Aucune donnée d’inventaire disponible pour calculer les prévisions de réapprovisionnement.
      </div>
    );
  }

  return (
    <section
      aria-label="Évolution des stocks et prédictions de réapprovisionnement"
      className="bg-white border border-[#E5E0D5] rounded-2xl overflow-hidden"
    >
      {/* Header & Controls */}
      <div className="px-6 py-4 border-b border-[#E5E0D5] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#C86D51] font-medium">
            <Activity className="w-3.5 h-3.5" />
            <span>Prévisions d’Atelier · Fenêtre glissante 30 jours & Projection +14j</span>
          </div>
          <h2 className="text-base font-semibold text-[#141413] mt-0.5">
            Évolution des Niveaux de Stocks & Réapprovisionnement
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scope Filter */}
          <select
            aria-label="Filtrer la courbe par collection ou référence"
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#FAF7F2] border border-[#DED8CC] rounded-lg text-[#141413] focus:outline-none focus:border-[#141413]"
          >
            <option value="ALL">Toutes les collections ({analytics.totalUnitsInStock} u.)</option>
            <optgroup label="Par collection">
              <option value="CAT:Luminaires">Collection Luminaires</option>
              <option value="CAT:Mobilier">Collection Mobilier</option>
              <option value="CAT:Acoustique">Collection Acoustique</option>
              <option value="CAT:Objets">Collection Objets</option>
            </optgroup>
            <optgroup label="Par édition (SKU)">
              {analytics.variants.map((v) => (
                <option key={v.variantId} value={`VAR:${v.variantId}`}>
                  {v.sku} — {v.productTitle} ({v.currentStock} u.)
                </option>
              ))}
            </optgroup>
          </select>

          {/* Chart Type Segmented Control */}
          <div
            role="group"
            aria-label="Type de graphique"
            className="inline-flex items-center gap-1 p-1 bg-[#F2ECE1] border border-[#E5E0D5] rounded-lg"
          >
            <button
              type="button"
              onClick={() => setChartMode('timeline')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                chartMode === 'timeline'
                  ? 'bg-[#141413] text-[#FAF7F2]'
                  : 'text-[#57534E] hover:text-[#141413]'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Évolution & Prévision</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('variants')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                chartMode === 'variants'
                  ? 'bg-[#141413] text-[#FAF7F2]'
                  : 'text-[#57534E] hover:text-[#141413]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Comparatif par Édition</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Metric Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E5E0D5] bg-[#FAF7F2] border-b border-[#E5E0D5] text-xs">
        <div className="px-6 py-3.5 flex items-center justify-between">
          <div>
            <span className="text-[#78746C] block">Ventes (30 derniers jours)</span>
            <span className="text-lg font-mono tabular-nums font-semibold text-[#141413]">
              {analytics.totalSoldLast30d} pièces
            </span>
          </div>
          <span className="font-mono tabular-nums text-[11px] text-[#57534E]">
            {(analytics.totalSoldLast30d / analytics.windowDays).toFixed(2)} u./jour
          </span>
        </div>

        <div className="px-6 py-3.5 flex items-center justify-between">
          <div>
            <span className="text-[#78746C] block">Éditions sous alerte rupture (≤ 7j)</span>
            <span className="text-lg font-mono tabular-nums font-semibold text-[#DC2626] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{analytics.criticalVariantsCount} référence{analytics.criticalVariantsCount > 1 ? 's' : ''}</span>
            </span>
          </div>
          <span className="text-[11px] text-[#78746C]">Seuil mini 3 u.</span>
        </div>

        <div className="px-6 py-3.5 flex items-center justify-between">
          <div>
            <span className="text-[#78746C] block">Réassort conseillé (cible 30j)</span>
            <span className="text-lg font-mono tabular-nums font-semibold text-[#141413]">
              +{analytics.totalRecommendedRestockUnits} pièces
            </span>
          </div>
          <span className="text-[11px] text-[#16A34A] font-medium">
            Couverture sécurisée
          </span>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="p-6">
        <div className="h-[310px] w-full">
          {chartMode === 'timeline' ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={activeSeries}
                margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="stockHistoryFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4A373" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#D4A373" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#78746C' }}
                  tickLine={false}
                  axisLine={{ stroke: '#DED8CC' }}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#78746C' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<TimelineTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                />
                <ReferenceLine
                  x="Aujourd’hui"
                  stroke="#141413"
                  strokeDasharray="3 3"
                  label={{
                    value: 'Aujourd’hui',
                    position: 'top',
                    fill: '#141413',
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  y={activeSafetyThreshold}
                  stroke="#D97706"
                  strokeDasharray="4 4"
                  label={{
                    value: `Seuil alerte (${activeSafetyThreshold} u.)`,
                    position: 'insideBottomRight',
                    fill: '#D97706',
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="actualStock"
                  name="Stock réel (30j)"
                  stroke="#141413"
                  strokeWidth={2.2}
                  fill="url(#stockHistoryFill)"
                  connectNulls={false}
                  dot={false}
                  activeDot={{ r: 4, fill: '#141413' }}
                />
                <Line
                  type="monotone"
                  dataKey="projectedStock"
                  name="Prévision épuisement (+14j)"
                  stroke="#C86D51"
                  strokeWidth={2.2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4, fill: '#C86D51' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData}
                margin={{ top: 10, right: 16, left: -12, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E0D5" vertical={false} />
                <XAxis
                  dataKey="sku"
                  tick={{ fontSize: 10, fill: '#57534E' }}
                  tickLine={false}
                  axisLine={{ stroke: '#DED8CC' }}
                  angle={-15}
                  textAnchor="end"
                  height={46}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#78746C' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<VariantBarTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar
                  dataKey="currentStock"
                  name="Stock actuel"
                  fill="#141413"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="soldLast30d"
                  name="Ventes 30j"
                  fill="#C86D51"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="recommendedRestockQty"
                  name="Réapprovisionnement conseillé"
                  fill="#D4A373"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Restock Predictions Matrix */}
      <div className="border-t border-[#E5E0D5]">
        <div className="px-6 py-3.5 bg-[#FAF7F2] border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-[#141413]">
            Prédictions de Réapprovisionnement par Édition ({filteredVariants.length})
          </span>
          <div className="inline-flex items-center gap-1 p-0.5 bg-[#F2ECE1] border border-[#E5E0D5] rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => setUrgencyFilter('ALL')}
              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                urgencyFilter === 'ALL'
                  ? 'bg-white text-[#141413] font-medium shadow-2xs'
                  : 'text-[#57534E]'
              }`}
            >
              Toutes ({analytics.variants.length})
            </button>
            <button
              type="button"
              onClick={() => setUrgencyFilter('ACTIONABLE')}
              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                urgencyFilter === 'ACTIONABLE'
                  ? 'bg-white text-[#141413] font-medium shadow-2xs'
                  : 'text-[#57534E]'
              }`}
            >
              Réassort requis
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F2ECE1] text-[#57534E] border-b border-[#E5E0D5] sticky top-0">
              <tr>
                <th className="py-2.5 px-4 font-medium">Réf. & Création</th>
                <th className="py-2.5 px-4 font-medium text-right">Stock Actuel</th>
                <th className="py-2.5 px-4 font-medium text-right">Ventes 30j</th>
                <th className="py-2.5 px-4 font-medium text-right">Rythme / j</th>
                <th className="py-2.5 px-4 font-medium text-right">Autonomie</th>
                <th className="py-2.5 px-4 font-medium">Statut</th>
                <th className="py-2.5 px-4 font-medium text-right">Réassort</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5]">
              {filteredVariants.map((v) => {
                const badge = formatUrgencyBadge(v.urgency);
                const targetNewStock = v.currentStock + v.recommendedRestockQty;
                return (
                  <tr key={v.variantId} className="hover:bg-[#FAF7F2]">
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-semibold text-[#141413]">
                        {v.sku}
                      </div>
                      <div className="text-[11px] text-[#78746C]">
                        {v.productTitle} · {v.variantName}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-[#141413]">
                      {v.currentStock} u.
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#57534E]">
                      {v.soldLast30d} u.
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#57534E]">
                      {v.dailyVelocity.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {v.daysUntilStockout === null ? (
                        <span className="text-[#78746C]">Stable</span>
                      ) : v.daysUntilStockout === 0 ? (
                        <span className="text-[#DC2626] font-semibold">Rupture</span>
                      ) : (
                        <span
                          className={
                            v.daysUntilStockout <= 7
                              ? 'text-[#DC2626] font-semibold'
                              : v.daysUntilStockout <= 20
                                ? 'text-[#D97706] font-medium'
                                : 'text-[#141413]'
                          }
                        >
                          ~{v.daysUntilStockout} j
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-medium border rounded-md whitespace-nowrap ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {v.recommendedRestockQty > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onApplyRestockSuggestion(v.variantId, targetNewStock)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-[#FAF7F2] border border-[#DED8CC] text-[#141413] rounded-lg hover:bg-[#141413] hover:text-[#FAF7F2] transition-colors whitespace-nowrap cursor-pointer"
                          title={`Pré-remplir le stock cible (${targetNewStock} u.) dans le tableau d'atelier`}
                        >
                          <PackagePlus className="w-3 h-3" />
                          <span>Pré-remplir +{v.recommendedRestockQty}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#78746C]">Suffisant</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
