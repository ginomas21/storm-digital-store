import { requireAdmin } from "../../auth.js";
import { readJson, bad } from "../../http.js";
import { listVouchers, createVoucher, updateVoucher, deleteVoucher } from "../../db.js";

// /api/admin?action=vouchers — CRUD kode voucher (admin saja).
// GET: daftar. POST {code, discount_type, discount_value, max_uses?, expires_at?} buat.
// POST {id, ...} ubah (kode tidak bisa diubah). DELETE {id} hapus.
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === "GET") {
    return res.status(200).json({ vouchers: await listVouchers() });
  }
  const body = await readJson(req);
  if (req.method === "DELETE") {
    if (!body.id) return bad(res, 400, "id voucher wajib");
    await deleteVoucher(String(body.id));
    return res.status(200).json({ ok: true });
  }
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  try {
    if (body.id) {
      const fields = {};
      if (body.discount_type !== undefined) fields.discount_type = body.discount_type;
      if (body.discount_value !== undefined) fields.discount_value = body.discount_value;
      if (body.max_uses !== undefined) fields.max_uses = body.max_uses;
      if (body.min_total !== undefined) fields.min_total = body.min_total;
      if (body.min_qty !== undefined) fields.min_qty = body.min_qty;
      if (body.expires_at !== undefined) fields.expires_at = body.expires_at;
      if (body.active !== undefined) fields.active = !!body.active;
      const v = await updateVoucher(String(body.id), fields);
      if (!v) return bad(res, 404, "Voucher tidak ditemukan");
      return res.status(200).json({ voucher: v });
    }
    const v = await createVoucher(body);
    return res.status(200).json({ voucher: v });
  } catch (e) {
    return bad(res, 400, e.message || "Gagal menyimpan voucher");
  }
}
