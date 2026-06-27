# Calculadora de Entropia Estrutural (Fase 2)

Um motor estocástico não-linear baseado em **Equações Diferenciais com Atraso (DDEs)** para modelar o colapso socioambiental global e os limites da resiliência planetária.

---

## 🌀 A Filosofia do Modelo

Este modelo matemático rejeita a ideia de crescimento infinito. Em vez de tratar a civilização como uma entidade imune às leis da Termodinâmica, o motor calcula a **Entropia Estrutural** ($\lambda$) — o desgaste acumulado na malha de recursos da Terra gerado pela expansão demográfica e econômica.

O sistema possui **Atratores Dinâmicos**:
- **Atrator Estável:** A civilização se mantém dentro da Capacidade de Suporte Dinâmica ($K_{eff}$), controlando a Entropia e limitando a anomalia térmica ($\Delta T$).
- **Colapso Sistêmico:** Se $\lambda$ ultrapassa o Limiar Crítico ($\lambda_{crit}$), ocorre a falência da capacidade de suporte e a rápida degradação do sistema, forçando uma correção brusca (e catastrófica) da população.

---

## ⚙️ Arquitetura do Motor (Fase 2)

A Fase 2 adiciona densidade geopolítica e econômica ao motor:

### 1. Assimetria Geopolítica (Norte vs Sul)
A população humana foi dividida em duas variáveis interdependentes:
- **$N_{n}$ (Norte Global):** Zonas de alta infraestrutura, que funcionam como asilo migratório.
- **$N_{s}$ (Sul Global):** Zonas altamente expostas ao clima extremo e à falência hídrica/alimentar. Quando o Sul atinge um ponto de ruptura ($\lambda > 0.6$), a pressão migratória deforma as curvas populacionais em direção ao Norte.

### 2. O Motor Capitalista ($E$)
O sistema simula a **Economia Global (Trilhões de Dólares)**.
O Capital ($E$) retroalimenta o uso da terra ($U$) e a queima de fósseis (aumentando a Anomalia Térmica $\Delta T$). Contudo, é o Capital que financia a **Agência Adaptativa**: se a civilização perceber a aproximação do colapso, ela tenta "queimar" capital para forçar Inovações Tecnológicas.

### 3. As Variáveis de Estado
O solver numérico resolve 10 variáveis diferenciais acopladas:
- `Nn(t)` e `Ns(t)`: Populações do Norte e do Sul
- `E(t)`: Economia Capitalista Global
- `K_eff(t)`: Capacidade de Suporte da Terra
- `D(t)` e `R(t)`: Degradação Ambiental e Resiliência Planetária
- `λ(t)`: Entropia Estrutural Acumulada
- `ΔT(t)`: Anomalia Térmica (Aquecimento Global)
- `U(t)`: Sobrecarga de Uso da Terra
- `I(t)`: Desigualdade Estrutural Global

---

## 🖥️ A Interface do Simulador

O painel inclui monitoramento em tempo real (Painel de Colapso), suporte bilíngue, e as seguintes ferramentas:

- **Espaço de Fase Matemático:** Um gráfico mapeando o Atrator Caótico, demonstrando se a civilização orbita em segurança ou se está espiralando em direção ao Tipping Point.
- **Sismógrafo Entrópico:** Um osciloscópio estocástico reagindo aos níveis de tensão da Entropia, registrando picos visuais durante Terremotos ou Tsunamis simulados pelo clima.
- **Global News Network (GNN):** Ticker estocástico de notícias que escala do amarelo ao vermelho intenso conforme a Entropia sobe.
- **Auditoria de Dados Densos:** Uma aba dedicada contendo a tabela de vetores paramétricos pre- e post-simulação, monitorando o ponto de colapso de forma científica e clara.
- **Laudo IPCC Exportável:** Geração de um arquivo PDF denso contendo o histórico das oscilações, a leitura tabular dos impactos estruturais, e a exportação visual dos gráficos.

---

## 🚀 Como Executar

O projeto é construído estritamente com **Vanilla HTML, CSS e JavaScript**. Sem frameworks inchados, garantindo a velocidade de processamento necessária para resolver as ODEs no navegador.

1. Faça o clone do repositório.
2. Abra o arquivo `index.html` em qualquer navegador moderno (Chrome, Firefox, Safari, Edge).
3. (Opcional) Suba os arquivos em qualquer servidor estático como GitHub Pages ou Vercel.

---

> *"Uma civilização que expande infinitamente em um ambiente finito só encontra duas vias de estabilização: regulação consciente ou entropia estrutural forçada."*

**Idealizado e construído por Charles Eugenio.**
