import { formatEbookManuscript } from "../lib/agents/designer-formatter";
import { reviewAndPerfectBookManuscript } from "../lib/agents/book-reviewer";
import { translateMermaidToEditorialGraphics } from "../lib/export/visual-translator";
import { processNanoBananaJsonBlocks } from "../lib/export/gemini-image-generator";
import { compileHtmlToPdf } from "../lib/export/pdf-compiler";
import { BookRecord, ChapterRecord } from "../lib/db/schema";
import fs from "fs";

async function testReviewerAndAll4Cases() {
  console.log("=== TESTANDO O NOVO SUBAGENTE REVISOR EDITORIAL E OS 4 CASOS DAS IMAGENS ===");

  const bookId = "test_book_reviewer_4cases";
  const traceId = "trace_reviewer_test";

  // --- CASO 1: JSON Bruto solto no texto (Imagem 1) ---
  console.log("\n--- Testando Caso 1 (JSON Bruto de Gráfico sem Fences) ---");
  const case1Markdown = `
# Capítulo 2: A Anatomia das Margens

O Ponto de Equilíbrio é o estágio operacional no qual as receitas totais igualam-se aos custos.

{
  "conceptType": "decision_matrix",
  "title": "Aplicações Estratégicas da Análise de Ponto de Equilíbrio",
  "caption": "Figura 2.1 — Mapeamento de cenários de uso corporativo para decisões de marketing e expansão.",
  "items": [
    { "label": "Ponto de Equilíbrio em Volume Unitário", "description": "Determina o volume mínimo de produção e venda para absorver a estrutura fixa de despesas." },
    { "label": "Ponto de Equilíbrio em Receita", "description": "Define o faturamento necessário para cobrir todos os custos operacionais." }
  ]
}

A análise desses fatores é vital para o planejamento financeiro.
  `;

  // --- CASO 2: Título com ### sem quebra dupla (Imagem 2) ---
  console.log("\n--- Testando Caso 2 (Título ### Vazado no Texto) ---");
  const case2Markdown = `
# Capítulo 4: Eficiência da Força de Vendas

A força de vendas direta é um dos recursos mais caros da estrutura de go-to-market.
### 4.1 Carga de Trabalho e Potencial de Território
O método da carga de trabalho (*Workload Method*) equaliza o esforço comercial.
  `;

  // --- CASO 3: Fórmula com > ** e > * vazados (Imagem 3) ---
  console.log("\n--- Testando Caso 3 (Fórmula com Marcador Markdown > **) ---");
  const case3Markdown = `
# Capítulo 7: Métricas de Mídia e Digital

A taxa de interação mede o engajamento dos usuários com os anúncios:

> **Fórmula / Relação Analítica:**
> *Taxa de Interação (%) = (Número de Usuários que Interagiram / Total de Impressões) * 100*

• Tempo Médio de Exibição: Mede a duração contínua em segundos.
  `;

  // --- CASO 4: Funil ASCII Vertical com [ ] | v [ ] (Imagem 4) ---
  console.log("\n--- Testando Caso 4 (Funil ASCII Vertical) ---");
  const case4Markdown = `
# Capítulo 8: Funil Analítico e Performance

A jornada de conversão é ilustrada pelo fluxo abaixo:

[ 100.000 Impressões ]
       |
  (CTR = 2,0%)
       v
[ 2.000 Cliques ]
       |
(Bounce Rate = 40,0%)
       v
[ 1.200 Sessões Ativas ]
       |
(Taxa de Adição ao Carrinho = 15,0%)
       v
[ 180 Carrinhos Criados ]
       |
[ 60 Compras Finais ]

A análise multietapas permite diagnosticar vazamentos de conversão.
  `;

  // Processar cada capítulo com tradução visual e blocos nano banana
  const processChapter = async (chapNum: number, rawMd: string): Promise<string> => {
    let md = rawMd;
    const nanoRes = await processNanoBananaJsonBlocks(md, bookId, chapNum, traceId, "task_t");
    md = nanoRes.markdown;
    const transRes = await translateMermaidToEditorialGraphics(md, bookId, null, chapNum, traceId, "task_t");
    return transRes.markdown;
  };

  const c1Processed = await processChapter(2, case1Markdown);
  const c2Processed = await processChapter(4, case2Markdown);
  const c3Processed = await processChapter(7, case3Markdown);
  const c4Processed = await processChapter(8, case4Markdown);

  const mockBook: BookRecord = {
    id: bookId,
    title: "Métricas de Marketing e Decisão Comercial",
    author_name: "Clóvis Paulo Silva Filho",
    original_filename: "metrics.pdf",
    original_file_path: "data/uploads/metrics.pdf",
    target_audience: "Executivos e Gestores",
    tone_of_voice: "Profissional e Prático",
    min_pages: 10,
    max_pages: 30,
    status: "formatting",
    current_step: "Testando revisor editorial",
    progress_percent: 88,
    executive_summary: "## Apresentação da Obra\n\nEste livro investiga a mensuração científica de marketing.",
    typography: "Garamond",
    spacing: 1.15,
    pdf_path: null,
    total_tokens: 5000,
    total_cost_usd: 0.05,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockChapters: ChapterRecord[] = [
    {
      id: "c1",
      book_id: bookId,
      chapter_number: 1,
      title: "A Anatomia das Margens",
      synopsis: "Ponto de equilíbrio",
      prompt: "prompt 1",
      content_markdown: c1Processed,
      target_words: 800,
      actual_words: 750,
      status: "completed",
      trace_id: traceId,
      parent_task_id: null,
      tokens_used: 1000,
      cost_usd: 0.005,
      latency_ms: 500,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "c2",
      book_id: bookId,
      chapter_number: 2,
      title: "Eficiência da Força de Vendas",
      synopsis: "Carga de trabalho",
      prompt: "prompt 2",
      content_markdown: c2Processed,
      target_words: 800,
      actual_words: 750,
      status: "completed",
      trace_id: traceId,
      parent_task_id: null,
      tokens_used: 1000,
      cost_usd: 0.005,
      latency_ms: 500,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "c3",
      book_id: bookId,
      chapter_number: 3,
      title: "Métricas de Mídia e Digital",
      synopsis: "Taxa de interação",
      prompt: "prompt 3",
      content_markdown: c3Processed,
      target_words: 800,
      actual_words: 750,
      status: "completed",
      trace_id: traceId,
      parent_task_id: null,
      tokens_used: 1000,
      cost_usd: 0.005,
      latency_ms: 500,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "c4",
      book_id: bookId,
      chapter_number: 4,
      title: "Funil Analítico e Performance",
      synopsis: "Jornada de conversão",
      prompt: "prompt 4",
      content_markdown: c4Processed,
      target_words: 800,
      actual_words: 750,
      status: "completed",
      trace_id: traceId,
      parent_task_id: null,
      tokens_used: 1000,
      cost_usd: 0.005,
      latency_ms: 500,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // 1. Designer formata o livro
  const designerOutput = await formatEbookManuscript(mockBook, mockChapters, traceId, "task_designer");

  // 2. Subagente Revisor Editorial audita e aperfeiçoa o livro
  console.log("\n--- Executando Subagente Revisor Editorial (Book Quality Reviewer) ---");
  const reviewResult = await reviewAndPerfectBookManuscript(
    mockBook,
    mockChapters,
    designerOutput,
    traceId,
    "task_designer"
  );

  console.log(`Checagens Realizadas: ${reviewResult.checksPerformed}`);
  console.log(`Desvios Detectados: ${reviewResult.issuesDetected}`);
  console.log(`Correções Aplicadas: ${reviewResult.issuesRemediated}`);
  console.log(`Quality Score: ${reviewResult.qualityScore}%`);
  console.log(`Pronto para Comercialização: ${reviewResult.commercialReady}`);
  console.log("Log de Remediações:", reviewResult.remediationLog);

  // Validações estritas de conformidade
  const html = reviewResult.htmlContent;

  if (html.includes("{ \"conceptType\"") || html.includes('"conceptType":')) {
    console.error("ERRO: JSON bruto vazou no HTML!");
    process.exit(1);
  }

  if (html.includes("### 4.1") || html.includes("<p>###")) {
    console.error("ERRO: Markdown ### vazou no HTML!");
    process.exit(1);
  }

  if (html.includes("&gt; **Fórmula") || html.includes("> **Fórmula") || html.includes("&gt; *Taxa")) {
    console.error("ERRO: Marcador Markdown > ** vazou no HTML!");
    process.exit(1);
  }

  if (html.includes("[ 100.000 Impressões ]\n       |")) {
    console.error("ERRO: Funil ASCII não traduzido vazou no HTML!");
    process.exit(1);
  }

  // 3. Compilação Real de PDF
  console.log("\n--- Compilando PDF Final Aperfeiçoado com Puppeteer ---");
  const pdfPath = await compileHtmlToPdf(bookId, reviewResult.htmlContent, traceId, "task_pdf");
  console.log("✓ SUCESSO: PDF gerado com sucesso pelo compilador!");
  console.log("  Caminho:", pdfPath);
  console.log("  Tamanho:", (fs.statSync(pdfPath).size / 1024).toFixed(2), "KB");

  console.log("\n=======================================================");
  console.log("🎉 AUDITORIA E REVISÃO EDITORIAL 100% APROVADAS!");
  console.log("=======================================================");
}

testReviewerAndAll4Cases().catch((err) => {
  console.error(err);
  process.exit(1);
});
