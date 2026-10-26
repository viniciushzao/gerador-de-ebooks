import { addAuditLog, getAuditLogs, onAuditLog, AuditLogRecord } from "../lib/db/client";

async function runTests() {
  console.log("=== INICIANDO TESTES DO SUBSISTEMA DE LOGS EM TEMPO REAL ===");
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

  const testBookId = `test_logs_stream_${Date.now()}`;

  // 1. Validar registro de listener onAuditLog
  console.log("\n--- Teste 1: Registro e Notificação Imediata de onAuditLog ---");
  const receivedLogs: AuditLogRecord[] = [];
  const unsubscribe = onAuditLog((log) => {
    if (log.book_id === testBookId) {
      receivedLogs.push(log);
    }
  });

  assert(typeof unsubscribe === "function", "onAuditLog retorna função unsubscribe válida");

  // 2. Emissão de Log e Notificação Síncrona
  console.log("\n--- Teste 2: Disparo de addAuditLog e Captura Instantânea ---");
  const log1: AuditLogRecord = {
    id: `log_ceo_${Date.now()}`,
    trace_id: `trace_${testBookId}`,
    parent_task_id: null,
    book_id: testBookId,
    chapter_id: null,
    agent_role: "CEO",
    level: "info",
    message: "CEO iniciou o planejamento First Principles",
    metadata: JSON.stringify({ strategy: "first_principles", chaptersTarget: 8 }),
    tokens: 450,
    cost_usd: 0.00045,
    latency_ms: 1200,
    skill_badge: "elon-musk",
    timestamp: new Date().toISOString(),
  };

  addAuditLog(log1);
  assert(receivedLogs.length === 1, "Listener foi notificado imediatamente no addAuditLog");
  assert(receivedLogs[0].id === log1.id, "ID do log recebido coincide");
  assert(receivedLogs[0].agent_role === "CEO", "Papel do agente preservado como CEO");
  assert(receivedLogs[0].skill_badge === "elon-musk", "Skill badge preservado");

  // 3. Emissão de múltiplos logs simultâneos de diferentes subagentes
  console.log("\n--- Teste 3: Múltiplos Subagentes (Apresentação, Capítulos, Designer) ---");
  const logPresentation: AuditLogRecord = {
    id: `log_pres_${Date.now()}`,
    trace_id: `trace_${testBookId}`,
    parent_task_id: null,
    book_id: testBookId,
    chapter_id: null,
    agent_role: "PRESENTATION_WRITER",
    level: "info",
    message: "Apresentação da obra redigida com 450 palavras",
    metadata: JSON.stringify({ wordsCount: 450 }),
    tokens: 920,
    cost_usd: 0.00092,
    latency_ms: 2400,
    skill_badge: null,
    timestamp: new Date(Date.now() + 10).toISOString(),
  };

  const logChapter: AuditLogRecord = {
    id: `log_chap1_${Date.now()}`,
    trace_id: `trace_${testBookId}`,
    parent_task_id: null,
    book_id: testBookId,
    chapter_id: "chap_1",
    agent_role: "WRITER",
    level: "info",
    message: "Capítulo 1 concluído com 3.420 palavras (Two-stage deep drafting)",
    metadata: JSON.stringify({ chapterNumber: 1, actualWords: 3420, sections: 4 }),
    tokens: 3800,
    cost_usd: 0.0038,
    latency_ms: 31000,
    skill_badge: "snow-d3",
    timestamp: new Date(Date.now() + 20).toISOString(),
  };

  const logDesigner: AuditLogRecord = {
    id: `log_des_${Date.now()}`,
    trace_id: `trace_${testBookId}`,
    parent_task_id: null,
    book_id: testBookId,
    chapter_id: null,
    agent_role: "DESIGNER",
    level: "skill_call",
    message: "Diagramação CSS Paged Media e renderização de 4 SVGs Inline 300 DPI",
    metadata: JSON.stringify({ figuresCount: 4, pageSize: "Trade" }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 1500,
    skill_badge: "book-designer",
    timestamp: new Date(Date.now() + 30).toISOString(),
  };

  addAuditLog(logPresentation);
  addAuditLog(logChapter);
  addAuditLog(logDesigner);

  assert(receivedLogs.length === 4, "Todos os 4 logs de subagentes foram capturados em tempo real");

  // 4. Validação de Ordenação e Persistência no Banco
  console.log("\n--- Teste 4: getAuditLogs ordenado por Timestamp ---");
  const storedLogs = getAuditLogs(testBookId);
  assert(storedLogs.length === 4, "Todos os 4 logs foram persistidos");
  assert(
    new Date(storedLogs[0].timestamp).getTime() <= new Date(storedLogs[1].timestamp).getTime(),
    "Logs retornam em ordem cronológica ascendente"
  );

  // 5. Teste de Unsubscribe
  console.log("\n--- Teste 5: Unsubscribe do Listener ---");
  unsubscribe();
  const logIgnored: AuditLogRecord = {
    id: `log_after_unsub_${Date.now()}`,
    trace_id: `trace_${testBookId}`,
    parent_task_id: null,
    book_id: testBookId,
    chapter_id: null,
    agent_role: "SYSTEM",
    level: "info",
    message: "Log emitido após cancelamento da inscrição",
    metadata: "{}",
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: null,
    timestamp: new Date().toISOString(),
  };

  addAuditLog(logIgnored);
  assert(receivedLogs.length === 4, "Listener desinscrito não recebeu o novo log");

  console.log(`\n=== RESUMO DOS TESTES: ${passed} PASSOU, ${failed} FALHOU ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
