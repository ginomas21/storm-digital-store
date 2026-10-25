import { listProducts, demoMode } from "../lib/db.js";
import { agConfigured } from "../lib/autogopay.js";
import { mailConfigured } from "../lib/mail.js";

// GET /api/products — katalog publik (tanpa isi stok, cuma jumlahnya)
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method tidak diizinkan" });
  const items = (await listProducts())
    .filter(p => p.active)
    .map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, descr: p.descr, stock_count: p.stock_count, terjual: p.terjual }));
  res.status(200).json({ products: items, demo: demoMode, payment_active: agConfigured(), email_active: mailConfigured() });
}
