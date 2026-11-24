/* =========================================================
   Home — hero price line, thesis scene, work mini-charts.
   Series are illustrative (seeded, deterministic) except the sentiment
   work-card chart, which draws the study's real holdout curves
   (traced, from assets/data/sentiment.json).
   ========================================================= */
(() => {
  const AK = window.AK;
  if (!AK) return;
  const { clamp, lerp, reduce } = AK;
  const doc = document.documentElement;

  /* ---------- helpers ---------- */
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (r) => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Market-like walk: volatility clustering, a mid-course drawdown, upward drift. Normalised 0..1.
  const series = (n, seed, { drift = 30, dip = 9, dipAt = 0.55, noise = 0.6 } = {}) => {
    const r = rng(seed);
    const out = [];
    let v = 0, vol = 1;
    for (let i = 0; i < n; i++) {
      vol = clamp(vol * 0.93 + 0.07 * (0.5 + r() * 1.3) + (r() < 0.02 ? 0.5 : 0), 0.4, 1.8);
      v += gauss(r) * vol * noise;
      const k = i / (n - 1);
      out.push(v + drift * k - dip * Math.exp(-Math.pow((k - dipAt) / 0.08, 2)));
    }
    const lo = Math.min(...out), hi = Math.max(...out);
    return out.map((x) => (x - lo) / (hi - lo || 1));
  };
  const pathD = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" ");

  /* =========================================================
     1. Hero — the line draws itself; six real milestones are
        pinned to it. The line's shape is illustrative; the dates
        and roles on the markers are from the résumé.
     ========================================================= */
  const hero = document.querySelector(".hero");
  const cv = hero && hero.querySelector(".hero-canvas");

  // Contact links under the lede come from the shared constants.
  if (hero) {
    const set = (k, v) => hero.querySelectorAll(`[data-ak="${k}"]`).forEach((a) => (a.href = v));
    if (AK.RESUME) set("resume", AK.RESUME);
    if (AK.EMAIL) set("email", "mailto:" + AK.EMAIL);
    if (AK.LINKEDIN) set("linkedin", AK.LINKEDIN);
  }

  if (cv && cv.getContext) {
    const ctx = cv.getContext("2d");
    const N = 220;
    const S = series(N, 18, { drift: 30, dip: 9, dipAt: 0.58 });
    const T0 = Date.UTC(2024, 7, 1), T1 = Date.UTC(2026, 10, 24);   // Aug 2024 → today; the tip is "now"
    const R = AK.root || "";
    const MARKS = [
      { t: Date.UTC(2024, 9, 1), date: "Oct 2024", role: "Senior Student Manager", org: "Penn State Auxiliary & Business Services",
        note: "Labor spend across 200+ weekly shifts; 40+ staff directed per shift.", href: "record.html#r-dining", dest: "the Record" },
      { t: Date.UTC(2025, 1, 15), date: "2025", role: "THON 2025", org: "Administrative lead · 28-member committee",
        note: "Supporting engagement for 700+ dancers. $17.7M raised.", href: "record.html#r-thon", dest: "the Record" },
      { t: Date.UTC(2025, 8, 1), date: "Sep 2025", role: "Nittany Markets & VITA", org: "Member · Volunteer tax preparer",
        note: "Market outlooks for 100+ members; tax returns for students and low-income residents.", href: "record.html#r-nmaa", dest: "the Record" },
      { t: Date.UTC(2026, 0, 1), date: "Jan 2026", role: "News sentiment study", org: "FIN 465 group project",
        note: "6.5M news stories, one Elastic Net, 522 unseen days: −12.95% vs +47.09% buy-and-hold.", href: "work/sentiment.html", dest: "case 02.1" },
      { t: Date.UTC(2026, 4, 1), date: "May 2026", role: "Undergraduate Research Assistant", org: "Smeal College of Business",
        note: "Four AI agents replay a pricing experiment, refined across 20+ trials.", href: "work/agents.html", dest: "case 02.2" },
      { t: Date.UTC(2026, 5, 1), date: "Jun 2026", role: "LEAP Mentor", org: "Learning Edge Academic Program",
        note: "Weekly study groups for ~70 first-year students.", href: "record.html#r-leap", dest: "the Record" },
    ];

    let W = 0, H = 0, dpr = 1, col = {};
    let drawT = reduce ? 1 : 0, t0 = 0, started = reduce;
    let visible = true, raf = 0;
    let active = -1, pinned = false, engaged = false, hideTimer = 0;
    const fine = matchMedia("(hover: hover) and (pointer: fine)");

    const readCols = () => {
      col = { ink: AK.css("--ink"), ink3: AK.css("--ink-3"), rule: AK.css("--rule"), accent: AK.css("--accent"), paper: AK.css("--paper") };
    };
    // On phones the text stacks, so the line lives in the gap between the contact row and the figures.
    const above = hero.querySelector(".hero-contact") || hero.querySelector(".hero-lede"), foot = hero.querySelector(".hero-foot");
    const figs = hero.querySelector(".hero-figs");
    let band = null;
    const measure = () => {
      band = null;
      if (W >= 700 || !above || !foot) return;
      const top = above.offsetTop + above.offsetHeight + 64, bot = foot.offsetTop - 24;
      if (bot - top > 90) band = { top, bot };
    };
    const box = () => {
      const sm = W < 700;
      if (band) return { x0: 0, x1: W * 0.8, top: band.top, bot: band.bot };
      return { x0: 0, x1: W * (sm ? 0.8 : 0.86), top: H * (sm ? 0.44 : 0.4), bot: H * (sm ? 0.74 : 0.88) };
    };
    const px = (b, i) => b.x0 + (b.x1 - b.x0) * (i / (N - 1));
    const py = (b, v) => b.bot - (b.bot - b.top) * v;

    /* ----- Markers: DOM links over the canvas (focusable, tappable, 40px targets) ----- */
    const layer = hero.querySelector(".hero-marks");
    const card = hero.querySelector(".hero-card");
    const cue = hero.querySelector(".hero-cue");
    const cDate = card.querySelector(".hc-date"), cRole = card.querySelector(".hc-role"), cOrg = card.querySelector(".hc-org"),
      cNote = card.querySelector(".hc-note"), cLink = card.querySelector(".hc-link"), cLinkT = card.querySelector(".hc-link-t");
    const els = MARKS.map((m, k) => {
      const a = document.createElement("a");
      a.className = "hm";
      a.href = R + m.href;
      a.tabIndex = k === 0 ? 0 : -1;
      a.setAttribute("aria-describedby", "hero-card-note");
      a.innerHTML = `<span class="sr-only">${m.date} — ${m.role}, ${m.org}</span>`;
      layer.appendChild(a);
      return a;
    });
    // x positions: in date order, proportional to time, then relaxed so neighbours never crowd (May/Jun 2026 sit a month apart).
    let mpos = [];
    const layout = () => {
      const b = box(), L = b.x1 - b.x0;
      const gap = clamp(L * 0.075, 46, 110), lo = Math.max(24, L * 0.05), hi = L * 0.93;
      const xs = MARKS.map((m) => b.x0 + L * ((m.t - T0) / (T1 - T0)));
      // Keep markers clear of the GPA / degree figures where the line runs behind them.
      const hr = hero.getBoundingClientRect(), fr = figs ? figs.getBoundingClientRect() : null;
      const blocked = (x) => {
        if (!fr || !fr.width) return false;
        const i = clamp(Math.round(((x - b.x0) / L) * (N - 1)), 0, N - 1), y = py(b, S[i]);
        return x > fr.left - hr.left - 24 && x < fr.right - hr.left + 24 && y > fr.top - hr.top - 24 && y < fr.bottom - hr.top + 24;
      };
      for (let k = 0; k < xs.length; k++) {
        xs[k] = Math.max(xs[k], k ? xs[k - 1] + gap : lo);
        while (blocked(xs[k]) && xs[k] < hi) xs[k] += 4;
      }
      for (let k = xs.length - 1; k >= 0; k--) xs[k] = Math.min(xs[k], k < xs.length - 1 ? xs[k + 1] - gap : hi);
      mpos = xs.map((x) => {
        const i = clamp(Math.round(((x - b.x0) / L) * (N - 1)), 0, N - 1);
        return { i, x: px(b, i), y: py(b, S[i]) };
      });
      mpos.forEach((p, k) => { els[k].style.left = p.x.toFixed(1) + "px"; els[k].style.top = p.y.toFixed(1) + "px"; });
      // Cue sits just above the tip of the line ("now").
      const tip = { x: px(b, N - 1), y: py(b, S[N - 1]) };
      const cw = cue.offsetWidth || 140;
      const qx = clamp(tip.x - cw + 10, 16, W - cw - 16), qy = tip.y - 40;
      cue.style.setProperty("--qx", qx.toFixed(0) + "px");
      cue.style.setProperty("--qy", qy.toFixed(0) + "px");
      if (active > -1) placeCard(active, false);
    };

    const placeCard = (k, glide) => {
      const p = mpos[k];
      if (!p) return;
      const cw = card.offsetWidth, ch = card.offsetHeight, pad = 16, top = 72;
      let x, y;
      if (W < 700) {
        x = clamp(p.x - cw / 2, pad, W - cw - pad);
        y = p.y - ch - 26 >= top ? p.y - ch - 26 : p.y + 26;
      } else {
        x = p.x + 22; if (x + cw > W - pad) x = p.x - 22 - cw;
        x = clamp(x, pad, W - cw - pad);
        y = p.y - ch - 22; if (y < top) y = p.y + 22;
      }
      y = clamp(y, top, H - ch - 8);
      card.classList.toggle("no-glide", !glide);
      card.style.setProperty("--cx", x.toFixed(0) + "px");
      card.style.setProperty("--cy", y.toFixed(0) + "px");
    };

    const setActive = (k, how) => {
      clearTimeout(hideTimer);
      if (k === active) { if (how === "key") els[k].focus(); return; }
      const wasOpen = active > -1;
      if (active > -1) els[active].classList.remove("is-active");
      active = k;
      const m = MARKS[k];
      els[k].classList.add("is-active");
      cDate.textContent = m.date; cRole.textContent = m.role; cOrg.textContent = m.org; cNote.textContent = m.note;
      cLink.href = R + m.href;
      cLinkT.textContent = "Read";
      cLink.setAttribute("aria-label", `Read more on ${m.dest}`);
      card.classList.remove("swap"); void card.offsetWidth; card.classList.add("swap");
      placeCard(k, wasOpen);
      card.classList.add("is-open");
      card.setAttribute("aria-hidden", "false");
      els.forEach((e, j) => (e.tabIndex = j === k ? 0 : -1));
      if (how === "key") els[k].focus();
      if (!engaged) { engaged = true; cue.classList.add("is-done"); }
      kick();
    };
    const clear = () => {
      clearTimeout(hideTimer);
      if (active > -1) els[active].classList.remove("is-active");
      active = -1; pinned = false;
      card.classList.remove("is-open");
      card.setAttribute("aria-hidden", "true");
      kick();
    };
    const hideSoon = () => { clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (!pinned) clear(); }, 260); };

    // Pointer (mouse/pen): snap to the nearest drawn marker while the pointer is over the line's band.
    const nearZone = (x, y) => {
      const b = box();
      return y >= b.top - 90 && y <= b.bot + 70 && x <= b.x1 + 60;
    };
    hero.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      if (card.contains(e.target)) { clearTimeout(hideTimer); return; }
      if (e.target.closest("a:not(.hm)")) return;
      const rc = hero.getBoundingClientRect();
      const x = e.clientX - rc.left, y = e.clientY - rc.top;
      const near = nearZone(x, y);
      hero.classList.toggle("is-near", near);
      if (!near) { if (!pinned) hideSoon(); return; }
      let best = -1, bd = Infinity;
      mpos.forEach((p, k) => { if (!els[k].classList.contains("on")) return; const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = k; } });
      if (best > -1) { pinned = false; setActive(best, "hover"); }
    });
    hero.addEventListener("pointerleave", () => { hero.classList.remove("is-near"); if (!pinned) hideSoon(); });

    // Touch: tap a marker to open its card (tap again, or anywhere else, to close). Mouse click follows the link.
    let lastType = "mouse";
    els.forEach((a, k) => {
      a.addEventListener("pointerdown", (e) => { lastType = e.pointerType; });
      a.addEventListener("click", (e) => {
        if (lastType !== "touch") return;               // mouse/keyboard: it's a link — go read
        e.preventDefault();
        if (active === k && pinned) clear(); else { setActive(k, "tap"); pinned = true; }
        lastType = "mouse";
      });
      a.addEventListener("focus", () => { if (a.matches(":focus-visible")) { forceDrawn(); setActive(k, "focus"); pinned = true; } });
      a.addEventListener("keydown", (e) => {
        const n = els.length;
        let to = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (k + 1) % n;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (k - 1 + n) % n;
        else if (e.key === "Home") to = 0;
        else if (e.key === "End") to = n - 1;
        else if (e.key === "Escape") { clear(); return; }
        if (to < 0) return;
        e.preventDefault();
        pinned = true;
        setActive(to, "key");
      });
    });
    hero.addEventListener("focusout", (e) => {
      if (e.relatedTarget && (layer.contains(e.relatedTarget) || card.contains(e.relatedTarget))) return;
      if (pinned && lastType !== "touch") { pinned = false; hideSoon(); }
    });
    document.addEventListener("pointerdown", (e) => {
      if (active < 0) return;
      if (layer.contains(e.target) || card.contains(e.target)) return;
      if (e.pointerType === "touch" || pinned) clear();
    });

    const forceDrawn = () => { if (drawT < 1) { drawT = 1; started = true; } els.forEach((a) => a.classList.add("on")); };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      measure();
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
    };

    const render = (now) => {
      ctx.clearRect(0, 0, W, H);
      const b = box();
      const reach = easeIO(drawT) * (N - 1);
      const last = Math.floor(reach);
      const frac = reach - last;

      // Gridlines only — no axis numbers: the line is a trajectory, not a quote.
      ctx.save();
      ctx.globalAlpha = clamp(drawT * 3);
      ctx.strokeStyle = col.rule; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
      for (let g = 0; g <= 3; g++) {
        const y = Math.round(py(b, g / 3)) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();

      const pts = [];
      for (let i = 0; i <= last; i++) pts.push([px(b, i), py(b, S[i])]);
      if (last < N - 1 && frac > 0) pts.push([px(b, last + frac), py(b, lerp(S[last], S[last + 1], frac))]);
      if (pts.length < 2) return;
      const tip = pts[pts.length - 1];

      // Soft wash under the line.
      ctx.save();
      const grad = ctx.createLinearGradient(0, b.top, 0, H);
      grad.addColorStop(0, col.accent); grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.06;
      ctx.beginPath(); ctx.moveTo(pts[0][0], H);
      pts.forEach((p) => ctx.lineTo(p[0], p[1]));
      ctx.lineTo(tip[0], H); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.restore();

      // Active milestone: a quiet drop-line to the baseline.
      if (active > -1 && mpos[active]) {
        const p = mpos[active], x = Math.round(p.x) + 0.5;
        ctx.save();
        ctx.strokeStyle = col.accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(x, p.y + 8); ctx.lineTo(x, Math.min(H, b.bot + 40)); ctx.stroke();
        ctx.restore();
      }

      // The line.
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.stroke();

      // Tip: a pulsing dot — "now".
      const pulse = reduce ? 0.35 : ((now || 0) % 2000) / 2000;
      if (!reduce) {
        ctx.beginPath(); ctx.arc(tip[0], tip[1], 4 + pulse * 14, 0, Math.PI * 2);
        ctx.fillStyle = col.accent; ctx.globalAlpha = (1 - pulse) * 0.28; ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 3.5, 0, Math.PI * 2);
      ctx.fillStyle = col.accent; ctx.fill();

      // Markers appear as the line reaches them.
      mpos.forEach((p, k) => { if (p.i <= reach) els[k].classList.add("on"); });
      if (drawT >= 1 && !cue.classList.contains("is-on")) setTimeout(() => cue.classList.add("is-on"), reduce ? 0 : 500);
    };

    const loop = (now) => {
      raf = 0;
      if (started && drawT < 1) drawT = clamp((now - t0) / 2200);
      render(now);
      if (visible && !reduce) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (reduce) render(0); else if (!raf && visible) raf = requestAnimationFrame(loop); };

    const setCue = () => {
      cue.querySelector(".hero-cue-t").textContent = fine.matches ? "Hover the line" : "Tap the markers";
    };
    setCue();
    if (fine.addEventListener) fine.addEventListener("change", () => { setCue(); layout(); });

    readCols(); resize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { resize(); kick(); });
    if (reduce) {
      forceDrawn();
      render(0);
    } else {
      // Wait for the page curtain (if arriving from another page) before drawing.
      const delay = doc.classList.contains("is-entering") ? 900 : 250;
      setTimeout(() => { started = true; t0 = performance.now(); }, delay);
      kick();
    }

    new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }).observe(hero);
    addEventListener("resize", () => { resize(); kick(); });
    addEventListener("ak:theme", () => { requestAnimationFrame(() => { readCols(); render(performance.now()); }); });

    const scue = hero.querySelector(".scroll-cue");
    if (scue) scue.addEventListener("click", (e) => {
      const t = document.getElementById("thesis");
      if (!t) return;
      e.preventDefault();
      scrollTo({ top: t.getBoundingClientRect().top + scrollY, behavior: reduce ? "auto" : "smooth" });
    });
  }

  /* =========================================================
     3. The Thesis — belief, model, held-out reality.
     ========================================================= */
  const th = document.querySelector(".thesis");
  if (th) {
    const SPLIT = 560;
    const H1 = series(130, 102, { drift: 22, dip: 6, dipAt: 0.45 });
    const hist = H1.map((v, i) => [(SPLIT * i) / (H1.length - 1), 370 - v * 200]);
    const y0 = hist[hist.length - 1][1];
    const r2 = rng(99);
    const M = 90;
    const model = [], act = [];
    let w = 0;
    for (let i = 0; i < M; i++) {
      const k = i / (M - 1), x = SPLIT + (1000 - SPLIT) * k;
      model.push([x, y0 - Math.pow(k, 1.15) * (y0 - 60) + Math.sin(k * 9) * 3]);
      w += gauss(r2) * 6 + 0.35;
      w = clamp(w, -45, 70);
      act.push([x, y0 + w * smooth(0, 0.08, k)]);
    }
    act[0][1] = y0; model[0][1] = y0;

    const $ = (s) => th.querySelector(s);
    $(".th-hist").setAttribute("d", pathD(hist));
    $(".th-model").setAttribute("d", pathD(model));
    $(".th-act").setAttribute("d", pathD(act));
    $(".th-gap").setAttribute("d", pathD(model.concat(act.slice().reverse())) + " Z");
    const cH = $("#th-c-h rect"), cM = $("#th-c-m rect"), cA = $("#th-c-a rect");
    const split = $(".th-split"), gap = $(".th-gap"), mPath = $(".th-model");
    const tSplit = $(".th-tag-split"), tModel = $(".th-tag-model"), tAct = $(".th-tag-act");
    const dInk = $(".th-dot-ink"), dAcc = $(".th-dot-acc");
    const sts = [...th.querySelectorAll(".thesis-st")];
    const countN = $(".thesis-count-n");
    const ticks = [...th.querySelectorAll(".thesis-ticks i")];

    const pos = (el, p) => { el.style.left = p[0] / 10 + "%"; el.style.top = p[1] / 4 + "%"; };
    const at = (pts, x) => {
      const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
      const f = clamp((x - x0) / (x1 - x0)) * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(f));
      return [x, lerp(pts[i][1], pts[i + 1][1], f - i)];
    };
    pos(tSplit, [SPLIT, 0]);
    pos(tModel, model[M - 1]);
    pos(tAct, act[M - 1]);

    const update = (p) => {
      const h = lerp(0.62, 1, smooth(0, 0.3, p));   // opens ~35% drawn (of the full width) so the first screen is never empty
      const m = smooth(0.36, 0.62, p);
      const a = smooth(0.68, 0.92, p);
      cH.setAttribute("width", (SPLIT * h + 2).toFixed(1));
      cM.setAttribute("width", ((1000 - SPLIT) * m + 2 * (m > 0)).toFixed(1));
      cA.setAttribute("width", ((1000 - SPLIT) * a + 2 * (a > 0)).toFixed(1));
      split.style.opacity = smooth(0.3, 0.38, p);
      tSplit.style.opacity = smooth(0.3, 0.38, p);
      tModel.style.opacity = smooth(0.55, 0.62, p);
      tAct.style.opacity = smooth(0.86, 0.93, p);
      gap.style.opacity = smooth(0.8, 0.96, p);
      mPath.style.opacity = 1 - 0.45 * smooth(0.75, 0.95, p);

      // Ink dot rides the head of whichever ink line is drawing; accent dot the model.
      const inkHead = a > 0 ? at(act, SPLIT + (1000 - SPLIT) * a) : at(hist, SPLIT * h);
      pos(dInk, inkHead);
      dInk.style.opacity = 1;
      pos(dAcc, at(model, SPLIT + (1000 - SPLIT) * m));
      dAcc.style.opacity = m > 0.01 ? 1 : 0;

      // Statements.
      const k = p * 3.0;
      let cur = 0;
      sts.forEach((el, i) => {
        const enter = i === 0 ? 1 : smooth(i - 0.12, i + 0.12, k);
        const exit = i === sts.length - 1 ? 1 : 1 - smooth(i + 0.7, i + 0.92, k);
        const o = enter * exit;
        const y = (1 - enter) * 48 - (1 - exit) * 48;
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
        el.style.filter = o > 0.98 ? "none" : `blur(${((1 - o) * 8).toFixed(2)}px)`;
        el.style.visibility = o < 0.01 ? "hidden" : "visible";
        if (o > 0.5) cur = i;
      });
      countN.textContent = "0" + (cur + 1);
      ticks.forEach((t, i) => t.style.setProperty("--f", clamp(k - i).toFixed(3)));
    };

    if (reduce) {
      th.classList.add("is-static");
      update(1);
      ticks.forEach((t) => t.style.setProperty("--f", 1));
      countN.textContent = "03";
    } else {
      update(0);
      AK.onScene(th, (p) => update(p));
    }
  }

  /* =========================================================
     5. Work cards — mini-charts redraw on hover.
     ========================================================= */
  const SVGNS = "http://www.w3.org/2000/svg";
  const mk = (svg, d, cls) => {
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", d); p.setAttribute("class", cls);
    if (svg._clip) p.setAttribute("clip-path", `url(#${svg._clip})`);
    svg.appendChild(p);
    return p;
  };
  let clipN = 0;
  const dot = (wrap, pt, cls) => {
    const i = document.createElement("i");
    i.className = "m-dot " + (cls || "");
    i.style.left = (pt[0] / 300) * 100 + "%"; i.style.top = (pt[1] / 120) * 100 + "%";
    wrap.appendChild(i);
  };

  document.querySelectorAll(".case").forEach((card) => {
    const svg = card.querySelector(".mini");
    const wrap = card.querySelector(".case-chart");
    if (!svg || !wrap) return;
    const kind = svg.dataset.kind;
    // Lines are revealed by a clip rect (dash tricks break under non-scaling strokes).
    const cp = document.createElementNS(SVGNS, "clipPath");
    const cid = "mc-clip-" + ++clipN;
    cp.setAttribute("id", cid);
    const cr = document.createElementNS(SVGNS, "rect");
    cr.setAttribute("x", "-4"); cr.setAttribute("y", "-10"); cr.setAttribute("height", "140"); cr.setAttribute("width", "308");
    cp.appendChild(cr); svg.appendChild(cp);
    svg._clip = cid;

    if (kind === "sentiment") {
      // Real holdout curves (Jan 2024 – Jan 2026), traced from the study's chart.
      fetch((AK.root || "") + "assets/data/sentiment.json")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => {
          const rows = d.holdout.rows, n = rows.length;
          const vals = rows.flatMap((r) => [r[1], r[2]]);
          const lo = Math.min(...vals), hi = Math.max(...vals);
          const sx = (i) => (300 * i) / (n - 1), sy = (v) => 110 - ((v - lo) / (hi - lo)) * 92;
          const bh = rows.map((r, i) => [sx(i), sy(r[1])]);
          const st = rows.map((r, i) => [sx(i), sy(r[2])]);
          const ln = document.createElementNS(SVGNS, "line");   // starting level: $1
          ln.setAttribute("x1", 0); ln.setAttribute("x2", 300); ln.setAttribute("y1", sy(1)); ln.setAttribute("y2", sy(1));
          ln.setAttribute("class", "m-split");
          svg.insertBefore(ln, svg.firstChild.nextSibling);
          mk(svg, pathD(bh), "m-ink");
          mk(svg, pathD(st), "m-acc");
          dot(wrap, bh[n - 1]); dot(wrap, st[n - 1], "acc");
          const lab = document.createElement("span");
          lab.className = "m-oos"; lab.style.left = "0%"; lab.textContent = "Holdout · 2024–26";
          wrap.appendChild(lab);
          svg.setAttribute("aria-label", "Holdout, Jan 2024 to Jan 2026: buy-and-hold rises to +47.09%; the sentiment strategy ends at −12.95%.");
        })
        .catch(() => {
          const lab = document.createElement("span");
          lab.className = "m-oos"; lab.style.left = "0%"; lab.textContent = "Holdout: −12.95% vs +47.09%";
          wrap.appendChild(lab);
        });
    } else if (kind === "agents") {
      const rounds = 20, sx = (j) => 6 + (288 * j) / (rounds - 1);
      const r4 = rng(31);
      const starts = [22, 48, 82, 104], target = 62;
      const cls = ["m-ink", "m-ink2", "m-ink3", "m-acc"], dcls = ["", "ink2", "ink3", "acc"];
      starts.forEach((s, a) => {
        const pts = [];
        let y = s;
        for (let j = 0; j < rounds; j++) {
          if (j) y = y + (target - y) * 0.22 + gauss(r4) * 4;
          const yy = clamp(y, 8, 114);
          if (j) pts.push([sx(j), pts[pts.length - 1][1]]); // step: price holds until the next round
          pts.push([sx(j), yy]);
        }
        mk(svg, pathD(pts), cls[a]);
        dot(wrap, pts[pts.length - 1], dcls[a]);
      });
    }

    let anim = 0;
    const play = () => {
      if (reduce) return;
      card.classList.remove("play");
      void card.offsetWidth;
      card.classList.add("play");
      cancelAnimationFrame(anim);
      const t0 = performance.now();
      const step = (t) => {
        const k = clamp((t - t0) / 1300);
        cr.setAttribute("width", (308 * (1 - Math.pow(1 - k, 3))).toFixed(1));
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    };
    card.addEventListener("ak:in", play);
    card.addEventListener("pointerenter", play);
    card.addEventListener("focus", play);
    card.addEventListener("pointermove", (e) => {
      const rc = wrap.getBoundingClientRect();
      wrap.style.setProperty("--x", clamp((e.clientX - rc.left) / rc.width) * 100 + "%");
    });
  });

  /* =========================================================
     6. Off the clock — a flight path draws, the plane flies it.
     ========================================================= */
  const off = document.querySelector(".off-strip");
  if (off) {
    const path = off.querySelector(".off-path"), plane = off.querySelector(".off-plane");
    const L = path.getTotalLength ? path.getTotalLength() : 0;
    const put = (k) => {
      if (!L) return;
      const a = path.getPointAtLength(L * k), b = path.getPointAtLength(Math.min(L, L * k + 1));
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      plane.setAttribute("transform", `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
      path.style.strokeDashoffset = (1 - k).toFixed(4);
      plane.style.opacity = k > 0.01 && k < 0.995 ? 1 : 0;
    };
    let anim = 0;
    const fly = () => {
      if (reduce || !L) { put(1); return; }
      cancelAnimationFrame(anim);
      const t0 = performance.now();
      const step = (t) => {
        const k = clamp((t - t0) / 2000);
        put(easeIO(k));
        if (k < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    };
    put(reduce ? 1 : 0);
    off.addEventListener("ak:in", fly);
    off.addEventListener("pointerenter", fly);
  }

  /* =========================================================
     7. Contents — a small sparkline per chapter, drawn on hover.
     ========================================================= */
  const SPARKS = {
    "index.html": () => series(40, 18, { drift: 30, dip: 9, dipAt: 0.58 }),                          // the cover line
    "work/index.html": () => Array.from({ length: 40 }, (_, i) => { const k = i / 39;                 // promise, then held-out reality
      return k < 0.6 ? 0.15 + k * 1.2 : 0.87 - (k - 0.6) * 1.3 + Math.sin(i * 1.7) * 0.03; }),
    "record.html": () => Array.from({ length: 40 }, (_, i) => 0.08 + Math.floor(i / 7) * 0.17),        // steps up, entry by entry
    "about.html": () => Array.from({ length: 40 }, (_, i) => { const k = i / 39; return 0.15 + Math.sin(k * Math.PI) * 0.75; }), // a flight arc
  };
  document.querySelectorAll(".toc > li > .toc-row").forEach((row) => {
    const href = row.getAttribute("href") === "#main" ? "index.html" : row.getAttribute("href");
    const mkS = SPARKS[href];
    const fill = row.querySelector(".toc-fill");
    if (!mkS || !fill) return;
    const v = mkS(), w = 132, h = 34;
    const pts = v.map((y, i) => [2 + ((w - 4) * i) / (v.length - 1), h - 3 - clamp(y) * (h - 8)]);
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "toc-spark");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(SVGNS, "path");
    p.setAttribute("d", pathD(pts)); p.setAttribute("pathLength", "1");
    const c = document.createElementNS(SVGNS, "circle");
    const e = pts[pts.length - 1];
    c.setAttribute("cx", e[0]); c.setAttribute("cy", e[1]); c.setAttribute("r", "2.5");
    svg.append(p, c);
    fill.appendChild(svg);
  });
})();
