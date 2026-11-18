import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './security.ts';
import { buildCityRoutePlan, interpolateAlongRoute } from './geo.ts';

export type DBInstance = Database.Database;

export function createDatabase(dbPath?: string): DBInstance {
  const resolvedPath =
    dbPath ?? process.env.SQLITE_DB_PATH ?? './data/ecommerce.sqlite';

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  runMigrations(db);
  seedDatabaseIfEmpty(db);

  return db;
}

export function runMigrations(db: DBInstance): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'admin')) DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Luminaires', 'Mobilier', 'Acoustique', 'Objets')),
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      craftsmanship TEXT NOT NULL,
      dimensions TEXT NOT NULL,
      image_url TEXT NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      finish TEXT NOT NULL,
      price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
      stock INTEGER NOT NULL CHECK(stock >= 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed_cents')),
      discount_value INTEGER NOT NULL CHECK(discount_value > 0),
      min_subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK(min_subtotal_cents >= 0),
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),
      active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      customer_email TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL DEFAULT '+237 699 00 11 22',
      shipping_address TEXT NOT NULL,
      shipping_city TEXT NOT NULL,
      shipping_postal_code TEXT NOT NULL DEFAULT '00000',
      shipping_country TEXT NOT NULL DEFAULT 'Cameroun',
      landmark TEXT NOT NULL DEFAULT '',
      delivery_mode TEXT NOT NULL DEFAULT 'home_express',
      payment_method TEXT NOT NULL DEFAULT 'mtn_momo',
      payment_phone TEXT NOT NULL DEFAULT '',
      subtotal_cents INTEGER NOT NULL CHECK(subtotal_cents >= 0),
      discount_cents INTEGER NOT NULL CHECK(discount_cents >= 0),
      shipping_cents INTEGER NOT NULL CHECK(shipping_cents >= 0),
      tax_cents INTEGER NOT NULL CHECK(tax_cents >= 0),
      total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
      coupon_code TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending_payment', 'paid', 'preparing', 'shipped', 'cancelled', 'payment_failed')),
      payment_intent_id TEXT NOT NULL UNIQUE,
      idempotency_key TEXT NOT NULL UNIQUE,
      stock_deducted INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      variant_id INTEGER NOT NULL REFERENCES product_variants(id),
      sku TEXT NOT NULL,
      product_title TEXT NOT NULL,
      variant_name TEXT NOT NULL,
      unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents >= 0),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      line_total_cents INTEGER NOT NULL CHECK(line_total_cents >= 0)
    );

    CREATE TABLE IF NOT EXISTS webhook_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      payment_intent_id TEXT NOT NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      signature_valid INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      processed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS simulated_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      template_name TEXT NOT NULL,
      body_text TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details_json TEXT NOT NULL,
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courier_tracking (
      order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      courier_name TEXT NOT NULL,
      courier_phone TEXT NOT NULL,
      vehicle_label TEXT NOT NULL,
      vehicle_plate TEXT NOT NULL,
      hub_name TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      destination_lat REAL NOT NULL,
      destination_lng REAL NOT NULL,
      current_lat REAL NOT NULL,
      current_lng REAL NOT NULL,
      heading_deg REAL NOT NULL DEFAULT 0,
      speed_kmh INTEGER NOT NULL DEFAULT 0,
      progress_pct INTEGER NOT NULL DEFAULT 0,
      eta_minutes INTEGER NOT NULL DEFAULT 30,
      distance_remaining_km REAL NOT NULL DEFAULT 5.0,
      total_distance_km REAL NOT NULL DEFAULT 5.0,
      status TEXT NOT NULL CHECK(status IN ('awaiting_dispatch', 'en_route', 'arriving_soon', 'delivered')) DEFAULT 'awaiting_dispatch',
      last_checkpoint TEXT NOT NULL,
      waypoints_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS concierge_appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL UNIQUE,
      showroom_city TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      project_note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'completed', 'rescheduled')) DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK(reason IN ('sale', 'restock', 'cancel_restore', 'admin_adjust')),
      reference_id TEXT NOT NULL DEFAULT '',
      occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Secondary Indexes for High-Performance Relational Lookups
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id ON webhook_events(order_id);
    CREATE INDEX IF NOT EXISTS idx_simulated_emails_recipient ON simulated_emails(recipient_email);
    CREATE INDEX IF NOT EXISTS idx_simulated_emails_order_id ON simulated_emails(order_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_courier_tracking_status ON courier_tracking(status);
    CREATE INDEX IF NOT EXISTS idx_appointments_city ON concierge_appointments(showroom_city);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON concierge_appointments(status);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_date ON stock_movements(variant_id, occurred_at);
  `);

  // Safe incremental schema upgrade for existing SQLite files
  const orderColumns = db
    .prepare(`PRAGMA table_info(orders)`)
    .all() as Array<{ name: string }>;
  const colNames = new Set(orderColumns.map((c) => c.name));

  const alterColumns: Array<[string, string]> = [
    ['customer_phone', "TEXT NOT NULL DEFAULT '+237 699 00 11 22'"],
    ['landmark', "TEXT NOT NULL DEFAULT ''"],
    ['delivery_mode', "TEXT NOT NULL DEFAULT 'home_express'"],
    ['payment_method', "TEXT NOT NULL DEFAULT 'mtn_momo'"],
    ['payment_phone', "TEXT NOT NULL DEFAULT ''"],
  ];

  for (const [col, def] of alterColumns) {
    if (!colNames.has(col)) {
      db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${def}`);
    }
  }
}

export function seedDatabaseIfEmpty(db: DBInstance): void {
  const existingCount = db
    .prepare('SELECT COUNT(*) as count FROM products')
    .get() as { count: number };

  if (existingCount.count === 0) {
    const seedTransaction = db.transaction(() => {
      // 1. Synthetic Accounts (Admin & Customer)
      const insertUser = db.prepare(`
        INSERT INTO users (email, name, password_hash, role)
        VALUES (?, ?, ?, ?)
      `);

      insertUser.run(
        'admin@maison-vera.test',
        'Éléonore Véra (Direction Douala & Abidjan)',
        hashPassword('AdminVera2026!'),
        'admin'
      );
      insertUser.run(
        'claire.moreau@example.test',
        'Claire Ndongo-Moreau',
        hashPassword('ClientVera2026!'),
        'customer'
      );

      // 2. Curated Pan-African Architectural Catalog & Variants
      const insertProduct = db.prepare(`
        INSERT INTO products (slug, title, category, subtitle, description, craftsmanship, dimensions, image_url, featured, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      const insertVariant = db.prepare(`
        INSERT INTO product_variants (product_id, sku, name, finish, price_cents, stock)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Product 1: Lampe Solis
      const p1 = insertProduct.run(
        'lampe-monolithe-solis',
        'Lampe Monolithe Solis',
        'Luminaires',
        'Albâtre Minéral & Bronze Coulé de Foumban',
        'Taillée dans un bloc massif d’albâtre veiné et coiffée d’un cylindre en bronze coulé selon la tradition des fondeurs de Foumban (Cameroun), la lampe Solis diffuse une lumière chaude apaisante adaptée aux intérieurs contemporains de Douala, Abidjan et Dakar.',
        'Façonnée en série numérotée. Protection intégrée contre les variations de tension électrique (110V–250V) et variateur rotatif continu.',
        'H 42 cm × Ø 26 cm · Poids 6,4 kg · Câble lin tressé tropicalisé 2,2 m',
        '/src/assets/images/product_lamp_alabaster_1794937870518.jpg',
        1
      );
      const p1Id = Number(p1.lastInsertRowid);
      insertVariant.run(p1Id, 'MV-SOL-BRZ-S', 'Édition Standard — Bronze de Foumban', 'Bronze patiné & Albâtre blanc', 68000, 8);
      insertVariant.run(p1Id, 'MV-SOL-LAI-M', 'Édition Architecte — Laiton du Bénin', 'Laiton massif brossé & Albâtre ambré', 79000, 4);
      insertVariant.run(p1Id, 'MV-SOL-ACI-L', 'Grande Échelle — Acier Noirci', 'Acier canon de fusil & Albâtre veiné', 92000, 2);

      // Product 2: Fauteuil Arceau
      const p2 = insertProduct.run(
        'fauteuil-bas-arceau',
        'Fauteuil Bas Arceau N°04',
        'Mobilier',
        'Iroko & Chêne Fumé · Tissage Coton de Kokoh',
        'Conçu autour d’une structure porteuse en bois massif cintré et traité pour les climats tropicaux et côtiers, le Fauteuil Arceau N°04 offre une assise basse d’un confort exceptionnel habillée de textile bouclé respirant non teint.',
        'Assemblage traditionnel par tenons et mortaises sans visserie apparente. Finition oléo-cire résistante à l’humidité côtière.',
        'L 74 cm × P 82 cm × H 69 cm (Assise H 38 cm) · Poids 18,5 kg',
        '/src/assets/images/product_chair_oak_1794937873233.jpg',
        1
      );
      const p2Id = Number(p2.lastInsertRowid);
      insertVariant.run(p2Id, 'MV-ARC-OAK-ECR', 'Bois Fumé & Bouclé Écru', 'Essence tourbe & Coton bouclé naturel', 145000, 5);
      insertVariant.run(p2Id, 'MV-ARC-OAK-LIN', 'Iroko Blond & Lin Lourd Craie', 'Iroko naturel & Lin respirant', 138000, 7);
      insertVariant.run(p2Id, 'MV-ARC-WAL-COG', 'Ébène & Cuir Sellerie', 'Bois sombre huilé & Cuir végétal Cognac', 189000, 2);

      // Product 3: Enceinte Acoustique Aeon
      const p3 = insertProduct.run(
        'monolithe-acoustique-aeon',
        'Monolithe Acoustique Aeon I',
        'Acoustique',
        'Grès Céramique de Katiola & Aluminium Usiné',
        'Enceinte haute-fidélité active logée dans un caisson en grès chamotté haute densité éliminant toute résonance parasite. Grille frontale micro-perforée en aluminium anodisé champagne et connectivité sans fil Bluetooth aptX HD / AirPlay 2.',
        'Amplification Classe D audiophile 2×90W, alimentation stabilisée multi-voltage avec batterie tampon de secours intégrée (autonomie 8h en cas de coupure secteur).',
        'H 31 cm × L 21 cm × P 18 cm · Poids 7,8 kg',
        '/src/assets/images/product_speaker_ceramic_1794937872684.jpg',
        1
      );
      const p3Id = Number(p3.lastInsertRowid);
      insertVariant.run(p3Id, 'MV-AEO-BAS-CHP', 'Grès Basalte & Grille Champagne', 'Céramique anthracite & Aluminium champagne', 89000, 10);
      insertVariant.run(p3Id, 'MV-AEO-CRA-ARG', 'Grès Craie & Grille Argent Mat', 'Céramique kaolin & Aluminium brossé', 89000, 6);
      insertVariant.run(p3Id, 'MV-AEO-DUO-PRO', 'Paire Stéréo Appairée — Basalte', '2× Monolithes calibrés en studio', 169000, 3);

      // Product 4: Ensemble Monolithe Travertin
      const p4 = insertProduct.run(
        'ensemble-bureau-travertin-forum',
        'Ensemble Monolithe Forum',
        'Objets',
        'Pierre de Travertin Brut & Acier Plié Noirci',
        'Un duo architectural de bureau composé d’un vase cylindrique tourné dans la pierre naturelle à pores ouverts et d’un plateau de réception en acier laminé à chaud protégé par une cire microcristalline.',
        'Chaque pièce minérale est unique. Patins en liège naturel haute densité sous chaque élément.',
        'Vase : H 24 cm × Ø 12 cm · Plateau : 28 × 19 × 2,5 cm · Poids total 4,2 kg',
        '/src/assets/images/product_vessel_travertine_1794937873259.jpg',
        1
      );
      const p4Id = Number(p4.lastInsertRowid);
      insertVariant.run(p4Id, 'MV-FOR-SET-ROM', 'Duo Complet — Pierre & Acier', 'Travertin clair & Acier noirci', 24000, 15);
      insertVariant.run(p4Id, 'MV-FOR-VAS-ROM', 'Vase Monolithe Seul', 'Pierre naturelle brute', 15500, 12);
      insertVariant.run(p4Id, 'MV-FOR-PLT-ACI', 'Plateau d’Architecte Seul', 'Acier noirci cire mate', 11000, 18);
    });

    seedTransaction();
  }

  // Ensure all standard + African promotional coupons exist
  const insertCouponIfNotExists = db.prepare(`
    INSERT OR IGNORE INTO coupons (code, description, discount_type, discount_value, min_subtotal_cents, max_uses, used_count, active, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `);

  insertCouponIfNotExists.run(
    'BIENVENUE10',
    'Remise de bienvenue de 10% sur toute la collection',
    'percentage',
    10,
    10000,
    500,
    1,
    '2028-12-31T23:59:59Z'
  );
  insertCouponIfNotExists.run(
    'DAKAR25',
    'Privilège Inauguration Galeries Dakar, Abidjan & Douala (-25% dès 600 €)',
    'percentage',
    25,
    60000,
    250,
    1,
    '2028-12-31T23:59:59Z'
  );
  insertCouponIfNotExists.run(
    'VIP100',
    'Invitation Cercle Privé Maison Véra (-100 € / ~65 600 FCFA dès 1 000 €)',
    'fixed_cents',
    10000,
    100000,
    150,
    1,
    '2028-12-31T23:59:59Z'
  );
  insertCouponIfNotExists.run(
    'AFRIQUE10',
    'Offre Spéciale Showrooms Douala, Abidjan & Dakar (-10%)',
    'percentage',
    10,
    10000,
    500,
    1,
    '2028-12-31T23:59:59Z'
  );
  insertCouponIfNotExists.run(
    'MOMO15',
    'Privilège Mobile Money Orange / MTN / Wave -15% (dès 200 € / ~131 000 FCFA)',
    'percentage',
    15,
    20000,
    300,
    1,
    '2028-12-31T23:59:59Z'
  );
  insertCouponIfNotExists.run(
    'ARCHITECTE15',
    'Remise prescription cabinet d’architecture 15% (dès 800 € / ~525 000 FCFA)',
    'percentage',
    15,
    80000,
    100,
    1,
    '2028-12-31T23:59:59Z'
  );
  insertCouponIfNotExists.run(
    'ATELIER50',
    'Bon d’achat de 32 800 FCFA (50,00 €) dès 196 800 FCFA (300,00 €)',
    'fixed_cents',
    5000,
    30000,
    200,
    1,
    '2028-12-31T23:59:59Z'
  );
  insertCouponIfNotExists.run(
    'ARCHIVE2024',
    'Code promotionnel expiré (pour tests de validation)',
    'percentage',
    20,
    0,
    50,
    1,
    '2024-01-01T00:00:00Z'
  );

  // Seed one active shipped demonstration order for the member account (without altering initial catalog stock)
  const existingOrdersCount = db
    .prepare('SELECT COUNT(*) as count FROM orders')
    .get() as { count: number };

  if (existingOrdersCount.count === 0) {
    const claireRow = db
      .prepare(`SELECT id, email, name FROM users WHERE LOWER(email) = 'claire.moreau@example.test'`)
      .get() as { id: number; email: string; name: string } | undefined;

    const firstVariant = db
      .prepare(
        `SELECT v.id as variant_id, v.product_id, v.sku, v.name as variant_name, v.price_cents, p.title as product_title
         FROM product_variants v
         INNER JOIN products p ON p.id = v.product_id
         WHERE v.sku = 'MV-SOL-BRZ-S'`
      )
      .get() as
      | {
          variant_id: number;
          product_id: number;
          sku: string;
          variant_name: string;
          price_cents: number;
          product_title: string;
        }
      | undefined;

    if (claireRow && firstVariant) {
      const demoOrderRes = db
        .prepare(
          `INSERT INTO orders (
             order_number, user_id, customer_email, customer_name, customer_phone,
             shipping_address, shipping_city, shipping_postal_code, shipping_country,
             landmark, delivery_mode, payment_method, payment_phone,
             subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
             coupon_code, status, payment_intent_id, idempotency_key, stock_deducted
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'shipped', ?, ?, 1)`
        )
        .run(
          'MV-2026-DLA01',
          claireRow.id,
          claireRow.email,
          claireRow.name,
          '+237 699 45 12 88',
          'Quartier Bonapriso, Rue Njo-Njo',
          'Douala',
          'BP 4022',
          'Cameroun',
          'En face de la Pharmacie du Littoral, 2e portail gris',
          'home_express',
          'mtn_momo',
          '+237 699 45 12 88',
          firstVariant.price_cents,
          0,
          0,
          Math.round(firstVariant.price_cents - firstVariant.price_cents / 1.2),
          firstVariant.price_cents,
          null,
          'pi_mtn_momo_seed_dla01',
          'idem_seed_order_dla01'
        );

      const seededOrderId = Number(demoOrderRes.lastInsertRowid);

      db.prepare(
        `INSERT INTO order_items (
           order_id, product_id, variant_id, sku, product_title, variant_name,
           unit_price_cents, quantity, line_total_cents
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
      ).run(
        seededOrderId,
        firstVariant.product_id,
        firstVariant.variant_id,
        firstVariant.sku,
        firstVariant.product_title,
        firstVariant.variant_name,
        firstVariant.price_cents,
        firstVariant.price_cents
      );

      const plan = buildCityRoutePlan({
        shippingCity: 'Douala',
        shippingCountry: 'Cameroun',
        shippingAddress: 'Quartier Bonapriso, Rue Njo-Njo',
        landmark: 'En face de la Pharmacie du Littoral, 2e portail gris',
        seedOffset: seededOrderId,
      });
      const initialPos = interpolateAlongRoute(plan.waypoints, 42);

      db.prepare(
        `INSERT INTO courier_tracking (
           order_id, courier_name, courier_phone, vehicle_label, vehicle_plate, hub_name,
           origin_lat, origin_lng, destination_lat, destination_lng,
           current_lat, current_lng, heading_deg, speed_kmh, progress_pct,
           eta_minutes, distance_remaining_km, total_distance_km, status, last_checkpoint, waypoints_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_route', ?, ?)`
      ).run(
        seededOrderId,
        plan.courierName,
        plan.courierPhone,
        plan.vehicleLabel,
        plan.vehiclePlate,
        plan.hubName,
        plan.originLat,
        plan.originLng,
        plan.destinationLat,
        plan.destinationLng,
        initialPos.lat,
        initialPos.lng,
        initialPos.headingDeg,
        initialPos.speedKmh,
        42,
        initialPos.etaMinutes,
        initialPos.distanceRemainingKm,
        initialPos.totalDistanceKm,
        initialPos.lastCheckpoint,
        JSON.stringify(plan.waypoints)
      );

      db.prepare(
        `INSERT INTO simulated_emails (order_id, recipient_email, subject, template_name, body_text)
         VALUES (?, ?, ?, 'order_shipped', ?)`
      ).run(
        seededOrderId,
        claireRow.email,
        'Maison Véra — Coursier en route pour votre commande MV-2026-DLA01',
        `Bonjour ${claireRow.name},\n\nNotre coursier ${plan.courierName} (${plan.vehicleLabel}) a quitté la ${plan.hubName} avec votre Lampe Monolithe Solis.\nSuivez son trajet GPS en direct depuis votre espace membre.`
      );
    }
  }

  const existingAppointmentsCount = db
    .prepare('SELECT COUNT(*) as count FROM concierge_appointments')
    .get() as { count: number };

  if (existingAppointmentsCount.count === 0) {
    db.prepare(
      `INSERT INTO concierge_appointments (
         reference_code, showroom_city, customer_name, customer_phone, customer_email,
         preferred_date, project_note, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`
    ).run(
      'RDV-2026-DLA01',
      'Douala',
      'Claire Ndongo-Moreau',
      '+237 699 45 12 88',
      'claire.moreau@example.test',
      '2026-11-22',
      'Écoute privée du Monolithe Acoustique Aeon I et présentation des finitions bronze de Foumban.'
    );
  }

  const existingMovementsCount = db
    .prepare('SELECT COUNT(*) as count FROM stock_movements')
    .get() as { count: number };

  if (existingMovementsCount.count === 0) {
    const seedMovementsTx = db.transaction(() => {
      const variants = db
        .prepare(
          `SELECT v.id, v.sku, v.product_id, v.name, v.price_cents, p.title
           FROM product_variants v
           INNER JOIN products p ON p.id = v.product_id
           ORDER BY v.id ASC`
        )
        .all() as Array<{
          id: number;
          sku: string;
          product_id: number;
          name: string;
          price_cents: number;
          title: string;
        }>;

      const skuMap = new Map(variants.map((v) => [v.sku, v]));

      // Realistic 30-day showroom sales & workshop restocks (separate clients so Claire's account & current stock remain untouched)
      const historicalEvents: Array<{
        daysAgo: number;
        sku: string;
        qty: number;
        city: string;
        country: string;
        buyer: string;
        email: string;
        phone: string;
        method: string;
        ref: string;
        restockBeforeDaysAgo?: number;
        restockQty?: number;
      }> = [
        {
          daysAgo: 27,
          sku: 'MV-SOL-BRZ-S',
          qty: 2,
          city: 'Abidjan',
          country: 'Côte d’Ivoire',
          buyer: 'Aminata Koné',
          email: 'aminata.kone@example.test',
          phone: '+225 07 08 44 91 20',
          method: 'orange_money',
          ref: 'MV-HIST-01',
          restockBeforeDaysAgo: 28,
          restockQty: 6,
        },
        {
          daysAgo: 24,
          sku: 'MV-ARC-OAK-ECR',
          qty: 2,
          city: 'Dakar',
          country: 'Sénégal',
          buyer: 'Moussa Diallo',
          email: 'moussa.diallo@example.test',
          phone: '+221 77 640 18 92',
          method: 'wave',
          ref: 'MV-HIST-02',
          restockBeforeDaysAgo: 26,
          restockQty: 4,
        },
        {
          daysAgo: 21,
          sku: 'MV-AEO-BAS-CHP',
          qty: 3,
          city: 'Douala',
          country: 'Cameroun',
          buyer: 'Jean-Paul Mbarga',
          email: 'jean.mbarga@example.test',
          phone: '+237 677 81 30 90',
          method: 'mtn_momo',
          ref: 'MV-HIST-03',
          restockBeforeDaysAgo: 25,
          restockQty: 8,
        },
        {
          daysAgo: 18,
          sku: 'MV-SOL-LAI-M',
          qty: 2,
          city: 'Paris',
          country: 'France',
          buyer: 'Atelier Delacroix',
          email: 'delacroix.arch@example.test',
          phone: '+33 6 42 18 90 12',
          method: 'card',
          ref: 'MV-HIST-04',
        },
        {
          daysAgo: 15,
          sku: 'MV-FOR-SET-ROM',
          qty: 4,
          city: 'Abidjan',
          country: 'Côte d’Ivoire',
          buyer: 'Hôtel Ivoire Design',
          email: 'achats.ivoire@example.test',
          phone: '+225 05 44 12 88 00',
          method: 'orange_money',
          ref: 'MV-HIST-05',
          restockBeforeDaysAgo: 19,
          restockQty: 10,
        },
        {
          daysAgo: 12,
          sku: 'MV-SOL-BRZ-S',
          qty: 2,
          city: 'Yaoundé',
          country: 'Cameroun',
          buyer: 'Hélène Atangana',
          email: 'helene.atangana@example.test',
          phone: '+237 699 18 22 44',
          method: 'mtn_momo',
          ref: 'MV-HIST-06',
        },
        {
          daysAgo: 10,
          sku: 'MV-ARC-WAL-COG',
          qty: 2,
          city: 'Dakar',
          country: 'Sénégal',
          buyer: 'Fatou Sarr',
          email: 'fatou.sarr@example.test',
          phone: '+221 77 512 44 09',
          method: 'wave',
          ref: 'MV-HIST-07',
          restockBeforeDaysAgo: 14,
          restockQty: 4,
        },
        {
          daysAgo: 8,
          sku: 'MV-AEO-DUO-PRO',
          qty: 2,
          city: 'Libreville',
          country: 'Gabon',
          buyer: 'Marc Ondo',
          email: 'marc.ondo@example.test',
          phone: '+241 77 32 10 45',
          method: 'mtn_momo',
          ref: 'MV-HIST-08',
        },
        {
          daysAgo: 5,
          sku: 'MV-SOL-BRZ-S',
          qty: 3,
          city: 'Douala',
          country: 'Cameroun',
          buyer: 'Studio Kora Architecture',
          email: 'studio.kora@example.test',
          phone: '+237 691 74 00 32',
          method: 'mtn_momo',
          ref: 'MV-HIST-09',
        },
        {
          daysAgo: 3,
          sku: 'MV-FOR-VAS-ROM',
          qty: 3,
          city: 'Abidjan',
          country: 'Côte d’Ivoire',
          buyer: 'Résidence Les Palmiers',
          email: 'res.palmiers@example.test',
          phone: '+225 07 09 11 45 66',
          method: 'orange_money',
          ref: 'MV-HIST-10',
        },
        {
          daysAgo: 2,
          sku: 'MV-ARC-OAK-ECR',
          qty: 2,
          city: 'Dakar',
          country: 'Sénégal',
          buyer: 'Cheikh Ndiaye',
          email: 'cheikh.ndiaye@example.test',
          phone: '+221 78 302 15 44',
          method: 'wave',
          ref: 'MV-HIST-11',
        },
        {
          daysAgo: 1,
          sku: 'MV-AEO-CRA-ARG',
          qty: 2,
          city: 'Douala',
          country: 'Cameroun',
          buyer: 'Nadine Fotso',
          email: 'nadine.fotso@example.test',
          phone: '+237 694 31 09 80',
          method: 'orange_money',
          ref: 'MV-HIST-12',
        },
      ];

      const insertHistOrder = db.prepare(`
        INSERT OR IGNORE INTO orders (
          order_number, user_id, customer_email, customer_name, customer_phone,
          shipping_address, shipping_city, shipping_postal_code, shipping_country,
          landmark, delivery_mode, payment_method, payment_phone,
          subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
          coupon_code, status, payment_intent_id, idempotency_key, stock_deducted, created_at, updated_at
        ) VALUES (?, NULL, ?, ?, ?, 'Quartier Résidentiel', ?, 'BP 100', ?, 'Galerie Locale', 'home_express', ?, ?, ?, 0, 0, ?, ?, NULL, 'paid', ?, ?, 1, datetime('now', ?), datetime('now', ?))
      `);

      const insertHistItem = db.prepare(`
        INSERT INTO order_items (
          order_id, product_id, variant_id, sku, product_title, variant_name,
          unit_price_cents, quantity, line_total_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMovement = db.prepare(`
        INSERT INTO stock_movements (variant_id, delta, reason, reference_id, occurred_at)
        VALUES (?, ?, ?, ?, datetime('now', ?))
      `);

      for (const ev of historicalEvents) {
        const variant = skuMap.get(ev.sku);
        if (!variant) continue;

        if (ev.restockBeforeDaysAgo && ev.restockQty) {
          insertMovement.run(
            variant.id,
            ev.restockQty,
            'restock',
            `ATELIER-${ev.ref}`,
            `-${ev.restockBeforeDaysAgo} days`
          );
        }

        const lineTotal = variant.price_cents * ev.qty;
        const tax = Math.round(lineTotal - lineTotal / 1.2);
        const dayOffset = `-${ev.daysAgo} days`;

        const orderRes = insertHistOrder.run(
          ev.ref,
          ev.email,
          ev.buyer,
          ev.phone,
          ev.city,
          ev.country,
          ev.method,
          ev.phone,
          lineTotal,
          tax,
          lineTotal,
          `pi_hist_${ev.ref.toLowerCase()}`,
          `idem_hist_${ev.ref.toLowerCase()}`,
          dayOffset,
          dayOffset
        );

        const insertedId = Number(orderRes.lastInsertRowid);
        if (insertedId > 0) {
          insertHistItem.run(
            insertedId,
            variant.product_id,
            variant.id,
            variant.sku,
            variant.title,
            variant.name,
            variant.price_cents,
            ev.qty,
            lineTotal
          );
          insertMovement.run(variant.id, -ev.qty, 'sale', ev.ref, dayOffset);
        }
      }

      // Include Claire's shipped order MV-2026-DLA01 in today's stock movement ledger if present
      const dla01 = db
        .prepare(`SELECT id FROM orders WHERE order_number = 'MV-2026-DLA01'`)
        .get() as { id: number } | undefined;
      const solBrz = skuMap.get('MV-SOL-BRZ-S');
      if (dla01 && solBrz) {
        insertMovement.run(solBrz.id, -1, 'sale', 'MV-2026-DLA01', '-4 days');
      }
    });

    seedMovementsTx();
  }
}
