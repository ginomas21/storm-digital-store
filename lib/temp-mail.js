// Temp-mail @pengagumku.id: klaim alamat oleh pengguna Telegram, kedaluwarsa 7 hari.
// Versi web (temp.pengagumku.id): alamat diklaim lewat website dengan kode
// kredensial (bukan akun Telegram); email yang masuk OTOMATIS TERSIMPAN di
// temp_messages dan bisa dibaca + diaktifkan ulang dengan kode itu.
// Produksi: PostgreSQL (DATABASE_URL yang sama dengan toko). Tanpa DATABASE_URL:
// mode in-memory (buat tes lokal; data reset tiap proses mati).
import crypto from "node:crypto";
import { hashPassword, verifyPassword } from "./auth.js";
import { stripHtml } from "./telegram-mail.js";

const HAS_DB = !!process.env.DATABASE_URL;
export const DOMAIN = "pengagumku.id";
export const EXPIRY_DAYS = 7;
export const MAX_PER_USER = 3;

// --- web ---
export const WEB_RETENTION_DAYS = 30; // setelah kedaluwarsa, alamat + inbox
// masih bisa diaktifkan ulang selama 30 hari; sesudah itu dihapus permanen.
export const MAX_WEB_PER_IP = 5; // alamat web aktif per IP
export const MAX_WEB_CREATE_PER_DAY = 5; // alamat web baru per IP per 24 jam
export const MAX_MESSAGES_PER_ADDRESS = 50; // pesan tersimpan per alamat
export const MAX_BODY_CHARS = 200_000; // batas isi email yang disimpan
export const MAX_ATTACHMENT_BYTES = 1024 * 1024; // 1 MB per lampiran tersimpan
export const MAX_ATTACHMENTS_TOTAL = 2 * 1024 * 1024; // 2 MB per email
export const WEB_CHAT_ID = 0; // penanda baris alamat web di temp_addresses
// (chat_id Telegram asli selalu > 0, jadi 0 tidak pernah bentrok).

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
      CREATE TABLE IF NOT EXISTS temp_send_drafts(
        chat_id BIGINT PRIMARY KEY, to_email TEXT NOT NULL DEFAULT '',
        from_name TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      -- Kolom versi web (idempotent; tabel lama tidak punya kolom ini).
      ALTER TABLE temp_addresses ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'bot';
      ALTER TABLE temp_addresses ADD COLUMN IF NOT EXISTS credential_hash TEXT;
      ALTER TABLE temp_addresses ADD COLUMN IF NOT EXISTS created_ip TEXT;
      -- Inbox web: email masuk yang tersimpan otomatis (hanya alamat web).
      CREATE TABLE IF NOT EXISTS temp_messages(
        id SERIAL PRIMARY KEY, local TEXT NOT NULL REFERENCES temp_addresses(local) ON DELETE CASCADE,
        from_addr TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '',
        text_body TEXT NOT NULL DEFAULT '', html_body TEXT NOT NULL DEFAULT '',
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb);
      CREATE INDEX IF NOT EXISTS temp_messages_local_idx ON temp_messages(local, received_at DESC);
      -- Lampiran kecil yang ikut disimpan (base64), supaya bisa diunduh dari web.
      CREATE TABLE IF NOT EXISTS temp_attachments(
        id SERIAL PRIMARY KEY, message_id INT NOT NULL REFERENCES temp_messages(id) ON DELETE CASCADE,
        filename TEXT NOT NULL DEFAULT 'lampiran',
        content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
        size INT NOT NULL DEFAULT 0, data TEXT NOT NULL DEFAULT '');
      CREATE INDEX IF NOT EXISTS temp_attachments_msg_idx ON temp_attachments(message_id);
    `);
  }
  return pool;
}

// ---------------- mode in-memory (tes lokal) ----------------
const mem = { addr: new Map(), state: new Map(), users: new Map(), broadcasts: new Map(), sendDrafts: new Map(), messages: new Map(), attachments: new Map() };
let memMsgSeq = 1, memAttSeq = 1;
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
  const r = await p.query(`SELECT local, chat_id, created_at, expires_at, source, credential_hash, created_ip FROM temp_addresses WHERE local=$1`, [local]);
  return r.rows[0] || null;
}

// True bila alamat web sudah lewat masa simpan (kedaluwarsa + retensi).
// Nama seperti ini bebas diklaim ulang siapa pun — data lamanya sudah dihapus.
export function pastRetention(row) {
  if (!row) return true;
  return new Date(row.expires_at).getTime() + WEB_RETENTION_DAYS * 24 * 3600 * 1000 <= Date.now();
}

// Klaim alamat. Balik {ok, address} atau {ok:false, error}.
export async function claimAddress(chatId, local, isOwner = false) {
  const existing = await getAddress(local);
  const t = now();
  if (existing && new Date(existing.expires_at) > t && String(existing.chat_id) !== String(chatId))
    return { ok: false, error: "Nama itu sudah dipakai orang lain. Coba nama lain." };
  // Alamat web yang kedaluwarsa tapi masih dalam masa simpan tidak boleh
  // direbut bot — pemilik web masih bisa mengaktifkannya ulang dengan kode.
  if (existing && existing.source === "web" && !pastRetention(existing))
    return { ok: false, error: "Nama itu masih dalam masa simpan pemilik sebelumnya. Coba nama lain." };
  if (!isOwner) {
    const mine = await listForChat(chatId);
    const active = mine.filter((a) => new Date(a.expires_at) > t && a.local !== local);
    if (active.length >= MAX_PER_USER)
      return { ok: false, error: `Kamu sudah punya ${MAX_PER_USER} alamat aktif (batas maksimal). Hapus dulu salah satu lewat menu Alamat Saya.` };
  }
  const row = { local, chat_id: chatId, created_at: t.toISOString(), expires_at: expiryFrom(t).toISOString() };
  if (existing?.source === "web") await deleteWebMessages(local); // lewat retensi: bersihkan inbox lama
  if (!HAS_DB) { mem.addr.set(local, { ...row, source: "bot", credential_hash: null, created_ip: null }); return { ok: true, address: row }; }
  const p = await db();
  await p.query(
    `INSERT INTO temp_addresses(local, chat_id, expires_at) VALUES($1,$2,$3)
     ON CONFLICT(local) DO UPDATE SET chat_id=EXCLUDED.chat_id, created_at=now(), expires_at=EXCLUDED.expires_at,
       source='bot', credential_hash=NULL, created_ip=NULL`,
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

// Keputusan routing email masuk: {kind:'user', chatId} | {kind:'web', local} |
// {kind:'expired'} | {kind:'unclaimed'}
export async function resolveRecipient(local) {
  const a = await getAddress(local);
  if (!a) return { kind: "unclaimed" };
  if (new Date(a.expires_at) <= now()) return { kind: "expired" };
  if (a.source === "web") return { kind: "web", local: a.local };
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

// Draf email keluar owner (/kirim): dikumpulkan selangkah demi selangkah
// lewat wizard, baru dikirim setelah owner menekan tombol konfirmasi.
export async function saveSendDraft(chatId, draft) {
  // Hanya field yang benar-benar dikirim yang diperbarui; field lain dari
  // langkah wizard sebelumnya harus dipertahankan (bukan ditimpa "").
  const d = {};
  for (const k of ["to_email", "from_name", "subject", "body"]) {
    if (draft[k] !== undefined) d[k] = draft[k];
  }
  if (!HAS_DB) {
    mem.sendDrafts.set(String(chatId), { ...mem.sendDrafts.get(String(chatId)), ...d });
    return;
  }
  const p = await db();
  const cur = await p.query(`SELECT to_email, from_name, subject, body FROM temp_send_drafts WHERE chat_id=$1`, [chatId]);
  const merged = { ...(cur.rows[0] || {}), ...d };
  // Kolom-kolom draf NOT NULL: langkah wizard pertama hanya mengisi
  // to_email, jadi field lain HARUS dikirim sebagai "" (bukan NULL) —
  // NULL eksplisit melanggar constraint dan menggagalkan seluruh update
  // tanpa balasan (handler webhook hanya mencatat error ke log).
  await p.query(
    `INSERT INTO temp_send_drafts(chat_id, to_email, from_name, subject, body) VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(chat_id) DO UPDATE SET to_email=EXCLUDED.to_email, from_name=EXCLUDED.from_name,
       subject=EXCLUDED.subject, body=EXCLUDED.body, created_at=now()`,
    [chatId, merged.to_email || "", merged.from_name || "", merged.subject || "", merged.body || ""]
  );
}

export async function getSendDraft(chatId) {
  if (!HAS_DB) return mem.sendDrafts.get(String(chatId)) || null;
  const p = await db();
  const r = await p.query(`SELECT to_email, from_name, subject, body FROM temp_send_drafts WHERE chat_id=$1`, [chatId]);
  return r.rows[0] || null;
}

export async function clearSendDraft(chatId) {
  if (!HAS_DB) { mem.sendDrafts.delete(String(chatId)); return; }
  const p = await db();
  await p.query(`DELETE FROM temp_send_drafts WHERE chat_id=$1`, [chatId]);
}
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

// ================= versi web (temp.pengagumku.id) =================
// Alamat web tidak terikat akun Telegram: pemiliknya dibuktikan dengan kode
// kredensial (ditampilkan SEKALI saat pembuatan, disimpan sebagai hash scrypt).
// Kode yang hilang tidak bisa dipulihkan — sama seperti kunci privat.

export function generateCredential() {
  return crypto.randomBytes(18).toString("base64url"); // 24 karakter, ~144 bit
}

export async function purgeExpiredWeb() {
  // Hapus alamat web yang sudah lewat masa simpan (+ inbox-nya via CASCADE).
  if (!HAS_DB) {
    for (const [local, a] of [...mem.addr]) {
      if (a.source === "web" && pastRetention(a)) {
        mem.addr.delete(local);
        await deleteWebMessages(local);
      }
    }
    return;
  }
  const p = await db();
  await p.query(
    `DELETE FROM temp_addresses WHERE source='web'
     AND expires_at < now() - ($1 || ' days')::interval`,
    [String(WEB_RETENTION_DAYS)]
  );
}

export async function deleteWebMessages(local) {
  if (!HAS_DB) {
    const ids = [...mem.messages.values()].filter((m) => m.local === local).map((m) => m.id);
    for (const id of ids) mem.messages.delete(id);
    for (const [aid, at] of [...mem.attachments]) if (ids.includes(at.message_id)) mem.attachments.delete(aid);
    return;
  }
  const p = await db();
  await p.query(`DELETE FROM temp_messages WHERE local=$1`, [local]);
}

async function countWebByIp(ip) {
  const t = now();
  if (!HAS_DB) {
    let active = 0, day = 0;
    for (const a of mem.addr.values()) {
      if (a.source !== "web" || a.created_ip !== ip) continue;
      if (new Date(a.expires_at) > t) active++;
      if (new Date(a.created_at).getTime() > t.getTime() - 24 * 3600 * 1000) day++;
    }
    return { active, day };
  }
  const p = await db();
  const r = await p.query(
    `SELECT
       COUNT(*) FILTER (WHERE expires_at > now()) AS active,
       COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS day
     FROM temp_addresses WHERE source='web' AND created_ip=$1`,
    [ip]
  );
  return { active: Number(r.rows[0]?.active || 0), day: Number(r.rows[0]?.day || 0) };
}

// Klaim alamat web. Balik {ok, address, local, expires_at, code} — code HANYA
// dikembalikan di sini (sekali); setelah itu hanya hash-nya yang tersimpan.
export async function claimWebAddress(local, ip) {
  const v = validateLocal(local);
  if (!v.ok) return { ok: false, error: v.error };
  local = v.local;
  await purgeExpiredWeb();
  const existing = await getAddress(local);
  const t = now();
  if (existing && new Date(existing.expires_at) > t)
    return { ok: false, error: "Nama itu sudah dipakai. Coba nama lain." };
  if (existing && !pastRetention(existing))
    return { ok: false, error: "Nama itu masih dalam masa simpan pemilik sebelumnya. Coba nama lain." };
  const clientIp = String(ip || "").slice(0, 45);
  const recent = await countWebByIp(clientIp);
  if (recent.active >= MAX_WEB_PER_IP)
    return { ok: false, error: `Kamu sudah punya ${MAX_WEB_PER_IP} alamat aktif. Hapus dulu salah satunya.` };
  if (recent.day >= MAX_WEB_CREATE_PER_DAY)
    return { ok: false, error: "Batas pembuatan alamat hari ini tercapai. Coba lagi besok." };
  if (existing) await deleteWebMessages(local); // lewat retensi: bersihkan inbox lama
  const code = generateCredential();
  const hash = hashPassword(code);
  const expires = expiryFrom(t).toISOString();
  if (!HAS_DB) {
    mem.addr.set(local, { local, chat_id: WEB_CHAT_ID, created_at: t.toISOString(), expires_at: expires, source: "web", credential_hash: hash, created_ip: clientIp });
  } else {
    const p = await db();
    await p.query(
      `INSERT INTO temp_addresses(local, chat_id, expires_at, source, credential_hash, created_ip)
       VALUES($1,$2,$3,'web',$4,$5)
       ON CONFLICT(local) DO UPDATE SET chat_id=EXCLUDED.chat_id, created_at=now(), expires_at=EXCLUDED.expires_at,
         source='web', credential_hash=EXCLUDED.credential_hash, created_ip=EXCLUDED.created_ip`,
      [local, WEB_CHAT_ID, expires, hash, clientIp]
    );
  }
  return { ok: true, address: `${local}@${DOMAIN}`, local, expires_at: expires, code };
}

// Verifikasi alamat + kode. Balik {ok, address} atau {ok:false, error}.
// Pesan error sengaja generik: tidak membocorkan mana yang salah.
export async function verifyWebAccess(local, code) {
  const v = validateLocal(local);
  if (!v.ok) return { ok: false, error: "Alamat atau kode salah." };
  const a = await getAddress(v.local);
  if (!a || a.source !== "web" || !a.credential_hash) return { ok: false, error: "Alamat atau kode salah." };
  if (!verifyPassword(String(code || ""), a.credential_hash)) return { ok: false, error: "Alamat atau kode salah." };
  return { ok: true, address: a };
}

function publicMessage(m) {
  return {
    id: m.id, from: m.from_addr, subject: m.subject || "(tanpa subjek)",
    received_at: m.received_at, snippet: String(m.snippet ?? m.text_body ?? "").slice(0, 140),
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
  };
}

export async function listWebMessages(local) {
  if (!HAS_DB) {
    const rows = [...mem.messages.values()]
      .filter((m) => m.local === local)
      .sort((a, b) => new Date(b.received_at) - new Date(a.received_at))
      .slice(0, MAX_MESSAGES_PER_ADDRESS);
    return rows.map(publicMessage);
  }
  const p = await db();
  const r = await p.query(
    `SELECT id, local, from_addr, subject, received_at, attachments,
            LEFT(text_body, 140) AS snippet
     FROM temp_messages WHERE local=$1 ORDER BY received_at DESC LIMIT $2`,
    [local, MAX_MESSAGES_PER_ADDRESS]
  );
  return r.rows.map(publicMessage);
}

export async function getWebMessage(local, id) {
  let m = null;
  if (!HAS_DB) {
    m = mem.messages.get(Number(id)) || null;
    if (!m || m.local !== local) return null;
  } else {
    const p = await db();
    const r = await p.query(`SELECT * FROM temp_messages WHERE id=$1 AND local=$2`, [id, local]);
    m = r.rows[0] || null;
    if (!m) return null;
  }
  return {
    id: m.id, from: m.from_addr, subject: m.subject || "(tanpa subjek)",
    received_at: m.received_at, text_body: m.text_body || "", html_body: m.html_body || "",
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
  };
}

export async function getWebAttachment(local, messageId, attId) {
  // Pastikan lampiran memang milik pesan di alamat ini.
  const msg = await getWebMessage(local, messageId);
  if (!msg) return null;
  const meta = msg.attachments.find((a) => String(a.att_id) === String(attId));
  if (!meta || !meta.stored) return null;
  if (!HAS_DB) {
    const a = mem.attachments.get(Number(attId));
    if (!a || a.message_id !== Number(messageId)) return null;
    return { filename: a.filename, content_type: a.content_type, data: a.data };
  }
  const p = await db();
  const r = await p.query(`SELECT filename, content_type, data FROM temp_attachments WHERE id=$1 AND message_id=$2`, [attId, messageId]);
  return r.rows[0] || null;
}

// Aktifkan ulang alamat web (perpanjang 7 hari dari sekarang). Hanya bisa
// selama masa simpan (kedaluwarsa + 30 hari); sesudah itu data sudah dihapus.
export async function reactivateWebAddress(local, code) {
  const v = await verifyWebAccess(local, code);
  if (!v.ok) return v;
  const a = v.address;
  if (pastRetention(a))
    return { ok: false, error: "Masa simpan alamat ini sudah habis — inbox-nya sudah dihapus permanen. Buat alamat baru." };
  const expires = expiryFrom(now()).toISOString();
  if (!HAS_DB) {
    const row = mem.addr.get(a.local);
    if (row) row.expires_at = expires;
  } else {
    const p = await db();
    await p.query(`UPDATE temp_addresses SET expires_at=$1 WHERE local=$2 AND source='web'`, [expires, a.local]);
  }
  return { ok: true, address: `${a.local}@${DOMAIN}`, expires_at: expires };
}

export async function deleteWebAddress(local, code) {
  const v = await verifyWebAccess(local, code);
  if (!v.ok) return v;
  if (!HAS_DB) {
    mem.addr.delete(v.address.local);
    await deleteWebMessages(v.address.local);
  } else {
    const p = await db();
    await p.query(`DELETE FROM temp_addresses WHERE local=$1 AND source='web'`, [v.address.local]);
  }
  return { ok: true };
}

// Simpan email masuk untuk alamat web. Dipanggil dari webhook inbound-email.
// email: hasil GET Receiving API (bisa null bila gagal diambil — simpan meta saja).
// getAttachmentUrl(emailId, attId) -> URL unduh sementara (boleh null).
export async function storeWebMessage(local, email, meta, getAttachmentUrl) {
  const from = (email && email.from) || (meta && meta.from) || "(tidak diketahui)";
  const subject = (email && email.subject) || (meta && meta.subject) || "(tanpa subjek)";
  const text = String((email && email.text) || (email && email.html ? stripHtml(email.html) : "") || "").slice(0, MAX_BODY_CHARS);
  const html = String((email && email.html) || "").slice(0, MAX_BODY_CHARS);
  const atts = ((email && email.attachments) || (meta && meta.attachments) || []).map((a) => ({
    filename: a.filename || "lampiran",
    size: a.size || 0,
    content_type: a.content_type || a.contentType || "application/octet-stream",
    disposition: a.content_disposition || "",
    stored: false,
    att_id: null,
    src_id: a.id || null,
  }));
  const receivedAt = (email && email.created_at) || (meta && meta.created_at) || new Date().toISOString();
  let id;
  if (!HAS_DB) {
    id = memMsgSeq++;
    mem.messages.set(id, { id, local, from_addr: from, subject, text_body: text, html_body: html, received_at: receivedAt, attachments: atts });
  } else {
    const p = await db();
    const r = await p.query(
      `INSERT INTO temp_messages(local, from_addr, subject, text_body, html_body, received_at, attachments)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [local, from, subject, text, html, receivedAt, JSON.stringify(atts)]
    );
    id = r.rows[0].id;
  }
  // Lampiran kecil non-inline ikut disimpan supaya bisa diunduh dari web.
  const emailId = (email && email.id) || (meta && meta.email_id) || "";
  let storedTotal = 0;
  if (email && getAttachmentUrl && emailId) {
    for (const a of atts) {
      if (a.disposition === "inline" || !a.src_id) continue;
      if (!a.size || a.size > MAX_ATTACHMENT_BYTES) continue;
      if (storedTotal + a.size > MAX_ATTACHMENTS_TOTAL) continue;
      try {
        const url = await getAttachmentUrl(emailId, a.src_id);
        if (!url) continue;
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_ATTACHMENT_BYTES) continue;
        const b64 = buf.toString("base64");
        let attId;
        if (!HAS_DB) {
          attId = memAttSeq++;
          mem.attachments.set(attId, { id: attId, message_id: id, filename: a.filename, content_type: a.content_type, size: buf.length, data: b64 });
        } else {
          const p = await db();
          const r = await p.query(
            `INSERT INTO temp_attachments(message_id, filename, content_type, size, data) VALUES($1,$2,$3,$4,$5) RETURNING id`,
            [id, a.filename, a.content_type, buf.length, b64]
          );
          attId = r.rows[0].id;
        }
        a.stored = true;
        a.att_id = attId;
        storedTotal += buf.length;
      } catch { /* lampiran gagal disimpan: metadata tetap tampil */ }
    }
    // Tulis kembali metadata lampiran dengan status stored/att_id terbaru.
    if (!HAS_DB) {
      const m = mem.messages.get(id);
      if (m) m.attachments = atts;
    } else {
      const p = await db();
      await p.query(`UPDATE temp_messages SET attachments=$1 WHERE id=$2`, [JSON.stringify(atts), id]);
    }
  }
  // Batas inbox: hanya 50 pesan terbaru per alamat.
  if (!HAS_DB) {
    const rows = [...mem.messages.values()].filter((m) => m.local === local).sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
    for (const m of rows.slice(0, Math.max(0, rows.length - MAX_MESSAGES_PER_ADDRESS))) {
      mem.messages.delete(m.id);
      for (const [aid, at] of [...mem.attachments]) if (at.message_id === m.id) mem.attachments.delete(aid);
    }
  } else {
    const p = await db();
    await p.query(
      `DELETE FROM temp_messages WHERE local=$1 AND id NOT IN
       (SELECT id FROM temp_messages WHERE local=$1 ORDER BY received_at DESC LIMIT $2)`,
      [local, MAX_MESSAGES_PER_ADDRESS]
    );
  }
  return { ok: true, id };
}
