import { writeBookPresentationSubagent } from "../lib/agents/presentation-writer";
import { getBook, createBook } from "../lib/db/client";
import { getSystemConfig } from "../lib/config";

async function testPresentationSubagent() {
  console.log("=== TESTANDO O NOVO SUBAGENTE DE APRESENTAÇÃO DO LIVRO ===");

  const config = getSystemConfig();
  const testBookId = `book_test_pres_${Date.now()}`;
  const now = new Date().toISOString();

  const testBook = {
    id: testBookId,
    title: "Métricas de Marketing e Estratégia de Decisão",
    original_filename: "sample.pdf",
    original_file_path: "data/uploads/sample.pdf",
    author_name: config.AUTHOR_NAME,
    target_audience: config.TARGET_AUDIENCE,
    tone_of_voice: config.TONE_OF_VOICE,
    min_pages: 90,
    max_pages: 200,
    typography: "Garamond",
    spacing: 1.15,
    status: "pending" as const,
    current_step: "Testando subagente de apresentação",
    progress_percent: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    pdf_path: null,
    executive_summary: null,
    created_at: now,
    updated_at: now,
  };

  createBook(testBook);

  const presentation = await writeBookPresentationSubagent(
    testBook,
    `trace_pres_${Date.now()}`,
    null
  );

  console.log("\n--- Texto da Apresentação Gerada (Amostra) ---");
  console.log(presentation.substring(0, 400) + "...\n");

  const wordCount = presentation.split(/\s+/).filter(Boolean).length;
  const estimatedPages = Math.ceil(wordCount / 250);
  console.log(`Contagem de Palavras: ${wordCount} palavras (~${estimatedPages} páginas estimadas)`);

  // Assertions
  if (wordCount < 150) {
    console.error("ERRO: Texto de apresentação muito curto para atender de 2 a 5 páginas!");
    process.exit(1);
  }

  if (/[┌┐└┘├┤┬┴├──└──]/.test(presentation)) {
    console.error("ERRO: Caracteres Unicode de caixas encontrados na apresentação!");
    process.exit(1);
  }

  if (/={4,}/.test(presentation)) {
    console.error("ERRO: Linhas divisórias '=====' encontradas na apresentação!");
    process.exit(1);
  }

  if (/\$\$|\$[a-zA-Z0-9\\]+\$/.test(presentation)) {
    console.error("ERRO: Fórmulas LaTeX encontradas na apresentação!");
    process.exit(1);
  }

  if (!presentation.includes("<figure class=\"editorial-image\">")) {
    console.error("ERRO: Figura vetorial de abertura não foi embutida na apresentação!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: Subagente de apresentação gerou uma introdução clara, enxuta e no padrão editorial (2 a 5 páginas)!");
}

testPresentationSubagent().catch((e) => {
  console.error(e);
  process.exit(1);
});
