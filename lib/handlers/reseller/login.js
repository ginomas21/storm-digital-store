import { readJson, bad } from "../../http.js";
import { getResellerByUsername, getResellerDefaultDiscount, effectiveDiscount } from "../../db.js";
import { verifyPassword, makeResellerSession, resellerSessionCookie } from "../../auth.js";

// POST /api/reseller/login {username, password}
export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const { username, password } = await readJson(req);
  const r = await getResellerByUsername(String(username || "").trim());
  if (!r || !r.active || !verifyPassword(password || "", r.pass_hash))
    return bad(res, 401, "Username atau password reseller salah");
  const def = await getResellerDefaultDiscount();
  res.setHeader("Set-Cookie", resellerSessionCookie(makeResellerSession(r.id, r.username), 12 * 3600));
  return res.status(200).json({ ok: true, username: r.username, discount: effectiveDiscount(r, def) });
}
