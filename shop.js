const rp = n => "Rp" + Number(n).toLocaleString("id-ID");
      const $ = id => document.getElementById(id);
      let products = [], current = null, order = null, pollTimer = null, countTimer = null, appliedVoucher = null;
      let reseller = null; // {discount, stats} kalau login reseller — harga katalog tetap normal, diskon cuma di checkout (server yang hitung).
      let selectedProductFilter = "all";

      function productCategory(p) {
        const value = `${p.name || ""} ${p.category || ""}`.toLowerCase();
        return /(spotify|youtube|loklok|netflix|vidio|hbo|max|disney|viu|stream|musik)/.test(value) ? "entertainment" : "creator";
      }
      function productVisual(p) {
        const name = String(p.name || "").toLowerCase();
        if (name.includes("spotify")) return { art: "art-spotify", image: "/product-art/music.svg", icon: "icon-spotify", label: "SOUND ON", kind: "MUSIC" };
        if (name.includes("canva")) return { art: "art-canva", image: "/product-art/design.svg", icon: "icon-canva", label: "MAKE IT YOURS", kind: "DESIGN" };
        if (name.includes("capcut")) return { art: "art-capcut", image: "/product-art/video.svg", icon: "icon-capcut", label: "CUT · CREATE · SHARE", kind: "VIDEO" };
        if (name.includes("lovable")) return { art: "art-lovable", image: "/product-art/design.svg", icon: "icon-heart", label: "BUILD SOMETHING", kind: "AI TOOLS" };
        if (name.includes("youtube")) return { art: "art-youtube", image: "/product-art/video.svg", icon: "icon-play", label: "PLAY WITHOUT LIMITS", kind: "VIDEO" };
        if (name.includes("claude")) return { art: "art-claude", image: "/product-art/ai.svg", icon: "icon-claude", label: "THINK FURTHER", kind: "AI TOOLS" };
        if (name.includes("gemini")) return { art: "art-gemini", image: "/product-art/ai.svg", icon: "icon-spark", label: "MAKE A SPARK", kind: "AI TOOLS" };
        if (/chat\s*gpt|openai/.test(name)) return { art: "art-chatgpt", image: "/product-art/ai.svg", icon: "icon-spark", label: "IDEAS INTO ACTION", kind: "AI TOOLS" };
        if (name.includes("adobe")) return { art: "art-adobe", image: "/product-art/design.svg", icon: "icon-spark", label: "CREATE MORE", kind: "CREATIVE" };
        if (name.includes("muse") || name.includes("token")) return { art: "art-muse", image: "/product-art/tokens.svg", icon: "icon-spark", label: "CREDITS READY", kind: "TOKENS" };
        if (name.includes("netflix")) return { art: "art-netflix", image: "/product-art/streaming.svg", icon: "icon-play", label: "YOUR NEXT FAVORITE", kind: "STREAM" };
        if (name.includes("vidio")) return { art: "art-vidio", image: "/product-art/streaming.svg", icon: "icon-play", label: "WATCH EVERY MOMENT", kind: "STREAM" };
        if (/hbo|max|disney|viu|loklok/.test(name)) return { art: name.includes("loklok") ? "art-loklok" : "art-streaming", image: "/product-art/streaming.svg", icon: "icon-screen", label: "YOUR NEXT STORY", kind: "STREAM" };
        return { art: "art-generic", image: "/product-art/premium.svg", icon: "icon-spark", label: "DN / DIGITAL", kind: "PREMIUM" };
      }
      function applyProductFilter() {
        document.querySelectorAll(".filter").forEach(button => {
          const active = (button.dataset.filter || "all") === selectedProductFilter;
          button.classList.toggle("active", active);
          button.setAttribute("aria-pressed", active ? "true" : "false");
        });
        document.querySelectorAll(".product-card").forEach(card => {
          card.hidden = selectedProductFilter !== "all" && card.dataset.category !== selectedProductFilter;
        });
      }
      function cardEl(p, index = 0) {
        const stock = Number(p.stock_count || 0), out = stock <= 0;
        const sold = Number(p.terjual || 0), category = productCategory(p), visual = productVisual(p);
        const el = document.createElement("article");
        el.className = "product-card"; el.dataset.category = category;
        el.innerHTML = `<div class="product-art ${visual.art}"><img class="product-image" alt="" loading="lazy" decoding="async"><span class="art-label"></span><span class="art-mark"><svg aria-hidden="true"><use href="#${visual.icon}"/></svg></span><span class="art-number"></span></div>` +
          `<div class="product-body"><div class="product-flags"><span class="category-tag"></span><span class="sold-tag"></span></div><h3></h3><p class="product-desc"></p>` +
          `<div class="product-bottom"><span><small class="price-label">Harga</small><strong class="price"></strong></span><button class="mini-button" type="button"></button></div>` +
          `<div class="stock-note ${out ? "out" : ""}"><i></i><span></span></div></div>`;
        const productImage = el.querySelector(".product-image");
        productImage.src = visual.image;
        productImage.alt = `Ilustrasi produk ${p.name || "premium digital"}`;
        productImage.addEventListener("error", () => productImage.remove(), { once: true });
        el.querySelector(".art-label").textContent = visual.label;
        el.querySelector(".art-number").textContent = `${String(index + 1).padStart(2, "0")} / ${visual.kind}`;
        el.querySelector(".category-tag").textContent = category === "entertainment" ? "Musik & hiburan" : "Kreator & kerja";
        el.querySelector(".sold-tag").textContent = sold > 0 ? `${sold.toLocaleString("id-ID")} terjual` : "Produk premium";
        el.querySelector("h3").textContent = p.name || "Produk premium";
        el.querySelector(".product-desc").textContent = p.descr || "Akun premium digital, praktis dan otomatis.";
        el.querySelector(".price").textContent = rp(p.price);
        el.querySelector(".stock-note span").textContent = out ? "Stok habis" : `Stok tercatat: ${stock} paket`;
        const button = el.querySelector("button");
        button.disabled = out; button.textContent = out ? "Stok habis" : "Pilih paket ↗";
        button.setAttribute("aria-label", `${out ? "Stok habis untuk" : "Beli"} ${p.name || "produk premium"}`);
        button.onclick = () => { if (!out) openBuy(p); };
        return el;
      }
      document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
        selectedProductFilter = button.dataset.filter || "all";
        applyProductFilter();
      }));
      async function loadProducts() {
        const r = await fetch("/api/products"); const d = await r.json();
        products = d.products || [];
        const db = $("demoBanner"); if (db) db.style.display = d.demo ? "block" : "none";
        const pb = $("payBanner"); if (pb) pb.style.display = (!d.demo && !d.payment_active) ? "block" : "none";
        const g = $("productGrid"), fg = $("featuredGrid");
        const empty = '<p style="color:var(--muted)">Katalog masih kosong. Cek lagi nanti ya.</p>';
        if (!products.length) {
          if (g) g.innerHTML = empty;
          if (fg) fg.innerHTML = empty;
          return;
        }
        if (g) { g.innerHTML = ""; for (const [i, p] of products.entries()) g.appendChild(cardEl(p, i)); }
        if (fg) {
          fg.innerHTML = "";
          const top = [...products].sort((a, b) => Number(b.terjual || 0) - Number(a.terjual || 0)).slice(0, 6);
          for (const [i, p] of top.entries()) fg.appendChild(cardEl(p, i));
        }
        applyProductFilter();
      }
      function openBuy(p) {
        current = p;
        $("dlgTitle").textContent = p.name;
        const minQty = reseller ? 3 : 1;
        const sel = $("fQty"); sel.innerHTML = "";
        for (let i = minQty; i <= Math.min(p.stock_count, 10); i++) { const o = document.createElement("option"); o.value = i; o.textContent = i + " akun"; sel.appendChild(o); }
        $("btnPay").disabled = sel.options.length === 0;
        const upd = () => {
          if (!sel.value) { $("formErr").textContent = reseller ? `Stok produk ini tinggal ${p.stock_count} akun — di bawah minimum reseller (3 akun). Tambah stok dulu, atau keluar dari akun reseller dan checkout sebagai tamu.` : "Stok produk ini habis."; $("dlgTotal").textContent = ""; $("discRow").style.display = "none"; sel.disabled = true; return; }
          $("formErr").textContent = ""; sel.disabled = false;
          const qty = Number(sel.value), normal = p.price * qty;
          const bonus0 = reseller ? (qty > 5 ? 10 : 0) : 0;
          const totalDisc0 = reseller ? Math.min(90, reseller.discount + bonus0) : 0;
          if (reseller && totalDisc0 > 0) {
            const bonus = bonus0;
            const totalDisc = totalDisc0;
            const disc = Math.floor(normal * totalDisc / 100);
            $("discRow").style.display = "block";
            $("discRow").innerHTML = `Harga normal <s>${rp(normal)}</s> · diskon reseller ${reseller.discount}%${bonus ? " + bonus volume " + bonus + "%" : ""} (−${rp(disc)}) · <b>Total bayar ${rp(normal - disc)}</b>`;
            $("dlgTotal").textContent = "Total bayar: " + rp(normal - disc);
          } else {
            $("discRow").style.display = "none";
            $("dlgTotal").textContent = "Total: " + rp(normal);
          }
        };
        sel.onchange = () => { appliedVoucher = null; $("voucherMsg").textContent = ""; upd(); }; upd();
        $("fVoucher").value = ""; $("voucherMsg").textContent = ""; appliedVoucher = null;
        $("stepForm").style.display = "block"; $("stepPay").style.display = "none"; $("stepDone").style.display = "none";
        $("buyDlg").showModal();
      }
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      async function createInvoice() {
        const email = $("fEmail").value.trim();
        const phone = $("fPhone").value.trim();
        if (!EMAIL_RE.test(email)) { $("formErr").textContent = "Masukkan alamat email yang benar — akun akan dikirim ke email itu."; return; }
        $("btnPay").disabled = true;
        try {
          const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: current.id, qty: Number($("fQty").value), name: $("fName").value.trim(), email, phone, voucher_code: appliedVoucher || "" }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Gagal membuat tagihan");
          order = { id: d.order_id, contact: email };
          $("payTotal").textContent = rp(d.total);
          if (d.discount_pct > 0) { $("payDisc").style.display = "block"; $("payDisc").innerHTML = `Harga normal <s>${rp(d.normal_total)}</s> · diskon reseller ${d.discount_pct - (d.bonus_pct || 0)}%${d.bonus_pct ? " + bonus volume " + d.bonus_pct + "%" : ""} sudah diterapkan`; }
          else if (d.voucher_code) { $("payDisc").style.display = "block"; $("payDisc").innerHTML = `🎟️ Voucher ${d.voucher_code} (−${rp(d.voucher_discount)}) sudah diterapkan`; }
          else $("payDisc").style.display = "none";
          $("payOrderId").textContent = d.order_id;
          if (d.qris_image) $("payQr").src = d.qris_image; else if (d.payment_url) { $("payQr").outerHTML = '<a class="btn" href="' + d.payment_url + '" target="_blank">Buka Halaman Bayar</a>'; }
          $("stepForm").style.display = "none"; $("stepPay").style.display = "block";
          startCountdown(d.timeout_ms || 600000); startPolling();
        } catch (e) { $("formErr").textContent = e.message; }
        $("btnPay").disabled = false;
      }
      function startCountdown(ms) {
        let left = Math.floor(ms / 1000);
        clearInterval(countTimer);
        countTimer = setInterval(() => {
          left -= 1;
          if (left < 0) { clearInterval(countTimer); stopPolling(); $("payErr").textContent = "Waktu habis. Pesanan kedaluwarsa — silakan pesan lagi."; return; }
          $("payTimer").textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
        }, 1000);
      }
      function startPolling() {
        stopPolling();
        pollTimer = setInterval(checkStatus, 5000);
      }
      function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }
      async function checkStatus() {
        if (!order) return;
        try {
          const r = await fetch(`/api/order-status?id=${encodeURIComponent(order.id)}&contact=${encodeURIComponent(order.contact)}`);
          const d = await r.json();
          if (!r.ok) return;
          if (String(d.status).startsWith("sukses")) {
            stopPolling(); clearInterval(countTimer);
            $("stepPay").style.display = "none"; $("stepDone").style.display = "block";
            $("doneInfo").textContent = `Pesanan ${d.id} — ${d.product_name} (${d.qty} akun)`;
            $("doneItems").textContent = d.delivered || "Stok baru saja habis — admin sudah diberi tahu dan akan menghubungimu untuk pengiriman manual atau pengembalian dana.";
            $("doneEmail").textContent = d.email_sent ? "Salinan akun juga sudah dikirim ke email kamu. Cek inbox / folder spam ya." : "";
            loadProducts();
          } else if (d.status !== "pending") {
            stopPolling(); clearInterval(countTimer);
            $("payErr").textContent = "Pesanan berakhir dengan status: " + d.status + ". Tidak ada dana yang terpotong.";
          }
        } catch {}
      }
      async function cancelOrder() {
        if (!order) return;
        stopPolling(); clearInterval(countTimer);
        try { await fetch("/api/order-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...order, action: "cancel" }) }); } catch {}
        $("buyDlg").close(); loadProducts();
      }
      async function lookup() {
        const id = $("lookupId").value.trim(), contact = $("lookupContact").value.trim();
        $("lookupErr").textContent = ""; $("lookupResult").innerHTML = "";
        if (!id || !contact) { $("lookupErr").textContent = "Isi kode pesanan dan kontaknya dulu."; return; }
        const r = await fetch(`/api/order-status?id=${encodeURIComponent(id)}&contact=${encodeURIComponent(contact)}`);
        const d = await r.json();
        if (!r.ok) { $("lookupErr").textContent = d.error || "Tidak ditemukan"; return; }
        let html = `<p>Status pesanan <strong>${d.id}</strong> (${d.product_name}): <strong>${d.status}</strong> · total ${rp(d.total)}</p>`;
        if (String(d.status).startsWith("sukses") && d.delivered) html += `<div class="delivered"></div>`;
        $("lookupResult").innerHTML = html;
        const dv = $("lookupResult .delivered"); if (dv) dv.textContent = d.delivered;
      }
      async function loadReseller() {
        try {
          const r = await fetch("/api/reseller?action=me"); const d = await r.json();
          if (d.logged_in) {
            reseller = d;
            const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
            set("resName", d.username); set("resDisc", d.discount + "%");
            set("resTx", d.stats.tx_count); set("resSpent", rp(d.stats.total_spent)); set("resSaved", rp(d.stats.total_saved));
            const rp2 = $("resPanel"); if (rp2) rp2.style.display = "block";
            const rl = $("resLoginLink"); if (rl) rl.style.display = "none";
          }
        } catch {}
      }
      async function applyVoucher() {
        const code = $("fVoucher").value.trim();
        const msg = $("voucherMsg");
        if (!code) { msg.textContent = "Masukkan dulu kode vouchernya."; return; }
        if (!current) return;
        msg.textContent = "Mengecek voucher…";
        try {
          const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "validate-voucher", productId: current.id, qty: Number($("fQty").value), voucher_code: code }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Voucher tidak valid");
          appliedVoucher = d.code;
          msg.textContent = `🎟️ ${d.code}: potongan ${d.discount_type === "percent" ? d.discount_value + "%" : rp(d.discount_value)} (−${rp(d.discount_amount)}) · total jadi ${rp(d.total)}`;
        } catch (e) { appliedVoucher = null; msg.textContent = e.message; }
      }
      const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
      on("btnPay", createInvoice);
      on("btnVoucher", applyVoucher);
      on("btnClose1", () => $("buyDlg").close());
      on("btnClose3", () => $("buyDlg").close());
      on("btnCancelOrder", cancelOrder);
      on("lookupBtn", lookup);
      on("btnResLogout", async () => { await fetch("/api/reseller?action=logout", { method: "POST" }); location.reload(); });
      const toTop = $("toTop");
      if (toTop) {
        window.addEventListener("scroll", () => { toTop.style.display = window.scrollY > 600 ? "block" : "none"; }, { passive: true });
        toTop.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if ($("productGrid") || $("featuredGrid")) loadProducts();
      if ($("buyDlg")) loadReseller();
