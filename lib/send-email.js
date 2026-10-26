// Kirim email keluar lewat Resend, dipakai perintah owner /kirim di @emailwehobot.
// Alamat pengirim tetap orders@akuadalah.dev (domain terverifikasi Resend);
// yang bisa diatur per kiriman adalah NAMA TAMPIL pengirimnya.
// Balasan penerima otomatis kembali ke orders@, yang oleh inbound-email
// sudah diteruskan ke Telegram owner.
export const SEND_FROM_ADDRESS = "orders@akuadalah.dev";
export const DEFAULT_FROM_NAME = "Storm Digital";

// Bersihkan nama tampil dari karakter yang bisa merusak header email.
export function sanitizeFromName(name) {
  return String(name || "")
    .replace(/[<>"\r\n]/g, "")
    .trim()
    .slice(0, 100);
}

export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export async function sendEmail({ to, fromName, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY belum diset di server." };
  const from = `${sanitizeFromName(fromName) || DEFAULT_FROM_NAME} <${SEND_FROM_ADDRESS}>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.message || `Resend menolak (HTTP ${res.status}).` };
    }
    return { ok: true, id: data?.id || null };
  } catch (e) {
    return { ok: false, error: `Gagal menghubungi Resend: ${e?.message || e}` };
  }
}
