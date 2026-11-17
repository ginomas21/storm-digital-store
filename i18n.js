// i18n DN Digital Store — kamus ID/EN + mesin penerap teks statis.
// Bahasa tersimpan di localStorage 'dn-lang'. Tanpa simpanan: deteksi bahasa
// Telegram (Mini App) / bahasa browser. Ganti bahasa = simpan + muat ulang,
// supaya semua teks dinamis (kartu produk, dialog) ikut bahasa yang dipilih.
(function () {
  var STR = {
    id: {
      nav_home: "Beranda", nav_products: "Produk", nav_products_all: "Semua Produk", nav_check: "Cek pesanan", nav_check_cap: "Cek Pesanan", nav_reseller: "Reseller",
      topline: "Katalog premium digital · proses otomatis 24 jam", explore_catalog: "Jelajahi katalog",
      title_home: "DN Digital Store — Premium Digital, Made Easy", title_products: "Semua Produk — DN Digital Store",
      title_check: "Cek Pesanan — DN Digital Store", title_reseller: "Login Reseller — DN Digital Store",
      hero_eyebrow: "Premium digital, tanpa ribet",
      hero_title: "Upgrade cara<br/>kamu <span class=\"accent\">berkreasi.</span><br/><span class=\"stroke\">Nikmati lebih.</span>",
      hero_lead: "Akun premium untuk kerja, kreasi, dan hiburan. Pilih paket, bayar dengan QRIS, lalu akunmu langsung meluncur ke email—otomatis, 24 jam.",
      hero_cta1: "Temukan paketmu", hero_cta2: "Cara pesan", hero_note: "Proses otomatis · QRIS · kirim ke email",
      chip1_b: "Siap dalam hitungan menit", chip1_s: "Alur otomatis 24/7",
      poster_pick: "Pilihan digital", poster_tag: "PILIHAN #01", poster_h: "Lebih banyak<br/>yang kamu suka.", poster_p: "Premium digital, tinggal pilih dan nikmati.",
      poster_bottom: "Musik · Kreativitas · Hiburan", chip2_b: "Favorit banyak orang", chip2_s: "Temukan pilihanmu",
      demo_banner: "Mode demo: database belum terhubung — produk dan stok contoh ditampilkan, pembayaran belum aktif.",
      pay_banner: "Pembayaran sedang belum aktif. Coba lagi sebentar lagi ya.",
      res_login_as: "Login sebagai reseller", res_disc_word: "diskon", res_active_checkout: "aktif di checkout",
      res_tx: "transaksi lunas", res_spent_l: "Total belanja", res_saved_l: "Total hemat",
      res_rules: "Aturan reseller: minimal 3 akun per pesanan · beli >5 akun dapat bonus diskon +10%.",
      res_my_orders: "Pesanan saya", logout: "Keluar",
      res_link: "Reseller? <a href=\"/reseller\">Login di sini →</a> — diskon otomatis berlaku setelah login.",
      sec_kicker1: "Pilih yang paling kamu suka", sec_title1: "Produk <span class=\"lime\">terpopuler.</span>",
      sec_lead1: "Pilihan favorit untuk streaming, bikin konten, dan produktivitas—semuanya dalam satu tempat.",
      catalog_meta: "Produk dan stok diperbarui langsung dari katalog toko",
      filter_all: "Semua pilihan", filter_creator: "Kreator & kerja", filter_ent: "Musik & hiburan",
      loading_products: "Memuat produk…",
      snapshot_note: "Harga, stok, dan tombol beli mengikuti katalog live. Pembelian diproses melalui checkout QRIS resmi DN Digital Store.",
      see_all: "Lihat semua produk",
      how_kicker: "Semudah itu", how_title: "Pilih. Bayar. <span class=\"lime\">Nikmati.</span>",
      how_lead: "Empat langkah praktis, tanpa perlu membuat akun di toko.",
      step1_t: "Pilih paket", step1_p: "Tentukan produk yang sesuai dan atur jumlahnya sesuai kebutuhan.",
      step2_t: "Isi email aktif", step2_p: "Periksa kembali alamat email tujuan pengiriman akun.",
      step3_t: "Bayar dengan QRIS", step3_p: "Scan memakai e-wallet atau mobile banking dan ikuti instruksi pembayaran.",
      step4_t: "Cek emailmu", step4_p: "Detail pesanan dikirim otomatis setelah pembayaran terdeteksi.",
      footer_copy: "Toko akun premium digital dengan proses otomatis 24 jam. Pembayaran QRIS diverifikasi sistem dan akun dikirim otomatis melalui email. Butuh bantuan? Hubungi <a class=\"owner-link\" href=\"https://t.me/dndigitalbot\">@danielaja2003</a> di Telegram.",
      back_top: "Kembali ke atas",
      cat_kicker: "Semua pilihan dalam satu tempat", cat_title: "Jelajahi <span class=\"lime\">katalog.</span>",
      cat_lead: "Semua produk akun premium. Harga dan stok mengikuti data live; jika stok habis, tombol beli otomatis nonaktif.",
      cat_meta: "Diperbarui langsung dari toko", loading_catalog: "Memuat katalog…",
      dlg_buy: "Beli", f_qty: "Jumlah (akun)", f_name: "Nama kamu", ph_name: "Contoh: Budi", f_email: "Email",
      f_mail_hint: "📩 Produk akan dikirim otomatis melalui email, jadi masukkan alamat email dengan benar.",
      f_phone: "Nomor telepon <span class=\"opt\">(opsional)</span>", ph_phone: "081234567890 — boleh dikosongkan",
      f_voucher: "Kode voucher <span class=\"opt\">(opsional)</span>", ph_voucher: "Contoh: HEMAT10", apply: "Terapkan",
      pay_method: "Metode pembayaran", cancel: "Batal", pay_qris_btn: "Buat Tagihan QRIS", pay_usdt_btn: "Buat Tagihan USDT",
      crypto_send_exact: "Kirim <strong>persis</strong> sejumlah ini — salin, jangan dibulatkan:",
      copy: "Salin", copy_amount: "Salin Jumlah USDT",
      crypto_warn: "⚠️ Hanya jaringan <strong>BEP20 / BNB Smart Chain</strong> — kirim dari jaringan lain, dana hilang. Paling aman dari wallet pribadi (Trust Wallet, dll). Dari exchange, fee potongan bisa membuat jumlah yang sampai meleset.",
      crypto_warn_mini: "⚠️ Hanya jaringan <strong>BEP20 / BNB Smart Chain</strong> — jaringan lain, dana hilang. Paling aman dari wallet pribadi (Trust Wallet, dll).",
      crypto_tx_ask: "Sudah kirim tapi belum terdeteksi? Tempel hash transaksinya (tx hash) di sini:",
      crypto_tx_ask_mini: "Sudah kirim tapi belum terdeteksi? Tempel hash transaksinya:",
      verify: "Verifikasi", order_code: "Kode pesanan", time_left: "sisa waktu",
      pay_hint_qris: "Scan dengan e-wallet / m-banking apa saja dan bayar <strong>persis</strong> sampai digit terakhir. Halaman ini mengecek pembayaran otomatis — jangan ditutup dulu.",
      pay_hint_qris_mini: "Scan dengan e-wallet / m-banking apa saja dan bayar <strong>persis</strong> sampai digit terakhir. Jangan tutup Mini App dulu.",
      cancel_order: "Batalkan Pesanan", done_title: "🎉 Pembayaran diterima!", done_btn: "Selesai",
      cat_creator: "Kreator & kerja", cat_ent: "Musik & hiburan", sold_tag: "{n} terjual", premium_product: "Produk premium",
      price_label: "Harga", desc_fallback: "Akun premium digital, praktis dan otomatis.",
      stock_out: "Stok habis", stock_count: "Stok tercatat: {n} paket", choose_pkg: "Pilih paket ↗",
      catalog_empty: "Katalog masih kosong. Cek lagi nanti ya.",
      reseller_stock_low: "Stok produk ini tinggal {n} akun — di bawah minimum reseller (3 akun). Tambah stok dulu, atau keluar dari akun reseller dan checkout sebagai tamu.",
      stock_out_err: "Stok produk ini habis.", price_normal: "Harga normal", disc_reseller: "diskon reseller", bonus_volume: "bonus volume",
      total_pay: "Total bayar", total: "Total",
      email_invalid: "Masukkan alamat email yang benar — akun akan dikirim ke email itu.",
      invoice_fail: "Gagal membuat tagihan",
      disc_applied: "Harga normal <s>{normal}</s> · diskon reseller {pct}%{bonus} sudah diterapkan",
      voucher_applied_pay: "🎟️ Voucher {code} (−{amt}) sudah diterapkan",
      rate_line: "Kurs saat tagihan dibuat: Rp{n} / USDT",
      pay_hint_usdt: "Halaman ini mengecek blockchain otomatis — jangan ditutup dulu. Akun terkirim begitu transfermu terdeteksi.",
      pay_hint_usdt_mini: "Mini App ini mengecek blockchain otomatis — jangan ditutup dulu. Akun terkirim begitu transfermu terdeteksi.",
      open_pay_page: "Buka Halaman Bayar", copied: "Tersalin ✓",
      tx_invalid: "Hash transaksi tidak valid (diawali 0x, total 66 karakter).",
      tx_checking: "Memeriksa di blockchain…", tx_verified: "✅ Terverifikasi! Akunmu sedang disiapkan…", verify_fail: "Verifikasi gagal",
      expired: "Waktu habis. Pesanan kedaluwarsa — silakan pesan lagi.",
      order_summary: "Pesanan {id} — {name} ({qty})",
      delivered_fallback: "Stok baru saja habis — admin sudah diberi tahu dan akan menghubungimu untuk pengiriman manual atau pengembalian dana.",
      done_email: "Salinan akun juga sudah dikirim ke email kamu. Cek inbox / folder spam ya.",
      order_ended: "Pesanan berakhir dengan status: {status}. Tidak ada dana yang terpotong.",
      lookup_empty: "Isi kode pesanan dan kontaknya dulu.", not_found: "Tidak ditemukan",
      lookup_status: "Status pesanan <strong>{id}</strong> ({name}): <strong>{status}</strong> · total {total}",
      voucher_empty: "Masukkan dulu kode vouchernya.", voucher_checking: "Mengecek voucher…", voucher_invalid: "Voucher tidak valid",
      voucher_ok: "🎟️ {code}: potongan {disc} (−{amt}) · total jadi {total}",
      img_alt: "Ilustrasi produk {name}",
      status_pending: "Menunggu pembayaran", status_sukses: "Lunas / selesai", status_dibatalkan: "Dibatalkan", status_gagal: "Gagal", status_expired: "Kedaluwarsa",
      mini_warn: "Kamu membuka halaman ini di luar Telegram, jadi checkout Mini App belum bisa. Buka lewat tombol <b>order web</b> di kiri bawah bot DN, ya.",
      mini_resume: "↩️ Lanjutkan pesanan terakhir", mini_premium: "🔥 Akun Premium", mini_loading: "Memuat produk…",
      mini_load_fail: "Gagal memuat produk. Tarik untuk refresh.", mini_empty: "Katalog masih kosong.",
      mini_stock: "Stok: {qty}", mini_sold: "🔥 Terjual {qty}", mini_buy_now: "⚡ Beli Sekarang", mini_out_btn: "Habis",
      mini_buy: "Beli", mini_email_note: "📩 Akun dikirim otomatis ke email ini, dan juga lewat bot setelah lunas.",
      mini_back_catalog: "← Kembali ke katalog",
      mini_need_tg: "Buka Mini App ini lewat tombol order web di bot DN, ya — checkout butuh data Telegram yang terverifikasi.",
      mini_hello: "Halo, {name}", mini_resuming: "Melanjutkan pesanan…", mini_done_email_bot: "Akun juga dikirim lewat bot DN.",
      check_title: "Cek <span class=\"grad\">Pesanan</span>",
      check_lead: "Sudah bayar tapi halaman terutup? Masukkan kode pesanan (contoh SDS-0001) dan email atau nomor telepon yang kamu pakai saat pesan.",
      ph_order_code: "Kode pesanan, contoh SDS-0001", ph_contact: "Email / nomor telepon saat pesan", check_btn: "Cek Pesanan",
      footer_check: "DN Digital Store menjual akun premium dengan proses otomatis 24 jam: pembayaran QRIS terverifikasi sistem, akun langsung dikirim ke email tanpa menunggu admin online. Kendala? Hubungi owner: <a class=\"owner-link\" href=\"https://t.me/dndigitalbot\">@danielaja2003</a> (Telegram).",
      res_title: "👥 Login <span>Reseller</span>",
      res_intro: "Akun reseller dibuat oleh admin DN Digital Store. Begitu login, diskon reseller kamu otomatis berlaku di checkout — harga katalog tetap harga normal. Aturan reseller: minimal 3 akun per pesanan, dan beli >5 akun dapat bonus diskon +10%.",
      res_username: "Username reseller", res_password: "Password", res_login_btn: "Masuk", res_back_store: "← Kembali ke toko",
      res_disc_reseller: "diskon reseller", stat_tx: "Transaksi lunas", stat_spent: "Total belanja", stat_saved: "Total hemat",
      res_shop_disc: "Belanja dengan diskon →", res_logout: "Keluar", res_my_orders_h: "🧾 Pesanan Saya",
      th_code: "Kode", th_product: "Produk", th_total: "Total", th_disc: "Diskon", th_status: "Status", th_time: "Waktu",
      res_no_orders: "Belum ada pesanan."
    },
    en: {
      nav_home: "Home", nav_products: "Products", nav_products_all: "All Products", nav_check: "Check order", nav_check_cap: "Check Order", nav_reseller: "Reseller",
      topline: "Premium digital catalog · automated 24/7", explore_catalog: "Browse catalog",
      title_home: "DN Digital Store — Premium Digital, Made Easy", title_products: "All Products — DN Digital Store",
      title_check: "Track Order — DN Digital Store", title_reseller: "Reseller Login — DN Digital Store",
      hero_eyebrow: "Premium digital, made easy",
      hero_title: "Upgrade the way<br/>you <span class=\"accent\">create.</span><br/><span class=\"stroke\">Enjoy more.</span>",
      hero_lead: "Premium accounts for work, creativity, and entertainment. Pick a package, pay with QRIS or USDT, and your account lands straight in your email — automatically, 24/7.",
      hero_cta1: "Find your package", hero_cta2: "How to order", hero_note: "Automated process · QRIS & USDT · sent to your email",
      chip1_b: "Ready in minutes", chip1_s: "Automated flow 24/7",
      poster_pick: "Digital picks", poster_tag: "PICK #01", poster_h: "More of what<br/>you love.", poster_p: "Premium digital — just pick and enjoy.",
      poster_bottom: "Music · Creativity · Entertainment", chip2_b: "Loved by many", chip2_s: "Find your pick",
      demo_banner: "Demo mode: the database is not connected — sample products and stock are shown, payments are inactive.",
      pay_banner: "Payments are temporarily inactive. Please try again in a moment.",
      res_login_as: "Logged in as reseller", res_disc_word: "discount", res_active_checkout: "active at checkout",
      res_tx: "paid transactions", res_spent_l: "Total spent", res_saved_l: "Total saved",
      res_rules: "Reseller rules: minimum 3 accounts per order · buy more than 5 accounts to get a +10% bonus discount.",
      res_my_orders: "My orders", logout: "Log out",
      res_link: "Reseller? <a href=\"/reseller\">Log in here →</a> — your discount applies automatically after login.",
      sec_kicker1: "Pick what you love most", sec_title1: "Most <span class=\"lime\">popular</span> products.",
      sec_lead1: "Favorite picks for streaming, content creation, and productivity — all in one place.",
      catalog_meta: "Products and stock update live from the store catalog",
      filter_all: "All picks", filter_creator: "Creators & work", filter_ent: "Music & entertainment",
      loading_products: "Loading products…",
      snapshot_note: "Prices, stock, and buy buttons follow the live catalog. Purchases are processed through DN Digital Store's official checkout.",
      see_all: "View all products",
      how_kicker: "It's that easy", how_title: "Pick. Pay. <span class=\"lime\">Enjoy.</span>",
      how_lead: "Four simple steps — no store account needed.",
      step1_t: "Pick a package", step1_p: "Choose the right product and set the quantity you need.",
      step2_t: "Enter an active email", step2_p: "Double-check the email address your account will be sent to.",
      step3_t: "Pay with QRIS or USDT", step3_p: "Scan with any e-wallet or mobile banking app, or send USDT on the BEP20 network, and follow the payment instructions.",
      step4_t: "Check your email", step4_p: "Order details are sent automatically once your payment is detected.",
      footer_copy: "A premium digital account store with a fully automated 24/7 process. QRIS and USDT payments are verified by the system and accounts are delivered automatically by email. Need help? Contact <a class=\"owner-link\" href=\"https://t.me/dndigitalbot\">@danielaja2003</a> on Telegram.",
      back_top: "Back to top",
      cat_kicker: "All picks in one place", cat_title: "Browse the <span class=\"lime\">catalog.</span>",
      cat_lead: "All premium account products. Prices and stock follow live data; when a product sells out, its buy button is disabled automatically.",
      cat_meta: "Updated live from the store", loading_catalog: "Loading catalog…",
      dlg_buy: "Buy", f_qty: "Quantity (accounts)", f_name: "Your name", ph_name: "e.g. John", f_email: "Email",
      f_mail_hint: "📩 The product is delivered automatically by email, so please enter the address correctly.",
      f_phone: "Phone number <span class=\"opt\">(optional)</span>", ph_phone: "081234567890 — may be left empty",
      f_voucher: "Voucher code <span class=\"opt\">(optional)</span>", ph_voucher: "e.g. HEMAT10", apply: "Apply",
      pay_method: "Payment method", cancel: "Cancel", pay_qris_btn: "Create QRIS Invoice", pay_usdt_btn: "Create USDT Invoice",
      crypto_send_exact: "Send <strong>exactly</strong> this amount — copy it, do not round it:",
      copy: "Copy", copy_amount: "Copy USDT Amount",
      crypto_warn: "⚠️ <strong>BEP20 / BNB Smart Chain</strong> network only — sending from another network means lost funds. Safest from a personal wallet (Trust Wallet, etc.). From an exchange, deducted fees can make the received amount miss the target.",
      crypto_warn_mini: "⚠️ <strong>BEP20 / BNB Smart Chain</strong> network only — any other network means lost funds. Safest from a personal wallet (Trust Wallet, etc.).",
      crypto_tx_ask: "Already sent but not detected yet? Paste the transaction hash (tx hash) here:",
      crypto_tx_ask_mini: "Already sent but not detected yet? Paste the transaction hash here:",
      verify: "Verify", order_code: "Order code", time_left: "time left",
      pay_hint_qris: "Scan with any e-wallet / mobile banking app and pay <strong>exactly</strong> down to the last digit. This page checks your payment automatically — do not close it yet.",
      pay_hint_qris_mini: "Scan with any e-wallet / mobile banking app and pay <strong>exactly</strong> down to the last digit. Do not close the Mini App yet.",
      cancel_order: "Cancel Order", done_title: "🎉 Payment received!", done_btn: "Done",
      cat_creator: "Creators & work", cat_ent: "Music & entertainment", sold_tag: "{n} sold", premium_product: "Premium product",
      price_label: "Price", desc_fallback: "A premium digital account — practical and automatic.",
      stock_out: "Out of stock", stock_count: "Stock: {n} packages", choose_pkg: "Choose package ↗",
      catalog_empty: "The catalog is still empty. Check back later.",
      reseller_stock_low: "Only {n} accounts left for this product — below the reseller minimum (3 accounts). Restock first, or log out of the reseller account and check out as a guest.",
      stock_out_err: "This product is out of stock.", price_normal: "Normal price", disc_reseller: "reseller discount", bonus_volume: "volume bonus",
      total_pay: "Total to pay", total: "Total",
      email_invalid: "Please enter a valid email address — the account will be sent to that email.",
      invoice_fail: "Failed to create the invoice",
      disc_applied: "Normal price <s>{normal}</s> · reseller discount {pct}%{bonus} applied",
      voucher_applied_pay: "🎟️ Voucher {code} (−{amt}) applied",
      rate_line: "Rate when the invoice was created: Rp{n} / USDT",
      pay_hint_usdt: "This page checks the blockchain automatically — do not close it yet. Your account is sent as soon as your transfer is detected.",
      pay_hint_usdt_mini: "This Mini App checks the blockchain automatically — do not close it yet. Your account is sent as soon as your transfer is detected.",
      open_pay_page: "Open Payment Page", copied: "Copied ✓",
      tx_invalid: "Invalid transaction hash (it starts with 0x, 66 characters in total).",
      tx_checking: "Checking the blockchain…", tx_verified: "✅ Verified! Your account is being prepared…", verify_fail: "Verification failed",
      expired: "Time is up. The order has expired — please place a new order.",
      order_summary: "Order {id} — {name} ({qty})",
      delivered_fallback: "Stock just ran out — the admin has been notified and will contact you for manual delivery or a refund.",
      done_email: "A copy of the account has also been sent to your email. Check your inbox / spam folder.",
      order_ended: "The order ended with status: {status}. No funds were charged.",
      lookup_empty: "Enter the order code and your contact first.", not_found: "Not found",
      lookup_status: "Order status <strong>{id}</strong> ({name}): <strong>{status}</strong> · total {total}",
      voucher_empty: "Enter the voucher code first.", voucher_checking: "Checking voucher…", voucher_invalid: "Invalid voucher",
      voucher_ok: "🎟️ {code}: {disc} off (−{amt}) · new total {total}",
      img_alt: "Illustration of {name}",
      status_pending: "Awaiting payment", status_sukses: "Paid / completed", status_dibatalkan: "Cancelled", status_gagal: "Failed", status_expired: "Expired",
      mini_warn: "You opened this page outside Telegram, so Mini App checkout is not available yet. Open it via the <b>web order</b> button at the bottom left of the DN bot.",
      mini_resume: "↩️ Resume last order", mini_premium: "🔥 Premium Accounts", mini_loading: "Loading products…",
      mini_load_fail: "Failed to load products. Pull to refresh.", mini_empty: "The catalog is still empty.",
      mini_stock: "Stock: {qty}", mini_sold: "🔥 {qty} sold", mini_buy_now: "⚡ Buy Now", mini_out_btn: "Sold out",
      mini_buy: "Buy", mini_email_note: "📩 The account is sent automatically to this email, and also via the bot once paid.",
      mini_back_catalog: "← Back to catalog",
      mini_need_tg: "Open this Mini App via the web order button in the DN bot — checkout needs verified Telegram data.",
      mini_hello: "Hello, {name}", mini_resuming: "Resuming order…", mini_done_email_bot: "The account was also sent via the DN bot.",
      check_title: "Track <span class=\"grad\">Order</span>",
      check_lead: "Already paid but the page closed? Enter your order code (e.g. SDS-0001) and the email or phone number you used when ordering.",
      ph_order_code: "Order code, e.g. SDS-0001", ph_contact: "Email / phone number used when ordering", check_btn: "Check Order",
      footer_check: "DN Digital Store sells premium accounts with a fully automated 24/7 process: QRIS payments are verified by the system and accounts are sent straight to your email without waiting for an admin to be online. Any problem? Contact the owner: <a class=\"owner-link\" href=\"https://t.me/dndigitalbot\">@danielaja2003</a> (Telegram).",
      res_title: "👥 Reseller <span>Login</span>",
      res_intro: "Reseller accounts are created by the DN Digital Store admin. Once you log in, your reseller discount applies automatically at checkout — catalog prices stay at the normal price. Reseller rules: minimum 3 accounts per order, and buying more than 5 accounts earns a +10% bonus discount.",
      res_username: "Reseller username", res_password: "Password", res_login_btn: "Log in", res_back_store: "← Back to store",
      res_disc_reseller: "reseller discount", stat_tx: "Paid transactions", stat_spent: "Total spent", stat_saved: "Total saved",
      res_shop_disc: "Shop with discount →", res_logout: "Log out", res_my_orders_h: "🧾 My Orders",
      th_code: "Code", th_product: "Product", th_total: "Total", th_disc: "Discount", th_status: "Status", th_time: "Time",
      res_no_orders: "No orders yet."
    }
  };

  function detect() {
    try {
      var saved = localStorage.getItem("dn-lang");
      if (saved === "id" || saved === "en") return saved;
    } catch (e) {}
    try {
      var tgUser = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user;
      var lc = (tgUser && tgUser.language_code) || navigator.language || "id";
      return String(lc).toLowerCase().indexOf("en") === 0 ? "en" : "id";
    } catch (e) { return "id"; }
  }

  var LANG = detect();
  window.DN_LANG = LANG;
  window.DN_STR = STR;
  window.t = function (key, params) {
    var s = (STR[LANG] && STR[LANG][key]) || STR.id[key] || key;
    if (params) for (var k in params) s = s.split("{" + k + "}").join(String(params[k]));
    return s;
  };
  window.dnLocale = function () { return LANG === "en" ? "en-US" : "id-ID"; };
  window.dnQty = function (n) {
    n = Number(n) || 0;
    var s = n.toLocaleString(window.dnLocale());
    return LANG === "en" ? (s + (n === 1 ? " account" : " accounts")) : (s + " akun");
  };
  window.dnDescr = function (p) {
    if (LANG === "en" && p && p.descr_en) return p.descr_en;
    return (p && p.descr) || "";
  };
  window.dnStatus = function (s) {
    s = String(s || "");
    if (s.indexOf("sukses") === 0) return window.t("status_sukses");
    if (s === "pending") return window.t("status_pending");
    if (s === "dibatalkan") return window.t("status_dibatalkan");
    if (s === "gagal") return window.t("status_gagal");
    if (s === "kedaluwarsa" || s === "expired") return window.t("status_expired");
    return s;
  };
  window.dnSetLang = function (l) {
    try { localStorage.setItem("dn-lang", l); } catch (e) {}
    location.reload();
  };
  window.dnApplyI18n = function () {
    document.documentElement.lang = LANG;
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = window.t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = window.t(el.getAttribute("data-i18n-html")); });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (el) { el.setAttribute("placeholder", window.t(el.getAttribute("data-i18n-ph"))); });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) { el.setAttribute("title", window.t(el.getAttribute("data-i18n-title"))); });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", window.t(el.getAttribute("data-i18n-aria"))); });
  };

  function addToggle() {
    if (document.getElementById("langBtn")) return;
    var st = document.createElement("style");
    st.textContent = ".lang-btn{cursor:pointer;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:inherit;font:inherit;font-weight:700;font-size:.82rem;padding:7px 13px;border-radius:999px;white-space:nowrap}.lang-btn:hover{background:rgba(255,255,255,.16)}";
    document.head.appendChild(st);
    var b = document.createElement("button");
    b.id = "langBtn"; b.type = "button"; b.className = "lang-btn";
    b.textContent = LANG === "id" ? "🌐 English" : "🌐 Bahasa Indonesia";
    b.setAttribute("aria-label", "Switch language / ganti bahasa");
    b.onclick = function () { window.dnSetLang(LANG === "id" ? "en" : "id"); };
    var host = document.querySelector(".nav") || document.querySelector(".top");
    if (host) host.appendChild(b);
    else { b.style.cssText = "position:fixed;top:12px;right:12px;z-index:99"; document.body.appendChild(b); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { window.dnApplyI18n(); addToggle(); });
  else { window.dnApplyI18n(); addToggle(); }
})();
