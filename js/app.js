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

    console.log('%c🌀 Calculadora de Entropia Estrutural', 
      'color: #06b6d4; font-size: 16px; font-weight: bold;');
    console.log('%cModelo ODE com RK4 • 5 cenários • 1970–2100', 
      'color: #94a3b8; font-size: 11px;');
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
    const finalK = (results.K_eff[results.length - 1] / 1e9).toFixed(2);
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
