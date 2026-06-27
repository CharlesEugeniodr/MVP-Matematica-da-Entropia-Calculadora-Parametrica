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
        title: 'λ(t) — Pressão Entrópica Estrutural',
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

  // ── Chart 2: N(t) vs K_eff(t) ────────────────────────────────────
  function renderPopulationChart(canvas, results) {
    const { ctx, w, h } = setupCanvas(canvas);
    const margin = { top: 36, right: 16, bottom: 30, left: 58 };

    const time = results.time;
    const N    = results.N;
    const Keff = results.Keff;

    let vMin = Infinity, vMax = -Infinity;
    for (let i = 0; i < N.length; i++) {
      const mn = Math.min(N[i], Keff[i]);
      const mx = Math.max(N[i], Keff[i]);
      if (mn < vMin) vMin = mn;
      if (mx > vMax) vMax = mx;
    }
    const yRange = niceRange(Math.max(0, vMin * 0.9), vMax, 0.08);

    const { plotW, plotH, mapX, mapY } = drawGrid(ctx, w, h, margin,
      results.params.t_start, results.params.t_end,
      yRange.min, yRange.max, {
        title: 'N(t) vs K_eff(t) — População e Capacidade de Suporte',
        yLabel: 'Pessoas',
        yTicks: 6
      });

    // Area between N and Keff when N > Keff (overshoot zone)
    for (let i = 2; i < time.length; i += 2) {
      if (N[i] > Keff[i]) {
        const x0 = mapX(time[i - 2]);
        const x1 = mapX(time[i]);
        ctx.fillStyle = 'rgba(239,68,68,0.08)';
        ctx.fillRect(x0, mapY(Math.max(N[i-2], N[i])),
          x1 - x0, mapY(Math.min(Keff[i-2], Keff[i])) - mapY(Math.max(N[i-2], N[i])));
      }
    }

    // K_eff area fill
    drawAreaUnder(ctx, time, Keff, mapX, mapY, mapY(yRange.min), 'rgba(16,185,129,0.06)');

    // Lines
    drawLine(ctx, time, Keff, mapX, mapY, THEME.emerald, 2, [6, 4]);
    drawLine(ctx, time, N, mapX, mapY, THEME.sky, 2);

    // Glow on N
    ctx.save();
    ctx.shadowColor = THEME.sky;
    ctx.shadowBlur = 6;
    drawLine(ctx, time, N, mapX, mapY, THEME.sky, 1);
    ctx.restore();

    // τ1 marker
    drawEventMarker(ctx, mapX, mapY, results.events.tau1, yRange.min, yRange.max,
      THEME.amber, 'τ₁', margin, plotH);

    // Legend
    drawLegend(ctx, [
      { color: THEME.sky, label: 'N(t) População' },
      { color: THEME.emerald, label: 'K_eff(t) Capacidade', dashed: true }
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
        title: 'D(t) vs R(t) — Degradação e Resiliência',
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
    const finalN      = results.N[lastIdx];
    const finalKeff   = results.Keff[lastIdx];
    const finalD      = results.D[lastIdx];
    const finalR      = results.R[lastIdx];
    const lambdaCrit  = results.params.lambda_crit;

    // Title
    ctx.fillStyle = THEME.textBright;
    ctx.font = 'bold 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Painel de Estado do Sistema (2100)', w / 2, 24);

    // Draw gauges in a 2x3 grid
    const gauges = [
      { label: 'λ Final', value: finalLambda, max: 2, color: finalLambda >= lambdaCrit ? THEME.red : THEME.emerald, format: v => v.toFixed(3) },
      { label: 'N/K_eff', value: finalN / Math.max(finalKeff, 1), max: 2, color: finalN > finalKeff ? THEME.red : THEME.sky, format: v => v.toFixed(3) },
      { label: 'Degradação', value: finalD, max: 1, color: finalD > 0.5 ? THEME.red : finalD > 0.3 ? THEME.amber : THEME.emerald, format: v => (v * 100).toFixed(1) + '%' },
      { label: 'Resiliência', value: finalR, max: 1, color: finalR < 0.2 ? THEME.red : finalR < 0.4 ? THEME.amber : THEME.emerald, format: v => (v * 100).toFixed(1) + '%' },
      { label: 'Pop. (bilhões)', value: finalN / 1e9, max: 15, color: THEME.sky, format: v => v.toFixed(2) + 'B' },
      { label: 'K_eff (bilhões)', value: finalKeff / 1e9, max: 15, color: THEME.emerald, format: v => v.toFixed(2) + 'B' }
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
      status = '● ESTÁVEL'; statusColor = THEME.emerald;
    } else if (finalLambda < lambdaCrit) {
      status = '● ALERTA'; statusColor = THEME.amber;
    } else if (finalLambda < lambdaCrit * 1.3) {
      status = '● CRÍTICO'; statusColor = THEME.red;
    } else {
      status = '● COLAPSO'; statusColor = THEME.rose;
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

    const N = results.N;
    const lambda = results.lambda;
    
    // X Axis = Population (N)
    let nMin = 0;
    let nMax = 15e9; // 15 Billion max 
    
    // Y Axis = Lambda
    let lMin = 0;
    let lMax = Math.max(results.params.lambda_crit * 1.5, 2.0);

    const { plotW, plotH, mapX, mapY } = drawGrid(ctx, w, h, margin,
      nMin, nMax,
      lMin, lMax, {
        title: 'Espaço de Fase: N vs λ (Trajetória de Atração)',
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
    ctx.moveTo(mapX(N[0]), mapY(lambda[0]));
    
    // Draw line with gradient-like fading by segmenting it
    for (let i = 1; i < N.length; i += 2) {
      const x = mapX(N[i]);
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
    ctx.arc(mapX(N[0]), mapY(lambda[0]), 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = THEME.text;
    ctx.font = '10px Inter';
    ctx.fillText('1970', mapX(N[0]) - 15, mapY(lambda[0]) + 15);

    // End point marker (2100)
    const lastIdx = N.length - 1;
    ctx.fillStyle = lambda[lastIdx] >= results.params.lambda_crit ? THEME.red : THEME.emerald;
    ctx.beginPath();
    ctx.arc(mapX(N[lastIdx]), mapY(lambda[lastIdx]), 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow end marker
    ctx.save();
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
    
    ctx.fillStyle = THEME.textBright;
    ctx.fillText('2100', mapX(N[lastIdx]) + 15, mapY(lambda[lastIdx]) + 5);

    // Label the zones
    ctx.fillStyle = 'rgba(16,185,129,0.3)';
    ctx.font = 'bold 12px Inter';
    ctx.fillText('Atrator Estável', margin.left + plotW / 2, mapY(lMin + (results.params.lambda_crit - lMin)/2));
    
    ctx.fillStyle = 'rgba(239,68,68,0.3)';
    ctx.fillText('Zona de Colapso (Ruptura)', margin.left + plotW / 2, mapY(results.params.lambda_crit + (lMax - results.params.lambda_crit)/2));
  }

  // ── Public API ────────────────────────────────────────────────────
  function renderAll(results) {
    const c1 = document.getElementById('chart-lambda');
    const c2 = document.getElementById('chart-population');
    const c3 = document.getElementById('chart-degradation');
    const c4 = document.getElementById('chart-dashboard');
    const c5 = document.getElementById('chart-phasespace');

    if (c1) renderLambdaChart(c1, results);
    if (c2) renderPopulationChart(c2, results);
    if (c3) renderDegradationChart(c3, results);
    if (c4) renderDashboard(c4, results);
    if (c5) renderPhaseSpaceChart(c5, results);
  }

  // Tooltip tracking
  function attachTooltip(canvasId, results, chartType) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    canvas.addEventListener('mousemove', (e) => {
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
      const year = results.params.t_start + frac * (results.params.t_end - results.params.t_start);
      const idx = Math.round(frac * (results.length - 1));

      if (idx < 0 || idx >= results.length) {
        tooltip.style.display = 'none';
        return;
      }

      let html = `<strong>${Math.round(year)}</strong><br>`;
      if (chartType === 'lambda') {
        html += `λ = ${results.lambda[idx].toFixed(4)}<br>`;
        html += `λ_crit = ${results.params.lambda_crit}`;
      } else if (chartType === 'population') {
        html += `N = ${(results.N[idx] / 1e9).toFixed(3)}B<br>`;
        html += `K_eff = ${(results.Keff[idx] / 1e9).toFixed(3)}B`;
      } else if (chartType === 'degradation') {
        html += `D = ${(results.D[idx] * 100).toFixed(1)}%<br>`;
        html += `R = ${(results.R[idx] * 100).toFixed(1)}%`;
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
    attachTooltip,
    renderSeismograph
  };

})();

 / /    % %  L i v e   S e i s m o g r a p h    % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % % %
 c o n s t   S e i s m o g r a p h   =   ( ( )   = >   { 
     l e t   c a n v a s ,   c t x ; 
     l e t   a n i m F r a m e   =   n u l l ; 
     l e t   c u r r e n t L a m b d a   =   0 ,   c u r r e n t D e l t a T   =   0 ,   l a m b d a C r i t   =   1 . 0 ; 
     l e t   t i m e P o s   =   0 ; 
     l e t   p o i n t s   =   [ ] ; 
     c o n s t   m a x P o i n t s   =   2 0 0 ; 
 
     f u n c t i o n   i n i t ( c a n v a s I d )   { 
         c a n v a s   =   d o c u m e n t . g e t E l e m e n t B y I d ( c a n v a s I d ) ; 
         i f   ( c a n v a s )   { 
             c t x   =   c a n v a s . g e t C o n t e x t ( ' 2 d ' ) ; 
             / /   F i x   r e s o l u t i o n 
             c o n s t   d p r   =   w i n d o w . d e v i c e P i x e l R a t i o   | |   1 ; 
             c o n s t   r e c t   =   c a n v a s . p a r e n t N o d e . g e t B o u n d i n g C l i e n t R e c t ( ) ; 
             c a n v a s . w i d t h   =   r e c t . w i d t h   *   d p r ; 
             c a n v a s . h e i g h t   =   r e c t . h e i g h t   *   d p r ; 
             c t x . s c a l e ( d p r ,   d p r ) ; 
             c a n v a s . s t y l e . w i d t h   =   \ \ p x \ ; 
             c a n v a s . s t y l e . h e i g h t   =   \ \ p x \ ; 
             
             f o r ( l e t   i = 0 ;   i < m a x P o i n t s ;   i + + )   p o i n t s . p u s h ( 0 ) ; 
             i f ( ! a n i m F r a m e )   l o o p ( ) ; 
         } 
     } 
 
     f u n c t i o n   u p d a t e P a r a m s ( l a m b d a ,   c r i t ,   d e l t a T )   { 
         c u r r e n t L a m b d a   =   l a m b d a ; 
         l a m b d a C r i t   =   c r i t ; 
         c u r r e n t D e l t a T   =   d e l t a T ; 
     } 
 
     f u n c t i o n   l o o p ( )   { 
         i f   ( ! c t x )   r e t u r n ; 
         c o n s t   w   =   c a n v a s . w i d t h   /   ( w i n d o w . d e v i c e P i x e l R a t i o   | |   1 ) ; 
         c o n s t   h   =   c a n v a s . h e i g h t   /   ( w i n d o w . d e v i c e P i x e l R a t i o   | |   1 ) ; 
         
         / /   F a d e   b a c k g r o u n d   t o   c r e a t e   t r a i l i n g   e f f e c t 
         c t x . f i l l S t y l e   =   ' r g b a ( 5 ,   5 ,   5 ,   0 . 2 ) ' ; 
         c t x . f i l l R e c t ( 0 ,   0 ,   w ,   h ) ; 
 
         / /   G r i d   l i n e s 
         c t x . s t r o k e S t y l e   =   ' r g b a ( 2 5 5 , 2 5 5 , 2 5 5 , 0 . 0 5 ) ' ; 
         c t x . l i n e W i d t h   =   1 ; 
         c t x . b e g i n P a t h ( ) ; 
         c t x . m o v e T o ( 0 ,   h / 2 ) ;   c t x . l i n e T o ( w ,   h / 2 ) ; 
         c t x . s t r o k e ( ) ; 
 
         / /   P h y s i c s   o f   t h e   w a v e f o r m 
         / /   H i g h e r   l a m b d a / d e l t a T   =   h i g h e r   a m p l i t u d e   &   f r e q u e n c y 
         c o n s t   s t r e s s   =   M a t h . m a x ( 0 ,   c u r r e n t L a m b d a   /   l a m b d a C r i t ) ; 
         c o n s t   h e a t   =   M a t h . m a x ( 0 ,   ( c u r r e n t D e l t a T   -   1 )   /   4 ) ;   
         
         c o n s t   b a s e A m p   =   5   +   ( s t r e s s   *   2 0 ) ; 
         c o n s t   f r e q   =   0 . 1   +   ( h e a t   *   0 . 5 ) ; 
         
         / /   A d d   c h a o s 
         c o n s t   c h a o s   =   ( M a t h . r a n d o m ( )   -   0 . 5 )   *   ( s t r e s s   *   3 0 ) ; 
         
         l e t   y V a l   =   M a t h . s i n ( t i m e P o s   *   f r e q )   *   b a s e A m p   +   M a t h . c o s ( t i m e P o s   *   0 . 0 5 )   *   b a s e A m p   *   0 . 5   +   c h a o s ; 
 
         / /   D e t e c t   E x t r e m e   E v e n t s   ( S p i k e s ) 
         l e t   e v e n t N a m e   =   n u l l ; 
         l e t   i s S p i k e   =   f a l s e ; 
         i f   ( s t r e s s   >   0 . 8   & &   M a t h . r a n d o m ( )   <   0 . 0 2   *   s t r e s s )   { 
             y V a l   * =   ( 3   +   M a t h . r a n d o m ( )   *   4 ) ;   / /   m a s s i v e   s p i k e 
             i s S p i k e   =   t r u e ; 
             i f   ( h e a t   >   0 . 6 )   e v e n t N a m e   =   t y p e o f   I 1 8 n   ! = =   ' u n d e f i n e d '   ?   I 1 8 n . g e t T e x t ( ' T S U N A M I ' )   :   ' T S U N A M I ' ; 
             e l s e   e v e n t N a m e   =   t y p e o f   I 1 8 n   ! = =   ' u n d e f i n e d '   ?   I 1 8 n . g e t T e x t ( ' S E I S M I C ' )   :   ' E A R T H Q U A K E ' ; 
         } 
 
         / /   S h i f t   p o i n t s 
         p o i n t s . p u s h ( y V a l ) ; 
         i f   ( p o i n t s . l e n g t h   >   m a x P o i n t s )   p o i n t s . s h i f t ( ) ; 
 
         / /   D r a w   w a v e 
         c t x . b e g i n P a t h ( ) ; 
         c o n s t   s t e p   =   w   /   ( m a x P o i n t s   -   1 ) ; 
         f o r   ( l e t   i   =   0 ;   i   <   p o i n t s . l e n g t h ;   i + + )   { 
             c o n s t   p x   =   i   *   s t e p ; 
             c o n s t   p y   =   ( h   /   2 )   +   p o i n t s [ i ] ; 
             i f   ( i   = = =   0 )   c t x . m o v e T o ( p x ,   p y ) ; 
             e l s e   c t x . l i n e T o ( p x ,   p y ) ; 
         } 
 
         / /   C o l o r   b a s e d   o n   s t r e s s 
         i f   ( s t r e s s   >   1 . 0 )   c t x . s t r o k e S t y l e   =   ' # e f 4 4 4 4 ' ;   / /   R e d 
         e l s e   i f   ( s t r e s s   >   0 . 7 )   c t x . s t r o k e S t y l e   =   ' # e a b 3 0 8 ' ;   / /   Y e l l o w 
         e l s e   c t x . s t r o k e S t y l e   =   ' # 1 0 b 9 8 1 ' ;   / /   G r e e n 
 
         c t x . l i n e W i d t h   =   2 ; 
         c t x . l i n e J o i n   =   ' r o u n d ' ; 
         c t x . s t r o k e ( ) ; 
 
         / /   D r a w   E v e n t   t e x t   i f   s p i k e 
         i f   ( i s S p i k e   & &   e v e n t N a m e )   { 
             c t x . f i l l S t y l e   =   ' # e f 4 4 4 4 ' ; 
             c t x . f o n t   =   ' b o l d   1 2 p x   m o n o s p a c e ' ; 
             c t x . f i l l T e x t ( e v e n t N a m e ,   w / 2 ,   h / 2   -   3 0 ) ; 
         } 
 
         t i m e P o s + + ; 
         a n i m F r a m e   =   r e q u e s t A n i m a t i o n F r a m e ( l o o p ) ; 
     } 
 
     r e t u r n   {   i n i t ,   u p d a t e P a r a m s   } ; 
 } ) ( ) ; 
  
 