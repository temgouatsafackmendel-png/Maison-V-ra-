import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  X,
  Mail,
  Smartphone,
  MapPin,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react';
import type {
  CurrencyCode,
  OrderDTO,
  SimulatedEmailDTO,
} from '../shared/types.ts';
import {
  formatDateTime,
  formatDeliveryModeLabel,
  formatMoney,
  formatOrderStatusLabel,
  formatPaymentMethodLabel,
} from '../utils/format.ts';

interface OrderSandboxModalProps {
  order: OrderDTO | null;
  authToken: string | null;
  currency?: CurrencyCode;
  onClose: () => void;
  onOrderUpdated: (updated: OrderDTO) => void;
}

export const OrderSandboxModal: React.FC<OrderSandboxModalProps> = ({
  order,
  authToken,
  currency = 'XAF',
  onClose,
  onOrderUpdated,
}) => {
  const [currentOrder, setCurrentOrder] = useState<OrderDTO | null>(order);
  const [emails, setEmails] = useState<SimulatedEmailDTO[]>([]);
  const [ussdPin, setUssdPin] = useState('');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    setCurrentOrder(order);
    setStatusBanner(null);
    if (order) {
      fetchOrderDetails(order.id, order.paymentIntentId);
    }
  }, [order]);

  if (!currentOrder) return null;

  const fetchOrderDetails = async (orderId: number, paymentIntentId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      const res = await fetch(
        `/api/orders/${orderId}?paymentIntentId=${encodeURIComponent(paymentIntentId)}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        setCurrentOrder(data.order);
        setEmails(data.emails || []);
      }
    } catch {
      // ignore transient error
    }
  };

  const handlePaymentConfirmation = async (
    eventType:
      | 'payment_intent.succeeded'
      | 'payment_intent.payment_failed'
      | 'order.cancelled'
  ) => {
    setLoadingAction(eventType);
    setStatusBanner(null);
    try {
      const res = await fetch('/api/payments/sandbox-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: currentOrder.paymentIntentId,
          eventType,
          failureReason:
            eventType === 'payment_intent.payment_failed'
              ? 'Opération annulée par le titulaire du compte Mobile Money'
              : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusBanner({
          ok: false,
          message: data.error || 'Le règlement n’a pas pu être validé.',
        });
        return;
      }

      if (data.order) {
        setCurrentOrder(data.order);
        onOrderUpdated(data.order);
      }

      setStatusBanner({
        ok: eventType === 'payment_intent.succeeded',
        message:
          eventType === 'payment_intent.succeeded'
            ? 'Votre règlement a été confirmé. Votre facture acquittée est disponible ci-dessous.'
            : 'La commande a été annulée et les pièces réservées ont été remises en rayon.',
      });

      await fetchOrderDetails(currentOrder.id, currentOrder.paymentIntentId);
    } catch {
      setStatusBanner({
        ok: false,
        message: 'Une erreur est survenue lors de la communication avec le service de paiement.',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopyWhatsAppReceipt = () => {
    const summary = [
      `*MAISON VÉRA — COMMANDE ${currentOrder.orderNumber}*`,
      `Client : ${currentOrder.customerName} (${currentOrder.customerPhone})`,
      `Destination : ${currentOrder.shippingAddress}, ${currentOrder.shippingCity} (${currentOrder.shippingCountry})`,
      currentOrder.landmark ? `Point de repère : ${currentOrder.landmark}` : '',
      `Mode de règlement : ${formatPaymentMethodLabel(currentOrder.paymentMethod)}`,
      `Total TTC : ${formatMoney(currentOrder.totalCents, currency)}`,
      `Statut : ${formatOrderStatusLabel(currentOrder.status)}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard?.writeText(summary);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const ussdCode =
    currentOrder.paymentMethod === 'orange_money'
      ? '#150#'
      : currentOrder.paymentMethod === 'mtn_momo'
        ? '*126#'
        : 'Wave';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Détail et suivi de votre commande"
    >
      <div className="bg-[#FAF8F5] border border-[#E4E0D8] rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E4E0D8] bg-[#F3EFEA]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#52525B]">
              <span className="font-mono font-semibold text-[#18181B]">
                Référence {currentOrder.orderNumber}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatOrderStatusLabel(currentOrder.status)}</span>
            </div>
            <h2 className="text-2xl font-display font-semibold text-[#18181B] mt-0.5">
              Certificat de Commande & Suivi de Livraison
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#52525B] hover:text-[#18181B] rounded-lg"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {statusBanner && (
            <div
              className={`p-4 rounded-lg border text-xs flex items-center gap-2.5 ${
                statusBanner.ok
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
              role="status"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusBanner.message}</span>
            </div>
          )}

          {/* Order Summary & Delivery Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-white border border-[#E4E0D8] rounded-xl text-xs">
            <div className="space-y-1">
              <span className="text-[#71717A] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>Destinataire & Adresse</span>
              </span>
              <strong className="text-[#18181B] block">
                {currentOrder.customerName}
              </strong>
              <span className="font-mono text-[#52525B] block">
                {currentOrder.customerPhone}
              </span>
              <span className="text-[#52525B] block">
                {currentOrder.shippingAddress}, {currentOrder.shippingCity} (
                {currentOrder.shippingCountry})
              </span>
              {currentOrder.landmark && (
                <span className="text-[#3F3F46] block italic">
                  Repère : « {currentOrder.landmark} »
                </span>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[#71717A] flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mode de Règlement & Transport</span>
              </span>
              <strong className="text-[#18181B] block">
                {formatPaymentMethodLabel(currentOrder.paymentMethod)}
              </strong>
              <span className="text-[#52525B] block">
                {formatDeliveryModeLabel(currentOrder.deliveryMode)}
              </span>
            </div>

            <div className="md:text-right space-y-1.5">
              <span className="text-[#71717A] block">Montant Total TTC</span>
              <span className="text-lg font-semibold font-mono tabular-nums text-[#18181B] block">
                {formatMoney(currentOrder.totalCents, currency)}
              </span>
              <button
                type="button"
                onClick={handleCopyWhatsAppReceipt}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium underline text-[#18181B] hover:text-[#52525B]"
              >
                {copiedWhatsApp ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>Récapitulatif WhatsApp copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copier le bon pour WhatsApp</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Payment Step when Pending Payment */}
          {currentOrder.status === 'pending_payment' && (
            <div className="p-6 bg-[#18181B] text-[#FAF8F5] rounded-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    Validation finale de votre règlement —{' '}
                    {formatPaymentMethodLabel(currentOrder.paymentMethod)}
                  </span>
                </div>
                <span className="font-mono text-xs text-[#A1A1AA]">
                  {currentOrder.paymentPhone || currentOrder.customerPhone}
                </span>
              </div>

              {currentOrder.paymentMethod === 'cash_on_delivery' ? (
                <p className="text-xs text-[#E4E4E7] leading-relaxed">
                  Vous avez choisi le paiement à la livraison. Confirmez votre disponibilité téléphonique sur le{' '}
                  <strong className="font-mono">{currentOrder.customerPhone}</strong> pour lancer immédiatement la préparation de vos pièces en atelier.
                </p>
              ) : (
                <p className="text-xs text-[#E4E4E7] leading-relaxed">
                  Une demande de règlement de{' '}
                  <strong>{formatMoney(currentOrder.totalCents, currency)}</strong> a été initiée sur le numéro{' '}
                  <strong className="font-mono">
                    {currentOrder.paymentPhone || currentOrder.customerPhone}
                  </strong>{' '}
                  ({ussdCode}). Saisissez votre code secret pour finaliser la transaction :
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {currentOrder.paymentMethod !== 'cash_on_delivery' && (
                  <input
                    type="password"
                    maxLength={4}
                    value={ussdPin}
                    onChange={(e) => setUssdPin(e.target.value)}
                    placeholder="••••"
                    aria-label="Code secret Mobile Money"
                    className="w-24 px-3 py-2.5 text-center font-mono text-sm bg-[#27272A] border border-[#52525B] rounded-lg text-white focus:outline-none focus:border-white"
                  />
                )}
                <button
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() =>
                    handlePaymentConfirmation('payment_intent.succeeded')
                  }
                  className="px-5 py-2.5 text-xs font-medium bg-[#FAF8F5] text-[#18181B] rounded-lg hover:bg-[#E4E0D8] disabled:opacity-50 transition-colors"
                >
                  {loadingAction === 'payment_intent.succeeded'
                    ? 'Validation en cours...'
                    : currentOrder.paymentMethod === 'cash_on_delivery'
                      ? 'Confirmer ma commande'
                      : `Confirmer le paiement (${formatMoney(
                          currentOrder.totalCents,
                          currency
                        )})`}
                </button>

                <button
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() =>
                    handlePaymentConfirmation('order.cancelled')
                  }
                  className="px-4 py-2.5 text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
                >
                  Annuler la commande
                </button>
              </div>
            </div>
          )}

          {/* Order Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[#18181B]">
              Pièces sélectionnées
            </h3>
            <div className="border border-[#E4E0D8] rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F3EFEA] text-[#52525B] border-b border-[#E4E0D8]">
                  <tr>
                    <th className="py-3 px-4 font-medium">Création & Finition</th>
                    <th className="py-3 px-4 font-medium">Référence</th>
                    <th className="py-3 px-4 font-medium text-right">Prix Unitaire</th>
                    <th className="py-3 px-4 font-medium text-right">Qté</th>
                    <th className="py-3 px-4 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E0D8]">
                  {currentOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#18181B]">
                          {item.productTitle}
                        </div>
                        <div className="text-[#71717A]">{item.variantName}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#52525B]">{item.sku}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right">
                        {formatMoney(item.unitPriceCents, currency)}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-right">
                        {item.quantity}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums font-medium text-right">
                        {formatMoney(item.lineTotalCents, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Communications & Receipts */}
          {emails.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#18181B]">
                <Mail className="w-4 h-4" />
                <span>Courriers & Confirmations de la Maison ({emails.length})</span>
              </div>
              <div className="space-y-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className="p-4 bg-white border border-[#E4E0D8] rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[#52525B]">
                      <span className="font-semibold text-[#18181B]">
                        {email.subject}
                      </span>
                      <span className="text-[11px] text-[#71717A]">
                        {formatDateTime(email.sentAt)}
                      </span>
                    </div>
                    <pre className="text-xs font-sans whitespace-pre-wrap text-[#3F3F46] bg-[#FAF8F5] p-3 rounded-lg border border-[#E4E0D8] mt-1 leading-relaxed">
                      {email.bodyText}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F3EFEA] border-t border-[#E4E0D8] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-medium bg-[#18181B] text-[#FAF8F5] rounded-lg hover:bg-[#27272A] transition-colors"
          >
            Continuer ma visite
          </button>
        </div>
      </div>
    </div>
  );
};
