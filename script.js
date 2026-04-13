/* =====================================================
   DESAFIO DO VESTIDO 14D — QUIZ ENGINE
   State management, localStorage, timer, loading,
   scratch card, dynamic profile, transitions.
   ===================================================== */

(() => {
  const TIMER_DURATION_S = 600; // 10 minutes
  const STORAGE_KEY = "dv14d_quiz";

  // ========== STATE ==========
  const state = {
    step: 0,
    answers: {},
    progress: 0,
    timerEnd: null,
  };

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(state, saved);
        return true;
      }
    } catch {}
    return false;
  }
  function setAnswer(questionId, value) {
    state.answers[questionId] = value;
    saveState();
  }

  // ========== DOM REFS ==========
  const screens = Array.from(document.querySelectorAll(".screen"));
  const progressFill = document.getElementById("progressFill");
  const headerSection = document.getElementById("headerSection");
  const backBtn = document.getElementById("backBtn");
  const totalSteps = screens.length;

  let currentIndex = 0;

  // ========== NAVIGATION ==========
  function goToScreen(index) {
    if (index < 0 || index >= totalSteps) return;

    const prev = screens[currentIndex];
    const next = screens[index];

    prev.classList.remove("active");
    prev.querySelectorAll(".is-selected").forEach(el => el.classList.remove("is-selected"));

    void next.offsetWidth;
    next.classList.add("active");

    currentIndex = index;
    state.step = index;
    saveState();

    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });

    const screenKey = next.dataset.screen;
    if (screenKey === "loading") runLoadingSequence();
    if (screenKey === "scratch") setTimeout(initScratchCard, 300);
    if (screenKey === "offer") { initOfferPage(); initScrollReveal(); }

    // Track step in all analytics
    trackFunnelStep(screenKey, index);
  }

  // ========== FUNNEL TRACKING ==========
  function trackFunnelStep(screenKey, stepIndex) {
    const eventName = "QuizStep_" + screenKey;
    const payload = { step: screenKey, step_number: stepIndex };

    // Meta Pixel — dispara 2 eventos: nome específico da tela + genérico "QuizStep"
    if (typeof fbq === "function") {
      fbq("trackCustom", eventName, payload);
      fbq("trackCustom", "QuizStep", payload);
    }

    // UTMify custom event (se o SDK suportar)
    if (window.utmify && typeof window.utmify.track === "function") {
      window.utmify.track(eventName, payload);
    }

    // Marcos principais do funil — eventos "limpos" para filtrar no Events Manager
    if (screenKey === "splash") fireMilestone("QuizStart");
    if (screenKey === "break1") fireMilestone("QuizBreak1");
    if (screenKey === "break2") fireMilestone("QuizBreak2_Mecanismo");
    if (screenKey === "break3") fireMilestone("QuizBreak3");
    if (screenKey === "break4") fireMilestone("QuizBreak4_Diagnostico");
    if (screenKey === "loading") fireMilestone("QuizLoading");
    if (screenKey === "scratch") fireMilestone("QuizScratch");
    if (screenKey === "offer") fireMilestone("QuizComplete_ViewOffer");
  }

  function fireMilestone(name) {
    if (typeof fbq === "function") fbq("trackCustom", name);
  }

  function updateProgress() {
    const current = screens[currentIndex];
    const pct = parseInt(current.dataset.progress, 10) || 0;
    state.progress = pct;
    progressFill.style.width = pct + "%";

    const section = current.dataset.section || "";
    headerSection.textContent = section;

    if (backBtn) {
      backBtn.hidden = currentIndex <= 0;
    }
  }

  if (backBtn) {
    backBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentIndex > 0) goToScreen(currentIndex - 1);
    });
  }

  // ========== OPTION CLICKS ==========
  document.querySelectorAll("[data-next]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.preventDefault();

      const parentScreen = el.closest(".screen");
      if (parentScreen && parentScreen.querySelector(".is-selected")) return;

      // Save answer if applicable
      const answerId = el.dataset.answer;
      const answerVal = el.dataset.value;
      if (answerId && answerVal) {
        setAnswer(answerId, answerVal);
      }

      // Visual feedback
      el.classList.add("is-selected");

      // Auto-advance with short delay
      setTimeout(() => {
        goToScreen(currentIndex + 1);
      }, 280);
    });
  });

  // ========== LOADING SEQUENCE (BetterMe exact) ==========
  function runLoadingSequence() {
    const steps = document.querySelectorAll(".loading-step");
    const durations = [1800, 1700, 1600, 1500, 1400]; // total ~8s
    let delay = 0;

    steps.forEach((step, i) => {
      const fill = step.querySelector(".loading-bar-fill");
      const pct = step.querySelector(".loading-step-pct");
      const duration = durations[i] || 500;

      // Reset
      fill.style.transition = "none";
      fill.style.width = "0%";
      pct.textContent = "0%";
      step.classList.remove("done");

      // Animate
      setTimeout(() => {
        fill.style.transition = `width ${duration}ms linear`;
        fill.style.width = "100%";

        // Count up percentage
        let start = Date.now();
        const countUp = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          pct.textContent = Math.round(progress * 100) + "%";
          if (progress < 1) requestAnimationFrame(countUp);
          else step.classList.add("done");
        };
        requestAnimationFrame(countUp);
      }, delay);

      delay += duration + 100;
    });

    // Auto-advance after all done
    setTimeout(() => {
      goToScreen(currentIndex + 1);
    }, delay + 200);
  }

  // ========== SCRATCH CARD ==========
  let scratchDone = false;

  function initScratchCard() {
    if (scratchDone) return;

    const wrapper = document.querySelector(".scratch-card-wrapper");
    const oldCanvas = document.getElementById("scratchCanvas");
    if (!wrapper) return;

    // Set coupon date
    const now = new Date();
    const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    const couponEl = document.getElementById("scratchCouponCode");
    if (couponEl) couponEl.textContent = now.getDate() + " de " + months[now.getMonth()];

    // Remove old canvas if exists, create fresh one
    if (oldCanvas) oldCanvas.remove();

    const canvas = document.createElement("canvas");
    canvas.id = "scratchCanvas";
    canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;border-radius:20px;cursor:pointer;touch-action:none;z-index:2;";
    wrapper.appendChild(canvas);

    // Get actual rendered size of wrapper
    const rect = wrapper.getBoundingClientRect();
    const W = Math.round(rect.width) || 280;
    const H = Math.round(rect.height) || 360;

    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d");

    // Fill solid cover
    ctx.fillStyle = "#3B2A24";
    ctx.fillRect(0, 0, W, H);

    // Text
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 18px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Raspe aqui", W / 2, H * 0.26);

    // Pointing up emoji as text fallback
    ctx.font = "44px Arial, sans-serif";
    ctx.fillText("\u261D", W / 2, H * 0.44);

    // Decorative lines
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(W*0.2, H*0.36); ctx.lineTo(W*0.6, H*0.30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W*0.25, H*0.42); ctx.lineTo(W*0.65, H*0.38); ctx.stroke();

    // Scratch logic
    let scratching = false;

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    function draw(e) {
      if (!scratching || scratchDone) return;
      e.preventDefault();
      const p = pos(e);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
      ctx.fill();
      check();
    }

    let checkCount = 0;
    function check() {
      checkCount++;
      if (checkCount % 5 !== 0) return; // only check every 5 strokes for perf
      const d = ctx.getImageData(0, 0, W, H).data;
      let c = 0;
      const total = d.length / 4;
      for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) c++; }
      if (c / total > 0.2) reveal();
    }

    function reveal() {
      if (scratchDone) return;
      scratchDone = true;
      canvas.style.transition = "opacity 0.5s ease";
      canvas.style.opacity = "0";
      setTimeout(() => {
        canvas.style.pointerEvents = "none";
        setTimeout(() => goToScreen(currentIndex + 1), 1500);
      }, 500);
    }

    canvas.onmousedown = e => { scratching = true; draw(e); };
    canvas.onmousemove = draw;
    canvas.onmouseup = () => scratching = false;
    canvas.onmouseleave = () => scratching = false;
    canvas.ontouchstart = e => { scratching = true; draw(e); };
    canvas.ontouchmove = draw;
    canvas.ontouchend = () => scratching = false;

    // Fallback
    setTimeout(() => { if (!scratchDone) reveal(); }, 12000);
  }

  // ========== OFFER PAGE ==========
  function initOfferPage() {
    generateDiagnosis();
    initTimer();
    initPricingCards();
    initCtaButtons();
    initStickyCta();
    initStatsCounter();
  }

  // ========== STICKY CTA ==========
  function initStickyCta() {
    const sticky = document.getElementById("stickyCta");
    const pricing = document.getElementById("pricingSection");
    if (!sticky) return;

    function check() {
      const scrolled = window.scrollY;
      // Show after 600px scroll
      const shouldShow = scrolled > 600;
      // Hide when pricing section is visible
      if (pricing) {
        const rect = pricing.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          sticky.classList.remove("is-visible");
          return;
        }
      }
      sticky.classList.toggle("is-visible", shouldShow);
    }
    window.addEventListener("scroll", check, { passive: true });
    check();
  }

  // ========== STATS COUNTER ==========
  function initStatsCounter() {
    const stats = document.querySelectorAll(".stat-number[data-count]");
    if (!stats.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.animated) return;
        el.dataset.animated = "1";
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || "";
        const duration = 1400;
        const start = Date.now();
        function tick() {
          const elapsed = Date.now() - start;
          const p = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    stats.forEach(s => observer.observe(s));
  }

  // ========== DYNAMIC DIAGNOSIS ==========
  function generateDiagnosis() {
    const el = document.getElementById("diagnosisText");
    const originEl = document.getElementById("originDiagnosis");
    if (!el) return;

    const a = state.answers;

    // ---- Determine dominant origin based on answers ----
    let scoreF = 0, scoreH = 0, scoreL = 0; // fermentative, hormonal, lymphatic

    // Q3: barriga varia
    if (a.q3 === "sim-piora") scoreF += 2;
    if (a.q3 === "sim-sempre") scoreH += 2;
    if (a.q3 === "grande-sempre") scoreL += 2;
    if (a.q3 === "as-vezes") { scoreF++; scoreH++; }

    // Q9: sintomas
    if (a.q9 === "inchaco") scoreF += 2;
    if (a.q9 === "dura") scoreL += 2;
    if (a.q9 === "peso") scoreL += 2;
    if (a.q9 === "tudo") { scoreF++; scoreH++; scoreL++; }

    // Q10: hormonal
    if (a.q10 === "ciclo") scoreH += 3;
    if (a.q10 === "depois-35") scoreH += 2;
    if (a.q10 === "menopausa") scoreH += 3;
    if (a.q10 === "sem-variacao") { scoreF++; scoreL++; }

    // Q12: origem direta
    if (a.q12 === "gas") scoreF += 3;
    if (a.q12 === "liquido") scoreH += 3;
    if (a.q12 === "linfatico") scoreL += 3;
    if (a.q12 === "tres") { scoreF += 2; scoreH += 2; scoreL += 2; }

    // Q13: fermentacao
    if (a.q13 === "constantemente") scoreF += 2;
    if (a.q13 === "alguns-alimentos") scoreF += 1;
    if (a.q13 === "nao") scoreL += 1;

    // Q1: idade amplifica hormonal
    if (a.q1 === "45-54" || a.q1 === "55+") scoreH += 1;

    // Determine winner
    let dominantType = "fermentativa";
    let maxScore = scoreF;
    if (scoreH > maxScore) { dominantType = "hormonal"; maxScore = scoreH; }
    if (scoreL > maxScore) { dominantType = "linfatica"; }

    // ---- Origin data ----
    const origins = {
      fermentativa: {
        icon: "\uD83E\uDDEB",
        title: "Origem Fermentativa",
        subtitle: 'Tipo 1 \u2014 "Est\u00f4mago Fermentado"',
        color: "#FFF5F5",
        border: "rgba(217, 79, 79, 0.2)",
        accent: "#D94F4F",
        description: "Bact\u00e9rias no seu intestino est\u00e3o fermentando os alimentos \u2014 mesmo os saud\u00e1veis \u2014 e produzindo g\u00e1s que fica preso na regi\u00e3o abdominal. \u00c9 por isso que voc\u00ea come uma salada e a barriga fica maior do que antes de comer. N\u00e3o \u00e9 sua imagina\u00e7\u00e3o. \u00c9 fermenta\u00e7\u00e3o.",
        why_failed: "Dieta reduziu caloria, mas n\u00e3o parou a fermenta\u00e7\u00e3o. Jejum criou janela de queima, mas voc\u00ea continuou comendo os mesmos alimentos fermentativos. O ciclo nunca quebrou.",
        what_happens: "Cada refei\u00e7\u00e3o alimenta as bact\u00e9rias erradas. Elas produzem g\u00e1s. O g\u00e1s infla a barriga de dentro pra fora. A inflama\u00e7\u00e3o faz o corpo reter ainda mais l\u00edquido. A barriga cresce dia ap\u00f3s dia."
      },
      hormonal: {
        icon: "\uD83D\uDCA7",
        title: "Origem Hormonal",
        subtitle: 'Tipo 2 \u2014 "Reten\u00e7\u00e3o Hormonal"',
        color: "#F0F4FF",
        border: "rgba(79, 114, 217, 0.2)",
        accent: "#4F72D9",
        description: "Depois dos 30, seus horm\u00f4nios est\u00e3o mandando o corpo reter l\u00edquido especificamente na regi\u00e3o abdominal como mecanismo de defesa. \u00c9 por isso que a barriga varia ao longo do m\u00eas, piora em certas fases do ciclo, e em alguns dias voc\u00ea acorda mais chapada e em outros parece que voltou tudo.",
        why_failed: "Exerc\u00edcio fortaleceu o m\u00fasculo \u2014 que ficou debaixo da esponja. Ch\u00e1 detox aliviou o sintoma por um dia. Nenhum deles tratou o sinal hormonal que manda estocar l\u00edquido na barriga.",
        what_happens: "O corpo recebe o sinal hormonal pra reter. O l\u00edquido se acumula na regi\u00e3o abdominal. A barriga incha, endurece, varia. D\u00e9ficit cal\u00f3rico n\u00e3o drena l\u00edquido hormonal."
      },
      linfatica: {
        icon: "\uD83D\uDD04",
        title: "Origem Linf\u00e1tica",
        subtitle: 'Tipo 3 \u2014 "Drenagem Travada"',
        color: "#F0FFF4",
        border: "rgba(79, 217, 114, 0.2)",
        accent: "#3B9B5E",
        description: "O sistema linf\u00e1tico \u00e9 o sistema de drenagem do corpo \u2014 respons\u00e1vel por eliminar toxinas, l\u00edquido em excesso e res\u00edduos inflamat\u00f3rios. Quando ele fica lento, tudo que deveria sair fica acumulado. A barriga fica pesada, dura, e parece que o corpo n\u00e3o elimina nada.",
        why_failed: "Academia aumentou gasto cal\u00f3rico, mas exerc\u00edcio convencional n\u00e3o ativa o sistema linf\u00e1tico \u2014 dependendo da intensidade, pode inflamar ainda mais. Dieta cortou caloria, mas n\u00e3o drenou os res\u00edduos acumulados.",
        what_happens: "O sistema linf\u00e1tico est\u00e1 lento. Toxinas, l\u00edquido e res\u00edduos inflamat\u00f3rios ficam presos. A barriga fica pesada e inchada o tempo todo. Nenhum d\u00e9ficit cal\u00f3rico resolve isso."
      }
    };

    const o = origins[dominantType];

    // ---- Render diagnosis text ----
    const ageMap = { "25-34": "25 a 34", "35-44": "35 a 44", "45-54": "45 a 54", "55+": "mais de 55" };
    const weightMap = { "ate-65": "at\u00e9 65 kg", "65-80": "entre 65 e 80 kg", "80-95": "entre 80 e 95 kg", "95+": "acima de 95 kg" };
    const timeMap = { "meses": "alguns meses", "1-3-anos": "1 a 3 anos", "3-5-anos": "3 a 5 anos", "5+-anos": "mais de 5 anos" };
    const feelMap = {
      "orgulho": "orgulho do pr\u00f3prio corpo",
      "desejada": "se sentir desejada e atraente de novo",
      "parar-esconder": "parar de se esconder em fotos",
      "controle": "sentir controle do pr\u00f3prio corpo"
    };

    const age = ageMap[a.q1] || "sua faixa et\u00e1ria";
    const weight = weightMap[a.q7] || "seu peso";
    const time = timeMap[a.q11] || "algum tempo";
    const feel = feelMap[a.q16] || "se sentir bem consigo mesma";

    el.innerHTML = `
      <p>Voc\u00ea tem <strong>${age} anos</strong>, pesa aproximadamente <strong>${weight}</strong> e j\u00e1 tenta resolver a barriga h\u00e1 <strong>${time}</strong>.</p>
      <p>Suas respostas indicam um padr\u00e3o claro. Seu tipo dominante de incha\u00e7o \u00e9:</p>
    `;

    // ---- Render origin card ----
    if (originEl) {
      originEl.innerHTML = `
        <div class="origin-result-card" style="background:${o.color};border:2px solid ${o.border};">
          <span class="origin-result-icon">${o.icon}</span>
          <h3 class="origin-result-title" style="color:${o.accent};">${o.title}</h3>
          <p class="origin-result-subtitle">${o.subtitle}</p>
          <p class="origin-result-desc">${o.description}</p>
        </div>

        <div class="section-block">
          <h3 class="offer-h3">Por que nada funcionou at\u00e9 agora</h3>
          <p class="offer-text">${o.why_failed}</p>
        </div>

        <div class="section-block">
          <h3 class="offer-h3">O que est\u00e1 acontecendo no seu corpo agora</h3>
          <p class="offer-text">${o.what_happens}</p>
        </div>

        <div class="origin-result-feel">
          <p>O que voc\u00ea mais quer sentir \u00e9 <strong>${feel}</strong>.</p>
          <p>E agora voc\u00ea sabe exatamente o que precisa ser tratado.</p>
        </div>
      `;
    }
  }

  // ========== TIMER ==========
  let timerInterval = null;
  function initTimer() {
    if (timerInterval) return;

    // Check for persisted timer
    if (!state.timerEnd) {
      state.timerEnd = Date.now() + TIMER_DURATION_S * 1000;
      saveState();
    }

    const minEl = document.getElementById("timerMin");
    const secEl = document.getElementById("timerSec");
    if (!minEl || !secEl) return;

    function tick() {
      const remaining = Math.max(0, state.timerEnd - Date.now());
      const totalSec = Math.ceil(remaining / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      minEl.textContent = String(m).padStart(2, "0");
      secEl.textContent = String(s).padStart(2, "0");
      if (remaining <= 0 && timerInterval) {
        clearInterval(timerInterval);
      }
    }

    tick();
    timerInterval = setInterval(tick, 1000);
  }

  // ========== PRICING CARDS ==========
  function initPricingCards() {
    const cards = document.querySelectorAll(".pricing-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        cards.forEach(c => c.classList.remove("is-active"));
        card.classList.add("is-active");
      });
    });
  }

  // ========== CTA BUTTONS ==========
  function initCtaButtons() {
    document.querySelectorAll("[data-checkout]").forEach(btn => {
      btn.addEventListener("click", () => {
        const value = parseFloat(btn.dataset.checkout) || 67;
        if (typeof fbq === "function") {
          fbq("track", "InitiateCheckout", {
            content_name: "Desafio do Vestido 14D",
            content_category: "Checkout",
            value: value,
            currency: "BRL"
          });
        }
      });
    });

    // Scroll-to buttons
    document.querySelectorAll("[data-scroll-to]").forEach(btn => {
      if (btn.dataset.scrollBound) return;
      btn.dataset.scrollBound = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const target = document.getElementById(btn.dataset.scrollTo);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  // ========== KEYBOARD SHORTCUTS ==========
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goToScreen(currentIndex + 1);
    if (e.key === "ArrowLeft") goToScreen(currentIndex - 1);
  });

  // ========== SCROLL REVEAL ==========
  let scrollRevealInited = false;
  function initScrollReveal() {
    if (scrollRevealInited) return;
    scrollRevealInited = true;

    const els = document.querySelectorAll(".reveal-on-scroll");

    // Step 1: hide them
    els.forEach(el => el.classList.add("will-animate"));

    // Step 2: reveal when in viewport
    function checkVisibility() {
      els.forEach(el => {
        if (el.classList.contains("is-visible")) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 50) {
          el.classList.add("is-visible");
        }
      });
      const allDone = Array.from(els).every(el => el.classList.contains("is-visible"));
      if (allDone) window.removeEventListener("scroll", checkVisibility);
    }

    setTimeout(checkVisibility, 300);
    window.addEventListener("scroll", checkVisibility, { passive: true });
  }

  // ========== INIT ==========
  const hadState = loadState();
  if (hadState && state.step > 0 && state.step < totalSteps) {
    // Restore position
    screens.forEach(s => s.classList.remove("active"));
    screens[state.step].classList.add("active");
    currentIndex = state.step;

    // Re-trigger hooks for restored screen
    const restoredKey = screens[state.step].dataset.screen;
    if (restoredKey === "scratch") setTimeout(initScratchCard, 500);
    if (restoredKey === "offer") { initOfferPage(); setTimeout(initScrollReveal, 300); }
    if (restoredKey === "loading") runLoadingSequence();
  }
  updateProgress();

})();
