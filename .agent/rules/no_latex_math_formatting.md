# Regra Global: Proibição Estrita de Formatação LaTeX / Math nos Textos

## 1. Diretiva Central
É **expressamente proibido** o uso de notação e formatação LaTeX ou MathJax (`$...$`, `$$...$$`, `\text{...}`, `\frac{...}{...}`, `\sum`, `\mathcal{...}`, `\times`, `_{...}`, `^{...}`, etc.) em qualquer texto gerado pelos agentes (CEO, Escritores, Designer).

O sistema de compilação editorial e os leitores do livro operam com Markdown padrão e HTML limpo, sem renderizador matemático (KaTeX/MathJax). O uso de LaTeX polui visualmente o livro com códigos ininteligíveis para o leitor final.

---

## 2. Padrão Obrigatório de Notação

### ❌ Proibido (Notação LaTeX / Math):
```latex
A Participação Unitária de Mercado ($\text{MS}_{\text{un}}$) é dada por:
$$\text{Participação Unitária de Mercado (%)} = \frac{\text{Vendas Unitárias da Marca } (q)}{\text{Total de Vendas do Mercado } (Q)}$$
Onde $R = q \times P_{\text{marca}}$ e $\mathcal{R} = \sum (q_i \times P_i)$.
```

### ✅ Permitido (Prosa Clara e Notação Textual Limpa):
```markdown
A Participação Unitária de Mercado (MS_un) é calculada pela relação entre o volume de unidades vendidas e o mercado total:

> Participação Unitária de Mercado (%) = (Vendas Unitárias da Marca [q] / Total de Vendas do Mercado [Q]) * 100

Onde a Receita Total (R) é obtida por: R = q * Preço_marca, e a receita agregada do mercado representa o somatório de todas as vendas unitárias multiplicadas pelos seus respectivos preços praticados.
```

---

## 3. Diretrizes para Equações, Métricas e Relações Lógicas
1. **Expressões Matemáticas:** Utilize caracteres comuns do teclado (`+`, `-`, `*`, `/`, `=`, `( )`, `[ ]`).
2. **Frações:** Escreva na forma linear: `(Numerador / Denominador)`.
3. **Subscritos e Sobrescritos:** Utilize convenções textuais simples (ex: `P_marca`, `X_1`, `R^2` ou por extenso).
4. **Símbolos Especiais:** Substitua `\times` por `*` ou `"vezes"`, `\sum` por `"somatório de"`, `\Delta` por `"variação de"`, etc.
5. **Destaque Visual:** Coloque equações importantes dentro de blocos de citação (`> Equação`) ou caixas de destaque explicativas.
