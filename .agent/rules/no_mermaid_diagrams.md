# Regra Global: Motor Visual Nano Banana 2 & Proibição Absoluta de Diagramas em Texto

## 1. Diretiva Central & Proibições
É **terminantemente proibido** aos agentes e subagentes (CEO, Escritores, Designer) desenhar qualquer tipo de diagrama, árvore, matriz, fluxo ou quadro através de texto ou caracteres monoespaçados, incluindo:
1. **Blocos de Código Mermaid:** ` ```mermaid `, `graph TD`, `flowchart`, `sequenceDiagram`, `classDiagram`, `gantt`, etc.
2. **Caixas e Árvores Unicode:** `┌───┐`, `└─┬─┘`, `│`, `▼`, `▲`, `├──`, `└──`, `├─`, `└─`.
3. **Cascatas de Demonstração / Fórmulas:** Linhas de cálculo estruturadas com `====`, `(-)` e `= NOPAT`.
4. **Linhas do Tempo Textuais:** Linhas com barras verticais e setas (`Ano 0: ... -> ... | Ano 1: ...`).
5. **Matrizes e Eixos Cartesianos em Texto:** Eixos como `▲ \n │ [MARCA...]`.
6. **Caixas em ASCII Tradicional:** `+---+`, `+===+`.

---

## 2. Regra Obrigatória do Motor Nano Banana 2 (JSON Estruturado)

1. **Gráficos NÃO são obrigatórios em todos os capítulos:** O subagente deve incluir figuras apenas quando julgar estritamente necessário para elucidar modelos mentais, arquiteturas ou fluxos de decisão.
2. **Protocolo Obrigatório de Emissão JSON:** Se o subagente desejar incluir uma figura explicativa, ele **DEVE OBRIGATORIAMENTE** emitir um bloco estruturado no formato:
```json:nano-banana
{
  "conceptType": "strategic_flow" | "conceptual_pillars" | "comparison_table" | "decision_matrix" | "timeline" | "financial_cascade",
  "title": "Título Claro e Conciso da Figura",
  "caption": "Legenda explicativa sucinta da figura",
  "items": [
    { "label": "Pilar / Etapa 1", "description": "Explicação técnica clara e concisa." },
    { "label": "Pilar / Etapa 2", "description": "Explicação técnica clara e concisa." }
  ]
}
```
3. **Processamento e Validação no Nano Banana 2:**
   - O motor Nano Banana 2 processa o JSON, gera a figura vetorial SVG de alta resolução (300 DPI) e valida no **Quality Gate** (`Image Reviewer`).
   - Se a figura for 100% aprovada, ela é diagramada no manuscrito através de `<figure class="editorial-image"><img ... /><figcaption>...</figcaption></figure>`.
   - Se os dados forem insuficientes ou malformados, o bloco é removido com segurança sem quebrar o livro nem gerar gráficos vazios.

---

## 3. Dados Tabulares & Fórmulas Matemáticas
- **Tabelas de Dados:** Devem ser escritas em **Tabelas Markdown Padrão** (`| Col 1 | Col 2 |\n|---|---|`), as quais são preservadas intactas e estilizadas com CSS editorial de luxo.
- **Fórmulas Matemáticas:** Não use LaTeX ($...$). Escreva em prosa limpa ou em destaque com quebra suave de linha para não ultrapassar as margens da página A5.
