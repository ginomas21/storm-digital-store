// Pengiriman akun otomatis ke email pembeli.
// Metode A: Resend (RESEND_API_KEY + MAIL_FROM). Metode B: SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS + MAIL_FROM).
// Kalau keduanya kosong: pengiriman tetap tampil di halaman sukses website, email dilewati.
export function mailConfigured() {
  return !!(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}
export async function sendDeliveryEmail(to, order, items) {
  if (!/@/.test(to || "") || !mailConfigured()) return false;
  const list = items.map((it, i) => `${i + 1}. ${it}`).join("\n");
  const subject = `Pesanan ${order.id} lunas — ${order.product_name} | Storm Digital Store`;
  const text = `Pembayaran diterima. Terima kasih sudah belanja di Storm Digital Store!\n\nPesanan: ${order.id}\nProduk: ${order.product_name}\nJumlah: ${order.qty} akun\nTotal: Rp${Number(order.total).toLocaleString("id-ID")}\n\nData akun kamu:\n${list}\n\nSimpan baik-baik data di atas. Kendala? Hubungi owner: @arkasettt (Telegram).`;
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.MAIL_FROM || "Storm Digital Store <onboarding@resend.dev>", to, subject, text }),
      });
      return res.ok;
    }
    const nodemailer = (await import("nodemailer")).default;
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_PORT || "465") === "465",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
    return true;
  } catch { return false; }
}
