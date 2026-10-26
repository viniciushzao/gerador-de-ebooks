---
name: snow-d3
description: Especialista em visualização de dados e engenharia de gráficos D3.js/SVG para transformar fluxos conceituais, diagramas de relacionamento, árvores hierárquicas e matrizes em gráficos vetoriais editoriais de alta densidade sem Mermaid.
---

# Skill: Snow D3 — Engenharia de Gráficos e Diagramas Vetoriais

Esta skill capacita os subagentes a atuar como engenheiros de visualização de dados nível sênior, convertendo estruturas abstratas e diagramas em gráficos vetoriais nativos (SVG/D3).

## 1. Tipologias de Visualização Suportadas
- **Fluxos Estratégicos & Processos (Strategic Flows):** Conversão de fluxos passo a passo com setas orientadas, caixas de decisão e nós dimensionados.
- **Árvores & Hierarquias (Hierarchy Trees):** Visualização de taxonomias, pilares e desdobramentos conceituais.
- **Gráficos de Comparação e Métricas:** Barras comparativas, distribuições e quadrantes estratégicos.
- **Matrizes 2x2 & Tabelas Analíticas:** Comparações estruturadas com cores temáticas.

## 2. Regras de Conversão (Mermaid -> Gráficos Vetoriais)
1. **Zero Mermaid em Texto:** Sempre que o modelo identificar a necessidade de um `flowchart`, `graph TD` ou `sequenceDiagram`, a estrutura é traduzida em nós vetoriais e caixas contidas em `<foreignObject>`.
2. **Contenção Estrita:** Todo texto é restrito por `word-wrap: break-word`, impedindo sangria e sobreposição.
3. **Estilo Editorial:** Paleta Slate (#0f172a), Emerald (#059669), Blue (#2563eb) e fundos com gradientes limpos.
