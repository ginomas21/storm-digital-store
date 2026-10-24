// Otak bot temp-mail @emailwehobot: menu interaktif via webhook Telegram.
// Pengguna klaim alamat @akuadalah.dev (acak / nama sendiri), email masuk ke
// alamat aktif diteruskan HANYA ke pemiliknya oleh /api/inbound-email.
import { tgApi } from "./telegram-mail.js";
import {
  DOMAIN, EXPIRY_DAYS, MAX_PER_USER,
  validateLocal, randomLocal, claimAddress, listForChat, deleteForChat,
  setState, getState, clearState, registerUser, maskLocal,
} from "./temp-mail.js";

const ownerChat = () => String(process.env.TELEGRAM_MAIL_CHAT_ID || "");
const isOwner = (chatId) => String(chatId) === ownerChat();

function userLabel(from) {
  if (!from) return "(tanpa nama)";
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || "(tanpa nama)";
  return from.username ? `${name} (@${from.username})` : name;
}

// Notifikasi aktivitas ke owner: HANYA metadata (siapa + alamat tersamar).
// Isi email pengguna TIDAK pernah diteruskan ke owner.
async function notifyOwner(text) {
  const oc = ownerChat();
  if (!oc) return;
  try {
    await tgApi("sendMessage", { chat_id: oc, text, disable_web_page_preview: true });
  } catch { /* notifikasi owner gagal tidak boleh mengganggu pengguna */ }
}

async function trackUser(chatId, from) {
  if (!chatId || isOwner(chatId)) return;
  try {
    const isNew = await registerUser(chatId, from?.username || "", from?.first_name || "");
    if (isNew) {
      await notifyOwner(
        `👤 Pengguna baru memakai bot email sementara\n\n` +
        `Nama: ${userLabel(from)}\nID Telegram: ${chatId}`
      );
    }
  } catch { /* pencatatan gagal tidak boleh mengganggu pengguna */ }
}

async function notifyClaim(chatId, from, address) {
  if (isOwner(chatId)) return;
  await notifyOwner(
    `📝 Alamat email baru didaftarkan\n\n` +
    `Pengguna: ${userLabel(from)}\nID Telegram: ${chatId}\n` +
    `Alamat: ${maskLocal(address.local)}@${DOMAIN}\n` +
    `Berlaku s/d: ${fmtDate(address.expires_at)}`
  );
}

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB";
  } catch { return String(iso); }
};

const MENU_KB = {
  inline_keyboard: [
    [
      { text: "🎲 Buat Email Acak", callback_data: "new_random" },
      { text: "✏️ Tulis Nama Sendiri", callback_data: "new_custom" },
    ],
    [{ text: "📬 Alamat Saya", callback_data: "list" }],
  ],
};

const WELCOME =
  `Halo! Ini layanan email sementara @${DOMAIN}.\n\n` +
  `Kamu bisa membuat alamat email sendiri — semua email yang masuk ke alamatmu ` +
  `akan diteruskan ke chat ini, dan tidak ke orang lain.\n\n` +
  `• 1 orang maksimal ${MAX_PER_USER} alamat\n` +
  `• Alamat kedaluwarsa ${EXPIRY_DAYS} hari sejak dibuat\n` +
  `• Hanya untuk menerima email (tidak bisa mengirim)\n\n` +
  `Pilih menu di bawah:`;

async function say(chatId, text, kb) {
  return tgApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(kb ? { reply_markup: kb } : {}),
  });
}

async function doClaim(chatId, local, from) {
  const res = await claimAddress(chatId, local, isOwner(chatId));
  if (!res.ok) {
    await say(chatId, `❌ ${res.error}`, MENU_KB);
    return;
  }
  const a = res.address;
  await notifyClaim(chatId, from, a);
  await say(
    chatId,
    `✅ Alamatmu aktif!\n\n${a.local}@${DOMAIN}\n\n` +
      `Berlaku sampai: ${fmtDate(a.expires_at)}\n` +
      `Semua email ke alamat itu akan masuk ke chat ini. Salin alamatnya dan pakai di mana pun kamu butuh email sementara.`,
    MENU_KB
  );
}

async function doList(chatId) {
  const rows = await listForChat(chatId);
  const t = new Date();
  const active = rows.filter((a) => new Date(a.expires_at) > t);
  if (!active.length) {
    await say(chatId, "Kamu belum punya alamat aktif. Buat dulu lewat menu ya.", MENU_KB);
    return;
  }
  const lines = active
    .map((a, i) => `${i + 1}. ${a.local}@${DOMAIN}\n    s/d ${fmtDate(a.expires_at)}`)
    .join("\n");
  const kb = {
    inline_keyboard: [
      ...active.map((a) => [{ text: `🗑 Hapus ${a.local}@`, callback_data: `del:${a.local}` }]),
      [{ text: "🎲 Buat Email Acak", callback_data: "new_random" }],
    ],
  };
  await say(chatId, `📬 Alamat aktifmu (${active.length}/${isOwner(chatId) ? "∞" : MAX_PER_USER}):\n\n${lines}`, kb);
}

export async function handleUpdate(update) {
  // ---- tombol (callback query) ----
  const cq = update.callback_query;
  if (cq) {
    const chatId = cq.message?.chat?.id || cq.from?.id;
    const data = String(cq.data || "");
    try { await tgApi("answerCallbackQuery", { callback_query_id: cq.id }); } catch {}
    if (!chatId) return;
    await trackUser(chatId, cq.from);
    if (data === "new_random") {
      for (let i = 0; i < 6; i++) {
        const local = randomLocal();
        const before = await claimAddress(chatId, local, isOwner(chatId)).catch(() => null);
        if (before && before.ok) {
          const a = before.address;
          await notifyClaim(chatId, cq.from, a);
          await say(chatId, `✅ Alamatmu aktif!\n\n${a.local}@${DOMAIN}\n\nBerlaku sampai: ${fmtDate(a.expires_at)}\nSemua email ke alamat itu akan masuk ke chat ini.`, MENU_KB);
          return;
        }
        if (before && !/sudah dipakai/.test(before.error)) { await say(chatId, `❌ ${before.error}`, MENU_KB); return; }
      }
      await say(chatId, "❌ Lagi sial, nama acaknya tabrakan terus. Coba lagi atau tulis nama sendiri.", MENU_KB);
      return;
    }
    if (data === "new_custom") {
      await setState(chatId, "await_name");
      await say(chatId, "Kirim nama email yang kamu mau (huruf kecil/angka, 3–30 karakter).\nContoh: budi.santai\n\nKetik /batal untuk membatalkan.");
      return;
    }
    if (data === "list") { await doList(chatId); return; }
    if (data.startsWith("del:")) {
      const local = data.slice(4);
      const ok = await deleteForChat(chatId, local);
      await say(chatId, ok ? `🗑 Alamat ${local}@${DOMAIN} sudah dihapus dan tidak akan menerima email lagi.` : "Alamat itu bukan milikmu atau sudah tidak ada.", MENU_KB);
      return;
    }
    return;
  }

  // ---- pesan teks ----
  const msg = update.message;
  if (!msg || !msg.chat || msg.chat.type !== "private") return;
  const chatId = msg.chat.id;
  const text = String(msg.text || "").trim();
  if (!text) return;
  await trackUser(chatId, msg.from);

  if (text === "/start" || text === "/menu") {
    await clearState(chatId);
    await say(chatId, WELCOME, MENU_KB);
    return;
  }
  if (text === "/batal") {
    await clearState(chatId);
    await say(chatId, "Dibatalkan.", MENU_KB);
    return;
  }
  if (text === "/alamat") { await doList(chatId); return; }

  const mode = await getState(chatId);
  if (mode === "await_name") {
    const v = validateLocal(text);
    if (!v.ok) {
      await say(chatId, `❌ ${v.error}\nCoba kirim nama lain, atau /batal.`);
      return;
    }
    await clearState(chatId);
    await doClaim(chatId, v.local, msg.from);
    return;
  }

  await say(chatId, "Pakai menu di bawah ya — buat alamat baru atau lihat alamatmu.", MENU_KB);
}
