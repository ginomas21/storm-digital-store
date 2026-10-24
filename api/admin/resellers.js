import { requireAdmin, hashPassword } from "../../lib/auth.js";
import { readJson, bad } from "../../lib/http.js";
import { listResellers, createReseller, updateReseller, getResellerDefaultDiscount, setResellerDefaultDiscount, getResellerByUsername } from "../../lib/db.js";

// GET: daftar reseller + diskon default. POST {username, password, discount?}
// tambah reseller. POST {id, discount?, active?, password?} ubah reseller.
// Hanya admin. Password selalu disimpan sebagai hash, tidak pernah ditampilkan.
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === "GET") {
    return res.status(200).json({ resellers: await listResellers(), default_discount: await getResellerDefaultDiscount() });
  }
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const body = await readJson(req);
  if (body.id) {
    const fields = {};
    if (body.discount !== undefined) fields.discount = body.discount;
    if (body.active !== undefined) fields.active = !!body.active;
    if (body.password) fields.pass_hash = hashPassword(body.password);
    const r = await updateReseller(String(body.id), fields);
    if (!r) return bad(res, 404, "Reseller tidak ditemukan");
    return res.status(200).json({ reseller: r });
  }
  const username = String(body.username || "").trim();
  if (!username || !body.password) return bad(res, 400, "Username dan password reseller wajib diisi");
  if (await getResellerByUsername(username)) return bad(res, 400, "Username reseller sudah dipakai");
  const r = await createReseller({ username, pass_hash: hashPassword(body.password), discount: body.discount });
  return res.status(200).json({ reseller: r });
}
