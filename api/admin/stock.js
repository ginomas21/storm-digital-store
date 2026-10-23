import { requireAdmin } from "../../lib/auth.js";
import { readJson, bad } from "../../lib/http.js";
import { addStock, getProduct } from "../../lib/db.js";

// POST /api/admin/stock {productId, stock: "satu akun per baris"}
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const { productId, stock } = await readJson(req);
  const p = await getProduct(String(productId || ""));
  if (!p) return bad(res, 404, "Produk tidak ditemukan");
  const n = await addStock(p.id, String(stock || "").split("\n"));
  const fresh = await getProduct(p.id);
  res.status(200).json({ added: n, stock_count: fresh.stock_count });
}
