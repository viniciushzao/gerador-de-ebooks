import { translateMermaidToEditorialGraphics } from "../lib/export/visual-translator";
import { purgeMermaidDiagrams, cleanLatexMathFormatting } from "../lib/agents/chapter-writer";

async function testAllVisualPatterns() {
  const case1_UnicodeBoxTree = `
# Imagem 1: Universo Total de Lojas

┌──────────────────────────────────────┐
│ Universo Total de Lojas no Mercado   │
└──────────────────┬───────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ Distribuição Num.│ │ Distribuição Pot.│
│ (Contagem pura)  │ │ (Potencial fina) │
└──────────────────┘ └─────────┬────────┘
                               │
                     ┌─────────┴────────┐
                     ▼                  ▼
             ┌──────────────────┐
             │ Volume Todos Prod│
             │ (ACV / VTP)      │
             └──────────────────┘

Texto explicativo subsequente sobre Distribuição Numérica.
  `;

  const case2_UnicodeTreeList = `
# Imagem 2: Ruptura no Ponto de Venda

Ruptura no Ponto de Venda (OOS)
├── 1. Substitui pela mesma marca -> Fabricante mantém venda
├── 2. Substitui por marca concorrente -> Fabricante PERDE venda
├── 3. Compra em outra loja -> Varejista PERDE venda
└── 4. Cancela a compra da categoria -> Fabricante e Varejista perdem

Se o consumidor substitui a marca por um concorrente direto...
  `;

  const case3_FinancialCascade = `
# Imagem 3: Cascata do EVA

CASCATA DO VALOR ECONÔMICO AGREGADO (EVA)

Receita Bruta Operacional
  (-) Custos dos Produtos Vendidos (CPV)
  (-) Despesas de Vendas, Gerais e Administrativas (SG&A)
============================================================
= Lucro Operacional Antes dos Impostos (EBIT)
  (-) Impostos Sobre a Renda Operacional
============================================================
= NOPAT (Lucro Operacional Líquido Após Impostos)
  (-) Custo de Oportunidade do Capital [Capital Empregado * WACC]
============================================================
= LUCRO ECONÔMICO (EVA em R$)

O Custo Médio Ponderado de Capital...
  `;

  const case4_Timeline = `
# Imagem 4: Linha do Tempo de Marketing

LINHA DO TEMPO DO FLUXO DE CAIXA DE PROJETOS DE MARKETING

Ano 0: Desembolso Inicial (P&D, Mídia de Lançamento, Infraestrutura) -> Fluxo Negativo
|
Ano 1: Penetração de Mercado e Aquisição de Primeiros Clientes -> Fluxo Neutro
|
Ano 2: Recompra de Clientes, Expansão de Base e Diluição de Custos -> Fluxo Crescente
|
Ano 3+: Maturação da Marca, Maximização de Margem e Lucro Residual -> Fluxo Elevado

Valor Presente Líquido (VPL) e a Taxa de Desconto de Risco...
  `;

  const case5_DualPillar = `
# Imagem 5: Pilares BAV

PILAR DA FORÇA DA MARCA       PILAR DA ESTATURA DA MARCA
┌─────────────────────────┐   ┌─────────────────────────┐
│ DIFERENCIAÇÃO           │   │ ESTIMA                  │
│ (Singularidade e Margem)│   │ (Respeito e Reputação)  │
├─────────────────────────┤   ├─────────────────────────┤
│ RELEVÂNCIA              │   │ CONHECIMENTO            │
│ (Adequação e Penetração)│   │ (Familiaridade Histórica│
└───────────┬─────────────┘   └───────────┬─────────────┘
            ▼                             ▼
   FORÇA DA MARCA                ESTATURA DA MARCA

Arquétipos Dinâmicos de Portfólio no BAV.
  `;

  const cases = [
    { name: "Caso 1 (Unicode Box Tree)", text: case1_UnicodeBoxTree },
    { name: "Caso 2 (Unicode Tree List)", text: case2_UnicodeTreeList },
    { name: "Caso 3 (Cascata Financeira)", text: case3_FinancialCascade },
    { name: "Caso 4 (Linha do Tempo)", text: case4_Timeline },
    { name: "Caso 5 (Pilares / Matriz BAV)", text: case5_DualPillar },
  ];

  console.log("=== TESTANDO TODOS OS 5 CASOS DAS IMAGENS ENVIADAS PELO USUÁRIO ===");

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    console.log(`\n--- Testando ${c.name} ---`);
    const res = await translateMermaidToEditorialGraphics(
      c.text,
      "book_test_5cases",
      `chap_${i + 1}`,
      i + 1,
      "trace_test_5",
      `task_test_${i + 1}`
    );

    let finalMarkdown = res.markdown;
    finalMarkdown = purgeMermaidDiagrams(finalMarkdown);
    finalMarkdown = cleanLatexMathFormatting(finalMarkdown);

    // Assertions
    if (!finalMarkdown.includes("<figure class=\"editorial-image\">")) {
      console.error(`ERRO no ${c.name}: Nenhuma tag <figure class="editorial-image"> foi gerada!`);
      process.exit(1);
    }

    if (/[┌┐└┘├┤┬┴├──└──]/.test(finalMarkdown)) {
      console.error(`ERRO no ${c.name}: Caracteres de caixa Unicode ainda presentes!`);
      process.exit(1);
    }

    if (/={4,}/.test(finalMarkdown)) {
      console.error(`ERRO no ${c.name}: Linhas de igual '=====' ainda presentes!`);
      process.exit(1);
    }

    console.log(`✓ ${c.name} interceptado e convertido com sucesso em figura SVG editorial!`);
  }

  console.log("\n=======================================================");
  console.log("🎉 TODOS OS 5 CASOS DAS IMAGENS FORAM 100% VALIDADOS!");
  console.log("=======================================================");
}

testAllVisualPatterns().catch((e) => {
  console.error(e);
  process.exit(1);
});
