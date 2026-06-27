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
    console.log("Initializing App...");
    
    // Set default language
    if (typeof I18n !== 'undefined') {
      I18n.setLanguage('pt');
    }

    // Initialize UI controls
    Controls.init(onParametersChanged);
    
    const initialParams = Controls.getParams();
    const initialScenario = Controls.getCurrentScenario();
    
    setupEducationalModals();
    setupTabs();

    // Language Toggles
    const btnPt = document.getElementById('btn-pt');
    const btnEn = document.getElementById('btn-en');
    if (btnPt && btnEn) {
      btnPt.addEventListener('click', () => {
        if (typeof I18n !== 'undefined') I18n.setLanguage('pt');
        btnPt.classList.add('active');
        btnEn.classList.remove('active');
        if (currentResults) renderCharts(currentResults);
      });
      btnEn.addEventListener('click', () => {
        if (typeof I18n !== 'undefined') I18n.setLanguage('en');
        btnEn.classList.add('active');
        btnPt.classList.remove('active');
        if (currentResults) renderCharts(currentResults);
      });
    }

    // Actions
    const audioBtn = document.getElementById('audio-btn');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        if (typeof AudioEngine !== 'undefined') {
          const isOn = AudioEngine.toggle();
          audioBtn.classList.toggle('on', isOn);
          audioBtn.textContent = isOn ? (typeof I18n !== 'undefined' ? I18n.getText('btn-audio-on') : '🔊 Som: ON') : (typeof I18n !== 'undefined' ? I18n.getText('btn-audio-off') : '🔈 Som: OFF');
        }
      });
    }

    const pdfBtn = document.getElementById('pdf-btn');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', generatePDF);
    }

    console.log('%c🌀 Calculadora de Entropia Estrutural', 
      'color: #06b6d4; font-size: 16px; font-weight: bold;');
    console.log('%cPacote de Imersão: Audio, PDF, SVG Map, Glitch e GNN', 
      'color: #94a3b8; font-size: 11px;');

    // Run initial simulation
    runSimulation();

    // Setup resize handler
    window.addEventListener('resize', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (currentResults) renderCharts(currentResults);
      }, 150);
    });

  }

  /**
   * Gerador de Laudo Científico PDF (IPCC-style)
   */
  function generatePDF() {
    if (typeof html2pdf === 'undefined') {
      alert("Biblioteca de PDF carregando. Tente novamente em instantes.");
      return;
    }
    
    // Create a temporary container to hold BOTH the charts and the audit table
    const tempContainer = document.createElement('div');
    tempContainer.style.background = '#0f172a';
    tempContainer.style.color = '#fff';
    tempContainer.style.padding = '20px';
    
    const header = document.createElement('h1');
    header.style.textAlign = 'center';
    header.style.color = '#06b6d4';
    header.innerText = 'Laudo Técnico IPCC - Entropia Estrutural (Fase 2)';
    tempContainer.appendChild(header);

    // Clone Charts
    const chartsDiv = document.querySelector('.main-container');
    if (chartsDiv) tempContainer.appendChild(chartsDiv.cloneNode(true));
    
    // Clone Audit Table
    const auditDiv = document.getElementById('tab-audit');
    if (auditDiv) {
      const clonedAudit = auditDiv.cloneNode(true);
      clonedAudit.style.display = 'block'; // Ensure it's visible in PDF
      tempContainer.appendChild(clonedAudit);
    }

    document.body.appendChild(tempContainer);

    const scenarioName = Controls.getCurrentScenario().name;
    const opt = {
      margin:       0.3,
      filename:     `Laudo_Cientifico_IPCC_${scenarioName.replace(/ /g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a3', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(tempContainer).save().then(() => {
      document.body.removeChild(tempContainer); // Cleanup
    }).catch(() => { if (tempContainer.parentNode) document.body.removeChild(tempContainer); });
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
      currentResults = StructuralEntropyModel.simulate(params, scenario, shocks);
      Controls._lastResults = currentResults;

      // Build planetary time series (real data + projections)
      let planetaryData = null;
      if (typeof RealData !== 'undefined') {
        planetaryData = RealData.buildPlanetaryTimeSeries(currentResults);
        currentResults._planetaryData = planetaryData;
      }

      const elapsed = (performance.now() - t0).toFixed(1);
      updateSimInfo(elapsed, currentResults);
      updateAuditReport(currentResults);

      // Re-attach tooltips with new data
      ChartEngine.attachTooltip('chart-lambda', currentResults, 'lambda');
      ChartEngine.attachTooltip('chart-population', currentResults, 'population');
      ChartEngine.attachTooltip('chart-degradation', currentResults, 'degradation');
      ChartEngine.attachTooltip('chart-dashboard', currentResults, 'dashboard');

      // Render with smooth transition
      renderCharts(currentResults, planetaryData);

      // Trigger pulse animations on critical events
      triggerEventAnimations(currentResults);
      
      // Start Live Atomic Clock and Feed
      startLiveMonitor(currentResults);

      // Fetch real news for GNN (async, non-blocking)
      fetchRealNews();

    } catch (err) {
      console.error('Erro na simulação:', err);
      const info = document.getElementById('sim-info');
      if (info) info.textContent = 'Erro: ' + err.message;
    }

    isRunning = false;
  }

  /**
   * Fetch real news from GDELT and update GNN ticker.
   */
  async function fetchRealNews() {
    if (typeof RealData === 'undefined') return;
    try {
      const lang = typeof I18n !== 'undefined' ? I18n.getLanguage() : 'pt';
      const articles = await RealData.fetchNews(lang);
      if (articles && articles.length > 0) {
        const gnn = document.getElementById('gnn-text');
        if (gnn) {
          const headlines = articles.slice(0, 8).map(a => `${a.title} (${a.source || 'GDELT'})`);
          gnn.textContent = headlines.join(' ◆ ');
        }
      }
      // Also fetch real events for the monitor
      const earthquakes = await RealData.fetchEarthquakes();
      const events = await RealData.fetchNaturalEvents();
      updateRealMonitor(earthquakes, events);
    } catch (e) {
      console.warn('Real data fetch:', e.message);
    }
  }

  /**
   * Update catastrophe feed with real earthquake and event data.
   */
  function updateRealMonitor(earthquakes, events) {
    const feed = document.getElementById('catastrophe-feed');
    if (!feed) return;

    let html = '';
    if (earthquakes && earthquakes.length > 0) {
      earthquakes.slice(0, 3).forEach(eq => {
        const icon = eq.magnitude >= 6 ? '🔴' : eq.magnitude >= 5 ? '🟡' : '🟢';
        html += `<div class="feed-item real-event">${icon} <strong>M${eq.magnitude.toFixed(1)}</strong> — ${eq.location}${eq.tsunami ? ' ⚠️ TSUNAMI' : ''}</div>`;
      });
    }
    if (events && events.length > 0) {
      events.slice(0, 3).forEach(ev => {
        const icon = ev.category === 'Wildfires' ? '🔥' : ev.category === 'Volcanoes' ? '🌋' : ev.category === 'Severe Storms' ? '🌀' : '🌍';
        html += `<div class="feed-item real-event">${icon} ${ev.title}</div>`;
      });
    }
    if (html) {
      feed.innerHTML = html + feed.innerHTML;
    }
  }

  /**
   * Render all charts.
   */
  function renderCharts(results, planetaryData) {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      ChartEngine.renderAll(results, planetaryData || null);
    });
    
    if (typeof Seismograph !== 'undefined') {
      Seismograph.init('chart-seismograph');
    }
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
   * Setup Tab Navigation
   */
  function setupTabs() {
    const btns = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const target = document.getElementById(targetId);
        if(target) target.classList.add('active');
      });
    });
  }

  /**
   * Update the textual Audit and Scenario Report (Dense Tab)
   */
  function updateAuditReport(results) {
    // 1. Quick top bar update
    const content = document.getElementById('audit-content');
    if (content) {
      const scenarioId = Controls.getScenarioId();
      const sc = Scenarios.ALL.find(s => s.id === scenarioId);
      const scenarioName = sc ? sc.name : scenarioId;

      const finalLambda = results.lambda[results.length - 1];
      const lambdaCrit  = results.params.lambda_crit;
      const finalN = ((results.Nn[results.length - 1] + results.Ns[results.length - 1])).toFixed(2);
      
      let statusText = '';
      if (finalLambda < lambdaCrit * 0.6) {
        statusText = '<span style="color:var(--emerald);">Alta coerência estrutural e resiliência.</span>';
      } else if (finalLambda < lambdaCrit) {
        statusText = '<span style="color:var(--yellow);">Sistema sob estresse moderado. Requer mitigação.</span>';
      } else {
        statusText = '<span style="color:#b91c1c; font-weight:bold;">COLAPSO SISTÊMICO OU ALERTA CRÍTICO ATIVO.</span>';
      }
      content.innerHTML = `<strong>Cenário:</strong> ${scenarioName} | <strong>População Final (2100):</strong> ${finalN} Bi | <strong>Status:</strong> ${statusText}`;
    }

    // 2. Dense Audit Table in Tab 2
    const wrapper = document.getElementById('audit-table-wrapper');
    if (!wrapper) return;

    const tL = results.length - 1;
    const nN_0 = results.Nn[0].toFixed(2), nN_end = results.Nn[tL].toFixed(2);
    const nS_0 = results.Ns[0].toFixed(2), nS_end = results.Ns[tL].toFixed(2);
    const e_0 = results.E[0].toFixed(2), e_end = results.E[tL].toFixed(2);
    const dt_end = results.deltaT[tL].toFixed(2);
    
    let html = `
      <table class="audit-table">
        <thead>
          <tr>
            <th>Parâmetro / Variável</th>
            <th>Valor Inicial (${results.params.t_start})</th>
            <th>Valor Final (${results.params.t_end})</th>
            <th>Variação / Impacto</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>População Norte (N_n)</strong></td>
            <td>${nN_0} Bi</td>
            <td>${nN_end} Bi</td>
            <td>Asilo migratório / Resiliência Alta</td>
          </tr>
          <tr>
            <td><strong>População Sul (N_s)</strong></td>
            <td>${nS_0} Bi</td>
            <td>${nS_end} Bi</td>
            <td>Impacto primário do Colapso (Fome/Clima)</td>
          </tr>
          <tr>
            <td><strong>Economia Global (E)</strong></td>
            <td>$${e_0} Tri</td>
            <td>$${e_end} Tri</td>
            <td>Motor Capitalista</td>
          </tr>
          <tr>
            <td><strong>Anomalia Térmica (ΔT)</strong></td>
            <td>+${results.deltaT[0].toFixed(2)} °C</td>
            <td>+${dt_end} °C</td>
            <td>Catálise Entrópica</td>
          </tr>
          <tr>
            <td><strong>Entropia Final (λ)</strong></td>
            <td>${results.lambda[0].toFixed(3)}</td>
            <td>${results.lambda[tL].toFixed(3)}</td>
            <td>${results.lambda[tL] >= results.params.lambda_crit ? 'FALÊNCIA' : 'ESTÁVEL'}</td>
          </tr>
        </tbody>
      </table>
      <h3 style="margin-top: 1.5rem; color:var(--sky);">Histórico de Ocorrências (Shocks)</h3>
      <table class="audit-table">
        <thead>
          <tr><th>Ano</th><th>Tipo do Choque</th></tr>
        </thead>
        <tbody>
    `;

    if (results.appliedShocks && results.appliedShocks.length > 0) {
      results.appliedShocks.forEach(sh => {
        let name = sh.type === 'pandemic' ? '🦠 Pandemia Global' : (sh.type === 'war' ? '⚔️ Conflito Global' : '💡 Salto Tecnológico');
        html += `<tr><td>${sh.year}</td><td>${name}</td></tr>`;
      });
    } else {
      html += `<tr><td colspan="2">Nenhum choque manual injetado.</td></tr>`;
    }

    if (results.events.tau1) {
      html += `<tr style="color:#ef4444;"><td>${results.events.tau1.toFixed(0)}</td><td>⚠️ Ruptura Sistêmica 1 (λ > 1.0)</td></tr>`;
    }
    if (results.events.tau2) {
      html += `<tr style="color:#b91c1c; font-weight:bold;"><td>${results.events.tau2.toFixed(0)}</td><td>💀 Colapso Final (λ > λ_crit)</td></tr>`;
    }

    html += `</tbody></table>`;

    // ── Hindcast Calibration ────────────────────────────────────────
    if (typeof RealData !== 'undefined') {
      const cal = RealData.runCalibration(results);
      const scoreColor = cal.score >= 70 ? 'var(--emerald)' : cal.score >= 40 ? 'var(--amber)' : 'var(--red)';
      
      html += `
        <h3 style="margin-top: 1.5rem; color:var(--cyan);">🎯 Calibração Hindcast (Modelo vs Realidade ${results.params.t_start}–${new Date().getFullYear()})</h3>
        <div class="calibration-score" style="text-align:center; margin:12px 0;">
          <span style="font-size:2rem; font-weight:800; color:${scoreColor};">${cal.score}%</span>
          <div style="font-size:0.75rem; color:var(--text-secondary);">Índice de Conformidade</div>
        </div>
        <table class="audit-table">
          <thead>
            <tr><th>Variável</th><th>RMSE</th><th>R²</th><th>Fonte</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>População (Bi)</strong></td>
              <td style="color:${cal.population.rmse < 0.5 ? 'var(--emerald)' : 'var(--red)'}">${cal.population.rmse.toFixed(3)}</td>
              <td>${cal.population.r2.toFixed(3)}</td>
              <td>World Bank / UN</td>
            </tr>
            <tr>
              <td><strong>Anomalia Térmica (°C)</strong></td>
              <td style="color:${cal.temperature.rmse < 0.3 ? 'var(--emerald)' : 'var(--red)'}">${cal.temperature.rmse.toFixed(3)}</td>
              <td>${cal.temperature.r2.toFixed(3)}</td>
              <td>NASA GISS</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
          RMSE = Root Mean Square Error (menor = melhor) · R² = Coeficiente de Determinação (1.0 = perfeito)
        </div>
      `;

      // ── Reference Model Comparison ────────────────────────────────
      html += `
        <h3 style="margin-top: 1.5rem; color:var(--purple);">📊 Comparação com Modelos Estabelecidos</h3>
        <table class="audit-table">
          <thead>
            <tr><th>Modelo</th><th>Pop. 2100</th><th>ΔT 2100</th><th>Nosso Modelo</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>DICE</strong> (Nordhaus, Nobel 2018)</td>
              <td>10.9 Bi</td>
              <td>+3.1°C</td>
              <td rowspan="3" style="text-align:center; font-size:1.1rem; font-weight:700;">
                ${(results.Nn[tL] + results.Ns[tL]).toFixed(2)} Bi<br>
                <span style="font-size:0.8rem; color:var(--text-secondary);">+${results.deltaT[tL].toFixed(2)}°C</span>
              </td>
            </tr>
            <tr>
              <td><strong>World3</strong> (Meadows, 1972)</td>
              <td>4.5 Bi (colapso)</td>
              <td>—</td>
            </tr>
            <tr>
              <td><strong>HANDY</strong> (NASA/Motesharrei, 2014)</td>
              <td>Colapso ~2050</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    wrapper.innerHTML = html;
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

    // 4. Update Seismograph
    if (typeof Seismograph !== 'undefined') {
      Seismograph.updateParams(lambda, lambda_crit, deltaT);
    }

    // 5. Update GNN News Ticker (every 15 seconds to match CSS animation)
    if (typeof I18n !== 'undefined') {
      const now = Date.now();
      if (!window.lastGnnUpdate || now - window.lastGnnUpdate > 15000) {
        window.lastGnnUpdate = now;
        let level = 'low';
        if (lambda >= lambda_crit) level = 'high';
        else if (lambda >= lambda_crit * 0.8) level = 'medium';
        
        const newsEl = document.getElementById('gnn-text');
        if (newsEl) {
          newsEl.textContent = `::: ${I18n.getRandomNews(level)} :::`;
        }
      }
    }
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
    const currentYear = Math.max(results.params.t_start, Math.min(results.params.t_end, new Date().getFullYear()));
    const dt = results.params.dt;
    const stepsPerYear = Math.round(1 / dt);
    
    let idx = (currentYear - results.params.t_start) * stepsPerYear;
    if (idx < 0) idx = 0;
    if (idx >= results.lambda.length) idx = results.lambda.length - 1;

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
       const yr = results.params.t_start + Math.floor(i * dt);
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

  window.addEventListener('beforeunload', () => { if (clockInterval) clearInterval(clockInterval); });

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
