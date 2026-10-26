import { createBook, getBook, updateBook, getAuditLogs, getTasks, addAuditLog, createTask, createChapter, getChapters, updateChapter, clearBookData } from "../lib/db/client";

async function runTests() {
  console.log("=== INICIANDO TESTES DE ANTI-REGRESSÃO E INVARIANTES DE ESTADO ===");
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

  // --- Teste 1: Cálculo de isRunning ---
  console.log("\n--- Teste 1: Validação da Fórmula de isRunning ---");
  const computeIsRunning = (book: any, isStarting: boolean) => {
    return (
      Boolean(book) &&
      book.status !== "completed" &&
      book.status !== "failed" &&
      (isStarting || book.status !== "pending")
    );
  };

  assert(!computeIsRunning({ status: "completed" }, true), "isStarting=true NÃO deixa isRunning=true se status=completed");
  assert(!computeIsRunning({ status: "completed" }, false), "isRunning é false quando status=completed");
  assert(!computeIsRunning({ status: "failed" }, true), "isStarting=true NÃO deixa isRunning=true se status=failed");
  assert(!computeIsRunning({ status: "failed" }, false), "isRunning é false quando status=failed");
  assert(!computeIsRunning({ status: "pending" }, false), "isRunning é false quando status=pending e isStarting=false");
  assert(computeIsRunning({ status: "pending" }, true), "isRunning é true quando status=pending e isStarting=true");
  assert(computeIsRunning({ status: "writing" }, false), "isRunning é true quando status=writing");
  assert(computeIsRunning({ status: "formatting" }, false), "isRunning é true quando status=formatting");

  // --- Teste 2: Lógica de Anti-Regressão de Book ---
  console.log("\n--- Teste 2: Anti-Regressão de Book (Terminalidade e Monotonicidade) ---");
  const applyBookUpdateLogic = (prev: any, newBook: any) => {
    if (!prev) return newBook;
    const isCurrentlyCompleted = prev.status === "completed";
    const status = isCurrentlyCompleted ? "completed" : newBook.status;

    let progress_percent = newBook.progress_percent;
    if (status === "completed") {
      progress_percent = 100;
    } else if (newBook.status !== "pending") {
      progress_percent = Math.max(prev.progress_percent || 0, newBook.progress_percent || 0);
    }

    const prevTime = prev.updated_at ? new Date(prev.updated_at).getTime() : 0;
    const newTime = newBook.updated_at ? new Date(newBook.updated_at).getTime() : 0;
    const isStale = newTime > 0 && prevTime > 0 && newTime < prevTime;

    const current_step = isStale && prev.status === status ? prev.current_step : newBook.current_step;
    const pdf_path = prev.pdf_path || newBook.pdf_path;
    const actual_pages = prev.actual_pages ?? newBook.actual_pages ?? null;
    const total_tokens = Math.max(prev.total_tokens || 0, newBook.total_tokens || 0);
    const total_cost_usd = Math.max(prev.total_cost_usd || 0, newBook.total_cost_usd || 0);

    if (
      prev.status === status &&
      prev.progress_percent === progress_percent &&
      prev.current_step === current_step &&
      prev.pdf_path === pdf_path &&
      prev.actual_pages === actual_pages &&
      prev.total_tokens === total_tokens &&
      prev.total_cost_usd === total_cost_usd &&
      prev.title === newBook.title &&
      prev.executive_summary === newBook.executive_summary
    ) {
      return prev;
    }

    return {
      ...newBook,
      status,
      progress_percent,
      current_step,
      pdf_path,
      actual_pages,
      total_tokens,
      total_cost_usd,
    };
  };

  const completedBook = {
    id: "b1",
    status: "completed",
    progress_percent: 100,
    current_step: "Concluído",
    pdf_path: "/path/to/pdf.pdf",
    actual_pages: 50,
    total_tokens: 50000,
    total_cost_usd: 0.05,
    updated_at: "2026-09-07T12:00:00.000Z",
  };

  const staleBook = {
    id: "b1",
    status: "writing",
    progress_percent: 60,
    current_step: "Escrevendo",
    pdf_path: null,
    actual_pages: null,
    total_tokens: 20000,
    total_cost_usd: 0.02,
    updated_at: "2026-09-07T11:59:00.000Z",
  };

  const res1 = applyBookUpdateLogic(completedBook, staleBook);
  assert(res1.status === "completed", "Status completed NÃO regride para writing após snapshot obsoleto");
  assert(res1.progress_percent === 100, "Progresso 100% NÃO regride para 60%");
  assert(res1.pdf_path === "/path/to/pdf.pdf", "pdf_path é preservado");
  assert(res1.total_tokens === 50000, "Tokens consolidados não regridem");

  // Preservação de referência idêntica (Imutabilidade)
  const identicalBook = { ...completedBook };
  const res2 = applyBookUpdateLogic(completedBook, identicalBook);
  assert(res2 === completedBook, "Referência idêntica é preservada quando os dados não mudaram (evita re-render)");

  // Monotonicidade durante writing (ex: 80% recebendo 65%)
  const writing80 = {
    id: "b1",
    status: "writing",
    progress_percent: 80,
    current_step: "Capítulo 4",
    total_tokens: 30000,
    total_cost_usd: 0.03,
    updated_at: "2026-09-07T12:05:00.000Z",
  };
  const writing65 = {
    id: "b1",
    status: "writing",
    progress_percent: 65,
    current_step: "Capítulo 2",
    total_tokens: 20000,
    total_cost_usd: 0.02,
    updated_at: "2026-09-07T12:04:00.000Z",
  };
  const res3 = applyBookUpdateLogic(writing80, writing65);
  assert(res3.progress_percent === 80, "Progresso de 80% NÃO regride para 65% na mesma etapa");
  assert(res3.current_step === "Capítulo 4", "Passo mais recente preservado sobre snapshot com timestamp anterior");

  // --- Teste 3: Anti-Regressão de Capítulos ---
  console.log("\n--- Teste 3: Anti-Regressão de Capítulos ---");
  const applyChaptersLogic = (prev: any[], newChapters: any[]) => {
    let hasDifferences = false;
    const prevMap = new Map(prev.map((c) => [c.id, c]));

    const merged = newChapters.map((nc) => {
      const pc = prevMap.get(nc.id);
      if (!pc) {
        hasDifferences = true;
        return nc;
      }
      let status = nc.status;
      let actual_words = nc.actual_words;
      let content_markdown = nc.content_markdown;

      if (pc.status === "completed" && nc.status !== "completed") {
        status = "completed";
        actual_words = Math.max(pc.actual_words || 0, nc.actual_words || 0);
        content_markdown = pc.content_markdown || nc.content_markdown;
      }

      if (
        pc.status === status &&
        pc.actual_words === actual_words &&
        pc.content_markdown === content_markdown &&
        pc.title === nc.title &&
        pc.error_message === nc.error_message
      ) {
        return pc;
      }

      hasDifferences = true;
      return {
        ...nc,
        status,
        actual_words,
        content_markdown,
      };
    });

    if (!hasDifferences && merged.length === prev.length) {
      return prev;
    }
    return merged;
  };

  const prevChaps = [
    { id: "c1", status: "completed", actual_words: 2000, content_markdown: "texto", title: "C1", error_message: null },
    { id: "c2", status: "completed", actual_words: 2500, content_markdown: "texto 2", title: "C2", error_message: null },
  ];
  const staleChaps = [
    { id: "c1", status: "completed", actual_words: 2000, content_markdown: "texto", title: "C1", error_message: null },
    { id: "c2", status: "running", actual_words: 0, content_markdown: "", title: "C2", error_message: null },
  ];

  const resChaps = applyChaptersLogic(prevChaps, staleChaps);
  assert(resChaps[1].status === "completed", "Capítulo 2 não regride de 'completed' para 'running'");
  assert(resChaps[1].actual_words === 2500, "Contagem de palavras do capítulo é preservada");

  const identicalChaps = [
    { id: "c1", status: "completed", actual_words: 2000, content_markdown: "texto", title: "C1", error_message: null },
    { id: "c2", status: "completed", actual_words: 2500, content_markdown: "texto 2", title: "C2", error_message: null },
  ];
  const resChaps2 = applyChaptersLogic(prevChaps, identicalChaps);
  assert(resChaps2 === prevChaps, "Array de capítulos preserva referência idêntica quando não há alterações");

  // --- Teste 4: Consolidação Atômica no Banco ---
  console.log("\n--- Teste 4: Consolidação Atômica no Banco de Dados ---");
  const testBookId = `test_atomic_${Date.now()}`;
  createBook({
    id: testBookId,
    title: "Livro de Teste Atômico",
    author_name: "Autor Teste",
    target_audience: "Geral",
    tone_of_voice: "Técnico",
    page_size: "A5",
    typography: "Merriweather",
    spacing: 1.25,
    status: "formatting",
    current_step: "Compilando PDF...",
    progress_percent: 96,
    total_tokens: 0,
    total_cost_usd: 0,
    original_filename: "doc.pdf",
    original_file_path: "/tmp/doc.pdf",
    min_pages: 30,
    max_pages: 50,
    pdf_path: null,
    executive_summary: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  addAuditLog({
    id: `log_t1_${Date.now()}`,
    trace_id: "t1",
    parent_task_id: null,
    book_id: testBookId,
    chapter_id: null,
    agent_role: "WRITER",
    level: "info",
    message: "Capítulo escrito",
    metadata: "{}",
    tokens: 15000,
    cost_usd: 0.015,
    latency_ms: 1000,
    skill_badge: null,
    timestamp: new Date().toISOString(),
  });

  createTask({
    id: `task_t1_${Date.now()}`,
    trace_id: "t1",
    parent_task_id: null,
    book_id: testBookId,
    chapter_id: null,
    agent_role: "DESIGNER",
    status: "completed",
    input_payload: "{}",
    output_payload: null,
    tokens_in: 5000,
    tokens_out: 2000,
    cost_usd: 0.007,
    latency_ms: 500,
    skill_used: "designer",
    error: null,
    created_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  });

  // Simular a consolidação atômica realizada no task-engine
  const finalBook = getBook(testBookId);
  const allLogs = getAuditLogs(testBookId);
  const allTasks = getTasks(testBookId);
  const logTokens = allLogs.reduce((sum, l) => sum + (l.tokens || 0), 0);
  const logCost = allLogs.reduce((sum, l) => sum + (l.cost_usd || 0), 0);
  const taskTokens = allTasks.reduce((sum, t) => sum + (t.tokens_in || 0) + (t.tokens_out || 0), 0);
  const taskCost = allTasks.reduce((sum, t) => sum + (t.cost_usd || 0), 0);
  const finalTokens = Math.max(logTokens, taskTokens, finalBook?.total_tokens || 0);
  const finalCost = Math.max(logCost, taskCost, finalBook?.total_cost_usd || 0);
  const actualPages = 42;
  const pdfFilePath = `/data/output/ebook_${testBookId}.pdf`;

  updateBook(testBookId, {
    status: "completed",
    current_step: "Livro concluído e PDF disponível para download",
    progress_percent: 100,
    total_tokens: finalTokens,
    total_cost_usd: finalCost,
    actual_pages: actualPages,
    pdf_path: pdfFilePath,
  });

  const persisted = getBook(testBookId);
  assert(persisted?.status === "completed", "Status atômico consolidado como 'completed'");
  assert(persisted?.progress_percent === 100, "Progresso atômico consolidado em 100%");
  assert(persisted?.total_tokens === 15000, "Tokens consolidados calculados corretamente");
  assert(Math.abs((persisted?.total_cost_usd || 0) - 0.015) < 0.0001, "Custo consolidado calculado corretamente");
  assert(persisted?.actual_pages === 42, "Páginas físicas consolidadas");
  assert(persisted?.pdf_path === pdfFilePath, "pdf_path persistido");

  clearBookData(testBookId);

  console.log(`\n=== RESUMO DOS TESTES: ${passed} PASSOU, ${failed} FALHOU ===`);
  if (failed > 0) process.exit(1);
}

runTests();
