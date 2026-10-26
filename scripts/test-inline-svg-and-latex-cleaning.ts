import { cleanLatexMathFormatting, formatEquationsForEditorial } from "../lib/agents/chapter-writer";
import { generateNanoBananaVisualGraphic } from "../lib/export/gemini-image-generator";
import { formatEbookManuscript } from "../lib/agents/designer-formatter";
import { compileHtmlToPdf } from "../lib/export/pdf-compiler";
import { BookRecord, ChapterRecord } from "../lib/db/schema";
import fs from "fs";

async function testInlineSvgAndLatexCleaning() {
  console.log("=== TESTANDO CORREÇÃO DEFINITIVA DE LATEX E RENDERIZAÇÃO DE IMAGENS ===");

  // 1. Testar limpeza estrita de LaTeX e decimais {,}
  console.log("\n--- 1. Testando Sanitização de LaTeX Residual e Notação Decimal {,} ---");
  const rawLatexText = `
No Cenário C (Retenção de Classe Mundial - 90% ao ano):
* Margem = R$ 1.000,00
* r = 0{,}90
* d = 0{,}10
* Custo = \\text{R\\$} 30.000{,}00
* Formula residual: text{R\\} 3.800.000 * 0{,}35 = R\\ 1.330.000
  `;

  const cleanedText = cleanLatexMathFormatting(rawLatexText);
  console.log("Texto limpo:\n", cleanedText);

  if (cleanedText.includes("{,}") || cleanedText.includes("text{") || cleanedText.includes("R\\")) {
    console.error("ERRO: Resíduo de LaTeX ou vírgula decimal {,} ainda presente no texto!");
    process.exit(1);
  }

  if (!cleanedText.includes("0,90") || !cleanedText.includes("0,10")) {
    console.error("ERRO: 0{,}90 e 0{,}10 não foram convertidos para 0,90 e 0,10!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: Todos os resíduos LaTeX e vírgulas decimais {,} foram perfeitamente convertidos!");

  // 2. Testar Geração de Imagem com Inline SVG no Nano Banana 2
  console.log("\n--- 2. Testando Geração de Inline SVG no Nano Banana 2 ---");
  const visualResult = await generateNanoBananaVisualGraphic({
    bookId: "test_inline_svg_book",
    chapterNumber: 4,
    title: "A Cascata Econômica da Relação com o Cliente",
    conceptDescription: "Fluxo fundamental de transformação do capital de marketing em ativo financeiro descontado.",
    conceptType: "strategic_flow",
    items: [
      { label: "1. Custo de Aquisição (CAC)", description: "Investimento inicial em mídia e canais para atração do cliente." },
      { label: "2. Margem de Contribuição", description: "Receita recorrente menos custo de servir ao longo do ciclo de vida." },
      { label: "3. Taxa de Retenção (r = 90%)", description: "Percentual de clientes ativos mantidos a cada período." },
      { label: "4. Valor do Cliente no Tempo (LTV)", description: "Lucro econômico agregado descontado pelo custo de capital." },
    ],
    caption: "Figura 4.1 — A Cascata Econômica da Relação com o Cliente [Nano Banana 2 / OpenChart].",
    traceId: "trace_test_inline",
    taskId: "task_test_inline",
  });

  if (!visualResult.success || !visualResult.htmlTag) {
    console.error("ERRO: Falha ao gerar figura no Nano Banana 2:", visualResult.error);
    process.exit(1);
  }

  if (!visualResult.htmlTag.includes("<svg") || !visualResult.htmlTag.includes("</svg>")) {
    console.error("ERRO: A tag gerada não contém um SVG inline válido!");
    process.exit(1);
  }

  if (visualResult.htmlTag.includes("<img")) {
    console.error("ERRO: A tag gerada ainda está usando a tag <img> em vez de SVG inline!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: Nano Banana 2 gerou uma figura com Inline SVG nativo de alta resolução!");

  // 3. Testar Formatação Editorial e Compilação Real de PDF via Puppeteer
  console.log("\n--- 3. Testando Diagramação e Compilação Real de PDF via Puppeteer ---");
  const mockBook: BookRecord = {
    id: "test_book_pdf_render",
    title: "Marketing Baseado em Dados e Métricas Estratégicas",
    author_name: "Clóvis Paulo Silva Filho",
    original_filename: "test.pdf",
    original_file_path: "data/uploads/test.pdf",
    target_audience: "Executivos e Gestores",
    tone_of_voice: "Profissional",
    min_pages: 5,
    max_pages: 15,
    status: "formatting",
    current_step: "Testando compilação",
    progress_percent: 90,
    executive_summary: "## Apresentação da Obra\n\nEste livro investiga a relação entre retenção e lucro econômico.\n\n" + visualResult.htmlTag,
    typography: "Garamond",
    spacing: 1.15,
    pdf_path: null,
    total_tokens: 5000,
    total_cost_usd: 0.05,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockChapter: ChapterRecord = {
    id: "test_chap_4",
    book_id: "test_book_pdf_render",
    chapter_number: 4,
    title: "A Relação Econômica com o Cliente",
    synopsis: "Sinopse do capítulo 4",
    prompt: "Prompt do capítulo 4",
    content_markdown: `
# Capítulo 4: A Relação Econômica com o Cliente

A retenção é a alavanca de maior sensibilidade no valor econômico do cliente:
* Cenário de Retenção Alta: r = 0,90
* Taxa de Desconto de Capital: d = 0,10

${visualResult.htmlTag}

A execução prática desse fluxo assegura que o capital alocado em marketing gere retorno residual superior ao WACC.
    `,
    target_words: 800,
    actual_words: 750,
    status: "completed",
    trace_id: "trace_test_render",
    parent_task_id: "parent_task_render",
    tokens_used: 1200,
    cost_usd: 0.005,
    latency_ms: 800,
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const formatted = await formatEbookManuscript(
    mockBook,
    [mockChapter],
    "trace_test_render",
    "parent_task_render"
  );

  console.log("HTML formatado com sucesso! Tamanho:", formatted.htmlContent.length, "bytes.");

  const pdfPath = await compileHtmlToPdf(
    mockBook.id,
    formatted.htmlContent,
    "trace_test_render",
    "parent_task_render"
  );

  if (!fs.existsSync(pdfPath)) {
    console.error("ERRO: O arquivo PDF não foi gerado em disco!");
    process.exit(1);
  }

  const pdfStat = fs.statSync(pdfPath);
  console.log("✓ SUCESSO: PDF gerado com sucesso pelo Puppeteer!");
  console.log("  Caminho do PDF:", pdfPath);
  console.log("  Tamanho do PDF:", (pdfStat.size / 1024).toFixed(2), "KB");

  console.log("\n=======================================================");
  console.log("🎉 AUDITORIA E TESTE DE CORREÇÃO CONCLUÍDOS COM 100% DE APROVAÇÃO!");
  console.log("=======================================================");
}

testInlineSvgAndLatexCleaning().catch((err) => {
  console.error(err);
  process.exit(1);
});
