// BTZ PayGate — pola persis bot Telegram Ark Digital Store (bot.py):
// POST /api/qris/create, GET /api/qris/transaction/{id}?key=accessKey, POST /api/qris/cancel/{id}
const BTZ_BASE = "https://web.btzpay.my.id";
export const INVOICE_TIMEOUT_MS = 600_000; // 10 menit, sama seperti bot

function key() {
  return process.env.BTZ_API_KEY || "";
}
export function btzConfigured() {
  return !!key();
}

async function btzReq(method, path, body) {
  const res = await fetch(BTZ_BASE + path, {
    method,
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 StormDigitalStore/2.0" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`BTZ respon tidak valid (${res.status})`); }
}

export async function btzCreate(orderId, amount, productName, buyerName, contact) {
  const isEmail = /@/.test(contact || "");
  const res = await btzReq("POST", "/api/qris/create", {
    apikey: key(),
    amount,
    fee: 0,
    notes: `Order ${orderId} - ${productName}`,
    timeout: INVOICE_TIMEOUT_MS,
    customerInfo: { name: buyerName || "Pembeli", email: isEmail ? contact : "", phone: isEmail ? "" : (contact || "") },
    metadata: { orderId, productName },
  });
  return res.data || {};
}

export async function btzStatus(txid, accessKey) {
  const res = await btzReq("GET", `/api/qris/transaction/${txid}?key=${encodeURIComponent(accessKey)}`);
  const data = res.data || res;
  return String(data.status || "").toLowerCase();
}

export async function btzCancel(txid) {
  try { await btzReq("POST", `/api/qris/cancel/${txid}`, { apikey: key(), reason: "dibatalkan pembeli" }); } catch {}
}
