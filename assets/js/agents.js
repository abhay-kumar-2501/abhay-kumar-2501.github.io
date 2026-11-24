/* =========================================================
   Case 02.2 — Agents at Market
   1) Market playground: a TOY model of four agents (two informed,
      two uninformed) sending offers to a market. Illustrative only;
      not the research code or its results.
   2) Iteration scene: a stack of trial cards driven by scroll.
   ========================================================= */
(() => {
  const AK = window.AK;
  if (!AK) return;
  const { clamp, lerp, reduce } = AK;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const pad2 = (n) => String(n).padStart(2, "0");

  // Small seeded PRNG so every reset replays the same toy market.
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = (rnd) => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  let C = {};
  const readColors = () => {
    C = { paper: AK.css("--paper"), paper2: AK.css("--paper-2"), ink: AK.css("--ink"), ink2: AK.css("--ink-2"), ink3: AK.css("--ink-3"),
      rule: AK.css("--rule"), accent: AK.css("--accent"), soft: AK.css("--accent-soft") };
  };
  readColors();

  const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';

  const fitCanvas = (cv) => {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };

  /* =======================================================
     1) Market playground
     ======================================================= */
  const fig = document.getElementById("ag-play");
  if (fig) {
    const netCv = fig.querySelector(".ag-net");
    const chartCv = fig.querySelector(".ag-chart");
    const runBtn = fig.querySelector(".ag-run");
    const autoBtn = fig.querySelector(".ag-auto");
    const resetBtn = fig.querySelector(".ag-reset");
    const gapIn = fig.querySelector("#ag-gap");
    const gapOut = fig.querySelector("#ag-gap-out");
    const rulesIn = [...fig.querySelectorAll('input[name="ag-rules"]')];
    const rulesDesc = fig.querySelector(".ag-rules-desc");
    const live = fig.querySelector("#ag-live");
    const ro = {};
    fig.querySelectorAll("[data-ro]").forEach((el) => (ro[el.dataset.ro] = el));

    const AGENTS = [
      { id: "A1", informed: true }, { id: "A2", informed: true },
      { id: "A3", informed: false }, { id: "A4", informed: false },
    ];
    const RULE_TEXT = {
      v1: "v1: price is the average of all offers.",
      v2: "v2: price clears at the median offer, within a ±1.5 band of the last price.",
    };
    const WINDOW = 24, DUR = 1150, REST = 520, SEED = 20260;

    let rnd, hist, markers, anim = null, auto = false, visible = false, lastDone = 0, raf = 0, yr = null;
    const gap = () => gapIn.value / 100;
    const rules = () => (rulesIn.find((r) => r.checked) || rulesIn[0]).value;

    // ---- Toy dynamics ----
    const step = () => {
      const prev = hist[hist.length - 1];
      const g = gap();
      const v = prev.v + gauss(rnd) * 0.9 + (rnd() < 0.08 ? gauss(rnd) * 3 : 0); // hidden value: random walk with rare jumps
      const offers = AGENTS.map((a) => {
        if (a.informed) return v + gauss(rnd) * 0.45;
        const belief = (1 - g) * v + g * prev.p;                                // uninformed: anchor on last price
        return belief + gauss(rnd) * (0.45 + 2.6 * g);
      });
      let p;
      if (rules() === "v1") {
        p = offers.reduce((s, x) => s + x, 0) / offers.length;
      } else {
        const s = [...offers].sort((a, b) => a - b);
        p = clamp((s[1] + s[2]) / 2, prev.p - 1.5, prev.p + 1.5);
      }
      hist.push({ v, p, offers, rules: rules() });
    };

    const reset = () => {
      rnd = mulberry(SEED);
      hist = [{ v: 100, p: 100, offers: [100, 100, 100, 100], rules: rules() }];
      markers = [];
      const pre = reduce ? 12 : 3;
      for (let i = 0; i < pre; i++) step();
      anim = null; yr = null;
      updateReadouts(1);
      draw();
    };

    const updateReadouts = (k) => {
      const n = hist.length - 1, cur = hist[n], prev = hist[Math.max(0, n - 1)];
      const p = lerp(prev.p, cur.p, k);
      ro.round.textContent = pad2(n);
      ro.price.textContent = p.toFixed(2);
      ro.value.textContent = (k >= 1 ? cur.v : prev.v).toFixed(2);
      ro.miss.textContent = Math.abs(p - (k >= 1 ? cur.v : prev.v)).toFixed(2);
    };

    const runRound = (manual) => {
      if (anim) finishAnim();
      step();
      if (reduce) { anim = null; updateReadouts(1); draw(); }
      else { anim = { t0: performance.now() }; kick(); }
      if (manual) {
        const c = hist[hist.length - 1];
        live.textContent = `Round ${hist.length - 1}: toy price ${c.p.toFixed(2)}, hidden value ${c.v.toFixed(2)}.`;
      }
    };
    const finishAnim = () => { anim = null; lastDone = performance.now(); updateReadouts(1); };

    // ---- Network scene ----
    const geom = (w, h) => {
      const m = Math.min(w, h);
      const nr = clamp(m * 0.05, 14, 24);
      const ring = (g, r) => nr + 4 + g * nr * 0.55 * r;      // uninformed "fog" rings
      const reach = ring(1, 2);                                 // largest ring; labels sit beyond it
      const cx = w / 2, cy = h / 2;
      const rx = Math.max(nr * 2, Math.min(w * 0.34, w / 2 - reach - 10));
      const ry = Math.max(nr * 2, Math.min(h * 0.34, h / 2 - reach - 38));
      const pos = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ x: cx + sx * rx, y: cy + sy * ry }));
      return { cx, cy, nr, pos, ring, reach, box: clamp(m * 0.11, 30, 52), m };
    };

    const drawNet = (k) => {
      const { ctx, w, h } = fitCanvas(netCv);
      ctx.clearRect(0, 0, w, h);
      const G = geom(w, h);
      const g = gap();
      const n = hist.length - 1, cur = hist[n], prev = hist[Math.max(0, n - 1)];
      const sendK = anim ? clamp(k / 0.55) : 1;   // offers travelling
      const settleK = anim ? clamp((k - 0.5) / 0.3) : 1;
      const box = G.box;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";

      AGENTS.forEach((a, i) => {
        const P = G.pos[i];
        const dx = G.cx - P.x, dy = G.cy - P.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
        const sx = P.x + ux * (G.nr + 4), sy = P.y + uy * (G.nr + 4);
        const ex = G.cx - ux * (box * 0.75), ey = G.cy - uy * (box * 0.75);
        // spoke
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        // offer trail + dot
        const local = anim ? easeIO(clamp((sendK - i * 0.08) / 0.76)) : 0;
        if (anim && local > 0 && local < 1) {
          const tx = lerp(sx, ex, local), ty = lerp(sy, ey, local);
          ctx.strokeStyle = a.informed ? C.accent : C.ink2; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(lerp(sx, ex, Math.max(0, local - 0.35)), lerp(sy, ey, Math.max(0, local - 0.35))); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.fillStyle = a.informed ? C.accent : C.ink;
          ctx.beginPath(); ctx.arc(tx, ty, 3.2, 0, Math.PI * 2); ctx.fill();
        }
        // uninformed: dotted "fog" ring, grows with the information gap
        if (!a.informed && g > 0) {
          ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.setLineDash([1.5, 4]);
          for (let r = 1; r <= 2; r++) {
            ctx.globalAlpha = r === 1 ? 0.9 : 0.5;
            ctx.beginPath(); ctx.arc(P.x, P.y, G.ring(g, r), 0, Math.PI * 2); ctx.stroke();
          }
          ctx.globalAlpha = 1; ctx.setLineDash([]);
        }
        // node
        ctx.beginPath(); ctx.arc(P.x, P.y, G.nr, 0, Math.PI * 2);
        if (a.informed) { ctx.fillStyle = C.accent; ctx.fill(); }
        else { ctx.fillStyle = C.paper; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.25; ctx.stroke(); }
        ctx.fillStyle = a.informed ? C.paper : C.ink;
        ctx.font = `500 ${Math.round(clamp(G.nr * 0.55, 11, 13))}px ${MONO}`;
        ctx.fillText(a.id, P.x, P.y + 0.5);
        // labels: role + latest offer
        const top = i < 2;
        const off = G.reach + 10;
        const ly = top ? P.y - off : P.y + off;
        ctx.font = `400 11px ${MONO}`; ctx.fillStyle = C.ink3;
        ctx.fillText(a.informed ? "INFORMED" : "UNINFORMED", P.x, ly);
        const offer = anim && local < 1 ? prev.offers[i] : cur.offers[i];
        ctx.font = `400 ${G.m < 300 ? 11 : 12}px ${MONO}`; ctx.fillStyle = C.ink2;
        ctx.fillText(offer.toFixed(2), P.x, ly + (top ? -14 : 14));
      });

      // market
      const pulse = anim ? clamp((k - 0.5) / 0.5) : 1;
      if (anim && pulse > 0 && pulse < 1) {
        ctx.strokeStyle = C.accent; ctx.globalAlpha = (1 - pulse) * 0.7; ctx.lineWidth = 1;
        const s = box * (1 + pulse * 0.9);
        ctx.strokeRect(G.cx - s / 2 - 0.5, G.cy - s / 2 - 0.5, s, s);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.rect(G.cx - box * 0.75, G.cy - box * 0.5, box * 1.5, box); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.ink3; ctx.font = `400 11px ${MONO}`;
      ctx.fillText("MARKET", G.cx, G.cy - box * 0.25);
      ctx.fillStyle = C.accent; ctx.font = `500 ${Math.round(clamp(box * 0.3, 11, 15))}px ${MONO}`;
      ctx.fillText(lerp(prev.p, cur.p, anim ? easeOut(settleK) : 1).toFixed(2), G.cx, G.cy + box * 0.18);
      ctx.fillStyle = C.ink3; ctx.font = `400 11px ${MONO}`;
      ctx.fillText(`RULES ${cur.rules.toUpperCase()}`, G.cx, G.cy + box * 0.5 + 12);
    };

    // ---- Price chart ----
    const drawChart = (k) => {
      const { ctx, w, h } = fitCanvas(chartCv);
      ctx.clearRect(0, 0, w, h);
      const L = 48, R = 18, T = 22, B = 28;
      const n = hist.length - 1;
      const grow = anim ? easeOut(clamp((k - 0.55) / 0.45)) : 1;  // last segment draws in
      const from = Math.max(0, n - WINDOW);
      const xOf = (i) => L + ((i - from) / WINDOW) * (w - L - R);
      const slice = hist.slice(from);
      let lo = Infinity, hi = -Infinity;
      slice.forEach((d) => { lo = Math.min(lo, d.p, d.v); hi = Math.max(hi, d.p, d.v); });
      const mid = (lo + hi) / 2, half = Math.max(3, (hi - lo) / 2 + 1);
      const target = { lo: mid - half, hi: mid + half };
      if (!yr || reduce) yr = { ...target };
      else { yr.lo = lerp(yr.lo, target.lo, 0.12); yr.hi = lerp(yr.hi, target.hi, 0.12); }
      const yOf = (v) => T + (1 - (v - yr.lo) / (yr.hi - yr.lo)) * (h - T - B);

      // grid
      ctx.font = `400 11px ${MONO}`; ctx.textBaseline = "middle"; ctx.textAlign = "right";
      const stepV = niceStep((yr.hi - yr.lo) / 4);
      ctx.lineWidth = 1;
      for (let v = Math.ceil(yr.lo / stepV) * stepV; v <= yr.hi; v += stepV) {
        const y = Math.round(yOf(v)) + 0.5;
        ctx.strokeStyle = C.rule; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke();
        ctx.fillStyle = C.ink3; ctx.fillText(v.toFixed(stepV < 1 ? 1 : 0), L - 8, y);
      }
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      for (let i = Math.ceil(from / 4) * 4; i <= from + WINDOW; i += 4) {
        if (i > n) break;
        ctx.fillStyle = C.ink3; ctx.fillText(`R${i}`, xOf(i), h - 8);
      }

      // rules-change markers
      markers.forEach((mk) => {
        if (mk.i < from || mk.i > n) return;
        const x = Math.round(xOf(mk.i)) + 0.5;
        ctx.strokeStyle = C.ink3; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(x, T - 6); ctx.lineTo(x, h - B); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = C.ink2; ctx.textAlign = "left"; ctx.fillText(mk.label, x + 5, T - 2);
      });

      const path = (key, partial) => {
        ctx.beginPath();
        for (let i = from; i <= n; i++) {
          let x = xOf(i), y = yOf(hist[i][key]);
          if (i === n && partial < 1 && i > from) {
            x = lerp(xOf(i - 1), x, partial); y = lerp(yOf(hist[i - 1][key]), y, partial);
          }
          i === from ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
      };
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = C.ink3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      path("v", grow); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5;
      path("p", grow); ctx.stroke();

      // head
      const hx = n > from ? lerp(xOf(n - 1), xOf(n), grow) : xOf(n);
      const hy = n > from ? lerp(yOf(hist[n - 1].p), yOf(hist[n].p), grow) : yOf(hist[n].p);
      ctx.fillStyle = C.soft; ctx.beginPath(); ctx.arc(hx, hy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();

      return Math.abs(yr.lo - target.lo) + Math.abs(yr.hi - target.hi) > 0.01;
    };
    const niceStep = (raw) => { const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; };

    let settling = false;
    const draw = (k = 1) => { drawNet(k); settling = drawChart(k); };

    // ---- Loop ----
    const tick = (now) => {
      raf = 0;
      let k = 1;
      if (anim) {
        k = clamp((now - anim.t0) / DUR);
        updateReadouts(easeOut(clamp((k - 0.5) / 0.3)));
      }
      draw(k);
      if (anim && k >= 1) finishAnim();
      if (auto && visible && !anim && now - lastDone > REST) runRound(false);
      if (anim || settling || (auto && visible)) raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf && !reduce) raf = requestAnimationFrame(tick); };

    const setAuto = (on) => {
      auto = !!on;
      autoBtn.setAttribute("aria-pressed", String(auto));
      autoBtn.textContent = auto ? "Pause" : "Auto-play";
      if (auto) {
        if (reduce) startReducedAuto(); else { lastDone = 0; kick(); }
      } else stopReducedAuto();
    };
    // Reduced motion: user-requested auto-play steps instantly, no tweening.
    let rTimer = 0;
    const startReducedAuto = () => { stopReducedAuto(); rTimer = setInterval(() => { if (visible) runRound(false); }, 1400); };
    const stopReducedAuto = () => { clearInterval(rTimer); rTimer = 0; };

    // ---- "Try it" chip: touch-aware wording; leaves on the first real interaction ----
    const tryChip = fig.querySelector("#ag-try");
    if (tryChip && matchMedia("(hover: none)").matches) tryChip.querySelector(".ag-try-t").textContent = "Tap Run round, or drag the gap";
    const tried = () => {
      if (!tryChip || tryChip.classList.contains("is-gone")) return;
      tryChip.classList.add("is-gone");
      setTimeout(() => tryChip.remove(), 500);
    };
    [runBtn, autoBtn, resetBtn].forEach((b) => b.addEventListener("click", tried));
    gapIn.addEventListener("input", tried);
    rulesIn.forEach((r) => r.addEventListener("change", tried));

    // ---- Controls ----
    runBtn.addEventListener("click", () => { if (auto) setAuto(false); runRound(true); });
    autoBtn.addEventListener("click", () => setAuto(!auto));
    resetBtn.addEventListener("click", () => { setAuto(false); reset(); live.textContent = "Toy market reset."; });
    const syncGap = () => {
      gapOut.textContent = gap().toFixed(2);
      gapIn.style.setProperty("--fill", gapIn.value + "%");
      gapIn.setAttribute("aria-valuetext", `${gap().toFixed(2)} — ${gap() < 0.34 ? "small" : gap() < 0.67 ? "moderate" : "large"} gap`);
    };
    gapIn.addEventListener("input", () => { syncGap(); if (!raf) draw(); });
    rulesIn.forEach((r) => r.addEventListener("change", () => {
      rulesDesc.textContent = RULE_TEXT[rules()];
      markers.push({ i: hist.length - 1, label: rules() });
      if (!raf) draw();
    }));

    // ---- Visibility, autoplay, resize, theme ----
    new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; if (visible) kick(); }), { threshold: 0.15 }).observe(fig);
    fig.addEventListener("ak:in", () => { if (!reduce) setAuto(true); }, { once: true });
    if ("ResizeObserver" in window) {
      const rs = new ResizeObserver(() => { if (!raf) draw(); });
      rs.observe(netCv.parentElement); rs.observe(chartCv.parentElement);
    } else addEventListener("resize", () => draw());
    const retheme = () => { readColors(); if (!raf) draw(); };
    addEventListener("ak:theme", () => requestAnimationFrame(retheme));
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => requestAnimationFrame(retheme));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!raf) draw(); });

    syncGap();
    rulesDesc.textContent = RULE_TEXT[rules()];
    reset();
  }

  /* =======================================================
     2) Iteration scene — trial cards advance with scroll
     ======================================================= */
  const scene = document.querySelector(".ag-iter");
  if (scene) {
    const stack = scene.querySelector(".ag-stack");
    const loopItems = [...scene.querySelectorAll(".ag-loop li")];
    const counter = scene.querySelector(".ag-counter");
    const countN = scene.querySelector(".ag-counter-n");
    const countOf = scene.querySelector(".ag-counter-of");
    const TOTAL = 20, SLOTS = 5;
    const PHASES = ["Design", "Run", "Review", "Revise"];
    const STATUS = ["Designing rules", "Running", "In review", "Revising", "Done"];

    // Illustrative sparkline per trial (seeded, not data).
    const spark = (trial) => {
      const r = mulberry(trial * 7919);
      let y = 30, d = "M0 " + y.toFixed(1);
      for (let x = 10; x <= 200; x += 10) { y = clamp(y + (r() - 0.5) * 14, 8, 52); d += ` L${x} ${y.toFixed(1)}`; }
      return d;
    };
    const cards = Array.from({ length: SLOTS }, () => {
      const el = document.createElement("div");
      el.className = "ag-card";
      el.innerHTML = `
        <div class="ag-card-top"><span class="label">Trial</span><span class="figure"></span></div>
        <svg class="ag-card-spark" viewBox="0 0 200 60" preserveAspectRatio="none"><path d=""/></svg>
        <ul class="ag-card-rows">${PHASES.map((p) => `<li><i></i>${p}</li>`).join("")}</ul>
        <div class="ag-card-foot"><span class="label">4 agents</span><span class="label ag-card-status"></span></div>`;
      stack.append(el);
      return { el, num: el.querySelector(".figure"), path: el.querySelector("path"), rows: [...el.querySelectorAll("li")],
        status: el.querySelector(".ag-card-status"), trial: -1 };
    });

    let lastPhase = -1, lastCount = "";
    AK.onScene(scene, (p) => {
      const T = 1 + clamp(p / 0.94) * (TOTAL - 1) + (p >= 0.94 ? 0.999 : 0);
      const base = Math.min(TOTAL, Math.floor(T));
      const f = base === TOTAL ? clamp((p - 0.94) / 0.05) : T - base;
      const exit = base === TOTAL ? 0 : smooth(0.8, 1, f);
      const ph = clamp(f / 0.8) * 4;
      const phase = base === TOTAL && p >= 0.99 ? 4 : Math.min(3, Math.floor(ph));

      cards.forEach((c, i) => {
        const trial = base + i;
        if (trial > TOTAL) { c.el.style.opacity = 0; c.el.style.visibility = "hidden"; return; }
        c.el.style.visibility = "";
        if (c.trial !== trial) {
          c.trial = trial;
          c.num.textContent = pad2(trial);
          c.path.setAttribute("d", spark(trial));
        }
        const d = i - exit;
        let tf, op;
        if (d < 0) {
          const e = -d;
          tf = `translate3d(${(-e * 18).toFixed(2)}%, ${(-e * 70).toFixed(2)}%, 0) rotate(${(-e * 7).toFixed(2)}deg)`;
          op = 1 - e;
        } else {
          tf = `translate3d(0, ${(-d * 14).toFixed(2)}px, 0) scale(${(1 - d * 0.05).toFixed(4)})`;
          op = d < 3 ? 1 - d * 0.2 : Math.max(0, (4 - d) * 0.4);
        }
        c.el.style.transform = tf;
        c.el.style.opacity = op.toFixed(3);
        c.el.style.zIndex = String(SLOTS - i);
        const top = i === 0;
        c.el.classList.toggle("is-top", top);
        c.rows.forEach((row, k) => {
          const fill = top ? (phase === 4 ? 1 : clamp(ph - k)) : 0;
          row.style.setProperty("--f", fill.toFixed(3));
          row.classList.toggle("on", top && (phase === 4 || k <= phase));
        });
        c.status.textContent = top ? STATUS[phase] : "Queued";
      });

      if (phase !== lastPhase) {
        lastPhase = phase;
        loopItems.forEach((li, k) => { li.classList.toggle("is-on", k === phase); li.classList.toggle("is-done", phase === 4 || k < phase); });
      }
      const final = p >= 0.97;
      const label = final ? "20+" : pad2(base);
      if (label !== lastCount) {
        lastCount = label;
        countN.textContent = label;
        countOf.textContent = final ? "trials" : "of 20+";
        counter.classList.toggle("is-final", final);
      }
    });
  }
})();
