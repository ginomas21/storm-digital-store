import { getOrder, setOrderFields, finalizePaid, getCryptoInvoice, setCryptoInvoiceTx, setCryptoInvoiceStatus } from "../lib/db.js";
import { readJson, bad } from "../lib/http.js";
import { agStatus, agCancel } from "../lib/autogopay.js";
import { sendDeliveryEmail } from "../lib/mail.js";
import { cryptoConfigured, cryptoAddress, findUsdtTransfer, getTxTransferTo, amountToUnits } from "../lib/crypto.js";

// GET /api/order-status?id=SDS-0001&contact=xxx — halaman pembayaran polling ke sini
// tiap 5 detik (bot: 10 detik). Saat pembayaran terkonfirmasi (AutoGoPay bilang
// sukses, atau transfer USDT BEP20 dengan nominal unik ditemukan di blockchain):
// stok dikunci, akun dikirim (tampil di halaman + email bila contact berupa email).
// POST /api/order-status {id, contact, action:"cancel"} — batalkan pesanan
// (dulu endpoint /api/order-cancel sendiri; digabung ke sini agar jumlah
// Serverless Function tetap di bawah batas 12 paket Hobby Vercel).
// POST /api/order-status {id, contact, action:"verify-tx", txhash} — pembeli
// USDT menempel hash transaksinya (jalur cadangan bila nominal meleset karena
// fee exchange): transfer ke alamat toko di transaksi itu diverifikasi, dan
// pesanan dilunasi bila jumlah yang sampai >= nominal dasar tagihan.

// Langkah sesudah lunas yang dipakai semua jalur pembayaran: kunci stok,
// kirim email pengiriman, dan kirim akun lewat bot DN untuk order Mini App.
async function settlePaid(o) {
  let out = await finalizePaid(o.id);
  if (out && out.delivered && !out.email_sent) {
    const sent = await sendDeliveryEmail(out.contact, out, out.delivered.split("\n"));
    if (sent) { await setOrderFields(out.id, { email_sent: true }); out.email_sent = true; }
  }
  // Mini App: kirim akun juga lewat bot DN ke chat ID yang SUDAH
  // terverifikasi saat checkout (bukan dari klien). Sekali saja
  // (telegram_notified), dan kegagalan kirim tidak menggagalkan order —
  // akun tetap tampil di Mini App.
  if (out && out.delivered && out.telegram_chat_id && !out.telegram_notified && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const msg = `🎉 Pembayaran diterima!\nPesanan ${out.id} — ${out.product_name} (${out.qty} akun)\n\n${out.delivered}\n\nAkun juga tampil di Mini App. Simpan baik-baik ya.`;
      const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: out.telegram_chat_id, text: msg }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) { await setOrderFields(out.id, { telegram_notified: true }); out.telegram_notified = true; }
    } catch { /* kirim ulang tidak dipaksakan; akun tetap di Mini App */ }
  }
  return out;
}

function statusJson(res, o) {
  const body = {
    id: o.id, status: o.status, product_name: o.product_name, qty: o.qty, total: o.total,
    pay_method: o.pay_method || "qris",
    delivered: o.status.startsWith("sukses") ? o.delivered : "",
    email_sent: !!o.email_sent,
  };
  if (o.pay_method === "usdt") body.crypto = { address: cryptoAddress(), amount: o.crypto_amount || "" };
  return res.status(200).json(body);
}

function contactMatches(o, contact) {
  const c = String(contact || "").trim().toLowerCase();
  return (c && c === String(o.contact).toLowerCase()) || (c && o.phone && c === String(o.phone).toLowerCase());
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = await readJson(req);
    if (body.action === "cancel") {
      const o = await getOrder(String(body.id || ""));
      if (!o) return bad(res, 404, "Pesanan tidak ditemukan");
      if (!contactMatches(o, body.contact)) return bad(res, 403, "Kontak tidak cocok");
      if (o.status !== "pending") return bad(res, 400, "Pesanan sudah tidak bisa dibatalkan");
      if (o.txid) agCancel(o.txid);
      if (o.pay_method === "usdt") { try { await setCryptoInvoiceStatus(o.id, "cancelled"); } catch {} }
      await setOrderFields(o.id, { status: "dibatalkan" });
      return res.status(200).json({ ok: true });
    }
    if (body.action === "verify-tx") {
      const o = await getOrder(String(body.id || ""));
      if (!o) return bad(res, 404, "Pesanan tidak ditemukan");
      if (!contactMatches(o, body.contact)) return bad(res, 403, "Kontak tidak cocok");
      if (o.status !== "pending") return bad(res, 400, "Pesanan sudah tidak menunggu pembayaran");
      if (o.pay_method !== "usdt") return bad(res, 400, "Pesanan ini bukan pembayaran USDT");
      if (!cryptoConfigured()) return bad(res, 503, "Pembayaran USDT belum aktif");
      const txhash = String(body.txhash || "").trim();
      if (!/^0x[0-9a-fA-F]{64}$/.test(txhash)) return bad(res, 400, "Hash transaksi tidak valid (harus diawali 0x dan 66 karakter)");
      const inv = await getCryptoInvoice(o.id);
      if (!inv) return bad(res, 404, "Tagihan USDT tidak ditemukan");
      let t = null;
      try { t = await getTxTransferTo(txhash, cryptoAddress()); } catch { /* RPC gagal: pesan umum di bawah */ }
      if (!t) return bad(res, 400, "Transfer USDT ke alamat toko tidak ditemukan di transaksi itu. Pastikan jaringannya BNB Smart Chain (BEP20) dan hash-nya benar.");
      if (BigInt(t.amountUnits) < BigInt(amountToUnits(inv.base_amount)))
        return bad(res, 400, "Jumlah USDT yang sampai kurang dari tagihan dasar (kemungkinan kepotong fee exchange). Hubungi admin dan kirim hash ini untuk dibantu manual.");
      await setCryptoInvoiceTx(o.id, txhash);
      await setOrderFields(o.id, { crypto_txhash: txhash });
      const out = await settlePaid(o);
      return statusJson(res, out || o);
    }
    return bad(res, 405, "Method tidak diizinkan");
  }
  const id = String(req.query.id || "");
  const contact = String(req.query.contact || "").trim();
  const order = await getOrder(id);
  if (!order) return bad(res, 404, "Pesanan tidak ditemukan");
  if (!contactMatches(order, contact))
    return bad(res, 403, "Kontak tidak cocok dengan pesanan ini");
  let o = order;
  if (o.status === "pending" && o.pay_method === "usdt") {
    try {
      if (!cryptoConfigured()) throw new Error("crypto belum aktif");
      const inv = await getCryptoInvoice(o.id);
      if (inv && inv.txhash) {
        o = await settlePaid(o);
      } else if (inv && inv.status === "pending") {
        const hit = await findUsdtTransfer(cryptoAddress(), Number(inv.from_block || 0), amountToUnits(inv.amount));
        if (hit) {
          await setCryptoInvoiceTx(o.id, hit.txhash);
          await setOrderFields(o.id, { crypto_txhash: hit.txhash });
          o = await settlePaid(o);
        } else if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
          await setCryptoInvoiceStatus(o.id, "expired");
          o = await setOrderFields(o.id, { status: "expired" });
        }
      }
    } catch { /* RPC sesekali gagal: biarkan pending, polling berikutnya coba lagi */ }
  } else if (o.status === "pending" && o.txid) {
    try {
      const st = await agStatus(o.txid);
      if (st === "sukses") {
        o = await settlePaid(o);
      } else if (st && st !== "pending") {
        o = await setOrderFields(o.id, { status: st });
      }
    } catch { /* AutoGoPay sesekali gagal: biarkan pending, polling berikutnya coba lagi */ }
  }
  return statusJson(res, o);
}
