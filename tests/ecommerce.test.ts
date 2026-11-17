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

  describe('1. Sécurité Cryptographique (Mots de passe & Signatures HMAC Webhook)', () => {
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

  describe('2. Critère d’Acceptation #1 : Recalcul Serveur des Prix, Coupons & Frais de Port', () => {
    it('ignore tout prix falsifié envoyé par le client et recalcule le total TTC depuis la base SQLite', async () => {
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

  describe('3. Critères d’Acceptation #2 & #3 : Checkout Mobile Money Afrique, Stocks Cohérents, Suivi & Webhooks Signés/Idempotents', () => {
    it('réserve le stock au checkout avec adresse Afrique (Quartier/Repère/Mobile Money), génère le push SMS/WhatsApp et valide le suivi et webhook idempotent', async () => {
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
      // 2 * 68000 = 136000 - 15% (20400) = 115600
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
      // Vérifie que l'email ET le push SMS/WhatsApp USSD (*126#) ont bien été générés
      expect(trackRes.body.emails.length).toBeGreaterThanOrEqual(2);
      expect(
        trackRes.body.emails.some((e: { bodyText: string }) => e.bodyText.includes('*126#'))
      ).toBe(true);

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

  describe('4. Comptes, Permissions RBAC, Emails Simulés & Administration', () => {
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
});
