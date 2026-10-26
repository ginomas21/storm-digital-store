import QRCode from "qrcode";
import { getProduct, createOrder, setOrderFields, getResellerById, getResellerDefaultDiscount, effectiveDiscount, getUsableVoucher, voucherDiscountFor, normalizeCode } from "../lib/db.js";
import { readJson, bad } from "../lib/http.js";
import { readResellerSession } from "../lib/auth.js";
import { agCreate, agConfigured, INVOICE_TIMEOUT_MS, AG_MAX_AMOUNT } from "../lib/autogopay.js";

// POST /api/checkout {productId, qty, name, email, phone, voucher_code?} — pembeli TAMU, tanpa login.
// Email WAJIB (akun dikirim ke sana); nomor telepon OPSIONAL sebagai cadangan.
// (Kompat lama: bila hanya "contact" yang dikirim dan berupa email, dipakai sebagai email.)
// POST /api/checkout {action: "validate-voucher", productId, qty, voucher_code} —
//   cek kode voucher + hitung potongan (tanpa membuat pesanan).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method tidak diizinkan");
  const body = await readJson(req);
  if (body.action === "validate-voucher") {
    const p = await getProduct(String(body.productId || ""));
    if (!p || !p.active) return bad(res, 404, "Produk tidak tersedia");
    if (readResellerSession(req)) return bad(res, 400, "Kode voucher hanya berlaku untuk pembelian tamu");
    const qty = Math.max(1, Math.min(Number(body.qty || 1), 10));
    const { voucher, error } = await getUsableVoucher(body.voucher_code);
    if (error) return bad(res, 400, error);
    const subtotal = p.price * qty;
    const d = voucherDiscountFor(voucher, subtotal);
    if (d.error) return bad(res, 400, d.error);
    return res.status(200).json({
      valid: true, code: voucher.code, discount_type: voucher.discount_type,
      discount_value: voucher.discount_value, discount_amount: d.discount,
      subtotal, total: subtotal - d.discount,
    });
  }
  const { productId, qty: qtyRaw, name } = body;
  const legacy = String(body.contact || "").trim();
  const email = String(body.email || (/@/.test(legacy) ? legacy : "")).trim().slice(0, 120);
  const phone = String(body.phone || "").trim().slice(0, 30);
  const p = await getProduct(String(productId || ""));
  if (!p || !p.active) return bad(res, 404, "Produk tidak tersedia");
  const qty = Math.max(1, Math.min(Number(qtyRaw || 1), 10));
  if (p.stock_count < qty) return bad(res, 400, `Stok tidak cukup (sisa ${p.stock_count})`);
  if (!EMAIL_RE.test(email)) return bad(res, 400, "Masukkan alamat email yang benar — akun akan dikirim ke email itu");
  if (!agConfigured()) return bad(res, 503, "Pembayaran sedang belum aktif. Coba lagi sebentar lagi ya.");
  // Diskon reseller dihitung DI SERVER dari sesi login — harga katalog tidak
  // pernah berubah dan klien tidak bisa mengatur diskonnya sendiri.
  // Aturan reseller (berlaku untuk SEMUA reseller, langsung aktif):
  //   - minimal pembelian 3 akun per pesanan
  //   - qty > 5 akun dapat bonus diskon +10 poin persen di atas diskon dasar
  let discount = 0, bonus = 0, resellerId = "";
  const rs = readResellerSession(req);
  if (rs) {
    const r = await getResellerById(rs.rid);
    if (r && r.active) {
      resellerId = r.id;
      if (qty < 3) return bad(res, 400, "Reseller minimal pembelian 3 akun per pesanan");
      bonus = qty > 5 ? 10 : 0;
      discount = Math.min(90, effectiveDiscount(r, await getResellerDefaultDiscount()) + bonus);
    }
  }
  const unitPrice = discount > 0 ? Math.floor(p.price * (100 - discount) / 100) : p.price;
  const total = unitPrice * qty;
  // Kode voucher: hanya untuk pembelian tamu (tidak ditumpuk dengan diskon
  // reseller). Divakidasi ulang di server — nilai dari klien tidak dipercaya.
  let voucherCode = "", voucherDiscount = 0;
  const rawVoucher = normalizeCode(body.voucher_code);
  if (rawVoucher) {
    if (resellerId) return bad(res, 400, "Kode voucher hanya berlaku untuk pembelian tamu (reseller sudah dapat diskon reseller)");
    const { voucher, error } = await getUsableVoucher(rawVoucher);
    if (error) return bad(res, 400, error);
    const subtotal = p.price * qty;
    const d = voucherDiscountFor(voucher, subtotal);
    if (d.error) return bad(res, 400, d.error);
    voucherCode = voucher.code; voucherDiscount = d.discount;
  }
  const finalTotalBeforePay = voucherCode ? (p.price * qty - voucherDiscount) : total;
  if (finalTotalBeforePay < 1 || finalTotalBeforePay > AG_MAX_AMOUNT) return bad(res, 400, "Nominal pesanan di luar jangkauan pembayaran QRIS (maks Rp10.000.000) — kurangi jumlah akunnya");
  const provisional = await createOrder({
    product_id: p.id, product_name: p.name, price: p.price, qty,
    total: finalTotalBeforePay, buyer_name: String(name || "Pembeli").slice(0, 60),
    contact: email, phone, reseller_id: resellerId, discount_pct: discount,
    txid: "", access_key: "", voucher_code: voucherCode, voucher_discount: voucherDiscount,
  });
  try {
    const data = await agCreate(provisional.id, finalTotalBeforePay, p.name, provisional.buyer_name, email, phone);
    const finalTotal = Number(data.totalAmount || finalTotalBeforePay);
    const order = await setOrderFields(provisional.id, { txid: data.transactionId || "", access_key: data.accessKey || "", total: finalTotal });
    let qr = "";
    if (data.qrisString) { try { qr = await QRCode.toDataURL(data.qrisString, { margin: 1, width: 360 }); } catch {} }
    res.status(200).json({
      order_id: order.id, total: finalTotal, txid: order.txid,
      qris_image: qr, payment_url: data.paymentUrl || "",
      timeout_ms: INVOICE_TIMEOUT_MS,
      discount_pct: discount, bonus_pct: bonus, normal_total: p.price * qty, unit_price: unitPrice,
      voucher_code: voucherCode, voucher_discount: voucherDiscount,
    });
  } catch (e) {
    await setOrderFields(provisional.id, { status: "gagal" });
    return bad(res, 502, "Gagal membuat tagihan. Coba lagi sebentar lagi ya.");
  }
}
