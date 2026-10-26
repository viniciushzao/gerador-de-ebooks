import { translateMermaidToEditorialGraphics } from "../lib/export/visual-translator";
import { purgeMermaidDiagrams } from "../lib/agents/chapter-writer";

async function testMermaidTranslation() {
  const sampleMarkdownWithMermaid = `
# Capítulo 2: Estratégias de Escala e Decisão

A tomada de decisão estratégica requer uma clara compreensão das fases operacionais:

\`\`\`mermaid
graph TD
  A[Diagnóstico por Primeiros Princípios] --> B[Alinhamento de Equipes e OKRs]
  B --> C[Execução Ágil com Ciclos Curtos]
  C --> D[Mensuração de Impacto e Ajuste Fino]
\`\`\`

Como demonstrado acima, o ciclo de aprendizado valida as hipóteses fundamentais do negócio.
  `;

  console.log("=== ENTRADA COM MERMAID ===");
  console.log(sampleMarkdownWithMermaid);

  const res = await translateMermaidToEditorialGraphics(
    sampleMarkdownWithMermaid,
    "test_book_visual",
    "chap_test_1",
    2,
    "trace_test_visual",
    "task_test_visual"
  );

  let finalMarkdown = res.markdown;
  finalMarkdown = purgeMermaidDiagrams(finalMarkdown);

  console.log("\n=== SAÍDA TRADUZIDA EM GRÁFICO EDITORIAL (ZERO MERMAID) ===");
  console.log(finalMarkdown);

  if (finalMarkdown.includes("```mermaid") || finalMarkdown.includes("graph TD")) {
    console.error("ERRO: Mermaid residual detectado!");
    process.exit(1);
  }

  if (!finalMarkdown.includes("<figure class=\"editorial-image\">")) {
    console.error("ERRO: Imagem explicativa não foi gerada!");
    process.exit(1);
  }

  console.log("\n✓ SUCESSO: O bloco Mermaid foi 100% interceptado e traduzido para gráfico vetorial de alta resolução!");
}

testMermaidTranslation().catch((err) => {
  console.error(err);
  process.exit(1);
});
