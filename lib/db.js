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
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sold_custom INTEGER;
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
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS reseller_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_pct INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS resellers(
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL,
        discount INTEGER, active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0);
      INSERT INTO meta(key,value) VALUES('order_seq',0) ON CONFLICT(key) DO NOTHING;
      INSERT INTO meta(key,value) VALUES('reseller_default_discount',25) ON CONFLICT(key) DO NOTHING;
      CREATE TABLE IF NOT EXISTS vouchers(
        id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, discount_type TEXT NOT NULL DEFAULT 'percent',
        discount_value INTEGER NOT NULL, max_uses INTEGER, used_count INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE, expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_discount INTEGER NOT NULL DEFAULT 0;
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
  resellers: [],
  defaultDiscount: 25,
  vouchers: [
    { id: "V1001", code: "HEMAT10", discount_type: "percent", discount_value: 10, max_uses: null, used_count: 0, active: true, expires_at: null, created_at: new Date().toISOString() },
  ],
};
const pid = () => "P" + Math.floor(100000 + Math.random() * 900000);

// ---------------- API dipakai semua endpoint ----------------
export async function listProducts() {
  if (!HAS_DB) return demo.products.map(p => ({
    ...p,
    stock_count: (demo.stock.get(p.id) || []).length,
    terjual: p.sold_custom ?? [...demo.orders.values()]
      .filter(o => o.product_id === p.id && String(o.status).startsWith("sukses"))
      .reduce((a, o) => a + Number(o.qty || 0), 0),
  }));
  const p = await db();
  const r = await p.query(`SELECT pr.*, COALESCE(s.cnt,0)::int AS stock_count,
    COALESCE(pr.sold_custom, COALESCE(rs.sold,0))::int AS terjual FROM products pr
    LEFT JOIN (SELECT product_id, COUNT(*) cnt FROM stock_items WHERE sold_order_id IS NULL GROUP BY product_id) s
    ON s.product_id = pr.id
    LEFT JOIN (SELECT product_id, SUM(qty)::int AS sold FROM orders WHERE status LIKE 'sukses%' GROUP BY product_id) rs
    ON rs.product_id = pr.id ORDER BY pr.created_at`);
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
// Total terjual custom per produk: null = otomatis dari penjualan sukses asli,
// angka >= 0 = angka itu yang tampil publik (hanya admin yang bisa mengubah).
export async function setSoldCustom(id, value) {
  const v = (value === null || value === undefined || value === "") ? null : Math.max(0, Math.floor(Number(value) || 0));
  if (!HAS_DB) { const p = demo.products.find(x => x.id === id); if (p) p.sold_custom = v; return p; }
  const p = await db();
  await p.query(`UPDATE products SET sold_custom=$2 WHERE id=$1`, [id, v]);
  return getProduct(id);
}
// Habiskan stok: semua stok belum terjual ditandai MANUAL_HABIS — produk tetap
// tampil sebagai "Stok habis", isi stok TIDAK dihapus (masih di database) dan
// stok baru tetap bisa ditambah. Mengembalikan jumlah item yang dihabiskan.
export async function clearStock(productId) {
  if (!HAS_DB) { const arr = demo.stock.get(productId) || []; const n = arr.length; demo.stock.set(productId, []); return n; }
  const p = await db();
  const r = await p.query(`UPDATE stock_items SET sold_order_id='MANUAL_HABIS' WHERE product_id=$1 AND sold_order_id IS NULL`, [productId]);
  return r.rowCount;
}
export async function countPendingByProduct(productId) {
  if (!HAS_DB) return [...demo.orders.values()].filter(o => o.product_id === productId && o.status === "pending").length;
  const p = await db();
  const r = await p.query(`SELECT COUNT(*)::int AS n FROM orders WHERE product_id=$1 AND status='pending'`, [productId]);
  return r.rows[0].n;
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
  await p.query(`INSERT INTO orders(id,product_id,product_name,price,qty,total,buyer_name,contact,phone,reseller_id,discount_pct,txid,access_key,voucher_code,voucher_discount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [id, o.product_id, o.product_name, o.price, o.qty, o.total, o.buyer_name || "", o.contact || "", o.phone || "", o.reseller_id || "", o.discount_pct || 0, o.txid || "", o.access_key || "", o.voucher_code || "", o.voucher_discount || 0]);
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
    if (order.voucher_code) { const v = demo.vouchers.find(x => x.code === order.voucher_code); if (v) v.used_count += 1; }
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
    if (o.voucher_code) await client.query(`UPDATE vouchers SET used_count = used_count + 1 WHERE code=$1`, [o.voucher_code]);
    await client.query("COMMIT");
    return getOrder(id);
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
export async function listOrders(limit = 30) {
  if (!HAS_DB) return [...demo.orders.values()].slice(-limit).reverse();
  const p = await db();
  const r = await p.query(`SELECT id, product_name, price, qty, total, buyer_name, contact, phone, reseller_id, discount_pct, voucher_code, voucher_discount, status, created_at, paid_at FROM orders ORDER BY created_at DESC LIMIT $1`, [limit]);
  return r.rows;
}

// Statistik dashboard (dihitung server dari seluruh tabel, bukan dari daftar).
export async function getDashboardStats() {
  if (!HAS_DB) {
    const orders = [...demo.orders.values()];
    const sukses = orders.filter(o => String(o.status).startsWith("sukses"));
    const top = new Map();
    for (const o of sukses) {
      const e = top.get(o.product_name) || { product_name: o.product_name, orders: 0, qty: 0, revenue: 0 };
      e.orders += 1; e.qty += Number(o.qty || 0); e.revenue += Number(o.total || 0); top.set(o.product_name, e);
    }
    return {
      demo: true,
      orders: {
        total: orders.length,
        sukses: sukses.length,
        pending: orders.filter(o => o.status === "pending").length,
        batal: orders.filter(o => !String(o.status).startsWith("sukses") && o.status !== "pending").length,
        revenue: sukses.reduce((a, o) => a + Number(o.total || 0), 0),
        saved: sukses.filter(o => o.reseller_id).reduce((a, o) => a + (Number(o.price || 0) * Number(o.qty || 0) - Number(o.total || 0)), 0),
      },
      products: {
        total: demo.products.length,
        active: demo.products.filter(p => p.active).length,
        stock: [...demo.stock.values()].reduce((a, arr) => a + arr.length, 0),
      },
      topProducts: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    };
  }
  const p = await db();
  const o = await p.query(`SELECT COUNT(*) total,
    COUNT(*) FILTER (WHERE status LIKE 'sukses%') sukses,
    COUNT(*) FILTER (WHERE status = 'pending') pending,
    COUNT(*) FILTER (WHERE status NOT LIKE 'sukses%' AND status <> 'pending') batal,
    COALESCE(SUM(total) FILTER (WHERE status LIKE 'sukses%'), 0) revenue,
    COALESCE(SUM(price * qty - total) FILTER (WHERE status LIKE 'sukses%' AND reseller_id <> ''), 0) saved
    FROM orders`);
  const pr = await p.query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE active) active FROM products`);
  const st = await p.query(`SELECT COUNT(*) stock FROM stock_items WHERE sold_order_id IS NULL`);
  const tp = await p.query(`SELECT product_name, COUNT(*) orders, SUM(qty) qty, SUM(total) revenue
    FROM orders WHERE status LIKE 'sukses%' GROUP BY product_name ORDER BY qty DESC LIMIT 5`);
  const r = o.rows[0];
  return {
    demo: false,
    orders: {
      total: Number(r.total), sukses: Number(r.sukses), pending: Number(r.pending), batal: Number(r.batal),
      revenue: Number(r.revenue), saved: Number(r.saved),
    },
    products: { total: Number(pr.rows[0].total), active: Number(pr.rows[0].active), stock: Number(st.rows[0].stock) },
    topProducts: tp.rows.map(x => ({ product_name: x.product_name, orders: Number(x.orders), qty: Number(x.qty), revenue: Number(x.revenue) })),
  };
}

// ---------------- voucher ----------------
// Kode promo: persen (1–90%) atau nominal Rp. Kode disimpan huruf besar agar
// tidak peka huruf besar/kecil. Pemakaian dihitung saat pesanan LUNAS
// (finalizePaid), bukan saat checkout dibuat — pesanan kedaluwarsa tidak
// menghanguskan jatah. Voucher hanya untuk pembelian tamu (tidak ditumpuk
// dengan diskon reseller).
const vid = () => "V" + Math.floor(1000 + Math.random() * 9000);
export function normalizeCode(code) { return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ""); }
export function validateVoucherInput({ code, discount_type, discount_value, max_uses, expires_at }) {
  const c = normalizeCode(code);
  if (c.length < 3 || c.length > 20) return "Kode voucher 3–20 karakter (huruf/angka/-/_ )";
  if (discount_type !== "percent" && discount_type !== "fixed") return "Tipe diskon harus persen atau nominal";
  const v = Math.floor(Number(discount_value) || 0);
  if (discount_type === "percent" && (v < 1 || v > 90)) return "Diskon persen harus 1–90%";
  if (discount_type === "fixed" && v < 1000) return "Diskon nominal minimal Rp1.000";
  if (max_uses !== null && max_uses !== undefined && max_uses !== "" && !(Number.isInteger(Number(max_uses)) && Number(max_uses) >= 1)) return "Maks pemakaian harus angka >= 1 atau kosong";
  if (expires_at) {
    const d = new Date(expires_at.length <= 10 ? expires_at + "T23:59:59+07:00" : expires_at);
    if (Number.isNaN(d.getTime())) return "Tanggal kedaluwarsa tidak valid";
  }
  return null;
}
function voucherExpiryIso(expires_at) {
  if (!expires_at) return null;
  const d = new Date(expires_at.length <= 10 ? expires_at + "T23:59:59+07:00" : expires_at);
  return d.toISOString();
}
export async function listVouchers() {
  if (!HAS_DB) return [...demo.vouchers].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const p = await db();
  const r = await p.query(`SELECT * FROM vouchers ORDER BY created_at DESC`);
  return r.rows;
}
export async function createVoucher(input) {
  const err = validateVoucherInput(input);
  if (err) throw new Error(err);
  const code = normalizeCode(input.code);
  const row = {
    id: vid(), code, discount_type: input.discount_type,
    discount_value: Math.floor(Number(input.discount_value)),
    max_uses: (input.max_uses === null || input.max_uses === undefined || input.max_uses === "") ? null : Number(input.max_uses),
    used_count: 0, active: true, expires_at: voucherExpiryIso(input.expires_at),
    created_at: new Date().toISOString(),
  };
  if (!HAS_DB) {
    if (demo.vouchers.some(v => v.code === code)) throw new Error("Kode voucher sudah dipakai");
    demo.vouchers.push(row); return row;
  }
  const p = await db();
  try {
    const r = await p.query(`INSERT INTO vouchers(id,code,discount_type,discount_value,max_uses,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [row.id, row.code, row.discount_type, row.discount_value, row.max_uses, row.expires_at]);
    return r.rows[0];
  } catch (e) {
    if (String(e.message).includes("duplicate") || String(e.code) === "23505") throw new Error("Kode voucher sudah dipakai");
    throw e;
  }
}
export async function updateVoucher(id, fields) {
  if (!HAS_DB) {
    const v = demo.vouchers.find(x => x.id === id); if (!v) return null;
    if (fields.discount_type !== undefined || fields.discount_value !== undefined) {
      const err = validateVoucherInput({ code: v.code, discount_type: fields.discount_type ?? v.discount_type, discount_value: fields.discount_value ?? v.discount_value, max_uses: fields.max_uses ?? v.max_uses, expires_at: fields.expires_at ?? v.expires_at });
      if (err) throw new Error(err);
    }
    if (fields.discount_type !== undefined) v.discount_type = fields.discount_type;
    if (fields.discount_value !== undefined) v.discount_value = Math.floor(Number(fields.discount_value));
    if (fields.max_uses !== undefined) v.max_uses = (fields.max_uses === null || fields.max_uses === "") ? null : Number(fields.max_uses);
    if (fields.expires_at !== undefined) v.expires_at = voucherExpiryIso(fields.expires_at);
    if (fields.active !== undefined) v.active = !!fields.active;
    return v;
  }
  const p = await db();
  const cur = await p.query(`SELECT * FROM vouchers WHERE id=$1`, [id]);
  if (!cur.rows.length) return null;
  const v = cur.rows[0];
  const next = {
    discount_type: fields.discount_type ?? v.discount_type,
    discount_value: fields.discount_value ?? v.discount_value,
    max_uses: fields.max_uses ?? v.max_uses,
    expires_at: fields.expires_at ?? v.expires_at,
  };
  const err = validateVoucherInput({ code: v.code, ...next });
  if (err) throw new Error(err);
  await p.query(`UPDATE vouchers SET discount_type=$2, discount_value=$3, max_uses=$4, expires_at=$5, active=COALESCE($6,active) WHERE id=$1`,
    [id, next.discount_type, Math.floor(Number(next.discount_value)), next.max_uses, voucherExpiryIso(next.expires_at), fields.active ?? null]);
  const r = await p.query(`SELECT * FROM vouchers WHERE id=$1`, [id]);
  return r.rows[0];
}
export async function deleteVoucher(id) {
  if (!HAS_DB) { demo.vouchers = demo.vouchers.filter(x => x.id !== id); return true; }
  const p = await db(); await p.query(`DELETE FROM vouchers WHERE id=$1`, [id]); return true;
}
// Validasi kode untuk checkout: mengembalikan {voucher} atau {error}.
export async function getUsableVoucher(code) {
  const c = normalizeCode(code);
  if (!c) return { error: "Kode voucher kosong" };
  const v = !HAS_DB
    ? demo.vouchers.find(x => x.code === c)
    : (await (await db()).query(`SELECT * FROM vouchers WHERE code=$1`, [c])).rows[0];
  if (!v) return { error: "Kode voucher tidak ditemukan" };
  if (!v.active) return { error: "Kode voucher sudah nonaktif" };
  if (v.expires_at && new Date(v.expires_at).getTime() < Date.now()) return { error: "Kode voucher sudah kedaluwarsa" };
  if (v.max_uses !== null && v.max_uses !== undefined && Number(v.used_count) >= Number(v.max_uses)) return { error: "Kuota pemakaian voucher sudah habis" };
  return { voucher: v };
}
// Hitung potongan untuk satu subtotal. Mengembalikan {discount} atau {error}.
export function voucherDiscountFor(voucher, subtotal) {
  const disc = voucher.discount_type === "percent"
    ? Math.floor(subtotal * Number(voucher.discount_value) / 100)
    : Number(voucher.discount_value);
  if (disc <= 0) return { error: "Voucher tidak memberi potongan untuk pesanan ini" };
  if (subtotal - disc < 1000) return { error: "Potongan voucher melebihi batas untuk pesanan ini (total minimal Rp1.000)" };
  return { discount: disc };
}

// ---------------- reseller ----------------
const clampPct = d => Math.max(0, Math.min(90, Number(d) || 0));
export async function getResellerDefaultDiscount() {
  if (!HAS_DB) return demo.defaultDiscount;
  const p = await db();
  const r = await p.query(`SELECT value FROM meta WHERE key='reseller_default_discount'`);
  return r.rows.length ? Number(r.rows[0].value) : 25;
}
export async function setResellerDefaultDiscount(d) {
  const v = clampPct(d);
  if (!HAS_DB) { demo.defaultDiscount = v; return v; }
  const p = await db();
  await p.query(`INSERT INTO meta(key,value) VALUES('reseller_default_discount',$1) ON CONFLICT(key) DO UPDATE SET value=$1`, [v]);
  return v;
}
export function effectiveDiscount(reseller, def) {
  if (!reseller) return 0;
  return reseller.discount === null || reseller.discount === undefined ? clampPct(def) : clampPct(reseller.discount);
}
const pubReseller = r => ({ id: r.id, username: r.username, discount: r.discount, active: !!r.active, created_at: r.created_at });
export async function listResellers() {
  if (!HAS_DB) return demo.resellers.map(pubReseller);
  const p = await db();
  const r = await p.query(`SELECT * FROM resellers ORDER BY created_at`);
  return r.rows.map(pubReseller);
}
export async function getResellerById(id) {
  if (!HAS_DB) return demo.resellers.find(x => x.id === id) || null;
  const p = await db();
  const r = await p.query(`SELECT * FROM resellers WHERE id=$1`, [id]);
  return r.rows[0] || null;
}
export async function getResellerByUsername(username) {
  if (!HAS_DB) return demo.resellers.find(x => x.username === username) || null;
  const p = await db();
  const r = await p.query(`SELECT * FROM resellers WHERE username=$1`, [username]);
  return r.rows[0] || null;
}
export async function createReseller({ username, pass_hash, discount }) {
  const id = "R" + Math.floor(100000 + Math.random() * 900000);
  const disc = discount === null || discount === undefined || discount === "" ? null : clampPct(discount);
  if (!HAS_DB) {
    const r = { id, username, pass_hash, discount: disc, active: true, created_at: new Date().toISOString() };
    demo.resellers.push(r); return pubReseller(r);
  }
  const p = await db();
  await p.query(`INSERT INTO resellers(id,username,pass_hash,discount) VALUES($1,$2,$3,$4)`, [id, username, pass_hash, disc]);
  return pubReseller(await getResellerById(id));
}
export async function updateReseller(id, fields) {
  if (!HAS_DB) {
    const r = demo.resellers.find(x => x.id === id); if (!r) return null;
    if (fields.discount !== undefined) r.discount = fields.discount === null || fields.discount === "" ? null : clampPct(fields.discount);
    if (fields.active !== undefined) r.active = !!fields.active;
    if (fields.pass_hash) r.pass_hash = fields.pass_hash;
    return pubReseller(r);
  }
  const p = await db();
  if (fields.discount !== undefined) await p.query(`UPDATE resellers SET discount=$2 WHERE id=$1`, [id, fields.discount === null || fields.discount === "" ? null : clampPct(fields.discount)]);
  if (fields.active !== undefined) await p.query(`UPDATE resellers SET active=$2 WHERE id=$1`, [id, !!fields.active]);
  if (fields.pass_hash) await p.query(`UPDATE resellers SET pass_hash=$2 WHERE id=$1`, [id, fields.pass_hash]);
  const r = await getResellerById(id);
  return r ? pubReseller(r) : null;
}
export async function resellerStats(resellerId) {
  const paid = o => String(o.status).startsWith("sukses");
  if (!HAS_DB) {
    const mine = [...demo.orders.values()].filter(o => o.reseller_id === resellerId && paid(o));
    return {
      tx_count: mine.length,
      total_spent: mine.reduce((s, o) => s + Number(o.total || 0), 0),
      total_saved: mine.reduce((s, o) => s + Math.max(0, Number(o.price || 0) * Number(o.qty || 0) - Number(o.total || 0)), 0),
    };
  }
  const p = await db();
  const r = await p.query(`SELECT COUNT(*)::int AS tx_count, COALESCE(SUM(total),0)::int AS total_spent,
    COALESCE(SUM(GREATEST(price*qty-total,0)),0)::int AS total_saved
    FROM orders WHERE reseller_id=$1 AND status LIKE 'sukses%'`, [resellerId]);
  return r.rows[0];
}
export async function listResellerOrders(resellerId, limit = 30) {
  if (!HAS_DB) return [...demo.orders.values()].filter(o => o.reseller_id === resellerId).slice(-limit).reverse();
  const p = await db();
  const r = await p.query(`SELECT id, product_name, price, qty, total, discount_pct, status, created_at, paid_at FROM orders WHERE reseller_id=$1 ORDER BY created_at DESC LIMIT $2`, [resellerId, limit]);
  return r.rows;
}
