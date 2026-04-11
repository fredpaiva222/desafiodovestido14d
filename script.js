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
    const durations = [800, 700, 600, 500, 400]; // total ~3s
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
  }

  // ========== DYNAMIC DIAGNOSIS ==========
  function generateDiagnosis() {
    const el = document.getElementById("diagnosisText");
    if (!el) return;

    const a = state.answers;

    // Maps for each question
    const ageMap = { "25-34": "25 a 34", "35-44": "35 a 44", "45-54": "45 a 54", "55+": "mais de 55" };
    const weightMap = { "ate-65": "at\u00e9 65 kg", "65-80": "entre 65 e 80 kg", "80-95": "entre 80 e 95 kg", "95+": "acima de 95 kg" };
    const heightMap = { "ate-158": "at\u00e9 1,58m", "159-165": "entre 1,59 e 1,65m", "166-172": "entre 1,66 e 1,72m", "172+": "acima de 1,72m" };
    const timeMap = { "meses": "alguns meses", "1-3-anos": "1 a 3 anos", "3-5-anos": "3 a 5 anos", "5+-anos": "mais de 5 anos" };
    const situationMap = {
      "faco-tudo-certo": "faz tudo certo e a barriga n\u00e3o sai",
      "quase-desisti": "j\u00e1 tentou tanto que quase desistiu",
      "sem-acreditar": "ainda est\u00e1 tentando, mas sem acreditar muito",
      "resolver-de-vez": "decidiu que precisa resolver isso de vez"
    };
    const variationMap = {
      "sim-sempre": "sua barriga varia ao longo do dia \u2014 menor de manh\u00e3, maior \u00e0 tarde",
      "sim-piora": "sua barriga piora muito depois de comer qualquer coisa",
      "as-vezes": "sua barriga varia \u00e0s vezes, sem um padr\u00e3o claro",
      "grande-sempre": "sua barriga fica grande o tempo todo"
    };
    const triedMap = {
      "dieta": "dieta e corte de carboidrato",
      "academia": "academia, abdominais e exerc\u00edcios",
      "jejum": "jejum intermitente e detox",
      "tudo": "dieta, jejum, exerc\u00edcio \u2014 tudo, sem resultado duradouro"
    };
    const lostWeightMap = {
      "sim-exato": "j\u00e1 perdeu peso em outras partes do corpo, mas a barriga ficou",
      "rosto-pernas": "o rosto afinou, as pernas melhoraram, mas a barriga ficou",
      "nenhum-lugar": "n\u00e3o consegue perder em lugar nenhum",
      "perde-recupera": "perde e recupera tudo sempre no mesmo lugar"
    };
    const impactMap = {
      "roupas": "evita roupas que marquem o corpo",
      "fotos": "se sente mal em fotos e evita eventos",
      "autoestima": "afeta sua autoestima e seu relacionamento",
      "tudo": "tudo isso ao mesmo tempo"
    };
    const symptomMap = {
      "inchaco": "incha\u00e7o e estufamento mesmo comendo pouco",
      "dura": "barriga dura, dif\u00edcil de afinar",
      "peso": "sensa\u00e7\u00e3o de peso e press\u00e3o constante",
      "tudo": "todos esses sintomas dependendo do dia"
    };
    const hormonalMap = {
      "ciclo": "piora especialmente antes do ciclo menstrual",
      "depois-35": "piorou bastante depois dos 35 ou 40 anos",
      "menopausa": "est\u00e1 na menopausa e ficou bem pior",
      "sem-variacao": "fica grande o tempo todo, sem varia\u00e7\u00e3o clara"
    };
    const originMap = {
      "gas": "origem fermentativa \u2014 g\u00e1s preso",
      "liquido": "origem hormonal \u2014 reten\u00e7\u00e3o de l\u00edquido",
      "linfatico": "origem linf\u00e1tica \u2014 corpo n\u00e3o elimina",
      "tres": "as tr\u00eas origens ativas ao mesmo tempo"
    };
    const feelMap = {
      "orgulho": "orgulho do pr\u00f3prio corpo",
      "desejada": "se sentir desejada e atraente de novo",
      "parar-esconder": "parar de se esconder em fotos e evitar espelhos",
      "controle": "sentir que tem controle do pr\u00f3prio corpo"
    };
    const goalMap = {
      "ate-5cm": "at\u00e9 5 cm",
      "5-10cm": "entre 5 e 10 cm",
      "10cm+": "mais de 10 cm",
      "nao-sei": "resultado onde nunca viu"
    };

    const age = ageMap[a.q1] || "sua faixa et\u00e1ria";
    const weight = weightMap[a.q7] || "seu peso";
    const height = heightMap[a.q8] || "sua altura";
    const time = timeMap[a.q11] || "algum tempo";
    const situation = situationMap[a.q2] || "tentando resolver";
    const variation = variationMap[a.q3] || "barriga que varia";
    const tried = triedMap[a.q4] || "diversos m\u00e9todos";
    const lostWeight = lostWeightMap[a.q5] || "tentou perder peso";
    const impact = impactMap[a.q6] || "afeta sua vida";
    const symptom = symptomMap[a.q9] || "sintomas abdominais";
    const hormonal = hormonalMap[a.q10] || "varia\u00e7\u00e3o hormonal";
    const origin = originMap[a.q12] || "origens ativas";
    const feel = feelMap[a.q16] || "se sentir bem";
    const goal = goalMap[a.q14] || "perder barriga";

    el.innerHTML = `
      <p>Voc\u00ea tem <strong>${age} anos</strong>, pesa aproximadamente <strong>${weight}</strong>, mede <strong>${height}</strong> e j\u00e1 tenta resolver a barriga h\u00e1 <strong>${time}</strong>.</p>
      <p>Voc\u00ea relatou que <strong>${situation}</strong>. Que ${variation}. Que ${lostWeight}.</p>
      <p>Voc\u00ea j\u00e1 tentou <strong>${tried}</strong>. Sente <strong>${symptom}</strong>. A barriga <strong>${hormonal}</strong>.</p>
      <p>Seu padr\u00e3o dominante indica <strong>${origin}</strong>.</p>
      <p>Isso ${impact}. Sua meta: <strong>perder ${goal}</strong>. O que voc\u00ea mais quer sentir \u00e9 <strong>${feel}</strong>.</p>
    `;
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
