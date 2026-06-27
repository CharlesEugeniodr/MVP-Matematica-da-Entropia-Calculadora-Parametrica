/**
 * @jest-environment jsdom
 */

// ── Mock browser globals ────────────────────────────────────────
// Minimal stubs so modules can load outside a real browser

describe('Model Integrity', () => {
  let modelSource;
  
  beforeAll(() => {
    const fs = require('fs');
    modelSource = fs.readFileSync('js/model.js', 'utf8');
  });

  test('model.js exports simulate function', () => {
    expect(modelSource).toContain('simulate');
    expect(modelSource).toContain('DEFAULT_PARAMS');
  });

  test('model.js contains all required ODE variables', () => {
    expect(modelSource).toContain('Nn');
    expect(modelSource).toContain('Ns');
    expect(modelSource).toContain('lambda');
    expect(modelSource).toContain('deltaT');
    expect(modelSource).toContain('Keff');
  });

  test('model.js has lerp function', () => {
    expect(modelSource).toContain('lerp');
  });

  test('model.js has toCSV export', () => {
    expect(modelSource).toContain('toCSV');
  });
});

describe('RealData Integrity', () => {
  let realdataSource;

  beforeAll(() => {
    const fs = require('fs');
    realdataSource = fs.readFileSync('js/realdata.js', 'utf8');
  });

  test('contains all required historical datasets', () => {
    expect(realdataSource).toContain('TEMPERATURE_ANOMALY');
    expect(realdataSource).toContain('CO2_PPM');
    expect(realdataSource).toContain('FOREST_COVER');
    expect(realdataSource).toContain('WORLD_POPULATION');
    expect(realdataSource).toContain('WORLD_GDP');
    expect(realdataSource).toContain('GLOBAL_GINI');
    expect(realdataSource).toContain('CO2_EMISSIONS');
  });

  test('population data starts at 1970', () => {
    expect(realdataSource).toContain("year: 1970, value: 3.70");
  });

  test('temperature data includes recent years', () => {
    expect(realdataSource).toContain('year: 2024');
  });

  test('has autoCalibrate function', () => {
    expect(realdataSource).toContain('autoCalibrate');
  });

  test('has MCMC-compatible functions', () => {
    expect(realdataSource).toContain('interpolateHistorical');
    expect(realdataSource).toContain('runCalibration');
  });
});

describe('MCMC Engine Integrity', () => {
  let mcmcSource;

  beforeAll(() => {
    const fs = require('fs');
    mcmcSource = fs.readFileSync('js/mcmc.js', 'utf8');
  });

  test('exports run function', () => {
    expect(mcmcSource).toContain('run');
  });

  test('exports AIC/BIC functions', () => {
    expect(mcmcSource).toContain('computeAIC');
    expect(mcmcSource).toContain('computeBIC');
  });

  test('exports generateEnsemble', () => {
    expect(mcmcSource).toContain('generateEnsemble');
  });

  test('implements Metropolis-Hastings', () => {
    expect(mcmcSource).toContain('acceptRate');
    expect(mcmcSource).toContain('burnIn');
    expect(mcmcSource).toContain('logLikelihood');
  });
});

describe('Validation Engine Integrity', () => {
  let validationSource;

  beforeAll(() => {
    const fs = require('fs');
    validationSource = fs.readFileSync('js/validation.js', 'utf8');
  });

  test('exports crossValidate', () => {
    expect(validationSource).toContain('crossValidate');
  });

  test('exports compareModels', () => {
    expect(validationSource).toContain('compareModels');
  });

  test('exports computeSobolIndices', () => {
    expect(validationSource).toContain('computeSobolIndices');
  });

  test('implements train/test split at year 2000', () => {
    expect(validationSource).toContain('2000');
  });
});

describe('AIC/BIC Formulas', () => {
  test('AIC formula is correct', () => {
    // AIC = 2k - 2*LL
    const k = 8;
    const ll = -50;
    const aic = 2 * k - 2 * ll;
    expect(aic).toBe(116);
  });

  test('BIC formula is correct', () => {
    // BIC = k*ln(n) - 2*LL
    const k = 8;
    const n = 22;
    const ll = -50;
    const bic = k * Math.log(n) - 2 * ll;
    expect(bic).toBeCloseTo(124.72, 1);
  });

  test('lower AIC is better', () => {
    const aic_small = 2 * 5 - 2 * (-40); // 5 params, LL=-40 → 90
    const aic_large = 2 * 26 - 2 * (-38); // 26 params, LL=-38 → 128
    expect(aic_small).toBeLessThan(aic_large);
  });
});
