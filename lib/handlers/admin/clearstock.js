import { requireAdmin } from "../../auth.js";
import { readJson, bad } from "../../http.js";
import { clearStock, countPendingByProduct, getProduct } from "../../db.js";

// POST /api/admin?action=clear-stock {productId} — habiskan stok: semua stok
// belum terjual ditandai habis (produk tetap tampil "Stok habis", isi stok tidak
// dihapus). Ditolak kalau masih ada pesanan pending untuk produk itu, supaya
// pembeli yang sudah checkout tidak berakhir tanpa pengiriman.
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const { productId } = await readJson(req);
  const p = await getProduct(String(productId || ""));
  if (!p) return bad(res, 404, "Produk tidak ditemukan");
  const pending = await countPendingByProduct(p.id);
  if (pending > 0) return bad(res, 400, `Masih ada ${pending} pesanan pending untuk produk ini — selesaikan/batalkan dulu sebelum menghabiskan stok`);
  const cleared = await clearStock(p.id);
  const fresh = await getProduct(p.id);
  res.status(200).json({ cleared, stock_count: fresh.stock_count });
}
