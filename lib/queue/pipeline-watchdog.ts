/**
 * Pipeline Watchdog: Tabela de Timeouts Estritos e Utilitários de Cancelamento
 * 
 * Regra Arquitetural:
 * Cada processo possui um tempo limite estrito igual ao dobro do tempo médio
 * verificado empiricamente nos logs de execuções bem-sucedidas.
 */

export const STAGE_TIMEOUTS = {
  ingesting: 90_000,              // 90s / 1.5 min (anteriormente 15s) - Ingestão e extração concorrente
  vectorized: 540_000,            // 540s / 9 min (anteriormente 90s) - Tolerância para múltiplos PDFs densos e milhares de embeddings
  outlining_ceo: 240_000,         // 240s / 4 min (anteriormente 40s) - Planejamento First Principles do CEO
  outlining_presentation: 180_000,// 180s / 3 min (anteriormente 30s) - Subagente de Apresentação
  writing_batch: 480_000,         // 480s / 8 min por lote concorrente (anteriormente 80s)
  formatting_designer: 120_000,   // 120s / 2 min (anteriormente 20s) - Diagramação e inline SVGs
  formatting_reviewer: 360_000,   // 360s / 6 min (anteriormente 60s) - Auditoria analítica e revisão editorial LLM
  compiling_pdf: 210_000,         // 210s / 3.5 min (anteriormente 35s) - Compilação física Puppeteer e paginação
  compiling_epub: 120_000,        // 120s / 2 min (anteriormente 20s) - Compilação EPUB 3 / JSZip in-memory
  global_pipeline: 3_240_000,     // 3.240s / 54 min (anteriormente 9 min) - Limite de proteção global
} as const;

export type StageName = keyof typeof STAGE_TIMEOUTS;

export class PipelineTimeoutError extends Error {
  constructor(public stage: string, public timeoutMs: number) {
    super(
      `Tempo limite de operação excedido na etapa "${stage}" (${(timeoutMs / 1000).toFixed(0)}s). Operação cancelada pelo Watchdog.`
    );
    this.name = "PipelineTimeoutError";
  }
}

export class PipelineAbortedError extends Error {
  constructor(message = "Operação abortada manualmente pelo usuário via Force Stop.") {
    super(message);
    this.name = "PipelineAbortedError";
  }
}

/**
 * Executa uma promise com limite de tempo estrito e suporte a AbortSignal.
 * Caso o tempo estrito seja atingido ou o sinal de cancelamento seja disparado,
 * a execução é imediatamente interrompida.
 */
export async function runWithTimeout<T>(
  promiseOrFn: Promise<T> | (() => Promise<T>),
  timeoutMs: number,
  stageName: string,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) {
    throw new PipelineAbortedError();
  }

  let timerId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new PipelineTimeoutError(stageName, timeoutMs));
    }, timeoutMs);
  });

  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new PipelineAbortedError()),
          { once: true }
        );
      })
    : null;

  try {
    const mainPromise = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;
    const raceCompetitors: Promise<any>[] = [mainPromise, timeoutPromise];
    if (abortPromise) raceCompetitors.push(abortPromise);

    return await Promise.race(raceCompetitors);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}
