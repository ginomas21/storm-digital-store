import { readJson, bad } from "../../lib/http.js";
import { checkCredentials, makeSession, sessionCookie, adminConfigured } from "../../lib/auth.js";

// POST /api/admin/login {username, password}
export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  if (!adminConfigured()) return bad(res, 503, "Login admin belum diatur (ADMIN_USERNAME/ADMIN_PASSWORD belum diisi di Vercel)");
  const { username, password } = await readJson(req);
  if (!checkCredentials(username, password)) return bad(res, 401, "Username atau password salah");
  res.setHeader("Set-Cookie", sessionCookie(makeSession(username), 12 * 3600));
  res.status(200).json({ ok: true, username });
}
