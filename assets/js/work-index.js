/* =========================================================
   work-index.js — Selected Work
   - Filter chips (animated collapse for rows, FLIP for cards)
   - Floating cursor preview with an animated mini chart (desktop)
   - Expandable rows with the same mini chart (touch / narrow)
   All chart series are synthetic (seeded PRNG) and labelled illustrative.
   ========================================================= */
(() => {
  const AK = window.AK;
  if (!AK) return;
  const { clamp, reduce } = AK;

  /* ---------- Seeded series ---------- */
  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gaussFrom = (r) => () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());

  const SERIES = {
    sent: (() => {
      const g = gaussFrom(mulberry32(2026));
      const N = 90, split = 58, B = [], M = [];
      let b = 0, w = 0;
      for (let i = 0; i < N; i++) {
        b += 0.012 + g() * 0.03; w += g() * 0.012;
        let edge;
        if (i <= split) edge = 0.42 * Math.pow(i / split, 1.15) + w * (i / split);
        else { const u = (i - split) / (N - 1 - split); edge = 0.42 + (-0.16 - 0.42) * (1 - Math.pow(1 - u, 2)) + w * 0.6; }
        B.push(b); M.push(b + edge);
      }
      return { N, split, lines: [{ d: M, c: "--accent", w: 1.5 }, { d: B, c: "--ink", w: 1.5 }] };
    })(),
    agents: (() => {
      const r = mulberry32(77), g = gaussFrom(r);
      const N = 22, target = 0.55, starts = [0.95, 0.2, 0.75, 0.38];
      const cols = ["--accent", "--ink", "--ink-2", "--ink-3"];
      const lines = starts.map((s, j) => {
        const d = []; let p = s;
        for (let i = 0; i < N; i++) { d.push(p); p += (target - p) * (0.18 + 0.05 * j) + g() * 0.025; }
        return { d, c: cols[j], w: 1.5, step: true };
      });
      return { N, split: null, lines };
    })(),
  };

  /* ---------- Mini chart renderer ---------- */
  const fit = (cv) => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  const drawMini = (cv, kind, k) => {
    const f = fit(cv); if (!f) return;
    const { ctx, w, h } = f;
    const S = SERIES[kind];
    ctx.clearRect(0, 0, w, h);
    const pad = { l: 10, r: 10, t: 22, b: 12 };
    const all = S.lines.flatMap((l) => l.d);
    const lo = Math.min(...all), hi = Math.max(...all);
    const X = (i) => pad.l + (i / (S.N - 1)) * (w - pad.l - pad.r);
    const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
    const mono = AK.css("--mono") || "monospace";
    ctx.font = `9px ${mono}`;
    ctx.textBaseline = "top";

    // faint grid
    ctx.strokeStyle = AK.css("--rule"); ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { const y = Math.round(pad.t + (i / 4) * (h - pad.t - pad.b)) + .5; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); }

    if (S.split != null) {
      const sx = Math.round(X(S.split)) + .5;
      ctx.globalAlpha = clamp((k - 0.55) / 0.15);
      ctx.fillStyle = AK.css("--accent-soft"); ctx.fillRect(sx, pad.t - 10, w - pad.r - sx, h - pad.t - pad.b + 10);
      ctx.strokeStyle = AK.css("--ink-3"); ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(sx, pad.t - 12); ctx.lineTo(sx, h - pad.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = AK.css("--ink-3");
      ctx.textAlign = "right"; ctx.fillText("TRAIN", sx - 5, 6);
      ctx.textAlign = "left"; ctx.fillText("TEST", sx + 5, 6);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = AK.css("--ink-3"); ctx.textAlign = "left"; ctx.fillText("ROUNDS →", pad.l, 6);
    }

    const upto = k * (S.N - 1);
    S.lines.forEach((l) => {
      ctx.strokeStyle = AK.css(l.c); ctx.lineWidth = l.w; ctx.lineJoin = "round";
      ctx.beginPath();
      let last = null;
      for (let i = 0; i <= Math.floor(upto); i++) {
        const x = X(i), y = Y(l.d[i]);
        if (i === 0) ctx.moveTo(x, y);
        else if (l.step) { ctx.lineTo(x, Y(l.d[i - 1])); ctx.lineTo(x, y); }
        else ctx.lineTo(x, y);
        last = [x, y];
      }
      const fi = Math.floor(upto), fr = upto - fi;
      if (fr > 0 && fi + 1 < S.N) {
        const x = X(fi + fr), y = l.step ? Y(l.d[fi]) : Y(l.d[fi] + (l.d[fi + 1] - l.d[fi]) * fr);
        ctx.lineTo(x, y); last = [x, y];
      }
      ctx.stroke();
      if (last) { ctx.fillStyle = AK.css(l.c); ctx.beginPath(); ctx.arc(last[0], last[1], 2.2, 0, 7); ctx.fill(); }
    });
  };

  const animate = (cv, kind, dur = 1100) => {
    if (cv._raf) cancelAnimationFrame(cv._raf);
    if (reduce) { drawMini(cv, kind, 1); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = clamp((t - t0) / dur);
      drawMini(cv, kind, 1 - Math.pow(1 - k, 3));
      if (k < 1) cv._raf = requestAnimationFrame(step);
    };
    cv._raf = requestAnimationFrame(step);
  };

  /* ---------- Floating preview (fine pointer only) ---------- */
  const preview = document.getElementById("wi-preview");
  const pCanvas = preview && preview.querySelector("canvas");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  let current = null, tx = 0, ty = 0, x = 0, y = 0, running = false;

  const place = () => {
    const pw = preview.offsetWidth || 300, ph = preview.offsetHeight || 240;
    let nx = tx + 28, ny = ty + 20;
    if (nx + pw > innerWidth - 16) nx = tx - pw - 28;
    if (ny + ph > innerHeight - 16) ny = innerHeight - ph - 16;
    return [nx, ny];
  };
  const follow = () => {
    const [nx, ny] = place();
    x += (nx - x) * (reduce ? 1 : 0.16); y += (ny - y) * (reduce ? 1 : 0.16);
    preview.style.setProperty("--x", x.toFixed(1) + "px");
    preview.style.setProperty("--y", y.toFixed(1) + "px");
    if (current || Math.abs(nx - x) > .5) requestAnimationFrame(follow); else running = false;
  };

  if (preview && pCanvas) {
    document.querySelectorAll(".wi-item[data-preview]").forEach((item) => {
      const row = item.querySelector(".wi-row");
      const show = (e) => {
        if (!fine.matches || innerWidth <= 860) return;
        const first = !current;
        if (e && e.clientX != null) { tx = e.clientX; ty = e.clientY; }
        else { const r = row.getBoundingClientRect(); tx = r.left + r.width * .55; ty = r.top + 10; }
        if (first) { const [nx, ny] = place(); x = nx; y = ny; }
        if (current !== item) {
          current = item;
          preview.querySelector('[data-p="num"]').textContent = row.querySelector(".num").textContent;
          preview.querySelector('[data-p="cap"]').textContent = item.dataset.cap;
          preview.classList.add("is-on");
          requestAnimationFrame(() => animate(pCanvas, item.dataset.preview));
        }
        if (!running) { running = true; requestAnimationFrame(follow); }
      };
      const hide = () => { if (current === item) { current = null; preview.classList.remove("is-on"); } };
      row.addEventListener("mouseenter", show);
      row.addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; if (current !== item) show(e); });
      row.addEventListener("mouseleave", hide);
      row.addEventListener("focus", () => show());
      row.addEventListener("blur", hide);
    });
    addEventListener("scroll", () => { if (current) { current = null; preview.classList.remove("is-on"); } }, { passive: true });
  }

  /* ---------- Expandable rows (touch / narrow) ---------- */
  document.querySelectorAll(".wi-toggle").forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", open);
      panel.classList.toggle("is-open", open);
      if (open) { const cv = panel.querySelector("canvas[data-mini]"); setTimeout(() => animate(cv, cv.dataset.mini, 1300), reduce ? 0 : 180); }
    });
  });

  const redrawAll = () => {
    document.querySelectorAll(".wi-detail.is-open canvas[data-mini]").forEach((cv) => drawMini(cv, cv.dataset.mini, 1));
    if (current && pCanvas) drawMini(pCanvas, current.dataset.preview, 1);
  };
  addEventListener("ak:theme", redrawAll);
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(redrawAll, 120); });

  /* ---------- Filters ---------- */
  const chips = [...document.querySelectorAll(".wi-chip")];
  const items = [...document.querySelectorAll(".wi-item")];
  const cards = [...document.querySelectorAll(".wi-card")];
  const emptyMain = document.getElementById("wi-empty-main");
  const emptyAlso = document.getElementById("wi-empty-also");
  const has = (el, f) => f === "all" || el.dataset.cat.split(" ").includes(f);

  const apply = (f) => {
    // Rows collapse in place via grid-template-rows.
    items.forEach((it) => {
      const on = has(it, f);
      it.classList.toggle("is-out", !on);
      it.setAttribute("aria-hidden", on ? "false" : "true");
      it.querySelectorAll("a, button").forEach((el) => (on ? el.removeAttribute("tabindex") : el.setAttribute("tabindex", "-1")));
    });
    emptyMain.hidden = items.some((it) => has(it, f));

    // Cards: FLIP so the survivors glide into their new slots.
    const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
    const leaving = cards.filter((c) => !has(c, f) && !c.hidden);
    const entering = cards.filter((c) => has(c, f) && c.hidden);
    const finish = () => {
      leaving.forEach((c) => { c.hidden = true; c.classList.remove("is-out"); });
      entering.forEach((c) => { c.hidden = false; c.classList.add("is-out"); });
      const shown = cards.filter((c) => !c.hidden);
      emptyAlso.hidden = shown.length > 0;
      if (!reduce) {
        shown.forEach((c) => {
          const a = before.get(c), b = c.getBoundingClientRect();
          if (!a || entering.includes(c)) return;
          const dx = a.left - b.left, dy = a.top - b.top;
          if (!dx && !dy) return;
          c.style.transition = "none";
          c.style.transform = `translate(${dx}px, ${dy}px)`;
          requestAnimationFrame(() => { c.style.transition = ""; c.style.transform = ""; });
        });
      }
      requestAnimationFrame(() => requestAnimationFrame(() => entering.forEach((c) => c.classList.remove("is-out"))));
    };
    if (reduce || !leaving.length) finish();
    else { leaving.forEach((c) => c.classList.add("is-out")); setTimeout(finish, 320); }
  };

  chips.forEach((chip) => chip.addEventListener("click", () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", c === chip ? "true" : "false"));
    apply(chip.dataset.filter);
  }));
})();
