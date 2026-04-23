PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS movements;
DROP TABLE IF EXISTS variants;
DROP TABLE IF EXISTS stock_cards;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  product_name TEXT NOT NULL,
  location_code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
  ,
  FOREIGN KEY(location_code) REFERENCES locations(code)
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  stock_card_id INTEGER NOT NULL,
  barcode TEXT NOT NULL UNIQUE,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(stock_card_id) REFERENCES stock_cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS movements (
  id TEXT PRIMARY KEY,
  stock_card_id INTEGER NOT NULL,
  variant_id TEXT,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand TEXT NOT NULL,
  barcode TEXT,
  size TEXT,
  quantity INTEGER,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(stock_card_id) REFERENCES stock_cards(id),
  FOREIGN KEY(variant_id) REFERENCES variants(id)
);

CREATE INDEX IF NOT EXISTS idx_variants_stock_card ON variants(stock_card_id);
CREATE INDEX IF NOT EXISTS idx_stock_cards_location ON stock_cards(location_code);
CREATE INDEX IF NOT EXISTS idx_movements_variant ON movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at);
