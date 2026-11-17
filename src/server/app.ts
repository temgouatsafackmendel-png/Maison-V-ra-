import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import { ZodError, z } from 'zod';
import type { DBInstance } from './db.ts';
import {
  AdminCouponCreateSchema,
  AdminStockUpdateSchema,
  CartQuoteRequestSchema,
  CheckoutRequestSchema,
  DomainError,
  EcommerceService,
  LoginSchema,
  RegisterSchema,
} from './domain.ts';
import { signWebhookPayload } from './security.ts';
import type { OrderStatus, UserProfile } from '../shared/types.ts';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile | null;
  rawBody?: string;
  requestId?: string;
}

export function createApiApp(db: DBInstance) {
  const app = express();
  const service = new EcommerceService(db);

  app.disable('x-powered-by');

  // International HTTP Security Headers & Request Correlation ID
  app.use((req: AuthenticatedRequest, res, next) => {
    const incomingReqId = req.headers['x-request-id'];
    const requestId =
      typeof incomingReqId === 'string' && incomingReqId.trim().length > 0
        ? incomingReqId.trim().slice(0, 64)
        : `req_${crypto.randomBytes(8).toString('hex')}`;

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    next();
  });

  // Memory-safe in-memory rate limiter for auth & checkout mutations
  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const rateLimit = (maxRequests: number, windowMs: number) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const now = Date.now();
      // Periodic cleanup of expired buckets to prevent memory growth
      if (rateBuckets.size > 1000) {
        for (const [k, v] of rateBuckets.entries()) {
          if (now > v.resetAt) rateBuckets.delete(k);
        }
      }

      const ip = req.ip || '127.0.0.1';
      const key = `${ip}:${req.baseUrl}${req.path}`;
      const bucket = rateBuckets.get(key);
      if (!bucket || now > bucket.resetAt) {
        rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }
      if (bucket.count >= maxRequests) {
        const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({
          error: 'Trop de requêtes. Veuillez patienter quelques instants.',
          code: 'RATE_LIMIT_EXCEEDED',
          requestId: req.requestId,
        });
      }
      bucket.count += 1;
      next();
    };
  };

  // Capture raw body for webhook HMAC verification while parsing JSON
  app.use(
    express.json({
      limit: '100kb',
      verify: (req: AuthenticatedRequest, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );

  // Attach authenticated user if Bearer token is present
  app.use((req: AuthenticatedRequest, _res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      req.user = service.getUserBySessionToken(token);
    } else {
      req.user = null;
    }
    next();
  });

  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentification requise pour accéder à cette ressource.',
        code: 'UNAUTHORIZED',
        requestId: req.requestId,
      });
    }
    next();
  };

  const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentification requise.',
        code: 'UNAUTHORIZED',
        requestId: req.requestId,
      });
    }
    if (req.user.role !== 'admin') {
      service.logAudit({
        actorUserId: req.user.id,
        actorEmail: req.user.email,
        action: 'FORBIDDEN_ADMIN_ACCESS_ATTEMPT',
        targetType: 'endpoint',
        targetId: req.originalUrl,
        details: { method: req.method, requestId: req.requestId },
        ipAddress: req.ip,
      });
      return res.status(403).json({
        error: 'Accès refusé : privilèges administrateur requis.',
        code: 'FORBIDDEN',
        requestId: req.requestId,
      });
    }
    next();
  };

  // --- Health & Readiness Probe (Cloud Run / Kubernetes / Docker) ---
  app.get('/api/health', (_req, res, next) => {
    try {
      const health = service.checkDatabaseHealth();
      res.status(200).json({
        status: 'ok',
        service: 'maison-vera-ecommerce',
        version: '1.0.0',
        database: health.ok ? 'connected' : 'degraded',
        activeProducts: health.activeProducts,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  // --- Public Catalog Endpoints ---
  app.get('/api/catalog', (_req, res, next) => {
    try {
      const products = service.listProducts(false);
      res.json({ products });
    } catch (err) {
      next(err);
    }
  });

  // --- Server-Side Cart Pricing & Coupon Validation ---
  app.post('/api/cart/quote', (req, res, next) => {
    try {
      const parsed = CartQuoteRequestSchema.parse(req.body);
      const quote = service.calculateCartPricing(
        parsed.items,
        parsed.couponCode,
        parsed.deliveryMode || 'home_express'
      );
      res.json({ quote });
    } catch (err) {
      next(err);
    }
  });

  // --- Transactional Checkout (Server Price Recalculation + Stock Reservation) ---
  app.post(
    '/api/checkout',
    rateLimit(30, 60_000),
    (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = CheckoutRequestSchema.parse(req.body);
        const result = service.createCheckoutOrder(parsed, req.user || null, req.ip);
        res.status(result.idempotentReplay ? 200 : 201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Signed & Idempotent Payment Webhook Receiver ---
  app.post('/api/webhooks/payment', (req: AuthenticatedRequest, res, next) => {
    try {
      const rawBody = req.rawBody ?? JSON.stringify(req.body ?? {});
      const signatureHeader = req.headers['x-webhook-signature'] as string | undefined;
      const result = service.processPaymentWebhook({
        rawBody,
        signatureHeader,
        ipAddress: req.ip,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // --- Sandbox Payment Gateway Simulator (dispatches signed or tampered webhook) ---
  const SandboxSimulateSchema = z.object({
    paymentIntentId: z.string().trim().min(4),
    eventType: z.enum([
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'order.cancelled',
    ]),
    eventId: z.string().trim().optional(),
    tamperSignature: z.boolean().optional().default(false),
    failureReason: z.string().trim().optional(),
  });

  app.post('/api/payments/sandbox-simulate', (req: AuthenticatedRequest, res, next) => {
    try {
      const input = SandboxSimulateSchema.parse(req.body);
      const eventId =
        input.eventId || `evt_sandbox_${crypto.randomBytes(8).toString('hex')}`;

      const webhookPayload = {
        id: eventId,
        type: input.eventType,
        data: {
          paymentIntentId: input.paymentIntentId,
          failureReason: input.failureReason,
        },
      };

      const rawBody = JSON.stringify(webhookPayload);
      const signatureHeader = input.tamperSignature
        ? `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`
        : signWebhookPayload(rawBody);

      const result = service.processPaymentWebhook({
        rawBody,
        signatureHeader,
        ipAddress: req.ip,
      });

      res.status(200).json({
        ...result,
        simulatedSignature: signatureHeader,
      });
    } catch (err) {
      next(err);
    }
  });

  // --- Auth & Account Endpoints ---
  app.post('/api/auth/register', rateLimit(20, 60_000), (req, res, next) => {
    try {
      const parsed = RegisterSchema.parse(req.body);
      const result = service.registerUser(parsed, req.ip);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/login', rateLimit(25, 60_000), (req, res, next) => {
    try {
      const parsed = LoginSchema.parse(req.body);
      const result = service.loginUser(parsed, req.ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : undefined;
    service.logoutSession(token);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // --- Customer Orders, Direct Order Tracking & Simulated Emails ---
  app.get('/api/orders/track', (req, res, next) => {
    try {
      const orderNumber = String(req.query.orderNumber || '').trim();
      const contact = String(req.query.contact || '').trim();
      if (!orderNumber) {
        throw new DomainError('Numéro de commande requis (ex: MV-2026-...)', 400);
      }
      const order = service.trackOrderByNumber(orderNumber, contact || undefined);
      const emails = service
        .listSimulatedEmails(order.customerEmail)
        .filter((e) => e.orderId === order.id);
      res.json({ order, emails });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/orders/my', requireAuth, (req: AuthenticatedRequest, res, next) => {
    try {
      const orders = service.listOrdersForUser(req.user!);
      const emails = service.listSimulatedEmails(req.user!.email);
      res.json({ orders, emails });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/orders/:id', (req: AuthenticatedRequest, res, next) => {
    try {
      const orderId = Number(req.params.id);
      if (!Number.isInteger(orderId) || orderId <= 0) {
        throw new DomainError('Identifiant de commande invalide', 400);
      }
      const order = service.getOrderById(orderId);
      // Allow access if admin, owner of order, or matching paymentIntentId query param (post-checkout guest receipt)
      const paymentIntentQuery = String(req.query.paymentIntentId || '');
      const isOwner =
        req.user &&
        (req.user.role === 'admin' ||
          req.user.id === order.userId ||
          req.user.email.toLowerCase() === order.customerEmail.toLowerCase());
      const hasValidPaymentIntentToken =
        paymentIntentQuery && paymentIntentQuery === order.paymentIntentId;

      if (!isOwner && !hasValidPaymentIntentToken) {
        return res.status(403).json({
          error: 'Accès non autorisé à cette commande.',
          code: 'FORBIDDEN',
          requestId: req.requestId,
        });
      }

      const emails = service
        .listSimulatedEmails(order.customerEmail)
        .filter((e) => e.orderId === order.id);

      res.json({ order, emails });
    } catch (err) {
      next(err);
    }
  });

  // --- Admin Endpoints (Protected by RBAC requireAdmin) ---
  app.get('/api/admin/overview', requireAdmin, (_req, res, next) => {
    try {
      const products = service.listProducts(true);
      const orders = service.listAllOrders();
      const coupons = service.listCoupons();
      const webhooks = service.listWebhookEvents();
      const emails = service.listSimulatedEmails();
      const auditLogs = service.listAuditLogs();

      res.json({
        products,
        orders,
        coupons,
        webhooks,
        emails,
        auditLogs,
      });
    } catch (err) {
      next(err);
    }
  });

  app.patch(
    '/api/admin/variants/:id',
    requireAdmin,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const variantId = Number(req.params.id);
        const parsed = AdminStockUpdateSchema.parse(req.body);
        const variant = service.updateVariantStockAndPrice(
          variantId,
          parsed,
          req.user!,
          req.ip
        );
        res.json({ variant });
      } catch (err) {
        next(err);
      }
    }
  );

  app.patch(
    '/api/admin/orders/:id/status',
    requireAdmin,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const orderId = Number(req.params.id);
        const StatusSchema = z.object({
          status: z.enum([
            'pending_payment',
            'paid',
            'preparing',
            'shipped',
            'cancelled',
            'payment_failed',
          ]),
        });
        const { status } = StatusSchema.parse(req.body);
        const order = service.updateOrderStatusAsAdmin(
          orderId,
          status as OrderStatus,
          req.user!,
          req.ip
        );
        res.json({ order });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/admin/coupons',
    requireAdmin,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const parsed = AdminCouponCreateSchema.parse(req.body);
        const coupon = service.createCoupon(parsed, req.user!, req.ip);
        res.status(201).json({ coupon });
      } catch (err) {
        next(err);
      }
    }
  );

  app.patch(
    '/api/admin/coupons/:id',
    requireAdmin,
    (req: AuthenticatedRequest, res, next) => {
      try {
        const couponId = Number(req.params.id);
        const { active } = z.object({ active: z.boolean() }).parse(req.body);
        service.toggleCouponActive(couponId, active, req.user!, req.ip);
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  // Unknown API Route Handler (Prevent falling through to HTML SPA for /api/*)
  app.use('/api/*', (req: AuthenticatedRequest, res: Response) => {
    res.status(404).json({
      error: `Point de terminaison API introuvable : ${req.method} ${req.originalUrl}`,
      code: 'ENDPOINT_NOT_FOUND',
      requestId: req.requestId,
    });
  });

  // Centralized API Error Handler
  app.use((err: unknown, req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
    if (err instanceof DomainError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
        requestId: req.requestId,
      });
    }
    if (err instanceof ZodError) {
      const firstIssue = err.issues[0];
      return res.status(400).json({
        error: firstIssue
          ? `${firstIssue.path.join('.') ? `${firstIssue.path.join('.')}: ` : ''}${firstIssue.message}`
          : 'Données de requête invalides',
        code: 'VALIDATION_ERROR',
        issues: err.issues,
        requestId: req.requestId,
      });
    }
    console.error('Unhandled API Error:', err);
    return res.status(500).json({
      error: 'Une erreur interne est survenue sur le serveur.',
      code: 'INTERNAL_SERVER_ERROR',
      requestId: req.requestId,
    });
  });

  return { app, service };
}
