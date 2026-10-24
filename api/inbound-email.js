import { verifySvix } from "../lib/svix.js";
import { telegramMailConfigured, forwardEmailToTelegram } from "../lib/telegram-mail.js";

// POST /api/inbound-email — webhook Resend Receiving (event email.received).
// Alur: verifikasi tanda tangan Svix -> ambil isi email lengkap via Receiving API
// (webhook hanya membawa metadata) -> teruskan ke Telegram owner via bot khusus email.
// Env: RESEND_API_KEY (sudah ada, untuk kirim — idealnya full access agar bisa baca
// Receiving), RESEND_WEBHOOK_SECRET (dari dashboard Resend saat webhook dibuat),
// TELEGRAM_MAIL_BOT_TOKEN + TELEGRAM_MAIL_CHAT_ID.
export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function resendGet(path) {
  const res = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Resend GET ${path} -> HTTP ${res.status}`);
  const j = await res.json();
  return j && (j.id || j.download_url) ? j : j.data || j;
}

const fetchReceivedEmail = (emailId) =>
  resendGet(`/emails/receiving/${encodeURIComponent(emailId)}`);

const fetchAttachmentUrl = async (emailId, attId) => {
  const j = await resendGet(
    `/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attId)}`
  );
  return j.download_url || null;
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const raw = await readRaw(req);

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    if (!verifySvix(raw, req.headers, secret))
      return res.status(400).json({ error: "Tanda tangan webhook tidak valid" });
  } else {
    console.warn("RESEND_WEBHOOK_SECRET belum diatur — verifikasi tanda tangan dilewati");
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: "Body bukan JSON valid" });
  }
  if (event.type !== "email.received")
    return res.status(200).json({ ok: true, ignored: event.type || null });

  const meta = event.data || {};
  let email = null;
  try {
    email = await fetchReceivedEmail(meta.email_id);
  } catch (e) {
    console.error("Gagal ambil isi email dari Resend:", e.message);
  }

  if (!telegramMailConfigured()) {
    console.error("TELEGRAM_MAIL_BOT_TOKEN / TELEGRAM_MAIL_CHAT_ID belum diatur");
    return res.status(200).json({ ok: false, reason: "telegram-belum-diatur" });
  }
  try {
    await forwardEmailToTelegram(email, meta, fetchAttachmentUrl);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Gagal teruskan ke Telegram:", e.message);
    return res.status(200).json({ ok: false, reason: "telegram-gagal" });
  }
}
