/**
 * controls.js — Parameter Controls Manager
 * 
 * Manages the sidebar parameter panel, scenario buttons,
 * custom scenario sliders, and CSV export.
 */

'use strict';

const Controls = (() => {

  // Parameter definitions with metadata for UI generation
  const PARAM_DEFS = [
    { group: 'Dinâmica Populacional', params: [
      { key: 'r_N',   label: 'r_N (taxa de crescimento)',   min: 0, max: 0.05,  step: 0.001, unit: '' },
      { key: 'mu_N',  label: 'μ_N (sensibilidade à pressão)', min: 0, max: 0.05, step: 0.001, unit: '' },
      { key: 'K0',    label: 'K₀ (capacidade inicial)',     min: 5e9, max: 20e9, step: 1e9, unit: 'B', format: v => (v/1e9).toFixed(0) + 'B' },
      { key: 'N0',    label: 'N₀ (população 1970)',         min: 2e9, max: 6e9,  step: 0.1e9, unit: 'B', format: v => (v/1e9).toFixed(1) + 'B' },
    ]},
    { group: 'Capacidade de Suporte', params: [
      { key: 'eta5',  label: 'η₅ (impacto degradação)',     min: 0, max: 5,    step: 0.1 },
      { key: 'eta6',  label: 'η₆ (impacto aquecimento)',    min: 0, max: 0.3,  step: 0.01 },
      { key: 'omega', label: 'ω (impacto uso do solo)',     min: 0, max: 1,    step: 0.05 },
      { key: 'phi',   label: 'φ (boost tech×gov)',          min: 0, max: 5,    step: 0.1 },
    ]},
    { group: 'Degradação Ambiental', params: [
      { key: 'alpha1', label: 'α₁ (emissões → D)',          min: 0, max: 0.01, step: 0.001 },
      { key: 'alpha2', label: 'α₂ (uso solo → D)',          min: 0, max: 0.01, step: 0.001 },
      { key: 'alpha3', label: 'α₃ (poluição → D)',          min: 0, max: 0.01, step: 0.001 },
      { key: 'beta_D', label: 'β_D (mitigação)',            min: 0, max: 0.2,  step: 0.01 },
      { key: 'D0',     label: 'D₀ (degradação 1970)',       min: 0, max: 0.5,  step: 0.01 },
    ]},
    { group: 'Resiliência', params: [
      { key: 'rho_G',      label: 'ρ_G (gov constrói R)',      min: 0, max: 0.1,  step: 0.005 },
      { key: 'rho_D',      label: 'ρ_D (D erode R)',           min: 0, max: 0.1,  step: 0.005 },
      { key: 'rho_lambda',  label: 'ρ_λ (λ erode R)',          min: 0, max: 0.1,  step: 0.005 },
      { key: 'R0',          label: 'R₀ (resiliência 1970)',     min: 0, max: 1,    step: 0.05 },
    ]},
    { group: 'Pesos de λ', params: [
      { key: 'w1', label: 'w₁ (N/K_eff)',  min: 0, max: 0.5, step: 0.01 },
      { key: 'w2', label: 'w₂ (D)',        min: 0, max: 0.5, step: 0.01 },
      { key: 'w3', label: 'w₃ (ΔT)',       min: 0, max: 0.5, step: 0.01 },
      { key: 'w4', label: 'w₄ (U)',        min: 0, max: 0.5, step: 0.01 },
      { key: 'w5', label: 'w₅ (I)',        min: 0, max: 0.5, step: 0.01 },
      { key: 'w6', label: 'w₆ (T×G)',      min: 0, max: 0.5, step: 0.01 },
      { key: 'w7', label: 'w₇ (R)',        min: 0, max: 0.5, step: 0.01 },
    ]},
    { group: 'Limiares Críticos', params: [
      { key: 'lambda_crit', label: 'λ_crit',              min: 0.3, max: 2,  step: 0.05 },
      { key: 'tau_p',       label: 'τ_p (anos persist.)',  min: 1,   max: 30, step: 1 },
      { key: 'tau_r',       label: 'τ_r (anos recup.)',    min: 1,   max: 30, step: 1 },
      { key: 'R_min',       label: 'R_min',                min: 0,   max: 0.5, step: 0.05 },
      { key: 'G_min',       label: 'G_min',                min: 0,   max: 0.5, step: 0.05 },
    ]}
  ];

  // Custom scenario endpoint sliders
  const CUSTOM_SLIDER_DEFS = [
    { key: 'deltaT', label: 'ΔT 2100 (°C)',         min: 0.5, max: 6,    step: 0.1,  defaultVal: 2.7 },
    { key: 'U',      label: 'Uso do Solo 2100',      min: 0.1, max: 0.8,  step: 0.01, defaultVal: 0.50 },
    { key: 'T',      label: 'Tecnologia 2100',       min: 0.1, max: 0.95, step: 0.01, defaultVal: 0.50 },
    { key: 'G',      label: 'Governança 2100',       min: 0.05, max: 0.95, step: 0.01, defaultVal: 0.40 },
    { key: 'I',      label: 'Desigualdade 2100',     min: 0.05, max: 0.8,  step: 0.01, defaultVal: 0.45 },
    { key: 'C',      label: 'Emissões 2100',         min: 0.01, max: 1.0,  step: 0.01, defaultVal: 0.55 },
    { key: 'P',      label: 'Poluição 2100',         min: 0.01, max: 1.0,  step: 0.01, defaultVal: 0.48 },
  ];

  let currentParams = {};
  let currentScenarioId = 'S2';
  let customEndpoints = {};
  let onChangeCallback = null;
  let currentRegulators = { gov: 0, deg: 0 };
  let currentShocks = [];

  /**
   * Initialize controls.
   * @param {Function} onChange Callback(params, scenario)
   */
  function init(onChange) {
    onChangeCallback = onChange;
    currentParams = Object.assign({}, StructuralEntropyModel.DEFAULT_PARAMS);

    // Initialize custom endpoints
    CUSTOM_SLIDER_DEFS.forEach(def => {
      customEndpoints[def.key] = def.defaultVal;
    });

    buildScenarioButtons();
    buildParameterPanel();
    buildCustomSliders();
    buildExportButton();
    setupSidebarToggle();
    buildRegulatorAndShocks();
  }

  /**
   * Build scenario selector buttons.
   */
  function buildScenarioButtons() {
    const container = document.getElementById('scenario-buttons');
    if (!container) return;

    Scenarios.ALL.forEach(sc => {
      const btn = document.createElement('button');
      btn.className = 'scenario-btn' + (sc.id === currentScenarioId ? ' active' : '');
      btn.dataset.scenario = sc.id;
      btn.innerHTML = `<span class="scenario-icon">${sc.icon}</span><span class="scenario-name">${sc.name}</span>`;
      btn.title = sc.description;

      btn.addEventListener('click', () => {
        selectScenario(sc.id);
      });

      container.appendChild(btn);
    });
  }

  /**
   * Select a scenario.
   */
  function selectScenario(id) {
    currentScenarioId = id;

    // Update button states
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scenario === id);
    });

    // Show/hide custom sliders
    const customPanel = document.getElementById('custom-sliders');
    if (customPanel) {
      customPanel.style.display = (id === 'S5') ? 'block' : 'none';
    }

    // Update scenario description
    const descEl = document.getElementById('scenario-description');
    const sc = Scenarios.ALL.find(s => s.id === id);
    if (descEl && sc) {
      descEl.textContent = sc.description;
      descEl.style.borderLeftColor = sc.color;
    }

    triggerChange();
  }

  /**
   * Build parameter sliders in sidebar.
   */
  function buildParameterPanel() {
    const container = document.getElementById('param-panel');
    if (!container) return;

    PARAM_DEFS.forEach(group => {
      const section = document.createElement('div');
      section.className = 'param-group';

      const header = document.createElement('div');
      header.className = 'param-group-header';
      header.innerHTML = `<span>${group.group}</span><span class="collapse-icon">▾</span>`;
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
        header.querySelector('.collapse-icon').textContent =
          section.classList.contains('collapsed') ? '▸' : '▾';
      });
      section.appendChild(header);

      const body = document.createElement('div');
      body.className = 'param-group-body';

      group.params.forEach(pdef => {
        const row = document.createElement('div');
        row.className = 'param-row';

        const label = document.createElement('label');
        label.className = 'param-label';
        label.textContent = pdef.label;

        const valueDisp = document.createElement('span');
        valueDisp.className = 'param-value';
        valueDisp.id = `val-${pdef.key}`;

        const formatVal = (v) => {
          if (pdef.format) return pdef.format(v);
          if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
          if (Number.isInteger(pdef.step) && pdef.step >= 1) return Math.round(v).toString();
          if (pdef.step >= 0.1) return parseFloat(v).toFixed(1);
          if (pdef.step >= 0.01) return parseFloat(v).toFixed(2);
          return parseFloat(v).toFixed(3);
        };

        valueDisp.textContent = formatVal(currentParams[pdef.key]);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'param-slider';
        slider.id = `slider-${pdef.key}`;
        slider.min = pdef.min;
        slider.max = pdef.max;
        slider.step = pdef.step;
        slider.value = currentParams[pdef.key];

        slider.addEventListener('input', () => {
          const v = parseFloat(slider.value);
          currentParams[pdef.key] = v;
          valueDisp.textContent = formatVal(v);
          triggerChange();
        });

        const labelRow = document.createElement('div');
        labelRow.className = 'param-label-row';
        labelRow.appendChild(label);
        labelRow.appendChild(valueDisp);

        row.appendChild(labelRow);
        row.appendChild(slider);
        body.appendChild(row);
      });

      section.appendChild(body);
      container.appendChild(section);
    });

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'reset-btn';
    resetBtn.textContent = '↻ Restaurar Padrões';
    resetBtn.addEventListener('click', resetParams);
    container.appendChild(resetBtn);
  }

  /**
   * Build custom scenario sliders.
   */
  function buildCustomSliders() {
    const container = document.getElementById('custom-sliders');
    if (!container) return;

    const title = document.createElement('div');
    title.className = 'custom-sliders-title';
    title.textContent = '🎛️ Trajetórias Exógenas (valores em 2100)';
    container.appendChild(title);

    CUSTOM_SLIDER_DEFS.forEach(def => {
      const row = document.createElement('div');
      row.className = 'param-row';

      const label = document.createElement('label');
      label.className = 'param-label';
      label.textContent = def.label;

      const valueDisp = document.createElement('span');
      valueDisp.className = 'param-value';
      valueDisp.id = `cval-${def.key}`;
      valueDisp.textContent = def.defaultVal.toFixed(2);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'param-slider custom-slider';
      slider.id = `cslider-${def.key}`;
      slider.min = def.min;
      slider.max = def.max;
      slider.step = def.step;
      slider.value = def.defaultVal;

      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        customEndpoints[def.key] = v;
        valueDisp.textContent = v.toFixed(2);
        if (currentScenarioId === 'S5') triggerChange();
      });

      const labelRow = document.createElement('div');
      labelRow.className = 'param-label-row';
      labelRow.appendChild(label);
      labelRow.appendChild(valueDisp);

      row.appendChild(labelRow);
      row.appendChild(slider);
      container.appendChild(row);
    });

    // Initially hidden unless S5 is selected
    container.style.display = currentScenarioId === 'S5' ? 'block' : 'none';
  }

  /**
   * Build export CSV button.
   */
  function buildExportButton() {
    const btn = document.getElementById('export-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (!Controls._lastResults) return;
      const csv = StructuralEntropyModel.toCSV(Controls._lastResults);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `entropia_estrutural_${currentScenarioId}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Build regulators and shock buttons
   */
  function buildRegulatorAndShocks() {
    const regGov = document.getElementById('reg-gov');
    const regGovVal = document.getElementById('reg-gov-val');
    const regDeg = document.getElementById('reg-deg');
    const regDegVal = document.getElementById('reg-deg-val');
    const btnReset = document.getElementById('btn-reset-regulator');

    if (regGov) {
      regGov.addEventListener('input', () => {
        currentRegulators.gov = parseFloat(regGov.value);
        regGovVal.textContent = (currentRegulators.gov > 0 ? '+' : '') + currentRegulators.gov + '%';
        triggerChange();
      });
    }
    if (regDeg) {
      regDeg.addEventListener('input', () => {
        currentRegulators.deg = parseFloat(regDeg.value);
        regDegVal.textContent = (currentRegulators.deg > 0 ? '+' : '') + currentRegulators.deg + '%';
        triggerChange();
      });
    }
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        currentRegulators = { gov: 0, deg: 0 };
        if(regGov) { regGov.value = 0; regGovVal.textContent = '0%'; }
        if(regDeg) { regDeg.value = 0; regDegVal.textContent = '0%'; }
        triggerChange();
      });
    }

    const injectShock = (type) => {
      // Injeta o choque num ano próximo do atual (ex: 2026) para visualização clara
      currentShocks.push({ year: 2026 + Math.floor(Math.random() * 5), type: type });
      if (typeof AudioEngine !== 'undefined') AudioEngine.playShockAlert(type);
      triggerChange();
    };

    const btnPan = document.getElementById('btn-shock-pandemic');
    const btnWar = document.getElementById('btn-shock-war');
    const btnTech = document.getElementById('btn-shock-tech');

    if (btnPan) btnPan.addEventListener('click', () => injectShock('pandemic'));
    if (btnWar) btnWar.addEventListener('click', () => injectShock('war'));
    if (btnTech) btnTech.addEventListener('click', () => injectShock('tech'));
  }

  /**
   * Setup sidebar toggle.
   */
  function setupSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      toggle.textContent = sidebar.classList.contains('open') ? '✕' : '⚙';
    });
  }

  /**
   * Reset parameters to defaults.
   */
  function resetParams() {
    currentParams = Object.assign({}, StructuralEntropyModel.DEFAULT_PARAMS);
    currentShocks = [];
    
    // Reset regulators
    currentRegulators = { gov: 0, deg: 0 };
    const regGov = document.getElementById('reg-gov');
    const regGovVal = document.getElementById('reg-gov-val');
    const regDeg = document.getElementById('reg-deg');
    const regDegVal = document.getElementById('reg-deg-val');
    if(regGov) { regGov.value = 0; regGovVal.textContent = '0%'; }
    if(regDeg) { regDeg.value = 0; regDegVal.textContent = '0%'; }

    // Update all sliders
    PARAM_DEFS.forEach(group => {
      group.params.forEach(pdef => {
        const slider = document.getElementById(`slider-${pdef.key}`);
        const valueDisp = document.getElementById(`val-${pdef.key}`);
        if (slider) slider.value = currentParams[pdef.key];
        if (valueDisp) {
          const formatVal = (v) => {
            if (pdef.format) return pdef.format(v);
            if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
            if (Number.isInteger(pdef.step) && pdef.step >= 1) return Math.round(v).toString();
            if (pdef.step >= 0.1) return parseFloat(v).toFixed(1);
            if (pdef.step >= 0.01) return parseFloat(v).toFixed(2);
            return parseFloat(v).toFixed(3);
          };
          valueDisp.textContent = formatVal(currentParams[pdef.key]);
        }
      });
    });

    // Reset custom endpoints
    CUSTOM_SLIDER_DEFS.forEach(def => {
      customEndpoints[def.key] = def.defaultVal;
      const slider = document.getElementById(`cslider-${def.key}`);
      const valueDisp = document.getElementById(`cval-${def.key}`);
      if (slider) slider.value = def.defaultVal;
      if (valueDisp) valueDisp.textContent = def.defaultVal.toFixed(2);
    });

    triggerChange();
  }

  /**
   * Get current scenario object.
   */
  function getCurrentScenario() {
    if (currentScenarioId === 'S5') {
      return Scenarios.buildCustom(customEndpoints);
    }
    return Scenarios.getById(currentScenarioId);
  }

  /**
   * Get current parameters.
   */
  function getParams() {
    return Object.assign({}, currentParams);
  }

  /**
   * Get current scenario ID.
   */
  function getScenarioId() {
    return currentScenarioId;
  }

  function getRegulators() {
    return currentRegulators;
  }

  function getShocks() {
    return currentShocks;
  }

  // Debounced change trigger
  let changeTimeout = null;
  function triggerChange() {
    if (changeTimeout) clearTimeout(changeTimeout);
    changeTimeout = setTimeout(() => {
      if (onChangeCallback) {
        onChangeCallback(getParams(), getCurrentScenario());
      }
    }, 60);
  }

  return {
    init,
    getParams,
    getCurrentScenario,
    getScenarioId,
    getRegulators,
    getShocks,
    selectScenario,
    resetParams,
    _lastResults: null
  };

})();
