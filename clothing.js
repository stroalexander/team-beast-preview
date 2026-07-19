/* ============================================================
   TEAM BEAST — CLOTHING · shared behavior
   Nav · scroll reveals · cart (localStorage) · drawer · order inquiry
   Loaded on every page. Guards for missing elements so one file is safe
   on pages that don't have a cart/hero/etc.

   Payments are NOT wired yet (by design). "Request order" opens a
   pre-filled email to ORDER_EMAIL with the itemized bag — swap this for
   Stripe or an n8n/email backend later in requestOrder() only.
   ============================================================ */
(function () {
  "use strict";

  /* Where order requests go. */
  const ORDER_EMAIL = "info@teambclothing.com";

  /* ---------------------------------------------------------
     PRODUCT CATALOG — single source of truth for the store.
     `price` (USD cents) drives the cart math + display.
     `priceId` is your Stripe Price ID (price_xxx). Until you
     paste real ones, checkout falls back to a "not wired" notice.
     Add/edit products here; Merch + Creator read from this list.
     --------------------------------------------------------- */
  /* `story` = the backstory shown on clothing-product.html. DRAFT copy —
     Alex: edit freely, it's plain text. `img` (when set) replaces the
     watermark placeholder on cards and the product page. */
  const CATALOG = {
    "kit-darts-pro":   { no: "01", name: "Beast Pro Dart Jersey", sport: "Darts",   price: 6900, priceId: "", spec: "Full sublimation · moisture-wick", img: "",
      story: "The first jersey Team Beast ever cut, and still the one the top of the roster asks for by name. Full-sublimation print means the colors are dyed into the fabric — no cracking, no peeling, no matter how many league nights it survives. Built for the deciding leg: moisture-wicking, cut loose at the shoulder so nothing pulls on your throw." },
    "kit-darts-flight":{ no: "07", name: "Flight League Jersey",  sport: "Darts",   price: 5900, priceId: "", spec: "Sublimated · breathable mesh",   img: "",
      story: "Made for the grinders — the players throwing three nights a week in warm venues. The Flight uses a lighter breathable mesh than the Pro, so it stays cool through a long round-robin. It became the unofficial uniform of Beast league night the first season we ran it." },
    "tee-beast":       { no: "20", name: "Beast Brawl Tee",        sport: "Darts",   price: 3200, priceId: "", spec: "DTF print · ringspun cotton",     img: "",
      story: "Dropped for the first Beast Brawl and reprinted by demand ever since. Heavy ringspun cotton with a DTF beast print that holds its bite wash after wash. This is the shirt in the crowd — if you've been to a Beast event, you've seen a wall of these." },
    "hoodie-storm":    { no: "13", name: "Storm Heavyweight Hoodie",sport: "Team",   price: 7400, priceId: "", spec: "DTF · 380gsm fleece",             img: "",
      story: "Named for the storm the two beasts fight in. 380gsm fleece — genuinely heavyweight, the kind you feel when you pick it up. Made for load-ins, late tear-downs, and cold walks out of the venue after a win. Players wear it over their kit between matches." },
    "kit-bmx":         { no: "05", name: "Beast BMX Race Jersey",  sport: "BMX",     price: 6400, priceId: "", spec: "Sublimated · vented panels",       img: "",
      story: "The Beast leaves the board. Cut longer in the back for the riding position, with vented panels where the heat builds. Our BMX riders took the beast to the gate and this is what they drop in wearing — same storm, different arena." },
    "cap-phoenix":     { no: "26", name: "Phoenix Snapback",       sport: "Team",    price: 2900, priceId: "", spec: "Embroidered · structured 6-panel", img: "",
      story: "The neutral mark that ties both sides of Team Beast together — the Phoenix target, embroidered on a structured 6-panel. Worn by players, ambassadors, and half the crowd. If the jersey says which side you're on, the cap says you're in the family." }
  };
  window.TBC_CATALOG = CATALOG;

  const money = (c) => "$" + (c / 100).toFixed(2).replace(/\.00$/, "");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- toast ---------------- */
  let toastEl = $(".toast"), toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }
  window.TBC_toast = toast;

  /* ---------------- nav ---------------- */
  const nav = $(".tbc-nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    const toggle = $(".nav-toggle", nav);
    if (toggle) toggle.addEventListener("click", () => nav.classList.toggle("menu-open"));
    $$(".tabs a", nav).forEach((a) => a.addEventListener("click", () => nav.classList.remove("menu-open")));
    window.addEventListener("resize", () => { if (window.innerWidth > 760) nav.classList.remove("menu-open"); });
  }

  /* ---------------- scroll reveals ---------------- */
  const reveals = $$(".reveal");
  if (reveals.length && "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion:reduce)").matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* ---------------- year stamp ---------------- */
  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ============================================================
     CART
     ============================================================ */
  const KEY = "tbc_cart_v1";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  const lineId = (id, size) => id + "::" + (size || "OS");

  /* Resolve the product for a cart line — catalog item OR a custom
     creator design (the line itself carries name/price/spec). */
  const lineProduct = (l) => l.custom ? l.custom : (CATALOG[l.id] || {});

  function addToCart(id, size, qty) {
    const p = CATALOG[id]; if (!p) return;
    qty = qty || 1;
    const lid = lineId(id, size);
    const found = cart.find((l) => l.lid === lid);
    if (found) found.qty += qty;
    else cart.push({ lid, id, size: size || "OS", qty });
    save(); renderCart();
    toast(p.name + (size ? " · " + size : "") + " added");
    openDrawer();
  }

  /* Custom creator design → cart. payload = { name, price (cents),
     spec (readable option summary), size, qty, sport } */
  function addCustom(payload) {
    if (!payload || !payload.name || !payload.price) return;
    const lid = "custom::" + Date.now();
    cart.push({
      lid, id: "custom", size: payload.size || "M", qty: payload.qty || 1,
      custom: { name: payload.name, price: payload.price, spec: payload.spec || "", sport: payload.sport || "Custom" }
    });
    save(); renderCart();
    toast(payload.name + " added");
    openDrawer();
  }

  function setQty(lid, delta) {
    const l = cart.find((x) => x.lid === lid); if (!l) return;
    l.qty += delta; if (l.qty < 1) cart = cart.filter((x) => x.lid !== lid);
    save(); renderCart();
  }
  function removeLine(lid) { cart = cart.filter((x) => x.lid !== lid); save(); renderCart(); }
  const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = () => cart.reduce((n, l) => n + (lineProduct(l).price || 0) * l.qty, 0);

  window.TBC_addToCart = addToCart;
  window.TBC_addCustom = addCustom;

  /* drawer + render */
  function ensureDrawer() {
    if ($(".drawer")) return;
    const scrim = document.createElement("div"); scrim.className = "drawer-scrim";
    const drawer = document.createElement("aside"); drawer.className = "drawer"; drawer.setAttribute("aria-label", "Cart");
    drawer.innerHTML =
      '<div class="drawer-head"><h3>Your Kit</h3><button class="drawer-close" aria-label="Close cart">×</button></div>' +
      '<div class="drawer-body"></div>' +
      '<div class="drawer-foot"><div class="sum"><span>Estimated</span><b class="cart-total">$0</b></div>' +
      '<button class="btn btn-primary btn-block" data-checkout>Request order</button>' +
      '<p class="form-note" style="text-align:center;margin-top:12px">Tell us what you need — we reply with a quote &amp; how to pay. No card charged here.</p></div>';
    document.body.appendChild(scrim); document.body.appendChild(drawer);
    scrim.addEventListener("click", closeDrawer);
    $(".drawer-close", drawer).addEventListener("click", closeDrawer);
    $("[data-checkout]", drawer).addEventListener("click", requestOrder);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  }
  function openDrawer() { ensureDrawer(); $(".drawer-scrim").classList.add("open"); $(".drawer").classList.add("open"); }
  function closeDrawer() { const d = $(".drawer"); if (!d) return; d.classList.remove("open"); $(".drawer-scrim").classList.remove("open"); }

  function renderCart() {
    // count badges
    $$(".cart-btn .count").forEach((c) => { const n = cartCount(); c.textContent = n; c.setAttribute("data-n", n); });
    ensureDrawer();
    const body = $(".drawer-body"); if (!body) return;
    if (!cart.length) { body.innerHTML = '<p class="cart-empty">Your kit bag is empty.<br>Pick a jersey and gear up.</p>'; }
    else {
      body.innerHTML = cart.map((l) => {
        const p = lineProduct(l);
        const img = p.img ? '<img class="thumb" src="' + p.img + '" alt="">' : '<span class="thumb"></span>';
        const sub = l.custom ? (p.spec + " · Size " + l.size) : ((p.sport || "") + " · Size " + l.size);
        return '<div class="cart-line">' + img +
          '<div class="info"><b>' + (p.name || l.id) + '</b><span>' + sub + '</span>' +
          '<span class="qty"><button data-dec="' + l.lid + '" aria-label="Decrease">−</button>' + l.qty +
          '<button data-inc="' + l.lid + '" aria-label="Increase">+</button></span>' +
          '<button class="rm" data-rm="' + l.lid + '">Remove</button></div>' +
          '<span class="ln-price">' + money((p.price || 0) * l.qty) + '</span></div>';
      }).join("");
      $$("[data-inc]", body).forEach((b) => b.onclick = () => setQty(b.dataset.inc, 1));
      $$("[data-dec]", body).forEach((b) => b.onclick = () => setQty(b.dataset.dec, -1));
      $$("[data-rm]", body).forEach((b) => b.onclick = () => removeLine(b.dataset.rm));
    }
    const tot = $(".cart-total"); if (tot) tot.textContent = money(cartTotal());
  }

  // open cart from any .cart-btn
  $$(".cart-btn").forEach((b) => b.addEventListener("click", openDrawer));
  renderCart();

  /* ============================================================
     REQUEST ORDER — no payment processing (yet). Opens a pre-filled
     email to ORDER_EMAIL with the itemized bag so the shop can reply
     with a quote and a way to pay. Swap for Stripe / a backend later.
     ============================================================ */
  function requestOrder() {
    if (!cart.length) { toast("Add an item first"); return; }
    const lines = cart.map((l) => {
      const p = lineProduct(l);
      const detail = l.custom && p.spec ? "  |  " + p.spec : "";
      return "- " + (p.name || l.id) + detail + "  |  Size " + l.size + "  x" + l.qty + "  (" + money((p.price || 0) * l.qty) + ")";
    }).join("\n");
    const body =
      "I'd like to request this order from Team Beast Clothing:\n\n" +
      lines + "\n\nEstimated subtotal: " + money(cartTotal()) +
      "\n\n(Custom names/numbers? Add them below.)\n\nName:\nEmail / phone:\nNotes:\n";
    const subject = "Team Beast Clothing - Order request";
    window.location.href = "mailto:" + ORDER_EMAIL +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    toast("Opening your email — we'll confirm & send payment");
  }
  window.TBC_requestOrder = requestOrder;
})();
