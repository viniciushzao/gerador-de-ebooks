import {
  STAGE_TIMEOUTS,
  runWithTimeout,
  PipelineTimeoutError,
  PipelineAbortedError,
} from "../lib/queue/pipeline-watchdog";
import { forceStopPipeline } from "../lib/queue/task-engine";
import {
  createBook,
  getBook,
  createTask,
  getTasks,
  getAuditLogs,
} from "../lib/db/client";

async function runTests() {
  console.log("=== INICIANDO TESTES DO PIPELINE WATCHDOG E FORCE STOP ===");
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

  // 1. Validar Tabela de Timeouts Estritos (6x ampliados para suportar múltiplos PDFs e cargas massivas)
  console.log("\n--- Teste 1: Validação de STAGE_TIMEOUTS ---");
  assert(STAGE_TIMEOUTS.ingesting === 90_000, "Timeout de Ingestão é 90s");
  assert(STAGE_TIMEOUTS.vectorized === 540_000, "Timeout de Vetorização RAG é 540s (9 min para múltiplos PDFs densos)");
  assert(STAGE_TIMEOUTS.outlining_ceo === 240_000, "Timeout do Planejamento CEO é 240s (4 min)");
  assert(STAGE_TIMEOUTS.outlining_presentation === 180_000, "Timeout de Apresentação é 180s (3 min)");
  assert(STAGE_TIMEOUTS.writing_batch === 480_000, "Timeout de Redação em Lote é 480s (8 min)");
  assert(STAGE_TIMEOUTS.formatting_designer === 120_000, "Timeout de Diagramação é 120s (2 min)");
  assert(STAGE_TIMEOUTS.formatting_reviewer === 360_000, "Timeout do Revisor Editorial é 360s (6 min)");
  assert(STAGE_TIMEOUTS.compiling_pdf === 210_000, "Timeout de Compilação do PDF é 210s (3.5 min)");
  assert(STAGE_TIMEOUTS.global_pipeline === 3_240_000, "Timeout Global é 3.240s (54 min)");

  // 2. Validar runWithTimeout com execução dentro do prazo
  console.log("\n--- Teste 2: runWithTimeout dentro do prazo normal ---");
  try {
    const result = await runWithTimeout(
      async () => {
        await new Promise((r) => setTimeout(r, 50));
        return "resultado_sucesso";
      },
      500,
      "test_stage"
    );
    assert(result === "resultado_sucesso", "Execução completou com sucesso antes do timeout");
  } catch (err: any) {
    assert(false, `Falha inesperada: ${err.message}`);
  }

  // 3. Validar runWithTimeout disparando PipelineTimeoutError
  console.log("\n--- Teste 3: runWithTimeout estourando o tempo limite (Timeout Trigger) ---");
  try {
    await runWithTimeout(
      async () => {
        await new Promise((r) => setTimeout(r, 400));
        return "nunca_deve_retornar";
      },
      100,
      "vectorized"
    );
    assert(false, "Deveria ter lançado PipelineTimeoutError");
  } catch (err: any) {
    assert(
      err instanceof PipelineTimeoutError,
      `Lançou PipelineTimeoutError corretamente: ${err.message}`
    );
    assert(err.stage === "vectorized", "Identificou o estágio correto do timeout");
    assert(err.timeoutMs === 100, "Registrou o tempo limite em milissegundos corretamente");
  }

  // 4. Validar runWithTimeout com cancelamento imediato via AbortSignal
  console.log("\n--- Teste 4: runWithTimeout interrompido via AbortSignal ---");
  const controller = new AbortController();
  const abortPromise = runWithTimeout(
    async () => {
      await new Promise((r) => setTimeout(r, 1000));
      return "nunca";
    },
    5000,
    "writing_batch",
    controller.signal
  );

  setTimeout(() => {
    controller.abort();
  }, 50);

  try {
    await abortPromise;
    assert(false, "Deveria ter lançado PipelineAbortedError");
  } catch (err: any) {
    assert(
      err instanceof PipelineAbortedError,
      `Lançou PipelineAbortedError ao receber sinal de cancelamento: ${err.message}`
    );
  }

  // 5. Validar forceStopPipeline no banco de dados e estado da esteira
  console.log("\n--- Teste 5: forceStopPipeline cancelando esteira e tarefas ativas ---");
  const testBookId = `test_book_${Date.now()}`;
  createBook({
    id: testBookId,
    title: "Livro de Teste Force Stop",
    original_filename: "doc1.pdf",
    original_file_path: "/tmp/doc1.pdf",
    author_name: "QA Test",
    target_audience: "Geral",
    min_pages: 10,
    max_pages: 50,
    tone_of_voice: "Técnico",
    source_documents: [
      {
        id: "doc1",
        filename: "doc1.pdf",
        file_path: "/tmp/doc1.pdf",
        file_hash: "hash1",
        file_size: 1024,
        file_type: "pdf",
        status: "indexed",
      },
    ],
    status: "vectorized",
    current_step: "Indexando chunks no banco vetorial RAG",
    progress_percent: 25,
    typography: "Cinzel",
    spacing: 1.5,
    page_size: "A5",
    total_tokens: 100,
    total_cost_usd: 0.001,
    pdf_path: null,
    actual_pages: null,
    executive_summary: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const testTaskId = `task_${Date.now()}`;
  createTask({
    id: testTaskId,
    trace_id: `trace_${Date.now()}`,
    parent_task_id: null,
    book_id: testBookId,
    chapter_id: null,
    agent_role: "RAG_PROCESSOR",
    status: "running",
    input_payload: "{}",
    output_payload: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_used: "ai-rag",
    error: null,
    finished_at: null,
    created_at: new Date().toISOString(),
  });

  const stopped = await forceStopPipeline(testBookId);
  assert(stopped === true, "forceStopPipeline retornou true");

  const updatedBook = getBook(testBookId);
  assert(updatedBook?.status === "failed", "Status do livro alterado para 'failed'");
  assert(
    updatedBook?.current_step.includes("Force Stop") === true,
    "current_step do livro indica cancelamento via Force Stop"
  );

  const updatedTasks = getTasks(testBookId);
  const stoppedTask = updatedTasks.find((t) => t.id === testTaskId);
  assert(stoppedTask?.status === "failed", "Status da tarefa ativa alterado para 'failed'");
  assert(
    stoppedTask?.error?.includes("Force Stop") === true,
    "Erro da tarefa registra cancelamento por Force Stop"
  );

  const logs = getAuditLogs(testBookId);
  const stopLog = logs.find((l) => l.message.includes("Force Stop"));
  assert(!!stopLog, "Trilha de auditoria registrou o evento de Force Stop");
  assert(stopLog?.level === "warning", "Nível do log de auditoria é 'warning'");

  console.log(`\n=== RESUMO DOS TESTES: ${passed} PASSOU, ${failed} FALHOU ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Erro fatal nos testes:", e);
  process.exit(1);
});
