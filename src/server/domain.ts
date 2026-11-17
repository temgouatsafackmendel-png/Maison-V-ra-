import crypto from 'node:crypto';
import { z } from 'zod';
import type { DBInstance } from './db.ts';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
  verifyWebhookSignature,
} from './security.ts';
import { centsToFcfa } from '../utils/format.ts';
import type {
  AuditLogDTO,
  CartItemInput,
  CartQuote,
  CouponDTO,
  DeliveryModeType,
  OrderDTO,
  OrderItemDTO,
  OrderStatus,
  PaymentMethodType,
  PricedCartItem,
  Product,
  ProductVariant,
  SimulatedEmailDTO,
  UserProfile,
  WebhookEventDTO,
} from '../shared/types.ts';

export const FREE_SHIPPING_THRESHOLD_CENTS = 50000; // 500,00 € (~328 000 FCFA)
export const STANDARD_SHIPPING_CENTS = 2500; // 25,00 € (~16 400 FCFA)
export const REGIONAL_DHL_SHIPPING_CENTS = 4500; // 45,00 € (~29 500 FCFA)
export const VAT_RATE = 0.2; // 20% TVA

export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const DeliveryModeSchema = z
  .enum(['home_express', 'pickup_showroom', 'regional_dhl'])
  .default('home_express');

export const PaymentMethodSchema = z
  .enum(['mtn_momo', 'orange_money', 'wave', 'cash_on_delivery', 'card'])
  .default('mtn_momo');

// Validation Schemas
export const CartItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
});

export const CartQuoteRequestSchema = z.object({
  items: z.array(CartItemSchema).min(0).max(50),
  couponCode: z.string().trim().max(40).optional().nullable(),
  deliveryMode: DeliveryModeSchema.optional(),
});

export const CheckoutRequestSchema = z.object({
  items: z.array(CartItemSchema).min(1, 'Le panier ne peut pas être vide').max(50),
  couponCode: z.string().trim().max(40).optional().nullable(),
  customerEmail: z.string().trim().email('Adresse email invalide').max(120),
  customerName: z.string().trim().min(2, 'Nom complet requis').max(120),
  customerPhone: z
    .string()
    .trim()
    .min(6, 'Numéro de téléphone Mobile / WhatsApp requis')
    .max(40)
    .default('+237 699 00 11 22'),
  shippingAddress: z.string().trim().min(4, 'Quartier ou adresse de livraison requis').max(200),
  shippingCity: z.string().trim().min(2, 'Ville requise').max(100),
  shippingPostalCode: z
    .string()
    .trim()
    .max(20)
    .default('BP 000'),
  shippingCountry: z.string().trim().min(2).max(80).default('Cameroun'),
  landmark: z.string().trim().max(240).default(''),
  deliveryMode: DeliveryModeSchema.default('home_express'),
  paymentMethod: PaymentMethodSchema.default('mtn_momo'),
  paymentPhone: z.string().trim().max(40).default(''),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const RegisterSchema = z.object({
  email: z.string().trim().email('Format email invalide').max(120),
  name: z.string().trim().min(2, 'Nom trop court').max(100),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(128),
});

export const LoginSchema = z.object({
  email: z.string().trim().email('Format email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const AdminStockUpdateSchema = z.object({
  stock: z.number().int().min(0, 'Le stock ne peut pas être négatif').max(10000),
  priceCents: z.number().int().min(100, 'Le prix minimum est de 1,00 €').max(10000000).optional(),
});

export const AdminCouponCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,24}$/, 'Code coupon invalide (3-24 caractères alphanumériques)'),
  description: z.string().trim().min(4).max(200),
  discountType: z.enum(['percentage', 'fixed_cents']),
  discountValue: z.number().int().positive(),
  minSubtotalCents: z.number().int().min(0).default(0),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export const WebhookPayloadSchema = z.object({
  id: z.string().trim().min(4).max(128),
  type: z.enum([
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'order.cancelled',
  ]),
  data: z.object({
    paymentIntentId: z.string().trim().min(4).max(128),
    orderNumber: z.string().trim().optional(),
    failureReason: z.string().trim().optional(),
  }),
});

export class EcommerceService {
  private readonly db: DBInstance;

  constructor(db: DBInstance) {
    this.db = db;
  }

  public logAudit(params: {
    actorUserId: number | null;
    actorEmail: string;
    action: string;
    targetType: string;
    targetId: string;
    details: Record<string, unknown>;
    ipAddress?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO audit_logs (actor_user_id, actor_email, action, target_type, target_id, details_json, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        params.actorUserId,
        params.actorEmail,
        params.action,
        params.targetType,
        params.targetId,
        JSON.stringify(params.details),
        params.ipAddress || '127.0.0.1'
      );
  }

  public sendSimulatedEmail(params: {
    orderId: number | null;
    recipientEmail: string;
    subject: string;
    templateName: string;
    bodyText: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO simulated_emails (order_id, recipient_email, subject, template_name, body_text)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        params.orderId,
        params.recipientEmail,
        params.subject,
        params.templateName,
        params.bodyText
      );
  }

  // --- Catalog & Variants ---
  public listProducts(includeInactive = false): Product[] {
    const productRows = this.db
      .prepare(
        `SELECT * FROM products ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY featured DESC, id ASC`
      )
      .all() as Array<Record<string, unknown>>;

    const variantRows = this.db
      .prepare(`SELECT * FROM product_variants ORDER BY id ASC`)
      .all() as Array<Record<string, unknown>>;

    const variantsByProduct = new Map<number, ProductVariant[]>();
    for (const v of variantRows) {
      const productId = Number(v.product_id);
      const list = variantsByProduct.get(productId) || [];
      list.push({
        id: Number(v.id),
        productId,
        sku: String(v.sku),
        name: String(v.name),
        finish: String(v.finish),
        priceCents: Number(v.price_cents),
        stock: Number(v.stock),
      });
      variantsByProduct.set(productId, list);
    }

    return productRows.map((p) => ({
      id: Number(p.id),
      slug: String(p.slug),
      title: String(p.title),
      category: p.category as Product['category'],
      subtitle: String(p.subtitle),
      description: String(p.description),
      craftsmanship: String(p.craftsmanship),
      dimensions: String(p.dimensions),
      imageUrl: String(p.image_url),
      featured: Boolean(p.featured),
      active: Boolean(p.active),
      variants: variantsByProduct.get(Number(p.id)) || [],
    }));
  }

  // --- Server-Side Cart & Price Recalculation ---
  public calculateCartPricing(
    rawItems: CartItemInput[],
    rawCouponCode?: string | null,
    deliveryMode: DeliveryModeType = 'home_express'
  ): CartQuote {
    const mergedMap = new Map<number, number>();
    for (const item of rawItems) {
      if (item.quantity <= 0) continue;
      mergedMap.set(item.variantId, (mergedMap.get(item.variantId) || 0) + item.quantity);
    }

    const pricedItems: PricedCartItem[] = [];
    let subtotalCents = 0;

    for (const [variantId, quantity] of mergedMap.entries()) {
      const row = this.db
        .prepare(
          `SELECT
             v.id as variant_id,
             v.product_id,
             v.sku,
             v.name as variant_name,
             v.finish,
             v.price_cents,
             v.stock,
             p.title as product_title,
             p.image_url,
             p.active
           FROM product_variants v
           INNER JOIN products p ON p.id = v.product_id
           WHERE v.id = ?`
        )
        .get(variantId) as Record<string, unknown> | undefined;

      if (!row || !row.active) {
        throw new DomainError(
          `La variante sélectionnée (#${variantId}) est introuvable ou indisponible.`,
          404,
          'VARIANT_NOT_FOUND'
        );
      }

      const unitPriceCents = Number(row.price_cents);
      const availableStock = Number(row.stock);
      const lineTotalCents = unitPriceCents * quantity;
      subtotalCents += lineTotalCents;

      pricedItems.push({
        variantId,
        productId: Number(row.product_id),
        sku: String(row.sku),
        productTitle: String(row.product_title),
        variantName: String(row.variant_name),
        finish: String(row.finish),
        imageUrl: String(row.image_url),
        unitPriceCents,
        quantity,
        availableStock,
        lineTotalCents,
      });
    }

    let discountCents = 0;
    let appliedCoupon: CartQuote['appliedCoupon'] = null;
    let couponError: string | undefined;

    const normalizedCode = rawCouponCode ? rawCouponCode.trim().toUpperCase() : '';
    if (normalizedCode && subtotalCents > 0) {
      const coupon = this.db
        .prepare(`SELECT * FROM coupons WHERE UPPER(code) = ?`)
        .get(normalizedCode) as Record<string, unknown> | undefined;

      if (!coupon) {
        couponError = `Le code promotionnel "${normalizedCode}" n'existe pas.`;
      } else if (!coupon.active) {
        couponError = `Le code promotionnel "${normalizedCode}" est désactivé.`;
      } else if (
        coupon.expires_at &&
        new Date(String(coupon.expires_at)).getTime() < Date.now()
      ) {
        couponError = `Le code promotionnel "${normalizedCode}" a expiré.`;
      } else if (
        coupon.max_uses !== null &&
        coupon.max_uses !== undefined &&
        Number(coupon.used_count) >= Number(coupon.max_uses)
      ) {
        couponError = `Le plafond d'utilisation du code "${normalizedCode}" est atteint.`;
      } else if (subtotalCents < Number(coupon.min_subtotal_cents)) {
        const minEuros = (Number(coupon.min_subtotal_cents) / 100).toFixed(2);
        const minFcfa = new Intl.NumberFormat('fr-FR').format(
          centsToFcfa(Number(coupon.min_subtotal_cents))
        );
        couponError = `Ce code requiert un montant minimum de ${minEuros} € (${minFcfa} FCFA).`;
      } else {
        const discountType = coupon.discount_type as 'percentage' | 'fixed_cents';
        const discountValue = Number(coupon.discount_value);
        if (discountType === 'percentage') {
          discountCents = Math.round((subtotalCents * discountValue) / 100);
        } else {
          discountCents = Math.min(subtotalCents, discountValue);
        }
        appliedCoupon = {
          code: String(coupon.code),
          description: String(coupon.description),
          discountType,
          discountValue,
        };
      }
    }

    const discountedSubtotalCents = Math.max(0, subtotalCents - discountCents);

    let shippingCents = 0;
    if (pricedItems.length > 0) {
      if (deliveryMode === 'pickup_showroom') {
        shippingCents = 0;
      } else if (deliveryMode === 'regional_dhl') {
        shippingCents =
          discountedSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS * 2
            ? 0
            : REGIONAL_DHL_SHIPPING_CENTS;
      } else {
        shippingCents =
          discountedSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
            ? 0
            : STANDARD_SHIPPING_CENTS;
      }
    }

    const totalCents = discountedSubtotalCents + shippingCents;
    const taxCents = Math.round(totalCents - totalCents / (1 + VAT_RATE));

    return {
      items: pricedItems,
      subtotalCents,
      discountCents,
      shippingCents,
      taxCents,
      totalCents,
      freeShippingThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS,
      deliveryMode,
      appliedCoupon,
      couponError,
    };
  }

  // --- Transactional Checkout with Idempotency & Stock Deduction ---
  public createCheckoutOrder(
    rawInput: z.infer<typeof CheckoutRequestSchema>,
    user: UserProfile | null,
    ipAddress = '127.0.0.1'
  ): { order: OrderDTO; idempotentReplay: boolean } {
    const input = CheckoutRequestSchema.parse(rawInput);

    // 1. Check idempotency key before starting write transaction
    const existingOrderRow = this.db
      .prepare(`SELECT id FROM orders WHERE idempotency_key = ?`)
      .get(input.idempotencyKey) as { id: number } | undefined;

    if (existingOrderRow) {
      return {
        order: this.getOrderById(existingOrderRow.id),
        idempotentReplay: true,
      };
    }

    const executeTransaction = this.db.transaction(() => {
      const replayCheck = this.db
        .prepare(`SELECT id FROM orders WHERE idempotency_key = ?`)
        .get(input.idempotencyKey) as { id: number } | undefined;
      if (replayCheck) {
        return { orderId: replayCheck.id, replay: true };
      }

      // Recalculate authoritative server-side pricing
      const quote = this.calculateCartPricing(
        input.items,
        input.couponCode,
        input.deliveryMode
      );

      if (input.couponCode && input.couponCode.trim() !== '' && quote.couponError) {
        throw new DomainError(quote.couponError, 400, 'INVALID_COUPON');
      }

      // Verify and atomically deduct stock for every item
      const deductStockStmt = this.db.prepare(
        `UPDATE product_variants
         SET stock = stock - ?
         WHERE id = ? AND stock >= ?`
      );

      for (const item of quote.items) {
        const res = deductStockStmt.run(item.quantity, item.variantId, item.quantity);
        if (res.changes !== 1) {
          throw new DomainError(
            `Stock insuffisant pour "${item.productTitle} (${item.variantName})". Disponible : ${item.availableStock}, demandé : ${item.quantity}.`,
            409,
            'INSUFFICIENT_STOCK'
          );
        }
      }

      // Increment coupon usage atomically if applied
      if (quote.appliedCoupon) {
        const couponRes = this.db
          .prepare(
            `UPDATE coupons
             SET used_count = used_count + 1
             WHERE code = ? AND active = 1 AND (max_uses IS NULL OR used_count < max_uses)`
          )
          .run(quote.appliedCoupon.code);

        if (couponRes.changes !== 1) {
          throw new DomainError(
            `Le code promotionnel "${quote.appliedCoupon.code}" n'est plus disponible.`,
            409,
            'COUPON_EXHAUSTED'
          );
        }
      }

      const orderNumber = `MV-${new Date().getFullYear()}-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`;
      const paymentIntentId = `pi_${input.paymentMethod}_${crypto.randomBytes(8).toString('hex')}`;
      const effectivePaymentPhone = input.paymentPhone || input.customerPhone;

      const insertOrderResult = this.db
        .prepare(
          `INSERT INTO orders (
             order_number, user_id, customer_email, customer_name, customer_phone,
             shipping_address, shipping_city, shipping_postal_code, shipping_country,
             landmark, delivery_mode, payment_method, payment_phone,
             subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
             coupon_code, status, payment_intent_id, idempotency_key, stock_deducted
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?, 1)`
        )
        .run(
          orderNumber,
          user ? user.id : null,
          input.customerEmail.toLowerCase(),
          input.customerName,
          input.customerPhone,
          input.shippingAddress,
          input.shippingCity,
          input.shippingPostalCode,
          input.shippingCountry,
          input.landmark,
          input.deliveryMode,
          input.paymentMethod,
          effectivePaymentPhone,
          quote.subtotalCents,
          quote.discountCents,
          quote.shippingCents,
          quote.taxCents,
          quote.totalCents,
          quote.appliedCoupon ? quote.appliedCoupon.code : null,
          paymentIntentId,
          input.idempotencyKey
        );

      const orderId = Number(insertOrderResult.lastInsertRowid);

      const insertOrderItem = this.db.prepare(
        `INSERT INTO order_items (
           order_id, product_id, variant_id, sku, product_title, variant_name,
           unit_price_cents, quantity, line_total_cents
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const item of quote.items) {
        insertOrderItem.run(
          orderId,
          item.productId,
          item.variantId,
          item.sku,
          item.productTitle,
          item.variantName,
          item.unitPriceCents,
          item.quantity,
          item.lineTotalCents
        );
      }

      const totalFcfa = new Intl.NumberFormat('fr-FR').format(
        centsToFcfa(quote.totalCents)
      );

      this.logAudit({
        actorUserId: user ? user.id : null,
        actorEmail: input.customerEmail.toLowerCase(),
        action: 'ORDER_CREATED_STOCK_RESERVED',
        targetType: 'order',
        targetId: orderNumber,
        details: {
          orderId,
          totalCents: quote.totalCents,
          totalFcfa: `${totalFcfa} FCFA`,
          paymentMethod: input.paymentMethod,
          deliveryMode: input.deliveryMode,
          shippingCity: input.shippingCity,
          shippingCountry: input.shippingCountry,
          couponCode: quote.appliedCoupon?.code || null,
          paymentIntentId,
        },
        ipAddress,
      });

      // 1. Email de confirmation de commande
      this.sendSimulatedEmail({
        orderId,
        recipientEmail: input.customerEmail.toLowerCase(),
        subject: `Maison Véra — Commande ${orderNumber} enregistrée (${totalFcfa} FCFA)`,
        templateName: 'order_created_pending_payment',
        bodyText: [
          `Bonjour ${input.customerName},`,
          ``,
          `Votre commande ${orderNumber} d'un montant total de ${totalFcfa} FCFA (${(quote.totalCents / 100).toFixed(2)} € TTC) est enregistrée.`,
          `Mode de règlement sélectionné : ${input.paymentMethod.toUpperCase()} (${effectivePaymentPhone}).`,
          `Livraison : ${input.shippingAddress}, ${input.shippingCity} (${input.shippingCountry})${input.landmark ? ` — Point de repère : ${input.landmark}` : ''}.`,
          `Contact livreur / WhatsApp : ${input.customerPhone}.`,
          ``,
          `Vos pièces sont réservées dans notre stock d'atelier (Réf. transaction : ${paymentIntentId}).`,
          `Maison Véra — Douala · Abidjan · Dakar · Paris`,
        ].join('\n'),
      });

      // 2. Notification SMS / WhatsApp & Push USSD Mobile Money simulée
      const ussdInstruction =
        input.paymentMethod === 'orange_money'
          ? `Composez #150# sur le ${effectivePaymentPhone} pour valider le débit Orange Money de ${totalFcfa} FCFA.`
          : input.paymentMethod === 'mtn_momo'
            ? `Composez *126# sur le ${effectivePaymentPhone} pour confirmer le paiement MTN MoMo de ${totalFcfa} FCFA.`
            : input.paymentMethod === 'wave'
              ? `Ouvrez votre application Wave sur le ${effectivePaymentPhone} pour valider ${totalFcfa} FCFA.`
              : input.paymentMethod === 'cash_on_delivery'
                ? `Préparez ${totalFcfa} FCFA (Espèces ou Mobile Money) à remettre à notre coursier lors de la livraison.`
                : `Validation 3D-Secure en attente pour ${totalFcfa} FCFA.`;

      this.sendSimulatedEmail({
        orderId,
        recipientEmail: `${input.customerEmail.toLowerCase()}`,
        subject: `[SMS / WhatsApp ${input.customerPhone}] Push Paiement & Suivi ${orderNumber}`,
        templateName: 'sms_whatsapp_mobile_money_push',
        bodyText: `[MAISON VÉRA AFRIQUE] Bonjour ${input.customerName}, commande ${orderNumber} (${totalFcfa} FCFA) réservée. ${ussdInstruction} Suivi direct avec le code ${orderNumber}.`,
      });

      return { orderId, replay: false };
    });

    const { orderId, replay } = executeTransaction();
    return {
      order: this.getOrderById(orderId),
      idempotentReplay: replay,
    };
  }

  // --- Signed & Idempotent Payment Webhook Processing ---
  public processPaymentWebhook(params: {
    rawBody: string;
    signatureHeader: string | undefined;
    ipAddress?: string;
  }): {
    status: string;
    idempotentReplay: boolean;
    eventId: string;
    order?: OrderDTO;
  } {
    const verification = verifyWebhookSignature(params.rawBody, params.signatureHeader);
    if (!verification.valid) {
      this.logAudit({
        actorUserId: null,
        actorEmail: 'webhook@payment-gateway.sandbox',
        action: 'WEBHOOK_SIGNATURE_REJECTED',
        targetType: 'webhook',
        targetId: 'invalid_signature',
        details: { reason: verification.reason },
        ipAddress: params.ipAddress,
      });
      throw new DomainError(
        verification.reason || 'Signature webhook invalide',
        401,
        'INVALID_WEBHOOK_SIGNATURE'
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(params.rawBody);
    } catch {
      throw new DomainError('Corps JSON du webhook invalide', 400, 'INVALID_WEBHOOK_JSON');
    }

    const payload = WebhookPayloadSchema.parse(parsedJson);

    const runWebhookTx = this.db.transaction(() => {
      const existingEvent = this.db
        .prepare(`SELECT id, order_id, status FROM webhook_events WHERE event_id = ?`)
        .get(payload.id) as { id: number; order_id: number | null; status: string } | undefined;

      if (existingEvent) {
        return {
          idempotentReplay: true,
          status: existingEvent.status,
          orderId: existingEvent.order_id,
        };
      }

      const orderRow = this.db
        .prepare(`SELECT * FROM orders WHERE payment_intent_id = ?`)
        .get(payload.data.paymentIntentId) as Record<string, unknown> | undefined;

      if (!orderRow) {
        throw new DomainError(
          `Aucune commande associée au payment_intent_id "${payload.data.paymentIntentId}"`,
          404,
          'ORDER_NOT_FOUND'
        );
      }

      const orderId = Number(orderRow.id);
      const currentStatus = String(orderRow.status) as OrderStatus;
      const orderNumber = String(orderRow.order_number);
      const customerEmail = String(orderRow.customer_email);
      const customerName = String(orderRow.customer_name);
      const customerPhone = String(orderRow.customer_phone || '+237 699 00 11 22');
      const paymentMethod = String(orderRow.payment_method || 'mtn_momo');
      const totalCents = Number(orderRow.total_cents);
      const totalFcfa = new Intl.NumberFormat('fr-FR').format(centsToFcfa(totalCents));
      const stockDeducted = Number(orderRow.stock_deducted) === 1;
      const couponCode = orderRow.coupon_code ? String(orderRow.coupon_code) : null;

      let nextStatus: OrderStatus = currentStatus;

      if (payload.type === 'payment_intent.succeeded') {
        if (currentStatus === 'pending_payment' || currentStatus === 'payment_failed') {
          if (!stockDeducted) {
            const items = this.getOrderItems(orderId);
            const deductStmt = this.db.prepare(
              `UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?`
            );
            for (const item of items) {
              const r = deductStmt.run(item.quantity, item.variantId, item.quantity);
              if (r.changes !== 1) {
                throw new DomainError(
                  `Stock épuisé lors de la re-validation du paiement pour ${item.sku}`,
                  409,
                  'INSUFFICIENT_STOCK'
                );
              }
            }
          }

          nextStatus = 'paid';
          this.db
            .prepare(
              `UPDATE orders
               SET status = 'paid', stock_deducted = 1, updated_at = datetime('now')
               WHERE id = ?`
            )
            .run(orderId);

          this.sendSimulatedEmail({
            orderId,
            recipientEmail: customerEmail,
            subject: `Maison Véra — Confirmation de paiement ${paymentMethod.toUpperCase()} & Reçu (${orderNumber})`,
            templateName: 'order_paid_receipt',
            bodyText: [
              `Bonjour ${customerName},`,
              ``,
              `Votre règlement de ${totalFcfa} FCFA (${(totalCents / 100).toFixed(2)} € TTC) via ${paymentMethod.toUpperCase()} pour la commande ${orderNumber} a été validé avec succès (Réf. : ${payload.data.paymentIntentId}).`,
              `Notre équipe logistique prépare l'expédition et vous contactera par téléphone / WhatsApp au ${customerPhone}.`,
              ``,
              `Merci pour votre confiance,`,
              `Maison Véra — Douala · Abidjan · Dakar · Paris`,
            ].join('\n'),
          });
        }
      } else if (
        payload.type === 'payment_intent.payment_failed' ||
        payload.type === 'order.cancelled'
      ) {
        const targetStatus: OrderStatus =
          payload.type === 'payment_intent.payment_failed' ? 'payment_failed' : 'cancelled';

        if (currentStatus !== 'cancelled' && currentStatus !== 'shipped') {
          nextStatus = targetStatus;

          if (stockDeducted) {
            const items = this.getOrderItems(orderId);
            const restoreStmt = this.db.prepare(
              `UPDATE product_variants SET stock = stock + ? WHERE id = ?`
            );
            for (const item of items) {
              restoreStmt.run(item.quantity, item.variantId);
            }

            if (couponCode) {
              this.db
                .prepare(
                  `UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE code = ?`
                )
                .run(couponCode);
            }
          }

          this.db
            .prepare(
              `UPDATE orders
               SET status = ?, stock_deducted = 0, updated_at = datetime('now')
               WHERE id = ?`
            )
            .run(targetStatus, orderId);

          this.sendSimulatedEmail({
            orderId,
            recipientEmail: customerEmail,
            subject: `Maison Véra — Information concernant votre commande ${orderNumber}`,
            templateName:
              targetStatus === 'payment_failed' ? 'order_payment_failed' : 'order_cancelled',
            bodyText: [
              `Bonjour ${customerName},`,
              ``,
              targetStatus === 'payment_failed'
                ? `La transaction de ${totalFcfa} FCFA (${(totalCents / 100).toFixed(2)} €) pour la commande ${orderNumber} n'a pas pu aboutir (${payload.data.failureReason || 'Délai USSD Mobile Money dépassé ou solde insuffisant'}).`
                : `Votre commande ${orderNumber} a été annulée.`,
              `Les pièces réservées ont été remises en stock automatiquement.`,
              ``,
              `Maison Véra — Service Clientèle Afrique`,
            ].join('\n'),
          });
        }
      }

      this.db
        .prepare(
          `INSERT INTO webhook_events (
             event_id, event_type, payment_intent_id, order_id, signature_valid, status, payload_json
           ) VALUES (?, ?, ?, ?, 1, ?, ?)`
        )
        .run(
          payload.id,
          payload.type,
          payload.data.paymentIntentId,
          orderId,
          `processed:${nextStatus}`,
          params.rawBody
        );

      this.logAudit({
        actorUserId: null,
        actorEmail: 'webhook@payment-gateway.sandbox',
        action: `WEBHOOK_PROCESSED_${payload.type.toUpperCase()}`,
        targetType: 'order',
        targetId: orderNumber,
        details: {
          eventId: payload.id,
          previousStatus: currentStatus,
          nextStatus,
          paymentIntentId: payload.data.paymentIntentId,
        },
        ipAddress: params.ipAddress,
      });

      return {
        idempotentReplay: false,
        status: `processed:${nextStatus}`,
        orderId,
      };
    });

    const result = runWebhookTx();
    return {
      status: result.status,
      idempotentReplay: result.idempotentReplay,
      eventId: payload.id,
      order: result.orderId ? this.getOrderById(result.orderId) : undefined,
    };
  }

  // --- Order Queries, Public Tracking & Admin Order Management ---
  public getOrderItems(orderId: number): OrderItemDTO[] {
    const rows = this.db
      .prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC`)
      .all(orderId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: Number(r.id),
      productId: Number(r.product_id),
      variantId: Number(r.variant_id),
      sku: String(r.sku),
      productTitle: String(r.product_title),
      variantName: String(r.variant_name),
      unitPriceCents: Number(r.unit_price_cents),
      quantity: Number(r.quantity),
      lineTotalCents: Number(r.line_total_cents),
    }));
  }

  public getOrderById(orderId: number): OrderDTO {
    const row = this.db
      .prepare(`SELECT * FROM orders WHERE id = ?`)
      .get(orderId) as Record<string, unknown> | undefined;

    if (!row) {
      throw new DomainError(`Commande #${orderId} introuvable`, 404, 'ORDER_NOT_FOUND');
    }

    return this.mapOrderRow(row);
  }

  public trackOrderByNumber(orderNumber: string, contact?: string): OrderDTO {
    const normalizedNum = orderNumber.trim().toUpperCase();
    const row = this.db
      .prepare(`SELECT * FROM orders WHERE UPPER(order_number) = ?`)
      .get(normalizedNum) as Record<string, unknown> | undefined;

    if (!row) {
      throw new DomainError(
        `Aucune commande trouvée avec la référence "${normalizedNum}".`,
        404,
        'ORDER_NOT_FOUND'
      );
    }

    if (contact && contact.trim() !== '') {
      const cleanContact = contact.trim().toLowerCase();
      const emailMatch = String(row.customer_email).toLowerCase() === cleanContact;
      const phoneClean = String(row.customer_phone || '').replace(/\s+/g, '');
      const inputPhoneClean = cleanContact.replace(/\s+/g, '');
      const phoneMatch =
        inputPhoneClean.length >= 6 && phoneClean.includes(inputPhoneClean);

      if (!emailMatch && !phoneMatch) {
        throw new DomainError(
          `L'email ou le numéro de téléphone ne correspond pas à la commande ${normalizedNum}.`,
          403,
          'ORDER_CONTACT_MISMATCH'
        );
      }
    }

    return this.mapOrderRow(row);
  }

  public listOrdersForUser(user: UserProfile): OrderDTO[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM orders
         WHERE user_id = ? OR LOWER(customer_email) = LOWER(?)
         ORDER BY id DESC`
      )
      .all(user.id, user.email) as Array<Record<string, unknown>>;

    return rows.map((r) => this.mapOrderRow(r));
  }

  public listAllOrders(): OrderDTO[] {
    const rows = this.db
      .prepare(`SELECT * FROM orders ORDER BY id DESC LIMIT 100`)
      .all() as Array<Record<string, unknown>>;

    return rows.map((r) => this.mapOrderRow(r));
  }

  public updateOrderStatusAsAdmin(
    orderId: number,
    newStatus: OrderStatus,
    adminUser: UserProfile,
    ipAddress = '127.0.0.1'
  ): OrderDTO {
    const tx = this.db.transaction(() => {
      const row = this.db
        .prepare(`SELECT * FROM orders WHERE id = ?`)
        .get(orderId) as Record<string, unknown> | undefined;

      if (!row) {
        throw new DomainError(`Commande #${orderId} introuvable`, 404, 'ORDER_NOT_FOUND');
      }

      const currentStatus = String(row.status) as OrderStatus;
      const stockDeducted = Number(row.stock_deducted) === 1;
      const orderNumber = String(row.order_number);
      const customerEmail = String(row.customer_email);
      const customerName = String(row.customer_name);
      const customerPhone = String(row.customer_phone || '');

      if (currentStatus === newStatus) {
        return;
      }

      if (
        (newStatus === 'cancelled' || newStatus === 'payment_failed') &&
        stockDeducted
      ) {
        const items = this.getOrderItems(orderId);
        const restoreStmt = this.db.prepare(
          `UPDATE product_variants SET stock = stock + ? WHERE id = ?`
        );
        for (const item of items) {
          restoreStmt.run(item.quantity, item.variantId);
        }
        this.db
          .prepare(
            `UPDATE orders SET status = ?, stock_deducted = 0, updated_at = datetime('now') WHERE id = ?`
          )
          .run(newStatus, orderId);
      } else if (
        newStatus !== 'cancelled' &&
        newStatus !== 'payment_failed' &&
        !stockDeducted
      ) {
        const items = this.getOrderItems(orderId);
        const deductStmt = this.db.prepare(
          `UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?`
        );
        for (const item of items) {
          const r = deductStmt.run(item.quantity, item.variantId, item.quantity);
          if (r.changes !== 1) {
            throw new DomainError(
              `Stock insuffisant pour réactiver la commande sur ${item.sku}`,
              409,
              'INSUFFICIENT_STOCK'
            );
          }
        }
        this.db
          .prepare(
            `UPDATE orders SET status = ?, stock_deducted = 1, updated_at = datetime('now') WHERE id = ?`
          )
          .run(newStatus, orderId);
      } else {
        this.db
          .prepare(
            `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`
          )
          .run(newStatus, orderId);
      }

      if (newStatus === 'shipped') {
        this.sendSimulatedEmail({
          orderId,
          recipientEmail: customerEmail,
          subject: `Maison Véra — Votre commande ${orderNumber} est en cours de livraison`,
          templateName: 'order_shipped',
          bodyText: [
            `Bonjour ${customerName},`,
            ``,
            `Vos pièces de la commande ${orderNumber} ont quitté notre showroom et sont en route. Notre coursier vous appellera au ${customerPhone} à son arrivée au point de repère indiqué.`,
            ``,
            `Maison Véra — Douala · Abidjan · Dakar`,
          ].join('\n'),
        });
      }

      this.logAudit({
        actorUserId: adminUser.id,
        actorEmail: adminUser.email,
        action: 'ADMIN_ORDER_STATUS_UPDATED',
        targetType: 'order',
        targetId: orderNumber,
        details: { previousStatus: currentStatus, newStatus },
        ipAddress,
      });
    });

    tx();
    return this.getOrderById(orderId);
  }

  private mapOrderRow(row: Record<string, unknown>): OrderDTO {
    const orderId = Number(row.id);
    return {
      id: orderId,
      orderNumber: String(row.order_number),
      userId: row.user_id !== null ? Number(row.user_id) : null,
      customerEmail: String(row.customer_email),
      customerName: String(row.customer_name),
      customerPhone: String(row.customer_phone || '+237 699 00 11 22'),
      shippingAddress: String(row.shipping_address),
      shippingCity: String(row.shipping_city),
      shippingPostalCode: String(row.shipping_postal_code || 'BP 000'),
      shippingCountry: String(row.shipping_country),
      landmark: String(row.landmark || ''),
      deliveryMode: (row.delivery_mode as DeliveryModeType) || 'home_express',
      paymentMethod: (row.payment_method as PaymentMethodType) || 'mtn_momo',
      paymentPhone: String(row.payment_phone || row.customer_phone || ''),
      subtotalCents: Number(row.subtotal_cents),
      discountCents: Number(row.discount_cents),
      shippingCents: Number(row.shipping_cents),
      taxCents: Number(row.tax_cents),
      totalCents: Number(row.total_cents),
      couponCode: row.coupon_code ? String(row.coupon_code) : null,
      status: String(row.status) as OrderStatus,
      paymentIntentId: String(row.payment_intent_id),
      idempotencyKey: String(row.idempotency_key),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      items: this.getOrderItems(orderId),
    };
  }

  // --- Accounts & Sessions ---
  public registerUser(
    rawInput: z.infer<typeof RegisterSchema>,
    ipAddress = '127.0.0.1'
  ): { user: UserProfile; token: string } {
    const input = RegisterSchema.parse(rawInput);
    const normalizedEmail = input.email.toLowerCase();

    const existing = this.db
      .prepare(`SELECT id FROM users WHERE LOWER(email) = ?`)
      .get(normalizedEmail);

    if (existing) {
      throw new DomainError(
        'Un compte existe déjà avec cette adresse email.',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    const passwordHash = hashPassword(input.password);
    const res = this.db
      .prepare(
        `INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'customer')`
      )
      .run(normalizedEmail, input.name, passwordHash);

    const userId = Number(res.lastInsertRowid);
    const user = this.getUserById(userId)!;
    const token = this.createSession(userId);

    this.logAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: String(user.id),
      details: { role: user.role },
      ipAddress,
    });

    this.sendSimulatedEmail({
      orderId: null,
      recipientEmail: user.email,
      subject: 'Bienvenue chez Maison Véra — Votre compte client est actif',
      templateName: 'welcome_account',
      bodyText: `Bonjour ${user.name},\n\nVotre compte personnel Maison Véra est désormais actif. Utilisez le code AFRIQUE10 (-10%) ou MOMO15 (-15% via Mobile Money) sur votre prochaine commande.\n\nMaison Véra — Douala · Abidjan · Dakar · Paris`,
    });

    return { user, token };
  }

  public loginUser(
    rawInput: z.infer<typeof LoginSchema>,
    ipAddress = '127.0.0.1'
  ): { user: UserProfile; token: string } {
    const input = LoginSchema.parse(rawInput);
    const normalizedEmail = input.email.toLowerCase();

    const row = this.db
      .prepare(`SELECT * FROM users WHERE LOWER(email) = ?`)
      .get(normalizedEmail) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(input.password, String(row.password_hash))) {
      throw new DomainError(
        'Identifiants incorrects. Vérifiez votre email et mot de passe.',
        401,
        'INVALID_CREDENTIALS'
      );
    }

    const user: UserProfile = {
      id: Number(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as UserProfile['role'],
      createdAt: String(row.created_at),
    };

    const token = this.createSession(user.id);

    this.logAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      action: 'USER_LOGIN',
      targetType: 'user',
      targetId: String(user.id),
      details: { role: user.role },
      ipAddress,
    });

    return { user, token };
  }

  public createSession(userId: number): string {
    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    this.db
      .prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`)
      .run(tokenHash, userId, expiresAt);
    return rawToken;
  }

  public getUserBySessionToken(rawToken: string | undefined): UserProfile | null {
    if (!rawToken) return null;
    const tokenHash = hashSessionToken(rawToken);
    const row = this.db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.created_at, s.expires_at
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash) as Record<string, unknown> | undefined;

    if (!row) return null;
    if (new Date(String(row.expires_at)).getTime() < Date.now()) {
      this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
      return null;
    }

    return {
      id: Number(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as UserProfile['role'],
      createdAt: String(row.created_at),
    };
  }

  public logoutSession(rawToken: string | undefined): void {
    if (!rawToken) return;
    const tokenHash = hashSessionToken(rawToken);
    this.db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
  }

  public getUserById(userId: number): UserProfile | null {
    const row = this.db
      .prepare(`SELECT id, email, name, role, created_at FROM users WHERE id = ?`)
      .get(userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: Number(row.id),
      email: String(row.email),
      name: String(row.name),
      role: row.role as UserProfile['role'],
      createdAt: String(row.created_at),
    };
  }

  // --- Admin Operations ---
  public updateVariantStockAndPrice(
    variantId: number,
    rawInput: z.infer<typeof AdminStockUpdateSchema>,
    adminUser: UserProfile,
    ipAddress = '127.0.0.1'
  ): ProductVariant {
    const input = AdminStockUpdateSchema.parse(rawInput);
    const existing = this.db
      .prepare(`SELECT * FROM product_variants WHERE id = ?`)
      .get(variantId) as Record<string, unknown> | undefined;

    if (!existing) {
      throw new DomainError(`Variante #${variantId} introuvable`, 404, 'VARIANT_NOT_FOUND');
    }

    const nextPriceCents =
      input.priceCents !== undefined ? input.priceCents : Number(existing.price_cents);

    this.db
      .prepare(`UPDATE product_variants SET stock = ?, price_cents = ? WHERE id = ?`)
      .run(input.stock, nextPriceCents, variantId);

    this.logAudit({
      actorUserId: adminUser.id,
      actorEmail: adminUser.email,
      action: 'ADMIN_VARIANT_UPDATED',
      targetType: 'product_variant',
      targetId: String(existing.sku),
      details: {
        variantId,
        previousStock: Number(existing.stock),
        newStock: input.stock,
        previousPriceCents: Number(existing.price_cents),
        newPriceCents: nextPriceCents,
      },
      ipAddress,
    });

    return {
      id: variantId,
      productId: Number(existing.product_id),
      sku: String(existing.sku),
      name: String(existing.name),
      finish: String(existing.finish),
      priceCents: nextPriceCents,
      stock: input.stock,
    };
  }

  public listCoupons(): CouponDTO[] {
    const rows = this.db
      .prepare(`SELECT * FROM coupons ORDER BY id DESC`)
      .all() as Array<Record<string, unknown>>;

    return rows.map((c) => ({
      id: Number(c.id),
      code: String(c.code),
      description: String(c.description),
      discountType: c.discount_type as 'percentage' | 'fixed_cents',
      discountValue: Number(c.discount_value),
      minSubtotalCents: Number(c.min_subtotal_cents),
      maxUses: c.max_uses !== null ? Number(c.max_uses) : null,
      usedCount: Number(c.used_count),
      active: Boolean(c.active),
      expiresAt: c.expires_at ? String(c.expires_at) : null,
    }));
  }

  public createCoupon(
    rawInput: z.infer<typeof AdminCouponCreateSchema>,
    adminUser: UserProfile,
    ipAddress = '127.0.0.1'
  ): CouponDTO {
    const input = AdminCouponCreateSchema.parse(rawInput);
    if (input.discountType === 'percentage' && input.discountValue > 80) {
      throw new DomainError(
        'Une remise en pourcentage ne peut pas excéder 80%.',
        400,
        'INVALID_DISCOUNT_VALUE'
      );
    }

    const existing = this.db
      .prepare(`SELECT id FROM coupons WHERE UPPER(code) = ?`)
      .get(input.code);
    if (existing) {
      throw new DomainError(
        `Le code promo "${input.code}" existe déjà.`,
        409,
        'COUPON_ALREADY_EXISTS'
      );
    }

    const res = this.db
      .prepare(
        `INSERT INTO coupons (code, description, discount_type, discount_value, min_subtotal_cents, max_uses, used_count, active, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)`
      )
      .run(
        input.code,
        input.description,
        input.discountType,
        input.discountValue,
        input.minSubtotalCents,
        input.maxUses ?? null,
        input.expiresAt ?? null
      );

    this.logAudit({
      actorUserId: adminUser.id,
      actorEmail: adminUser.email,
      action: 'ADMIN_COUPON_CREATED',
      targetType: 'coupon',
      targetId: input.code,
      details: input,
      ipAddress,
    });

    const createdId = Number(res.lastInsertRowid);
    return this.listCoupons().find((c) => c.id === createdId)!;
  }

  public toggleCouponActive(
    couponId: number,
    active: boolean,
    adminUser: UserProfile,
    ipAddress = '127.0.0.1'
  ): void {
    const existing = this.db
      .prepare(`SELECT code FROM coupons WHERE id = ?`)
      .get(couponId) as { code: string } | undefined;
    if (!existing) {
      throw new DomainError(`Coupon #${couponId} introuvable`, 404, 'COUPON_NOT_FOUND');
    }

    this.db
      .prepare(`UPDATE coupons SET active = ? WHERE id = ?`)
      .run(active ? 1 : 0, couponId);

    this.logAudit({
      actorUserId: adminUser.id,
      actorEmail: adminUser.email,
      action: active ? 'ADMIN_COUPON_ENABLED' : 'ADMIN_COUPON_DISABLED',
      targetType: 'coupon',
      targetId: existing.code,
      details: { couponId, active },
      ipAddress,
    });
  }

  public listWebhookEvents(): WebhookEventDTO[] {
    const rows = this.db
      .prepare(`SELECT * FROM webhook_events ORDER BY id DESC LIMIT 100`)
      .all() as Array<Record<string, unknown>>;

    return rows.map((w) => ({
      id: Number(w.id),
      eventId: String(w.event_id),
      eventType: String(w.event_type),
      paymentIntentId: String(w.payment_intent_id),
      orderId: w.order_id !== null ? Number(w.order_id) : null,
      signatureValid: Boolean(w.signature_valid),
      status: String(w.status),
      payloadJson: String(w.payload_json),
      processedAt: String(w.processed_at),
    }));
  }

  public listSimulatedEmails(recipientEmail?: string): SimulatedEmailDTO[] {
    const rows = recipientEmail
      ? (this.db
          .prepare(
            `SELECT * FROM simulated_emails WHERE LOWER(recipient_email) = LOWER(?) ORDER BY id DESC LIMIT 50`
          )
          .all(recipientEmail) as Array<Record<string, unknown>>)
      : (this.db
          .prepare(`SELECT * FROM simulated_emails ORDER BY id DESC LIMIT 100`)
          .all() as Array<Record<string, unknown>>);

    return rows.map((e) => ({
      id: Number(e.id),
      orderId: e.order_id !== null ? Number(e.order_id) : null,
      recipientEmail: String(e.recipient_email),
      subject: String(e.subject),
      templateName: String(e.template_name),
      bodyText: String(e.body_text),
      sentAt: String(e.sent_at),
    }));
  }

  public listAuditLogs(): AuditLogDTO[] {
    const rows = this.db
      .prepare(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100`)
      .all() as Array<Record<string, unknown>>;

    return rows.map((a) => ({
      id: Number(a.id),
      actorUserId: a.actor_user_id !== null ? Number(a.actor_user_id) : null,
      actorEmail: String(a.actor_email),
      action: String(a.action),
      targetType: String(a.target_type),
      targetId: String(a.target_id),
      detailsJson: String(a.details_json),
      ipAddress: String(a.ip_address),
      createdAt: String(a.created_at),
    }));
  }
}
