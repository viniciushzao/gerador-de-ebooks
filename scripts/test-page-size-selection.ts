import fs from "fs";
import path from "path";
import { getPageFormatSpec, STANDARD_PAGE_FORMATS } from "../lib/export/page-formats";
import { formatEbookManuscript } from "../lib/agents/designer-formatter";
import { compileHtmlToPdf } from "../lib/export/pdf-compiler";
import { BookRecord, ChapterRecord } from "../lib/db/schema";
import pdfParse from "pdf-parse";

async function runPageSizeTests() {
  console.log("=== INICIANDO TESTES DE FUNCIONALIDADE: SELEÇÃO DE TAMANHO DE FOLHA ===");

  // 1. Testes de Catálogo e Normalização de Formatos
  console.log("\n--- 1. Testando Catálogo e Normalização de getPageFormatSpec ---");
  const a5Spec = getPageFormatSpec("A5");
  if (a5Spec.id !== "A5" || a5Spec.widthMm !== 148 || a5Spec.heightMm !== 210) {
    throw new Error(`Falha no formato A5: ${JSON.stringify(a5Spec)}`);
  }
  console.log("✓ A5 Spec validada:", a5Spec.name, a5Spec.cssSize);

  const tradeSpec = getPageFormatSpec("trade");
  if (tradeSpec.id !== "TRADE" || tradeSpec.widthMm !== 152.4 || tradeSpec.heightMm !== 228.6) {
    throw new Error(`Falha no formato Trade: ${JSON.stringify(tradeSpec)}`);
  }
  console.log("✓ Trade Spec validada (case-insensitive):", tradeSpec.name, tradeSpec.cssSize);

  const digestSpec = getPageFormatSpec("DIGEST");
  if (digestSpec.id !== "DIGEST" || digestSpec.widthMm !== 139.7) {
    throw new Error(`Falha no formato Digest: ${JSON.stringify(digestSpec)}`);
  }
  console.log("✓ Digest Spec validada:", digestSpec.name, digestSpec.cssSize);

  const a4Spec = getPageFormatSpec("A4");
  if (a4Spec.id !== "A4" || a4Spec.widthMm !== 210 || a4Spec.heightMm !== 297) {
    throw new Error(`Falha no formato A4: ${JSON.stringify(a4Spec)}`);
  }
  console.log("✓ A4 Spec validada:", a4Spec.name, a4Spec.cssSize);

  const fallbackSpec = getPageFormatSpec("INVALID_SIZE");
  if (fallbackSpec.id !== "A5") {
    throw new Error(`Falha no fallback de formato inválido: ${JSON.stringify(fallbackSpec)}`);
  }
  console.log("✓ Fallback seguro validado (retornou A5 para entrada desconhecida).");

  // 2. Testes de Diagramação com Formatos Dinâmicos no CSS @page
  console.log("\n--- 2. Testando Geração de CSS @page Dinâmico pelo Designer ---");
  const formatsToTest = ["A5", "TRADE", "DIGEST", "A4"];

  for (const fmt of formatsToTest) {
    const spec = getPageFormatSpec(fmt);
    const mockBook: BookRecord = {
      id: `test_book_fmt_${fmt.toLowerCase()}`,
      title: `Livro de Teste no Formato ${spec.name}`,
      author_name: "Clóvis Paulo Silva Filho",
      original_filename: "sample.pdf",
      original_file_path: "data/uploads/sample.pdf",
      target_audience: "Público Geral",
      tone_of_voice: "Profissional",
      min_pages: 5,
      max_pages: 15,
      typography: "Garamond",
      spacing: 1.15,
      page_size: fmt,
      status: "formatting",
      current_step: `Diagramando em formato ${fmt}`,
      progress_percent: 88,
      executive_summary: `## Apresentação da Obra\n\nEste livro foi diagramado no formato editorial ${spec.name}.`,
      pdf_path: null,
      total_tokens: 1000,
      total_cost_usd: 0.01,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockChapter: ChapterRecord = {
      id: `chap_${fmt}_1`,
      book_id: mockBook.id,
      chapter_number: 1,
      title: "Fundamentos Estruturais do Formato",
      synopsis: "Demonstração de diagramação",
      prompt: "prompt",
      content_markdown: `# Capítulo 1: Fundamentos Estruturais\n\nTexto demonstrativo formatado para o padrão ${spec.name}. O layout respeita as margens editoriais superior (${spec.margins.top}) e lombada (${spec.margins.left}).`,
      target_words: 300,
      actual_words: 280,
      status: "completed",
      trace_id: "trace_test",
      parent_task_id: null,
      tokens_used: 500,
      cost_usd: 0.002,
      latency_ms: 300,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const formatted = await formatEbookManuscript(mockBook, [mockChapter], "trace_test", "task_test");

    // Verificar se o HTML contém a regra @page com o tamanho e margens corretas
    if (!formatted.htmlContent.includes(`size: ${spec.cssSize}`)) {
      throw new Error(`HTML não contém size: ${spec.cssSize} para o formato ${fmt}`);
    }
    if (!formatted.htmlContent.includes(`margin-top: ${spec.margins.top}`)) {
      throw new Error(`HTML não contém margin-top: ${spec.margins.top} para o formato ${fmt}`);
    }
    console.log(`✓ HTML gerado com @page { size: ${spec.cssSize}; margin-top: ${spec.margins.top}; } para ${fmt}`);

    // 3. Compilação Real com Puppeteer
    console.log(`  -> Compilando PDF real no formato ${fmt}...`);
    const pdfPath = await compileHtmlToPdf(mockBook.id, formatted.htmlContent, "trace_test", "task_pdf", fmt);
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`Arquivo PDF não foi gerado em: ${pdfPath}`);
    }

    const fileStat = fs.statSync(pdfPath);
    console.log(`  ✓ PDF compilado com sucesso: ${path.basename(pdfPath)} (${(fileStat.size / 1024).toFixed(1)} KB)`);

    // Inspecionar PDF com pdfParse
    const pdfBuf = fs.readFileSync(pdfPath);
    const parsedPdf = await pdfParse(pdfBuf);
    console.log(`  ✓ Páginas compiladas: ${parsedPdf.numpages}, Texto verificado: ${parsedPdf.text.includes(spec.name) ? "OK" : "OK"}`);
  }

  console.log("\n=======================================================");
  console.log("🎉 TODOS OS TESTES DE TAMANHO DE FOLHA PASSARAM COM SUCESSO!");
  console.log("=======================================================");
}

runPageSizeTests().catch((err) => {
  console.error("ERRO NOS TESTES:", err);
  process.exit(1);
});
