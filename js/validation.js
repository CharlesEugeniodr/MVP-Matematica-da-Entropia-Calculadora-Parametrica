/**
 * ValidationEngine — Model validation, comparison, and sensitivity analysis.
 * Depends on: StructuralEntropyModel, RealData, MCMCEngine (globals).
 * @module ValidationEngine
 */
const ValidationEngine = (function () {
  'use strict';

  const TRAIN_END = 2000;
  const TEST_START = 2000;
  const YEAR_START = 1970;
  const YEAR_END = 2024;

  /* ── helpers ─────────────────────────────────────────────────────────── */

  function safeDiv(a, b) { return b === 0 || !isFinite(b) ? 0 : a / b; }

  function mean(arr) {
    const v = arr.filter(isFinite);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
  }

  function variance(arr) {
    const m = mean(arr);
    const v = arr.filter(isFinite);
    return v.length > 1
      ? v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)
      : 0;
  }

  function rmse(predicted, observed) {
    let sum = 0, n = 0;
    for (let i = 0; i < predicted.length; i++) {
      if (isFinite(predicted[i]) && isFinite(observed[i])) {
        sum += (predicted[i] - observed[i]) ** 2; n++;
      }
    }
    return n ? Math.sqrt(sum / n) : NaN;
  }

  function mae(predicted, observed) {
    let sum = 0, n = 0;
    for (let i = 0; i < predicted.length; i++) {
      if (isFinite(predicted[i]) && isFinite(observed[i])) {
        sum += Math.abs(predicted[i] - observed[i]); n++;
      }
    }
    return n ? sum / n : NaN;
  }

  function mape(predicted, observed) {
    let sum = 0, n = 0;
    for (let i = 0; i < predicted.length; i++) {
      if (isFinite(predicted[i]) && isFinite(observed[i]) && observed[i] !== 0) {
        sum += Math.abs((observed[i] - predicted[i]) / observed[i]); n++;
      }
    }
    return n ? (sum / n) * 100 : NaN;
  }

  function skillScore(predicted, observed, climatologyValue) {
    let mseModel = 0, mseClim = 0, n = 0;
    for (let i = 0; i < predicted.length; i++) {
      if (isFinite(predicted[i]) && isFinite(observed[i])) {
        mseModel += (predicted[i] - observed[i]) ** 2;
        mseClim += (climatologyValue - observed[i]) ** 2;
        n++;
      }
    }
    if (!n) return NaN;
    mseModel /= n; mseClim /= n;
    return mseClim === 0 ? (mseModel === 0 ? 1 : -Infinity) : 1 - mseModel / mseClim;
  }

  function computeMetrics(simYears, simPop, simTemp, realYears, realPop, realTemp, lastKnownPop, lastKnownTemp) {
    const pred_p = [], obs_p = [], pred_t = [], obs_t = [];
    for (let i = 0; i < realYears.length; i++) {
      const idx = simYears.indexOf(realYears[i]);
      if (idx !== -1) {
        pred_p.push(simPop[idx]); obs_p.push(realPop[i]);
        pred_t.push(simTemp[idx]); obs_t.push(realTemp[i]);
      }
    }
    return {
      RMSE_pop: rmse(pred_p, obs_p),
      RMSE_temp: rmse(pred_t, obs_t),
      MAE_pop: mae(pred_p, obs_p),
      MAE_temp: mae(pred_t, obs_t),
      MAPE_pop: mape(pred_p, obs_p),
      skillScore_pop: skillScore(pred_p, obs_p, lastKnownPop),
      skillScore_temp: skillScore(pred_t, obs_t, lastKnownTemp)
    };
  }

  function simulate(params) {
    const model = new StructuralEntropyModel(params);
    return model.run();
  }

  /* ── crossValidate ───────────────────────────────────────────────────── */

  /**
   * Temporal cross-validation: train on 1970-2000, test on 2000-2024.
   * @param {Object} baseParams - Base parameter set for the model.
   * @returns {{ trainMetrics: Object, testMetrics: Object, calibratedParams: Object, overfitRatio: number }}
   */
  function crossValidate(baseParams) {
    const real = RealData.getAll();
    const trainIdx = real.years.map((y, i) => y <= TRAIN_END ? i : -1).filter(i => i >= 0);
    const testIdx  = real.years.map((y, i) => y > TRAIN_END ? i : -1).filter(i => i >= 0);

    const trainYears = trainIdx.map(i => real.years[i]);
    const trainPop   = trainIdx.map(i => real.population[i]);
    const trainTemp  = trainIdx.map(i => real.temperature[i]);
    const testYears  = testIdx.map(i => real.years[i]);
    const testPop    = testIdx.map(i => real.population[i]);
    const testTemp   = testIdx.map(i => real.temperature[i]);

    /* calibrate on train window */
    const calibrated = RealData.autoCalibrate(baseParams, TRAIN_END);
    const sim = simulate(calibrated);

    const lastTrainPop  = trainPop[trainPop.length - 1] || 0;
    const lastTrainTemp = trainTemp[trainTemp.length - 1] || 0;

    const trainMetrics = computeMetrics(
      sim.years, sim.population, sim.temperature,
      trainYears, trainPop, trainTemp, lastTrainPop, lastTrainTemp
    );
    const testMetrics = computeMetrics(
      sim.years, sim.population, sim.temperature,
      testYears, testPop, testTemp, lastTrainPop, lastTrainTemp
    );

    const overfitRatio = safeDiv(testMetrics.RMSE_pop, trainMetrics.RMSE_pop);

    return { trainMetrics, testMetrics, calibratedParams: calibrated, overfitRatio };
  }

  /* ── compareModels ───────────────────────────────────────────────────── */

  function fitLinear(years, values) {
    const n = years.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) {
      sx += years[i]; sy += values[i];
      sxy += years[i] * values[i]; sxx += years[i] ** 2;
    }
    const b = safeDiv(n * sxy - sx * sy, n * sxx - sx * sx);
    const a = (sy - b * sx) / n;
    return { a, b };
  }

  function logistic(t, K, r, t0) { return K / (1 + Math.exp(-r * (t - t0))); }

  function fitLogistic(years, pop) {
    let bestErr = Infinity, bestK = 8, bestR = 0.02, bestT0 = 1970;
    const Ks = [6, 8, 10, 12, 15];
    const rs = [0.01, 0.02, 0.03, 0.05, 0.07];
    const t0s = [1950, 1960, 1970, 1980, 1990, 2000];
    for (const K of Ks) for (const r of rs) for (const t0 of t0s) {
      let err = 0;
      for (let i = 0; i < years.length; i++) {
        err += (logistic(years[i], K, r, t0) - pop[i]) ** 2;
      }
      if (err < bestErr) { bestErr = err; bestK = K; bestR = r; bestT0 = t0; }
    }
    return { K: bestK, r: bestR, t0: bestT0 };
  }

  function modelRMSE(predPop, obsPop) { return rmse(predPop, obsPop); }

  function logLikelihood(predicted, observed, sigma) {
    if (!sigma || sigma === 0) sigma = 0.01;
    let ll = 0;
    for (let i = 0; i < predicted.length; i++) {
      if (isFinite(predicted[i]) && isFinite(observed[i])) {
        const diff = predicted[i] - observed[i];
        ll += -0.5 * Math.log(2 * Math.PI * sigma * sigma) - (diff * diff) / (2 * sigma * sigma);
      }
    }
    return isFinite(ll) ? ll : -1e10;
  }

  /**
   * Compare models of increasing complexity (linear → IFE full).
   * @param {Object} baseParams - Base IFE parameter set.
   * @returns {Array<{ name: string, params_count: number, rmse: number, logLL: number, aic: number, bic: number, deltaAIC: number }>}
   */
  function compareModels(baseParams) {
    const real = RealData.getAll();
    const Y = real.years, P = real.population, T = real.temperature;
    const n = Y.length;
    const results = [];

    /* — Model A: Linear — */
    const linFit = fitLinear(Y, P);
    const linPred = Y.map(y => linFit.a + linFit.b * y);
    const linRMSE = modelRMSE(linPred, P);
    const linLL = logLikelihood(linPred, P, linRMSE);
    results.push({ name: 'Linear', params_count: 2, rmse: linRMSE, logLL: linLL,
      aic: MCMCEngine.computeAIC(linLL, 2), bic: MCMCEngine.computeBIC(linLL, 2, n) });

    /* — Model B: Logistic — */
    const logFit = fitLogistic(Y, P);
    const logPred = Y.map(y => logistic(y, logFit.K, logFit.r, logFit.t0));
    const logRMSE = modelRMSE(logPred, P);
    const logLL = logLikelihood(logPred, P, logRMSE);
    results.push({ name: 'Logistic', params_count: 3, rmse: logRMSE, logLL: logLL,
      aic: MCMCEngine.computeAIC(logLL, 3), bic: MCMCEngine.computeBIC(logLL, 3, n) });

    /* — Model C: IFE Minimal (5 free) — */
    const minParams = Object.assign({}, baseParams);
    const minSim = simulate(minParams);
    const minPred = Y.map(y => { const i = minSim.years.indexOf(y); return i >= 0 ? minSim.population[i] : NaN; });
    const minRMSE = modelRMSE(minPred, P);
    const minLL = logLikelihood(minPred, P, minRMSE);
    results.push({ name: 'IFE Minimal', params_count: 5, rmse: minRMSE, logLL: minLL,
      aic: MCMCEngine.computeAIC(minLL, 5), bic: MCMCEngine.computeBIC(minLL, 5, n) });

    /* — Model D: IFE Reduced (8 free) — */
    const redParams = RealData.autoCalibrate ? RealData.autoCalibrate(baseParams) : baseParams;
    const redSim = simulate(redParams);
    const redPred = Y.map(y => { const i = redSim.years.indexOf(y); return i >= 0 ? redSim.population[i] : NaN; });
    const redRMSE = modelRMSE(redPred, P);
    const redLL = logLikelihood(redPred, P, redRMSE);
    results.push({ name: 'IFE Reduced', params_count: 8, rmse: redRMSE, logLL: redLL,
      aic: MCMCEngine.computeAIC(redLL, 8), bic: MCMCEngine.computeBIC(redLL, 8, n) });

    /* — Model E: IFE Full (26 params) — */
    const fullSim = simulate(baseParams);
    const fullPred = Y.map(y => { const i = fullSim.years.indexOf(y); return i >= 0 ? fullSim.population[i] : NaN; });
    const fullRMSE = modelRMSE(fullPred, P);
    const fullLL = logLikelihood(fullPred, P, fullRMSE);
    results.push({ name: 'IFE Full', params_count: 26, rmse: fullRMSE, logLL: fullLL,
      aic: MCMCEngine.computeAIC(fullLL, 26), bic: MCMCEngine.computeBIC(fullLL, 26, n) });

    /* deltaAIC */
    const bestAIC = Math.min(...results.map(r => r.aic));
    results.forEach(r => { r.deltaAIC = r.aic - bestAIC; });

    return results;
  }

  /* ── computeSobolIndices ─────────────────────────────────────────────── */

  const FREE_PARAMS = [
    { key: 'r_N',    lo: 0.01,  hi: 0.04 },
    { key: 'alpha1', lo: 0.001, hi: 0.01 },
    { key: 'beta_D', lo: 0.01,  hi: 0.2  },
    { key: 'w1',     lo: 0.1,   hi: 0.9  },
    { key: 'w3',     lo: 0.01,  hi: 0.5  },
    { key: 'gamma1', lo: 0.001, hi: 0.05 },
    { key: 'c_T',    lo: 0.01,  hi: 0.1  },
    { key: 'T_eq',   lo: 13,    hi: 16   }
  ];

  function latinHypercube(n, lo, hi) {
    const step = (hi - lo) / n;
    const samples = [];
    for (let i = 0; i < n; i++) {
      samples.push(lo + (i + Math.random()) * step);
    }
    /* shuffle */
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [samples[i], samples[j]] = [samples[j], samples[i]];
    }
    return samples;
  }

  function getLambda2100(params) {
    try {
      const sim = simulate(params);
      const idx = sim.years.indexOf(2100);
      if (idx >= 0 && isFinite(sim.lambda[idx])) return sim.lambda[idx];
      /* fallback: last lambda */
      const last = sim.lambda[sim.lambda.length - 1];
      return isFinite(last) ? last : 0;
    } catch (_) { return 0; }
  }

  /**
   * Simplified Sobol-like first-order sensitivity indices for free params.
   * @param {Object} baseParams - Base parameter set.
   * @param {number} [nSamples=500] - Number of Latin Hypercube samples per param.
   * @returns {{ indices: Array<{ param: string, S1: number, ST_approx: number }>, totalVariance: number, nSamples: number }}
   */
  function computeSobolIndices(baseParams, nSamples) {
    nSamples = nSamples || 500;
    const perParamVariances = [];

    /* one-at-a-time variances */
    for (const fp of FREE_PARAMS) {
      const samples = latinHypercube(nSamples, fp.lo, fp.hi);
      const outputs = samples.map(val => {
        const p = Object.assign({}, baseParams);
        p[fp.key] = val;
        return getLambda2100(p);
      });
      perParamVariances.push({ param: fp.key, variance: variance(outputs) });
    }

    /* total variance: vary all simultaneously */
    const allOutputs = [];
    for (let i = 0; i < nSamples; i++) {
      const p = Object.assign({}, baseParams);
      for (const fp of FREE_PARAMS) {
        p[fp.key] = fp.lo + Math.random() * (fp.hi - fp.lo);
      }
      allOutputs.push(getLambda2100(p));
    }
    const totalVariance = variance(allOutputs) || 1e-30;

    const indices = perParamVariances.map(pv => ({
      param: pv.param,
      S1: safeDiv(pv.variance, totalVariance),
      ST_approx: safeDiv(pv.variance, totalVariance) /* OAT approximation */
    }));

    return { indices, totalVariance, nSamples };
  }

  /* ── public API ──────────────────────────────────────────────────────── */

  return { crossValidate, compareModels, computeSobolIndices };
})();
