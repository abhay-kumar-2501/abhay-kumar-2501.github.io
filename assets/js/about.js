/* =========================================================
   04 — About & Contact
   Interest tiles (line drawings), status-board clock,
   copy-to-clipboard for the email address.
   ========================================================= */
(() => {
  const AK = window.AK || {};
  const reduce = AK.reduce ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
  const EMAIL = AK.EMAIL || "codeabhay3@gmail.com";

  // Keep links in sync with the shared runtime.
  if (AK.RESUME) document.querySelectorAll("[data-resume]").forEach((a) => (a.href = AK.RESUME));
  if (AK.LINKEDIN) document.querySelectorAll("[data-linkedin]").forEach((a) => (a.href = AK.LINKEDIN));
  document.querySelectorAll("[data-email]").forEach((a) => (a.href = "mailto:" + EMAIL));

  /* ---------- Waveform (The Weeknd tile) ---------- */
  const wave = document.querySelector(".wave");
  if (wave) {
    const NS = "http://www.w3.org/2000/svg";
    const N = 44, x0 = 20, x1 = 300, mid = 70, w = (x1 - x0) / N;
    const axis = document.createElementNS(NS, "path");
    axis.setAttribute("d", `M${x0} ${mid} H${x1}`);
    axis.setAttribute("class", "wave-axis");
    wave.append(axis);
    for (let i = 0; i < N; i++) {
      // Deterministic, music-like envelope — decorative, not data.
      const t = i / (N - 1);
      const env = Math.sin(Math.PI * t) * 0.75 + 0.25;
      const h = Math.max(6, (Math.abs(Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.43) * 0.4)) * 96 * env);
      const r = document.createElementNS(NS, "rect");
      r.setAttribute("x", (x0 + i * w + w * 0.2).toFixed(2));
      r.setAttribute("width", (w * 0.6).toFixed(2));
      r.setAttribute("y", (mid - h / 2).toFixed(2));
      r.setAttribute("height", h.toFixed(2));
      r.setAttribute("rx", "1");
      r.style.setProperty("--wd", `${((i * 0.137) % 1.1).toFixed(3)}s`);
      wave.append(r);
    }
  }

  /* ---------- Flight path: the plane follows the drawn line ---------- */
  const fly = document.querySelector(".tile--fly");
  if (fly) {
    const path = fly.querySelector(".fly-path");
    const plane = fly.querySelector(".fly-plane");
    const L = path.getTotalLength();
    const place = (k) => {
      const p = path.getPointAtLength(L * k);
      const q = path.getPointAtLength(Math.min(L, L * k + 1));
      const p0 = k >= 1 ? path.getPointAtLength(L - 1) : p;
      const a = Math.atan2(q.y - p0.y, q.x - p0.x) * 180 / Math.PI;
      plane.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${a.toFixed(1)})`);
    };
    place(0);
    let raf = 0;
    const fly1 = () => {
      cancelAnimationFrame(raf);
      if (reduce) { place(1); return; }
      const t0 = performance.now(), dur = 1200;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        place(1 - Math.pow(1 - k, 3)); // same ease-out feel as the CSS stroke
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const land = () => { cancelAnimationFrame(raf); if (!fly.classList.contains("is-on")) place(0); };
    fly.addEventListener("mouseenter", fly1);
    fly.addEventListener("focus", fly1);
    fly.addEventListener("mouseleave", land);
    fly.addEventListener("blur", land);
    fly.addEventListener("ak:tile-on", fly1);
  }

  /* ---------- Touch: no hover, so tiles draw when they scroll in, and toggle on tap ---------- */
  const tiles = [...document.querySelectorAll(".tile")];
  const noHover = matchMedia("(hover: none)").matches;
  const setOn = (tile, on) => {
    tile.classList.toggle("is-on", on);
    if (on) tile.dispatchEvent(new CustomEvent("ak:tile-on"));
  };
  if (noHover) {
    tiles.forEach((tile) => {
      tile.addEventListener("ak:in", () => setTimeout(() => setOn(tile, true), 350));
      tile.addEventListener("click", () => setOn(tile, !tile.classList.contains("is-on")));
    });
  }
  tiles.forEach((tile) => tile.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOn(tile, !tile.classList.contains("is-on")); }
  }));

  /* ---------- Status board clock (local time in University Park) ---------- */
  const clock = document.querySelector("[data-clock]");
  if (clock) {
    let fmt;
    try { fmt = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" }); } catch (e) {}
    const tick = () => { if (fmt) clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 20000);
  }

  /* ---------- Copy email + toast ---------- */
  const toast = document.querySelector(".toast");
  let toastT = 0;
  const say = (msg) => {
    if (!toast) return;
    clearTimeout(toastT);
    toast.textContent = msg;
    toast.classList.remove("show");
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("show")));
    toastT = setTimeout(() => toast.classList.remove("show"), 2400);
  };
  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;left:-9999px";
      document.body.append(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (err) {}
      ta.remove();
      return ok;
    }
  };
  const btn = document.querySelector(".mail-copy");
  if (btn) {
    const label = btn.querySelector(".mail-copy-t");
    btn.addEventListener("click", async () => {
      const ok = await copyText(EMAIL);
      say(ok ? `Copied ${EMAIL}` : "Couldn't copy. Select the address instead.");
      if (!ok) return;
      btn.classList.add("is-done");
      label.textContent = "Copied";
      setTimeout(() => { btn.classList.remove("is-done"); label.textContent = "Copy"; }, 2000);
    });
  }
})();
