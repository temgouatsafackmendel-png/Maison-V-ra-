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

export type CourierTrackingStatus =
  | 'awaiting_dispatch'
  | 'en_route'
  | 'arriving_soon'
  | 'delivered';

export interface CourierWaypoint {
  lat: number;
  lng: number;
  label: string;
}

export interface CourierTrackingDTO {
  orderId: number;
  courierName: string;
  courierPhone: string;
  vehicleLabel: string;
  vehiclePlate: string;
  hubName: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  currentLat: number;
  currentLng: number;
  headingDeg: number;
  speedKmh: number;
  progressPct: number;
  etaMinutes: number;
  distanceRemainingKm: number;
  totalDistanceKm: number;
  status: CourierTrackingStatus;
  lastCheckpoint: string;
  waypoints: CourierWaypoint[];
  updatedAt: string;
}

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
  tracking?: CourierTrackingDTO;
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

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'rescheduled';

export interface ConciergeAppointmentDTO {
  id: number;
  referenceCode: string;
  showroomCity: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  preferredDate: string;
  projectNote: string;
  status: AppointmentStatus;
  createdAt: string;
}

export type RestockUrgency = 'critical' | 'warning' | 'nominal';

export interface StockHistoryPointDTO {
  date: string;
  label: string;
  isForecast: boolean;
  actualStock: number | null;
  projectedStock: number | null;
  safetyThreshold: number;
  unitsSold: number;
  restockUnits: number;
}

export interface VariantRestockPredictionDTO {
  variantId: number;
  productId: number;
  productTitle: string;
  category: Product['category'];
  sku: string;
  variantName: string;
  currentStock: number;
  soldLast30d: number;
  dailyVelocity: number;
  daysUntilStockout: number | null;
  projectedStock14d: number;
  recommendedRestockQty: number;
  urgency: RestockUrgency;
  series: StockHistoryPointDTO[];
}

export interface InventoryAnalyticsDTO {
  generatedAt: string;
  windowDays: number;
  forecastDays: number;
  totalUnitsInStock: number;
  totalSoldLast30d: number;
  criticalVariantsCount: number;
  totalRecommendedRestockUnits: number;
  globalSeries: StockHistoryPointDTO[];
  variants: VariantRestockPredictionDTO[];
}


