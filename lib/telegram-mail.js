// Teruskan email masuk (Resend Receiving) ke Telegram lewat bot khusus email.
// Env: TELEGRAM_MAIL_BOT_TOKEN (token bot dari BotFather), TELEGRAM_MAIL_CHAT_ID (chat owner).
const TG_LIMIT = 4000; // batas pesan Telegram 4096, sisakan margin
const TG_DOC_LIMIT = 20 * 1024 * 1024; // Telegram ambil dokumen via URL maks ~20 MB

export function telegramMailConfigured() {
  return !!(process.env.TELEGRAM_MAIL_BOT_TOKEN && process.env.TELEGRAM_MAIL_CHAT_ID);
}

export async function tgApi(method, payload) {
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_MAIL_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`Telegram ${method} HTTP ${res.status}`);
  const j = await res.json();
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description || "gagal"}`);
  return j.result;
}
const tgCall = tgApi;

export function chunkText(text, size = TG_LIMIT) {
  const chunks = [];
  let rest = String(text || "");
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.5) cut = size;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) chunks.push(rest);
  return chunks.length ? chunks : [""];
}

export async function sendTelegramText(text, chatId = process.env.TELEGRAM_MAIL_CHAT_ID) {
  for (const chunk of chunkText(text)) {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
    });
  }
}

export async function sendTelegramDocument(url, filename, chatId = process.env.TELEGRAM_MAIL_CHAT_ID) {
  return tgCall("sendDocument", {
    chat_id: chatId,
    document: url,
    caption: `📎 ${filename}`,
  });
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtTime(iso) {
  if (!iso) return "";
  try {
    return (
      new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB"
    );
  } catch {
    return String(iso);
  }
}

// email: hasil GET /emails/receiving/:id (bisa null kalau API gagal —
// fallback ke metadata webhook). getAttachmentUrl(emailId, attId) -> URL unduh sementara.
// chatId: tujuan penerusan (pemilik alamat temp-mail, atau owner sebagai bawaan).
export async function forwardEmailToTelegram(email, meta, getAttachmentUrl, chatId = process.env.TELEGRAM_MAIL_CHAT_ID) {
  const from = (email && email.from) || meta.from || "(tidak diketahui)";
  const to =
    (email && Array.isArray(email.to) && email.to.join(", ")) ||
    (Array.isArray(meta.to) ? meta.to.join(", ") : meta.to) ||
    "";
  const subject = (email && email.subject) || meta.subject || "(tanpa subjek)";
  const when = fmtTime((email && email.created_at) || meta.created_at);
  const body = email
    ? email.text || stripHtml(email.html) || "(isi email kosong)"
    : "(Isi lengkap gagal diambil dari Resend — cek dashboard Resend > Emails > Receiving)";
  const attachments = (email && email.attachments) || meta.attachments || [];
  const attLines = attachments.length
    ? "\n\n📎 Lampiran:\n" +
      attachments
        .map((a) => `- ${a.filename || "file"} (${fmtSize(a.size)})`)
        .join("\n")
    : "";
  const emailId = (email && email.id) || meta.email_id || "";

  const text =
    `📧 Email baru masuk\n` +
    `Dari: ${from}\n` +
    (to ? `Ke: ${to}\n` : "") +
    `Subjek: ${subject}\n` +
    (when ? `Waktu: ${when}\n` : "") +
    `\n${body}${attLines}\n\n— ID email: ${emailId}`;
  await sendTelegramText(text, chatId);

  // Lampiran non-inline dikirim sebagai dokumen Telegram bila URL unduhnya didapat.
  if (email && getAttachmentUrl) {
    for (const att of attachments) {
      if (att.content_disposition === "inline") continue;
      if (att.size && att.size > TG_DOC_LIMIT) continue;
      try {
        const url = await getAttachmentUrl(email.id, att.id);
        if (url) await sendTelegramDocument(url, att.filename || "lampiran", chatId);
      } catch {
        /* lampiran gagal diteruskan tidak boleh menggagalkan notifikasi utama */
      }
    }
  }
}
