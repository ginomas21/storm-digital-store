// API khusus bot Telegram Storm — dikunci BOT_API_KEY (env Vercel, Production).
// Bot TIDAK memakai login session admin; kunci ini cakupannya hanya aksi di bawah.
// GET (pakai header x-bot-key) = cek kesehatan/kunci, tanpa efek samping.
// Diadaptasi dari IBC api/bot.js, dengan prefix order TG-xxxx (bukan WA-xxxx).
import { fulfillExternalOrder, createProduct, addStock, updateProduct, getProduct } from "../lib/db.js";

function auth(req, res) {
  if (!process.env.BOT_API_KEY) {
    res.status(503).json({ error: "bot API belum dikonfigurasi" });
    return false;
  }
  if (req.headers["x-bot-key"] !== process.env.BOT_API_KEY) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (!auth(req, res)) return;
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method tidak diizinkan" });
  if (!auth(req, res)) return;
  const body = req.body || {};
  try {
    if (body.action === "fulfill") {
      const order_ref = String(body.order_ref || "");
      const qty = Number(body.qty);
      if (!/^TG-\d{4,}$/.test(order_ref)) return res.status(400).json({ error: "order_ref tidak valid" });
      if (!Number.isInteger(qty) || qty < 1 || qty > 10) return res.status(400).json({ error: "qty tidak valid" });
      if (!body.product_id) return res.status(400).json({ error: "product_id wajib" });
      const r = await fulfillExternalOrder({
        order_ref, product_id: String(body.product_id), qty,
        buyer_name: String(body.buyer_name || ""), contact: String(body.contact || ""),
        txid: String(body.txid || ""),
      });
      if (r.error === "insufficient_stock") return res.status(409).json(r);
      if (r.error) return res.status(404).json(r);
      return res.status(200).json({ ok: true, ...r });
    }
    if (body.action === "create-product") {
      const name = String(body.name || "").trim();
      const price = Number(body.price);
      if (!name || !Number.isInteger(price) || price <= 0) return res.status(400).json({ error: "name/price tidak valid" });
      const p = await createProduct({ name, price, descr: String(body.descr || "") });
      return res.status(200).json({ ok: true, product: p });
    }
    if (body.action === "add-stock") {
      if (!body.product_id) return res.status(400).json({ error: "product_id wajib" });
      const items = Array.isArray(body.items) ? body.items.map(s => String(s)).filter(s => s.trim()) : [];
      if (!items.length || items.length > 500) return res.status(400).json({ error: "items tidak valid" });
      const pr = await getProduct(String(body.product_id));
      if (!pr) return res.status(404).json({ error: "product_not_found" });
      const added = await addStock(String(body.product_id), items);
      return res.status(200).json({ ok: true, added });
    }
    if (body.action === "set-active") {
      if (!body.product_id) return res.status(400).json({ error: "product_id wajib" });
      const pr = await getProduct(String(body.product_id));
      if (!pr) return res.status(404).json({ error: "product_not_found" });
      const p = await updateProduct(String(body.product_id), { active: !!body.active });
      return res.status(200).json({ ok: true, product: p });
    }
    return res.status(400).json({ error: "action tidak dikenal" });
  } catch (e) {
    return res.status(500).json({ error: "gagal: " + e.message });
  }
}
