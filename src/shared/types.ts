export type UserRole = 'customer' | 'admin';

export type CurrencyCode = 'XAF' | 'XOF' | 'EUR';

export type PaymentMethodType =
  | 'mtn_momo'
  | 'orange_money'
  | 'wave'
  | 'cash_on_delivery'
  | 'card';

export type DeliveryModeType =
  | 'home_express'
  | 'pickup_showroom'
  | 'regional_dhl';

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  sku: string;
  name: string;
  finish: string;
  priceCents: number;
  stock: number;
}

export interface Product {
  id: number;
  slug: string;
  title: string;
  category: 'Luminaires' | 'Mobilier' | 'Acoustique' | 'Objets';
  subtitle: string;
  description: string;
  craftsmanship: string;
  dimensions: string;
  imageUrl: string;
  featured: boolean;
  active: boolean;
  variants: ProductVariant[];
}

export interface CartItemInput {
  variantId: number;
  quantity: number;
}

export interface PricedCartItem {
  variantId: number;
  productId: number;
  sku: string;
  productTitle: string;
  variantName: string;
  finish: string;
  imageUrl: string;
  unitPriceCents: number;
  quantity: number;
  availableStock: number;
  lineTotalCents: number;
}

export interface CartQuote {
  items: PricedCartItem[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  freeShippingThresholdCents: number;
  deliveryMode: DeliveryModeType;
  appliedCoupon: {
    code: string;
    description: string;
    discountType: 'percentage' | 'fixed_cents';
    discountValue: number;
  } | null;
  couponError?: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'preparing'
  | 'shipped'
  | 'cancelled'
  | 'payment_failed';

export interface OrderItemDTO {
  id: number;
  productId: number;
  variantId: number;
  sku: string;
  productTitle: string;
  variantName: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderDTO {
  id: number;
  orderNumber: string;
  userId: number | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  landmark: string;
  deliveryMode: DeliveryModeType;
  paymentMethod: PaymentMethodType;
  paymentPhone: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  couponCode: string | null;
  status: OrderStatus;
  paymentIntentId: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDTO[];
}

export interface CouponDTO {
  id: number;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed_cents';
  discountValue: number;
  minSubtotalCents: number;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
}

export interface WebhookEventDTO {
  id: number;
  eventId: string;
  eventType: string;
  paymentIntentId: string;
  orderId: number | null;
  signatureValid: boolean;
  status: string;
  payloadJson: string;
  processedAt: string;
}

export interface SimulatedEmailDTO {
  id: number;
  orderId: number | null;
  recipientEmail: string;
  subject: string;
  templateName: string;
  bodyText: string;
  sentAt: string;
}

export interface AuditLogDTO {
  id: number;
  actorUserId: number | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  detailsJson: string;
  ipAddress: string;
  createdAt: string;
}
