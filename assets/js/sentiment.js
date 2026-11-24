/* =========================================================
   sentiment.js — Case 02.1 "Reading the News"
   1. Sticky scroll scene: the study's real (traced) validation and
      holdout curves, told in four steps (validate → holdout → break → verdict).
      Data: assets/data/sentiment.json. Headline figures are the report's.
   2. "What the model kept": the fitted Elastic Net's 15 coefficients
      (relative magnitudes, exact signs) + a LASSO ↔ Ridge mix slider.
      Only l1_ratio = 0.95 shows the fitted result; every other setting is
      drawn as, and labelled, a conceptual illustration.
   ========================================================= */
(() => {
  const AK = window.AK;
  if (!AK) return;
  const { clamp, lerp, reduce } = AK;

  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const MINUS = "−";
  const pct = (v, d = 0) => (v > 0 ? "+" : v < 0 ? MINUS : "") + Math.abs(v * 100).toFixed(d) + "%";

  /* =======================================================
     1. Scene chart (real traced series)
     ======================================================= */
  const scene = document.getElementById("scene");
  const canvas = document.getElementById("sent-canvas");
  const fallback = document.getElementById("sent-fallback");
  const steps = scene ? [...scene.querySelectorAll(".cs-step")] : [];
  const ticks = scene ? [...scene.querySelectorAll(".cs-sent-ticks li")] : [];
  let P = reduce ? 1 : 0, stepOn = -1, D = null;

  const setStep = (n) => {
    if (n === stepOn) return;
    stepOn = n;
    steps.forEach((s, i) => s.classList.toggle("is-on", i === n));
    ticks.forEach((t, i) => t.classList.toggle("is-on", i <= n));
  };

  // Value of column c at fractional year y (linear interpolation).
  const at = (rows, c, y) => {
    if (y <= rows[0][0]) return rows[0][c];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] >= y) {
        const a = rows[i - 1], b = rows[i];
        return lerp(a[c], b[c], (y - a[0]) / (b[0] - a[0] || 1));
      }
    }
    return rows[rows.length - 1][c];
  };
  const argExt = (rows, c, fn, from = -Infinity, to = Infinity) => {
    let best = null;
    rows.forEach((r) => { if (r[0] >= from && r[0] <= to && (!best || fn(r[c], best[c]))) best = r; });
    return best;
  };

  const prep = (j) => {
    const V = j.validation.rows, H = j.holdout.rows, A = j.rolling_accuracy.rows;
    const range = (rows) => {
      let lo = Infinity, hi = -Infinity;
      rows.forEach((r) => { lo = Math.min(lo, r[1], r[2]); hi = Math.max(hi, r[1], r[2]); });
      const s = hi - lo; return [lo - s * 0.06, hi + s * 0.1];
    };
    const sPeak = argExt(H, 2, (a, b) => a > b, 2024, 2025);
    return {
      V, H, A, R: j.holdout.reported, RV: j.validation.reported,
      vDom: [V[0][0], V[V.length - 1][0]], hDom: [2024, H[H.length - 1][0]],
      vY: range(V), hY: range(H),
      covid: argExt(V, 1, (a, b) => a < b),                          // index trough, 2020
      sPeak, sTrough: argExt(H, 2, (a, b) => a < b, sPeak[0]),       // strategy peak → trough (Apr 2025)
      aPeak: argExt(A, 1, (a, b) => a > b), aTrough: argExt(A, 1, (a, b) => a < b),
    };
  };

  const draw = () => {
    if (!canvas || !D) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const C = {
      ink: AK.css("--ink"), ink2: AK.css("--ink-2"), ink3: AK.css("--ink-3"), rule: AK.css("--rule"),
      accent: AK.css("--accent"), soft: AK.css("--accent-soft"), up: AK.css("--up"), down: AK.css("--down"),
      paper2: AK.css("--paper-2"), mono: AK.css("--mono") || "monospace",
    };
    const small = w < 520;
    const fs = small ? 11 : 12;
    const font = (wt) => { ctx.font = `${wt || 400} ${fs}px ${C.mono}`; };

    // Stage progress
    const k1 = ease(seg(P, 0.02, 0.22));   // validation draws
    const kT = ease(seg(P, 0.28, 0.38));   // hand-over to the holdout
    const k2 = ease(seg(P, 0.38, 0.52));   // holdout to mid-2024
    const k3 = ease(seg(P, 0.56, 0.76));   // the break, to the end
    const k4 = ease(seg(P, 0.80, 0.92));   // verdict labels

    const x0 = lerp(D.vDom[0], D.hDom[0], kT), x1 = lerp(D.vDom[1] + 0.02, D.hDom[1], kT);
    const lo = lerp(D.vY[0], D.hY[0], kT), hi = lerp(D.vY[1], D.hY[1], kT);
    const vEnd = lerp(D.vDom[0], D.vDom[1], k1);
    const MID = D.aPeak[0] + 0.03;
    const hEnd = k3 > 0 ? lerp(MID, D.hDom[1], k3) : lerp(D.hDom[0], MID, k2);

    // Layout
    const pad = { l: small ? 38 : 48, r: small ? 70 : 132, t: small ? 40 : 44, b: 22 };
    const plotW = w - pad.l - pad.r, plotH = h - pad.t - pad.b;
    const accH = kT * plotH * (small ? 0.24 : 0.22), gap = kT * (small ? 18 : 24);
    const eqTop = pad.t, eqBot = pad.t + plotH - accH - gap;
    const aTop = eqBot + gap, aBot = pad.t + plotH;
    const right = pad.l + plotW;
    const X = (y) => pad.l + ((y - x0) / (x1 - x0)) * plotW;
    const Y = (v) => eqBot - ((v - lo) / (hi - lo)) * (eqBot - eqTop);
    const AY = (v) => aBot - ((v - 0.25) / 0.5) * (aBot - aTop);
    font();
    ctx.textBaseline = "alphabetic";

    // Y gridlines + labels (growth of $1, as % change)
    ctx.lineWidth = 1;
    const stepV = (hi - lo) > 0.8 ? 0.25 : 0.2;
    for (let v = Math.ceil(lo / stepV) * stepV; v <= hi + 1e-9; v += stepV) {
      const y = Math.round(Y(v)) + .5;
      if (y < eqTop - 2) continue;
      ctx.strokeStyle = C.rule;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(right, y); ctx.stroke();
      ctx.fillStyle = C.ink3; ctx.textAlign = "right";
      ctx.fillText(pct(v - 1), pad.l - 6, y + fs * .35);
    }
    // $1 baseline
    const y1 = Math.round(Y(1)) + .5;
    ctx.strokeStyle = C.ink3; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, y1); ctx.lineTo(right, y1); ctx.stroke(); ctx.setLineDash([]);

    // X year ticks
    ctx.fillStyle = C.ink3;
    for (let yr = Math.ceil(x0); yr <= Math.floor(x1 + 0.001); yr++) {
      const x = X(yr);
      if (x < pad.l - 1 || x > right + 1) continue;
      ctx.strokeStyle = C.rule;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, aBot); ctx.lineTo(Math.round(x) + .5, aBot + 5); ctx.stroke();
      ctx.textAlign = x > right - 20 ? "right" : x < pad.l + 20 ? "left" : "center";
      ctx.fillText(String(yr), x, h - 4);
    }

    // Region labels
    const region = (txt, a, color, wt) => { if (a <= 0) return; ctx.globalAlpha = a; ctx.fillStyle = color; font(wt); ctx.textAlign = "left"; ctx.fillText(txt, pad.l, 15); };
    region(small ? "VALIDATION · 2019–23" : "VALIDATION · MAR 2019 – DEC 2023", 1 - kT, C.ink3);
    region(small ? "HOLDOUT · 522 UNSEEN DAYS" : "HOLDOUT · 522 UNSEEN DAYS · NO REFITTING", kT, C.accent, 500);
    ctx.globalAlpha = 1; font();

    // Clip series to the plot
    ctx.save();
    ctx.beginPath(); ctx.rect(pad.l, eqTop - 12, plotW + 1, aBot - eqTop + 14); ctx.clip();

    const line = (rows, c, end, color, width, Yf) => {
      if (end <= rows[0][0]) return null;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      let started = false;
      for (const r of rows) {
        if (r[0] > end) break;
        const x = X(r[0]), y = Yf(r[c]);
        started ? ctx.lineTo(x, y) : ctx.moveTo(x, y); started = true;
      }
      const tx = X(end), ty = Yf(at(rows, c, end));
      ctx.lineTo(tx, ty); ctx.stroke();
      return [tx, ty];
    };
    const tips = [];
    const dot = (x, y, color, r = 3) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };

    // --- Validation (fades out on the hand-over)
    const vA = 1 - kT;
    if (vA > 0.01 && k1 > 0) {
      ctx.globalAlpha = vA;
      // COVID crash marker
      if (vEnd >= D.covid[0]) {
        const cx = X(D.covid[0]);
        ctx.fillStyle = C.soft; ctx.fillRect(cx - 8, eqTop, 16, eqBot - eqTop);
        ctx.fillStyle = C.ink2; ctx.textAlign = "left"; font(500);
        ctx.fillText("COVID crash", cx + 12, eqTop + fs);
        font();
        ctx.fillStyle = C.ink3;
        ctx.fillText(small ? "strategy aside" : "strategy stepped aside", cx + 12, eqTop + fs * 2.3);
      }
      const s = line(D.V, 2, vEnd, C.accent, 2, Y);
      const b = line(D.V, 1, vEnd, C.ink, 2, Y);
      const done = k1 > 0.97;
      if (s) tips.push({ x: s[0], y: s[1], color: C.accent, a: vA, label: done ? (small ? "8.31%/yr" : "Strategy 8.31%/yr") : (small ? "Strat." : "Strategy") });
      if (b) tips.push({ x: b[0], y: b[1], color: C.ink, a: vA, bold: true, label: done ? (small ? "13.17%/yr" : "B&H 13.17%/yr") : (small ? "B&H" : "Buy & hold") });
      ctx.globalAlpha = 1;
    }

    // --- Holdout
    if (kT > 0.01) {
      ctx.globalAlpha = kT;
      const showDD = hEnd >= D.sTrough[0];
      if (showDD) {
        const px = X(D.sPeak[0]), py = Y(D.sPeak[2]), tx = X(D.sTrough[0]), ty = Y(D.sTrough[2]);
        ctx.strokeStyle = C.down; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, py); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      }
      const s = line(D.H, 2, hEnd, C.accent, 2, Y);
      const b = line(D.H, 1, hEnd, C.ink, 2, Y);
      if (showDD) {
        const tx = X(D.sTrough[0]), ty = Y(D.sTrough[2]);
        dot(tx, ty, C.down, 3.5);
        const l1 = `${pct(D.R.strategy_mdd, 2)} ${small ? "drawdown" : "max drawdown"}`, l2 = small ? "Apr 2025 · tariffs" : "Apr 2025 · tariff shock";
        font(500);
        const lx = Math.max(tx - 8, pad.l + 2 + Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width));
        ctx.fillStyle = C.down; ctx.textAlign = "right";
        ctx.fillText(l1, lx, ty - fs * 1.5);
        font(); ctx.fillStyle = C.ink2;
        ctx.fillText(l2, lx, ty - fs * 0.3);
      }
      const v = k4 > 0.5;
      if (s) tips.push({ x: s[0], y: s[1], color: C.accent, a: kT, bold: v, label: v ? pct(D.R.strategy_total, 2) : (small ? "Strat." : "Strategy") });
      if (b) tips.push({ x: b[0], y: b[1], color: C.ink, a: kT, bold: true, label: v ? pct(D.R.bh_total, 2) : (small ? "B&H" : "Buy & hold") });

      // Rolling 60-day accuracy panel
      if (accH > 8) {
        const yb = Math.round(AY(0.5)) + .5;
        ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, Math.round(aTop) + .5); ctx.lineTo(right, Math.round(aTop) + .5); ctx.stroke();
        ctx.strokeStyle = C.ink3; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pad.l, yb); ctx.lineTo(right, yb); ctx.stroke(); ctx.setLineDash([]);
        const a = line(D.A, 1, hEnd, C.ink2, 1.25, AY);
        if (a) dot(a[0], a[1], C.ink2, 2.2);
        font(500);
        if (hEnd >= D.aPeak[0]) {
          const x = X(D.aPeak[0]), y = AY(D.aPeak[1]);
          dot(x, y, C.up, 3); ctx.fillStyle = C.up; ctx.textAlign = "left"; ctx.fillText("≈66%", x + 7, y + fs * .35);
        }
        if (hEnd >= D.aTrough[0]) {
          const x = X(D.aTrough[0]), y = AY(D.aTrough[1]);
          dot(x, y, C.down, 3); ctx.fillStyle = C.down; ctx.textAlign = "left"; ctx.fillText("≈33%", x + 7, y + fs * .35);
        }
        font();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Accuracy panel axis labels (outside the clip)
    if (accH > 8) {
      ctx.globalAlpha = kT; ctx.fillStyle = C.ink3; ctx.textAlign = "right"; font();
      ctx.fillText("50%", pad.l - 6, AY(0.5) + fs * .35);
      ctx.textAlign = "left";
      ctx.fillText(small ? "60-DAY ACCURACY" : "ROLLING 60-DAY ACCURACY", pad.l, aTop - 5);
      ctx.globalAlpha = 1;
    }

    // Verdict line
    if (k4 > 0) {
      ctx.globalAlpha = k4; ctx.fillStyle = C.ink; font(500); ctx.textAlign = "left";
      // Pick the longest version that fits the plot width.
      const room = plotW + pad.r - 8;
      const opts = [
        `IC ${MINUS}0.02 (t = ${MINUS}0.47) · directional accuracy 49.81% · Sharpe ${MINUS}0.41 vs 1.30`,
        `IC ${MINUS}0.02 · accuracy 49.81% · Sharpe ${MINUS}0.41 vs 1.30`,
        `IC ${MINUS}0.02 · accuracy 49.81%`,
      ];
      const txt = (small ? opts.slice(2) : opts).find((t) => ctx.measureText(t).width <= room) || opts[2];
      ctx.fillText(txt, pad.l, 15 + fs + 8);
      ctx.globalAlpha = 1; font();
    }

    // Tip dots + labels, de-overlapped vertically
    if (tips.length) {
      const gapT = fs + 5;
      tips.sort((a, b) => a.y - b.y);
      const ys = tips.map((t) => t.y);
      for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < gapT) ys[i] = ys[i - 1] + gapT;
      const overflow = ys[ys.length - 1] - eqBot;
      if (overflow > 0) for (let i = 0; i < ys.length; i++) ys[i] -= overflow;
      tips.forEach((t, i) => {
        ctx.globalAlpha = t.a;
        dot(t.x, t.y, t.color, t.bold ? 3.2 : 2.6);
        const lx = Math.max(t.x + 10, right + 8);
        ctx.strokeStyle = t.color; ctx.lineWidth = .75; ctx.globalAlpha = t.a * .5;
        ctx.beginPath(); ctx.moveTo(t.x + 4, t.y); ctx.lineTo(lx - 3, ys[i] - fs * .35); ctx.stroke();
        ctx.globalAlpha = t.a; ctx.fillStyle = t.color; ctx.textAlign = "left";
        font(t.bold ? 500 : 400);
        ctx.fillText(t.label, lx, ys[i]);
      });
      ctx.globalAlpha = 1; font();
    }
  };

  if (scene && canvas) {
    if (reduce) {
      scene.classList.add("is-static");
      steps.forEach((s) => s.classList.add("is-on"));
      ticks.forEach((t) => t.classList.add("is-on"));
      scene.querySelector(".cs-steps").removeAttribute("aria-live");
      P = 1;
    } else {
      AK.onScene(scene, (p) => {
        if (stepOn === 99) return;
        P = p;
        setStep(p < 0.27 ? 0 : p < 0.55 ? 1 : p < 0.78 ? 2 : 3);
        draw();
      });
    }
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas.parentElement);
    addEventListener("ak:theme", draw);
  }

  /* =======================================================
     2. What the model kept — real coefficients
     ======================================================= */
  // Relative coefficients (largest = market_sentiment = −1). Signs exact.
  // Overwritten from sentiment.json when it loads; kept here so the figure works offline.
  const FEATS = [
    ["market_sentiment", -1.0, "Tone of market news", "Positive market news is already priced in. The model leans contrarian: the brighter the market coverage, the weaker the next day it expects."],
    ["prob_pos_minus_neg", -0.27, "Probability positive minus negative", "The same contrarian lean, read from how confidently stories score positive versus negative."],
    ["fed_sentiment", 0.22, "Tone of Fed coverage", "Coverage of the Federal Reserve carries marginal information: the one kept topic whose tone leans the same way as the next day’s return."],
    ["std_sentiment", -0.19, "Disagreement across stories", "Polarised news days carry an uncertainty discount: when stories disagree, the model expects less."],
    ["log_story_count", 0.13, "Number of stories (log)", "High-attention days show a slight momentum effect."],
    ["sentiment_change_1d", -0.04, "One-day change in tone", "Sharp improvements in tone tend to mean-revert. The smallest weight the model kept."],
    ["mean_sentiment", 0], ["sentiment_momentum_5d", 0], ["volume_surprise", 0], ["pct_positive_minus_negative", 0],
    ["skew_sentiment", 0], ["confidence_weighted_sentiment", 0], ["sentiment_momentum_20d", 0], ["pct_new_stories", 0],
    ["novelty_filtered_sentiment", 0],
  ];
  const ZERO_TEXT = "Set to exactly zero by the L1 penalty. At our tuned settings the model ignores it.";

  const barsEl = document.getElementById("reg-bars");
  const range = document.getElementById("mix");
  const out = document.getElementById("mix-out");
  const mode = document.getElementById("mix-mode");
  const panel = document.getElementById("reg-panel");
  const explain = document.getElementById("feat-explain");
  const nzEl = document.getElementById("reg-nz"), nzL = document.getElementById("reg-nz-l");
  const zEl = document.getElementById("reg-zero"), zL = document.getElementById("reg-zero-l");
  const featCue = document.getElementById("feat-cue");
  const FIT = 95;

  let rows = [], selected = 0;
  const fmt = (v) => (v === 0 ? "0" : (v > 0 ? "+" : MINUS) + Math.abs(v).toFixed(2));

  const build = () => {
    if (!barsEl) return;
    barsEl.innerHTML = FEATS.map(([name, v], i) => {
      const side = v > 0 ? "pos" : "neg";
      const kept = v !== 0;
      return `<li class="${kept ? "" : "is-zero"}"><button type="button" class="cs-sent-feat" data-i="${i}" aria-pressed="${i === selected}"
        aria-label="${name}: ${kept ? (v > 0 ? "positive" : "negative") + ", relative weight " + Math.abs(v).toFixed(2) : "zeroed"}">
        <span class="k">${name}</span>
        <span class="cs-sent-track">${kept ? `<span class="ghost ${side}" style="width:${Math.abs(v) * 50}%"></span>` : ""}<span class="bar ${kept ? side : "mid"}"></span></span>
        <span class="v">${fmt(v)}</span></button></li>`;
    }).join("");
    rows = [...barsEl.children];
    rows.forEach((li) => {
      const b = li.querySelector("button");
      const i = +b.dataset.i;
      b.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") select(i); });
      b.addEventListener("focus", () => select(i));
      b.addEventListener("click", () => select(i));
    });
  };

  const select = (i) => {
    if (!explain) return;
    selected = i;
    const [name, v, plain, text] = FEATS[i];
    rows.forEach((li, j) => { li.classList.toggle("is-sel", j === i); li.querySelector("button").setAttribute("aria-pressed", j === i ? "true" : "false"); });
    explain.querySelector('[data-x="tag"]').textContent = v === 0 ? "Zeroed · weight 0" : `Kept · ${v > 0 ? "positive" : "negative"} · ${fmt(v)}`;
    explain.querySelector('[data-x="title"]').textContent = plain || name;
    explain.querySelector('[data-x="text"]').textContent = text || ZERO_TEXT;
    explain.classList.toggle("is-zero", v === 0);
    if (featCue && !featCue.classList.contains("is-gone") && i !== 0) { featCue.classList.add("is-gone"); setTimeout(() => featCue.remove(), 600); }
  };

  // Mix slider. l = l1_ratio in [0, 1]. Only l = 0.95 is a fitted result.
  const render = (val) => {
    if (!rows.length) return;
    const l = val / 100, fitted = val === FIT;
    panel.classList.toggle("is-concept", !fitted);
    FEATS.forEach(([, v], i) => {
      const bar = rows[i].querySelector(".bar");
      let mag;
      if (fitted) mag = Math.abs(v);
      else if (val < FIT) {                       // toward Ridge: weights shrink and spread, nothing hits zero
        const t = (0.95 - l) / 0.95;
        mag = v !== 0 ? Math.abs(v) * (1 - 0.35 * t) : 0.12 * t;
      } else {                                    // past our fit, toward pure LASSO: the weakest weight goes to zero
        const t = (l - 0.95) / 0.05;
        mag = v !== 0 ? Math.max(0, Math.abs(v) - 0.06 * t) : 0;
      }
      bar.style.transform = `scaleX(${mag.toFixed(4)})`;
    });
    out.textContent = l.toFixed(2);
    range.style.setProperty("--fill", val + "%");
    range.setAttribute("aria-valuetext", `l1_ratio ${l.toFixed(2)}${fitted ? ", our fitted model" : ", conceptual illustration"}`);
    if (fitted) {
      mode.textContent = "Fitted result at our l1_ratio of 0.95.";
      nzEl.textContent = "6/15"; nzL.textContent = "Features kept";
      zEl.textContent = "9"; zL.textContent = "Set to zero";
    } else {
      mode.textContent = val < FIT
        ? "Conceptual illustration — not a fitted result. More Ridge shrinks weights and spreads them; nothing reaches zero. Faded bars; the grey ones have no estimated sign. Dashed outlines are our fit."
        : "Conceptual illustration — not a fitted result. Pure LASSO would push the weakest remaining weights to zero.";
      nzEl.textContent = "—"; nzL.textContent = "Not fitted here";
      zEl.textContent = "—"; zL.textContent = "Concept only";
    }
  };

  build();
  if (rows.length) {
    select(0);
    range.addEventListener("input", () => render(+range.value));
    render(+range.value);

    // Intro: on first view, bars grow from zero to the fitted values.
    const reg = document.querySelector(".cs-sent-reg");
    if (!reduce && reg) {
      rows.forEach((li) => { li.querySelector(".bar").style.transform = "scaleX(0)"; });
      reg.addEventListener("ak:in", () => setTimeout(() => render(+range.value), 300), { once: true });
      let touched = false;
      range.addEventListener("pointerdown", () => { touched = true; range.classList.remove("is-nudge"); });
      reg.addEventListener("ak:in", () => setTimeout(() => {
        if (touched) return;
        range.classList.add("is-nudge"); setTimeout(() => range.classList.remove("is-nudge"), 3400);
      }, 1600), { once: true });
    }
  }

  /* =======================================================
     3. Data
     ======================================================= */
  const fail = () => {
    if (canvas) canvas.hidden = true;
    if (fallback) fallback.hidden = false;
    if (scene) {   // no chart to scroll: lay the four steps out as plain text
      scene.classList.add("is-nodata", "is-static");
      steps.forEach((s) => s.classList.add("is-on"));
      ticks.forEach((t) => t.classList.add("is-on"));
      const live = scene.querySelector(".cs-steps"); if (live) live.removeAttribute("aria-live");
      stepOn = 99;
    }
  };
  fetch(AK.root + "assets/data/sentiment.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((j) => {
      D = prep(j);
      // Keep the coefficient figure in sync with the data file.
      const rel = new Map((j.model && j.model.coefficients_relative) || []);
      let changed = false;
      FEATS.forEach((f) => { if (rel.has(f[0]) && rel.get(f[0]) !== f[1]) { f[1] = rel.get(f[0]); changed = true; } });
      if (changed && rows.length) { build(); select(selected); render(+range.value); }
      draw();
    })
    .catch(fail);
})();
