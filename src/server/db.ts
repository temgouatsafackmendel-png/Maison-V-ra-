import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './security.ts';

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
}
