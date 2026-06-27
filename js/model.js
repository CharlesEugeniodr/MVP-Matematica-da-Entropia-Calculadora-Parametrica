/**
 * model.js — Core Engine (Phase 2 + Phase 1 Rich Parameters)
 * Differential Equations (ODEs + DDEs) for Structural Entropy
 */

'use strict';

const StructuralEntropyModel = (() => {

  const DEFAULT_PARAMS = {
    t_start: 1970,
    t_end: 2100,
    dt: 0.25,

    // Dinâmica Populacional
    r_N: 0.018,    // Taxa base global (usada para calibrar Norte/Sul)
    mu_N: 0.012,   // Sensibilidade à entropia
    K0: 12e9,      // K absoluto base
    N0: 3.7e9,     // População global 1970

    // Capacidade de Suporte
    eta5: 1.5,     // Impacto degradação
    eta6: 0.15,    // Impacto aquecimento
    omega: 0.3,    // Uso do solo
    phi: 1.2,      // Boost Tech/Gov

    // Degradação Ambiental
    alpha1: 0.003, // Emissões -> D
    alpha2: 0.002, // Solo -> D
    alpha3: 0.001, // Poluição -> D
    beta_D: 0.05,  // Mitigação
    D0: 0.1,       // D 1970

    // Resiliência
    rho_G: 0.03,   // Gov constrói R
    rho_D: 0.01,   // D erode R
    rho_lambda: 0.02, // lambda erode R
    R0: 1.0,       // R 1970

    // Pesos da Entropia (lambda)
    w1: 0.25,      // Peso População
    w2: 0.20,      // Peso Degradação
    w3: 0.15,      // Peso DeltaT
    w4: 0.10,      // Peso Uso do Solo
    w5: 0.15,      // Peso Desigualdade
    w6: 0.05,      // Amortecedor Tech/Gov
    w7: 0.10,      // Amortecedor Resiliência

    // Limiares
    lambda_crit: 1.2,
    tau_p: 10,     // Anos de persistência no colapso
    tau_r: 15,     // Anos de recuperação
    R_min: 0.2,    
    G_min: 0.1,    

    // Macro-drivers (Injeções do slider do usuário)
    gov_policy: 0.5,
    tech_innovation: 0.5,
    emissions: 0.5,
    land_use: 0.5,
    pollution: 0.5,
    inequality: 0.5
  };

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
    
    const U_arr = new Float64Array(steps + 1);
    const I_arr = new Float64Array(steps + 1);
    
    // Distribuindo N0 entre Norte (28%) e Sul (72%) para simular 1970
    // Parâmetros K0 e N0 vêm em valores absolutos (ex: 12e9), mas a matemática usa bilhões (12.0)
    let Nn = (p.N0 / 1e9) * 0.28;
    let Ns = (p.N0 / 1e9) * 0.72;
    const K0_b = p.K0 / 1e9;
    
    let E = 3.4; // Trilhão USD Proxy
    let D = p.D0;
    let R = p.R0;

    let tau1 = null, tau2 = null;
    let collapseTimer = 0;

    const delaySteps = Math.round(10 / p.dt);
    const histD = new Float64Array(delaySteps).fill(D);
    const shocks = [...customShocks];

    for (let i = 0; i <= steps; i++) {
      const t = p.t_start + i * p.dt;
      time[i] = t;

      const D_delayed = histD[i % delaySteps];
      histD[i % delaySteps] = D;

      // Aplicar Shocks
      shocks.forEach(sh => {
        if (t >= sh.year && t < sh.year + p.dt) {
          if (sh.type === 'pandemic') {
            Nn *= (1 - sh.impact * 0.1); Ns *= (1 - sh.impact * 0.5); E *= (1 - sh.impact * 1.5);
            // Pandemic temporarily reduces degradation speed due to lockdowns
            D = Math.max(0, D - sh.impact * 0.05); 
          } else if (sh.type === 'war') {
            Nn *= (1 - sh.impact * 0.2); Ns *= (1 - sh.impact * 0.8); E *= (1 - sh.impact * 2); 
            D += sh.impact * 1.5; // War causes massive immediate degradation and pollution
            R = Math.max(0.1, R - sh.impact * 2.0); // Destroys resilience
          } else if (sh.type === 'tech') {
            R += sh.impact; 
            // Real eco-modernism: Tech reduces impact but may increase inequality slightly
            // We simulate the 'clean' tech shock by boosting Keff explicitly via R and lowering D
            D = Math.max(0, D - sh.impact * 0.5);
          }
        }
      });

      const currentTech = p.tech_innovation;
      const currentGov = Math.max(p.G_min, p.gov_policy);
      
      // K_eff
      const Keff = K0_b * (1 + p.phi * currentTech) * Math.exp(-p.eta5 * D_delayed);
      
      // Delta T
      const C_eff = p.emissions * (E / 50.0) * Math.exp(-1.5 * currentTech);
      let deltaT = 0.5 + 4.0 * C_eff + p.eta6 * D; 

      // Inequality
      let I = p.inequality + (E / 200.0) - (currentGov * 0.4);
      I = Math.max(0.1, Math.min(1.0, I));
      const U = p.omega * p.land_use * (E / 60.0) * Math.exp(-1.0 * currentTech);

      // Entropia (lambda) com pesos completos
      const N_total = Nn + Ns;
      let lambda = p.w1 * (N_total / Keff) 
                 + p.w2 * D 
                 + p.w3 * deltaT 
                 + p.w4 * U 
                 + p.w5 * I 
                 - p.w6 * (currentTech * currentGov) 
                 - p.w7 * R;

      const noise = (Math.random() - 0.5) * 0.02 * (N_total / Keff);
      lambda += noise;
      lambda = Math.max(0, lambda);

      if (lambda >= 1.0 && !tau1) tau1 = t;
      if (lambda >= p.lambda_crit && !tau2) tau2 = t;

      // Persistence of Collapse
      if (lambda >= p.lambda_crit) collapseTimer += p.dt;
      else if (collapseTimer > 0) collapseTimer -= p.dt * 0.5;

      Nn_arr[i] = Nn; Ns_arr[i] = Ns; E_arr[i] = E; D_arr[i] = D; R_arr[i] = R;
      lambda_arr[i] = lambda; Keff_arr[i] = Keff; deltaT_arr[i] = deltaT;
      U_arr[i] = U; I_arr[i] = I;

      if (i === steps) break;

      // ODEs
      let M = 0;
      if (lambda > 0.6) M = 0.015 * Ns * (lambda - 0.6) * I; 

      // Taxas base
      const r_n_base = p.r_N * 0.5;
      const r_s_base = p.r_N * 1.5;

      // Sensibilidade à entropia
      const collapsePenalty = (collapseTimer > p.tau_p) ? 0.05 : 0;
      const entropyPressure = p.mu_N * lambda;

      const r_n_eff = r_n_base * (1 - Nn / (Keff * 0.4)) - entropyPressure - collapsePenalty;
      const r_s_eff = r_s_base * (1 - Ns / (Keff * 0.6)) - (entropyPressure * 1.5) - collapsePenalty;

      const dNn = (r_n_eff * Nn) + M;
      const dNs = (r_s_eff * Ns) - M;

      const damage = (D * 0.5) + (Math.max(0, deltaT - 1.5) * 0.1) + (collapseTimer > 0 ? 0.05 : 0); 
      const dE = 0.035 * E * (1 - E / 150.0) - (damage * E);

      const dD = (p.alpha2 * U * E) + (p.alpha3 * p.pollution * N_total) + (p.alpha1 * C_eff) - (p.beta_D * R);
      
      const dR = (p.rho_G * currentGov) - (p.rho_D * D) - (p.rho_lambda * lambda);

      Nn = Math.max(0, Nn + dNn * p.dt);
      Ns = Math.max(0, Ns + dNs * p.dt);
      E  = Math.max(0.1, E + dE * p.dt);
      D  = Math.max(0, D + dD * p.dt);
      R  = Math.max(p.R_min, R + dR * p.dt);
    }

    return {
      time, 
      Nn: Nn_arr, Ns: Ns_arr, E: E_arr, D: D_arr, R: R_arr, lambda: lambda_arr,
      deltaT: deltaT_arr, U: U_arr, I: I_arr, Keff: Keff_arr,
      events: { tau1, tau2 },
      params: p, length: steps + 1, appliedShocks: customShocks
    };
  }

  return { DEFAULT_PARAMS, simulate };
})();
