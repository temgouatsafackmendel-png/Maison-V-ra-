import type {
  CurrencyCode,
  DeliveryModeType,
  OrderStatus,
  PaymentMethodType,
} from '../shared/types.ts';

// Parité officielle fixe Zone Franc : 1 EUR = 655,957 FCFA (XAF / XOF)
export const FCFA_PER_EURO = 655.957;

export function centsToFcfa(cents: number): number {
  const euros = cents / 100;
  // Arrondi au multiple de 50 FCFA le plus proche pour une tarification locale naturelle
  const rawFcfa = euros * FCFA_PER_EURO;
  if (rawFcfa === 0) return 0;
  return Math.round(rawFcfa / 50) * 50;
}

export function formatMoney(cents: number, currency: CurrencyCode = 'XAF'): string {
  if (currency === 'EUR') {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  const fcfaAmount = centsToFcfa(cents);
  const formattedNumber = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(fcfaAmount);

  return `${formattedNumber} FCFA (${currency})`;
}

export function formatCents(cents: number): string {
  return formatMoney(cents, 'XAF');
}

export function formatDualPrice(cents: number, currency: CurrencyCode = 'XAF'): string {
  const primary = formatMoney(cents, currency);
  if (currency === 'EUR') {
    return `${primary} (~${new Intl.NumberFormat('fr-FR').format(centsToFcfa(cents))} FCFA)`;
  }
  const eur = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
  return `${primary} · ${eur}`;
}

export function formatDateTime(isoOrSqlDate: string): string {
  const normalized = isoOrSqlDate.includes('T')
    ? isoOrSqlDate
    : `${isoOrSqlDate.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return isoOrSqlDate;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending_payment':
      return 'En attente de confirmation Mobile Money / Paiement';
    case 'paid':
      return 'Payée · Confirmée';
    case 'preparing':
      return 'En préparation à l’atelier';
    case 'shipped':
      return 'En cours de livraison (Coursier / Transporteur)';
    case 'cancelled':
      return 'Annulée (Stock restitué)';
    case 'payment_failed':
      return 'Échec transaction (Stock restitué)';
    default:
      return status;
  }
}

export function formatPaymentMethodLabel(method: PaymentMethodType): string {
  switch (method) {
    case 'mtn_momo':
      return 'MTN Mobile Money (MoMo)';
    case 'orange_money':
      return 'Orange Money';
    case 'wave':
      return 'Wave Mobile Money';
    case 'cash_on_delivery':
      return 'Paiement à la livraison (Espèces / MoMo au livreur)';
    case 'card':
      return 'Carte Bancaire Visa / Mastercard';
    default:
      return method;
  }
}

export function formatDeliveryModeLabel(mode: DeliveryModeType): string {
  switch (mode) {
    case 'home_express':
      return 'Coursier Express à domicile (Quartier & Point de repère)';
    case 'pickup_showroom':
      return 'Retrait Gratuit en Showroom (Douala, Yaoundé, Abidjan, Dakar)';
    case 'regional_dhl':
      return 'Expédition Régionale Sécurisée CEMAC / UEMOA (DHL)';
    default:
      return mode;
  }
}
