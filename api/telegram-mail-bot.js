import { handleUpdate } from "../lib/telegram-bot.js";

// POST /api/telegram-mail-bot — webhook Telegram untuk bot temp-mail.
// Telegram mendaftarkan URL ini lewat setWebhook; update hanya diterima dari
// rentang IP resmi server Telegram (149.154.160.0/20, 91.108.4.0/22) —
// x-forwarded-for diisi platform Vercel sehingga tidak bisa dipalsukan klien.
export const config = { api: { bodyParser: false } };

const TG_CIDRS = ["149.154.160.0/20", "91.108.4.0/22"];

function ipInCidr(ip, cidr) {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const toInt = (s) => s.split(".").reduce((acc, o) => acc * 256 + Number(o), 0);
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(ip || "")) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

export function isTelegramIp(ip) {
  return TG_CIDRS.some((c) => ipInCidr(ip, c));
}

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const xff = String(req.headers["x-forwarded-for"] || "");
  const ip = xff.split(",")[0].trim();
  if (ip && !isTelegramIp(ip)) return res.status(403).json({ error: "bukan server Telegram" });
  let update;
  try {
    update = JSON.parse(await readRaw(req));
  } catch {
    return res.status(400).json({ error: "Body bukan JSON valid" });
  }
  try {
    await handleUpdate(update);
  } catch (e) {
    console.error("telegram-mail-bot handler gagal:", e.message);
  }
  return res.status(200).json({ ok: true });
}
