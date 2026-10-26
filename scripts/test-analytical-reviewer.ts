import { calculateBookVolumeRequirements } from "../lib/export/page-formats";
import { reviewAndPerfectBookManuscript } from "../lib/agents/book-reviewer";
import { BookRecord, ChapterRecord } from "../lib/db/schema";
import { FormattedEbook } from "../lib/agents/designer-formatter";

async function runAnalyticalReviewerTests() {
  console.log("=== INICIANDO TESTES DO NOVO REVISOR ANALÍTICO & DIMENSIONAMENTO DO CEO ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`[PASS] ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${description}`);
      failed++;
    }
  }

  // =========================================================================
  // TESTE 1: Validação Matemática de Dimensionamento de Capítulos
  // =========================================================================
  console.log("\n--- Teste 1: Dimensionamento Matemático do Volume (calculateBookVolumeRequirements) ---");
  const vol90 = calculateBookVolumeRequirements("TRADE", 90, 200, 3200);
  console.log("Volume para 90 páginas (TRADE):", {
    targetPages: vol90.targetPages,
    targetTotalWords: vol90.targetTotalWords,
    recommendedChaptersMin: vol90.recommendedChaptersMin,
    recommendedChaptersMax: vol90.recommendedChaptersMax,
  });

  assert(vol90.targetPages === 90, "Meta de páginas é 90");
  assert(vol90.recommendedChaptersMin >= 10, `Capítulos mínimos para 90 páginas é >= 10 (atual: ${vol90.recommendedChaptersMin})`);
  assert(vol90.targetTotalWords >= 22500, `Meta total de palavras >= 22.500 (atual: ${vol90.targetTotalWords})`);

  const vol50 = calculateBookVolumeRequirements("A5", 50, 100, 3200);
  assert(vol50.recommendedChaptersMin >= 6, `Capítulos mínimos para 50 páginas é >= 6 (atual: ${vol50.recommendedChaptersMin})`);

  const vol120 = calculateBookVolumeRequirements("TRADE", 120, 250, 3200);
  assert(vol120.recommendedChaptersMin >= 14, `Capítulos mínimos para 120 páginas é >= 14 (atual: ${vol120.recommendedChaptersMin})`);

  // =========================================================================
  // TESTE 2: Execução do Revisor Analítico com Déficit de Páginas
  // =========================================================================
  console.log("\n--- Teste 2: Revisor Analítico com Déficit (Acionamento de Remediação Ativa) ---");
  const mockBook: BookRecord = {
    id: `book_test_audit_${Date.now()}`,
    title: "Venda Igual um DOIDO",
    original_filename: "venda.pdf",
    original_file_path: "/dummy/venda.pdf",
    author_name: "Clóvis Paulo",
    target_audience: "Empreendedores e Líderes Comerciais",
    tone_of_voice: "Facilitador e Prático",
    min_pages: 90,
    max_pages: 200,
    page_size: "TRADE",
    typography: "Garamond",
    spacing: 1.38,
    status: "writing",
    current_step: "Testando revisor",
    progress_percent: 90,
    total_tokens: 0,
    total_cost_usd: 0,
    pdf_path: null,
    executive_summary: "Uma obra essencial sobre processos previsíveis e tração comercial por primeiros princípios.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockChapters: ChapterRecord[] = [
    {
      id: "ch_1",
      book_id: mockBook.id,
      chapter_number: 1,
      title: "Fundamentos de Vendas Rápidas",
      synopsis: "Primeiros princípios da tração comercial",
      prompt: "{}",
      target_words: 3200,
      actual_words: 2800,
      status: "completed",
      sections: ["Tese Central", "Erros Críticos"],
      content_markdown: "# Capítulo 1: Fundamentos de Vendas Rápidas\n\nTexto denso e analítico sobre tração.",
      trace_id: "trace_test",
      parent_task_id: null,
      tokens_used: 0,
      cost_usd: 0,
      latency_ms: 0,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "ch_2",
      book_id: mockBook.id,
      chapter_number: 2,
      title: "Arquitetura de Propostas de Alto Valor",
      synopsis: "Construção de ofertas irrecusáveis",
      prompt: "{}",
      target_words: 3200,
      actual_words: 3100,
      status: "completed",
      sections: ["Estrutura de Ofertas", "Casos Reais"],
      content_markdown: "# Capítulo 2: Arquitetura de Propostas de Alto Valor\n\nMetodologia de fechamento previsível.",
      trace_id: "trace_test",
      parent_task_id: null,
      tokens_used: 0,
      cost_usd: 0,
      latency_ms: 0,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // Apenas 2 capítulos geraram ~5.900 palavras (~22 páginas em Trade), gerando déficit para meta de 90 páginas
  const initialHtml = `
    <!DOCTYPE html>
    <html>
      <head><title>Venda Igual um DOIDO</title></head>
      <body>
        <section class="chapter-container">
          <div class="chapter-content">
            <h1>Capítulo 1: Fundamentos de Vendas Rápidas</h1>
            <p>Texto inicial do capítulo 1 com análise de tração.</p>
          </div>
        </section>
        <section class="chapter-container">
          <div class="chapter-content">
            <h1>Capítulo 2: Arquitetura de Propostas de Alto Valor</h1>
            <p>Texto do capítulo 2 com metodologia.</p>
          </div>
        </section>
      </body>
    </html>
  `;

  const mockFormatted: FormattedEbook = {
    htmlContent: initialHtml,
    markdownManuscript: "# Venda Igual um DOIDO\n\n## Capítulo 1\n\nTexto...\n\n## Capítulo 2\n\nTexto...",
    totalWords: 5900,
    estimatedPages: 22,
  };

  console.log("Executando reviewAndPerfectBookManuscript com déficit (22 páginas estimadas vs 90 contratadas)...");
  const reviewResult = await reviewAndPerfectBookManuscript(
    mockBook,
    mockChapters,
    mockFormatted,
    `trace_audit_${Date.now()}`,
    "test_parent_task"
  );

  console.log("\nResultado da Auditoria:", {
    qualityScore: reviewResult.qualityScore,
    commercialReady: reviewResult.commercialReady,
    activeRemediationApplied: reviewResult.activeRemediationApplied,
    finalEstimatedPages: reviewResult.finalEstimatedPages,
    remediationLog: reviewResult.remediationLog,
  });
  console.log("analyticalCritique:", JSON.stringify(reviewResult.analyticalCritique, null, 2));

  assert(reviewResult.analyticalCritique !== undefined, "Parecer analítico foi gerado");
  assert(reviewResult.analyticalCritique?.volumeAudit.pageDeficit! > 0, "Déficit de páginas foi detectado corretamente");
  assert(reviewResult.activeRemediationApplied === true, "Remediação ativa foi acionada com sucesso");
  assert(reviewResult.htmlContent.includes("appendix-container") || reviewResult.htmlContent.includes("Caderno de Aplicação"), "HTML agora contém o Caderno de Aplicação Executiva");
  assert(reviewResult.markdownManuscript.includes("Caderno de Aplicação"), "Markdown contém o Apêndice Executivo");
  assert(reviewResult.finalEstimatedPages! > mockFormatted.estimatedPages, `Páginas estimadas aumentaram após remediação (${reviewResult.finalEstimatedPages} > ${mockFormatted.estimatedPages})`);
  assert(reviewResult.qualityScore > 0 && reviewResult.qualityScore <= 100, `Score final é factual e válido (${reviewResult.qualityScore}%)`);

  console.log(`\n=== RESULTADO FINAL: ${passed} PASSOU, ${failed} FALHOU ===`);
  if (failed > 0) process.exit(1);
}

runAnalyticalReviewerTests().catch((err) => {
  console.error("Erro nos testes:", err);
  process.exit(1);
});
