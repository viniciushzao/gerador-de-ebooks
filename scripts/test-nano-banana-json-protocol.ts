import { translateMermaidToEditorialGraphics } from "../lib/export/visual-translator";
import { formatEquationsForEditorial, cleanLatexMathFormatting } from "../lib/agents/chapter-writer";
import { validateFigureFitness } from "../lib/export/gemini-image-generator";

async function testNanoBananaProtocol() {
  console.log("=== TESTANDO O PROTOCOLO OBRIGATÓRIO JSON DO NANO BANANA 2 ===");

  // 1. Teste de bloco JSON válido do Nano Banana
  const markdownWithJson = `
# Capítulo 4: Canais de Distribuição e Cobertura

O alinhamento estratégico entre atacado e varejo direto exige um fluxo de decisão estruturado:

\`\`\`json:nano-banana
{
  "conceptType": "strategic_flow",
  "title": "Fluxo de Decisão em Canais de Distribuição",
  "caption": "Figura 4.1 — Fluxo de Decisão em Canais [Nano Banana 2 / OpenChart].",
  "items": [
    { "label": "1. Diagnóstico de Capilaridade", "description": "Mapeamento das forças regionais e índice de penetração." },
    { "label": "2. Alocação de Recursos", "description": "Definição de margens e bonificações no ponto de venda." },
    { "label": "3. Monitoramento de Ruptura", "description": "Controle contínuo de estoque e reposição automática." }
  ]
}
\`\`\`

A execução desse fluxo garante a máxima cobertura com mínima perda de margem.
  `;

  console.log("\n--- 1. Testando Bloco json:nano-banana Válido ---");
  const res1 = await translateMermaidToEditorialGraphics(
    markdownWithJson,
    "book_test_json",
    "chap_4",
    4,
    "trace_json_test",
    "task_json_test"
  );

  if (!res1.markdown.includes("<figure class=\"editorial-image\">")) {
    console.error("ERRO: O bloco json:nano-banana não foi convertido em figura editorial!");
    process.exit(1);
  }

  if (res1.graphicsGenerated !== 1) {
    console.error(`ERRO: Quantidade de gráficos gerados esperada: 1, obtida: ${res1.graphicsGenerated}`);
    process.exit(1);
  }

  console.log("✓ SUCESSO: Bloco json:nano-banana convertido perfeitamente em figura editorial de 300 DPI!");

  // 2. Teste de Bloco Incompleto (1 item) - Deve ser suprimido para evitar pilares vazios
  console.log("\n--- 2. Testando Bloco Incompleto com 1 Item (Deve ser Suprimido) ---");
  const markdownWithBadJson = `
\`\`\`json:nano-banana
{
  "conceptType": "conceptual_pillars",
  "title": "Gastos de Aquisição",
  "items": [
    { "label": "Gastos de Aquisição", "description": "Gastos de Retenção" }
  ]
}
\`\`\`
  `;

  const res2 = await translateMermaidToEditorialGraphics(
    markdownWithBadJson,
    "book_test_bad_json",
    "chap_4",
    4,
    "trace_bad_json",
    "task_bad_json"
  );

  if (res2.markdown.includes("<figure class=\"editorial-image\">")) {
    console.error("ERRO: Bloco com apenas 1 item foi indevidamente transformado em figura vazia!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: Bloco incompleto foi suprimido e não gerou gráfico deformado!");

  // 3. Teste de Formatação de Fórmulas e Equações Anti-Overflow
  console.log("\n--- 3. Testando Formatação de Equações Anti-Overflow ---");
  const rawEquation = `
Participação de Mercado em Unidades (%) = (Unidades Vendidas pela Marca / Total de Vendas do Mercado em Unidades)

Vendas Unitárias da Marca = Participação de Mercado em Unidades (%) * Total de Vendas do Mercado em Unidades
  `;

  const formattedEquations = formatEquationsForEditorial(rawEquation);

  if (!formattedEquations.includes("> **Fórmula / Relação Analítica:**")) {
    console.error("ERRO: As equações não foram devidamente encapsuladas em blocos de fórmula formatados!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: Equações formatadas em caixas editoriais seguras com quebra de linha protegida!");
  console.log("=======================================================");
  console.log("🎉 TODOS OS TESTES DO NANO BANANA 2 JSON FORAM APROVADOS!");
  console.log("=======================================================");
}

testNanoBananaProtocol().catch((e) => {
  console.error(e);
  process.exit(1);
});
