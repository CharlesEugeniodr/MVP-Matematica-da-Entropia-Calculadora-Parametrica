/**
 * model.js — ODE Engine for the Mathematics of Structural Entropy
 * 
 * Implements the complete dynamical system:
 *   dN/dt  = r_N·N·(1 - N/K_eff) - μ_N·N·max(0, λ - λ_crit)
 *   K_eff  = K0·exp(-η5·D - η6·ΔT)·(1 - ω·U)·(1 + φ·T·G)
 *   dD/dt  = α1·C + α2·U + α3·P - β_D·T·G·D
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
    DeltaT_max: 5.0   // normalization ceiling for ΔT
  };

  /**
   * Linearly interpolate exogenous variable at time t
   * from an array of {t, v} waypoints.
   */
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

  /**
   * Clamp value to [lo, hi].
   */
  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  /**
   * Compute effective carrying capacity K_eff.
   * K_eff = K0 · exp(-η5·D - η6·ΔT) · (1 - ω·U) · (1 + φ·T·G)
   */
  function computeKeff(p, D, deltaT, U, T, G) {
    const envFactor   = Math.exp(-p.eta5 * D - p.eta6 * deltaT);
    const landFactor  = Math.max(0, 1 - p.omega * U);
    const techFactor  = 1 + p.phi * T * G;
    return p.K0 * envFactor * landFactor * techFactor;
  }

  /**
   * Compute structural entropic pressure λ.
   * λ = w1·(N/K_eff) + w2·D + w3·ΔT_norm + w4·U + w5·I - w6·T·G - w7·R
   */
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

  /**
   * Compute derivatives [dN/dt, dD/dt, dR/dt].
   * @param {Object} p   Parameters
   * @param {number} N   Population
   * @param {number} D   Degradation
   * @param {number} R   Resilience
   * @param {Object} exo Exogenous values {deltaT, U, T, G, I, C, P}
   * @returns {number[]} [dN, dD, dR]
   */
  function derivatives(p, N, D, R, exo) {
    const Keff   = computeKeff(p, D, exo.deltaT, exo.U, exo.T, exo.G);
    const lambda = computeLambda(p, N, Keff, D, exo.deltaT, exo.U, exo.I, exo.T, exo.G, R);

    // dN/dt = r_N·N·(1 - N/K_eff) - μ_N·N·max(0, λ - λ_crit)
    const dN = p.r_N * N * (1 - N / Math.max(Keff, 1))
             - p.mu_N * N * Math.max(0, lambda - p.lambda_crit);

    // dD/dt = α1·C + α2·U + α3·P - β_D·T·G·D
    const dD = p.alpha1 * exo.C + p.alpha2 * exo.U + p.alpha3 * exo.P
             - p.beta_D * exo.T * exo.G * D;

    // dR/dt = ρ_G·G·(1-R) - ρ_D·D·R - ρ_λ·λ·R
    const dR = p.rho_G * exo.G * (1 - R)
             - p.rho_D * D * R
             - p.rho_lambda * lambda * R;

    return [dN, dD, dR];
  }

  /**
   * 4th-order Runge-Kutta integrator step.
   */
  function rk4Step(p, N, D, R, exo, dt) {
    const [k1n, k1d, k1r] = derivatives(p, N, D, R, exo);

    const N2 = Math.max(0, N + 0.5 * dt * k1n);
    const D2 = clamp(D + 0.5 * dt * k1d, 0, 1);
    const R2 = clamp(R + 0.5 * dt * k1r, 0, 1);
    const [k2n, k2d, k2r] = derivatives(p, N2, D2, R2, exo);

    const N3 = Math.max(0, N + 0.5 * dt * k2n);
    const D3 = clamp(D + 0.5 * dt * k2d, 0, 1);
    const R3 = clamp(R + 0.5 * dt * k2r, 0, 1);
    const [k3n, k3d, k3r] = derivatives(p, N3, D3, R3, exo);

    const N4 = Math.max(0, N + dt * k3n);
    const D4 = clamp(D + dt * k3d, 0, 1);
    const R4 = clamp(R + dt * k3r, 0, 1);
    const [k4n, k4d, k4r] = derivatives(p, N4, D4, R4, exo);

    const newN = Math.max(0, N + (dt / 6) * (k1n + 2*k2n + 2*k3n + k4n));
    const newD = clamp(D + (dt / 6) * (k1d + 2*k2d + 2*k3d + k4d), 0, 1);
    const newR = clamp(R + (dt / 6) * (k1r + 2*k2r + 2*k3r + k4r), 0, 1);

    return [newN, newD, newR];
  }

  /**
   * Run the full simulation.
   * 
   * @param {Object} params    Model parameters (merged with defaults)
   * @param {Object} scenario  Scenario with exogenous waypoints
   * @returns {Object}         Simulation results
   */
  function simulate(params, scenario) {
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const dt = p.dt;
    const steps = Math.ceil((p.t_end - p.t_start) / dt);

    // Result arrays
    const time    = new Float64Array(steps + 1);
    const N_arr   = new Float64Array(steps + 1);
    const Keff_arr = new Float64Array(steps + 1);
    const D_arr   = new Float64Array(steps + 1);
    const R_arr   = new Float64Array(steps + 1);
    const lambda_arr = new Float64Array(steps + 1);
    // Exogenous traces
    const deltaT_arr = new Float64Array(steps + 1);
    const U_arr   = new Float64Array(steps + 1);
    const T_arr   = new Float64Array(steps + 1);
    const G_arr   = new Float64Array(steps + 1);
    const I_arr   = new Float64Array(steps + 1);
    const C_arr   = new Float64Array(steps + 1);
    const P_arr   = new Float64Array(steps + 1);

    // Initial conditions
    let N = p.N0;
    let D = p.D0;
    let R = p.R0;

    // Critical event tracking
    let tau1 = null;        // first overshoot t
    let tau2 = null;        // persistent instability t
    let recoveryTime = null;
    let fragmentationTime = null;
    let lambdaAboveCount = 0;   // consecutive steps above λ_crit
    let lambdaBelowCount = 0;   // consecutive steps below λ_crit
    let tau2Detected = false;
    let recovered = false;

    for (let i = 0; i <= steps; i++) {
      const t = p.t_start + i * dt;
      time[i] = t;

      // Interpolate exogenous variables
      const exo = {
        deltaT: lerp(scenario.deltaT, t),
        U:      lerp(scenario.U, t),
        T:      lerp(scenario.T, t),
        G:      lerp(scenario.G, t),
        I:      lerp(scenario.I, t),
        C:      lerp(scenario.C, t),
        P:      lerp(scenario.P, t)
      };

      const Keff   = computeKeff(p, D, exo.deltaT, exo.U, exo.T, exo.G);
      const lambda = computeLambda(p, N, Keff, D, exo.deltaT, exo.U, exo.I, exo.T, exo.G, R);

      // Store current state
      N_arr[i]      = N;
      Keff_arr[i]   = Keff;
      D_arr[i]      = D;
      R_arr[i]      = R;
      lambda_arr[i] = lambda;
      deltaT_arr[i] = exo.deltaT;
      U_arr[i]      = exo.U;
      T_arr[i]      = exo.T;
      G_arr[i]      = exo.G;
      I_arr[i]      = exo.I;
      C_arr[i]      = exo.C;
      P_arr[i]      = exo.P;

      // ── Critical event detection ─────────────────────────────

      // τ1: First overshoot N >= K_eff
      if (tau1 === null && N >= Keff && Keff > 0) {
        tau1 = t;
      }

      // τ2: Persistent instability (λ >= λ_crit for τ_p consecutive years)
      if (lambda >= p.lambda_crit) {
        lambdaAboveCount += dt;
        lambdaBelowCount = 0;
        if (!tau2Detected && lambdaAboveCount >= p.tau_p) {
          tau2 = t;
          tau2Detected = true;
        }
      } else {
        lambdaAboveCount = 0;
        lambdaBelowCount += dt;
        // Recovery: λ < λ_crit for τ_r consecutive years (after τ2)
        if (tau2Detected && !recovered && lambdaBelowCount >= p.tau_r) {
          recoveryTime = t;
          recovered = true;
        }
      }

      // Fragmentation: R < R_min AND G < G_min
      if (fragmentationTime === null && R < p.R_min && exo.G < p.G_min) {
        fragmentationTime = t;
      }

      // ── Integrate forward (skip last step) ──────────────────
      if (i < steps) {
        const [newN, newD, newR] = rk4Step(p, N, D, R, exo, dt);
        N = newN;
        D = newD;
        R = newR;
      }
    }

    return {
      time,
      N:      N_arr,
      Keff:   Keff_arr,
      D:      D_arr,
      R:      R_arr,
      lambda: lambda_arr,
      deltaT: deltaT_arr,
      U:      U_arr,
      T:      T_arr,
      G:      G_arr,
      I:      I_arr,
      C:      C_arr,
      P:      P_arr,
      events: {
        tau1,
        tau2,
        recoveryTime,
        fragmentationTime
      },
      params: p,
      length: steps + 1
    };
  }

  /**
   * Export simulation results as CSV string.
   */
  function toCSV(results) {
    const headers = [
      'Ano', 'N (Pop)', 'K_eff', 'D (Degradação)', 'R (Resiliência)',
      'λ (Pressão)', 'ΔT (°C)', 'U (Uso do Solo)', 'T (Tecnologia)',
      'G (Governança)', 'I (Desigualdade)', 'C (Emissões)', 'P (Poluição)'
    ];
    const lines = [headers.join(',')];

    // Sample at integer years for manageable CSV
    for (let i = 0; i < results.length; i++) {
      const t = results.time[i];
      if (Math.abs(t - Math.round(t)) < 0.01) {
        lines.push([
          t.toFixed(0),
          results.N[i].toFixed(0),
          results.Keff[i].toFixed(0),
          results.D[i].toFixed(6),
          results.R[i].toFixed(6),
          results.lambda[i].toFixed(6),
          results.deltaT[i].toFixed(4),
          results.U[i].toFixed(4),
          results.T[i].toFixed(4),
          results.G[i].toFixed(4),
          results.I[i].toFixed(4),
          results.C[i].toFixed(4),
          results.P[i].toFixed(4)
        ].join(','));
      }
    }
    return lines.join('\n');
  }

  // Public API
  return {
    DEFAULT_PARAMS,
    simulate,
    toCSV,
    lerp,
    clamp,
    computeKeff,
    computeLambda
  };

})();
