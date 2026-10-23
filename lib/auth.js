import crypto from "node:crypto";

// Login admin: username + password dari environment variable Vercel
// (ADMIN_USERNAME / ADMIN_PASSWORD — diisi Arka sendiri di dashboard, tidak lewat chat).
// Sesi = cookie httpOnly bertanda tangan HMAC (SESSION_SECRET).
function secret() {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-secret-ganti-di-vercel";
}
export function adminConfigured() {
  return !!(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD);
}
export function checkCredentials(username, password) {
  const u = process.env.ADMIN_USERNAME || "";
  const p = process.env.ADMIN_PASSWORD || "";
  if (!u || !p) return false;
  const a = Buffer.from(String(username || "")), b = Buffer.from(u);
  const c = Buffer.from(String(password || "")), d = Buffer.from(p);
  return a.length === b.length && crypto.timingSafeEqual(a, b) && c.length === d.length && crypto.timingSafeEqual(c, d);
}
export function makeSession(username) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + 12 * 3600 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function readSession(req) {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)sds_admin=([^;]+)/);
  if (!m) return null;
  const [payload, sig] = decodeURIComponent(m[1]).split(".");
  if (!payload || !sig) return null;
  const expect = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  if (sig !== expect) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}
export function requireAdmin(req, res) {
  const s = readSession(req);
  if (!s) { res.status(401).json({ error: "Belum login admin" }); return null; }
  return s;
}
export function sessionCookie(value, maxAgeSec) {
  return `sds_admin=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
