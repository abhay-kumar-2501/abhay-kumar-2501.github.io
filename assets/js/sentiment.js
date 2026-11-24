/* =========================================================
   sentiment.js — Case 02.1 "Reading the News"
   1. Sticky scroll scene: canvas chart told in four stages
      (score → fit → split → test).
   2. Regularisation explainer: λ slider × LASSO / Ridge / Elastic Net.
   Every series here is synthetic, generated from a seeded PRNG.
   It shows the *shape* of the finding, never real performance.
   ========================================================= */
(() => {
  const AK = window.AK;
  if (!AK) return;
  const { clamp, lerp, reduce } = AK;

  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const seg = (p, a, b) => clamp((p - a) / (b - a));

  /* =======================================================
     1. Synthetic data
     ======================================================= */
  const N = 600, SPLIT = 420;
  const MODELS = [
    { name: "LASSO",       a: 0.52, end: -0.16, dash: [] },
    { name: "Ridge",       a: 0.36, end: -0.09, dash: [6, 4] },
    { name: "Elastic Net", short: "E-Net", a: 0.44, end: -0.13, dash: [1.5, 3.5] },
  ];

  const generate = (seed) => {
    const r = mulberry32(seed);
    const g = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
    const B = [], S = [], M = MODELS.map(() => []);
    let b = 0, s = 0, common = 0;
    const wig = MODELS.map(() => 0);
    for (let t = 0; t < N; t++) {
      b += 0.0011 + g() * 0.0105;
      s = 0.82 * s + g() * 0.55;
      B.push(b); S.push(s);
      common += g() * 0.0035;
      MODELS.forEach((m, i) => {
        wig[i] += g() * (t <= SPLIT ? 0.0025 : 0.0045);
        let edge;
        if (t <= SPLIT) {
          const u = t / SPLIT;
          edge = m.a * Math.pow(u, 1.1) + (common + wig[i]) * u;
        } else {
          const u = (t - SPLIT) / (N - 1 - SPLIT);
          const base = m.a + (common + wig[i]);
          edge = base + (m.end - base) * (1 - Math.pow(1 - u, 1.8)) + (wig[i] - wig[i] * u) * 0.2;
        }
        M[i].push(edge);
      });
    }
    return { B, S, M };
  };
  // Pick the first seed whose shape is unambiguous: benchmark rises in the test window,
  // and the models really do end below it.
  let D = null;
  for (let seed = 24; seed < 400 && !D; seed++) {
    const d = generate(seed);
    const okB = d.B[N - 1] - d.B[SPLIT] > 0.12 && d.B[SPLIT] > 0.25;
    const okM = d.M.every((e) => e[N - 1] < -0.05 && e[SPLIT] > 0.25 && Math.min(...e.slice(SPLIT * 0.4, SPLIT)) > 0.02);
    if (okB && okM) D = d;
  }
  if (!D) D = generate(24);
  const maxS = Math.max(...D.S.map(Math.abs));
  const modelVal = (i, t, fan) => D.B[t] + D.M[i][t] * fan;
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < N; t++) {
    lo = Math.min(lo, D.B[t]); hi = Math.max(hi, D.B[t]);
    MODELS.forEach((_, i) => { const v = modelVal(i, t, 1); lo = Math.min(lo, v); hi = Math.max(hi, v); });
  }
  const span = hi - lo; lo -= span * 0.06; hi += span * 0.08;

  /* =======================================================
     2. Scene chart
     ======================================================= */
  const scene = document.getElementById("scene");
  const canvas = document.getElementById("sent-canvas");
  const steps = scene ? [...scene.querySelectorAll(".cs-step")] : [];
  const ticks = scene ? [...scene.querySelectorAll(".cs-sent-ticks li")] : [];
  let P = reduce ? 1 : 0, stepOn = -1;

  const setStep = (n) => {
    if (n === stepOn) return;
    stepOn = n;
    steps.forEach((s, i) => s.classList.toggle("is-on", i === n));
    ticks.forEach((t, i) => t.classList.toggle("is-on", i <= n));
  };

  const draw = () => {
    if (!canvas) return;
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
    const fs = small ? 9 : 10.5;

    // Stage progress
    const k1 = ease(seg(P, 0.03, 0.22));
    const k2 = ease(seg(P, 0.27, 0.45));
    const k3 = ease(seg(P, 0.50, 0.64));
    const k4 = ease(seg(P, 0.68, 0.93));
    const domainEnd = lerp(SPLIT, N - 1, k3);
    const drawEnd = k4 > 0 ? SPLIT + k4 * (N - 1 - SPLIT) : k1 * SPLIT;

    // Layout
    const pad = { l: 4, r: small ? 66 : 92, t: 34, b: 6 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const eqTop = pad.t, eqBot = pad.t + plotH * 0.74;
    const sTop = eqBot + (small ? 18 : 24), sBot = h - pad.b;
    const sMid = (sTop + sBot) / 2, sAmp = (sBot - sTop) / 2;
    const X = (t) => pad.l + (t / domainEnd) * plotW;
    const Y = (v) => eqBot - ((v - lo) / (hi - lo)) * (eqBot - eqTop);
    const right = pad.l + plotW;

    ctx.font = `${fs}px ${C.mono}`;
    ctx.textBaseline = "alphabetic";

    // Gridlines (no numeric ticks — this is a shape, not a dataset)
    ctx.strokeStyle = C.rule; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(eqTop + (i / 4) * (eqBot - eqTop)) + .5;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(right, y); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(pad.l, Math.round(sMid) + .5); ctx.lineTo(right, Math.round(sMid) + .5); ctx.stroke();

    // Out-of-sample shading + split line
    const splitX = X(SPLIT);
    if (k3 > 0) {
      ctx.globalAlpha = k3;
      ctx.fillStyle = C.soft;
      ctx.fillRect(splitX, eqTop - 14, right - splitX + pad.r, sBot - eqTop + 14);
      ctx.globalAlpha = 1;
    }

    // Region labels
    ctx.fillStyle = C.ink3;
    ctx.textAlign = "left";
    ctx.fillText("IN-SAMPLE", pad.l + 2, 13);
    ctx.fillText("SENTIMENT", pad.l + 2, sTop - 6);
    if (k3 > 0 && !small) {
      ctx.globalAlpha = k3;
      ctx.fillStyle = C.accent;
      ctx.textAlign = "right";
      ctx.fillText("OUT-OF-SAMPLE", right - 2, 13);
      ctx.globalAlpha = 1;
    }

    // Sentiment bars
    const barW = Math.max(1, plotW / domainEnd);
    const last = Math.floor(drawEnd);
    for (let t = 0; t <= last && t < N; t++) {
      const v = D.S[t] / maxS;
      const x = X(t);
      if (x > right) break;
      ctx.fillStyle = v >= 0 ? C.up : C.down;
      ctx.globalAlpha = 0.5;
      const bh = v * sAmp * 0.95;
      ctx.fillRect(x, v >= 0 ? sMid - bh : sMid, barW * 0.9, Math.abs(bh));
    }
    ctx.globalAlpha = 1;

    // Line helper: draws series f(t) over [0, end] with fractional tail
    const line = (f, end, color, width, dash) => {
      if (end <= 0) return null;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      const stepT = Math.max(1, Math.floor(domainEnd / (plotW * 1.5)));
      const fi = Math.floor(end);
      for (let t = 0; t <= fi; t += stepT) { const x = X(t), y = Y(f(t)); t === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      let tipX = X(fi), tipY = Y(f(fi));
      const fr = end - fi;
      if (fi + 1 < N) { tipX = X(fi + fr); tipY = Y(lerp(f(fi), f(fi + 1), fr)); }
      ctx.lineTo(tipX, tipY);
      ctx.stroke(); ctx.setLineDash([]);
      return [tipX, tipY];
    };

    const tips = [];
    // Models (behind the benchmark)
    if (k2 > 0) {
      ctx.globalAlpha = Math.min(1, k2 * 1.4);
      MODELS.forEach((m, i) => {
        const tip = line((t) => modelVal(i, t, k2), drawEnd, C.accent, 1.5, m.dash);
        if (tip) tips.push({ y: tip[1], x: tip[0], label: small && m.short ? m.short : m.name, color: C.accent, a: Math.min(1, k2 * 1.4) });
      });
      ctx.globalAlpha = 1;
    }
    // Benchmark
    const bTip = line((t) => D.B[t], drawEnd, C.ink, 2, []);
    if (bTip) tips.push({ y: bTip[1], x: bTip[0], label: small ? "B&H" : "Buy & hold", color: C.ink, a: 1, bold: true });

    // Split line, drawn on top
    if (k3 > 0) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(Math.round(splitX) + .5, eqTop - 14);
      ctx.lineTo(Math.round(splitX) + .5, lerp(eqTop - 14, sBot, k3)); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = k3;
      ctx.fillStyle = C.ink;
      ctx.font = `500 ${fs}px ${C.mono}`;
      ctx.textAlign = "right"; ctx.fillText("train", splitX - 6, 13);
      ctx.textAlign = "center"; ctx.fillText("|", splitX + .5, 13);
      ctx.textAlign = "left"; ctx.fillText("test", splitX + 6, 13);
      ctx.font = `${fs}px ${C.mono}`;
      ctx.globalAlpha = 1;
    }

    // Tip dots + labels, de-overlapped vertically
    if (tips.length) {
      const gap = fs + 4;
      tips.sort((a, b) => a.y - b.y);
      const ys = tips.map((t) => t.y);
      for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < gap) ys[i] = ys[i - 1] + gap;
      const overflow = ys[ys.length - 1] - eqBot;
      if (overflow > 0) for (let i = 0; i < ys.length; i++) ys[i] -= overflow;
      tips.forEach((t, i) => {
        ctx.globalAlpha = t.a;
        ctx.fillStyle = t.color;
        ctx.beginPath(); ctx.arc(t.x, t.y, t.bold ? 3 : 2.4, 0, 7); ctx.fill();
        const lx = Math.min(t.x + 10, right + 10);
        ctx.strokeStyle = t.color; ctx.lineWidth = .75; ctx.globalAlpha = t.a * .5;
        ctx.beginPath(); ctx.moveTo(t.x + 4, t.y); ctx.lineTo(lx - 3, ys[i] - fs * .35); ctx.stroke();
        ctx.globalAlpha = t.a;
        ctx.textAlign = "left";
        ctx.font = `${t.bold ? 500 : 400} ${fs}px ${C.mono}`;
        ctx.fillText(t.label, lx, ys[i]);
      });
      ctx.globalAlpha = 1;
      ctx.font = `${fs}px ${C.mono}`;
    }

  };

  if (scene && canvas) {
    if (reduce) {
      scene.classList.add("is-static");
      steps.forEach((s) => s.classList.add("is-on"));
      scene.querySelector(".cs-steps").removeAttribute("aria-live");
      P = 1;
    } else {
      AK.onScene(scene, (p) => {
        P = p;
        setStep(p < 0.25 ? 0 : p < 0.48 ? 1 : p < 0.66 ? 2 : 3);
        draw();
      });
    }
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas.parentElement);
    addEventListener("ak:theme", draw);
    draw();
  }

  /* =======================================================
     3. Regularisation explainer
     ======================================================= */
  const BETA = [0.82, -0.55, 0.34, 0.12, -0.21, 0.06, 0.47, -0.09];
  const SUB = ["₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈"];
  const SCALE = 0.9;
  const soft = (b, th) => Math.sign(b) * Math.max(0, Math.abs(b) - th);
  const METHODS = {
    lasso: { title: "LASSO · L1 penalty", text: "Subtracts the same amount from every coefficient. Weak ones hit zero and stay there — built-in feature selection.",
             f: (b, l) => soft(b, l * 0.8) },
    ridge: { title: "Ridge · L2 penalty", text: "Shrinks every coefficient in proportion to its size. Everything gets smaller; nothing quite reaches zero.",
             f: (b, l) => b / (1 + 4 * l) },
    enet:  { title: "Elastic Net · L1 + L2", text: "Half of each. Shrinks proportionally and still zeroes out the weakest — useful when inputs move together.",
             f: (b, l) => soft(b, l * 0.4) / (1 + 2 * l) },
  };

  const barsEl = document.getElementById("reg-bars");
  const range = document.getElementById("lam");
  const out = document.getElementById("lam-out");
  const tabs = [...document.querySelectorAll(".cs-tab[data-m]")];
  const panel = document.getElementById("reg-panel");
  const explain = document.getElementById("reg-explain");
  const nzEl = document.getElementById("reg-nz");
  const massEl = document.getElementById("reg-mass");
  if (!barsEl || !range) return;

  let method = "lasso";
  barsEl.innerHTML = BETA.map((b, i) => {
    const side = b >= 0 ? "pos" : "neg";
    const r = (Math.abs(b) / SCALE) * 50;
    return `<li><span class="k">β${SUB[i]}</span><span class="cs-sent-track"><span class="ghost ${side}" style="width:${r}%"></span><span class="bar ${side}"></span></span><span class="v"></span></li>`;
  }).join("");
  const rows = [...barsEl.children];
  const total = BETA.reduce((s, b) => s + Math.abs(b), 0);

  const render = (lamPct) => {
    const l = lamPct / 100;
    const m = METHODS[method];
    let nz = 0, mass = 0;
    BETA.forEach((b, i) => {
      const c = m.f(b, l);
      const zero = Math.abs(c) < 1e-4;
      if (!zero) nz++;
      mass += Math.abs(c);
      const row = rows[i];
      row.querySelector(".bar").style.transform = `scaleX(${(Math.abs(c) / SCALE).toFixed(4)})`;
      row.querySelector(".v").textContent = zero ? "0" : (c > 0 ? "+" : "−") + Math.abs(c).toFixed(2);
      row.classList.toggle("is-zero", zero);
      row.setAttribute("aria-label", `beta ${i + 1}: ${zero ? "zero" : c.toFixed(2)}`);
    });
    nzEl.textContent = `${nz}/${BETA.length}`;
    massEl.textContent = `${Math.round((mass / total) * 100)}%`;
    out.textContent = l.toFixed(2);
    range.style.setProperty("--fill", lamPct + "%");
    range.setAttribute("aria-valuetext", `lambda ${l.toFixed(2)}`);
  };

  const setMethod = (m, focus) => {
    method = m;
    tabs.forEach((t) => {
      const on = t.dataset.m === m;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on) { panel.setAttribute("aria-labelledby", t.id); if (focus) t.focus(); }
    });
    explain.querySelector('[data-x="title"]').textContent = METHODS[m].title;
    explain.querySelector('[data-x="text"]').textContent = METHODS[m].text;
    render(+range.value);
  };

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => setMethod(t.dataset.m));
    t.addEventListener("keydown", (e) => {
      let j = null;
      if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") j = 0;
      if (e.key === "End") j = tabs.length - 1;
      if (j != null) { e.preventDefault(); setMethod(tabs[j].dataset.m, true); }
    });
  });
  range.addEventListener("input", () => render(+range.value));

  // Intro: on first view, sweep λ from 0 up to its resting value.
  const rest = +range.value;
  const reg = document.querySelector(".cs-sent-reg");
  if (reduce || !reg) render(rest);
  else {
    range.value = 0; render(0);
    let touched = false;
    range.addEventListener("pointerdown", () => (touched = true), { once: true });
    reg.addEventListener("ak:in", () => {
      const t0 = performance.now() + 350, dur = 1400;
      const stepFn = (t) => {
        if (touched) return;
        const k = clamp((t - t0) / dur);
        const v = Math.round(rest * (1 - Math.pow(1 - k, 3)));
        range.value = v; render(v);
        if (k < 1) requestAnimationFrame(stepFn);
      };
      requestAnimationFrame(stepFn);
    }, { once: true });
  }
})();
