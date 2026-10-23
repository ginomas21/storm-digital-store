import QRCode from "qrcode";
import { getProduct, createOrder, setOrderFields } from "../lib/db.js";
import { readJson, bad } from "../lib/http.js";
import { btzCreate, btzConfigured, INVOICE_TIMEOUT_MS } from "../lib/btz.js";

// POST /api/checkout {productId, qty, name, contact} — pembeli TAMU, tanpa login.
// contact = email ATAU nomor telepon yang bisa dihubungi (catatan pengiriman).
export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const { productId, qty: qtyRaw, name, contact } = await readJson(req);
  const p = await getProduct(String(productId || ""));
  if (!p || !p.active) return bad(res, 404, "Produk tidak tersedia");
  const qty = Math.max(1, Math.min(Number(qtyRaw || 1), 10));
  if (p.stock_count < qty) return bad(res, 400, `Stok tidak cukup (sisa ${p.stock_count})`);
  if (!String(contact || "").trim()) return bad(res, 400, "Isi dulu email atau nomor telepon untuk pengiriman");
  if (!btzConfigured()) return bad(res, 503, "Pembayaran sedang belum aktif. Coba lagi sebentar lagi ya.");
  const provisional = await createOrder({
    product_id: p.id, product_name: p.name, price: p.price, qty,
    total: p.price * qty, buyer_name: String(name || "Pembeli").slice(0, 60),
    contact: String(contact).trim().slice(0, 120), txid: "", access_key: "",
  });
  try {
    const data = await btzCreate(provisional.id, p.price * qty, p.name, provisional.buyer_name, provisional.contact);
    const total = Number(data.totalAmount || p.price * qty);
    const order = await setOrderFields(provisional.id, { txid: data.transactionId || "", access_key: data.accessKey || "", total });
    let qr = "";
    if (data.qrisString) { try { qr = await QRCode.toDataURL(data.qrisString, { margin: 1, width: 360 }); } catch {} }
    res.status(200).json({
      order_id: order.id, total, txid: order.txid,
      qris_image: qr, payment_url: data.paymentUrl || "",
      timeout_ms: INVOICE_TIMEOUT_MS,
    });
  } catch (e) {
    await setOrderFields(provisional.id, { status: "gagal" });
    return bad(res, 502, "Gagal membuat tagihan. Coba lagi sebentar lagi ya.");
  }
}
