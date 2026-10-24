import QRCode from "qrcode";
import { getProduct, createOrder, setOrderFields, getResellerById, getResellerDefaultDiscount, effectiveDiscount } from "../lib/db.js";
import { readJson, bad } from "../lib/http.js";
import { readResellerSession } from "../lib/auth.js";
import { btzCreate, btzConfigured, INVOICE_TIMEOUT_MS } from "../lib/btz.js";

// POST /api/checkout {productId, qty, name, email, phone} — pembeli TAMU, tanpa login.
// Email WAJIB (akun dikirim ke sana); nomor telepon OPSIONAL sebagai cadangan.
// (Kompat lama: bila hanya "contact" yang dikirim dan berupa email, dipakai sebagai email.)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const body = await readJson(req);
  const { productId, qty: qtyRaw, name } = body;
  const legacy = String(body.contact || "").trim();
  const email = String(body.email || (/@/.test(legacy) ? legacy : "")).trim().slice(0, 120);
  const phone = String(body.phone || "").trim().slice(0, 30);
  const p = await getProduct(String(productId || ""));
  if (!p || !p.active) return bad(res, 404, "Produk tidak tersedia");
  const qty = Math.max(1, Math.min(Number(qtyRaw || 1), 10));
  if (p.stock_count < qty) return bad(res, 400, `Stok tidak cukup (sisa ${p.stock_count})`);
  if (!EMAIL_RE.test(email)) return bad(res, 400, "Masukkan alamat email yang benar — akun akan dikirim ke email itu");
  if (!btzConfigured()) return bad(res, 503, "Pembayaran sedang belum aktif. Coba lagi sebentar lagi ya.");
  // Diskon reseller dihitung DI SERVER dari sesi login — harga katalog tidak
  // pernah berubah dan klien tidak bisa mengatur diskonnya sendiri.
  let discount = 0, resellerId = "";
  const rs = readResellerSession(req);
  if (rs) {
    const r = await getResellerById(rs.rid);
    if (r && r.active) { discount = effectiveDiscount(r, await getResellerDefaultDiscount()); resellerId = r.id; }
  }
  const unitPrice = discount > 0 ? Math.floor(p.price * (100 - discount) / 100) : p.price;
  const total = unitPrice * qty;
  const provisional = await createOrder({
    product_id: p.id, product_name: p.name, price: p.price, qty,
    total, buyer_name: String(name || "Pembeli").slice(0, 60),
    contact: email, phone, reseller_id: resellerId, discount_pct: discount,
    txid: "", access_key: "",
  });
  try {
    const data = await btzCreate(provisional.id, total, p.name, provisional.buyer_name, email, phone);
    const finalTotal = Number(data.totalAmount || total);
    const order = await setOrderFields(provisional.id, { txid: data.transactionId || "", access_key: data.accessKey || "", total: finalTotal });
    let qr = "";
    if (data.qrisString) { try { qr = await QRCode.toDataURL(data.qrisString, { margin: 1, width: 360 }); } catch {} }
    res.status(200).json({
      order_id: order.id, total: finalTotal, txid: order.txid,
      qris_image: qr, payment_url: data.paymentUrl || "",
      timeout_ms: INVOICE_TIMEOUT_MS,
      discount_pct: discount, normal_total: p.price * qty, unit_price: unitPrice,
    });
  } catch (e) {
    await setOrderFields(provisional.id, { status: "gagal" });
    return bad(res, 502, "Gagal membuat tagihan. Coba lagi sebentar lagi ya.");
  }
}
