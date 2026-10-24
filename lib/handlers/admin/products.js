import { requireAdmin } from "../../auth.js";
import { readJson, bad } from "../../http.js";
import { listProducts, createProduct, updateProduct, deleteProduct, addStock, demoMode } from "../../db.js";

// GET: semua produk + stok. POST {name, price, descr?, stock?} tambah produk
// (kategori dipaksa 'Akun Premium', sama seperti bot). PUT {id, ...} ubah.
// DELETE {id} hapus. POST stok terpisah: /api/admin/stock
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === "GET") {
    return res.status(200).json({ products: await listProducts(), demo: demoMode });
  }
  const body = await readJson(req);
  if (req.method === "POST") {
    const name = String(body.name || "").trim();
    const price = Number(body.price || 0);
    if (!name || !(price > 0)) return bad(res, 400, "Nama dan harga (angka > 0) wajib diisi");
    const p = await createProduct({ name, price, descr: body.descr ? String(body.descr) : "" });
    if (body.stock) await addStock(p.id, String(body.stock).split("\n"));
    return res.status(200).json({ product: await (await import("../../lib/db.js")).getProduct(p.id) });
  }
  if (req.method === "PUT") {
    if (!body.id) return bad(res, 400, "id produk wajib");
    const f = {};
    if (body.name !== undefined) f.name = String(body.name);
    if (body.price !== undefined) f.price = Number(body.price);
    if (body.descr !== undefined) f.descr = String(body.descr);
    if (body.active !== undefined) f.active = !!body.active;
    return res.status(200).json({ product: await updateProduct(String(body.id), f) });
  }
  if (req.method === "DELETE") {
    if (!body.id) return bad(res, 400, "id produk wajib");
    await deleteProduct(String(body.id));
    return res.status(200).json({ ok: true });
  }
  return bad(res, 405, "Method tidak diizinkan");
}
