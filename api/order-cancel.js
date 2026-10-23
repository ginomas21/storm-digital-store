import { getOrder, setOrderFields } from "../lib/db.js";
import { readJson, bad } from "../lib/http.js";
import { btzCancel } from "../lib/btz.js";

// POST /api/order-cancel {id, contact}
export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const { id, contact } = await readJson(req);
  const o = await getOrder(String(id || ""));
  if (!o) return bad(res, 404, "Pesanan tidak ditemukan");
  if (String(contact || "").trim().toLowerCase() !== String(o.contact).toLowerCase()) return bad(res, 403, "Kontak tidak cocok");
  if (o.status !== "pending") return bad(res, 400, "Pesanan sudah tidak bisa dibatalkan");
  if (o.txid) btzCancel(o.txid);
  await setOrderFields(o.id, { status: "dibatalkan" });
  res.status(200).json({ ok: true });
}
