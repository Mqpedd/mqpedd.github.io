(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------- Background: the red silk gradient, drawn small and scaled up so it stays soft ---------- */
  const bg = document.getElementById("bg");
  const ctx = bg.getContext("2d");
  const DOWN = 6;
  let W = 0,
    H = 0;
  function sizeBg() {
    W = Math.max(2, Math.ceil(innerWidth / DOWN));
    H = Math.max(2, Math.ceil(innerHeight / DOWN));
    bg.width = W;
    bg.height = H;
  }
  function drawBg(time, scroll) {
    const t = time / 1000;
    const s = Math.sin,
      c = Math.cos;
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";

    // base: black on the left into deep maroon
    const base = ctx.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, "#000000");
    base.addColorStop(0.45, "#1c0000");
    base.addColorStop(1, "#3a0000");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    // the hot glow, low and slightly left of centre; drifts with time and scroll
    const gx = W * (0.38 + 0.04 * s(t * 0.11) - 0.06 * scroll),
      gy = H * (1.02 - 0.12 * scroll);
    const gr = Math.max(W, H) * (0.72 + 0.03 * s(t * 0.17));
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    glow.addColorStop(0, "#f00000");
    glow.addColorStop(0.28, "#c40000");
    glow.addColorStop(0.6, "rgba(110,0,0,.55)");
    glow.addColorStop(1, "rgba(60,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // the wave: a lit fold sweeping from the top right down to the bottom centre
    const sw = 0.03 * s(t * 0.13),
      sw2 = 0.03 * c(t * 0.09);
    const P = (x, y) => [x * W, y * H];
    const curve = (g) => {
      g.moveTo(...P(1.02, -0.05));
      g.bezierCurveTo(
        ...P(0.95 + sw, 0.32),
        ...P(0.9, 0.52 + sw2),
        ...P(0.72 + sw, 0.62),
      );
      g.bezierCurveTo(
        ...P(0.58, 0.7 - sw2),
        ...P(0.5 + sw, 0.82),
        ...P(0.42, 1.05),
      );
    };
    // shadow hugging the inside of the fold
    ctx.save();
    ctx.filter = `blur(${Math.max(2, W / 60)}px)`;
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = W * 0.07;
    ctx.beginPath();
    curve(ctx);
    ctx.stroke();
    ctx.restore();
    // the lit side of the fold
    ctx.save();
    ctx.filter = `blur(${Math.max(1, W / 140)}px)`;
    ctx.beginPath();
    curve(ctx);
    ctx.lineTo(...P(1.05, 1.05));
    ctx.lineTo(...P(1.05, -0.05));
    ctx.closePath();
    const fold = ctx.createLinearGradient(...P(0.5, 1), ...P(1, 0.2));
    fold.addColorStop(0, "#8e0000");
    fold.addColorStop(0.45, "#c80000");
    fold.addColorStop(0.8, "#a10000");
    fold.addColorStop(1, "#e10000");
    ctx.fillStyle = fold;
    ctx.fill();
    ctx.restore();

    // darken the top and the left edge, as in the reference
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    top.addColorStop(0, "rgba(0,0,0,.55)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H);
    const left = ctx.createLinearGradient(0, 0, W * 0.22, 0);
    left.addColorStop(0, "rgba(0,0,0,.85)");
    left.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, W, H);
  }

  /* ---------- Notch: shape follows its width ---------- */
  const notch = document.querySelector(".notch");
  const edge = document.getElementById("notch-edge");
  function shapeNotch() {
    const w = innerWidth <= 780 ? Math.min(innerWidth - 16, 330) : 700,
      h = 52;
    const d = (y0) =>
      `M0,${y0} C14,${y0} 20,4 26,14 L40,40 C44,48 50,${h - 0.5} 62,${h - 0.5} L${w - 62},${h - 0.5} C${w - 50},${h - 0.5} ${w - 44},48 ${w - 40},40 L${w - 26},14 C${w - 20},4 ${w - 14},${y0} ${w},${y0}`;
    notch.style.setProperty("--nw", w + "px");
    notch.style.clipPath = `path("${d(0)} Z")`;
    edge.setAttribute("d", d(0.5));
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.querySelector(".menu-btn");
  const sheet = document.getElementById("sheet");
  const setMenu = (open) => {
    menuBtn.setAttribute("aria-expanded", String(open));
    sheet.classList.toggle("open", open);
  };
  menuBtn.addEventListener("click", () =>
    setMenu(menuBtn.getAttribute("aria-expanded") !== "true"),
  );
  sheet.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });

  /* ---------- About statement: words light up as you scroll ---------- */
  const stmt = document.getElementById("statement");
  const stmtSection = document.querySelector(".statement");
  let wordEls = [];
  function splitStatement(text) {
    if (!stmt) return;
    let hl = false;
    stmt.innerHTML = text
      .split(/\s+/)
      .map((word) => {
        const starts = word.startsWith("*"),
          ends = /\*[.,]?$/.test(word);
        if (starts) hl = true;
        const clean = word.replace(/\*/g, "");
        const html = `<span class="w${hl ? " hl" : ""}">${clean}</span>`;
        if (ends) hl = false;
        return html;
      })
      .join(" ")
      .replace(/ (?=<span[^>]*>[^<]*<\/span>$)/, "\u00a0"); // no lone last word
    wordEls = stmt.querySelectorAll(".w");
    onScroll();
  }

  /* ---------- Clean line breaks ----------
     - hyphenated words (high-end, Sleeper-Build) never split at the hyphen
     - the last two words of a sentence stay together, so no line holds a single word */
  const TIDY = "main p, main h1, main h2, main h3, .foot small";
  function tidyBreaks() {
    document.querySelectorAll(TIDY).forEach((el) => {
      if (el.dataset.tidied || el.closest(".statement, .name-in, .sr-only")) return;
      el.dataset.tidied = "1";
      const texts = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) if (!walk.currentNode.parentElement.closest(".nw")) texts.push(walk.currentNode);
      for (const t of texts) {
        if (!/\p{L}-\p{L}/u.test(t.data)) continue;
        const frag = document.createDocumentFragment();
        let last = 0;
        for (const m of t.data.matchAll(/[^\s]*\p{L}-\p{L}[^\s]*/gu)) {
          frag.append(t.data.slice(last, m.index));
          const span = document.createElement("span");
          span.className = "nw";
          span.textContent = m[0];
          frag.append(span);
          last = m.index + m[0].length;
        }
        frag.append(t.data.slice(last));
        t.replaceWith(frag);
      }
      if (el.textContent.trim().split(/\s+/).length < 4) return; // short labels may wrap evenly instead
      const all = [];
      const walk2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walk2.nextNode()) all.push(walk2.currentNode);
      let wordSeen = false; // true once the last word turned out to sit in a later node (a hyphenated word's span)
      for (const t of all.reverse()) {
        if (!wordSeen) {
          const m = t.data.match(/^([\s\S]*\S)[ \t\n]+(\S+\s*)$/);
          if (m) {
            t.data = m[1] + " " + m[2];
            break;
          }
          if (!t.data.trim()) continue;
          if (/^[ \t\n]/.test(t.data)) {
            t.data = t.data.replace(/^[ \t\n]+/, " ");
            break;
          }
          wordSeen = true;
          continue;
        }
        if (/[ \t\n]$/.test(t.data)) {
          t.data = t.data.replace(/[ \t\n]+$/, " ");
          break;
        }
        if (t.data.trim()) break; // two nodes touch without a space: nothing to join
      }
    });
  }

  /* ---------- Language: English / German ---------- */
  let lang = "en";
  function setLang(next) {
    lang = next;
    root.lang = next;
    document.querySelectorAll("[data-en]").forEach((el) => {
      if (el === stmt) return;
      if (el.dataset[next] != null) {
        el.innerHTML = el.dataset[next];
        delete el.dataset.tidied;
      }
    });
    document.querySelectorAll("[data-en-placeholder]").forEach((el) => {
      el.placeholder = el.dataset[next + "Placeholder"];
    });
    document
      .querySelectorAll(".notch [data-lang-toggle]")
      .forEach((b) => {
        b.textContent = next === "en" ? "DE" : "EN";
        b.setAttribute(
          "aria-label",
          next === "en" ? "Deutsch" : "English",
        );
      });
    if (stmt) splitStatement(stmt.dataset[next]);
    tidyBreaks();
    layoutTimeline();
    try {
      localStorage.setItem("lang", next);
    } catch {}
  }
  document
    .querySelectorAll("[data-lang-toggle]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        setLang(lang === "en" ? "de" : "en"),
      ),
    );

  /* ---------- Scroll: scrim and statement ---------- */
  let scrollK = 0;
  function onScroll() {
    scrollK = clamp(scrollY / innerHeight);
    root.style.setProperty("--scrim", (scrollK * 0.32).toFixed(3));
    if (!stmtSection) return;
    if (reduce || !wordEls.length) {
      wordEls.forEach((el) => el.classList.add("on"));
      return;
    }
    const r = stmtSection.getBoundingClientRect();
    const p = clamp(
      (innerHeight * 0.55 - r.top) / (r.height - innerHeight * 0.45),
    );
    const lit = Math.round(p * wordEls.length * 1.2);
    wordEls.forEach((el, i) => el.classList.toggle("on", i < lit));
  }
  addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Process timeline: the line fills as you scroll and lights each step ---------- */
  const tl = document.getElementById("timeline");
  const tlLine = tl && tl.querySelector(".tl-line");
  const tlSteps = tl ? [...tl.querySelectorAll(".tl-step")] : [];
  const tlNodes = tlSteps.map((st) => st.querySelector(".node"));
  function layoutTimeline() {
    if (!tl) return;
    const box = tl.getBoundingClientRect();
    const c = tlNodes.map((n) => {
      const r = n.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - box.left,
        y: r.top + r.height / 2 - box.top,
      };
    });
    const a = c[0],
      b = c[c.length - 1];
    const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
    tl.dataset.dir = vertical ? "v" : "h";
    Object.assign(
      tlLine.style,
      vertical
        ? {
            left: `${a.x - 1}px`,
            top: `${a.y}px`,
            width: "2px",
            height: `${b.y - a.y}px`,
          }
        : {
            left: `${a.x}px`,
            top: `${a.y - 1}px`,
            width: `${b.x - a.x}px`,
            height: "2px",
          },
    );
    progressTimeline();
  }
  function progressTimeline() {
    if (!tl) return;
    let p = 1;
    if (!reduce) {
      const first = tlNodes[0].getBoundingClientRect(),
        last = tlNodes[tlNodes.length - 1].getBoundingClientRect();
      const trigger = innerHeight * 0.72;
      p =
        tl.dataset.dir === "v"
          ? clamp(
              (trigger - first.top) / Math.max(1, last.top - first.top),
            )
          : clamp((trigger - first.top) / (innerHeight * 0.3));
    }
    tl.style.setProperty(
      tl.dataset.dir === "v" ? "--tl-y" : "--tl-x",
      p.toFixed(3),
    );
    tl.style.setProperty(tl.dataset.dir === "v" ? "--tl-x" : "--tl-y", 1);
    tlSteps.forEach((st, i) =>
      st.classList.toggle("on", p >= i / (tlSteps.length - 1) - 0.001),
    );
  }
  addEventListener("scroll", progressTimeline, { passive: true });
  addEventListener("resize", layoutTimeline);

  /* ---------- Glow cards: one spotlight shared by every card ---------- */
  const gcards = [...document.querySelectorAll(".gcard")];
  gcards.forEach((card) =>
    card.insertAdjacentHTML(
      "beforeend",
      '<span class="g-bloom" aria-hidden="true"></span><span class="g-edge" aria-hidden="true"></span>',
    ),
  );
  let glowAt = null;
  let glowQueued = false;
  function paintGlow() {
    glowQueued = false;
    if (!glowAt) return;
    root.style.setProperty("--xp", (glowAt.x / innerWidth).toFixed(3));
    for (const card of gcards) {
      const r = card.getBoundingClientRect();
      if (r.bottom < -300 || r.top > innerHeight + 300) continue; // off screen
      card.style.setProperty("--gx", `${(glowAt.x - r.left).toFixed(1)}px`);
      card.style.setProperty("--gy", `${(glowAt.y - r.top).toFixed(1)}px`);
    }
  }
  const queueGlow = () => {
    if (!glowQueued) {
      glowQueued = true;
      requestAnimationFrame(paintGlow);
    }
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return; // no hover on touch screens
      glowAt = { x: e.clientX, y: e.clientY };
      root.style.setProperty("--glow-on", 1);
      queueGlow();
    },
    { passive: true },
  );
  addEventListener("scroll", queueGlow, { passive: true }); // cards move under a still pointer
  document.documentElement.addEventListener("mouseleave", () =>
    root.style.setProperty("--glow-on", 0),
  );

  /* ---------- Builds: each PC floats and turns toward the pointer, like the hero ---------- */
  // any element marked data-b3d holding one PC photo, on either page
  const builds = [...document.querySelectorAll("[data-b3d]")].map((media, i) => {
    const card = media.closest(".gcard") || media;
    const img = media.querySelector("img");
    const stage = document.createElement("div");
    stage.className = "b3d";
    stage.innerHTML = '<span class="b3d-floor" aria-hidden="true"></span><div class="b3d-pc"></div>';
    const pcBox = stage.querySelector(".b3d-pc");
    img.replaceWith(stage);
    pcBox.append(img);
    // absolute URL: a relative one would resolve against assets/site.css, where the mask is used
    pcBox.style.setProperty("--src", `url("${img.src}")`);
    return {
      card,
      pc: pcBox,
      floor: stage.querySelector(".b3d-floor"),
      phase: i * 1.7, // so the four PCs don't bob in sync
      visible: false,
      x: 0, y: 0,
    };
  });
  const buildSeen = new IntersectionObserver((entries) =>
    entries.forEach((en) => {
      const b = builds.find((item) => item.card === en.target);
      if (b) b.visible = en.isIntersecting;
    }),
  );
  builds.forEach((b) => buildSeen.observe(b.card));
  function moveBuilds(now) {
    for (const b of builds) {
      if (!b.visible) continue;
      // turn toward the pointer while it is over the card, otherwise drift back to rest
      let tx = 0, ty = 0;
      if (glowAt) {
        const r = b.card.getBoundingClientRect();
        if (glowAt.x >= r.left && glowAt.x <= r.right && glowAt.y >= r.top && glowAt.y <= r.bottom) {
          tx = ((glowAt.x - r.left) / r.width - 0.5) * 2;
          ty = ((glowAt.y - r.top) / r.height - 0.5) * 2;
        }
      }
      b.x = lerp(b.x, tx, 0.08);
      b.y = lerp(b.y, ty, 0.08);
      const t = now + b.phase * 1000;
      const bob = Math.sin(t / 1500);
      const ry = b.x * 16 + Math.sin(t / 3200) * 5;
      const rx = -b.y * 9 + Math.cos(t / 2700) * 2;
      b.pc.style.transform = `translate3d(${(b.x * 12).toFixed(1)}px, ${(bob * 9 + b.y * 6).toFixed(1)}px, 0) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateZ(${(Math.sin(t / 2300) * 1.2).toFixed(2)}deg)`;
      b.pc.style.setProperty("--sheen", `${(50 - b.x * 40 - Math.sin(t / 3200) * 12).toFixed(1)}%`);
      b.floor.style.transform = `translateX(${(b.x * 10).toFixed(1)}px) scale(${(1 - bob * 0.08).toFixed(3)})`;
      b.floor.style.opacity = (0.9 - bob * 0.15).toFixed(3);
    }
  }

  /* ---------- Specs: keep numbers with their units and model names together, so a line never ends on "16" or "RTX" ---------- */
  document.querySelectorAll(".spec dd").forEach((dd) => {
    if (dd.children.length) return;
    dd.textContent = dd.textContent
      .replace(/(\d)\s+(GB|TB|MB|W|mm|MHz|GHz)\b/g, "$1 $2") // 2 TB, 360 mm
      .replace(/\s+(XT|XTX|Ti|Super|Pro|X3D)\b/g, " $1") // RX 9070 XT, 990 Pro
      .replace(/\b(RTX|GTX|RX|Ryzen \d|Core i\d|DDR\d|LGA|O11)\s+/g, "$1 ") // RTX 3070, LGA 1700
      .replace(/\s+\(/g, " ("); // keep "(modified)" with the word before it
  });

  /* ---------- Builds page: the PC waits just below the title until the title reaches the nav ---------- */
  const bds = [...document.querySelectorAll(".bd")];
  const NAV_CLEAR = 96; // just below the 84px notch
  function layoutBuildPages() {
    for (const bd of bds) {
      const name = bd.querySelector(".bd-name");
      const specs = bd.querySelector(".specs");
      const head = specs.offsetTop - name.offsetTop; // title + description
      const tall = head + Math.max(specs.offsetHeight, bd.querySelector(".bd-media").offsetHeight);
      // as close under the nav as possible, but never so low that the bottom of the PC is cut off
      const nameTop = Math.min(NAV_CLEAR, innerHeight - tall - 16);
      const pad = parseFloat(getComputedStyle(bd).paddingTop);
      bd.style.setProperty("--bd-top", `${Math.round(nameTop - pad)}px`);
      bd.style.setProperty("--media-top", `${Math.round(nameTop + head)}px`);
    }
  }
  if (bds.length) {
    const ro = new ResizeObserver(layoutBuildPages);
    bds.forEach((bd) => ["bd-name", "bd-lede", "specs"].forEach((c) => ro.observe(bd.querySelector("." + c))));
    addEventListener("resize", layoutBuildPages);
    document.fonts.ready.then(layoutBuildPages);
  }

  /* ---------- Menu sheet: edge lights up near the pointer ---------- */
  document.querySelectorAll(".glass:not(.gcard)").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
      el.style.setProperty("--lit", 1);
    });
    el.addEventListener("pointerleave", () =>
      el.style.setProperty("--lit", 0),
    );
  });

  /* ---------- Hero: PC floats and turns toward the pointer; the name moves the other way ---------- */
  const pc = document.getElementById("pc");
  const nameEl = document.getElementById("name");
  const ghost = document.getElementById("name-ghost");
  const floor = document.getElementById("floor");
  const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener(
    "pointermove",
    (e) => {
      tilt.tx = (e.clientX / innerWidth - 0.5) * 2;
      tilt.ty = (e.clientY / innerHeight - 0.5) * 2;
    },
    { passive: true },
  );
  function moveHero(now) {
    if (!pc) return;
    const bob = Math.sin(now / 1500); // -1..1, the float
    const k = scrollK;
    const ry = tilt.x * 16 + Math.sin(now / 3200) * 5;
    const rx = -tilt.y * 9 + Math.cos(now / 2700) * 2;
    pc.style.transform = `translate3d(${(tilt.x * 18).toFixed(1)}px, ${(bob * 14 + tilt.y * 8 - k * 90).toFixed(1)}px, 0) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateZ(${(Math.sin(now / 2300) * 1.2).toFixed(2)}deg)`;
    pc.style.setProperty(
      "--sheen",
      `${(50 - tilt.x * 40 - Math.sin(now / 3200) * 12).toFixed(1)}%`,
    );
    floor.style.transform = `translateX(${(tilt.x * 14).toFixed(1)}px) scale(${(1 - bob * 0.08 - k * 0.3).toFixed(3)})`;
    floor.style.opacity = (0.9 - bob * 0.12 - k * 0.8).toFixed(3);
    nameEl.style.transform = `translate3d(${(-tilt.x * 14).toFixed(1)}px, ${(-tilt.y * 8 + k * 70).toFixed(1)}px, 0)`;
    ghost.style.transform = `translate3d(${(-tilt.x * 34).toFixed(1)}px, ${(-tilt.y * 18 + k * 130 + 10).toFixed(1)}px, 0)`;
  }

  /* ---------- Contact form: sends through Web3Forms; without a key it opens the visitor's email app ---------- */
  const form = document.getElementById("contact-form");
  const note = document.getElementById("form-note");
  const msgs = {
    en: {
      missing: "Please fill in your name, email and message.",
      email: "Please check your email address.",
      sending: "Sending…",
      sent: "Thanks! Your message is on its way, and I'll get back to you soon.",
      failed: "That didn't go through. Please try again, or write to me directly at matiasteiner@gmail.com.",
      mailto: "Your email app should open now. If it does not, write to matiasteiner@gmail.com.",
    },
    de: {
      missing: "Bitte fülle Name, E-Mail und Nachricht aus.",
      email: "Bitte prüfe deine E-Mail-Adresse.",
      sending: "Wird gesendet…",
      sent: "Danke! Deine Nachricht ist unterwegs, ich melde mich bald bei dir.",
      failed: "Das hat nicht geklappt. Versuch es nochmals oder schreib mir direkt an matiasteiner@gmail.com.",
      mailto: "Dein E-Mail-Programm sollte sich jetzt öffnen. Falls nicht, schreib an matiasteiner@gmail.com.",
    },
  };
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.name.trim() || !d.email.trim() || !d.message.trim()) {
      note.textContent = msgs[lang].missing;
      return;
    }
    if (!form.elements.email.checkValidity()) {
      note.textContent = msgs[lang].email;
      form.elements.email.focus();
      return;
    }
    const subject = `PC request from ${d.name.trim()}`;
    const key = form.dataset.key.trim();
    if (!key) {
      // no form service set up yet: hand the message to the visitor's email app
      const body = `${d.message.trim()}\n\nBudget / PC type: ${d.budget.trim() || "-"}\n\n${d.name.trim()}\n${d.email.trim()}`;
      location.href = `mailto:matiasteiner@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      note.textContent = msgs[lang].mailto;
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    note.textContent = msgs[lang].sending;
    try {
      // plain form data, as in Web3Forms' own examples: no extra permission round trip for the browser
      const fields = {
        access_key: key,
        subject,
        from_name: "STPcs website",
        name: d.name.trim(),
        email: d.email.trim(), // replies go straight to the visitor
        budget: d.budget.trim() || "-",
        message: d.message.trim(),
        language: lang,
      };
      const body = new FormData();
      for (const [k, v] of Object.entries(fields)) body.append(k, v);
      if (d.botcheck) body.append("botcheck", "on"); // only a bot ticks the hidden box
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.success) throw new Error(out.message || res.status);
      form.reset();
      note.textContent = msgs[lang].sent;
    } catch (err) {
      console.warn("Contact form:", err);
      note.textContent = msgs[lang].failed;
    } finally {
      button.disabled = false;
    }
  });

  /* ---------- Frame loop ---------- */
  function frame(now) {
    drawBg(reduce ? 0 : now, scrollK);
    if (!reduce) {
      tilt.x = lerp(tilt.x, tilt.tx, 0.08);
      tilt.y = lerp(tilt.y, tilt.ty, 0.08);
      if (scrollY < innerHeight * 1.2) moveHero(now);
      moveBuilds(now);
      requestAnimationFrame(frame);
    }
  }
  addEventListener("resize", () => {
    sizeBg();
    shapeNotch();
    if (reduce) drawBg(0, scrollK);
  });
  addEventListener(
    "scroll",
    () => {
      if (reduce) drawBg(0, scrollK);
    },
    { passive: true },
  );

  /* ---------- Start ---------- */
  sizeBg();
  shapeNotch();
  let saved = "en";
  try {
    saved = localStorage.getItem("lang") || "en";
  } catch {}
  const asked = new URLSearchParams(location.search).get("lang");
  if (asked === "de" || asked === "en") saved = asked;
  setLang(saved);
  document.fonts.ready.then(layoutTimeline);
  requestAnimationFrame(frame);
})();
