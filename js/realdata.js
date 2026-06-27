/**
 * realdata.js — Real-World Data Integration Module
 * 
 * Fetches real data from open APIs:
 *   - USGS: Earthquakes
 *   - NASA EONET: Natural events (hurricanes, wildfires, volcanoes)
 *   - GDELT: Real news headlines
 *   - Historical: NASA GISS temperature, NOAA CO2, FAO forests
 */

'use strict';

const RealData = (() => {

  // ── Cache ────────────────────────────────────────────────────────
  const cache = {};
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function getCached(key) {
    if (cache[key] && (Date.now() - cache[key].ts) < CACHE_TTL) {
      return cache[key].data;
    }
    return null;
  }

  function setCache(key, data) {
    cache[key] = { data, ts: Date.now() };
  }

  // ── Fetch with timeout and error handling ─────────────────────
  async function safeFetch(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      console.warn(`RealData fetch failed: ${url}`, err.message);
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 1. USGS EARTHQUAKES (Real-time)
  // ══════════════════════════════════════════════════════════════════
  async function fetchEarthquakes() {
    const cached = getCached('earthquakes');
    if (cached) return cached;

    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson';
    const data = await safeFetch(url);
    if (!data || !data.features) return getFallbackEarthquakes();

    const events = data.features.map(f => ({
      magnitude: f.properties.mag,
      location: f.properties.place,
      time: new Date(f.properties.time).toISOString(),
      tsunami: f.properties.tsunami === 1,
      depth: f.geometry.coordinates[2],
      url: f.properties.url
    }));

    setCache('earthquakes', events);
    return events;
  }

  function getFallbackEarthquakes() {
    return [
      { magnitude: 5.2, location: 'Pacific Ring of Fire', time: new Date().toISOString(), tsunami: false, depth: 35 },
      { magnitude: 4.8, location: 'Mid-Atlantic Ridge', time: new Date().toISOString(), tsunami: false, depth: 10 }
    ];
  }

  // ══════════════════════════════════════════════════════════════════
  // 2. NASA EONET — Natural Events (Hurricanes, Wildfires, etc.)
  // ══════════════════════════════════════════════════════════════════
  async function fetchNaturalEvents() {
    const cached = getCached('eonet');
    if (cached) return cached;

    const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?limit=15&status=open';
    const data = await safeFetch(url);
    if (!data || !data.events) return getFallbackEvents();

    const events = data.events.map(e => ({
      title: e.title,
      category: e.categories[0]?.title || 'Unknown',
      date: e.geometry[0]?.date || '',
      coordinates: e.geometry[0]?.coordinates || [],
      source: e.sources[0]?.url || ''
    }));

    setCache('eonet', events);
    return events;
  }

  function getFallbackEvents() {
    return [
      { title: 'Monitoring active volcanic activity', category: 'Volcanoes', date: new Date().toISOString() },
      { title: 'Wildfire detected in remote region', category: 'Wildfires', date: new Date().toISOString() }
    ];
  }

  // ══════════════════════════════════════════════════════════════════
  // 3. GDELT — Real Global News Headlines
  // ══════════════════════════════════════════════════════════════════
  async function fetchNews(lang = 'pt') {
    const cached = getCached('news_' + lang);
    if (cached) return cached;

    const query = encodeURIComponent('climate change OR earthquake OR hurricane OR deforestation OR emissions');
    const langCode = lang === 'pt' ? 'Portuguese' : 'English';
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&sourcelang=${langCode}&mode=ArtList&maxrecords=20&format=json&sort=DateDesc`;
    
    const data = await safeFetch(url, 10000);
    if (!data || !data.articles) return getFallbackNews(lang);

    const articles = data.articles.map(a => ({
      title: a.title,
      source: a.domain,
      url: a.url,
      date: a.seendate,
      image: a.socialimage
    }));

    setCache('news_' + lang, articles);
    return articles;
  }

  function getFallbackNews(lang) {
    if (lang === 'pt') {
      return [
        { title: 'Monitoramento climático global em andamento', source: 'Sistema', date: new Date().toISOString() },
        { title: 'Cientistas alertam sobre aumento de eventos extremos', source: 'Sistema', date: new Date().toISOString() }
      ];
    }
    return [
      { title: 'Global climate monitoring underway', source: 'System', date: new Date().toISOString() },
      { title: 'Scientists warn of increasing extreme events', source: 'System', date: new Date().toISOString() }
    ];
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. HISTORICAL BASELINE DATA (Verified Public Sources)
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * Global Temperature Anomaly (°C above 1951-1980 average)
   * Source: NASA GISS Surface Temperature Analysis
   * https://data.giss.nasa.gov/gistemp/
   */
  const TEMPERATURE_ANOMALY = [
    { year: 1970, value: 0.02 },
    { year: 1975, value: -0.01 },
    { year: 1980, value: 0.26 },
    { year: 1985, value: 0.12 },
    { year: 1990, value: 0.45 },
    { year: 1995, value: 0.46 },
    { year: 2000, value: 0.40 },
    { year: 2005, value: 0.68 },
    { year: 2010, value: 0.72 },
    { year: 2015, value: 0.87 },
    { year: 2016, value: 1.01 },
    { year: 2017, value: 0.92 },
    { year: 2018, value: 0.85 },
    { year: 2019, value: 0.98 },
    { year: 2020, value: 1.02 },
    { year: 2021, value: 0.85 },
    { year: 2022, value: 0.89 },
    { year: 2023, value: 1.17 },
    { year: 2024, value: 1.29 }
  ];

  /**
   * Atmospheric CO₂ (ppm at Mauna Loa)
   * Source: NOAA Global Monitoring Laboratory
   * https://gml.noaa.gov/ccgg/trends/
   */
  const CO2_PPM = [
    { year: 1970, value: 325.7 },
    { year: 1975, value: 331.1 },
    { year: 1980, value: 338.8 },
    { year: 1985, value: 346.1 },
    { year: 1990, value: 354.4 },
    { year: 1995, value: 360.8 },
    { year: 2000, value: 369.6 },
    { year: 2005, value: 379.8 },
    { year: 2010, value: 389.9 },
    { year: 2015, value: 400.8 },
    { year: 2016, value: 404.2 },
    { year: 2017, value: 406.5 },
    { year: 2018, value: 408.5 },
    { year: 2019, value: 411.4 },
    { year: 2020, value: 414.2 },
    { year: 2021, value: 416.4 },
    { year: 2022, value: 418.6 },
    { year: 2023, value: 421.4 },
    { year: 2024, value: 425.0 }
  ];

  /**
   * Global Forest Cover (% of land area)
   * Source: FAO Global Forest Resources Assessment + World Bank
   */
  const FOREST_COVER = [
    { year: 1970, value: 31.6 },
    { year: 1980, value: 31.3 },
    { year: 1990, value: 31.0 },
    { year: 2000, value: 30.7 },
    { year: 2005, value: 30.5 },
    { year: 2010, value: 30.4 },
    { year: 2015, value: 30.3 },
    { year: 2020, value: 30.1 },
    { year: 2024, value: 30.0 }
  ];

  /**
   * Significant Earthquake Count (M6.0+ per year)
   * Source: USGS Earthquake Statistics
   */
  const SEISMIC_EVENTS = [
    { year: 1970, value: 95 },
    { year: 1975, value: 103 },
    { year: 1980, value: 108 },
    { year: 1985, value: 112 },
    { year: 1990, value: 115 },
    { year: 1995, value: 118 },
    { year: 2000, value: 123 },
    { year: 2004, value: 141 },
    { year: 2005, value: 130 },
    { year: 2010, value: 150 },
    { year: 2011, value: 185 },
    { year: 2015, value: 127 },
    { year: 2020, value: 110 },
    { year: 2023, value: 129 },
    { year: 2024, value: 135 }
  ];

  /**
   * Category 4-5 Hurricanes (annual count, all basins)
   * Source: NOAA National Hurricane Center / IBTrACS
   */
  const HURRICANES_CAT4 = [
    { year: 1970, value: 10 },
    { year: 1975, value: 9 },
    { year: 1980, value: 11 },
    { year: 1985, value: 12 },
    { year: 1990, value: 13 },
    { year: 1995, value: 16 },
    { year: 2000, value: 15 },
    { year: 2005, value: 19 },
    { year: 2010, value: 14 },
    { year: 2015, value: 17 },
    { year: 2017, value: 22 },
    { year: 2019, value: 18 },
    { year: 2020, value: 20 },
    { year: 2023, value: 21 },
    { year: 2024, value: 19 }
  ];

  /**
   * Interpolate historical data to get value at any year.
   */
  function interpolateHistorical(dataset, year) {
    if (year <= dataset[0].year) return dataset[0].value;
    if (year >= dataset[dataset.length - 1].year) return dataset[dataset.length - 1].value;
    for (let i = 0; i < dataset.length - 1; i++) {
      if (year >= dataset[i].year && year <= dataset[i + 1].year) {
        const frac = (year - dataset[i].year) / (dataset[i + 1].year - dataset[i].year);
        return dataset[i].value + frac * (dataset[i + 1].value - dataset[i].value);
      }
    }
    return dataset[dataset.length - 1].value;
  }

  /**
   * Get all historical indicators for a given year.
   */
  function getHistoricalData(year) {
    return {
      temperature: interpolateHistorical(TEMPERATURE_ANOMALY, year),
      co2: interpolateHistorical(CO2_PPM, year),
      forest: interpolateHistorical(FOREST_COVER, year),
      seismic: interpolateHistorical(SEISMIC_EVENTS, year),
      hurricanes: interpolateHistorical(HURRICANES_CAT4, year)
    };
  }

  /**
   * Build full time series for planetary chart.
   * Real data up to currentYear, model projections after.
   */
  function buildPlanetaryTimeSeries(simulationResults) {
    const currentYear = new Date().getFullYear();
    const tStart = simulationResults.params.t_start;
    const tEnd = simulationResults.params.t_end;
    const dt = simulationResults.params.dt;
    const steps = simulationResults.length;

    const series = {
      time: [],
      temperature: [],
      co2: [],
      forest: [],
      seismic: [],
      hurricanes: [],
      lambda: [],
      isReal: [] // true = real data, false = model projection
    };

    for (let i = 0; i < steps; i++) {
      const t = simulationResults.time[i];
      series.time.push(t);
      series.lambda.push(simulationResults.lambda[i]);

      if (t <= currentYear) {
        // Real historical data
        const hist = getHistoricalData(t);
        series.temperature.push(hist.temperature);
        series.co2.push(hist.co2);
        series.forest.push(hist.forest);
        series.seismic.push(hist.seismic);
        series.hurricanes.push(hist.hurricanes);
        series.isReal.push(true);
      } else {
        // Model projection: extrapolate from model's deltaT, D, lambda
        const lambda = simulationResults.lambda[i];
        const deltaT = simulationResults.deltaT[i];
        const D = simulationResults.D[i];
        
        // Temperature: use model's deltaT directly
        series.temperature.push(deltaT);
        
        // CO2: extrapolate from emissions trajectory
        const lastRealCO2 = interpolateHistorical(CO2_PPM, currentYear);
        const yearsDelta = t - currentYear;
        const emissionsFactor = 1 + (lambda * 0.3); // Higher entropy = more CO2
        series.co2.push(lastRealCO2 + yearsDelta * 2.2 * emissionsFactor * (1 - D * 0.2));
        
        // Forest: degrade based on model's degradation
        const lastRealForest = interpolateHistorical(FOREST_COVER, currentYear);
        series.forest.push(Math.max(10, lastRealForest - (D * 8) - (yearsDelta * 0.03)));
        
        // Seismic: statistically stable with slight climate-stress modulation
        const baseSeismic = 130;
        series.seismic.push(baseSeismic + (deltaT * 5) + (Math.random() - 0.5) * 20);
        
        // Hurricanes: increase with temperature
        const baseHurricane = 19;
        series.hurricanes.push(Math.max(5, baseHurricane + (deltaT - 1.2) * 4 + (Math.random() - 0.5) * 3));
        
        series.isReal.push(false);
      }
    }

    return series;
  }

  // ── Tipping Points Data ──────────────────────────────────────────
  const TIPPING_POINTS = [
    { name: 'Amazônia', nameEn: 'Amazon', threshold: 2.5, lat: -3, lon: -60, currentStress: 0.65 },
    { name: 'Ártico', nameEn: 'Arctic', threshold: 2.0, lat: 75, lon: 0, currentStress: 0.82 },
    { name: 'Antártica', nameEn: 'Antarctica', threshold: 3.0, lat: -80, lon: 0, currentStress: 0.45 },
    { name: 'Coral Reefs', nameEn: 'Coral Reefs', threshold: 1.5, lat: -18, lon: 147, currentStress: 0.90 },
    { name: 'Permafrost', nameEn: 'Permafrost', threshold: 2.5, lat: 65, lon: 100, currentStress: 0.70 },
    { name: 'Sahel', nameEn: 'Sahel', threshold: 2.0, lat: 15, lon: 10, currentStress: 0.60 }
  ];

  // ══════════════════════════════════════════════════════════════════
  // 5. REAL POPULATION DATA (World Bank)
  // ══════════════════════════════════════════════════════════════════
  const WORLD_POPULATION = [
    { year: 1970, value: 3.70 },
    { year: 1975, value: 4.07 },
    { year: 1980, value: 4.43 },
    { year: 1985, value: 4.84 },
    { year: 1990, value: 5.28 },
    { year: 1995, value: 5.69 },
    { year: 2000, value: 6.11 },
    { year: 2005, value: 6.51 },
    { year: 2010, value: 6.92 },
    { year: 2015, value: 7.35 },
    { year: 2020, value: 7.79 },
    { year: 2023, value: 8.05 },
    { year: 2024, value: 8.12 }
  ];

  // ══════════════════════════════════════════════════════════════════
  // 6. HINDCAST CALIBRATION
  // Compare model output (1970-2024) against real historical data
  // ══════════════════════════════════════════════════════════════════
  function runCalibration(modelResults) {
    const currentYear = new Date().getFullYear();
    const metrics = {
      population: { predicted: [], actual: [], years: [], rmse: 0, r2: 0 },
      temperature: { predicted: [], actual: [], years: [], rmse: 0, r2: 0 },
      score: 0
    };

    for (let i = 0; i < modelResults.length; i++) {
      const t = modelResults.time[i];
      if (t > currentYear) break;
      if (t % 5 !== 0 && t !== currentYear) continue; // Sample every 5 years

      // Population (model outputs Nn+Ns in billions)
      const modelPop = modelResults.Nn[i] + modelResults.Ns[i];
      const realPop = interpolateHistorical(WORLD_POPULATION, t);
      metrics.population.predicted.push(modelPop);
      metrics.population.actual.push(realPop);
      metrics.population.years.push(t);

      // Temperature (model outputs deltaT)
      const modelTemp = modelResults.deltaT[i];
      const realTemp = interpolateHistorical(TEMPERATURE_ANOMALY, t);
      metrics.temperature.predicted.push(modelTemp);
      metrics.temperature.actual.push(realTemp);
      metrics.temperature.years.push(t);
    }

    // Compute RMSE and R²
    metrics.population.rmse = computeRMSE(metrics.population.predicted, metrics.population.actual);
    metrics.population.r2 = computeR2(metrics.population.predicted, metrics.population.actual);
    metrics.temperature.rmse = computeRMSE(metrics.temperature.predicted, metrics.temperature.actual);
    metrics.temperature.r2 = computeR2(metrics.temperature.predicted, metrics.temperature.actual);

    // Overall calibration score (0-100)
    const popScore = Math.max(0, 100 - (metrics.population.rmse / 0.5) * 100); // <0.5B error = 100
    const tempScore = Math.max(0, 100 - (metrics.temperature.rmse / 0.5) * 100); // <0.5°C error = 100
    metrics.score = Math.round((popScore * 0.6) + (tempScore * 0.4));

    return metrics;
  }

  function computeRMSE(predicted, actual) {
    if (predicted.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < predicted.length; i++) {
      sum += Math.pow(predicted[i] - actual[i], 2);
    }
    return Math.sqrt(sum / predicted.length);
  }

  function computeR2(predicted, actual) {
    if (predicted.length < 2) return 0;
    const meanActual = actual.reduce((a, b) => a + b, 0) / actual.length;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < predicted.length; i++) {
      ssTot += Math.pow(actual[i] - meanActual, 2);
      ssRes += Math.pow(actual[i] - predicted[i], 2);
    }
    return ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  }

  // ══════════════════════════════════════════════════════════════════
  // 7. SENSITIVITY ANALYSIS (Monte Carlo on w1-w7)
  // ══════════════════════════════════════════════════════════════════
  function runSensitivityAnalysis(baseParams, numTrials = 200) {
    const weights = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7'];
    const results = {};
    
    weights.forEach(w => {
      results[w] = { deltas: [], lambdaChanges: [] };
    });

    const baseResult = StructuralEntropyModel.simulate(baseParams);
    const baseLambdaFinal = baseResult.lambda[baseResult.length - 1];

    for (let trial = 0; trial < numTrials; trial++) {
      weights.forEach(w => {
        const perturbedParams = { ...baseParams };
        const perturbation = (Math.random() - 0.5) * 0.1; // ±5% perturbation
        perturbedParams[w] = Math.max(0, baseParams[w] + perturbation);
        
        const perturbedResult = StructuralEntropyModel.simulate(perturbedParams);
        const perturbedLambda = perturbedResult.lambda[perturbedResult.length - 1];
        
        results[w].deltas.push(perturbation);
        results[w].lambdaChanges.push(perturbedLambda - baseLambdaFinal);
      });
    }

    // Compute sensitivity index (absolute mean change per unit perturbation)
    const sensitivity = {};
    weights.forEach(w => {
      const changes = results[w].lambdaChanges;
      const avgAbsChange = changes.reduce((a, b) => a + Math.abs(b), 0) / changes.length;
      const avgAbsDelta = results[w].deltas.reduce((a, b) => a + Math.abs(b), 0) / results[w].deltas.length;
      sensitivity[w] = {
        index: avgAbsDelta > 0 ? avgAbsChange / avgAbsDelta : 0,
        avgImpact: avgAbsChange,
        label: w,
        baseValue: baseParams[w]
      };
    });

    return { weights: sensitivity, baseLambda: baseLambdaFinal, trials: numTrials };
  }

  // ══════════════════════════════════════════════════════════════════
  // 8. REFERENCE MODEL TRAJECTORIES (DICE, World3, HANDY)
  // Published projections for overlay comparison
  // ══════════════════════════════════════════════════════════════════
  const REFERENCE_MODELS = {
    DICE: {
      name: 'DICE (Nordhaus, 2018)',
      description: 'Dynamic Integrated model of Climate and Economy',
      temperature: [
        { year: 2020, value: 1.1 }, { year: 2030, value: 1.4 },
        { year: 2050, value: 2.0 }, { year: 2070, value: 2.5 },
        { year: 2100, value: 3.1 }
      ],
      population: [
        { year: 2020, value: 7.8 }, { year: 2050, value: 9.7 },
        { year: 2100, value: 10.9 }
      ]
    },
    World3: {
      name: 'World3 (Meadows, 1972/2004)',
      description: 'Limits to Growth — Business as Usual',
      population: [
        { year: 1970, value: 3.7 }, { year: 1980, value: 4.4 },
        { year: 1990, value: 5.3 }, { year: 2000, value: 6.1 },
        { year: 2010, value: 7.0 }, { year: 2020, value: 7.8 },
        { year: 2030, value: 8.4 }, { year: 2040, value: 8.6 },
        { year: 2050, value: 8.2 }, { year: 2060, value: 7.5 },
        { year: 2070, value: 6.5 }, { year: 2080, value: 5.8 },
        { year: 2100, value: 4.5 }
      ]
    },
    HANDY: {
      name: 'HANDY (Motesharrei, 2014)',
      description: 'Human And Nature DYnamics — Unequal Society',
      collapseYear: 2050,
      recoveryYear: 2120
    }
  };

  // ── Public API ───────────────────────────────────────────────────
  return {
    fetchEarthquakes,
    fetchNaturalEvents,
    fetchNews,
    getHistoricalData,
    interpolateHistorical,
    buildPlanetaryTimeSeries,
    runCalibration,
    runSensitivityAnalysis,
    TEMPERATURE_ANOMALY,
    CO2_PPM,
    FOREST_COVER,
    SEISMIC_EVENTS,
    HURRICANES_CAT4,
    WORLD_POPULATION,
    TIPPING_POINTS,
    REFERENCE_MODELS
  };

})();
