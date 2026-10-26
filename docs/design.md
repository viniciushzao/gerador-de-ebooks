# Diretrizes de Design & Tipografia Editorial

## 1. Design de Livros Impressos (Miolo)

O sistema segue padrões internacionais de design editorial e tipografia clássica:

- **Famílias Tipográficas Homologadas:**
  - `Garamond` (Padrão para literatura e humanidades)
  - `Baskerville` (Padrão clássico de alta legibilidade)
  - `Palatino Linotype` (Ideal para textos densos e técnicos)
  - `Georgia` (Excelente contraste e clareza visual)
- **Densidade Editorial de Palavras por Página:**
  - `Trade Book 6x9`: ~270 palavras/página
  - `A5`: ~250 palavras/página
  - `Digest 5.5x8.5`: ~230 palavras/página
  - `A4`: ~450 palavras/página
  - `Pocket`: ~190 palavras/página
- **Entrelinha e Espaçamento:**
  - Entrelinha padrão de 1.15 a 1.35 para ritmo visual equilibrado.
  - Alinhamento justificado com hifenação suave e recuo de parágrafo consistente.

---

## 2. Elementos Gráficos & OpenChart

- **Gráficos Inline SVG:**
  - Todos os diagramas, matrizes de decisão e fluxos conceituais são renderizados diretamente no DOM como nós `<svg>` inline a 300 DPI.
  - Elimina o uso de tags `<img>` para SVGs que continham `foreignObject` (incompatíveis com Puppeteer).
- **Sem Ruídos de Diagramas:**
  - O pipeline expurga blocos textuais soltos de Mermaid e caixas ASCII malformadas.

---

## 3. Padrão de Capa Completa Wraparound Amazon KDP

- **Geometria de Spread Contínuo:**
  - Zona Esquerda (Contracapa): Sinopse editorial, destaques analíticos e área 100% branca reservada para código de barras (sem colisão de elementos).
  - Zona Central (Lombada): Largura calculada dinamicamente: `actual_pages * 0.002252"` (para papel branco). Texto vertical ativado apenas se `actual_pages >= 80`.
  - Zona Direita (Capa Frontal): Kicker editorial, título principal assertivo e motivo visual vetorial no terço inferior direito.
- **Fusão Visual Temática:**
  - Combinação obrigatória de **Blueprint Técnico** (linhas de engenharia/mecanismo) com **Linhas de Fluxo Orgânicas** (energia, térmicas ou fluidos).
  - Sem molduras cinzas, sem mockups 3D e sem setas ou cotas numéricas desenhadas na arte.
