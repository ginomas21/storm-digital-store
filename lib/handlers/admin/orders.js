import { requireAdmin } from "../../auth.js";
import { readJson, bad } from "../../http.js";
import { listOrders, getOrder, setOrderFields, demoMode } from "../../db.js";

// GET /api/admin/orders — 100 transaksi terakhir + ringkasan omzet (status sukses*).
// GET /api/admin/orders?id=SDS-xxxx — detail satu pesanan (untuk form edit, admin saja).
// PUT /api/admin/orders {id, buyer_name?, contact?, phone?, status?, delivered?} —
//   edit pesanan. Yang BOLEH diubah: data pembeli, isi pengiriman, dan status
//   pending <-> batal. Harga, jumlah, dan produk TIDAK bisa diubah (terkait
//   pembayaran QRIS yang sudah dibuat). Pesanan sukses/gagal statusnya terkunci.
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === "GET") {
    const id = String(req.query.id || "");
    if (id) {
      const o = await getOrder(id);
      if (!o) return bad(res, 404, "Pesanan tidak ditemukan");
      return res.status(200).json({ order: o, demo: demoMode });
    }
    const orders = await listOrders(100);
    const omzet = orders.filter(o => String(o.status).startsWith("sukses")).reduce((a, o) => a + Number(o.total || 0), 0);
    return res.status(200).json({ orders, omzet_recent: omzet, demo: demoMode });
  }
  if (req.method !== "PUT") return bad(res, 405, "Method tidak diizinkan");
  const body = await readJson(req);
  if (!body.id) return bad(res, 400, "id pesanan wajib");
  const o = await getOrder(String(body.id));
  if (!o) return bad(res, 404, "Pesanan tidak ditemukan");
  const fields = {};
  if (body.buyer_name !== undefined) fields.buyer_name = String(body.buyer_name).slice(0, 60);
  if (body.contact !== undefined) fields.contact = String(body.contact).slice(0, 120);
  if (body.phone !== undefined) fields.phone = String(body.phone).slice(0, 30);
  if (body.delivered !== undefined) fields.delivered = String(body.delivered);
  if (body.status !== undefined) {
    const st = String(body.status);
    if (st !== "pending" && st !== "batal") return bad(res, 400, "Status hanya bisa diubah antara pending dan batal");
    if (o.status !== "pending" && o.status !== "batal") return bad(res, 400, "Pesanan sukses/gagal statusnya tidak bisa diubah");
    fields.status = st;
  }
  if (!Object.keys(fields).length) return bad(res, 400, "Tidak ada perubahan");
  const updated = await setOrderFields(o.id, fields);
  res.status(200).json({ order: updated });
}
