import { translateMermaidToEditorialGraphics } from "../lib/export/visual-translator";
import { generateNanoBananaVisualGraphic, validateFigureFitness } from "../lib/export/gemini-image-generator";
import { marked } from "marked";

async function testTableAndNanoBanana() {
  console.log("=== TESTANDO PRESERVAÇÃO DE TABELAS MARKDOWN E MOTOR NANO BANANA 2 ===");

  // 1. Teste de Preservação de Tabelas Markdown
  const markdownWithRealTable = `
# Capítulo 5: Precificação Estratégica

A tabela a seguir comprova a maximização matemática da contribuição no nível ótimo:

| Preço Praticado (R$) | Porcentagem (%) | Quantidade Demandada (Unidades) | Contribuição Unitária (R$) | Contribuição Total (R$) |
| :--- | :--- | :--- | :--- | :--- |
| R$ 100,00 | 36,36% | 4 | R$ 40,00 | R$ 160,00 |
| R$ 80,00 | 25,00% | 6 | R$ 30,00 | R$ 180,00 |
| R$ 60,00 | 18,00% | 10 | R$ 20,00 | R$ 200,00 |

A leitura dos dados revela um padrão decisório fundamental.
  `;

  console.log("\n--- 1. Testando que Tabelas Markdown NÃO viram SVG deformado ---");
  const res = await translateMermaidToEditorialGraphics(
    markdownWithRealTable,
    "book_test_table",
    "chap_5",
    5,
    "trace_table_test",
    "task_table_test"
  );

  // A tabela Markdown deve ter sido 100% preservada como tabela Markdown
  if (!res.markdown.includes("| Preço Praticado (R$) |") || !res.markdown.includes("| R$ 100,00 |")) {
    console.error("ERRO: A tabela Markdown foi destruída ou modificada indevidamente!");
    process.exit(1);
  }

  // Deve gerar 0 gráficos pois a tabela é nativa do Markdown
  if (res.graphicsGenerated > 0) {
    console.error("ERRO: A tabela Markdown foi indevidamente convertida em SVG!");
    process.exit(1);
  }

  // Testar a conversão para HTML com o marked
  marked.setOptions({ gfm: true, breaks: false });
  const htmlOutput = marked.parse(res.markdown) as string;
  console.log("HTML GERADO:", htmlOutput);

  if (!htmlOutput.includes("<table>") || !htmlOutput.includes("Preço Praticado (R$)</th>") || !htmlOutput.includes("R$ 100,00</td>")) {
    console.error("ERRO: O HTML não contém a tabela estruturada <table>!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: A tabela Markdown foi preservada intacta e renderizada como <table> editorial!");

  // 2. Teste do Motor Nano Banana 2
  console.log("\n--- 2. Testando Motor Nano Banana 2 (Gemini Image Engine) ---");
  const nanoRes = await generateNanoBananaVisualGraphic({
    bookId: "book_test_banana",
    chapterNumber: 3,
    title: "Matriz de Posicionamento e Elasticidade Cruzada",
    conceptDescription: "Relação entre diferenciação de produto e sensibilidade a preço para líderes de mercado.",
    conceptType: "decision_matrix",
    traceId: "trace_banana_test",
    taskId: "task_banana_test",
  });

  if (!nanoRes.success || !nanoRes.htmlTag) {
    console.error(`ERRO no Nano Banana 2: ${nanoRes.error}`);
    process.exit(1);
  }

  if (!validateFigureFitness(nanoRes.htmlTag)) {
    console.error("ERRO: Validador de aptidão visual rejeitou a tag gerada pelo Nano Banana 2!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: Nano Banana 2 gerou e validou a figura com 100% de conformidade!");
  console.log("\nTag HTML gerada (amostra):");
  console.log(nanoRes.htmlTag.substring(0, 150) + "...\n");

  console.log("=======================================================");
  console.log("🎉 TODOS OS TESTES DE TABELA E NANO BANANA 2 PASSARAM!");
  console.log("=======================================================");
}

testTableAndNanoBanana().catch((e) => {
  console.error(e);
  process.exit(1);
});
