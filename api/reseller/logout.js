import { clearResellerCookie } from "../../lib/auth.js";

// POST /api/reseller/logout — hapus cookie sesi reseller
export default async function handler(req, res) {
  res.setHeader("Set-Cookie", clearResellerCookie());
  return res.status(200).json({ ok: true });
}
