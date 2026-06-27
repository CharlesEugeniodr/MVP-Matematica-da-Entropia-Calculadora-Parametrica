# IFE — Índice de Fragilidade Estrutural
*Structural Fragility Index (SFI)*

> *formerly: Calculadora de Entropia Estrutural*

[![CI](https://github.com/CharlesEugeniodr/MVP-Matematica-da-Entropia-Calculadora-Parametrica/actions/workflows/ci.yml/badge.svg)](https://github.com/CharlesEugeniodr/MVP-Matematica-da-Entropia-Calculadora-Parametrica/actions)

Um motor estocástico não-linear baseado em **Equações Diferenciais com Atraso (DDEs)** para modelar o colapso socioambiental global e os limites da resiliência planetária.

---

## 🌀 O Modelo

O IFE (λ) é uma **métrica composta de fragilidade sistêmica** que quantifica a distância de uma civilização ao ponto de colapso, baseada em:

$$\lambda = w_1 \frac{N}{K_{eff}} + w_2 D + w_3 \Delta T + w_4 U + w_5 I - w_6 (T \times G) - w_7 R$$

Onde cada peso $w_i$ é calibrável por MCMC Bayesiano contra dados históricos reais (1970–2024).

### Atratores Dinâmicos:
- **Atrator Estável:** A civilização se mantém dentro da Capacidade de Suporte Dinâmica ($K_{eff}$)
- **Colapso Sistêmico:** Se $\lambda > \lambda_{crit}$, ocorre falência da capacidade de suporte

---

## ⚙️ Arquitetura (v4.0)

### 1. Assimetria Geopolítica (Norte vs Sul)
- **$N_n$ (Norte Global):** Alta infraestrutura, asilo migratório
- **$N_s$ (Sul Global):** Exposição a clima extremo, pressão migratória quando λ > 0.6

### 2. Motor Capitalista ($E$)
Economia global retroalimenta uso da terra e emissões, mas financia Agência Adaptativa.

### 3. 10 Variáveis de Estado (DDEs acopladas)
`Nn(t)`, `Ns(t)`, `E(t)`, `K_eff(t)`, `D(t)`, `R(t)`, `λ(t)`, `ΔT(t)`, `U(t)`, `I(t)`

---

## 🔬 Ferramentas Científicas (v4.0)

| Ferramenta | Descrição |
|------------|-----------|
| **MCMC Bayesiano** | Metropolis-Hastings com 3000 iterações, distribuições posteriores com IC 95% |
| **AIC/BIC** | Comparação formal de 5 modelos (Linear → IFE Completo) |
| **Validação Cruzada** | Treino 1970-2000, Teste 2000-2024 com Skill Score |
| **Sobol** | Sensibilidade global baseada em variância |
| **Auto-Calibração** | Grid search iterativo contra World Bank + NASA GISS |
| **Dados Reais** | APIs: USGS, NASA EONET, GDELT + datasets históricos (GDP, Gini, CO₂, FAO) |

---

## 📊 Dados de Validação

| Dataset | Fonte | Pontos |
|---------|-------|--------|
| População Mundial | World Bank | 13 |
| Anomalia Térmica | NASA GISS | 14 |
| PIB Mundial | World Bank / IMF | 13 |
| Coeficiente Gini | Branko Milanovic | 9 |
| Emissões CO₂ | Global Carbon Project | 14 |
| Uso do Solo | FAO | 7 |
| Investimento P&D | UNESCO | 8 |

**Total: 78 pontos de validação vs 8 parâmetros livres** (modelo bem determinado)

---

## 🚀 Como Executar

```bash
# Desenvolvimento
git clone https://github.com/CharlesEugeniodr/MVP-Matematica-da-Entropia-Calculadora-Parametrica.git
cd MVP-Matematica-da-Entropia-Calculadora-Parametrica
npm install
npx serve .

# Testes
npm test

# Linting
npm run lint
```

---

## 🏗️ CI/CD

Pipeline GitHub Actions:
1. **ESLint** — Linting de todos os arquivos JS
2. **Jest** — Testes unitários (integridade de módulos + fórmulas AIC/BIC)
3. **Validate** — Smoke test de integridade dos arquivos fonte

---

> *"Uma civilização que expande infinitamente em um ambiente finito só encontra duas vias de estabilização: regulação consciente ou fragilidade estrutural forçada."*

**Idealizado e construído por Charles Eugenio.**
