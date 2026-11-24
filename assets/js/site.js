/* =========================================================
   Abhay Kumar — shared site runtime
   Injects the header, footer, curtain and "next chapter" block
   from one source so every page stays in sync, and provides
   the motion primitives pages build on (reveal, split, count,
   scroll scenes, page transitions).
   Exposes window.AK for page scripts.
   ========================================================= */
(() => {
  const doc = document.documentElement;
  const body = document.body;
  const root = body.dataset.root || "";             // "" at top level, "../" inside /work/
  const page = body.dataset.page || "home";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reading order of the site. "Next chapter" links follow this sequence.
  const PAGES = [
    { id: "home",   n: "01", label: "Index",  title: "Index",           href: "index.html",      sub: "Where it starts" },
    { id: "work",   n: "02", label: "Work",   title: "Selected Work",   href: "work/index.html", sub: "Research, models and what they taught me" },
    { id: "record", n: "03", label: "Record", title: "The Record",      href: "record.html",     sub: "Experience, leadership and service, in order" },
    { id: "about",  n: "04", label: "About",  title: "About & Contact", href: "about.html",      sub: "The person behind the numbers" },
  ];
  const CASES = [
    { id: "sentiment", n: "02.1", title: "Reading the News", href: "work/sentiment.html", sub: "Does sentiment predict the S&P 500?" },
    { id: "agents",    n: "02.2", title: "Agents at Market", href: "work/agents.html",    sub: "Four AI agents replay a pricing experiment" },
  ];
  const RESUME = root + "assets/docs/Abhay_Kumar_Resume.pdf";
  const EMAIL = "codeabhay3@gmail.com";
  const LINKEDIN = "https://www.linkedin.com/in/abhay-kumar-2501/";

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Header ---------- */
  const navGroup = page === "case" ? "work" : page;
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="${root}index.html" aria-label="Abhay Kumar — home">
        <span class="brand-mark">AK</span><span class="brand-name">Abhay Kumar</span>
      </a>
      <button class="menu-btn" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav class="nav" id="site-nav" aria-label="Primary">
        ${PAGES.map(p => `<a href="${root}${p.href}" ${p.id === navGroup ? 'aria-current="page"' : ""}><span class="n">${p.n}</span>${p.label}</a>`).join("")}
        <a class="btn" href="${RESUME}" target="_blank" rel="noopener" data-no-curtain>Résumé <span class="arr">↗</span></a>
        <button class="theme-toggle" aria-label="Toggle dark mode" title="Toggle theme">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.5" stroke="currentColor"/><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg>
        </button>
      </nav>
    </div>`;
  body.prepend(header);

  const progress = document.createElement("div");
  progress.className = "progress";
  progress.innerHTML = "<i></i>";
  body.prepend(progress);

  /* ---------- Next chapter + footer ---------- */
  const main = document.querySelector("main");
  let next = null;
  if (body.dataset.next) {
    next = [...PAGES, ...CASES].find(p => p.id === body.dataset.next);
  } else {
    const i = PAGES.findIndex(p => p.id === page);
    next = PAGES[(i + 1) % PAGES.length];
  }
  if (next && main && !body.hasAttribute("data-no-next")) {
    const isLoop = next.id === "home";
    const a = document.createElement("a");
    a.className = "next wrap";
    a.href = root + next.href;
    a.innerHTML = `
      <div class="label"><span>${isLoop ? "Back to the beginning" : "Next chapter"}</span><span>${next.n}</span></div>
      <div class="h1"><span>${next.title}</span><span class="arr">→</span></div>
      <div class="sub">${next.sub}</div>`;
    main.after(a);
  }

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="wrap">
      <span class="mono">© ${new Date().getFullYear()} Abhay Kumar · University Park, PA</span>
      <nav aria-label="Footer">
        <a href="mailto:${EMAIL}" data-no-curtain>Email</a>
        <a href="${LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a>
        <a href="${RESUME}" target="_blank" rel="noopener">Résumé (PDF)</a>
      </nav>
    </div>`;
  (document.querySelector(".next") || main || body.lastElementChild).after(footer);

  /* ---------- Curtain (page transitions) ---------- */
  const curtain = document.createElement("div");
  curtain.className = "curtain";
  curtain.setAttribute("aria-hidden", "true");
  curtain.innerHTML = `<div class="curtain-title"><span class="n"></span><span class="t"></span></div>
    <svg class="curtain-line" viewBox="0 0 1000 80" preserveAspectRatio="none"><path d="M0 60 L120 52 L200 58 L300 40 L380 46 L470 30 L560 36 L640 22 L730 28 L820 14 L900 18 L1000 6" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
  body.append(curtain);
  const setCurtain = (n, t) => { curtain.querySelector(".n").textContent = n || ""; curtain.querySelector(".t").textContent = t || ""; };

  // Arriving from an internal link: the inline head script added .is-entering.
  try {
    const stored = JSON.parse(sessionStorage.getItem("ak-t") || "null");
    sessionStorage.removeItem("ak-t");
    if (stored) setCurtain(stored.n, stored.t);
  } catch (e) {}
  let lifted = false;
  const lift = () => {
    if (lifted) return;
    lifted = true;
    if (!doc.classList.contains("is-entering")) return;
    curtain.classList.add("out");
    // Timers, not rAF: rAF can stall in background tabs and leave the page covered.
    setTimeout(() => doc.classList.remove("is-entering"), 20);
    setTimeout(() => curtain.classList.remove("out"), 1200);
  };
  setTimeout(lift, 2500); // safety net if fonts never settle

  const describe = (url) => {
    const path = url.pathname.replace(/\/$/, "/index.html");
    const all = [...PAGES, ...CASES];
    const hit = all.find(p => path.endsWith("/" + p.href)) || (path.endsWith("/index.html") && !path.includes("/work/") ? PAGES[0] : null);
    return hit ? { n: hit.n, t: hit.title } : { n: "", t: "" };
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a || reduce) return;
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target === "_blank" || a.hasAttribute("download") || a.hasAttribute("data-no-curtain")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || /\.(pdf|png|jpg|zip)$/i.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    const d = describe(url);
    setCurtain(d.n, d.t);
    try { sessionStorage.setItem("ak-t", JSON.stringify(d)); } catch (err) {}
    body.classList.remove("menu-open");
    curtain.classList.remove("out");
    curtain.classList.add("in");
    setTimeout(() => { location.href = url.href; }, 680);
  });
  addEventListener("pageshow", (e) => { if (e.persisted) { curtain.classList.remove("in", "out"); doc.classList.remove("is-entering"); } });

  /* ---------- Header behaviour, progress, menu, theme ---------- */
  let lastY = scrollY;
  const menuBtn = header.querySelector(".menu-btn");
  menuBtn.addEventListener("click", () => {
    const open = body.classList.toggle("menu-open");
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.textContent = open ? "Close" : "Menu";
  });
  header.querySelector(".theme-toggle").addEventListener("click", () => {
    const cur = doc.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const nextTheme = cur === "dark" ? "light" : "dark";
    doc.dataset.theme = nextTheme;
    try { localStorage.setItem("ak-theme", nextTheme); } catch (e) {}
    dispatchEvent(new CustomEvent("ak:theme", { detail: nextTheme }));
  });

  /* ---------- Reveal + split + count ---------- */
  document.querySelectorAll("[data-split]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.classList.add("split");
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`).join(" ");
  });

  const countUp = (el) => {
    const end = parseFloat(el.dataset.count);
    const dec = parseInt(el.dataset.decimals || "0", 10);
    const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    if (reduce) { el.textContent = pre + end.toFixed(dec) + suf; return; }
    const dur = 1600, t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / dur);
      const v = end * (1 - Math.pow(1 - k, 4));
      el.textContent = pre + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      el.classList.add("in");
      if (el.dataset.count !== undefined) countUp(el);
      el.dispatchEvent(new CustomEvent("ak:in"));
      io.unobserve(el);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.01 });
  const observe = (scope = document) => scope.querySelectorAll("[data-reveal], .split, [data-count], [data-observe]").forEach((el) => io.observe(el));
  observe();

  /* ---------- Scroll scenes ----------
     <section data-scene style="height:300vh"><div class="sticky">…</div></section>
     JS writes --p (0→1) while the section scrolls past, and calls listeners. */
  const scenes = [...document.querySelectorAll("[data-scene]")].map((el) => ({ el, fns: [], p: -1 }));
  const onScene = (el, fn) => { const s = scenes.find((x) => x.el === el); if (s) { s.fns.push(fn); s.p = -1; request(); } };

  let ticking = false;
  const frame = () => {
    ticking = false;
    const y = scrollY, vh = innerHeight;
    const max = doc.scrollHeight - vh;
    progress.style.setProperty("--read", max > 0 ? (y / max).toFixed(4) : 0);
    header.classList.toggle("is-solid", y > 8);
    if (!body.classList.contains("menu-open")) header.classList.toggle("is-hidden", y > 240 && y > lastY + 2);
    if (y < lastY - 2) header.classList.remove("is-hidden");
    lastY = y;
    scenes.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      const span = Math.max(1, r.height - vh);
      const p = clamp(-r.top / span);
      if (Math.abs(p - s.p) < 0.0005) return;
      s.p = p;
      s.el.style.setProperty("--p", p.toFixed(4));
      s.fns.forEach((fn) => fn(p, s.el));
    });
  };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", () => { scenes.forEach((s) => (s.p = -1)); request(); });

  /* ---------- Ticker: duplicate content for seamless loop ---------- */
  document.querySelectorAll(".ticker-track").forEach((t) => { t.innerHTML += t.innerHTML; });

  window.AK = { clamp, lerp, onScene, observe, reduce, root, EMAIL, LINKEDIN, RESUME, PAGES, CASES,
    css: (name) => getComputedStyle(doc).getPropertyValue(name).trim() };

  const start = () => { lift(); try { frame(); } catch (e) { console.error(e); } };
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]).then(start);
  } else start();
})();
