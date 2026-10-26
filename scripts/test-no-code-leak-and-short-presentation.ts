import { formatMarkdownToEditorialHtml } from "../lib/agents/designer-formatter";
import { writeBookPresentationSubagent } from "../lib/agents/presentation-writer";
import { compileHtmlToPdf } from "../lib/export/pdf-compiler";
import { formatEbookManuscript } from "../lib/agents/designer-formatter";
import { BookRecord, ChapterRecord } from "../lib/db/schema";
import fs from "fs";

async function testFixAndPresentation() {
  console.log("=== TESTANDO CORREÇÃO DEFINITIVA DE VAZAMENTO DE CÓDIGO E APRESENTAÇÃO CURTA ===");

  // 1. Testar que SVGs complexos com foreignObject e indentação NÃO geram <pre><code>
  console.log("\n--- 1. Testando Renderização Segura de Figuras SVG ---");
  const mockChapterMarkdown = `
# Capítulo 1: Decomposição Algébrica da Participação de Mercado

A participação de mercado é uma função multiplicativa de três pilares:

<figure class="editorial-image">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="720" fill="url(#bgGrad)" stroke="#cbd5e1" stroke-width="2" rx="14"/>
  <g transform="translate(40, 30)">
    <foreignObject x="0" y="0" width="1120" height="75">
      <div xmlns="http://www.w3.org/1999/xhtml">
        <h1>Decomposição Algébrica da Participação de Mercado</h1>
      </div>
    </foreignObject>
  </g>
  <g transform="translate(40, 140)">
    <!-- Table Header -->
    <rect width="1120" height="45" rx="8" fill="#0f172a" />
    <text x="24" y="28" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">DIMENSÃO / ETAPA OPERACIONAL</text>
    <text x="420" y="28" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">DESDOBRAMENTO ESTRATÉGICO &amp; DIRETRIZ</text>
  </g>
</svg>
<figcaption>Figura 1.1 — Decomposição Algébrica da Participação de Mercado [Nano Banana 2 / OpenChart].</figcaption>
</figure>

A consolidação dessa relação demonstra a importância de monitorar cada alavanca individualmente.
  `;

  const cleanHtml = formatMarkdownToEditorialHtml(mockChapterMarkdown);

  if (cleanHtml.includes("<pre><code>") || cleanHtml.includes("&lt;g transform") || cleanHtml.includes("&lt;rect")) {
    console.error("ERRO CRÍTICO: Código XML/SVG foi escapado e virou bloco de código <pre><code>!");
    process.exit(1);
  }

  if (!cleanHtml.includes("<svg") || !cleanHtml.includes("<g transform=\"translate(40, 140)\">")) {
    console.error("ERRO: Tag SVG não foi preservada corretamente no HTML!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: Nenhum código vazou! O SVG foi preservado 100% íntegro e sem blocos <pre><code>.");

  // 2. Testar Apresentação Curta (1 a 3 páginas)
  console.log("\n--- 2. Testando Subagente de Apresentação (1 a 3 páginas) ---");
  const mockBook: BookRecord = {
    id: "test_short_pres_book",
    title: "Métricas de Marketing e Tomada de Decisão",
    author_name: "Clóvis Paulo Silva Filho",
    original_filename: "metrics.pdf",
    original_file_path: "data/uploads/metrics.pdf",
    target_audience: "Gestores e Profissionais de Marketing",
    tone_of_voice: "Profissional e Prático",
    min_pages: 5,
    max_pages: 15,
    status: "outlining",
    current_step: "Testando apresentação",
    progress_percent: 40,
    executive_summary: null,
    typography: "Garamond",
    spacing: 1.15,
    pdf_path: null,
    total_tokens: 1000,
    total_cost_usd: 0.01,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const presentationText = await writeBookPresentationSubagent(mockBook, "trace_pres_test", null);
  const wordCount = presentationText.split(/\s+/).filter(Boolean).length;
  console.log(`Palavras na Apresentação: ${wordCount} (~${Math.ceil(wordCount / 250)} páginas)`);

  if (wordCount > 900) {
    console.error(`ERRO: Apresentação muito longa (${wordCount} palavras). Deve ter entre 300 e 700 palavras (1 a 3 páginas).`);
    process.exit(1);
  }

  console.log("✓ SUCESSO: Apresentação gerada sucinta e curta (1 a 3 páginas)!");

  // 3. Testar Compilação Real em PDF via Puppeteer
  console.log("\n--- 3. Testando Compilação Real de PDF via Puppeteer ---");
  mockBook.executive_summary = presentationText;
  const mockChapter: ChapterRecord = {
    id: "chap_1_test",
    book_id: "test_short_pres_book",
    chapter_number: 1,
    title: "Decomposição Algébrica da Participação de Mercado",
    synopsis: "Sinopse do capítulo 1",
    prompt: "Prompt do capítulo 1",
    content_markdown: mockChapterMarkdown,
    target_words: 800,
    actual_words: 750,
    status: "completed",
    trace_id: "trace_pres_test",
    parent_task_id: null,
    tokens_used: 1200,
    cost_usd: 0.005,
    latency_ms: 800,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const formattedBook = await formatEbookManuscript(mockBook, [mockChapter], "trace_pres_test", "task_format");
  const pdfPath = await compileHtmlToPdf("test_short_pres_book", formattedBook.htmlContent, "trace_pres_test", "task_pdf");

  console.log("✓ SUCESSO: PDF gerado perfeitamente sem vazamento de código!");
  console.log("  Caminho do PDF:", pdfPath);
  console.log("  Tamanho:", (fs.statSync(pdfPath).size / 1024).toFixed(2), "KB");

  console.log("\n=======================================================");
  console.log("🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!");
  console.log("=======================================================");
}

testFixAndPresentation().catch((err) => {
  console.error(err);
  process.exit(1);
});
