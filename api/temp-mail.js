// POST /api/temp-mail — API website temp-mail (temp.pengagumku.id).
// Satu dispatcher untuk semua aksi web (batas 12 fungsi Vercel Hobby).
// Body JSON: {action, ...}. Kode kredensial TIDAK PERNAH dikembalikan
// server kecuali sekali saat pembuatan alamat (aksi create).
import {
  validateLocal, randomLocal, claimWebAddress, verifyWebAccess,
  listWebMessages, getWebMessage, getWebAttachment,
  reactivateWebAddress, deleteWebAddress,
  DOMAIN, EXPIRY_DAYS, WEB_RETENTION_DAYS, MAX_WEB_PER_IP,
} from "../lib/temp-mail.js";

function clientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    ""
  );
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}

const localOf = (address) => String(address || "").trim().toLowerCase().replace(/@.*$/, "");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const body = await readJson(req);
  const action = String(body.action || "");

  try {
    // ---------- buat alamat baru ----------
    if (action === "create") {
      let local = localOf(body.name || "");
      if (!local) local = randomLocal();
      const v = validateLocal(local);
      if (!v.ok) return res.status(400).json({ ok: false, error: v.error });
      const r = await claimWebAddress(v.local, clientIp(req));
      if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
      return res.status(200).json({
        ok: true, address: r.address, local: r.local,
        expires_at: r.expires_at, code: r.code, // <-- tampilkan SEKALI saja
        expiry_days: EXPIRY_DAYS, domain: DOMAIN,
      });
    }

    // ---------- semua aksi di bawah butuh alamat + kode ----------
    const local = localOf(body.address || "");
    const code = String(body.code || "");
    if (action === "inbox" || action === "message" || action === "attachment" ||
        action === "reactivate" || action === "delete") {
      if (!local || !code)
        return res.status(400).json({ ok: false, error: "Alamat dan kode wajib diisi." });
    }

    if (action === "inbox") {
      const v = await verifyWebAccess(local, code);
      if (!v.ok) return res.status(401).json({ ok: false, error: v.error });
      const a = v.address;
      const expires = new Date(a.expires_at).getTime();
      const retentionUntil = new Date(expires + WEB_RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
      const messages = await listWebMessages(a.local);
      return res.status(200).json({
        ok: true, address: `${a.local}@${DOMAIN}`, local: a.local,
        created_at: a.created_at, expires_at: a.expires_at,
        expired: expires <= Date.now(), retention_until: retentionUntil,
        messages,
      });
    }

    if (action === "message") {
      const v = await verifyWebAccess(local, code);
      if (!v.ok) return res.status(401).json({ ok: false, error: v.error });
      const m = await getWebMessage(v.address.local, body.id);
      if (!m) return res.status(404).json({ ok: false, error: "Pesan tidak ditemukan." });
      return res.status(200).json({ ok: true, message: m });
    }

    if (action === "attachment") {
      const v = await verifyWebAccess(local, code);
      if (!v.ok) return res.status(401).json({ ok: false, error: v.error });
      const att = await getWebAttachment(v.address.local, body.message_id, body.att_id);
      if (!att) return res.status(404).json({ ok: false, error: "Lampiran tidak ditemukan atau tidak tersimpan." });
      const buf = Buffer.from(att.data || "", "base64");
      res.setHeader("Content-Type", att.content_type || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${String(att.filename || "lampiran").replace(/["\n]/g, "")}"`);
      res.setHeader("Content-Length", buf.length);
      return res.status(200).end(buf);
    }

    if (action === "reactivate") {
      const r = await reactivateWebAddress(local, code);
      if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
      return res.status(200).json({ ok: true, address: r.address, expires_at: r.expires_at });
    }

    if (action === "delete") {
      const r = await deleteWebAddress(local, code);
      if (!r.ok) return res.status(401).json({ ok: false, error: r.error });
      return res.status(200).json({ ok: true });
    }

    if (action === "info") {
      return res.status(200).json({
        ok: true, domain: DOMAIN, expiry_days: EXPIRY_DAYS,
        retention_days: WEB_RETENTION_DAYS, max_active_per_ip: MAX_WEB_PER_IP,
      });
    }

    return res.status(400).json({ ok: false, error: "Aksi tidak dikenal." });
  } catch (e) {
    console.error("temp-mail API gagal:", e.message);
    return res.status(500).json({ ok: false, error: "Terjadi kesalahan di server. Coba lagi." });
  }
}
