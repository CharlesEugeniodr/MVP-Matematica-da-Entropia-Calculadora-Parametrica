/**
 * scenarios.js — 5 Scenario Definitions
 * 
 * Each scenario defines piecewise-linear trajectories for 7 exogenous variables:
 *   ΔT(t), U(t), T(t), G(t), I(t), C(t), P(t)
 * 
 * Format: arrays of {t: year, v: value} waypoints.
 * The model engine interpolates linearly between waypoints.
 */

'use strict';

const Scenarios = (() => {

  // ── S1: Sustentável ─────────────────────────────────────────────────
  const S1 = {
    id:    'S1',
    name:  'Otimista (Transformação)',
    color: '#10b981',
    icon:  '🌿',
    description: 'Transição rápida para energias limpas, governança forte, tecnologia verde e redução da desigualdade.',
    overrides: { r_N: 0.002, eta5: 0.3, phi: 1.5, rho_G: 0.05, rho_D: 0.05 },
    deltaT: [
      { t: 1970, v: 0.0 },
      { t: 1990, v: 0.3 },
      { t: 2010, v: 0.6 },
      { t: 2030, v: 0.9 },
      { t: 2050, v: 1.2 },
      { t: 2100, v: 1.5 }
    ],
    U: [
      { t: 1970, v: 0.25 },
      { t: 1990, v: 0.32 },
      { t: 2010, v: 0.35 },
      { t: 2030, v: 0.33 },
      { t: 2060, v: 0.31 },
      { t: 2100, v: 0.30 }
    ],
    T: [
      { t: 1970, v: 0.15 },
      { t: 1990, v: 0.25 },
      { t: 2010, v: 0.40 },
      { t: 2030, v: 0.60 },
      { t: 2060, v: 0.75 },
      { t: 2100, v: 0.85 }
    ],
    G: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.35 },
      { t: 2010, v: 0.45 },
      { t: 2030, v: 0.60 },
      { t: 2060, v: 0.72 },
      { t: 2100, v: 0.80 }
    ],
    I: [
      { t: 1970, v: 0.40 },
      { t: 1990, v: 0.38 },
      { t: 2010, v: 0.35 },
      { t: 2030, v: 0.30 },
      { t: 2060, v: 0.25 },
      { t: 2100, v: 0.20 }
    ],
    C: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.45 },
      { t: 2010, v: 0.50 },
      { t: 2030, v: 0.35 },
      { t: 2060, v: 0.15 },
      { t: 2100, v: 0.05 }
    ],
    P: [
      { t: 1970, v: 0.25 },
      { t: 1990, v: 0.35 },
      { t: 2010, v: 0.40 },
      { t: 2030, v: 0.30 },
      { t: 2060, v: 0.18 },
      { t: 2100, v: 0.08 }
    ]
  };

  // ── S2: BAU (Business As Usual) ────────────────────────────────────
  const S2 = {
    id:    'S2',
    name:  'Moderado (Parcial)',
    color: '#f59e0b',
    icon:  '📊',
    description: 'Tendências atuais continuam: progresso tecnológico moderado, governança fraca, aquecimento de ~2.7°C.',
    overrides: { r_N: 0.008, eta5: 0.8, phi: 1.0, rho_G: 0.02, rho_D: 0.02 },
    deltaT: [
      { t: 1970, v: 0.0 },
      { t: 1990, v: 0.3 },
      { t: 2010, v: 0.7 },
      { t: 2030, v: 1.2 },
      { t: 2060, v: 2.0 },
      { t: 2100, v: 2.7 }
    ],
    U: [
      { t: 1970, v: 0.25 },
      { t: 1990, v: 0.33 },
      { t: 2010, v: 0.38 },
      { t: 2030, v: 0.43 },
      { t: 2060, v: 0.47 },
      { t: 2100, v: 0.50 }
    ],
    T: [
      { t: 1970, v: 0.15 },
      { t: 1990, v: 0.22 },
      { t: 2010, v: 0.30 },
      { t: 2030, v: 0.38 },
      { t: 2060, v: 0.44 },
      { t: 2100, v: 0.50 }
    ],
    G: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.33 },
      { t: 2010, v: 0.35 },
      { t: 2030, v: 0.37 },
      { t: 2060, v: 0.39 },
      { t: 2100, v: 0.40 }
    ],
    I: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.33 },
      { t: 2010, v: 0.36 },
      { t: 2030, v: 0.39 },
      { t: 2060, v: 0.42 },
      { t: 2100, v: 0.45 }
    ],
    C: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.50 },
      { t: 2010, v: 0.60 },
      { t: 2030, v: 0.65 },
      { t: 2060, v: 0.60 },
      { t: 2100, v: 0.55 }
    ],
    P: [
      { t: 1970, v: 0.25 },
      { t: 1990, v: 0.40 },
      { t: 2010, v: 0.50 },
      { t: 2030, v: 0.55 },
      { t: 2060, v: 0.52 },
      { t: 2100, v: 0.48 }
    ]
  };

  // ── S3: Degradação Alta ─────────────────────────────────────────────
  const S3 = {
    id:    'S3',
    name:  'Pessimista (BAU)',
    color: '#ef4444',
    icon:  '🔥',
    description: 'Inação climática, desmatamento acelerado, governança colapsante e desigualdade extrema.',
    overrides: { r_N: 0.012, eta5: 1.5, phi: 0.5, rho_G: 0.01, rho_D: 0.01 },
    deltaT: [
      { t: 1970, v: 0.0 },
      { t: 1990, v: 0.4 },
      { t: 2010, v: 0.9 },
      { t: 2030, v: 1.8 },
      { t: 2060, v: 3.0 },
      { t: 2100, v: 4.0 }
    ],
    U: [
      { t: 1970, v: 0.25 },
      { t: 1990, v: 0.35 },
      { t: 2010, v: 0.42 },
      { t: 2030, v: 0.52 },
      { t: 2060, v: 0.60 },
      { t: 2100, v: 0.65 }
    ],
    T: [
      { t: 1970, v: 0.15 },
      { t: 1990, v: 0.20 },
      { t: 2010, v: 0.24 },
      { t: 2030, v: 0.27 },
      { t: 2060, v: 0.29 },
      { t: 2100, v: 0.30 }
    ],
    G: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.28 },
      { t: 2010, v: 0.26 },
      { t: 2030, v: 0.24 },
      { t: 2060, v: 0.22 },
      { t: 2100, v: 0.20 }
    ],
    I: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.35 },
      { t: 2010, v: 0.42 },
      { t: 2030, v: 0.50 },
      { t: 2060, v: 0.56 },
      { t: 2100, v: 0.60 }
    ],
    C: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.55 },
      { t: 2010, v: 0.75 },
      { t: 2030, v: 0.90 },
      { t: 2060, v: 0.95 },
      { t: 2100, v: 0.90 }
    ],
    P: [
      { t: 1970, v: 0.25 },
      { t: 1990, v: 0.45 },
      { t: 2010, v: 0.60 },
      { t: 2030, v: 0.72 },
      { t: 2060, v: 0.78 },
      { t: 2100, v: 0.80 }
    ]
  };

  // ── S4: Tecnologia sem Governança ──────────────────────────────────
  const S4 = {
    id:    'S4',
    name:  'Tech sem Governança',
    color: '#8b5cf6',
    icon:  '⚡',
    description: 'Avanço tecnológico forte mas sem coordenação política. Desigualdade alta, governança mínima.',
    deltaT: [
      { t: 1970, v: 0.0 },
      { t: 1990, v: 0.35 },
      { t: 2010, v: 0.8 },
      { t: 2030, v: 1.5 },
      { t: 2060, v: 2.3 },
      { t: 2100, v: 3.0 }
    ],
    U: [
      { t: 1970, v: 0.25 },
      { t: 1990, v: 0.30 },
      { t: 2010, v: 0.34 },
      { t: 2030, v: 0.37 },
      { t: 2060, v: 0.39 },
      { t: 2100, v: 0.40 }
    ],
    T: [
      { t: 1970, v: 0.15 },
      { t: 1990, v: 0.28 },
      { t: 2010, v: 0.45 },
      { t: 2030, v: 0.60 },
      { t: 2060, v: 0.72 },
      { t: 2100, v: 0.80 }
    ],
    G: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.26 },
      { t: 2010, v: 0.22 },
      { t: 2030, v: 0.19 },
      { t: 2060, v: 0.17 },
      { t: 2100, v: 0.15 }
    ],
    I: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.36 },
      { t: 2010, v: 0.42 },
      { t: 2030, v: 0.48 },
      { t: 2060, v: 0.52 },
      { t: 2100, v: 0.55 }
    ],
    C: [
      { t: 1970, v: 0.30 },
      { t: 1990, v: 0.48 },
      { t: 2010, v: 0.58 },
      { t: 2030, v: 0.55 },
      { t: 2060, v: 0.45 },
      { t: 2100, v: 0.35 }
    ],
    P: [
      { t: 1970, v: 0.25 },
      { t: 1990, v: 0.38 },
      { t: 2010, v: 0.48 },
      { t: 2030, v: 0.50 },
      { t: 2060, v: 0.42 },
      { t: 2100, v: 0.35 }
    ]
  };

  // ── S5: Customizado ─────────────────────────────────────────────────
  // Starts as a copy of S2 (BAU) but all sliders enabled
  const S5 = {
    id:    'S5',
    name:  'Customizado',
    color: '#06b6d4',
    icon:  '🎛️',
    description: 'Crie seu próprio cenário ajustando todos os parâmetros e trajetórias.',
    deltaT: [
      { t: 1970, v: 0.0 },
      { t: 2000, v: 0.5 },
      { t: 2050, v: 1.8 },
      { t: 2100, v: 2.7 }
    ],
    U: [
      { t: 1970, v: 0.25 },
      { t: 2000, v: 0.35 },
      { t: 2050, v: 0.45 },
      { t: 2100, v: 0.50 }
    ],
    T: [
      { t: 1970, v: 0.15 },
      { t: 2000, v: 0.28 },
      { t: 2050, v: 0.42 },
      { t: 2100, v: 0.50 }
    ],
    G: [
      { t: 1970, v: 0.30 },
      { t: 2000, v: 0.34 },
      { t: 2050, v: 0.38 },
      { t: 2100, v: 0.40 }
    ],
    I: [
      { t: 1970, v: 0.30 },
      { t: 2000, v: 0.34 },
      { t: 2050, v: 0.40 },
      { t: 2100, v: 0.45 }
    ],
    C: [
      { t: 1970, v: 0.30 },
      { t: 2000, v: 0.52 },
      { t: 2050, v: 0.62 },
      { t: 2100, v: 0.55 }
    ],
    P: [
      { t: 1970, v: 0.25 },
      { t: 2000, v: 0.42 },
      { t: 2050, v: 0.52 },
      { t: 2100, v: 0.48 }
    ]
  };

  const ALL = [S1, S2, S3, S4, S5];

  /**
   * Get a deep copy of a scenario by ID.
   */
  function getById(id) {
    const s = ALL.find(sc => sc.id === id);
    if (!s) return null;
    return deepCopy(s);
  }

  /**
   * Deep copy a scenario object.
   */
  function deepCopy(scenario) {
    return JSON.parse(JSON.stringify(scenario));
  }

  /**
   * Build a custom scenario from slider endpoint values.
   * Takes 2100-endpoint values and creates smooth trajectories from 1970 baseline.
   */
  function buildCustom(endpoints) {
    const s = deepCopy(S5);
    const vars = ['deltaT', 'U', 'T', 'G', 'I', 'C', 'P'];
    vars.forEach(v => {
      if (endpoints[v] !== undefined) {
        const wp = s[v];
        // Keep 1970 anchor, adjust 2100 endpoint, interpolate middle points
        const v0 = wp[0].v;
        const vEnd = endpoints[v];
        for (let i = 1; i < wp.length; i++) {
          const frac = (wp[i].t - 1970) / (2100 - 1970);
          // Slight curve: quadratic ease
          const ease = frac * frac * 0.4 + frac * 0.6;
          wp[i].v = v0 + (vEnd - v0) * ease;
        }
      }
    });
    return s;
  }

  return {
    S1, S2, S3, S4, S5,
    ALL,
    getById,
    deepCopy,
    buildCustom
  };

})();
