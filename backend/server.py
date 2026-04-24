#!/usr/bin/env python3
import json
import mimetypes
import sqlite3
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "database" / "inventory.db"

SCHEMA = """
PRAGMA foreign_keys = ON;

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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
"""


SEED_USERS = [
    ("ali", "1234", "Ali"),
    ("ayse", "1234", "Ayşe"),
    ("mehmet", "1234", "Mehmet"),
    ("zeynep", "1234", "Zeynep"),
    ("can", "1234", "Can"),
]

SEED_LOCATIONS = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "K9", "K10", "K11", "K12", "K13", "K14", "K15"]

SEED_CARDS = []


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as conn:
        conn.executescript(SCHEMA)

        conn.executemany(
            "INSERT OR IGNORE INTO users(username,password,full_name) VALUES (?,?,?)",
            SEED_USERS,
        )
        conn.executemany(
            "INSERT OR IGNORE INTO locations(code) VALUES (?)",
            [(code,) for code in SEED_LOCATIONS],
        )

        for card in SEED_CARDS:
            conn.execute(
                "INSERT OR IGNORE INTO stock_cards(sku,brand,product_name,location_code) VALUES (?,?,?,?)",
                (card["sku"], card["brand"], card["product_name"], card["location"]),
            )
            stock_card = conn.execute("SELECT id FROM stock_cards WHERE sku = ?", (card["sku"],)).fetchone()
            for v in card["variants"]:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO variants(id, stock_card_id, barcode, size, quantity)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (v["id"], stock_card["id"], v["barcode"], v["size"], v["quantity"]),
                )


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()


class Handler(BaseHTTPRequestHandler):
    def _json_response(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/stock-cards":
            with get_db() as conn:
                cards = conn.execute("SELECT id, sku, brand, product_name, location_code FROM stock_cards ORDER BY sku").fetchall()
                payload = []
                for c in cards:
                    variants = conn.execute(
                        "SELECT id, barcode, size, quantity FROM variants WHERE stock_card_id = ? ORDER BY size",
                        (c["id"],),
                    ).fetchall()
                    payload.append(
                        {
                            "id": c["id"],
                            "sku": c["sku"],
                            "brand": c["brand"],
                            "productName": c["product_name"],
                            "location": c["location_code"],
                            "variants": [
                                {
                                    "id": v["id"],
                                    "barcode": v["barcode"],
                                    "size": v["size"],
                                    "quantity": v["quantity"],
                                }
                                for v in variants
                            ],
                        }
                    )
            return self._json_response(200, payload)

        if path == "/api/movements":
            with get_db() as conn:
                movements = conn.execute(
                    """
                    SELECT id, stock_card_id, variant_id, sku, product_name, brand, barcode, size, quantity,
                           from_location, to_location, changed_by, note, created_at
                    FROM movements
                    ORDER BY datetime(created_at) DESC
                    LIMIT 500
                    """
                ).fetchall()
            return self._json_response(200, [dict(m) for m in movements])

        if path == "/api/locations":
            with get_db() as conn:
                locations = conn.execute("SELECT code FROM locations ORDER BY code").fetchall()
            return self._json_response(200, [row["code"] for row in locations])

        # API dışındaki isteklerde tek uygulama olarak frontend dosyalarını servis et.
        # Böylece Coolify'de ayrı frontend + proxy kurmaya gerek kalmaz.
        return self._serve_static(path)

    def _serve_static(self, path):
        safe_path = path.split("?", 1)[0]
        if safe_path in ("/", ""):
            file_path = ROOT / "index.html"
        else:
            file_path = (ROOT / safe_path.lstrip("/")).resolve()

        # Path traversal koruması
        if not str(file_path).startswith(str(ROOT.resolve())):
            return self._json_response(403, {"error": "Forbidden"})

        if not file_path.exists() or not file_path.is_file():
            return self._json_response(404, {"error": "Not found"})

        content = file_path.read_bytes()
        mime, _ = mimetypes.guess_type(str(file_path))
        content_type = mime or "application/octet-stream"

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/stock-cards":
            payload = self._read_json()
            sku = payload.get("sku")
            brand = payload.get("brand")
            product_name = payload.get("productName")
            if not sku or not brand or not product_name:
                return self._json_response(400, {"error": "sku, brand, productName zorunlu"})
            location = payload.get("location", "K1")

            with get_db() as conn:
                cur = conn.execute(
                    "INSERT INTO stock_cards(sku, brand, product_name, location_code) VALUES (?,?,?,?)",
                    (sku, brand, product_name, location),
                )
            return self._json_response(201, {"id": cur.lastrowid, "sku": sku, "brand": brand, "productName": product_name, "location": location})

        if path == "/api/variants":
            payload = self._read_json()
            required = ["id", "sku", "barcode", "size", "quantity"]
            if any(k not in payload for k in required):
                return self._json_response(400, {"error": "id, sku, barcode, size, quantity zorunlu"})

            with get_db() as conn:
                card = conn.execute("SELECT id FROM stock_cards WHERE sku = ?", (payload["sku"],)).fetchone()
                if not card:
                    return self._json_response(404, {"error": "SKU bulunamadı"})

                conn.execute(
                    """
                    INSERT INTO variants(id, stock_card_id, barcode, size, quantity)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (payload["id"], card["id"], payload["barcode"], payload["size"], payload["quantity"]),
                )
            return self._json_response(201, {"ok": True})

        return self._json_response(404, {"error": "Not found"})

    def do_PATCH(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/stock-cards/") or not path.endswith("/location"):
            return self._json_response(404, {"error": "Not found"})

        sku = path.split("/")[3]
        payload = self._read_json()
        new_location = payload.get("toLocation")
        changed_by = payload.get("changedBy", "Bilinmeyen")
        note = payload.get("note", "")

        if not new_location:
            return self._json_response(400, {"error": "toLocation zorunlu"})

        with get_db() as conn:
            row = conn.execute(
                """
                SELECT sc.id, sc.location_code, sc.sku, sc.brand, sc.product_name
                FROM stock_cards sc
                WHERE sc.sku = ?
                """,
                (sku,),
            ).fetchone()

            if not row:
                return self._json_response(404, {"error": "Stok kartı bulunamadı"})

            conn.execute("UPDATE stock_cards SET location_code = ? WHERE id = ?", (new_location, row["id"]))

            movement_id = f"m_{int(datetime.now().timestamp() * 1000)}_{row['id']}"
            conn.execute(
                """
                INSERT INTO movements(id, stock_card_id, variant_id, sku, product_name, brand, barcode, size, quantity,
                                      from_location, to_location, changed_by, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    movement_id,
                    row["id"],
                    None,
                    row["sku"],
                    row["product_name"],
                    row["brand"],
                    None,
                    None,
                    None,
                    row["location_code"],
                    new_location,
                    changed_by,
                    note,
                    utc_now_iso(),
                ),
            )

        return self._json_response(200, {"ok": True})


def run():
    import os
    port = int(os.environ.get("PORT", 8787))
    init_db()
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"API ready: http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
