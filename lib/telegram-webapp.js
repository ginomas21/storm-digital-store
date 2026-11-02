// Validasi Telegram Mini App initData (server-side, sesuai dokumen Telegram).
// initData adalah query string yang dikirim Telegram WebApp saat Mini App dibuka.
// Setiap pasangan key=value diurutkan alfabetis, digabung dengan "\n", lalu
// di-HMAC-SHA256 dengan kunci = SHA256(token bot). Hasilnya harus sama dengan
// field "hash" di initData. Tanpa ini, chat_id dari klien TIDAK boleh dipercaya:
// siapa pun bisa mengirim chat_id orang lain dan menerima notifikasi akunnya.
// Token bot TIDAK PERNAH dikirim ke klien — hanya dibaca dari env server.
import crypto from "node:crypto";

export function validateInitData(initData, botToken) {
  if (!initData || typeof initData !== "string") return { ok: false, error: "initData kosong" };
  if (!botToken) return { ok: false, error: "Token bot belum dikonfigurasi di server" };
  let params;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, error: "initData tidak valid" };
  }
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "initData tanpa hash" };
  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k === "hash") continue;
    pairs.push([k, v]);
  }
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const checkString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHash("sha256").update(botToken, "utf8").digest();
  const computed = crypto.createHmac("sha256", secret).update(checkString, "utf8").digest("hex");
  let match = false;
  try {
    match = crypto.timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(hash, "utf8"));
  } catch {
    match = false;
  }
  if (!match) return { ok: false, error: "Tanda tangan initData tidak cocok" };
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) {
    return { ok: false, error: "initData sudah kedaluwarsa — tutup dan buka lagi Mini App-nya" };
  }
  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    return { ok: false, error: "Data user Telegram tidak valid" };
  }
  if (!user || !user.id) return { ok: false, error: "Data user Telegram tidak ditemukan" };
  return { ok: true, user };
}
