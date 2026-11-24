/* =========================================================
   Home — hero price line, thesis scene, work mini-charts.
   All series here are illustrative (seeded, deterministic):
   they show the shape of an idea, never real market data.
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
     1. Hero — the line draws itself, then quotes live.
     ========================================================= */
  const hero = document.querySelector(".hero");
  const cv = hero && hero.querySelector(".hero-canvas");
  if (cv && cv.getContext) {
    const ctx = cv.getContext("2d");
    const N = 220;
    const S = series(N, 18, { drift: 30, dip: 9, dipAt: 0.58 });
    const r = rng(7);
    const T0 = Date.UTC(2024, 8, 3), T1 = Date.UTC(2026, 10, 24);
    const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const dateAt = (i) => {
      const d = new Date(T0 + (T1 - T0) * (i / (N - 1)));
      return String(d.getUTCDate()).padStart(2, "0") + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear();
    };
    const idx = (v) => (92 + v * 50).toFixed(2);

    let W = 0, H = 0, dpr = 1, col = {};
    let drawT = reduce ? 1 : 0, t0 = 0, started = reduce;
    let tipOff = 0, tipTarget = 0, tipDir = 1, nextQuote = 0;
    let pointer = { on: false, x: 0, y: 0 };
    let visible = true, raf = 0;

    const readCols = () => {
      col = { ink: AK.css("--ink"), ink2: AK.css("--ink-2"), ink3: AK.css("--ink-3"), rule: AK.css("--rule"),
        accent: AK.css("--accent"), paper: AK.css("--paper"), up: AK.css("--up"), down: AK.css("--down") };
    };
    // On phones the text stacks, so the line lives in the gap between the lede and the figures.
    const lede = hero.querySelector(".hero-lede"), foot = hero.querySelector(".hero-foot");
    let band = null;
    const measure = () => {
      band = null;
      if (W >= 700 || !lede || !foot) return;
      const top = lede.offsetTop + lede.offsetHeight + 56, bot = foot.offsetTop - 28;
      if (bot - top > 90) band = { top, bot };
    };
    const box = () => {
      const sm = W < 700;
      if (band) return { x0: 0, x1: W * 0.78, top: band.top, bot: band.bot };
      return { x0: 0, x1: W * (sm ? 0.8 : 0.86), top: H * (sm ? 0.44 : 0.4), bot: H * (sm ? 0.74 : 0.88) };
    };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      measure();
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const val = (i, last) => S[i] + (i === last && drawT >= 1 ? tipOff : 0);

    const render = (now) => {
      ctx.clearRect(0, 0, W, H);
      const b = box();
      const px = (i) => b.x0 + (b.x1 - b.x0) * (i / (N - 1));
      const py = (v) => b.bot - (b.bot - b.top) * v;
      const reach = easeIO(drawT) * (N - 1);
      const last = Math.floor(reach);
      const frac = reach - last;
      const mono = (sz, w = 400) => `${w} ${sz}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;

      // Gridlines + index labels (fade in with the draw).
      ctx.save();
      ctx.globalAlpha = clamp(drawT * 3);
      ctx.strokeStyle = col.rule; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
      ctx.font = mono(10); ctx.fillStyle = col.ink3; ctx.textAlign = "right";
      for (let g = 0; g <= 3; g++) {
        const v = g / 3, y = Math.round(py(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.fillText(idx(v).replace(/\.\d+$/, ""), W - 16, y - 6);
      }
      ctx.restore();

      // Build visible polyline.
      const pts = [];
      for (let i = 0; i <= last; i++) pts.push([px(i), py(val(i, N - 1))]);
      if (last < N - 1 && frac > 0) {
        const v = lerp(S[last], S[last + 1], frac);
        pts.push([px(last + frac), py(v)]);
      }
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

      // The line.
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.stroke();

      // Tip: a live quote.
      const pulse = reduce ? 0.35 : ((now || 0) % 1800) / 1800;
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 4 + pulse * 14, 0, Math.PI * 2);
      ctx.fillStyle = col.accent; ctx.globalAlpha = (1 - pulse) * 0.28; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 3.5, 0, Math.PI * 2);
      ctx.fillStyle = col.accent; ctx.fill();
      if (drawT >= 1) {
        const v = val(N - 1, N - 1);
        ctx.font = mono(11, 500); ctx.textAlign = "left";
        const txt = "LAST " + idx(v);
        const arrow = tipDir >= 0 ? " ▲" : " ▼";
        const tw = ctx.measureText(txt).width;
        let lx = tip[0] + 14;
        if (lx + tw + 24 > W - 8) lx = tip[0] - 14 - tw - 18;
        ctx.fillStyle = col.ink; ctx.fillText(txt, lx, tip[1] + 4);
        ctx.fillStyle = tipDir >= 0 ? col.up : col.down; ctx.fillText(arrow, lx + tw, tip[1] + 4);
        ctx.font = mono(9); ctx.fillStyle = col.ink3; ctx.fillText("LIVE · ILLUSTRATIVE", lx, tip[1] - 10);
      }

      // Crosshair readout.
      if (pointer.on && drawT > 0.05) {
        const i = clamp(Math.round(((pointer.x - b.x0) / (b.x1 - b.x0)) * (N - 1)), 0, Math.max(0, last));
        const x = px(i), v = val(i, N - 1), y = py(v);
        ctx.save();
        ctx.strokeStyle = col.ink3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = col.paper; ctx.fill(); ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5; ctx.stroke();
        const prev = val(Math.max(0, i - 1), N - 1);
        const l1 = dateAt(i), l2 = "IDX " + idx(v), up = v >= prev;
        ctx.font = mono(11, 500);
        const bw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2 + " ▲").width) + 20, bh = 44;
        let bx = x + 14, by = y - bh - 14;
        if (bx + bw > W - 8) bx = x - 14 - bw;
        if (by < 72) by = y + 14;
        ctx.fillStyle = col.paper; ctx.strokeStyle = col.rule; ctx.lineWidth = 1;
        ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.textAlign = "left";
        ctx.font = mono(10); ctx.fillStyle = col.ink3; ctx.fillText(l1, bx + 10, by + 17);
        ctx.font = mono(11, 500); ctx.fillStyle = col.ink; ctx.fillText(l2, bx + 10, by + 34);
        ctx.fillStyle = up ? col.up : col.down;
        ctx.fillText(up ? " ▲" : " ▼", bx + 10 + ctx.measureText(l2).width, by + 34);
        ctx.restore();
      }
    };

    const loop = (now) => {
      raf = 0;
      if (started && drawT < 1) drawT = clamp((now - t0) / 2200);
      if (drawT >= 1 && now > nextQuote) {
        const nt = (r() - 0.5) * 0.05;
        tipDir = nt >= tipTarget ? 1 : -1;
        tipTarget = nt;
        nextQuote = now + 700 + r() * 900;
      }
      tipOff += (tipTarget - tipOff) * 0.06;
      render(now);
      if (visible) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (reduce) render(0); else if (!raf && visible) raf = requestAnimationFrame(loop); };

    readCols(); resize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); kick(); });
    if (reduce) {
      render(0);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render(0));
    } else {
      // Wait for the page curtain (if arriving from another page) before drawing.
      const delay = doc.classList.contains("is-entering") ? 900 : 250;
      setTimeout(() => { started = true; t0 = performance.now(); }, delay);
      kick();
    }

    new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }).observe(hero);
    addEventListener("resize", () => { resize(); kick(); if (reduce) render(0); });
    addEventListener("ak:theme", () => { requestAnimationFrame(() => { readCols(); render(performance.now()); }); });
    hero.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const rc = hero.getBoundingClientRect();
      pointer = { on: true, x: e.clientX - rc.left, y: e.clientY - rc.top };
      kick();
    });
    hero.addEventListener("pointerleave", () => { pointer.on = false; kick(); });

    const cue = hero.querySelector(".scroll-cue");
    if (cue) cue.addEventListener("click", (e) => {
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
      const h = lerp(0.16, 1, smooth(0, 0.3, p));
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
      const n = 80, cut = 48, sx = (i) => (300 * i) / (n - 1);
      const bh = series(n, 349, { drift: 18, dip: 4, dipAt: 0.4 }).map((v, i) => [sx(i), 108 - v * 92]);
      const r3 = rng(5);
      const st = [];
      let off = 0;
      for (let i = 0; i < n; i++) {
        if (i < cut) off = -14 * (i / cut) + gauss(r3) * 1.2;           // in-sample: looks better
        else off += 1.25 + gauss(r3) * 1.6;                             // held-out: gives it back
        st.push([sx(i), clamp(bh[i][1] + off, 6, 116)]);
      }
      const ln = document.createElementNS(SVGNS, "line");
      ln.setAttribute("x1", sx(cut)); ln.setAttribute("x2", sx(cut)); ln.setAttribute("y1", 0); ln.setAttribute("y2", 120);
      ln.setAttribute("class", "m-split");
      svg.appendChild(ln);
      mk(svg, pathD(bh), "m-ink");
      mk(svg, pathD(st), "m-acc");
      dot(wrap, bh[n - 1]); dot(wrap, st[n - 1], "acc");
      const lab = document.createElement("span");
      lab.className = "m-oos"; lab.style.left = (sx(cut) / 300) * 100 + "%"; lab.textContent = "OUT-OF-SAMPLE →";
      wrap.appendChild(lab);
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
})();
