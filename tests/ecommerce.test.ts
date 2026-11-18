import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createDatabase, type DBInstance } from '../src/server/db.ts';
import { createApiApp } from '../src/server/app.ts';
import {
  hashPassword,
  verifyPassword,
  signWebhookPayload,
  verifyWebhookSignature,
} from '../src/server/security.ts';

describe('Maison Véra Afrique E-Commerce — Tests Unitaires, Intégration & Parcours Critiques', () => {
  let db: DBInstance;
  let app: ReturnType<typeof createApiApp>['app'];

  beforeEach(() => {
    db = createDatabase(':memory:');
    const created = createApiApp(db);
    app = created.app;
  });

  describe('1. Observabilité, En-têtes de Sécurité Internationaux & Sondes de Santé', () => {
    it('expose GET /api/health, propage X-Request-Id et applique les en-têtes de sécurité OWASP', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', 'req_custom_trace_001');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe('req_custom_trace_001');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBe('1.4.0');
      expect(res.body.database).toBe('connected');
      expect(res.body.activeProducts).toBeGreaterThanOrEqual(4);
    });

    it('retourne une erreur JSON structurée 404 ENDPOINT_NOT_FOUND sur une route /api/* inconnue', async () => {
      const res = await request(app).get('/api/route-inexistante');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ENDPOINT_NOT_FOUND');
      expect(res.body.requestId).toBeDefined();
    });
  });

  describe('2. Sécurité Cryptographique (Mots de passe & Signatures HMAC Webhook)', () => {
    it('hache et vérifie correctement un mot de passe avec PBKDF2-SHA512', () => {
      const hash = hashPassword('MonMotDePasseSecurise2026!');
      expect(hash).toContain(':');
      expect(verifyPassword('MonMotDePasseSecurise2026!', hash)).toBe(true);
      expect(verifyPassword('MauvaisMotDePasse', hash)).toBe(false);
    });

    it('valide une signature HMAC-SHA256 authentique et rejette toute falsification ou rejeu expiré', () => {
      const body = JSON.stringify({
        id: 'evt_test_1',
        type: 'payment_intent.succeeded',
        data: { paymentIntentId: 'pi_123' },
      });
      const now = 1790000000;
      const validHeader = signWebhookPayload(body, now, 'test_secret');

      // Signature valide dans la fenêtre de tolérance
      const okResult = verifyWebhookSignature(body, validHeader, 'test_secret', 300, now + 45);
      expect(okResult.valid).toBe(true);

      // Corps modifié (attaque MITM sur le montant ou le statut)
      const tamperedBody = JSON.stringify({
        id: 'evt_test_1',
        type: 'payment_intent.succeeded',
        data: { paymentIntentId: 'pi_other' },
      });
      const badBodyResult = verifyWebhookSignature(
        tamperedBody,
        validHeader,
        'test_secret',
        300,
        now + 45
      );
      expect(badBodyResult.valid).toBe(false);

      // Horodatage expiré (attaque par rejeu hors fenêtre de 300s)
      const expiredResult = verifyWebhookSignature(
        body,
        validHeader,
        'test_secret',
        300,
        now + 900
      );
      expect(expiredResult.valid).toBe(false);
      expect(expiredResult.reason).toContain('tolérance');
    });
  });

  describe('3. Critère d’Acceptation #1 : Recalcul Serveur des Prix, Coupons Afrique & Frais de Port', () => {
    it('ignore tout prix falsifié envoyé par le client et recalcule le total TTC depuis la base SQLite (BIENVENUE10, DAKAR25, VIP100)', async () => {
      // Variante #1 = MV-SOL-BRZ-S (680,00 € = 68000 centimes)
      // Variante #10 = MV-FOR-SET-ROM (240,00 € = 24000 centimes)
      const res = await request(app)
        .post('/api/cart/quote')
        .send({
          items: [
            { variantId: 1, quantity: 1, unitPriceCents: 1, priceCents: 1 },
            { variantId: 10, quantity: 2, unitPriceCents: 0 },
          ],
          couponCode: 'BIENVENUE10',
        });

      expect(res.status).toBe(200);
      const { quote } = res.body;
      expect(quote.subtotalCents).toBe(116000);
      expect(quote.discountCents).toBe(11600);
      expect(quote.shippingCents).toBe(0);
      expect(quote.totalCents).toBe(104400);
      expect(quote.appliedCoupon?.code).toBe('BIENVENUE10');

      // Vérification du code DAKAR25 (-25% dès 600 €)
      const resDakar = await request(app)
        .post('/api/cart/quote')
        .send({
          items: [{ variantId: 1, quantity: 1 }], // 680,00 €
          couponCode: 'DAKAR25',
        });
      expect(resDakar.status).toBe(200);
      expect(resDakar.body.quote.discountCents).toBe(17000); // 25% de 680 € = 170 €
      expect(resDakar.body.quote.totalCents).toBe(51000);

      // Vérification du code VIP100 (-100 € dès 1000 €)
      const resVip = await request(app)
        .post('/api/cart/quote')
        .send({
          items: [{ variantId: 4, quantity: 1 }], // Fauteuil Arceau 1 450,00 €
          couponCode: 'VIP100',
        });
      expect(resVip.status).toBe(200);
      expect(resVip.body.quote.discountCents).toBe(10000);
      expect(resVip.body.quote.totalCents).toBe(135000);
    });

    it('applique les frais de port (25,00 €) sous le seuil de 500,00 €, gère le retrait gratuit en showroom Afrique et rejette les coupons expirés', async () => {
      // Variante #12 = MV-FOR-PLT-ACI (110,00 € = 11000 centimes)
      const resUnderThreshold = await request(app)
        .post('/api/cart/quote')
        .send({
          items: [{ variantId: 12, quantity: 1 }],
          couponCode: 'ARCHITECTE15', // Requiert 800,00 € minimum
        });

      expect(resUnderThreshold.status).toBe(200);
      expect(resUnderThreshold.body.quote.subtotalCents).toBe(11000);
      expect(resUnderThreshold.body.quote.discountCents).toBe(0);
      expect(resUnderThreshold.body.quote.shippingCents).toBe(2500);
      expect(resUnderThreshold.body.quote.totalCents).toBe(13500);
      expect(resUnderThreshold.body.quote.couponError).toContain('800.00 €');

      // Retrait en Showroom Afrique (Douala / Abidjan / Dakar) -> Livraison 0 € même sous le seuil
      const resPickupShowroom = await request(app)
        .post('/api/cart/quote')
        .send({
          items: [{ variantId: 12, quantity: 1 }],
          deliveryMode: 'pickup_showroom',
        });
      expect(resPickupShowroom.status).toBe(200);
      expect(resPickupShowroom.body.quote.shippingCents).toBe(0);
      expect(resPickupShowroom.body.quote.totalCents).toBe(11000);

      // Test d'un coupon expiré (ARCHIVE2024)
      const resExpired = await request(app)
        .post('/api/cart/quote')
        .send({
          items: [{ variantId: 1, quantity: 1 }],
          couponCode: 'ARCHIVE2024',
        });

      expect(resExpired.status).toBe(200);
      expect(resExpired.body.quote.discountCents).toBe(0);
      expect(resExpired.body.quote.couponError).toContain('expiré');
    });
  });

  describe('4. Critères d’Acceptation #2 & #3 : Checkout Mobile Money Afrique, Stocks Cohérents, Suivi & Webhooks Signés/Idempotents', () => {
    it('réserve le stock au checkout avec adresse Afrique (Quartier/Repère/Mobile Money), protège le suivi et valide le webhook idempotent', async () => {
      const catBefore = await request(app).get('/api/catalog');
      const v1Before = catBefore.body.products[0].variants.find(
        (v: { id: number }) => v.id === 1
      );
      expect(v1Before.stock).toBe(8);

      // Commande à Douala (Bonapriso) avec MTN Mobile Money et code MOMO15 (-15%)
      const checkoutPayload = {
        items: [{ variantId: 1, quantity: 2 }],
        couponCode: 'MOMO15',
        customerName: 'Claire Ndongo',
        customerEmail: 'claire.moreau@example.test',
        customerPhone: '+237 699 45 12 88',
        shippingAddress: 'Quartier Bonapriso, Rue Njo-Njo',
        shippingCity: 'Douala',
        shippingPostalCode: 'BP 4022',
        shippingCountry: 'Cameroun',
        landmark: 'En face de la Pharmacie du Littoral, 2e portail gris',
        deliveryMode: 'home_express',
        paymentMethod: 'mtn_momo',
        paymentPhone: '+237 699 45 12 88',
        idempotencyKey: 'idem_checkout_afrique_001',
      };

      const chkRes = await request(app).post('/api/checkout').send(checkoutPayload);
      expect(chkRes.status).toBe(201);
      expect(chkRes.body.idempotentReplay).toBe(false);
      const order = chkRes.body.order;
      expect(order.subtotalCents).toBe(136000);
      expect(order.discountCents).toBe(20400);
      expect(order.totalCents).toBe(115600);
      expect(order.paymentMethod).toBe('mtn_momo');
      expect(order.landmark).toContain('Pharmacie du Littoral');
      expect(order.status).toBe('pending_payment');

      // Vérifier le suivi direct de commande par N° de commande + téléphone (/api/orders/track)
      const trackRes = await request(app)
        .get('/api/orders/track')
        .query({ orderNumber: order.orderNumber, contact: '+237 699 45 12 88' });
      expect(trackRes.status).toBe(200);
      expect(trackRes.body.order.orderNumber).toBe(order.orderNumber);
      expect(trackRes.body.emails.length).toBeGreaterThanOrEqual(2);
      expect(
        trackRes.body.emails.some((e: { bodyText: string }) => e.bodyText.includes('*126#'))
      ).toBe(true);

      // Vérifier le rejet 403 si un tiers tente de suivre la commande avec un mauvais téléphone/email
      const trackWrongContact = await request(app)
        .get('/api/orders/track')
        .query({ orderNumber: order.orderNumber, contact: 'intrus@example.test' });
      expect(trackWrongContact.status).toBe(403);
      expect(trackWrongContact.body.code).toBe('ORDER_CONTACT_MISMATCH');

      // Rejouer exactement le même checkout (même idempotencyKey) -> 200 OK sans redéduire le stock
      const chkReplay = await request(app).post('/api/checkout').send(checkoutPayload);
      expect(chkReplay.status).toBe(200);
      expect(chkReplay.body.idempotentReplay).toBe(true);
      expect(chkReplay.body.order.id).toBe(order.id);

      // Vérifier que le stock est passé de 8 à 6
      const catAfterCheckout = await request(app).get('/api/catalog');
      const v1AfterCheckout = catAfterCheckout.body.products[0].variants.find(
        (v: { id: number }) => v.id === 1
      );
      expect(v1AfterCheckout.stock).toBe(6);

      // Envoyer un webhook avec une signature HMAC invalide -> Rejet 401
      const webhookBody = JSON.stringify({
        id: 'evt_unique_payment_001',
        type: 'payment_intent.succeeded',
        data: { paymentIntentId: order.paymentIntentId },
      });

      const forgedRes = await request(app)
        .post('/api/webhooks/payment')
        .set('Content-Type', 'application/json')
        .set('X-Webhook-Signature', 't=1790000000,v1=deadbeef0000')
        .send(webhookBody);

      expect(forgedRes.status).toBe(401);
      expect(forgedRes.body.code).toBe('INVALID_WEBHOOK_SIGNATURE');

      // Envoyer le webhook authentiquement signé -> 200 OK et passage à 'paid'
      const validSignature = signWebhookPayload(webhookBody);
      const validWebhookRes = await request(app)
        .post('/api/webhooks/payment')
        .set('Content-Type', 'application/json')
        .set('X-Webhook-Signature', validSignature)
        .send(webhookBody);

      expect(validWebhookRes.status).toBe(200);
      expect(validWebhookRes.body.idempotentReplay).toBe(false);
      expect(validWebhookRes.body.order.status).toBe('paid');

      // Rejouer le MÊME webhook (même event_id = 'evt_unique_payment_001') -> Idempotent
      const replayWebhookRes = await request(app)
        .post('/api/webhooks/payment')
        .set('Content-Type', 'application/json')
        .set('X-Webhook-Signature', validSignature)
        .send(webhookBody);

      expect(replayWebhookRes.status).toBe(200);
      expect(replayWebhookRes.body.idempotentReplay).toBe(true);
    });

    it('refuse une commande dépassant le stock disponible (409) et restitue automatiquement le stock en cas d’échec de paiement Mobile Money', async () => {
      const overStockRes = await request(app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: 3, quantity: 5 }],
          customerName: 'Test Stock',
          customerEmail: 'stock@example.test',
          shippingAddress: 'Cocody Riviera 3',
          shippingCity: 'Abidjan',
          shippingCountry: 'Côte d’Ivoire',
          idempotencyKey: 'idem_overstock_001',
        });

      expect(overStockRes.status).toBe(409);
      expect(overStockRes.body.code).toBe('INSUFFICIENT_STOCK');

      // Commander les 2 unités disponibles -> stock tombe à 0
      const validOrderRes = await request(app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: 3, quantity: 2 }],
          customerName: 'Test Stock',
          customerEmail: 'stock@example.test',
          shippingAddress: 'Cocody Riviera 3',
          shippingCity: 'Abidjan',
          shippingCountry: 'Côte d’Ivoire',
          paymentMethod: 'orange_money',
          idempotencyKey: 'idem_valid_stock_002',
        });

      expect(validOrderRes.status).toBe(201);
      const order = validOrderRes.body.order;

      const catZero = await request(app).get('/api/catalog');
      const v3Zero = catZero.body.products[0].variants.find(
        (v: { id: number }) => v.id === 3
      );
      expect(v3Zero.stock).toBe(0);

      // Simuler un webhook d'échec de paiement Orange Money -> Le stock doit remonter à 2 !
      const failWebhookBody = JSON.stringify({
        id: 'evt_fail_restore_stock_001',
        type: 'payment_intent.payment_failed',
        data: {
          paymentIntentId: order.paymentIntentId,
          failureReason: 'Délai USSD #150# dépassé',
        },
      });
      const sig = signWebhookPayload(failWebhookBody);

      const failRes = await request(app)
        .post('/api/webhooks/payment')
        .set('Content-Type', 'application/json')
        .set('X-Webhook-Signature', sig)
        .send(failWebhookBody);

      expect(failRes.status).toBe(200);
      expect(failRes.body.order.status).toBe('payment_failed');

      const catRestored = await request(app).get('/api/catalog');
      const v3Restored = catRestored.body.products[0].variants.find(
        (v: { id: number }) => v.id === 3
      );
      expect(v3Restored.stock).toBe(2);
    });
  });

  describe('5. Comptes, Permissions RBAC, Emails Simulés & Administration', () => {
    it('bloque l’accès aux routes /api/admin/* pour un client standard (403) et autorise l’administrateur', async () => {
      const customerLogin = await request(app).post('/api/auth/login').send({
        email: 'claire.moreau@example.test',
        password: 'ClientVera2026!',
      });
      expect(customerLogin.status).toBe(200);
      const customerToken = customerLogin.body.token;

      const forbiddenRes = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(forbiddenRes.status).toBe(403);

      const adminLogin = await request(app).post('/api/auth/login').send({
        email: 'admin@maison-vera.test',
        password: 'AdminVera2026!',
      });
      expect(adminLogin.status).toBe(200);
      const adminToken = adminLogin.body.token;

      const patchVariant = await request(app)
        .patch('/api/admin/variants/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stock: 25, priceCents: 72000 });
      expect(patchVariant.status).toBe(200);
      expect(patchVariant.body.variant.stock).toBe(25);
      expect(patchVariant.body.variant.priceCents).toBe(72000);

      const overviewRes = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(overviewRes.status).toBe(200);
      expect(
        overviewRes.body.auditLogs.some(
          (l: { action: string }) => l.action === 'FORBIDDEN_ADMIN_ACCESS_ATTEMPT'
        )
      ).toBe(true);
    });
  });

  describe('6. Suivi GPS en Temps Réel du Coursier & Télémétrie Livraison', () => {
    it('fournit le trajet GPS de la commande membre, protège l’accès et met à jour la position en temps réel', async () => {
      const customerLogin = await request(app).post('/api/auth/login').send({
        email: 'claire.moreau@example.test',
        password: 'ClientVera2026!',
      });
      expect(customerLogin.status).toBe(200);
      const customerToken = customerLogin.body.token;

      // Récupérer les commandes du compte membre (inclut MV-2026-DLA01 en cours de livraison)
      const myOrdersRes = await request(app)
        .get('/api/orders/my')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(myOrdersRes.status).toBe(200);
      expect(myOrdersRes.body.orders.length).toBeGreaterThanOrEqual(1);

      const shippedOrder = myOrdersRes.body.orders[0];
      expect(shippedOrder.tracking).toBeDefined();
      expect(shippedOrder.tracking.waypoints.length).toBeGreaterThanOrEqual(4);

      // Accès anonyme sans token ni paymentIntentId -> Rejet 403
      const unauthTracking = await request(app).get(`/api/orders/${shippedOrder.id}/tracking`);
      expect(unauthTracking.status).toBe(403);

      // Accès membre propriétaire -> 200 OK avec coordonnées GPS et ETA
      const getTracking = await request(app)
        .get(`/api/orders/${shippedOrder.id}/tracking`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(getTracking.status).toBe(200);
      const initialProgress = getTracking.body.tracking.progressPct;
      const initialLat = getTracking.body.tracking.currentLat;

      // Pulsation télémétrique -> Le coursier avance sur l’itinéraire GPS et recalcule ETA/Lat/Lng
      const pulseRes = await request(app)
        .post(`/api/orders/${shippedOrder.id}/tracking/pulse`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ stepDelta: 20 });
      expect(pulseRes.status).toBe(200);
      expect(pulseRes.body.tracking.progressPct).toBeGreaterThan(initialProgress);
      expect(pulseRes.body.tracking.currentLat).not.toBe(initialLat);
      expect(pulseRes.body.tracking.etaMinutes).toBeLessThanOrEqual(
        getTracking.body.tracking.etaMinutes
      );

      // L’administrateur peut aussi piloter la position du coursier (ex: passer à 100% livré)
      const adminLogin = await request(app).post('/api/auth/login').send({
        email: 'admin@maison-vera.test',
        password: 'AdminVera2026!',
      });
      const adminToken = adminLogin.body.token;

      const adminPatch = await request(app)
        .patch(`/api/admin/orders/${shippedOrder.id}/tracking`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'delivered' });
      expect(adminPatch.status).toBe(200);
      expect(adminPatch.body.tracking.status).toBe('delivered');
      expect(adminPatch.body.tracking.progressPct).toBe(100);
      expect(adminPatch.body.tracking.distanceRemainingKm).toBe(0);
    });
  });

  describe('7. Conciergerie Galeries & Rendez-Vous Privés Persistants (v1.4.0)', () => {
    it('enregistre un rendez-vous privé en galerie, valide les entrées, protège l’accès admin et met à jour le statut', async () => {
      // Rejet 400 sur données invalides
      const badAptRes = await request(app)
        .post('/api/concierge/appointments')
        .send({
          showroomCity: 'Abidjan',
          customerName: 'A',
          customerPhone: '12',
          customerEmail: 'not-an-email',
          preferredDate: '',
        });
      expect(badAptRes.status).toBe(400);
      expect(badAptRes.body.code).toBe('VALIDATION_ERROR');

      // Création d'une demande valide à Abidjan
      const createRes = await request(app)
        .post('/api/concierge/appointments')
        .send({
          showroomCity: 'Abidjan',
          customerName: 'Kouadio Serge',
          customerPhone: '+225 07 08 44 91 20',
          customerEmail: 'serge.kouadio@example.test',
          preferredDate: '2026-12-05',
          projectNote: 'Écoute privée du Monolithe Acoustique Aeon I',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.appointment.referenceCode).toMatch(/^RDV-2026-ABI/);
      expect(createRes.body.appointment.status).toBe('pending');
      const appointmentId = createRes.body.appointment.id;

      // Protection RBAC : un client standard ne peut pas lister /api/admin/appointments
      const customerLogin = await request(app).post('/api/auth/login').send({
        email: 'claire.moreau@example.test',
        password: 'ClientVera2026!',
      });
      const forbiddenApt = await request(app)
        .get('/api/admin/appointments')
        .set('Authorization', `Bearer ${customerLogin.body.token}`);
      expect(forbiddenApt.status).toBe(403);

      // L'administrateur voit le rendez-vous dans /api/admin/overview et peut le confirmer
      const adminLogin = await request(app).post('/api/auth/login').send({
        email: 'admin@maison-vera.test',
        password: 'AdminVera2026!',
      });
      const adminToken = adminLogin.body.token;

      const overviewRes = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(overviewRes.status).toBe(200);
      expect(
        overviewRes.body.appointments.some(
          (a: { id: number; showroomCity: string }) =>
            a.id === appointmentId && a.showroomCity === 'Abidjan'
        )
      ).toBe(true);

      const confirmRes = await request(app)
        .patch(`/api/admin/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.appointment.status).toBe('confirmed');
    });
  });

  describe('8. Analytique Stocks 30 Jours & Prédictions de Réapprovisionnement', () => {
    it('calcule la vélocité 30j, l’historique quotidien et la projection +14j, protégés par RBAC admin', async () => {
      // Un client standard reçoit 403
      const customerLogin = await request(app).post('/api/auth/login').send({
        email: 'claire.moreau@example.test',
        password: 'ClientVera2026!',
      });
      const forbiddenAnalytics = await request(app)
        .get('/api/admin/inventory/analytics')
        .set('Authorization', `Bearer ${customerLogin.body.token}`);
      expect(forbiddenAnalytics.status).toBe(403);

      const adminLogin = await request(app).post('/api/auth/login').send({
        email: 'admin@maison-vera.test',
        password: 'AdminVera2026!',
      });
      const adminToken = adminLogin.body.token;

      const beforeRes = await request(app)
        .get('/api/admin/inventory/analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(beforeRes.status).toBe(200);
      const { analytics } = beforeRes.body;

      expect(analytics.windowDays).toBe(30);
      expect(analytics.forecastDays).toBe(14);
      expect(analytics.globalSeries.length).toBe(44); // 30 jours d'historique + 14 jours de prévision
      expect(analytics.totalSoldLast30d).toBeGreaterThan(0);

      const solBrzBefore = analytics.variants.find(
        (v: { sku: string }) => v.sku === 'MV-SOL-BRZ-S'
      );
      expect(solBrzBefore).toBeDefined();
      expect(solBrzBefore.currentStock).toBe(8);
      const soldBefore = solBrzBefore.soldLast30d;

      // Passer une commande de 3 unités sur MV-SOL-BRZ-S (variantId: 1) -> stock passe à 5 et ventes 30j augmentent de 3
      const orderRes = await request(app)
        .post('/api/checkout')
        .send({
          items: [{ variantId: 1, quantity: 3 }],
          customerName: 'Amadou Bâ',
          customerEmail: 'amadou.ba@example.test',
          shippingAddress: 'Les Almadies',
          shippingCity: 'Dakar',
          shippingCountry: 'Sénégal',
          idempotencyKey: 'idem_analytics_test_001',
        });
      expect(orderRes.status).toBe(201);

      const afterRes = await request(app)
        .get('/api/admin/inventory/analytics')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(afterRes.status).toBe(200);
      const solBrzAfter = afterRes.body.analytics.variants.find(
        (v: { sku: string }) => v.sku === 'MV-SOL-BRZ-S'
      );
      expect(solBrzAfter.currentStock).toBe(5);
      expect(solBrzAfter.soldLast30d).toBe(soldBefore + 3);
      expect(solBrzAfter.dailyVelocity).toBeGreaterThan(solBrzBefore.dailyVelocity);
    });
  });
});
