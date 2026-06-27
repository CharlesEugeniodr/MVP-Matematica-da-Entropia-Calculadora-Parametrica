/**
 * app.js — Main Orchestrator
 * 
 * Initializes the application, wires controls to the simulation engine,
 * manages chart rendering, resize handling, and animation lifecycle.
 */

'use strict';

const App = (() => {

  let currentResults = null;
  let isRunning = false;
  let resizeTimeout = null;
  let animationFrame = null;
  let clockInterval = null;

  /**
   * Initialize the application.
   */
  function init() {
    // Initialize controls with change callback
    Controls.init(onParametersChanged);

    // Run initial simulation
    runSimulation();

    // Setup resize handler
    window.addEventListener('resize', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (currentResults) renderCharts(currentResults);
      }, 150);
    });

    // Setup tooltips
    ChartEngine.attachTooltip('chart-lambda', null, 'lambda');
    ChartEngine.attachTooltip('chart-population', null, 'population');
    ChartEngine.attachTooltip('chart-degradation', null, 'degradation');
    ChartEngine.attachTooltip('chart-dashboard', null, 'dashboard');

    setupEducationalModals();

    // Actions
    const audioBtn = document.getElementById('audio-btn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        if (typeof AudioEngine !== 'undefined') {
          const isOn = AudioEngine.toggle();
          audioBtn.classList.toggle('on', isOn);
          audioBtn.textContent = isOn ? '🔊 Som: ON' : '🔈 Som: OFF';
        }
      });
    }

    const pdfBtn = document.getElementById('pdf-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', generatePDF);
    }

    console.log('%c🌀 Calculadora de Entropia Estrutural', 
      'color: #06b6d4; font-size: 16px; font-weight: bold;');
    console.log('%cPacote de Imersão: Audio, PDF, SVG Map e Glitch', 
      'color: #94a3b8; font-size: 11px;');
  }

  /**
   * Gerador de Laudo Científico PDF (IPCC-style)
   */
  function generatePDF() {
    if (typeof html2pdf === 'undefined') {
      alert("Biblioteca de PDF carregando. Tente novamente em instantes.");
      return;
    }
    const element = document.querySelector('.main-container');
    const scenarioName = Controls.getCurrentScenario().name;
    const opt = {
      margin:       0.3,
      filename:     `Laudo_Cientifico_IPCC_${scenarioName.replace(/ /g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().set(opt).from(element).save();
  }

  /**
   * Called when parameters or scenario change.
   */
  function onParametersChanged(params, scenario) {
    runSimulation(params, scenario);
  }

  /**
   * Run the simulation and update charts.
   */
  function runSimulation(params, scenario) {
    if (isRunning) return;
    isRunning = true;

    params   = params   || Controls.getParams();
    scenario = scenario || Controls.getCurrentScenario();
    const regulators = Controls.getRegulators();
    const shocks     = Controls.getShocks();

    // CALIBRAÇÃO CIENTÍFICA: aplicar overrides do cenário aos parâmetros
    if (scenario.overrides) {
      params = Object.assign({}, params, scenario.overrides);
    }

    const t0 = performance.now();

    // Run simulation
    try {
      currentResults = StructuralEntropyModel.simulate(params, scenario, regulators, shocks);
      Controls._lastResults = currentResults;

      const elapsed = (performance.now() - t0).toFixed(1);
      updateSimInfo(elapsed, currentResults);
      updateAuditReport(currentResults);

      // Re-attach tooltips with new data
      ChartEngine.attachTooltip('chart-lambda', currentResults, 'lambda');
      ChartEngine.attachTooltip('chart-population', currentResults, 'population');
      ChartEngine.attachTooltip('chart-degradation', currentResults, 'degradation');
      ChartEngine.attachTooltip('chart-dashboard', currentResults, 'dashboard');

      // Render with smooth transition
      renderCharts(currentResults);

      // Trigger pulse animations on critical events
      triggerEventAnimations(currentResults);
      
      // Start Live Atomic Clock and Feed
      startLiveMonitor(currentResults);

    } catch (err) {
      console.error('Erro na simulação:', err);
      const info = document.getElementById('sim-info');
      if (info) info.innerHTML = `<span style="color: var(--red)">Erro: ${err.message}</span>`;
    }

    isRunning = false;
  }

  /**
   * Render all charts.
   */
  function renderCharts(results) {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      ChartEngine.renderAll(results);
    });
  }

  /**
   * Update simulation info display.
   */
  function updateSimInfo(elapsed, results) {
    const info = document.getElementById('sim-info');
    if (!info) return;

    const scenarioId = Controls.getScenarioId();
    const sc = Scenarios.ALL.find(s => s.id === scenarioId);
    const scenarioName = sc ? sc.name : scenarioId;

    const finalLambda = results.lambda[results.length - 1];
    const lambdaCrit  = results.params.lambda_crit;

    let statusIcon, statusText;
    if (finalLambda < lambdaCrit * 0.6) {
      statusIcon = '🟢'; statusText = 'Estável';
    } else if (finalLambda < lambdaCrit) {
      statusIcon = '🟡'; statusText = 'Alerta';
    } else if (finalLambda < lambdaCrit * 1.3) {
      statusIcon = '🔴'; statusText = 'Crítico';
    } else {
      statusIcon = '💀'; statusText = 'Colapso';
    }

    info.innerHTML = `${statusIcon} ${scenarioName} · λ₂₁₀₀ = ${finalLambda.toFixed(3)} · `
      + `<span class="timing">${elapsed}ms</span> · `
      + `${results.length} pontos`;
  }

  /**
   * Update the textual Audit and Scenario Report.
   */
  function updateAuditReport(results) {
    const content = document.getElementById('audit-content');
    if (!content) return;

    const scenarioId = Controls.getScenarioId();
    const sc = Scenarios.ALL.find(s => s.id === scenarioId);
    const scenarioName = sc ? sc.name : scenarioId;

    const finalLambda = results.lambda[results.length - 1];
    const lambdaCrit  = results.params.lambda_crit;
    const finalN = (results.N[results.length - 1] / 1e9).toFixed(2);
    const finalK = (results.Keff[results.length - 1] / 1e9).toFixed(2);
    const finalD = results.D[results.length - 1].toFixed(2);
    
    let statusText = '';
    if (finalLambda < lambdaCrit * 0.6) {
      statusText = '<span style="color:var(--emerald);">O sistema apresenta alta coerência estrutural e resiliência. A órbita demográfica encontra-se segura dentro do Atrator Estável.</span>';
    } else if (finalLambda < lambdaCrit) {
      statusText = '<span style="color:var(--yellow);">O sistema está sob estresse moderado. A entropia aproxima-se de níveis de alerta, exigindo intervenções em governança ou mitigação para evitar o Tipping Point.</span>';
    } else if (finalLambda < lambdaCrit * 1.3) {
      statusText = '<span style="color:var(--red);">ALERTA CRÍTICO: O sistema rompeu o limiar de resiliência (λ > λ_crit). A capacidade de suporte global está em degradação acelerada devido à entropia excessiva.</span>';
    } else {
      statusText = '<span style="color:#b91c1c; font-weight:bold;">COLAPSO SISTÊMICO: A Entropia Estrutural causou a falência irreversível da capacidade de suporte, forçando uma correção demográfica drástica.</span>';
    }

    content.innerHTML = `
      <strong>Cenário Projetado:</strong> ${scenarioName} <br>
      <strong>Projeção Demográfica (2100):</strong> ${finalN} Bilhões de habitantes (Capacidade de Suporte: ${finalK} Bilhões)<br>
      <strong>Entropia Estrutural Final (λ):</strong> ${finalLambda.toFixed(3)} (Limiar de Colapso Sistêmico: ${lambdaCrit}) <br>
      <strong>Auditoria do Modelo:</strong> ${statusText}
    `;
  }

  /**
   * Trigger card pulse animations for critical events.
   */
  function triggerEventAnimations(results) {
    // Remove existing animations
    document.querySelectorAll('.chart-card').forEach(card => {
      card.classList.remove('pulse-danger', 'pulse-success');
    });

    const lambdaCard = document.getElementById('card-lambda');
    const popCard    = document.getElementById('card-population');

    // Check final state
    const finalLambda = results.lambda[results.length - 1];
    const lambdaCrit  = results.params.lambda_crit;

    if (results.events.tau2 && lambdaCard) {
      lambdaCard.classList.add('pulse-danger');
    } else if (finalLambda < lambdaCrit * 0.6 && lambdaCard) {
      lambdaCard.classList.add('pulse-success');
    }

    if (results.events.tau1 && popCard) {
      popCard.classList.add('pulse-danger');
    }
  }

  /**
   * Setup tooltips for educational equations
   */
  function setupEducationalModals() {
    const modal = document.getElementById('edu-modal');
    const closeBtn = document.getElementById('edu-modal-close');
    const titleEl = document.getElementById('edu-modal-title');
    const bodyEl = document.getElementById('edu-modal-body');
    const triggers = document.querySelectorAll('.tooltip-trigger');

    if (!modal || !triggers.length) return;

    const eduData = {
      eq1: {
        title: 'Eq.1: Dinâmica Populacional',
        body: 'Esta equação descreve como a população mundial (N) cresce. O crescimento depende da <strong>taxa natural</strong>, mas é limitado pela <strong>Capacidade Efetiva (K_eff)</strong>. Se a entropia (λ) ultrapassar um limite crítico (λ_crit), a população sofre um decréscimo drástico devido ao colapso.'
      },
      eq2: {
        title: 'Eq.2: Capacidade Efetiva (K_eff)',
        body: 'Representa o "limite" de suporte do planeta. Este limite não é fixo: ele <strong>diminui</strong> com a degradação ambiental (D) e mudanças climáticas (ΔT), mas pode ser <strong>expandido</strong> parcialmente por inovação tecnológica e boa governança (TG).'
      },
      eq3: {
        title: 'Eq.3: Degradação Ambiental',
        body: 'Mede o acúmulo de danos ao planeta. A degradação aumenta com emissões (C), uso da terra (U) e poluição (P). Somente ações de governança verde e tecnologia podem <strong>mitigar</strong> e desacelerar esse processo.'
      },
      eq4: {
        title: 'Eq.4: Resiliência Sistêmica',
        body: 'É a "imunidade" do planeta e da sociedade a choques. Uma governança forte (G) ajuda a construir resiliência, enquanto a alta degradação (D) e o caos estrutural (λ) destroem a capacidade de recuperação da civilização.'
      },
      eq5: {
        title: 'Eq.5: Entropia Estrutural (λ)',
        body: 'A medida definitiva do <strong>risco de colapso</strong>. É a soma de todos os estresses: saturação populacional, destruição da natureza, aquecimento global, uso do solo e desigualdade (I). É o termômetro da desestabilização (quando alto, a coerência sistêmica quebra).'
      }
    };

    triggers.forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.tooltip;
        if (eduData[key]) {
          titleEl.innerHTML = eduData[key].title;
          bodyEl.innerHTML = eduData[key].body;
          modal.classList.add('active');
        }
      });
    });

    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  }

  /**
   * Global Visual & Audio FX 
   */
  function updateVisualFX(lambda, lambda_crit, deltaT) {
    // 1. Audio
    if (typeof AudioEngine !== 'undefined') {
      AudioEngine.updateTension(lambda, lambda_crit);
    }

    // 2. Glitch Effect
    if (lambda >= lambda_crit) {
      document.body.classList.add('glitch-critical');
    } else {
      document.body.classList.remove('glitch-critical');
    }

    // 3. SVG Heatmap Coloring
    const equator = document.querySelectorAll('.world-map-svg .equator');
    const north = document.querySelectorAll('.world-map-svg .north');
    
    // deltaT varies roughly 1.0 to 5.0
    const heatRatio = Math.max(0, Math.min((deltaT - 1) / 4, 1));
    const hueEq = 220 - (heatRatio * 220); // Blue (220) to Red (0)
    const hueNo = 220 - (heatRatio * 150); // Blue to Green/Yellow (70)
    
    equator.forEach(el => el.style.fill = `hsl(${hueEq}, 70%, 35%)`);
    north.forEach(el => el.style.fill = `hsl(${hueNo}, 40%, 25%)`);
  }

  /**
   * Start the Live Atomic Clock and Catastrophe Monitor Feed
   */
  function startLiveMonitor(results) {
    if (clockInterval) clearInterval(clockInterval);

    const clockDisplay = document.getElementById('atomic-clock-display');
    const clockStatus = document.getElementById('atomic-clock-status');
    const feed = document.getElementById('catastrophe-feed');
    if (!clockDisplay || !feed || !clockStatus) return;

    // Use current real-world year
    const currentYear = Math.max(1970, Math.min(2099, new Date().getFullYear()));
    const dt = results.params.dt;
    const stepsPerYear = Math.round(1 / dt);
    const idx = (currentYear - 1970) * stepsPerYear;

    const lambda1 = results.lambda[idx];
    const lambda2 = results.lambda[idx + stepsPerYear] || results.lambda[results.lambda.length-1];
    
    // Check Status
    const crit = results.params.lambda_crit;
    if (lambda1 >= crit) {
      clockDisplay.classList.add('critical');
      clockStatus.classList.add('critical');
      clockStatus.textContent = 'Colapso em Andamento';
    } else if (lambda1 >= crit * 0.8) {
      clockDisplay.classList.remove('critical');
      clockStatus.classList.remove('critical');
      clockStatus.style.color = 'var(--yellow)';
      clockStatus.textContent = 'Alerta Crítico';
    } else {
      clockDisplay.classList.remove('critical');
      clockStatus.classList.remove('critical');
      clockStatus.style.color = 'var(--emerald)';
      clockStatus.textContent = 'Órbita Estável';
    }

    // Populate feed
    feed.innerHTML = '<div class="feed-item sys-msg">Sistema de monitoramento conectado.</div>';
    
    // Scan the array up to 2100 to populate past and future predicted events based on current scenario
    for (let i = 1; i < results.lambda.length; i++) {
       const yr = 1970 + Math.floor(i * dt);
       if (results.lambda[i] >= crit && results.lambda[i-1] < crit) {
         const t = yr <= currentYear ? 'passado' : 'projetado';
         feed.innerHTML += `<div class="feed-item danger">[${yr}] ⚠️ RUPTURA SISTÊMICA (${t}): A entropia superou o limite da biosfera.</div>`;
       }
    }
    
    // Include manual shocks injected by user
    const shocks = Controls.getShocks();
    shocks.forEach(sh => {
       let name = sh.type === 'pandemic' ? '🦠 Pandemia Global' : (sh.type === 'war' ? '⚔️ Conflito Global' : '💡 Salto Tecnológico');
       let cls = sh.type === 'tech' ? 'shock' : 'danger';
       feed.innerHTML += `<div class="feed-item ${cls}">[${sh.year}] Choque Injetado: ${name}</div>`;
    });
    
    feed.innerHTML += `<div class="feed-item sys-msg">[Real-Time] Escaneando oscilações estruturais...</div>`;
    feed.scrollTop = feed.scrollHeight;

    // Clock Animation
    const startOfThisYear = new Date(currentYear, 0, 1).getTime();
    const msInYear = 31556952000; // 365.2425 days
    
    clockInterval = setInterval(() => {
      const nowMs = Date.now();
      const fraction = (nowMs - startOfThisYear) / msInYear;
      
      const currentLambda = lambda1 + ((lambda2 - lambda1) * fraction);
      const deltaT1 = results.deltaT[idx];
      const deltaT2 = results.deltaT[idx+stepsPerYear] || results.deltaT[results.deltaT.length-1];
      const currentDeltaT = deltaT1 + ((deltaT2 - deltaT1) * fraction);
      
      // Impostômetro trick: fast-spinning noisy fraction to simulate quantum/chaotic micro-fluctuations
      const noise = (Math.random() * 0.000000009); 
      
      const displayVal = (currentLambda + noise).toFixed(9);
      clockDisplay.textContent = displayVal;

      updateVisualFX(currentLambda, crit, currentDeltaT);
      
    }, 50);
  }

  // ── Boot ──────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    runSimulation,
    getResults: () => currentResults
  };

})();
