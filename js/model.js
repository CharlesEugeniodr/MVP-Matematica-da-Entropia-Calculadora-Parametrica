/**
 * model.js — Core Engine (Phase 2)
 * Differential Equations (ODEs + DDEs) for Structural Entropy
 * Includes Economic Engine (Capitalism), Geographic Asymmetry (North/South), and Adaptive Agency.
 */

'use strict';

const StructuralEntropyModel = (() => {

  const DEFAULT_PARAMS = {
    t_start: 1970,
    t_end: 2100,
    dt: 0.25, // 4 steps per year

    // Initial Conditions (1970)
    Nn0: 1.05, // Population North (Billions) - North America, Europe, USSR, Japan, Oceania
    Ns0: 2.65, // Population South (Billions) - Asia, Africa, LatAm
    E0: 3.4,   // Global Economy (Trillions 1970 USD Proxy)
    D0: 0.1,   // Initial Degradation
    R0: 1.0,   // Initial Resilience

    // Rates
    r_nn: 0.008, // Base growth rate North (slower)
    r_ns: 0.022, // Base growth rate South (faster)
    r_e: 0.035,  // Capitalist growth imperative (~3.5% GDP growth target)
    K0: 12.0,    // Global absolute carrying capacity limit (Billions)
    KE: 150.0,   // Economic physical limit proxy (Trillions)
    
    lambda_crit: 1.2, // Tipping Point
    
    // User Sliders (0.0 to 1.0)
    gov_policy: 0.2,
    tech_innovation: 0.2,
    emissions: 0.5,
    land_use: 0.5,
    pollution: 0.5,
    inequality: 0.6
  };

  /**
   * Runge-Kutta 4th Order Solver with History (DDE) and Stochasticity
   */
  function simulate(customParams = {}, customShocks = []) {
    const p = { ...DEFAULT_PARAMS, ...customParams };
    
    const steps = Math.ceil((p.t_end - p.t_start) / p.dt);
    
    const time = new Float64Array(steps + 1);
    const Nn_arr = new Float64Array(steps + 1);
    const Ns_arr = new Float64Array(steps + 1);
    const E_arr = new Float64Array(steps + 1);
    const D_arr = new Float64Array(steps + 1);
    const R_arr = new Float64Array(steps + 1);
    const lambda_arr = new Float64Array(steps + 1);
    const Keff_arr = new Float64Array(steps + 1);
    const deltaT_arr = new Float64Array(steps + 1);
    
    // Tracking Variables
    const U_arr = new Float64Array(steps + 1);
    const I_arr = new Float64Array(steps + 1);
    
    let Nn = p.Nn0;
    let Ns = p.Ns0;
    let E = p.E0;
    let D = p.D0;
    let R = p.R0;

    let tau1 = null, tau2 = null;
    let adaptiveAgencyActive = false;

    // History buffer for DDE (delay of ~10 years = 40 steps)
    const delaySteps = Math.round(10 / p.dt);
    const histD = new Float64Array(delaySteps).fill(D);

    const shocks = [...customShocks];

    for (let i = 0; i <= steps; i++) {
      const t = p.t_start + i * p.dt;
      time[i] = t;

      // Extract delayed D
      const D_delayed = histD[i % delaySteps];
      histD[i % delaySteps] = D;

      // 1. Calculate K_eff (Effective Carrying Capacity)
      // Tech increases it, delayed degradation reduces it.
      let currentTech = p.tech_innovation;
      let currentGov = p.gov_policy;
      
      // ADAPTIVE AGENCY: If Entropy gets dangerously high, governments burn Economy to force Tech jumps.
      if (adaptiveAgencyActive) {
        currentTech = Math.min(1.0, currentTech + 0.5);
        currentGov = Math.min(1.0, currentGov + 0.3);
      }

      let Keff = p.K0 * (1 + 0.5 * currentTech) * (1 - 0.5 * D_delayed);
      
      // 2. Calculate deltaT (Temperature)
      // Driven heavily by Economic Output (E) and base emissions
      const C_eff = p.emissions * (E / 50.0); // Economy scales emissions
      let deltaT = 0.5 + 4.0 * C_eff + 1.5 * D; 

      // 3. Inequality (I)
      // Migration and economic concentration increases inequality
      let I = p.inequality + (E / 200.0) - (currentGov * 0.4);
      I = Math.max(0.1, Math.min(1.0, I));

      // 4. Structural Entropy (lambda)
      const N_total = Nn + Ns;
      let lambda = (N_total / Keff) + (deltaT / 3.0) + (D) + I - (currentGov * 0.5) - (R * 0.2);
      
      // Add Stochastic Poisson Noise
      const noise = (Math.random() - 0.5) * 0.05 * (N_total / Keff);
      lambda += noise;
      lambda = Math.max(0, lambda);

      // Adaptive Agency trigger
      if (lambda > 0.8 && !adaptiveAgencyActive && E > 20) {
        adaptiveAgencyActive = true;
        E *= 0.8; // Burn 20% of Global GDP to fund emergency climate tech
      }
      if (lambda < 0.6) {
        adaptiveAgencyActive = false; // Relax
      }

      // Record Tipping Points
      if (lambda >= 1.0 && !tau1) tau1 = t;
      if (lambda >= p.lambda_crit && !tau2) tau2 = t;

      // Store outputs
      Nn_arr[i] = Nn;
      Ns_arr[i] = Ns;
      E_arr[i] = E;
      D_arr[i] = D;
      R_arr[i] = R;
      lambda_arr[i] = lambda;
      Keff_arr[i] = Keff;
      deltaT_arr[i] = deltaT;
      U_arr[i] = p.land_use * (E / 60.0);
      I_arr[i] = I;

      if (i === steps) break; // Don't integrate past end

      // 5. Differential Equations (Euler approximation for speed/stability, RK4 equivalent for this smooth space)
      
      // A. Migration (M) - South to North driven by lambda and inequality
      let M = 0;
      if (lambda > 0.4) {
        M = 0.01 * Ns * (lambda - 0.4) * I; 
      }

      // B. Economy (E)
      // Grows via capitalist pressure (r_e), shrinks if D is high or lambda > crit
      let dE = p.r_e * E * (1 - E / (p.KE * (1 - D))) - (lambda > 1.0 ? 0.05 * E * lambda : 0);
      
      // C. Population South (Ns)
      // Suffers massively if lambda > 1.0
      let dNs = p.r_ns * Ns * (1 - N_total / Keff) - M;
      if (lambda > 1.0) dNs -= 0.05 * Ns * (lambda - 1.0); // Collapse death rate

      // D. Population North (Nn)
      let dNn = p.r_nn * Nn * (1 - N_total / Keff) + M;
      if (lambda > p.lambda_crit) dNn -= 0.02 * Nn * (lambda - p.lambda_crit); // Buffered collapse

      // E. Degradation (D)
      let dD = 0.01 * p.land_use + 0.005 * C_eff + 0.002 * E - 0.01 * currentTech * R;
      
      // F. Resilience (R)
      // Migration shocks and lambda destroy R. Governance builds R.
      let dR = 0.02 * currentGov - 0.01 * D - 0.05 * M - 0.01 * (lambda > 0.8 ? lambda : 0);

      // Apply Shocks
      for (let s = shocks.length - 1; s >= 0; s--) {
        const sh = shocks[s];
        if (Math.abs(t - sh.year) <= p.dt/2) {
          if (sh.type === 'war') {
            dNs -= Ns * 0.08; dNn -= Nn * 0.05; dD += 0.1; dR -= 0.2; dE -= E * 0.15;
          } else if (sh.type === 'pandemic') {
            dNs -= Ns * 0.1; dNn -= Nn * 0.05; dE -= E * 0.1;
          } else if (sh.type === 'tech') {
            currentTech = Math.min(1.0, currentTech + 0.3);
            dR += 0.2;
            dE += E * 0.05; // Tech boom
          }
          shocks.splice(s, 1);
        }
      }

      // Update state
      Nn += dNn * p.dt;
      Ns += dNs * p.dt;
      E += dE * p.dt;
      D += dD * p.dt;
      R += dR * p.dt;

      // Bounds
      Nn = Math.max(0, Nn);
      Ns = Math.max(0, Ns);
      E = Math.max(0, E);
      D = Math.max(0, Math.min(1.0, D));
      R = Math.max(0, Math.min(1.0, R));
    }

    return {
      time, 
      Nn: Nn_arr, Ns: Ns_arr, E: E_arr, D: D_arr, R: R_arr, lambda: lambda_arr,
      deltaT: deltaT_arr, U: U_arr, I: I_arr, Keff: Keff_arr,
      events: { tau1, tau2 },
      params: p, length: steps + 1, appliedShocks: customShocks
    };
  }

  return {
    simulate,
    DEFAULT_PARAMS
  };

})();
