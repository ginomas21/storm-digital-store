// Temp-mail @akuadalah.dev: klaim alamat oleh pengguna Telegram, kedaluwarsa 7 hari.
// Produksi: PostgreSQL (DATABASE_URL yang sama dengan toko). Tanpa DATABASE_URL:
// mode in-memory (buat tes lokal; data reset tiap proses mati).
const HAS_DB = !!process.env.DATABASE_URL;
export const DOMAIN = "akuadalah.dev";
export const EXPIRY_DAYS = 7;
export const MAX_PER_USER = 3;

export const RESERVED = new Set([
  "orders", "order", "admin", "administrator", "postmaster", "support", "help",
  "info", "noreply", "no-reply", "mail", "email", "root", "owner", "cs",
  "halo", "hello", "storm", "ark", "arka", "billing", "payment", "shop",
  "store", "toko", "webmaster", "abuse", "security", "hostmaster",
]);

let pool = null;
async function db() {
  if (!pool) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? undefined : { rejectUnauthorized: false },
      max: 2,
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS temp_addresses(
        local TEXT PRIMARY KEY, chat_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL);
      CREATE TABLE IF NOT EXISTS temp_state(
        chat_id BIGINT PRIMARY KEY, mode TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS temp_users(
        chat_id BIGINT PRIMARY KEY, username TEXT NOT NULL DEFAULT '',
        first_name TEXT NOT NULL DEFAULT '', first_seen TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS temp_broadcasts(
        chat_id BIGINT PRIMARY KEY, text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    `);
  }
  return pool;
}

// ---------------- mode in-memory (tes lokal) ----------------
const mem = { addr: new Map(), state: new Map(), users: new Map(), broadcasts: new Map() };
export const _mem = mem; // diekspor hanya agar tes bisa menyiapkan skenario kedaluwarsa

// ---------------- validasi & nama acak (murni, bisa dites) ----------------
export function validateLocal(raw) {
  const local = String(raw || "").trim().toLowerCase().replace(/@.*$/, "");
  if (local.length < 3 || local.length > 30)
    return { ok: false, error: "Nama harus 3–30 karakter." };
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(local) && !/^[a-z0-9]{3,30}$/.test(local))
    return { ok: false, error: "Nama hanya boleh huruf kecil, angka, titik, - dan _; mulai & akhiri dengan huruf/angka." };
  if (/\.\.|--/.test(local))
    return { ok: false, error: "Hindari titik/garis ganda berturut-turut." };
  if (RESERVED.has(local))
    return { ok: false, error: "Nama itu dicadangkan untuk pemilik layanan, pilih nama lain ya." };
  return { ok: true, local };
}

const WORDS = ["awan", "bintang", "cahya", "danau", "elang", "fajar", "gemilang", "hujan", "indah", "jaya", "kencana", "langit", "mentari", "nuansa", "ombak", "pelangi", "rindu", "senja", "terang", "utara", "wangi", "yudha", "zora", "bima", "citra", "dewi", "eka", "galih", "hasta"];
export function randomLocal() {
  const w = WORDS[Math.floor(Math.random() * WORDS.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}`;
}

// ---------------- penyimpanan ----------------
const now = () => new Date();
const expiryFrom = (d) => new Date(d.getTime() + EXPIRY_DAYS * 24 * 3600 * 1000);

export async function getAddress(local) {
  if (!HAS_DB) return mem.addr.get(local) || null;
  const p = await db();
  const r = await p.query(`SELECT local, chat_id, created_at, expires_at FROM temp_addresses WHERE local=$1`, [local]);
  return r.rows[0] || null;
}

// Klaim alamat. Balik {ok, address} atau {ok:false, error}.
export async function claimAddress(chatId, local, isOwner = false) {
  const existing = await getAddress(local);
  const t = now();
  if (existing && new Date(existing.expires_at) > t && String(existing.chat_id) !== String(chatId))
    return { ok: false, error: "Nama itu sudah dipakai orang lain. Coba nama lain." };
  if (!isOwner) {
    const mine = await listForChat(chatId);
    const active = mine.filter((a) => new Date(a.expires_at) > t && a.local !== local);
    if (active.length >= MAX_PER_USER)
      return { ok: false, error: `Kamu sudah punya ${MAX_PER_USER} alamat aktif (batas maksimal). Hapus dulu salah satu lewat menu Alamat Saya.` };
  }
  const row = { local, chat_id: chatId, created_at: t.toISOString(), expires_at: expiryFrom(t).toISOString() };
  if (!HAS_DB) { mem.addr.set(local, row); return { ok: true, address: row }; }
  const p = await db();
  await p.query(
    `INSERT INTO temp_addresses(local, chat_id, expires_at) VALUES($1,$2,$3)
     ON CONFLICT(local) DO UPDATE SET chat_id=EXCLUDED.chat_id, created_at=now(), expires_at=EXCLUDED.expires_at`,
    [local, chatId, row.expires_at]
  );
  return { ok: true, address: await getAddress(local) };
}

export async function listForChat(chatId) {
  if (!HAS_DB) return [...mem.addr.values()].filter((a) => String(a.chat_id) === String(chatId));
  const p = await db();
  const r = await p.query(
    `SELECT local, chat_id, created_at, expires_at FROM temp_addresses WHERE chat_id=$1 ORDER BY created_at`,
    [chatId]
  );
  return r.rows;
}

export async function deleteForChat(chatId, local) {
  if (!HAS_DB) {
    const a = mem.addr.get(local);
    if (a && String(a.chat_id) === String(chatId)) { mem.addr.delete(local); return true; }
    return false;
  }
  const p = await db();
  const r = await p.query(`DELETE FROM temp_addresses WHERE local=$1 AND chat_id=$2`, [local, chatId]);
  return r.rowCount > 0;
}

// Keputusan routing email masuk: {kind:'user', chatId} | {kind:'expired'} | {kind:'unclaimed'}
export async function resolveRecipient(local) {
  const a = await getAddress(local);
  if (!a) return { kind: "unclaimed" };
  if (new Date(a.expires_at) <= now()) return { kind: "expired" };
  return { kind: "user", chatId: a.chat_id };
}

export async function setState(chatId, mode) {
  if (!HAS_DB) { mem.state.set(String(chatId), { mode, updated_at: Date.now() }); return; }
  const p = await db();
  await p.query(
    `INSERT INTO temp_state(chat_id, mode, updated_at) VALUES($1,$2,now())
     ON CONFLICT(chat_id) DO UPDATE SET mode=EXCLUDED.mode, updated_at=now()`,
    [chatId, mode]
  );
}

export async function getState(chatId) {
  let s = null;
  if (!HAS_DB) s = mem.state.get(String(chatId)) || null;
  else {
    const p = await db();
    const r = await p.query(`SELECT mode, updated_at FROM temp_state WHERE chat_id=$1`, [chatId]);
    s = r.rows[0] || null;
    if (s) s = { mode: s.mode, updated_at: new Date(s.updated_at).getTime() };
  }
  if (!s) return null;
  if (Date.now() - s.updated_at > 10 * 60 * 1000) return null; // state basi >10 menit
  return s.mode;
}

export async function clearState(chatId) {
  if (!HAS_DB) { mem.state.delete(String(chatId)); return; }
  const p = await db();
  await p.query(`DELETE FROM temp_state WHERE chat_id=$1`, [chatId]);
}

// Catat pengguna bot. Balik true bila ini pertama kalinya ia terlihat
// (dipakai untuk notifikasi owner satu kali per pengguna baru).
export async function registerUser(chatId, username = "", firstName = "") {
  if (!HAS_DB) {
    const k = String(chatId);
    if (mem.users.has(k)) return false;
    mem.users.set(k, { chat_id: chatId, username, first_name: firstName });
    return true;
  }
  const p = await db();
  const r = await p.query(
    `INSERT INTO temp_users(chat_id, username, first_name) VALUES($1,$2,$3)
     ON CONFLICT(chat_id) DO NOTHING RETURNING chat_id`,
    [chatId, username || "", firstName || ""]
  );
  return r.rowCount > 0;
}

// Samarkan nama alamat untuk notifikasi owner: tampilkan 2 huruf awal +
// 1 huruf akhir saja, mis. "budi.santai" -> "bu***i", "aku" -> "a***".
export function maskLocal(local) {
  const s = String(local || "");
  if (s.length <= 3) return s.slice(0, 1) + "***";
  return s.slice(0, 2) + "***" + s.slice(-1);
}

// Daftar pengguna bot (yang pernah /start) beserta alamat-alamat mereka.
// Dipakai perintah owner /users. Alamat dikembalikan apa adanya di sini;
// penyamaran dilakukan di lapisan tampilan (telegram-bot.js).
export async function listUsers() {
  if (!HAS_DB) {
    return [...mem.users.values()].map((u) => ({
      ...u,
      addresses: [...mem.addr.values()].filter((a) => String(a.chat_id) === String(u.chat_id)),
    }));
  }
  const p = await db();
  const users = await p.query(
    `SELECT chat_id, username, first_name, first_seen FROM temp_users ORDER BY first_seen`
  );
  const addrs = await p.query(
    `SELECT local, chat_id, expires_at FROM temp_addresses ORDER BY created_at`
  );
  const byChat = new Map();
  for (const a of addrs.rows) {
    if (!byChat.has(String(a.chat_id))) byChat.set(String(a.chat_id), []);
    byChat.get(String(a.chat_id)).push(a);
  }
  return users.rows.map((u) => ({ ...u, addresses: byChat.get(String(u.chat_id)) || [] }));
}

// Draf broadcast owner yang menunggu konfirmasi (satu draf per owner).
export async function savePendingBroadcast(chatId, text) {
  if (!HAS_DB) { mem.broadcasts.set(String(chatId), text); return; }
  const p = await db();
  await p.query(
    `INSERT INTO temp_broadcasts(chat_id, text) VALUES($1,$2)
     ON CONFLICT(chat_id) DO UPDATE SET text=EXCLUDED.text, created_at=now()`,
    [chatId, text]
  );
}

export async function getPendingBroadcast(chatId) {
  if (!HAS_DB) return mem.broadcasts.get(String(chatId)) || null;
  const p = await db();
  const r = await p.query(`SELECT text FROM temp_broadcasts WHERE chat_id=$1`, [chatId]);
  return r.rows[0]?.text || null;
}

export async function clearPendingBroadcast(chatId) {
  if (!HAS_DB) { mem.broadcasts.delete(String(chatId)); return; }
  const p = await db();
  await p.query(`DELETE FROM temp_broadcasts WHERE chat_id=$1`, [chatId]);
}
