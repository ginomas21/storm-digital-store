// Lapisan data website. Produksi: PostgreSQL (DATABASE_URL — mis. Neon lewat
// integrasi Vercel). Tanpa DATABASE_URL: mode DEMO in-memory (data reset tiap
// instance dingin) dengan produk contoh dari katalog bot, stok bertanda DEMO.
const HAS_DB = !!process.env.DATABASE_URL;
export const demoMode = !HAS_DB;

let pool = null;
async function db() {
  if (!pool) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? undefined : { rejectUnauthorized: false },
      max: 3,
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products(
        id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'Akun Premium',
        price INTEGER NOT NULL, descr TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS stock_items(
        id BIGSERIAL PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        secret TEXT NOT NULL, sold_order_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS orders(
        id TEXT PRIMARY KEY, product_id TEXT, product_name TEXT NOT NULL, price INTEGER NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1, total INTEGER NOT NULL, buyer_name TEXT NOT NULL DEFAULT '',
        contact TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
        txid TEXT NOT NULL DEFAULT '', access_key TEXT NOT NULL DEFAULT '',
        delivered TEXT NOT NULL DEFAULT '', email_sent BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid_at TIMESTAMPTZ);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
      INSERT INTO meta(key,value) VALUES('order_seq',0) ON CONFLICT(key) DO NOTHING;
    `);
  }
  return pool;
}

// ---------------- mode demo (tanpa database) ----------------
const demo = {
  seq: 0,
  products: [
    { id: "P783529", name: "Chatgpt go", category: "Akun Premium", price: 30000, descr: "Akun premium dari Storm Digital Store. Akun dikirim otomatis begitu pembayaran lunas.\nOwner: @arkasettt", active: true },
    { id: "P785408", name: "Muse 30b token", category: "Akun Premium", price: 30000, descr: "Akun premium dari Storm Digital Store. Akun dikirim otomatis begitu pembayaran lunas.\nOwner: @arkasettt", active: true },
  ],
  stock: new Map([["P783529", ["DEMO-AKUN-1 (contoh, bukan akun asli)"]], ["P785408", ["DEMO-AKUN-1 (contoh, bukan akun asli)", "DEMO-AKUN-2 (contoh, bukan akun asli)"]]]),
  orders: new Map(),
};
const pid = () => "P" + Math.floor(100000 + Math.random() * 900000);

// ---------------- API dipakai semua endpoint ----------------
export async function listProducts() {
  if (!HAS_DB) return demo.products.map(p => ({ ...p, stock_count: (demo.stock.get(p.id) || []).length }));
  const p = await db();
  const r = await p.query(`SELECT pr.*, COALESCE(s.cnt,0)::int AS stock_count FROM products pr
    LEFT JOIN (SELECT product_id, COUNT(*) cnt FROM stock_items WHERE sold_order_id IS NULL GROUP BY product_id) s
    ON s.product_id = pr.id ORDER BY pr.created_at`);
  return r.rows;
}
export async function getProduct(id) {
  const all = await listProducts();
  return all.find(x => x.id === id) || null;
}
export async function createProduct({ name, price, descr }) {
  const id = pid();
  const desc = descr || "Akun premium dari Storm Digital Store. Akun dikirim otomatis begitu pembayaran lunas.\nOwner: @arkasettt";
  if (!HAS_DB) { const p = { id, name, category: "Akun Premium", price, descr: desc, active: true }; demo.products.push(p); demo.stock.set(id, []); return p; }
  const p = await db();
  await p.query(`INSERT INTO products(id,name,category,price,descr) VALUES($1,$2,'Akun Premium',$3,$4)`, [id, name, price, desc]);
  return { id, name, category: "Akun Premium", price, descr: desc, active: true, stock_count: 0 };
}
export async function updateProduct(id, { name, price, descr, active }) {
  if (!HAS_DB) { const p = demo.products.find(x => x.id === id); if (p) Object.assign(p, { name: name ?? p.name, price: price ?? p.price, descr: descr ?? p.descr, active: active ?? p.active }); return p; }
  const p = await db();
  await p.query(`UPDATE products SET name=COALESCE($2,name), price=COALESCE($3,price), descr=COALESCE($4,descr), active=COALESCE($5,active) WHERE id=$1`,
    [id, name ?? null, price ?? null, descr ?? null, active ?? null]);
  return getProduct(id);
}
export async function deleteProduct(id) {
  if (!HAS_DB) { demo.products = demo.products.filter(x => x.id !== id); demo.stock.delete(id); return true; }
  const p = await db(); await p.query(`DELETE FROM products WHERE id=$1`, [id]); return true;
}
export async function addStock(productId, items) {
  const clean = items.map(s => String(s).trim()).filter(Boolean);
  if (!HAS_DB) { const arr = demo.stock.get(productId) || []; arr.push(...clean); demo.stock.set(productId, arr); return clean.length; }
  const p = await db();
  for (const s of clean) await p.query(`INSERT INTO stock_items(product_id, secret) VALUES($1,$2)`, [productId, s]);
  return clean.length;
}
export async function createOrder(o) {
  if (!HAS_DB) { demo.seq += 1; const id = `SDS-${String(demo.seq).padStart(4, "0")}`; const order = { ...o, id, status: "pending", delivered: "", email_sent: false, created_at: new Date().toISOString() }; demo.orders.set(id, order); return order; }
  const p = await db();
  const r = await p.query(`UPDATE meta SET value=value+1 WHERE key='order_seq' RETURNING value`);
  const id = `SDS-${String(r.rows[0].value).padStart(4, "0")}`;
  await p.query(`INSERT INTO orders(id,product_id,product_name,price,qty,total,buyer_name,contact,phone,txid,access_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id, o.product_id, o.product_name, o.price, o.qty, o.total, o.buyer_name || "", o.contact || "", o.phone || "", o.txid || "", o.access_key || ""]);
  return getOrder(id);
}
export async function getOrder(id) {
  if (!HAS_DB) return demo.orders.get(id) || null;
  const p = await db();
  const r = await p.query(`SELECT * FROM orders WHERE id=$1`, [id]);
  return r.rows[0] || null;
}
export async function setOrderFields(id, fields) {
  if (!HAS_DB) { const o = demo.orders.get(id); if (o) Object.assign(o, fields); return o; }
  const p = await db();
  const keys = Object.keys(fields);
  if (!keys.length) return getOrder(id);
  const sets = keys.map((k, i) => `${k}=$${i + 2}`).join(", ");
  await p.query(`UPDATE orders SET ${sets} WHERE id=$1`, [id, ...keys.map(k => fields[k])]);
  return getOrder(id);
}
// Kunci stok untuk order yang lunas — idempoten: kalau sudah final, kembalikan isi lama.
export async function finalizePaid(id) {
  const order = await getOrder(id);
  if (!order) return null;
  if (order.status !== "pending") return order;
  if (!HAS_DB) {
    const arr = demo.stock.get(order.product_id) || [];
    const items = arr.splice(0, order.qty);
    order.status = items.length === order.qty ? "sukses" : (items.length ? "sukses_sebagian" : "sukses_tanpa_stok");
    order.delivered = items.join("\n");
    order.paid_at = new Date().toISOString();
    return order;
  }
  const p = await db();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [id]);
    const o = cur.rows[0];
    if (!o || o.status !== "pending") { await client.query("COMMIT"); return o; }
    const s = await client.query(`SELECT id, secret FROM stock_items WHERE product_id=$1 AND sold_order_id IS NULL ORDER BY id LIMIT $2 FOR UPDATE`, [o.product_id, o.qty]);
    const items = s.rows.map(r => r.secret);
    for (const row of s.rows) await client.query(`UPDATE stock_items SET sold_order_id=$1 WHERE id=$2`, [id, row.id]);
    const status = items.length === o.qty ? "sukses" : (items.length ? "sukses_sebagian" : "sukses_tanpa_stok");
    await client.query(`UPDATE orders SET status=$1, delivered=$2, paid_at=now() WHERE id=$3`, [status, items.join("\n"), id]);
    await client.query("COMMIT");
    return getOrder(id);
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
export async function listOrders(limit = 30) {
  if (!HAS_DB) return [...demo.orders.values()].slice(-limit).reverse();
  const p = await db();
  const r = await p.query(`SELECT id, product_name, price, qty, total, buyer_name, contact, phone, status, created_at, paid_at FROM orders ORDER BY created_at DESC LIMIT $1`, [limit]);
  return r.rows;
}
