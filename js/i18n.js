/**
 * i18n.js — Dicionário de Internacionalização (PT-BR / EN-US)
 * Responsável por traduzir a interface e prover as manchetes da Global News Network (GNN).
 */

'use strict';

const I18n = (() => {
  let currentLang = 'pt'; // default

  const dict = {
    // Top Bar & Controls
    'title-main': {
      pt: 'Índice de Fragilidade Estrutural (IFE)',
      en: 'Structural Fragility Index (SFI)'
    },
    'subtitle': {
      pt: 'Sistema Dinâmico Não-Linear de Colapso Socioambiental',
      en: 'Non-Linear Dynamical System of Socio-Environmental Collapse'
    },
    'scenario-select-label': {
      pt: 'Cenário Base (1970–2100):',
      en: 'Baseline Scenario (1970–2100):'
    },
    'btn-csv': { pt: '📊 CSV', en: '📊 CSV' },
    'btn-pdf': { pt: '📄 Laudo PDF', en: '📄 PDF Report' },
    'btn-audio-on': { pt: '🔊 Som: ON', en: '🔊 Audio: ON' },
    'btn-audio-off': { pt: '🔈 Som: OFF', en: '🔈 Audio: OFF' },

    // Sidebar
    'sidebar-title': { pt: 'Parâmetros do Modelo', en: 'Model Parameters' },
    'gov-label': { pt: 'Políticas de Governança', en: 'Governance Policies' },
    'deg-label': { pt: 'Degradação Acelerada', en: 'Accelerated Degradation' },
    
    'shock-title': { pt: 'Injeção de Anomalias', en: 'Anomaly Injection' },
    'btn-war': { pt: 'Guerra Global', en: 'Global War' },
    'btn-pan': { pt: 'Pandemia', en: 'Pandemic' },
    'btn-tech': { pt: 'Salto Tecnológico', en: 'Tech Jump' },

    // Cards
    'card-lambda-title': { pt: 'IFE - Fragilidade Estrutural (λ)', en: 'SFI - Structural Fragility (λ)' },
    'card-pop-title': { pt: 'Dinâmica Populacional', en: 'Population Dynamics' },
    'card-deg-title': { pt: 'Degradação e Resiliência', en: 'Degradation & Resilience' },
    'card-phase-title': { pt: 'Espaço de Fase: N vs λ', en: 'Phase Space: N vs λ' },
    'card-map-title': { pt: 'Termodinâmica Global', en: 'Global Thermodynamics' },
    'card-seismo-title': { pt: 'Sismógrafo Climático', en: 'Climate Seismograph' },

    // Footer
    'footer-text': { 
      pt: 'Idealizado e construído por Charles Eugenio. Motor Estocástico com DDEs.',
      en: 'Idealized and built by Charles Eugenio. Stochastic Engine with DDEs.'
    },

    // Clock
    'clock-title': { pt: '⏱️ Relógio Atômico do IFE', en: '⏱️ IFE Atomic Clock' },
    'clock-sub': { pt: 'Acúmulo estrutural em tempo real', en: 'Real-time structural accumulation' },
    'status-stable': { pt: 'Órbita Estável', en: 'Stable Orbit' },
    'status-alert': { pt: 'Alerta Crítico', en: 'Critical Alert' },
    'status-collapse': { pt: 'Colapso em Andamento', en: 'Collapse in Progress' },

    // Monitor
    'monitor-title': { pt: '📡 Monitor Global de Anomalias', en: '📡 Global Anomaly Monitor' },

    // Tabs
    'tab-sim': { pt: 'Simulador Global', en: 'Global Simulator' },
    'tab-audit': { pt: 'Auditoria de Dados', en: 'Data Audit' },

    // Audit page
    'audit-title': { pt: 'Laudo Técnico e Auditoria do Modelo', en: 'Technical Report and Model Audit' },
    'audit-desc': { pt: 'Exposição dos tensores analíticos, parâmetros processados pelo motor Estocástico DDE e registros de ocorrências estruturais.', en: 'Analytical tensor exposition, parameters processed by the Stochastic DDE engine, and structural occurrence logs.' },

    // Chart titles (for canvas rendering)
    'chart-lambda-title-full': { pt: 'λ(t) — Pressão Entrópica Estrutural', en: 'λ(t) — Structural Entropic Pressure' },
    'chart-pop-title-full': { pt: 'N(t) vs K_eff(t) — População e Capacidade de Suporte', en: 'N(t) vs K_eff(t) — Population and Carrying Capacity' },
    'chart-deg-title-full': { pt: 'D(t) vs R(t) — Degradação e Resiliência', en: 'D(t) vs R(t) — Degradation and Resilience' },
    'chart-dashboard-title': { pt: 'Painel de Estado do Sistema', en: 'System State Dashboard' },
    'chart-phase-title-full': { pt: 'Espaço de Fase: N vs λ (Trajetória de Atração)', en: 'Phase Space: N vs λ (Attractor Trajectory)' },

    // Dashboard status labels
    'status-stable-label': { pt: '● ESTÁVEL', en: '● STABLE' },
    'status-alert-label': { pt: '● ALERTA', en: '● ALERT' },
    'status-critical-label': { pt: '● CRÍTICO', en: '● CRITICAL' },
    'status-collapse-label': { pt: '● COLAPSO', en: '● COLLAPSE' },

    // Phase space zone labels
    'zone-stable': { pt: 'Atrator Estável', en: 'Stable Attractor' },
    'zone-collapse': { pt: 'Zona de Colapso (Ruptura)', en: 'Collapse Zone (Rupture)' },

    // Planetary chart
    'chart-planetary-title': { pt: 'Indicadores Planetários — Dados Reais + Projeções', en: 'Planetary Indicators — Real Data + Projections' },
    'label-real-data': { pt: 'Dados Reais', en: 'Real Data' },
    'label-projection': { pt: 'Projeção', en: 'Projection' },
    'label-forest': { pt: 'Floresta (%)', en: 'Forest (%)' },
    'label-hurricanes': { pt: 'Furacões 4+', en: 'Hurricanes 4+' },

    // Thermal panel
    'thermal-stable': { pt: '🟢 ESTÁVEL', en: '🟢 STABLE' },
    'thermal-alert': { pt: '🟡 ALERTA', en: '🟡 ALERT' },
    'thermal-critical': { pt: '🔴 CRÍTICO', en: '🔴 CRITICAL' },
    'tipping-title': { pt: '🎯 Tipping Points Planetários', en: '🎯 Planetary Tipping Points' }
  };

  const newsFeeds = {
    pt: {
      low: [
        "G20 assina novo pacto agressivo de descarbonização global.",
        "Avanços em fusão nuclear reduzem dependência de fósseis.",
        "Mercados globais apresentam estabilidade recorde.",
        "ONU declara sucesso nas metas de recuperação de biodiversidade."
      ],
      medium: [
        "Furacão atinge a costa leste americana causando bilhões em danos.",
        "Racionamento de água extremo é decretado no sul da Europa.",
        "Tensões geopolíticas aumentam por disputas de terras aráveis.",
        "Incêndios florestais fora de controle na bacia do Equador.",
        "Picos de temperatura global ameaçam safras de grãos."
      ],
      high: [
        "COLAPSO: Milhões de refugiados climáticos deslocados por inundações litorâneas.",
        "Falha massiva nas colheitas globais engatilha fome em escala continental.",
        "LEI MARCIAL DECLARADA: Governos tentam conter distúrbios civis.",
        "Bolsas globais suspendem negociações por tempo indeterminado.",
        "Ruptura da cadeia de suprimentos isola países inteiros.",
        "Tsunami de calor letal devasta megacidades do hemisfério sul."
      ]
    },
    en: {
      low: [
        "G20 signs aggressive new global decarbonization pact.",
        "Advances in nuclear fusion drastically reduce fossil fuel reliance.",
        "Global markets show record-breaking stability.",
        "UN declares success in biodiversity recovery targets."
      ],
      medium: [
        "Category 5 Hurricane strikes US East Coast causing billions in damages.",
        "Extreme water rationing decreed across Southern Europe.",
        "Geopolitical tensions rise over arable land disputes.",
        "Wildfires burn out of control in the Equatorial basin.",
        "Global temperature spikes threaten international grain harvests."
      ],
      high: [
        "COLLAPSE: Millions of climate refugees displaced by coastal flooding.",
        "Massive global crop failures trigger continental-scale famine.",
        "MARTIAL LAW DECLARED: Governments struggle to contain civil unrest.",
        "Global stock markets suspend trading indefinitely.",
        "Supply chain rupture isolates entire nations.",
        "Lethal heat tsunami devastates megacities in the Global South."
      ]
    }
  };

  function setLanguage(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key] && dict[key][lang]) {
        // If it's a button or has specific formatting, preserve it
        if (el.tagName === 'BUTTON' && el.querySelector('span')) {
          // just an example if needed
        }
        el.textContent = dict[key][lang];
      }
    });
    // Trigger an event so charts can redraw their labels
    window.dispatchEvent(new Event('languageChanged'));
  }

  function getLanguage() {
    return currentLang;
  }

  function getText(key) {
    if (dict[key] && dict[key][currentLang]) return dict[key][currentLang];
    return key;
  }

  function getRandomNews(level) {
    const arr = newsFeeds[currentLang][level];
    if (!arr) return "...";
    return arr[Math.floor(Math.random() * arr.length)];
  }

  return {
    setLanguage,
    getLanguage,
    getText,
    getRandomNews
  };

})();
