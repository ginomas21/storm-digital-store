// Pembayaran crypto USDT di jaringan BNB Smart Chain (BEP20) — ditambahkan
// 2026-11-17 atas perintah Daniel, berdampingan dengan QRIS AutoGoPay.
// Pola deteksi meniru AutoGoPay: buat tagihan -> polling -> cocok -> settle.
// Bedanya tidak ada gateway: transfer dipantau langsung di blockchain lewat
// node RPC publik BSC (eth_getLogs untuk event Transfer token USDT).
//
// Alamat dompet TUJUAN dari env USDT_BEP20_ADDRESS (diisi Daniel di dashboard
// Vercel — hanya alamat PUBLIK 0x..., BUKAN seed/private key; file ini tidak
// pernah membutuhkan kunci privat karena toko hanya MENERIMA transfer).
// Tanpa env itu, cryptoConfigured() = false dan opsi USDT disembunyikan UI.
export const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955"; // USDT BEP20, 18 desimal
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const RPC_ENDPOINTS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc.publicnode.com",
  "https://bsc-dataseed1.defibit.io",
];
export const CRYPTO_MIN_TOTAL_IDR = 10000;

export function cryptoAddress() {
  const a = String(process.env.USDT_BEP20_ADDRESS || "").trim();
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? a : "";
}
export function cryptoConfigured() {
  return !!cryptoAddress();
}

// ---------- kurs USDT/IDR (Indodax utama, CoinGecko cadangan), cache 30 dtk
let rateCache = { rate: 0, at: 0 };
export async function getUsdtRateIdr() {
  if (rateCache.rate > 0 && Date.now() - rateCache.at < 30000) return rateCache.rate;
  try {
    const r = await fetch("https://indodax.com/api/ticker/usdtidr", { signal: AbortSignal.timeout(12000) });
    const j = await r.json();
    const last = Number(j && j.ticker && j.ticker.last);
    if (last > 5000 && last < 100000) { rateCache = { rate: Math.round(last), at: Date.now() }; return rateCache.rate; }
    throw new Error("kurs Indodax tidak wajar");
  } catch (e) {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr", { signal: AbortSignal.timeout(12000) });
    const j = await r.json();
    const last = Number(j && j.tether && j.tether.idr);
    if (!(last > 5000 && last < 100000)) throw new Error("kurs USDT/IDR tidak tersedia");
    rateCache = { rate: Math.round(last), at: Date.now() };
    return rateCache.rate;
  }
}

// Nominal dasar: total IDR -> USDT dibulatkan KE ATAS ke 4 desimal, supaya
// gerak kurs kecil tidak membuat toko kurang terima. String "X.XXXX".
export function usdtBaseAmount(totalIdr, rate) {
  const base4 = Math.ceil((Number(totalIdr) * 10000) / Number(rate) - 1e-9);
  return Math.floor(base4 / 10000) + "." + String(base4 % 10000).padStart(4, "0");
}
// Nominal unik: dasar + kode 01..99 di desimal ke-5..6 -> "X.XXXXNN".
// Kode unik inilah yang dicocokkan persis dengan transfer yang masuk.
export function usdtUniqueAmount(base, suffix) {
  const [w, f] = String(base).split(".");
  const base6 = Number(w) * 1000000 + Number((f || "0").padEnd(4, "0")) * 100;
  const amt6 = base6 + Math.max(1, Math.min(99, Number(suffix) || 1));
  return Math.floor(amt6 / 1000000) + "." + String(amt6 % 1000000).padStart(6, "0");
}
// "4.123456" -> unit terkecil USDT (18 desimal) sebagai string BigInt-safe.
export function amountToUnits(amountStr) {
  const [w, f = ""] = String(amountStr).split(".");
  const frac = (f + "0".repeat(18)).slice(0, 18);
  return (BigInt(w || "0") * 10n ** 18n + BigInt(frac || "0")).toString();
}

// ---------- JSON-RPC BSC (coba endpoint satu per satu)
async function rpc(method, params) {
  let lastErr = null;
  for (const url of RPC_ENDPOINTS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(12000),
      });
      const j = await r.json();
      if (j && j.result !== undefined) return j.result;
      lastErr = new Error("RPC " + method + ": " + JSON.stringify((j && j.error) || j).slice(0, 160));
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("RPC gagal");
}

export async function getBlockNumber() {
  const hex = await rpc("eth_blockNumber", []);
  return Number(BigInt(hex));
}

const topicAddr = (addr) => "0x" + "0".repeat(24) + String(addr).toLowerCase().replace(/^0x/, "");

// Cari SATU transfer USDT masuk ke `toAddress` sejak fromBlock yang jumlahnya
// PERSIS amountUnits (nominal unik). Mengembalikan {txhash, blockNumber} / null.
export async function findUsdtTransfer(toAddress, fromBlock, amountUnits) {
  const latest = await getBlockNumber();
  let from = Number(fromBlock) || 0;
  if (!from || latest - from > 4500) from = Math.max(0, latest - 4500);
  const logs = await rpc("eth_getLogs", [{
    address: USDT_CONTRACT,
    topics: [TRANSFER_TOPIC, null, topicAddr(toAddress)],
    fromBlock: "0x" + from.toString(16),
    toBlock: "latest",
  }]);
  const want = BigInt(amountUnits);
  for (const log of logs || []) {
    try {
      if (BigInt(log.data) === want) {
        return { txhash: log.transactionHash, blockNumber: Number(BigInt(log.blockNumber)) };
      }
    } catch { /* abaikan log aneh */ }
  }
  return null;
}

// Ambil transfer USDT ke `toAddress` di dalam SATU transaksi (jalur verifikasi
// hash yang ditempel pembeli). Mengembalikan {amountUnits} / null.
export async function getTxTransferTo(txhash, toAddress) {
  const receipt = await rpc("eth_getTransactionReceipt", [txhash]);
  if (!receipt || !receipt.logs) return null;
  const toTopic = topicAddr(toAddress);
  for (const log of receipt.logs) {
    if (
      String(log.address).toLowerCase() === USDT_CONTRACT &&
      log.topics && log.topics[0] === TRANSFER_TOPIC &&
      String(log.topics[2] || "").toLowerCase() === toTopic
    ) {
      return { amountUnits: BigInt(log.data).toString(), blockNumber: Number(BigInt(log.blockNumber)) };
    }
  }
  return null;
}
