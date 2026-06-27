/**
 * charts.js — Canvas-based Chart Engine
 * 
 * Renders 4 chart panels:
 *   1. λ(t) — Structural Entropic Pressure with threshold zones
 *   2. N(t) vs K_eff(t) — Population vs Carrying Capacity
 *   3. D(t) and R(t) — Degradation vs Resilience
 *   4. System State Dashboard — gauges and indicators
 *   5. Phase Space (N vs λ) — Attraction/Collapse Spirals
 */

'use strict';

const ChartEngine = (() => {

  // ── Theme ───────────────────────────────────────────────────────────
  const THEME = {
    bg:         '#0a0e17',
    cardBg:     'rgba(17,24,39,0.8)',
    gridLine:   'rgba(148,163,184,0.1)',
    gridLineAlt:'rgba(148,163,184,0.05)',
    axisLine:   'rgba(148,163,184,0.3)',
    text:       '#94a3b8',
    textBright: '#f1f5f9',
    cyan:       '#06b6d4',
    emerald:    '#10b981',
    amber:      '#f59e0b',
    orange:     '#f97316',
    red:        '#ef4444',
    purple:     '#8b5cf6',
    rose:       '#f43f5e',
    sky:        '#38bdf8',
    teal:       '#14b8a6',
    white30:    'rgba(255,255,255,0.3)',
    white10:    'rgba(255,255,255,0.1)'
  };

  // ── Utility ────────────────────────────────────────────────────────
  const DPR = window.devicePixelRatio || 1;

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width * DPR;
    canvas.height = rect.height * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);
    return { ctx, w: rect.width, h: rect.height };
  }

  function niceRange(min, max, padding) {
    padding = padding || 0.08;
    const range = max - min || 1;
    return {
      min: min - range * padding,
      max: max + range * padding
    };
  }

  function drawGrid(ctx, w, h, margin, xMin, xMax, yMin, yMax, opts) {
    opts = opts || {};
    const xTicks = opts.xTicks || 7;
    const yTicks = opts.yTicks || 6;
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;
    const xLabel = opts.xLabel || '';
    const yLabel = opts.yLabel || '';
    const title  = opts.title  || '';

    ctx.save();

    // Background
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, w, h);

    // Title
    if (title) {
      ctx.fillStyle = THEME.textBright;
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, margin.left + plotW / 2, margin.top - 10);
    }

    // Grid lines
    ctx.strokeStyle = THEME.gridLine;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);

    // Y grid & labels
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'right';

    for (let i = 0; i <= yTicks; i++) {
      const frac = i / yTicks;
      const y = margin.top + plotH - frac * plotH;
      const val = yMin + frac * (yMax - yMin);

      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotW, y);
      ctx.stroke();

      let label;
      if (opts.yFormat) {
        label = opts.yFormat(val);
      } else if (Math.abs(val) >= 1e9) {
        label = (val / 1e9).toFixed(1) + 'B';
      } else if (Math.abs(val) >= 1e6) {
        label = (val / 1e6).toFixed(1) + 'M';
      } else {
        label = val.toFixed(2);
      }
      ctx.fillText(label, margin.left - 6, y + 3);
    }

    // X grid & labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= xTicks; i++) {
      const frac = i / xTicks;
      const x = margin.left + frac * plotW;
      const val = xMin + frac * (xMax - xMin);

      ctx.beginPath();
      ctx.strokeStyle = THEME.gridLine;
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + plotH);
      ctx.stroke();

      ctx.fillStyle = THEME.text;
      ctx.fillText(Math.round(val).toString(), x, margin.top + plotH + 16);
    }

    // Axes
    ctx.strokeStyle = THEME.axisLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + plotH);
    ctx.lineTo(margin.left + plotW, margin.top + plotH);
    ctx.stroke();

    // Y axis label
    if (yLabel) {
      ctx.save();
      ctx.translate(12, margin.top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = THEME.text;
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }

    ctx.restore();

    // Return mapping functions
    return {
      plotW, plotH,
      mapX: (val) => margin.left + ((val - xMin) / (xMax - xMin)) * plotW,
      mapY: (val) => margin.top + plotH - ((val - yMin) / (yMax - yMin)) * plotH
    };
  }

  function drawLine(ctx, time, data, mapX, mapY, color, lineWidth, dashed) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 1.5;
    if (dashed) ctx.setLineDash(dashed);
    else ctx.setLineDash([]);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < time.length; i += 2) { // skip every other for performance
      const x = mapX(time[i]);
      const y = mapY(data[i]);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawAreaUnder(ctx, time, data, mapX, mapY, yBase, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(mapX(time[0]), yBase);
    for (let i = 0; i < time.length; i += 2) {
      ctx.lineTo(mapX(time[i]), mapY(data[i]));
    }
    ctx.lineTo(mapX(time[time.length - 1]), yBase);
    ctx.closePath();
    ctx.fill();
  }

  function drawThreshold(ctx, mapX, mapY, xMin, xMax, value, color, label, plotW, margin) {
    const y = mapY(value);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(mapX(xMin), y);
    ctx.lineTo(mapX(xMax), y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (label) {
      ctx.fillStyle = color;
      ctx.font = 'bold 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label, margin.left + plotW - 4, y - 5);
    }
  }

  function drawEventMarker(ctx, mapX, mapY, t, yMin, yMax, color, label, margin, plotH) {
    if (t === null || t === undefined) return;
    const x = mapX(t);
    const yTop = margin.top;
    const yBot = margin.top + plotH;

    // Vertical line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x, yBot);
    ctx.stroke();
    ctx.setLineDash([]);

    // Diamond marker
    const my = yTop + 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, my - 5);
    ctx.lineTo(x + 5, my);
    ctx.lineTo(x, my + 5);
    ctx.lineTo(x - 5, my);
    ctx.closePath();
    ctx.fill();

    // Label
    if (label) {
      ctx.fillStyle = color;
      ctx.font = 'bold 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, my + 16);
    }
  }

  function drawLegend(ctx, items, x, y) {
    ctx.font = '10px Inter, system-ui, sans-serif';
    let cx = x;
    items.forEach(item => {
      // Color swatch
      ctx.fillStyle = item.color;
      ctx.fillRect(cx, y - 7, 12, 3);
      if (item.dashed) {
        ctx.fillStyle = 'transparent';
        ctx.clearRect(cx + 3, y - 7, 3, 3);
        ctx.clearRect(cx + 9, y - 7, 3, 3);
      }
      cx += 16;
      // Label
      ctx.fillStyle = THEME.text;
      ctx.textAlign = 'left';
      ctx.fillText(item.label, cx, y);
      cx += ctx.measureText(item.label).width + 18;
    });
  }

  // ── Chart 1: λ(t) Pressure ────────────────────────────────────────
  function renderLambdaChart(canvas, results) {
    const { ctx, w, h } = setupCanvas(canvas);
    const margin = { top: 36, right: 16, bottom: 30, left: 52 };

    const time = results.time;
    const lambda = results.lambda;
    const lambdaCrit = results.params.lambda_crit;

    // Calculate range
    let lMin = Infinity, lMax = -Infinity;
    for (let i = 0; i < lambda.length; i++) {
      if (lambda[i] < lMin) lMin = lambda[i];
      if (lambda[i] > lMax) lMax = lambda[i];
    }
    const yRange = niceRange(Math.min(lMin, 0), Math.max(lMax, lambdaCrit + 0.3), 0.1);

    const { plotW, plotH, mapX, mapY } = drawGrid(ctx, w, h, margin,
      results.params.t_start, results.params.t_end,
      yRange.min, yRange.max, {
        title: typeof I18n !== 'undefined' ? I18n.getText('chart-lambda-title-full') : 'λ(t) — Pressão Entrópica Estrutural',
        yLabel: 'λ',
        yFormat: v => v.toFixed(2),
        yTicks: 6
      });

    // Danger zone above λ_crit
    const yCrit = mapY(lambdaCrit);
    const yTop  = mapY(yRange.max);
    ctx.fillStyle = 'rgba(239,68,68,0.06)';
    ctx.fillRect(margin.left, yTop, plotW, yCrit - yTop);

    // Safe zone below
    const yBot = mapY(yRange.min);
    ctx.fillStyle = 'rgba(16,185,129,0.04)';
    ctx.fillRect(margin.left, yCrit, plotW, yBot - yCrit);

    // λ_crit threshold
    drawThreshold(ctx, mapX, mapY, results.params.t_start, results.params.t_end,
      lambdaCrit, THEME.red, 'λ_crit = ' + lambdaCrit.toFixed(1), plotW, margin);

    // Area under curve colored by zone
    // Draw the λ line with gradient feel
    for (let i = 2; i < time.length; i += 2) {
      const x0 = mapX(time[i - 2]);
      const x1 = mapX(time[i]);
      const y0 = mapY(lambda[i - 2]);
      const y1 = mapY(lambda[i]);
      const val = (lambda[i - 2] + lambda[i]) / 2;
      const ratio = Math.max(0, Math.min(1, val / (lambdaCrit * 1.5)));

      // Fill down to baseline
      const baseY = mapY(0);
      ctx.fillStyle = val >= lambdaCrit
        ? `rgba(239,68,68,${0.08 + ratio * 0.12})`
        : `rgba(6,182,212,${0.06 + (1 - ratio) * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(x0, baseY);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1, baseY);
      ctx.closePath();
      ctx.fill();
    }

    // Main λ line
    drawLine(ctx, time, lambda, mapX, mapY, THEME.cyan, 2);

    // Glow effect
    ctx.save();
    ctx.shadowColor = THEME.cyan;
    ctx.shadowBlur = 8;
    drawLine(ctx, time, lambda, mapX, mapY, THEME.cyan, 1);
    ctx.restore();

    // Event markers
    drawEventMarker(ctx, mapX, mapY, results.events.tau2, yRange.min, yRange.max,
      THEME.red, 'τ₂', margin, plotH);
    drawEventMarker(ctx, mapX, mapY, results.events.recoveryTime, yRange.min, yRange.max,
      THEME.emerald, 'Recup.', margin, plotH);

    // Legend
    drawLegend(ctx, [
      { color: THEME.cyan, label: 'λ(t)' },
      { color: THEME.red, label: 'λ_crit', dashed: true }
    ], margin.left + 4, margin.top + plotH + 26);
  }

  // ── Chart 2: N_tot(t) vs K_eff(t) ────────────────────────────────
  function renderPopulationChart(canvas, results) {
    const { ctx, w, h } = setupCanvas(canvas);
    const margin = { top: 36, right: 16, bottom: 30, left: 58 };

    const time = results.time;
    const Nn   = results.Nn;
    const Ns   = results.Ns;
    const Keff = results.Keff;
    const N_tot = new Float64Array(time.length);
    for (let i = 0; i < time.length; i++) {
      N_tot[i] = Nn[i] + Ns[i];
    }

    let vMin = Infinity, vMax = -Infinity;
    for (let i = 0; i < N_tot.length; i++) {
      const mn = Math.min(N_tot[i], Keff[i]);
      const mx = Math.max(N_tot[i], Keff[i]);
      if (mn < vMin) vMin = mn;
      if (mx > vMax) vMax = mx;
    }
    const yRange = niceRange(Math.max(0, vMin * 0.9), vMax, 0.08);

    const { plotW, plotH, mapX, mapY } = drawGrid(ctx, w, h, margin,
      results.params.t_start, results.params.t_end,
      yRange.min, yRange.max, {
        title: typeof I18n !== 'undefined' ? I18n.getText('chart-pop-title-full') : 'N(t) vs K_eff(t) — População e Capacidade de Suporte',
        yLabel: 'Pessoas (Bilhões)',
        yTicks: 6
      });

    // Area between N_tot and Keff when N_tot > Keff (overshoot zone)
    for (let i = 2; i < time.length; i += 2) {
      if (N_tot[i] > Keff[i]) {
        const x0 = mapX(time[i - 2]);
        const x1 = mapX(time[i]);
        ctx.fillStyle = 'rgba(239,68,68,0.08)';
        ctx.fillRect(x0, mapY(Math.max(N_tot[i-2], N_tot[i])),
          x1 - x0, mapY(Math.min(Keff[i-2], Keff[i])) - mapY(Math.max(N_tot[i-2], N_tot[i])));
      }
    }

    // K_eff area fill
    drawAreaUnder(ctx, time, Keff, mapX, mapY, mapY(yRange.min), 'rgba(16,185,129,0.06)');

    // Lines
    drawLine(ctx, time, Keff, mapX, mapY, THEME.emerald, 2, [6, 4]);
    drawLine(ctx, time, N_tot, mapX, mapY, THEME.orange, 2);
    drawLine(ctx, time, Nn, mapX, mapY, '#3b82f6', 1.5); // North: Blue
    drawLine(ctx, time, Ns, mapX, mapY, '#f97316', 1.5); // South: Orange

    // Event markers
    drawEventMarker(ctx, mapX, mapY, results.events.tau1, yRange.min, yRange.max,
      THEME.red, 'Colapso', margin, plotH);

    // Legend
    drawLegend(ctx, [
      { color: THEME.orange, label: 'N_Total' },
      { color: '#3b82f6', label: 'N_Norte' },
      { color: '#f97316', label: 'N_Sul' },
      { color: THEME.emerald, label: 'K_eff', dashed: true }
    ], margin.left + 4, margin.top + plotH + 26);
  }

  // ── Chart 3: D(t) and R(t) ───────────────────────────────────────
  function renderDegradationChart(canvas, results) {
    const { ctx, w, h } = setupCanvas(canvas);
    const margin = { top: 36, right: 16, bottom: 30, left: 46 };

    const time = results.time;
    const D = results.D;
    const R = results.R;

    const { plotW, plotH, mapX, mapY } = drawGrid(ctx, w, h, margin,
      results.params.t_start, results.params.t_end,
      0, 1, {
        title: typeof I18n !== 'undefined' ? I18n.getText('chart-deg-title-full') : 'D(t) vs R(t) — Degradação e Resiliência',
        yLabel: 'Nível [0,1]',
        yFormat: v => v.toFixed(2),
        yTicks: 5
      });

    // Area fills
    drawAreaUnder(ctx, time, D, mapX, mapY, mapY(0), 'rgba(239,68,68,0.08)');
    drawAreaUnder(ctx, time, R, mapX, mapY, mapY(0), 'rgba(16,185,129,0.06)');

    // R_min threshold
    drawThreshold(ctx, mapX, mapY, results.params.t_start, results.params.t_end,
      results.params.R_min, THEME.amber, 'R_min', plotW, margin);

    // Lines
    drawLine(ctx, time, R, mapX, mapY, THEME.emerald, 2);
    drawLine(ctx, time, D, mapX, mapY, THEME.red, 2);

    // Glow
    ctx.save();
    ctx.shadowColor = THEME.emerald;
    ctx.shadowBlur = 5;
    drawLine(ctx, time, R, mapX, mapY, THEME.emerald, 0.8);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = THEME.red;
    ctx.shadowBlur = 5;
    drawLine(ctx, time, D, mapX, mapY, THEME.red, 0.8);
    ctx.restore();

    // Fragmentation marker
    drawEventMarker(ctx, mapX, mapY, results.events.fragmentationTime, 0, 1,
      THEME.purple, 'Frag.', margin, plotH);

    // Legend
    drawLegend(ctx, [
      { color: THEME.red, label: 'D(t) Degradação' },
      { color: THEME.emerald, label: 'R(t) Resiliência' }
    ], margin.left + 4, margin.top + plotH + 26);
  }

  // ── Chart 4: System State Dashboard ────────────────────────────────
  function renderDashboard(canvas, results) {
    const { ctx, w, h } = setupCanvas(canvas);
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    // Get final values (year 2100)
    const lastIdx = results.length - 1;
    const finalLambda = results.lambda[lastIdx];
    const finalN      = results.Nn[lastIdx] + results.Ns[lastIdx];
    const finalKeff   = results.Keff[lastIdx];
    const finalD      = results.D[lastIdx];
    const finalR      = results.R[lastIdx];
    const lambdaCrit  = results.params.lambda_crit;

    // Title
    ctx.fillStyle = THEME.textBright;
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(typeof I18n !== 'undefined' ? I18n.getText('chart-dashboard-title') : 'Painel de Estado do Sistema', w / 2, 24);

    // Draw gauges in a 2x3 grid
    const gauges = [
      { label: 'λ Final', value: finalLambda, max: 2, color: finalLambda >= lambdaCrit ? THEME.red : THEME.emerald, format: v => v.toFixed(3) },
      { label: 'N/K_eff', value: finalN / Math.max(finalKeff, 1), max: 2, color: finalN > finalKeff ? THEME.red : THEME.sky, format: v => v.toFixed(3) },
      { label: 'Degradação', value: finalD, max: 1, color: finalD > 0.5 ? THEME.red : finalD > 0.3 ? THEME.amber : THEME.emerald, format: v => (v * 100).toFixed(1) + '%' },
      { label: 'Resiliência', value: finalR, max: 1, color: finalR < 0.2 ? THEME.red : finalR < 0.4 ? THEME.amber : THEME.emerald, format: v => (v * 100).toFixed(1) + '%' },
      { label: 'Pop. (bilhões)', value: finalN, max: 15, color: THEME.sky, format: v => v.toFixed(2) + 'B' },
      { label: 'K_eff (bilhões)', value: finalKeff, max: 15, color: THEME.emerald, format: v => v.toFixed(2) + 'B' }
    ];

    const cols = 3;
    const rows = 2;
    const gw = (w - 30) / cols;
    const gh = (h - 60) / rows;

    gauges.forEach((g, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = 15 + col * gw + gw / 2;
      const cy = 44 + row * gh + gh / 2;
      const radius = Math.min(gw, gh) * 0.30;

      drawGauge(ctx, cx, cy, radius, g);
    });

    // Events summary
    const evY = h - 28;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    const events = [];
    if (results.events.tau1) events.push(`τ₁ = ${Math.round(results.events.tau1)}`);
    if (results.events.tau2) events.push(`τ₂ = ${Math.round(results.events.tau2)}`);
    if (results.events.recoveryTime) events.push(`Recup. = ${Math.round(results.events.recoveryTime)}`);
    if (results.events.fragmentationTime) events.push(`Frag. = ${Math.round(results.events.fragmentationTime)}`);
    if (events.length === 0) events.push('Nenhum evento crítico detectado');

    ctx.fillStyle = THEME.text;
    ctx.fillText('Eventos: ' + events.join('  │  '), w / 2, evY);

    // System status
    let status, statusColor;
    if (finalLambda < lambdaCrit * 0.6) {
      status = typeof I18n !== 'undefined' ? I18n.getText('status-stable-label') : '● ESTÁVEL'; statusColor = THEME.emerald;
    } else if (finalLambda < lambdaCrit) {
      status = typeof I18n !== 'undefined' ? I18n.getText('status-alert-label') : '● ALERTA'; statusColor = THEME.amber;
    } else if (finalLambda < lambdaCrit * 1.3) {
      status = typeof I18n !== 'undefined' ? I18n.getText('status-critical-label') : '● CRÍTICO'; statusColor = THEME.red;
    } else {
      status = typeof I18n !== 'undefined' ? I18n.getText('status-collapse-label') : '● COLAPSO'; statusColor = THEME.rose;
    }
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = statusColor;
    ctx.fillText(status, w / 2, evY - 14);
  }

  function drawGauge(ctx, cx, cy, radius, gauge) {
    const startAngle = Math.PI * 0.75;
    const endAngle   = Math.PI * 2.25;
    const totalArc   = endAngle - startAngle;
    const valueFrac  = Math.min(1, Math.max(0, gauge.value / gauge.max));
    const valueAngle = startAngle + totalArc * valueFrac;

    // Background arc
    ctx.strokeStyle = THEME.white10;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();

    // Value arc
    ctx.strokeStyle = gauge.color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, valueAngle);
    ctx.stroke();

    // Glow
    ctx.save();
    ctx.shadowColor = gauge.color;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = gauge.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, valueAngle);
    ctx.stroke();
    ctx.restore();

    // Value text
    ctx.fillStyle = THEME.textBright;
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gauge.format(gauge.value), cx, cy + 4);

    // Label
    ctx.fillStyle = THEME.text;
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.fillText(gauge.label, cx, cy + radius + 16);
  }

  function renderPhaseSpaceChart(canvas, results) {
    const { ctx, w, h } = setupCanvas(canvas);
    const margin = { top: 36, right: 30, bottom: 40, left: 60 };

    const Nn = results.Nn;
    const Ns = results.Ns;
    const N_tot = new Float64Array(results.time.length);
    for (let i = 0; i < results.time.length; i++) N_tot[i] = results.Nn[i] + results.Ns[i];
    const lambda = results.lambda;
    
    // X Axis = Population (N)
    let nMin = 0;
    let nMax = 15; // 15 Billion max (model outputs in billions)
    
    // Y Axis = Lambda
    let lMin = 0;
    let lMax = Math.max(results.params.lambda_crit * 1.5, 2.0);

    const { plotW, plotH, mapX, mapY } = drawGrid(ctx, w, h, margin,
      nMin, nMax,
      lMin, lMax, {
        title: typeof I18n !== 'undefined' ? I18n.getText('chart-phase-title-full') : 'Espaço de Fase: N vs λ (Trajetória de Atração)',
        xLabel: 'População (N)',
        yLabel: 'Entropia (λ)',
        yFormat: v => v.toFixed(2),
        yTicks: 6,
        xTicks: 6
      });

    // Draw Attractor Zones
    // Safe Zone (Green) - Lambda < Crit
    const yCrit = mapY(results.params.lambda_crit);
    const yBot = mapY(lMin);
    ctx.fillStyle = 'rgba(16,185,129,0.03)';
    ctx.fillRect(margin.left, yCrit, plotW, yBot - yCrit);
    
    // Collapse Zone (Red) - Lambda > Crit
    const yTop = mapY(lMax);
    ctx.fillStyle = 'rgba(239,68,68,0.05)';
    ctx.fillRect(margin.left, yTop, plotW, yCrit - yTop);

    // Draw lambda_crit line horizontally
    drawThreshold(ctx, mapX, mapY, nMin, nMax, results.params.lambda_crit, THEME.red, 'λ_crit', plotW, margin);

    // Draw the Trajectory (Phase Orbit)
    ctx.strokeStyle = THEME.purple;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(mapX(N_tot[0]), mapY(lambda[0]));
    
    // Draw line with gradient-like fading by segmenting it
    for (let i = 1; i < N_tot.length; i += 2) {
      const x = mapX(N_tot[i]);
      const y = mapY(lambda[i]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glow
    ctx.save();
    ctx.shadowColor = THEME.purple;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();

    // Start point marker (1970)
    ctx.fillStyle = THEME.sky;
    ctx.beginPath();
    ctx.arc(mapX(N_tot[0]), mapY(lambda[0]), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = THEME.text;
    ctx.font = '10px Inter';
    ctx.fillText(results.params.t_start.toString(), mapX(N_tot[0]) - 15, mapY(lambda[0]) + 15);

    // End point marker (2100)
    const lastIdx = N_tot.length - 1;
    ctx.fillStyle = lambda[lastIdx] >= results.params.lambda_crit ? THEME.red : THEME.emerald;
    ctx.beginPath();
    ctx.arc(mapX(N_tot[lastIdx]), mapY(lambda[lastIdx]), 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow end marker
    ctx.save();
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
    
    ctx.fillStyle = THEME.textBright;
    ctx.fillText(results.params.t_end.toString(), mapX(N_tot[lastIdx]) + 15, mapY(lambda[lastIdx]) + 5);

    // Label the zones
    ctx.fillStyle = 'rgba(16,185,129,0.3)';
    ctx.font = 'bold 12px Inter';
    ctx.fillText(typeof I18n !== 'undefined' ? I18n.getText('zone-stable') : 'Atrator Estável', margin.left + plotW / 2, mapY(lMin + (results.params.lambda_crit - lMin)/2));
    
    ctx.fillStyle = 'rgba(239,68,68,0.3)';
    ctx.fillText(typeof I18n !== 'undefined' ? I18n.getText('zone-collapse') : 'Zona de Colapso (Ruptura)', margin.left + plotW / 2, mapY(results.params.lambda_crit + (lMax - results.params.lambda_crit)/2));
  }

  // ── Chart 6: Planetary Behavior (Real Data + Projections) ──────
  function renderPlanetaryChart(canvas, results, planetaryData) {
    if (!planetaryData || !planetaryData.time || planetaryData.time.length === 0) return;
    const { ctx, w, h } = setupCanvas(canvas);
    const margin = { top: 36, right: 60, bottom: 30, left: 52 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    const time = planetaryData.time;
    const tStart = time[0];
    const tEnd = time[time.length - 1];
    const currentYear = new Date().getFullYear();

    // Title
    const title = typeof I18n !== 'undefined' ? I18n.getText('chart-planetary-title') : 'Indicadores Planetários — Dados Reais + Projeções';
    ctx.fillStyle = THEME.textBright;
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, margin.left + plotW / 2, margin.top - 10);

    // X grid
    ctx.strokeStyle = THEME.gridLine;
    ctx.lineWidth = 0.5;
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'center';
    const xTicks = 7;
    for (let i = 0; i <= xTicks; i++) {
      const frac = i / xTicks;
      const x = margin.left + frac * plotW;
      const val = tStart + frac * (tEnd - tStart);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + plotH);
      ctx.stroke();
      ctx.fillText(Math.round(val).toString(), x, margin.top + plotH + 16);
    }

    // Axes
    ctx.strokeStyle = THEME.axisLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + plotH);
    ctx.lineTo(margin.left + plotW, margin.top + plotH);
    ctx.stroke();

    // Transition line (Real → Projection)
    const transX = margin.left + ((currentYear - tStart) / (tEnd - tStart)) * plotW;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(transX, margin.top);
    ctx.lineTo(transX, margin.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px Inter';
    ctx.textAlign = 'center';
    const realLabel = typeof I18n !== 'undefined' ? I18n.getText('label-real-data') : 'Dados Reais';
    const projLabel = typeof I18n !== 'undefined' ? I18n.getText('label-projection') : 'Projeção';
    ctx.fillText('◄ ' + realLabel, transX - 40, margin.top + 14);
    ctx.fillText(projLabel + ' ►', transX + 40, margin.top + 14);

    // Data series definitions (all normalized to 0-1 for multi-axis display)
    const series = [
      { data: planetaryData.temperature, label: 'ΔT (°C)', color: THEME.red, min: -0.2, max: 5 },
      { data: planetaryData.co2, label: 'CO₂ (ppm)', color: '#a16207', min: 300, max: 600 },
      { data: planetaryData.forest, label: typeof I18n !== 'undefined' ? I18n.getText('label-forest') : 'Floresta (%)', color: THEME.emerald, min: 15, max: 35 },
      { data: planetaryData.hurricanes, label: typeof I18n !== 'undefined' ? I18n.getText('label-hurricanes') : 'Furacões 4+', color: THEME.amber, min: 0, max: 40 },
      { data: planetaryData.lambda, label: 'λ (Entropia)', color: THEME.purple, min: 0, max: 2 }
    ];

    // Draw each line
    series.forEach(s => {
      if (!s.data || s.data.length === 0) return;
      const mapX = (idx) => margin.left + ((time[idx] - tStart) / (tEnd - tStart)) * plotW;
      const mapY = (val) => margin.top + plotH - ((val - s.min) / (s.max - s.min)) * plotH;

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < s.data.length; i += Math.max(1, Math.floor(s.data.length / 300))) {
        const x = mapX(i);
        const y = mapY(Math.max(s.min, Math.min(s.max, s.data[i])));
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glow
      ctx.save();
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.restore();
    });

    // Legend
    const legY = margin.top + plotH + 24;
    let legX = margin.left;
    ctx.font = '9px Inter, system-ui, sans-serif';
    series.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.fillRect(legX, legY - 5, 10, 3);
      legX += 13;
      ctx.fillStyle = THEME.text;
      ctx.textAlign = 'left';
      ctx.fillText(s.label, legX, legY);
      legX += ctx.measureText(s.label).width + 12;
    });
  }

  // ── Enhanced Thermal Map ─────────────────────────────────────────
  function renderThermalMap(containerId, results) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const lastIdx = results.length - 1;
    const deltaT = results.deltaT[lastIdx];
    const D = results.D[lastIdx];
    const lambda = results.lambda[lastIdx];
    const lambdaCrit = results.params.lambda_crit;

    // Regional stress factors
    const regions = container.querySelectorAll('.map-region');
    regions.forEach(region => {
      const isEquator = region.classList.contains('equator');
      // Equatorial regions heat more, polar regions have different dynamics
      const regionalStress = isEquator ? (deltaT * 1.3 + D * 0.5) : (deltaT * 0.8 + D * 0.3);
      const normalizedStress = Math.min(1, regionalStress / 4);
      
      // Color gradient: green → yellow → orange → red → dark red
      let r, g, b;
      if (normalizedStress < 0.25) {
        r = Math.round(40 + normalizedStress * 4 * 160);
        g = Math.round(180 - normalizedStress * 4 * 40);
        b = 80;
      } else if (normalizedStress < 0.5) {
        const t = (normalizedStress - 0.25) * 4;
        r = Math.round(200 + t * 55);
        g = Math.round(140 - t * 80);
        b = Math.round(80 - t * 60);
      } else if (normalizedStress < 0.75) {
        const t = (normalizedStress - 0.5) * 4;
        r = 255;
        g = Math.round(60 - t * 60);
        b = Math.round(20 - t * 20);
      } else {
        const t = (normalizedStress - 0.75) * 4;
        r = Math.round(255 - t * 60);
        g = 0;
        b = 0;
      }

      region.style.fill = `rgb(${r},${g},${b})`;
      region.style.opacity = 0.75 + normalizedStress * 0.25;
      
      // Pulsate critical regions
      if (normalizedStress > 0.7) {
        region.style.animation = 'thermalPulse 1.5s ease-in-out infinite alternate';
      } else {
        region.style.animation = 'none';
      }
    });

    // Update thermal info panel
    const infoPanel = document.getElementById('thermal-info');
    if (infoPanel) {
      const tempStr = deltaT.toFixed(2);
      const statusKey = lambda >= lambdaCrit ? 'thermal-critical' : lambda >= lambdaCrit * 0.6 ? 'thermal-alert' : 'thermal-stable';
      const statusDefault = lambda >= lambdaCrit ? '🔴 CRÍTICO' : lambda >= lambdaCrit * 0.6 ? '🟡 ALERTA' : '🟢 ESTÁVEL';
      const status = typeof I18n !== 'undefined' ? I18n.getText(statusKey) : statusDefault;
      
      infoPanel.innerHTML = `
        <div class="thermal-metric"><span class="thermal-label">ΔT</span><span class="thermal-value" style="color:${deltaT > 2 ? THEME.red : deltaT > 1.5 ? THEME.amber : THEME.emerald}">+${tempStr}°C</span></div>
        <div class="thermal-metric"><span class="thermal-label">D</span><span class="thermal-value">${(D * 100).toFixed(1)}%</span></div>
        <div class="thermal-metric"><span class="thermal-label">λ</span><span class="thermal-value">${lambda.toFixed(3)}</span></div>
        <div class="thermal-status">${status}</div>
      `;
    }

    // Update tipping points
    const tpContainer = document.getElementById('tipping-points');
    if (tpContainer && typeof RealData !== 'undefined') {
      const lang = typeof I18n !== 'undefined' ? I18n.getLanguage() : 'pt';
      let html = '';
      RealData.TIPPING_POINTS.forEach(tp => {
        const stress = tp.currentStress + (deltaT / tp.threshold) * 0.3;
        const pct = Math.min(100, stress * 100);
        const color = pct > 80 ? THEME.red : pct > 60 ? THEME.amber : THEME.emerald;
        const name = lang === 'en' ? tp.nameEn : tp.name;
        html += `<div class="tp-item"><span class="tp-name">${name}</span><div class="tp-bar"><div class="tp-fill" style="width:${pct}%;background:${color}"></div></div><span class="tp-pct" style="color:${color}">${pct.toFixed(0)}%</span></div>`;
      });
      tpContainer.innerHTML = html;
    }
  }

  // ── Colorimetric Scale Bar ────────────────────────────────────────
  function renderColorBar(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="colorbar-gradient"></div>
      <div class="colorbar-labels">
        <span>0°C</span><span>1°C</span><span>2°C</span><span>3°C</span><span>4°C+</span>
      </div>
    `;
  }

  // ── Public API ────────────────────────────────────────────────────
  function renderAll(results, planetaryData) {
    const c1 = document.getElementById('chart-lambda');
    const c2 = document.getElementById('chart-population');
    const c3 = document.getElementById('chart-degradation');
    const c4 = document.getElementById('chart-dashboard');
    const c5 = document.getElementById('chart-phasespace');
    const c6 = document.getElementById('chart-planetary');

    if (c1) renderLambdaChart(c1, results);
    if (c2) renderPopulationChart(c2, results);
    if (c3) renderDegradationChart(c3, results);
    if (c4) renderDashboard(c4, results);
    if (c5) renderPhaseSpaceChart(c5, results);
    if (c6 && planetaryData) renderPlanetaryChart(c6, results, planetaryData);

    // Enhanced thermal map
    renderThermalMap('card-map', results);
    renderColorBar('thermal-colorbar');
  }

  // Tooltip tracking
  const tooltipsAttached = {};
  
  function attachTooltip(canvasId, results, chartType) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    
    canvas._chartResults = results;
    
    if (tooltipsAttached[canvasId]) return;
    tooltipsAttached[canvasId] = true;

    canvas.addEventListener('mousemove', (e) => {
      const currentResults = canvas._chartResults;
      if (!currentResults) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const w = rect.width;
      const margin = chartType === 'dashboard' ? 0 : 52;
      const plotW = w - margin - 16;

      if (x < margin || x > margin + plotW || chartType === 'dashboard') {
        tooltip.style.display = 'none';
        return;
      }

      const frac = (x - margin) / plotW;
      const year = currentResults.params.t_start + frac * (currentResults.params.t_end - currentResults.params.t_start);
      const idx = Math.round(frac * (currentResults.length - 1));

      if (idx < 0 || idx >= currentResults.length) {
        tooltip.style.display = 'none';
        return;
      }

      let html = `<strong>${Math.round(year)}</strong><br>`;
      if (chartType === 'lambda') {
        html += `λ = ${currentResults.lambda[idx].toFixed(4)}<br>`;
        html += `λ_crit = ${currentResults.params.lambda_crit}`;
      } else if (chartType === 'population') {
        html += `N_Total = ${((currentResults.Nn[idx] + currentResults.Ns[idx])).toFixed(3)}B<br>`;
        html += `K_eff = ${(currentResults.Keff[idx]).toFixed(3)}B`;
      } else if (chartType === 'degradation') {
        html += `D = ${(currentResults.D[idx] * 100).toFixed(1)}%<br>`;
        html += `R = ${(currentResults.R[idx] * 100).toFixed(1)}%`;
      }

      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 12) + 'px';
      tooltip.style.top  = (e.clientY - 10) + 'px';
    });

    canvas.addEventListener('mouseleave', () => {
      const tooltip = document.getElementById('tooltip');
      if (tooltip) tooltip.style.display = 'none';
    });
  }

  return {
    renderAll,
    attachTooltip
  };

})();

// %% Live Seismograph %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
const Seismograph = (() => {
  let canvas, ctx;
  let animFrame = null;
  let currentLambda = 0, currentDeltaT = 0, lambdaCrit = 1.0;
  let timePos = 0;
  let points = [];
  const maxPoints = 200;

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (canvas) {
      ctx = canvas.getContext('2d');
      // Fix resolution
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentNode.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      for(let i=0; i<maxPoints; i++) points.push(0);
      if(!animFrame) loop();
    }
  }

  function updateParams(lambda, crit, deltaT) {
    currentLambda = lambda;
    lambdaCrit = crit;
    currentDeltaT = deltaT;
  }

  function loop() {
    if (!ctx) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    
    // Fade background to create trailing effect
    ctx.fillStyle = 'rgba(5, 5, 5, 0.2)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
    ctx.stroke();

    // Physics of the waveform
    // Higher lambda/deltaT = higher amplitude & frequency
    const stress = Math.max(0, currentLambda / lambdaCrit);
    const heat = Math.max(0, (currentDeltaT - 1) / 4); 
    
    const baseAmp = 5 + (stress * 20);
    const freq = 0.1 + (heat * 0.5);
    
    // Add chaos
    const chaos = (Math.random() - 0.5) * (stress * 30);
    
    let yVal = Math.sin(timePos * freq) * baseAmp + Math.cos(timePos * 0.05) * baseAmp * 0.5 + chaos;

    // Detect Extreme Events (Spikes)
    let eventName = null;
    let isSpike = false;
    if (stress > 0.8 && Math.random() < 0.02 * stress) {
      yVal *= (3 + Math.random() * 4); // massive spike
      isSpike = true;
      if (heat > 0.6) eventName = typeof I18n !== 'undefined' ? I18n.getText('TSUNAMI') : 'TSUNAMI';
      else eventName = typeof I18n !== 'undefined' ? I18n.getText('SEISMIC') : 'EARTHQUAKE';
    }

    // Shift points
    points.push(yVal);
    if (points.length > maxPoints) points.shift();

    // Draw wave
    ctx.beginPath();
    const step = w / (maxPoints - 1);
    for (let i = 0; i < points.length; i++) {
      const px = i * step;
      const py = (h / 2) + points[i];
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    // Color based on stress
    if (stress > 1.0) ctx.strokeStyle = '#ef4444'; // Red
    else if (stress > 0.7) ctx.strokeStyle = '#eab308'; // Yellow
    else ctx.strokeStyle = '#10b981'; // Green

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw Event text if spike
    if (isSpike && eventName) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(eventName, w/2, h/2 - 30);
    }

    timePos++;
    animFrame = requestAnimationFrame(loop);
  }

  return { init, updateParams };
})();

