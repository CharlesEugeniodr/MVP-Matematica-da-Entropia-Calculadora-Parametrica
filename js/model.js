/**
 * model.js — ODE Engine for the Mathematics of Structural Entropy
 * 
 * Implements the complete dynamical system:
 *   dN/dt  = r_N_dyn·N·(1 - N/K_eff) - μ_N·N·max(0, λ - λ_crit)
 *   K_eff  = K0·exp(-η5·D_delayed - η6·ΔT)·(1 - ω·U)·(1 + φ·T·G)
 *   dD/dt  = α1·C + α2·U + α3·P - β_D·T·G·D + TippingPoint(D, ΔT)
 *   dR/dt  = ρ_G·G·(1-R) - ρ_D·D·R - ρ_λ·λ·R
 *   λ      = w1·(N/K_eff) + w2·D + w3·ΔT_norm + w4·U + w5·I - w6·T·G - w7·R
 * 
 * Uses 4th-order Runge-Kutta with dt=0.25 (quarter-year steps).
 */

'use strict';

const StructuralEntropyModel = (() => {

  // ── Default parameters ──────────────────────────────────────────────
  const DEFAULT_PARAMS = {
    r_N:      0.015,
    mu_N:     0.01,
    K0:       12e9,
    N0:       3.7e9,
    eta5:     1.5,
    eta6:     0.08,
    omega:    0.5,
    phi:      2.0,
    alpha1:   0.003,
    alpha2:   0.002,
    alpha3:   0.001,
    beta_D:   0.05,
    rho_G:    0.03,
    rho_D:    0.04,
    rho_lambda: 0.02,
    w1:       0.25,
    w2:       0.15,
    w3:       0.15,
    w4:       0.10,
    w5:       0.10,
    w6:       0.15,
    w7:       0.10,
    lambda_crit: 1.0,
    tau_p:    10,
    tau_r:    15,
    R_min:    0.2,
    G_min:    0.2,
    D0:       0.15,
    R0:       0.70,
    t_start:  1970,
    t_end:    2100,
    dt:       0.25,
    DeltaT_max: 5.0,
    delay_years: 10,   // Delay in ecological feedback
    tipping_rate: 0.05 // Magnitude of nonlinear tipping point spike
  };

  function lerp(waypoints, t) {
    if (!waypoints || waypoints.length === 0) return 0;
    if (t <= waypoints[0].t) return waypoints[0].v;
    if (t >= waypoints[waypoints.length - 1].t) return waypoints[waypoints.length - 1].v;
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (t >= waypoints[i].t && t <= waypoints[i + 1].t) {
        const frac = (t - waypoints[i].t) / (waypoints[i + 1].t - waypoints[i].t);
        return waypoints[i].v + frac * (waypoints[i + 1].v - waypoints[i].v);
      }
    }
    return waypoints[waypoints.length - 1].v;
  }

  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  function getDelayedD(history, t, delay_years, dt) {
    const targetT = t - delay_years;
    if (targetT <= history.t_start) return history.D[0];
    const idx = Math.floor((targetT - history.t_start) / dt);
    return history.D[idx] !== undefined ? history.D[idx] : history.D[history.D.length-1];
  }

  function computeKeff(p, D_delayed, deltaT, U, T, G) {
    const envFactor   = Math.exp(-p.eta5 * D_delayed - p.eta6 * deltaT);
    const landFactor  = Math.max(0, 1 - p.omega * U);
    const techFactor  = 1 + p.phi * T * G;
    return p.K0 * envFactor * landFactor * techFactor;
  }

  function computeLambda(p, N, Keff, D, deltaT, U, I, T, G, R) {
    const deltaTNorm = clamp(deltaT / p.DeltaT_max, 0, 1);
    return p.w1 * (N / Math.max(Keff, 1))
         + p.w2 * D
         + p.w3 * deltaTNorm
         + p.w4 * U
         + p.w5 * I
         - p.w6 * T * G
         - p.w7 * R;
  }

  function derivatives(p, N, D, R, exo, t, history) {
    // DDE: use historical Degradation for capacity limits
    const D_delayed = getDelayedD(history, t, p.delay_years, p.dt);
    
    const Keff   = computeKeff(p, D_delayed, exo.deltaT, exo.U, exo.T, exo.G);
    const lambda = computeLambda(p, N, Keff, D, exo.deltaT, exo.U, exo.I, exo.T, exo.G, R);

    // Endogenous Demographics: Birth rate drops as Tech/Entropy increases, death rate spikes in collapse
    const techDrop = clamp(1 - 0.7 * exo.T, 0.1, 1.0);
    const r_N_dyn = p.r_N * techDrop;
    const collapseMortality = p.mu_N * N * Math.max(0, lambda - p.lambda_crit) * (1.5 - exo.G);

    const dN = r_N_dyn * N * (1 - N / Math.max(Keff, 1)) - collapseMortality;

    // Ecological Tipping Point (Sigmoid spike if D > 0.6 or ΔT > 2.5)
    const tippingD = p.tipping_rate / (1 + Math.exp(-15 * (D - 0.6)));
    const tippingT = p.tipping_rate / (1 + Math.exp(-5 * (exo.deltaT - 2.5)));

    const dD = p.alpha1 * exo.C + p.alpha2 * exo.U + p.alpha3 * exo.P
             - p.beta_D * exo.T * exo.G * D
             + tippingD + tippingT;

    const dR = p.rho_G * exo.G * (1 - R)
             - p.rho_D * D * R
             - p.rho_lambda * lambda * R;

    return [dN, dD, dR];
  }

  function rk4Step(p, N, D, R, exo, t, history) {
    const dt = p.dt;
    const [k1n, k1d, k1r] = derivatives(p, N, D, R, exo, t, history);

    const N2 = Math.max(0, N + 0.5 * dt * k1n);
    const D2 = clamp(D + 0.5 * dt * k1d, 0, 1);
    const R2 = clamp(R + 0.5 * dt * k1r, 0, 1);
    const [k2n, k2d, k2r] = derivatives(p, N2, D2, R2, exo, t + 0.5*dt, history);

    const N3 = Math.max(0, N + 0.5 * dt * k2n);
    const D3 = clamp(D + 0.5 * dt * k2d, 0, 1);
    const R3 = clamp(R + 0.5 * dt * k2r, 0, 1);
    const [k3n, k3d, k3r] = derivatives(p, N3, D3, R3, exo, t + 0.5*dt, history);

    const N4 = Math.max(0, N + dt * k3n);
    const D4 = clamp(D + dt * k3d, 0, 1);
    const R4 = clamp(R + dt * k3r, 0, 1);
    const [k4n, k4d, k4r] = derivatives(p, N4, D4, R4, exo, t + dt, history);

    const newN = Math.max(0, N + (dt / 6) * (k1n + 2*k2n + 2*k3n + k4n));
    const newD = clamp(D + (dt / 6) * (k1d + 2*k2d + 2*k3d + k4d), 0, 1);
    const newR = clamp(R + (dt / 6) * (k1r + 2*k2r + 2*k3r + k4r), 0, 1);

    return [newN, newD, newR];
  }

  // Generate random poisson noise
  function getPoissonNoise(intensity) {
    return (Math.random() - 0.5) * intensity;
  }

  function simulate(params, scenario, regulators = {gov: 0, deg: 0}, shocks = []) {
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const dt = p.dt;
    const steps = Math.ceil((p.t_end - p.t_start) / dt);

    const time    = new Float64Array(steps + 1);
    const N_arr   = new Float64Array(steps + 1);
    const Keff_arr = new Float64Array(steps + 1);
    const D_arr   = new Float64Array(steps + 1);
    const R_arr   = new Float64Array(steps + 1);
    const lambda_arr = new Float64Array(steps + 1);
    const deltaT_arr = new Float64Array(steps + 1);
    const U_arr   = new Float64Array(steps + 1);
    const T_arr   = new Float64Array(steps + 1);
    const G_arr   = new Float64Array(steps + 1);
    const I_arr   = new Float64Array(steps + 1);
    const C_arr   = new Float64Array(steps + 1);
    const P_arr   = new Float64Array(steps + 1);

    const history = { t_start: p.t_start, D: D_arr };

    let N = p.N0;
    let D = p.D0;
    let R = p.R0;

    let tau1 = null, tau2 = null, recoveryTime = null, fragmentationTime = null;
    let lambdaAboveCount = 0, lambdaBelowCount = 0;
    let tau2Detected = false, recovered = false;

    // Process manual shocks
    let activeShocks = [...shocks];

    for (let i = 0; i <= steps; i++) {
      const t = p.t_start + i * dt;
      time[i] = t;

      // Base Exogenous
      let baseG = lerp(scenario.G, t);
      let baseD_exo = lerp(scenario.C, t); // proxy for degradation inputs
      let baseT = lerp(scenario.T, t);
      
      // Apply Manual Regulators (Gov/Resilience vs Degradation)
      baseG = clamp(baseG + (regulators.gov / 100), 0, 1);
      const regDeg = regulators.deg / 100;

      const exo = {
        deltaT: lerp(scenario.deltaT, t),
        U:      lerp(scenario.U, t),
        T:      baseT,
        G:      baseG,
        I:      lerp(scenario.I, t),
        C:      clamp(baseD_exo + regDeg, 0, 1),
        P:      clamp(lerp(scenario.P, t) + regDeg, 0, 1)
      };

      // Check and apply Shocks
      for (let s = activeShocks.length - 1; s >= 0; s--) {
        const shock = activeShocks[s];
        if (t >= shock.year && t < shock.year + dt) {
          if (shock.type === 'pandemic') {
            N *= 0.95; // 5% pop drop
            exo.G = clamp(exo.G - 0.2, 0, 1);
            exo.I = clamp(exo.I + 0.1, 0, 1);
          } else if (shock.type === 'war') {
            N *= 0.90;
            R *= 0.7; // Destroy resilience
            exo.G = clamp(exo.G - 0.4, 0, 1);
            exo.C = clamp(exo.C + 0.3, 0, 1); // Emissions spike
          } else if (shock.type === 'tech') {
            exo.T = clamp(exo.T + 0.4, 1);
            exo.C = clamp(exo.C - 0.2, 0, 1); // Green tech
          }
          activeShocks.splice(s, 1); // consumed
        }
      }

      // Add Chaos (Stochastic Noise)
      if (t > 1980) {
        exo.G = clamp(exo.G + getPoissonNoise(0.02), 0, 1);
        exo.T = clamp(exo.T + getPoissonNoise(0.01), 0, 1);
      }

      const D_delayed = getDelayedD(history, t, p.delay_years, dt);
      const Keff   = computeKeff(p, D_delayed, exo.deltaT, exo.U, exo.T, exo.G);
      const lambda = computeLambda(p, N, Keff, D, exo.deltaT, exo.U, exo.I, exo.T, exo.G, R);

      N_arr[i] = N; Keff_arr[i] = Keff; D_arr[i] = D; R_arr[i] = R; lambda_arr[i] = lambda;
      deltaT_arr[i] = exo.deltaT; U_arr[i] = exo.U; T_arr[i] = exo.T; G_arr[i] = exo.G;
      I_arr[i] = exo.I; C_arr[i] = exo.C; P_arr[i] = exo.P;

      // Critical event detection
      if (tau1 === null && N >= Keff && Keff > 0) tau1 = t;
      if (lambda >= p.lambda_crit) {
        lambdaAboveCount += dt; lambdaBelowCount = 0;
        if (!tau2Detected && lambdaAboveCount >= p.tau_p) { tau2 = t; tau2Detected = true; }
      } else {
        lambdaAboveCount = 0; lambdaBelowCount += dt;
        if (tau2Detected && !recovered && lambdaBelowCount >= p.tau_r) { recoveryTime = t; recovered = true; }
      }
      if (fragmentationTime === null && R < p.R_min && exo.G < p.G_min) fragmentationTime = t;

      if (i < steps) {
        const [newN, newD, newR] = rk4Step(p, N, D, R, exo, t, history);
        N = newN; D = newD; R = newR;
      }
    }

    return {
      time, N: N_arr, Keff: Keff_arr, D: D_arr, R: R_arr, lambda: lambda_arr,
      deltaT: deltaT_arr, U: U_arr, T: T_arr, G: G_arr, I: I_arr, C: C_arr, P: P_arr,
      events: { tau1, tau2, recoveryTime, fragmentationTime },
      params: p, length: steps + 1, appliedShocks: shocks
    };
  }

  function toCSV(results) {
    const headers = [
      'Ano', 'N (Pop)', 'K_eff', 'D (Degradação)', 'R (Resiliência)',
      'λ (Pressão)', 'ΔT (°C)', 'U (Uso do Solo)', 'T (Tecnologia)',
      'G (Governança)', 'I (Desigualdade)', 'C (Emissões)', 'P (Poluição)'
    ];
    const lines = [headers.join(',')];

    for (let i = 0; i < results.length; i++) {
      const t = results.time[i];
      if (Math.abs(t - Math.round(t)) < 0.01) {
        lines.push([
          t.toFixed(0), results.N[i].toFixed(0), results.Keff[i].toFixed(0),
          results.D[i].toFixed(6), results.R[i].toFixed(6), results.lambda[i].toFixed(6),
          results.deltaT[i].toFixed(4), results.U[i].toFixed(4), results.T[i].toFixed(4),
          results.G[i].toFixed(4), results.I[i].toFixed(4), results.C[i].toFixed(4), results.P[i].toFixed(4)
        ].join(','));
      }
    }
    return lines.join('\n');
  }

  return { DEFAULT_PARAMS, simulate, toCSV, lerp, clamp, computeKeff, computeLambda };

})();
