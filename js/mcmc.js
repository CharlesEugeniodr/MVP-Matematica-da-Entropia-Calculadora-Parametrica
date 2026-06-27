'use strict';

/**
 * MCMCEngine — Markov Chain Monte Carlo (Metropolis-Hastings) module
 * for Structural Entropy Model parameter estimation.
 *
 * Depends on globals: StructuralEntropyModel, RealData
 * @namespace MCMCEngine
 */
var MCMCEngine = (function () {

  /* ── Default free-parameter specifications ─────────────────────── */

  var DEFAULT_FREE_PARAMS = [
    { key: 'r_N',    min: 0.005, max: 0.035, proposalSigma: 0.002  },
    { key: 'mu_N',   min: 0.005, max: 0.025, proposalSigma: 0.001  },
    { key: 'alpha1',  min: 0.001, max: 0.008, proposalSigma: 0.0005 },
    { key: 'beta_D',  min: 0.02,  max: 0.10,  proposalSigma: 0.005  },
    { key: 'w1',     min: 0.05,  max: 0.50,  proposalSigma: 0.02   },
    { key: 'w2',     min: 0.05,  max: 0.50,  proposalSigma: 0.02   },
    { key: 'w3',     min: 0.05,  max: 0.40,  proposalSigma: 0.02   },
    { key: 'w7',     min: 0.05,  max: 0.50,  proposalSigma: 0.02   }
  ];

  /* ── Observation uncertainties ─────────────────────────────────── */

  var SIGMA_POP  = 0.3;   // billion
  var SIGMA_TEMP = 0.2;   // °C
  var CURRENT_YEAR = 2026;

  /* ── Utility helpers ───────────────────────────────────────────── */

  /**
   * Clamp a value to [lo, hi].
   * @param {number} v
   * @param {number} lo
   * @param {number} hi
   * @returns {number}
   */
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /**
   * Box-Muller transform — returns a standard-normal variate.
   * @returns {number}
   */
  function randn() {
    var u1 = Math.random();
    var u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1 || 1e-300)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Shallow-clone an object (one level deep).
   * @param {Object} obj
   * @returns {Object}
   */
  function shallowClone(obj) {
    var out = {};
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) out[k] = obj[k];
    }
    return out;
  }

  /**
   * Compute the median of a sorted numeric array.
   * @param {number[]} sorted
   * @returns {number}
   */
  function median(sorted) {
    var n = sorted.length;
    if (n === 0) return NaN;
    var mid = Math.floor(n / 2);
    return n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Return the value at a given quantile from a sorted array.
   * @param {number[]} sorted
   * @param {number} q  — quantile in [0,1]
   * @returns {number}
   */
  function quantile(sorted, q) {
    if (sorted.length === 0) return NaN;
    var pos = q * (sorted.length - 1);
    var lo  = Math.floor(pos);
    var hi  = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
  }

  /* ── Core log-likelihood ───────────────────────────────────────── */

  /**
   * Compute the Gaussian log-likelihood of a parameter set against
   * historical population and temperature data.
   *
   * @param {Object} params — full parameter object for StructuralEntropyModel.simulate
   * @returns {number} log-likelihood (may be -Infinity)
   */
  function computeLogLikelihood(params) {
    try {
      var result = StructuralEntropyModel.simulate(params);
      if (!result || !result.time) return -Infinity;

      var ll = 0;
      var timeArr = result.time;

      for (var i = 0; i < timeArr.length; i += 5) {
        var yr = timeArr[i];
        if (yr > CURRENT_YEAR) break;

        var realPop  = RealData.interpolateHistorical(RealData.WORLD_POPULATION, yr);
        var realTemp = RealData.interpolateHistorical(RealData.TEMPERATURE_ANOMALY, yr);

        if (realPop === null || realTemp === null) continue;

        var modelPop  = result.population[i];
        var modelTemp = result.temperature[i];

        if (!isFinite(modelPop) || !isFinite(modelTemp)) return -Infinity;

        var dPop  = modelPop  - realPop;
        var dTemp = modelTemp - realTemp;

        ll -= 0.5 * (dPop * dPop) / (SIGMA_POP * SIGMA_POP);
        ll -= 0.5 * (dTemp * dTemp) / (SIGMA_TEMP * SIGMA_TEMP);
      }

      return isFinite(ll) ? ll : -Infinity;
    } catch (e) {
      return -Infinity;
    }
  }

  /* ── Information criteria ──────────────────────────────────────── */

  /**
   * Akaike Information Criterion.
   * @param {number} k  — number of free parameters
   * @param {number} logLikelihood
   * @returns {number}
   */
  function computeAIC(k, logLikelihood) {
    return 2 * k - 2 * logLikelihood;
  }

  /**
   * Bayesian Information Criterion.
   * @param {number} k  — number of free parameters
   * @param {number} n  — number of observations
   * @param {number} logLikelihood
   * @returns {number}
   */
  function computeBIC(k, n, logLikelihood) {
    return k * Math.log(n) - 2 * logLikelihood;
  }

  /* ── Main MCMC sampler ─────────────────────────────────────────── */

  /**
   * Run the Metropolis-Hastings MCMC sampler.
   *
   * @param {Object} baseParams — starting parameter set (full model params)
   * @param {Object} [options]
   * @param {number}   [options.iterations=5000]  — total iterations
   * @param {number}   [options.burnIn=1000]      — burn-in count
   * @param {Function} [options.onProgress]       — callback({iteration,accepted,currentLL,bestLL,acceptRate})
   * @param {Array}    [options.freeParams]       — array of {key,min,max,proposalSigma}
   * @returns {{ chain: Array, posteriors: Object, acceptRate: number, bestParams: Object, bestLL: number }}
   */
  function run(baseParams, options) {
    options = options || {};
    var iterations = options.iterations || 5000;
    var burnIn     = options.burnIn     || 1000;
    var onProgress = options.onProgress || null;
    var freeParams = options.freeParams || DEFAULT_FREE_PARAMS;

    var current   = shallowClone(baseParams);
    var currentLL = computeLogLikelihood(current);

    var bestParams = shallowClone(current);
    var bestLL     = currentLL;

    var chain    = [];
    var accepted = 0;

    for (var iter = 1; iter <= iterations; iter++) {
      /* ── Propose ──────────────────────────────────────────────── */
      var proposed = shallowClone(current);
      for (var p = 0; p < freeParams.length; p++) {
        var fp  = freeParams[p];
        var old = current[fp.key] !== undefined ? current[fp.key] : baseParams[fp.key];
        var nv  = old + fp.proposalSigma * randn();
        proposed[fp.key] = clamp(nv, fp.min, fp.max);
      }

      /* ── Evaluate ─────────────────────────────────────────────── */
      var proposedLL = computeLogLikelihood(proposed);

      /* ── Accept / reject (log-space) ──────────────────────────── */
      var logAlpha = proposedLL - currentLL;
      if (logAlpha >= 0 || Math.log(Math.random()) < logAlpha) {
        current   = proposed;
        currentLL = proposedLL;
        accepted++;

        if (currentLL > bestLL) {
          bestLL     = currentLL;
          bestParams = shallowClone(current);
        }
      }

      chain.push({ params: shallowClone(current), logLikelihood: currentLL });

      /* ── Progress callback ────────────────────────────────────── */
      if (onProgress && iter % 100 === 0) {
        onProgress({
          iteration:  iter,
          accepted:   accepted,
          currentLL:  currentLL,
          bestLL:     bestLL,
          acceptRate: accepted / iter
        });
      }
    }

    /* ── Remove burn-in ─────────────────────────────────────────── */
    var postBurnIn = chain.slice(burnIn);

    /* ── Compute posterior statistics ────────────────────────────── */
    var posteriors = {};
    for (var f = 0; f < freeParams.length; f++) {
      var key    = freeParams[f].key;
      var values = postBurnIn.map(function (s) { return s.params[key]; });
      values.sort(function (a, b) { return a - b; });

      var sum  = 0;
      var sum2 = 0;
      for (var j = 0; j < values.length; j++) {
        sum  += values[j];
        sum2 += values[j] * values[j];
      }
      var mean = sum / values.length;
      var std  = Math.sqrt(sum2 / values.length - mean * mean);

      posteriors[key] = {
        median:   median(values),
        ci95_lo:  quantile(values, 0.025),
        ci95_hi:  quantile(values, 0.975),
        mean:     mean,
        std:      std
      };
    }

    return {
      chain:      postBurnIn,
      posteriors: posteriors,
      acceptRate: accepted / iterations,
      bestParams: bestParams,
      bestLL:     bestLL
    };
  }

  /* ── Ensemble generator for uncertainty bands ──────────────────── */

  /**
   * Sample parameter sets from the posterior chain, simulate each,
   * and return time-series medians with 95 % credible intervals.
   *
   * @param {Array}  chain     — post-burn-in chain from run()
   * @param {number} nSamples  — how many draws to take
   * @returns {{ time: number[], medians: Object, ci95: Object }}
   */
  function generateEnsemble(chain, nSamples) {
    if (!chain || chain.length === 0) return null;
    nSamples = Math.min(nSamples, chain.length);

    /* Draw random indices without replacement (Fisher-Yates on indices) */
    var indices = [];
    for (var i = 0; i < chain.length; i++) indices.push(i);
    for (var i = indices.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
    }
    indices = indices.slice(0, nSamples);

    /* Run simulations */
    var runs = [];
    var refTime = null;
    for (var s = 0; s < indices.length; s++) {
      var result = StructuralEntropyModel.simulate(chain[indices[s]].params);
      if (!result || !result.time) continue;
      if (!refTime) refTime = result.time;
      runs.push(result);
    }
    if (runs.length === 0 || !refTime) return null;

    var nT = refTime.length;
    var medians = { pop: new Array(nT), temp: new Array(nT), lambda: new Array(nT) };
    var ci95    = {
      pop_lo: new Array(nT), pop_hi: new Array(nT),
      temp_lo: new Array(nT), temp_hi: new Array(nT),
      lambda_lo: new Array(nT), lambda_hi: new Array(nT)
    };

    for (var t = 0; t < nT; t++) {
      var pops   = [], temps  = [], lambdas = [];
      for (var r = 0; r < runs.length; r++) {
        pops.push(runs[r].population[t]);
        temps.push(runs[r].temperature[t]);
        lambdas.push(runs[r].lambda[t]);
      }
      pops.sort(function (a, b) { return a - b; });
      temps.sort(function (a, b) { return a - b; });
      lambdas.sort(function (a, b) { return a - b; });

      medians.pop[t]    = median(pops);
      medians.temp[t]   = median(temps);
      medians.lambda[t] = median(lambdas);

      ci95.pop_lo[t]    = quantile(pops,    0.025);
      ci95.pop_hi[t]    = quantile(pops,    0.975);
      ci95.temp_lo[t]   = quantile(temps,   0.025);
      ci95.temp_hi[t]   = quantile(temps,   0.975);
      ci95.lambda_lo[t] = quantile(lambdas, 0.025);
      ci95.lambda_hi[t] = quantile(lambdas, 0.975);
    }

    return { time: refTime, medians: medians, ci95: ci95 };
  }

  /* ── Public API ────────────────────────────────────────────────── */

  return {
    run:                  run,
    computeAIC:           computeAIC,
    computeBIC:           computeBIC,
    computeLogLikelihood: computeLogLikelihood,
    generateEnsemble:     generateEnsemble
  };

})();
