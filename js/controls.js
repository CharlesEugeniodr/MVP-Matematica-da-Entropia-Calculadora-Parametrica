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
    { group: 'Simulação', params: [
      { key: 't_start', label: 'Ano Inicial', min: 1900, max: 2020, step: 1 },
      { key: 't_end',   label: 'Ano Final', min: 2050, max: 2200, step: 1 },
      { key: 'dt',      label: 'Passo de Tempo (dt)', min: 0.01, max: 1, step: 0.01 },
    ]},
    { group: 'Limiares Críticos', params: [
      { key: 'lambda_crit', label: 'λ_crit (Ruptura)', min: 0.5, max: 2.0, step: 0.05 },
      { key: 'R_min', label: 'R_min (Resiliência Mín.)', min: 0.05, max: 0.8, step: 0.05 },
    ]},
    { group: 'Dinâmica Global [0,1]', params: [
      { key: 'gov_policy', label: 'Governança', min: 0, max: 1, step: 0.01 },
      { key: 'tech_innovation', label: 'Inovação Tecnológica', min: 0, max: 1, step: 0.01 },
      { key: 'emissions', label: 'Taxa de Emissões', min: 0, max: 1, step: 0.01 },
      { key: 'land_use', label: 'Degradação do Solo', min: 0, max: 1, step: 0.01 },
      { key: 'pollution', label: 'Poluição', min: 0, max: 1, step: 0.01 },
      { key: 'inequality', label: 'Desigualdade', min: 0, max: 1, step: 0.01 },
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
