import { translateMermaidToEditorialGraphics } from "../lib/export/visual-translator";
import { purgeMermaidDiagrams, cleanLatexMathFormatting } from "../lib/agents/chapter-writer";

async function testAsciiTranslation() {
  const sampleMarkdownWithAscii = `
• Margem de Contribuição (%) = (Contribuição por Unidade (R$) / Preço de Venda por Unidade (R$)) * 100

Se a análise for realizada sobre a receita consolidada do negócio:
• Contribuição Total (R$) = Receita Total (R$) - Custos Variáveis Totais (R$)

[MECANISMO DE ABSORÇÃO DA MARGEM DE CONTRIBUIÇÃO]

+--------------------------------------------------------+
|               PREÇO DE VENDA UNITÁRIO (R$)             |
+---------------------------+----------------------------+
|  Custo Variável Unitário   | CONTRIBUIÇÃO POR UNIDADE   |
| (Consumido imediatamente  | (Disponível para cobrir     |
|  pela produção/venda)     | Custos Fixos e Lucro)      |
+---------------------------+----------------------------+
                            |
                     +------+------+
                     v
+---------------------------+----------------------------+
| 1. Cobertura dos Custos   | 2. Geração de Lucro Líquido|
|    Fixos                  |                            |
| (Até atingir Break-Even)  | (Acima do Break-Even)      |
+---------------------------+----------------------------+

O Ponto de Equilíbrio Contábil (Break-Even Point)
O ponto de equilíbrio representa o estágio operacional em que a receita total gerada iguala a soma dos custos.
  `;

  console.log("=== ENTRADA COM DIAGRAMA ASCII ===");
  console.log(sampleMarkdownWithAscii);

  const res = await translateMermaidToEditorialGraphics(
    sampleMarkdownWithAscii,
    "book_test_ascii",
    "chap_test_ascii",
    3,
    "trace_ascii_test",
    "task_ascii_test"
  );

  let finalMarkdown = res.markdown;
  finalMarkdown = purgeMermaidDiagrams(finalMarkdown);
  finalMarkdown = cleanLatexMathFormatting(finalMarkdown);

  console.log("\n=== SAÍDA TRADUZIDA (ZERO ASCII BOXES / IMAGEM EDITORIAL GERADA) ===");
  console.log(finalMarkdown);

  if (finalMarkdown.includes("+-------") || finalMarkdown.includes("|  Custo Variável")) {
    console.error("ERRO: Diagrama ASCII residual encontrado!");
    process.exit(1);
  }

  if (!finalMarkdown.includes("<figure class=\"editorial-image\">")) {
    console.error("ERRO: Imagem SVG de alta resolução não foi gerada para o diagrama ASCII!");
    process.exit(1);
  }

  if (finalMarkdown.includes("()")) {
    console.error("ERRO: Parênteses vazios '()' encontrados!");
    process.exit(1);
  }

  console.log("\n✓ SUCESSO: O diagrama ASCII foi interceptado com perfeição e convertido em figura editorial vetorial!");
}

testAsciiTranslation().catch((e) => {
  console.error(e);
  process.exit(1);
});
