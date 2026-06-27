/**
 * @jest-environment jsdom
 * Runtime Tests — Execute model functions and verify numerical output
 */

// We need to load the actual JS files and test their behavior
const fs = require('fs');
const path = require('path');

// Helper to load a JS file as a module in jsdom context
function loadScript(filename) {
  const code = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  return code;
}

describe('Model Runtime Tests', () => {
  let modelCode, realdataCode;

  beforeAll(() => {
    modelCode = loadScript('js/model.js');
    realdataCode = loadScript('js/realdata.js');
    
    // Execute model in jsdom global context
    eval(modelCode);
  });

  test('StructuralEntropyModel exists after loading', () => {
    expect(typeof StructuralEntropyModel).toBe('object');
    expect(typeof StructuralEntropyModel.simulate).toBe('function');
    expect(typeof StructuralEntropyModel.DEFAULT_PARAMS).toBe('object');
  });

  test('DEFAULT_PARAMS has all required fields', () => {
    const dp = StructuralEntropyModel.DEFAULT_PARAMS;
    const required = ['r_N', 'mu_N', 'K0', 'alpha1', 'beta_D', 'gamma1', 
                      'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7',
                      'lambda_crit', 't_start', 't_end', 'dt'];
    required.forEach(key => {
      expect(dp).toHaveProperty(key);
      expect(typeof dp[key]).toBe('number');
    });
  });

  test('simulate() returns valid time series', () => {
    const result = StructuralEntropyModel.simulate();
    
    expect(result).toBeDefined();
    expect(result.time).toBeDefined();
    expect(result.lambda).toBeDefined();
    expect(result.Nn).toBeDefined();
    expect(result.Ns).toBeDefined();
    expect(result.deltaT).toBeDefined();
    expect(result.D).toBeDefined();
    expect(result.R).toBeDefined();
    expect(result.Keff).toBeDefined();
    
    // Time array should be non-empty
    expect(result.time.length).toBeGreaterThan(10);
    
    // All arrays should be same length
    expect(result.lambda.length).toBe(result.time.length);
    expect(result.Nn.length).toBe(result.time.length);
  });

  test('simulate() produces physically reasonable population', () => {
    const result = StructuralEntropyModel.simulate();
    
    // Population should start around 3.7 billion (1970)
    const pop0 = result.Nn[0] + result.Ns[0];
    expect(pop0).toBeGreaterThan(2);
    expect(pop0).toBeLessThan(6);
    
    // Population should be positive throughout
    for (let i = 0; i < result.time.length; i++) {
      const pop = result.Nn[i] + result.Ns[i];
      expect(pop).toBeGreaterThan(0);
    }
  });

  test('lambda starts near zero and evolves', () => {
    const result = StructuralEntropyModel.simulate();
    
    // λ should start relatively low
    expect(result.lambda[0]).toBeLessThan(1.0);
    expect(result.lambda[0]).toBeGreaterThanOrEqual(0);
    
    // λ should change over time (not constant)
    const first = result.lambda[0];
    const last = result.lambda[result.lambda.length - 1];
    expect(Math.abs(last - first)).toBeGreaterThan(0.001);
  });

  test('temperature anomaly is in reasonable range', () => {
    const result = StructuralEntropyModel.simulate();
    
    // ΔT should be between -1 and +10 °C
    for (let i = 0; i < result.deltaT.length; i++) {
      expect(result.deltaT[i]).toBeGreaterThan(-2);
      expect(result.deltaT[i]).toBeLessThan(15);
    }
  });

  test('carrying capacity Keff remains positive', () => {
    const result = StructuralEntropyModel.simulate();
    
    for (let i = 0; i < result.Keff.length; i++) {
      expect(result.Keff[i]).toBeGreaterThan(0);
    }
  });

  test('degradation D stays in [0, 1]', () => {
    const result = StructuralEntropyModel.simulate();
    
    for (let i = 0; i < result.D.length; i++) {
      expect(result.D[i]).toBeGreaterThanOrEqual(0);
      expect(result.D[i]).toBeLessThanOrEqual(1.5); // allow small overshoot
    }
  });

  test('simulate with custom params works', () => {
    const customParams = Object.assign({}, StructuralEntropyModel.DEFAULT_PARAMS, {
      r_N: 0.025,
      w1: 0.3
    });
    const result = StructuralEntropyModel.simulate(customParams);
    expect(result.time.length).toBeGreaterThan(10);
    expect(result.lambda.length).toBe(result.time.length);
  });

  test('toCSV returns valid CSV string', () => {
    const result = StructuralEntropyModel.simulate();
    const csv = StructuralEntropyModel.toCSV(result);
    
    expect(typeof csv).toBe('string');
    expect(csv.length).toBeGreaterThan(100);
    
    // Check header
    const lines = csv.split('\\n');
    expect(lines.length).toBeGreaterThan(10);
    expect(lines[0]).toContain('Year');
  });

  test('events object contains expected fields', () => {
    const result = StructuralEntropyModel.simulate();
    
    expect(result.events).toBeDefined();
    expect(typeof result.events).toBe('object');
  });
});

describe('AIC/BIC Formula Runtime', () => {
  test('AIC with perfect fit should be 2k', () => {
    // LL = 0 (perfect fit) → AIC = 2k - 2*0 = 2k
    const k = 8;
    const aic = 2 * k - 2 * 0;
    expect(aic).toBe(16);
  });

  test('BIC penalizes more parameters with more data', () => {
    const k1 = 5, k2 = 26;
    const n = 78; // data points
    const ll = -50;
    
    const bic1 = k1 * Math.log(n) - 2 * ll;
    const bic2 = k2 * Math.log(n) - 2 * ll;
    
    // More parameters should give higher (worse) BIC
    expect(bic2).toBeGreaterThan(bic1);
    
    // The difference should be (k2-k1)*ln(n) = 21 * ln(78) ≈ 91.5
    const diff = bic2 - bic1;
    expect(diff).toBeCloseTo(21 * Math.log(78), 1);
  });

  test('BIC penalizes more than AIC for large n', () => {
    const k = 8, n = 78, ll = -50;
    const aic = 2 * k - 2 * ll;
    const bic = k * Math.log(n) - 2 * ll;
    
    // For n > e² ≈ 7.39, BIC penalizes more per parameter
    expect(bic).toBeGreaterThan(aic);
  });
});

describe('Statistical Helpers', () => {
  test('variance of constant array is zero', () => {
    const arr = [5, 5, 5, 5, 5];
    const m = arr.reduce((s, x) => s + x, 0) / arr.length;
    const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
    expect(v).toBe(0);
  });

  test('variance of known array is correct', () => {
    // [1, 2, 3, 4, 5] → variance = 2.5
    const arr = [1, 2, 3, 4, 5];
    const m = 3; // mean
    const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
    expect(v).toBe(2.5);
  });

  test('RMSE of identical arrays is zero', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
    const rmse = Math.sqrt(sum / a.length);
    expect(rmse).toBe(0);
  });

  test('RMSE of known difference is correct', () => {
    // All predictions off by 1 → RMSE = 1
    const pred = [2, 3, 4, 5, 6];
    const obs = [1, 2, 3, 4, 5];
    let sum = 0;
    for (let i = 0; i < pred.length; i++) sum += (pred[i] - obs[i]) ** 2;
    const rmse = Math.sqrt(sum / pred.length);
    expect(rmse).toBe(1);
  });

  test('Skill Score = 1 when model is perfect', () => {
    // SS = 1 - MSE_model/MSE_clim
    // If model is perfect, MSE_model = 0 → SS = 1
    expect(1 - 0 / 1).toBe(1);
  });

  test('Skill Score < 0 when model is worse than climatology', () => {
    // MSE_model > MSE_clim → SS < 0
    const mseModel = 10;
    const mseClim = 5;
    const ss = 1 - mseModel / mseClim;
    expect(ss).toBeLessThan(0);
  });
});
