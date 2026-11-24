/* =========================================================
   03 — The Record
   The spine draws itself with scroll; entries post to the
   ledger as the line reaches them; filter chips dim entries.
   ========================================================= */
(() => {
  const AK = window.AK;
  const reduce = AK ? AK.reduce : matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // Résumé path comes from the shared runtime so it stays in sync.
  if (AK && AK.RESUME) document.querySelectorAll("[data-resume]").forEach((a) => (a.href = AK.RESUME));

  const tl = document.querySelector(".tl");
  if (!tl) return;
  const body = tl.querySelector(".tl-body");
  const spine = tl.querySelector(".spine");
  const entries = [...tl.querySelectorAll(".entry")];
  const yearBox = tl.querySelector(".tl-year-num");
  let year = yearBox.textContent.trim();

  /* ---------- Sticky fiscal-year marker ---------- */
  const setYear = (y) => {
    if (y === year) return;
    year = y;
    const old = yearBox.querySelector("span:not(.leave)");
    const nu = document.createElement("span");
    nu.textContent = y;
    if (reduce) { yearBox.replaceChildren(nu); return; }
    nu.className = "enter";
    yearBox.append(nu);
    requestAnimationFrame(() => requestAnimationFrame(() => nu.classList.remove("enter")));
    if (old) { old.classList.add("leave"); setTimeout(() => old.remove(), 700); }
  };

  /* ---------- Spine geometry ---------- */
  let nodeY = [], H = 0;
  const measure = () => {
    H = spine.offsetHeight;
    nodeY = entries.map((e) => e.offsetTop + 7); // node centre, relative to the spine top (≈ body top)
  };

  const update = () => {
    const r = body.getBoundingClientRect();
    const reading = innerHeight * 0.62;                 // the "now" line in the viewport
    const fh = reduce ? H : clamp(reading - r.top, 0, H);
    spine.style.setProperty("--fill", (H ? fh / H : 0).toFixed(4));
    spine.style.setProperty("--fh", fh.toFixed(1) + "px");
    spine.classList.toggle("done", fh >= H - 1);

    let active = null, lastAny = null;
    entries.forEach((e, i) => {
      const on = fh >= nodeY[i] - 2;
      e.classList.toggle("is-reached", on);
      if (on) { lastAny = e; if (!e.classList.contains("is-dim")) active = e; }
    });
    active = active || lastAny;
    entries.forEach((e) => e.classList.toggle("is-active", e === active));
    setYear((active || entries[0]).dataset.year);
  };

  let ticking = false;
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } };

  if (!reduce) tl.classList.add("js-tl");
  measure();
  update();
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", () => { measure(); request(); });
  // Fonts / images can shift layout after load; re-measure once things settle.
  addEventListener("load", () => { measure(); request(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); request(); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { measure(); request(); }).observe(body);

  /* ---------- Filter chips ---------- */
  const chips = [...document.querySelectorAll(".chip[data-filter]")];
  const status = document.querySelector(".filter-status");
  chips.forEach((chip) => chip.addEventListener("click", () => {
    const f = chip.dataset.filter;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
    let n = 0;
    entries.forEach((e) => {
      const match = f === "all" || e.dataset.cat.split(" ").includes(f);
      e.classList.toggle("is-dim", !match);
      if (match) n++;
      // Dimmed entries leave the tab order so keyboard users skip them.
      e.querySelectorAll("a").forEach((a) => (match ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1")));
    });
    if (status) status.textContent = `Showing ${n} of ${entries.length} entries${f === "all" ? "" : " tagged " + f}.`;
    update();
  }));
})();
