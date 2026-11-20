const rp = n => "Rp" + Number(n).toLocaleString(dnLocale());
      const $ = id => document.getElementById(id);
      let products = [], current = null, order = null, pollTimer = null, countTimer = null, appliedVoucher = null;
      let payMethod = "qris", cryptoActive = false;
      let reseller = null; // {discount, stats} kalau login reseller — harga katalog tetap normal, diskon cuma di checkout (server yang hitung).
      let selectedProductFilter = "all";

      function productCategory(p) {
        const name = String(p.name || "").toLowerCase();
        if (/wise/.test(name)) return "finansial";
        if (/(adobe|canva|capcut)/.test(name)) return "produktivitas";
        if (/(spotify|youtube|loklok|netflix|vidio|hbo|disney|viu)/.test(name)) return "hiburan";
        return "ai";
      }
      const CAT_TAG_KEYS = { ai: "tag_ai", hiburan: "tag_hiburan", produktivitas: "tag_prod", finansial: "tag_fin" };
      let selectedSearch = "";
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
          const matchFilter = selectedProductFilter === "all" || card.dataset.category === selectedProductFilter;
          const matchSearch = !selectedSearch || (card.dataset.name || "").includes(selectedSearch);
          card.hidden = !(matchFilter && matchSearch);
        });
      }
      function cardEl(p, index = 0) {
        const stock = Number(p.stock_count || 0), out = stock <= 0;
        const sold = Number(p.terjual || 0), category = productCategory(p), visual = productVisual(p);
        const el = document.createElement("article");
        el.className = "product-card"; el.dataset.category = category;
        el.dataset.name = String(p.name || "").toLowerCase();
        el.dataset.price = Number(p.price || 0);
        el.dataset.sold = sold;
        el.innerHTML = `<div class="product-art ${visual.art}"><img class="product-image" alt="" loading="lazy" decoding="async"><span class="art-label"></span><span class="art-mark"><svg aria-hidden="true"><use href="#${visual.icon}"/></svg></span><span class="art-number"></span></div>` +
          `<div class="product-body"><div class="product-flags"><span class="category-tag"></span><span class="sold-tag"></span></div><h3></h3><p class="product-desc"></p>` +
          `<div class="product-bottom"><span><small class="price-label">${t("price_label")}</small><strong class="price"></strong></span><button class="mini-button" type="button"></button></div>` +
          `<div class="stock-note ${out ? "out" : ""}"><i></i><span></span></div></div>`;
        const productImage = el.querySelector(".product-image");
        productImage.src = visual.image;
        productImage.alt = t("img_alt", { name: p.name || "premium digital" });
        productImage.addEventListener("error", () => productImage.remove(), { once: true });
        el.querySelector(".art-label").textContent = visual.label;
        el.querySelector(".art-number").textContent = `${String(index + 1).padStart(2, "0")} / ${visual.kind}`;
        el.querySelector(".category-tag").textContent = t(CAT_TAG_KEYS[category] || "tag_ai");
        el.querySelector(".sold-tag").textContent = sold > 0 ? t("sold_tag", { n: sold.toLocaleString(dnLocale()) }) : t("premium_product");
        el.querySelector("h3").textContent = p.name || t("premium_product");
        el.querySelector(".product-desc").textContent = dnDescr(p) || t("desc_fallback");
        el.querySelector(".price").textContent = rp(p.price);
        el.querySelector(".stock-note span").textContent = out ? t("stock_out") : t("stock_count", { n: stock });
        const button = el.querySelector("button");
        button.disabled = out; button.textContent = out ? t("stock_out") : t("choose_pkg");
        button.setAttribute("aria-label", (out ? t("stock_out") : t("dlg_buy")) + " " + (p.name || "produk premium"));
        button.onclick = () => { if (!out) openBuy(p); };
        return el;
      }
      document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
        selectedProductFilter = button.dataset.filter || "all";
        applyProductFilter();
      }));
      // Filter awal dari ?f= (kartu kategori di beranda) + pencarian dari ?q= (hero).
      const urlParams = new URLSearchParams(location.search);
      const fParam = urlParams.get("f");
      if (fParam && ["ai", "hiburan", "produktivitas", "finansial"].includes(fParam)) selectedProductFilter = fParam;
      const katSearchEl = $("katSearch");
      const qParam = urlParams.get("q");
      if (qParam) {
        selectedSearch = qParam.trim().toLowerCase();
        if (katSearchEl) katSearchEl.value = qParam;
      }
      if (katSearchEl) katSearchEl.addEventListener("input", () => {
        selectedSearch = katSearchEl.value.trim().toLowerCase();
        applyProductFilter();
      });
      const katSortEl = $("katSort");
      if (katSortEl) katSortEl.addEventListener("change", () => {
        const g = $("productGrid") || $("featuredGrid");
        if (!g) return;
        const modes = {
          laris: (a, b) => Number(b.dataset.sold || 0) - Number(a.dataset.sold || 0),
          murah: (a, b) => Number(a.dataset.price || 0) - Number(b.dataset.price || 0),
          mahal: (a, b) => Number(b.dataset.price || 0) - Number(a.dataset.price || 0),
          nama: (a, b) => (a.dataset.name || "").localeCompare(b.dataset.name || "")
        };
        const cmp = modes[katSortEl.value];
        if (cmp) [...g.querySelectorAll(".product-card")].sort(cmp).forEach(c => g.appendChild(c));
      });
      async function loadProducts() {
        const r = await fetch("/api/products"); const d = await r.json();
        products = d.products || [];
        const db = $("demoBanner"); if (db) db.style.display = d.demo ? "block" : "none";
        const pb = $("payBanner"); if (pb) pb.style.display = (!d.demo && !d.payment_active) ? "block" : "none";
        cryptoActive = !!d.crypto_active; const mu = $("methodUsdt"); if (mu) mu.style.display = cryptoActive ? "" : "none";
        const g = $("productGrid"), fg = $("featuredGrid");
        const empty = '<p style="color:var(--muted)">' + t("catalog_empty") + '</p>';
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
        for (let i = minQty; i <= Math.min(p.stock_count, 10); i++) { const o = document.createElement("option"); o.value = i; o.textContent = dnQty(i); sel.appendChild(o); }
        $("btnPay").disabled = sel.options.length === 0;
        const upd = () => {
          if (!sel.value) { $("formErr").textContent = reseller ? t("reseller_stock_low", { n: p.stock_count }) : t("stock_out_err"); $("dlgTotal").textContent = ""; $("discRow").style.display = "none"; sel.disabled = true; return; }
          $("formErr").textContent = ""; sel.disabled = false;
          const qty = Number(sel.value), normal = p.price * qty;
          const bonus0 = reseller ? (qty > 5 ? 10 : 0) : 0;
          const totalDisc0 = reseller ? Math.min(90, reseller.discount + bonus0) : 0;
          if (reseller && totalDisc0 > 0) {
            const bonus = bonus0;
            const totalDisc = totalDisc0;
            const disc = Math.floor(normal * totalDisc / 100);
            $("discRow").style.display = "block";
            $("discRow").innerHTML = `${t("price_normal")} <s>${rp(normal)}</s> · ${t("disc_reseller")} ${reseller.discount}%${bonus ? " + " + t("bonus_volume") + " " + bonus + "%" : ""} (−${rp(disc)}) · <b>${t("total_pay")} ${rp(normal - disc)}</b>`;
            $("dlgTotal").textContent = t("total_pay") + ": " + rp(normal - disc);
          } else {
            $("discRow").style.display = "none";
            $("dlgTotal").textContent = t("total") + ": " + rp(normal);
          }
        };
        sel.onchange = () => { appliedVoucher = null; $("voucherMsg").textContent = ""; upd(); }; upd();
        $("fVoucher").value = ""; $("voucherMsg").textContent = ""; appliedVoucher = null;
        setPayMethod("qris");
        $("stepForm").style.display = "block"; $("stepPay").style.display = "none"; $("stepDone").style.display = "none";
        $("buyDlg").showModal();
      }
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      async function createInvoice() {
        const email = $("fEmail").value.trim();
        const phone = $("fPhone").value.trim();
        if (!EMAIL_RE.test(email)) { $("formErr").textContent = t("email_invalid"); return; }
        $("btnPay").disabled = true;
        try {
          const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: current.id, qty: Number($("fQty").value), name: $("fName").value.trim(), email, phone, voucher_code: appliedVoucher || "", lang: window.DN_LANG, pay_method: payMethod }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || t("invoice_fail"));
          order = { id: d.order_id, contact: email };
          $("payTotal").textContent = rp(d.total);
          if (d.discount_pct > 0) { $("payDisc").style.display = "block"; $("payDisc").innerHTML = t("disc_applied", { normal: rp(d.normal_total), pct: d.discount_pct - (d.bonus_pct || 0), bonus: d.bonus_pct ? " + " + t("bonus_volume") + " " + d.bonus_pct + "%" : "" }); }
          else if (d.voucher_code) { $("payDisc").style.display = "block"; $("payDisc").innerHTML = t("voucher_applied_pay", { code: d.voucher_code, amt: rp(d.voucher_discount) }); }
          else $("payDisc").style.display = "none";
          $("payOrderId").textContent = d.order_id;
          if (d.pay_method === "usdt" && d.crypto) {
            $("payQrBox").style.display = "none";
            $("cryptoBox").style.display = "block";
            $("cryptoAmount").textContent = d.crypto.amount + " USDT";
            $("cryptoAddr").value = d.crypto.address;
            $("cryptoRate").textContent = t("rate_line", { n: Number(d.crypto.rate).toLocaleString(dnLocale()) });
            $("payHint").textContent = t("pay_hint_usdt");
            $("txMsg").textContent = "";
          } else {
            $("cryptoBox").style.display = "none";
            $("payQrBox").style.display = "";
            if (d.qris_image) $("payQr").src = d.qris_image; else if (d.payment_url) { $("payQr").outerHTML = '<a class="btn" href="' + d.payment_url + '" target="_blank">' + t("open_pay_page") + '</a>'; }
          }
          $("stepForm").style.display = "none"; $("stepPay").style.display = "block";
          startCountdown(d.timeout_ms || 600000); startPolling();
        } catch (e) { $("formErr").textContent = e.message; }
        $("btnPay").disabled = false;
      }
      function setPayMethod(m) {
        payMethod = (m === "usdt" && cryptoActive) ? "usdt" : "qris";
        const bq = $("methodQris"), bu = $("methodUsdt");
        if (bq && bu) {
          bq.className = "btn" + (payMethod === "qris" ? "" : " ghost");
          bu.className = "btn" + (payMethod === "usdt" ? "" : " ghost");
        }
        const bp = $("btnPay"); if (bp) bp.textContent = payMethod === "usdt" ? t("pay_usdt_btn") : t("pay_qris_btn");
      }
      if ($("methodQris")) $("methodQris").onclick = () => setPayMethod("qris");
      if ($("methodUsdt")) $("methodUsdt").onclick = () => setPayMethod("usdt");
      function copyText(txt, btn) {
        const done = () => { if (btn) { const t0 = btn.textContent; btn.textContent = t("copied"); setTimeout(() => { btn.textContent = t0; }, 1500); } };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(done); else done();
      }
      if ($("btnCopyAddr")) $("btnCopyAddr").onclick = (e) => copyText($("cryptoAddr").value, e.target);
      if ($("btnCopyAmount")) $("btnCopyAmount").onclick = (e) => copyText(($("cryptoAmount").textContent || "").replace(" USDT", ""), e.target);
      if ($("btnVerifyTx")) $("btnVerifyTx").onclick = async () => {
        const h = $("txHash").value.trim(), msg = $("txMsg");
        if (!/^0x[0-9a-fA-F]{64}$/.test(h)) { msg.textContent = t("tx_invalid"); return; }
        if (!order) return;
        msg.textContent = t("tx_checking");
        try {
          const r = await fetch("/api/order-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, contact: order.contact, action: "verify-tx", txhash: h }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || t("verify_fail"));
          msg.textContent = t("tx_verified");
          checkStatus();
        } catch (e) { msg.textContent = e.message; }
      };
      function startCountdown(ms) {
        let left = Math.floor(ms / 1000);
        clearInterval(countTimer);
        countTimer = setInterval(() => {
          left -= 1;
          if (left < 0) { clearInterval(countTimer); stopPolling(); $("payErr").textContent = t("expired"); return; }
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
            $("doneInfo").textContent = t("order_summary", { id: d.id, name: d.product_name, qty: dnQty(d.qty) });
            $("doneItems").textContent = d.delivered || t("delivered_fallback");
            $("doneEmail").textContent = d.email_sent ? t("done_email") : "";
            loadProducts();
          } else if (d.status !== "pending") {
            stopPolling(); clearInterval(countTimer);
            $("payErr").textContent = t("order_ended", { status: dnStatus(d.status) });
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
        if (!id || !contact) { $("lookupErr").textContent = t("lookup_empty"); return; }
        const r = await fetch(`/api/order-status?id=${encodeURIComponent(id)}&contact=${encodeURIComponent(contact)}`);
        const d = await r.json();
        if (!r.ok) { $("lookupErr").textContent = d.error || t("not_found"); return; }
        let html = "<p>" + t("lookup_status", { id: d.id, name: d.product_name, status: dnStatus(d.status), total: rp(d.total) }) + "</p>";
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
        if (!code) { msg.textContent = t("voucher_empty"); return; }
        if (!current) return;
        msg.textContent = t("voucher_checking");
        try {
          const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "validate-voucher", productId: current.id, qty: Number($("fQty").value), voucher_code: code }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || t("voucher_invalid"));
          appliedVoucher = d.code;
          msg.textContent = t("voucher_ok", { code: d.code, disc: d.discount_type === "percent" ? d.discount_value + "%" : rp(d.discount_value), amt: rp(d.discount_amount), total: rp(d.total) });
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
