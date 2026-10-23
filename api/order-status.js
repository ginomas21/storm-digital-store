import { getOrder, setOrderFields, finalizePaid } from "../lib/db.js";
import { bad } from "../lib/http.js";
import { btzStatus } from "../lib/btz.js";
import { sendDeliveryEmail } from "../lib/mail.js";

// GET /api/order-status?id=SDS-0001&contact=xxx — halaman pembayaran polling ke sini
// tiap 5 detik (bot: 10 detik). Saat BTZ bilang sukses: stok dikunci, akun
// dikirim (tampil di halaman + email bila contact berupa email & email aktif).
export default async function handler(req, res) {
  const id = String(req.query.id || "");
  const contact = String(req.query.contact || "").trim();
  const order = await getOrder(id);
  if (!order) return bad(res, 404, "Pesanan tidak ditemukan");
  if (!contact || contact.toLowerCase() !== String(order.contact).toLowerCase())
    return bad(res, 403, "Kontak tidak cocok dengan pesanan ini");
  let o = order;
  if (o.status === "pending" && o.txid) {
    try {
      const st = await btzStatus(o.txid, o.access_key);
      if (st === "sukses") {
        o = await finalizePaid(o.id);
        if (o && o.delivered && !o.email_sent) {
          const sent = await sendDeliveryEmail(o.contact, o, o.delivered.split("\n"));
          if (sent) { await setOrderFields(o.id, { email_sent: true }); o.email_sent = true; }
        }
      } else if (st && st !== "pending") {
        o = await setOrderFields(o.id, { status: st });
      }
    } catch { /* BTZ sesekali gagal: biarkan pending, polling berikutnya coba lagi */ }
  }
  res.status(200).json({
    id: o.id, status: o.status, product_name: o.product_name, qty: o.qty, total: o.total,
    delivered: o.status.startsWith("sukses") ? o.delivered : "",
    email_sent: !!o.email_sent,
  });
}
