import { readResellerSession } from "../../lib/auth.js";
import { getResellerById, getResellerDefaultDiscount, effectiveDiscount, resellerStats } from "../../lib/db.js";

// GET /api/reseller/me — siapa yang login + diskon efektif + statistiknya
export default async function handler(req, res) {
  const s = readResellerSession(req);
  if (!s) return res.status(200).json({ logged_in: false, username: null, discount: 0, stats: null });
  const r = await getResellerById(s.rid);
  if (!r || !r.active) return res.status(200).json({ logged_in: false, username: null, discount: 0, stats: null });
  const def = await getResellerDefaultDiscount();
  return res.status(200).json({
    logged_in: true, username: r.username, discount: effectiveDiscount(r, def),
    stats: await resellerStats(r.id),
  });
}
