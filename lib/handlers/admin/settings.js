import { requireAdmin } from "../../auth.js";
import { readJson, bad } from "../../http.js";
import { getResellerDefaultDiscount, setResellerDefaultDiscount } from "../../db.js";

// GET/POST /api/admin/settings {reseller_default_discount} — hanya admin.
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === "GET") {
    return res.status(200).json({ reseller_default_discount: await getResellerDefaultDiscount() });
  }
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const body = await readJson(req);
  if (body.reseller_default_discount === undefined) return bad(res, 400, "reseller_default_discount wajib");
  return res.status(200).json({ reseller_default_discount: await setResellerDefaultDiscount(body.reseller_default_discount) });
}
