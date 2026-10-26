import EventEmitter from "events";
import fs from "fs";
import {
  getBook,
  updateBook,
  getChapters,
  getChapter,
  updateChapter,
  addAuditLog,
  getAuditLogs,
  getTasks,
} from "@/lib/db/client";
import { extractCleanTextFromPdf } from "@/lib/rag/pdf-extractor";
import { chunkDocument } from "@/lib/rag/chunker";
import { indexDocumentChunks } from "@/lib/rag/ai-rag-engine";
import { generateCeoPlan } from "@/lib/agents/ceo-orchestrator";
import { writeBookPresentationSubagent } from "@/lib/agents/presentation-writer";
import { writeChapterSubagent } from "@/lib/agents/chapter-writer";
import { designAndFormatBook } from "@/lib/agents/designer-formatter";
import { reviewAndPerfectBookManuscript } from "@/lib/agents/book-reviewer";
import { compileHtmlToPdf } from "@/lib/export/pdf-compiler";
import { compileBookToEpub } from "@/lib/export/epub-compiler";
import { generatePublishingMetadata } from "@/lib/agents/publishing-metadata-generator";
import { validateExecutionLimits } from "@/lib/agents/circuit-breaker";
import {
  STAGE_TIMEOUTS,
  runWithTimeout,
  PipelineTimeoutError,
  PipelineAbortedError,
} from "./pipeline-watchdog";

export const pipelineEmitter = new EventEmitter();
pipelineEmitter.setMaxListeners(50);

// Active in-memory running jobs map to prevent duplicate pipeline runs
const activePipelines = new Set<string>();
// Active AbortControllers per book to enable instantaneous Force Stop
const activeAbortControllers = new Map<string, AbortController>();

/**
 * Forcibly stops and cancels an active pipeline execution anywhere it is.
 */
export async function forceStopPipeline(bookId: string): Promise<boolean> {
  const currentBook = getBook(bookId);
  if (currentBook?.status === "completed") {
    console.warn(`[ForceStop] Tentativa de forçar parada em livro já concluído (${bookId}). Operação ignorada.`);
    return false;
  }

  const controller = activeAbortControllers.get(bookId);
  const wasRunning = activePipelines.has(bookId);

  if (controller) {
    controller.abort();
    activeAbortControllers.delete(bookId);
  }

  activePipelines.delete(bookId);

  updateBook(bookId, {
    status: "failed",
    current_step: "Esteira cancelada manualmente pelo usuário (Force Stop)",
    progress_percent: 0,
  });

  const { getTasks, updateTask } = await import("@/lib/db/client");
  const runningTasks = getTasks(bookId).filter((t) => t.status === "running");
  for (const t of runningTasks) {
    updateTask(t.id, {
      status: "failed",
      error: "Cancelado pelo usuário (Force Stop)",
      finished_at: new Date().toISOString(),
    });
  }

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: `stop_${bookId}_${Date.now()}`,
    parent_task_id: null,
    book_id: bookId,
    chapter_id: null,
    agent_role: "SYSTEM",
    level: "warning",
    message: "Operação interrompida imediatamente via Force Stop a pedido do usuário.",
    metadata: JSON.stringify({ bookId, wasRunning }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: null,
    timestamp: new Date().toISOString(),
  });

  emitProgress(bookId, "failed", "Esteira cancelada manualmente (Force Stop)", 0);
  return true;
}

/**
 * Runs the autonomous end-to-end book production pipeline
 */
export async function runFullPipeline(bookId: string): Promise<void> {
  if (activePipelines.has(bookId)) {
    console.log(`Pipeline já em execução para o livro ${bookId}`);
    return;
  }

  activePipelines.add(bookId);
  const abortController = new AbortController();
  activeAbortControllers.set(bookId, abortController);
  const { signal } = abortController;
  const traceId = `trace_${bookId}_${Date.now()}`;

  try {
    const book = getBook(bookId);
    if (!book) throw new Error(`Livro ${bookId} não encontrado no banco de dados.`);

    if (signal.aborted) throw new PipelineAbortedError();

    // ---------------- FUNIL A: INGESTÃO MULTI-ARQUIVO E RAG ----------------
    emitProgress(bookId, "ingesting", "Iniciando extração e verificação criptográfica CAS de arquivos...", 5);
    updateBook(bookId, {
      status: "ingesting",
      current_step: "Processando e verificando deduplicação criptográfica dos arquivos de entrada",
      progress_percent: 10,
    });

    addAuditLog({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      trace_id: traceId,
      parent_task_id: null,
      book_id: bookId,
      chapter_id: null,
      agent_role: "SYSTEM",
      level: "info",
      message: `Esteira iniciada para o livro "${book.title}". Processando fontes de entrada com CAS Deduplication.`,
      metadata: JSON.stringify({
        filePath: book.original_file_path,
        filesCount: book.source_documents?.length || 1,
      }),
      tokens: 0,
      cost_usd: 0,
      latency_ms: 0,
      skill_badge: null,
      timestamp: new Date().toISOString(),
    });

    // Prepara os arquivos de entrada
    const inputFiles: Array<{ filename: string; buffer: Buffer; mimeType?: string }> = [];

    if (book.source_documents && book.source_documents.length > 0) {
      for (const doc of book.source_documents) {
        if (doc.file_path && fs.existsSync(doc.file_path)) {
          const buf = fs.readFileSync(doc.file_path);
          inputFiles.push({ filename: doc.filename, buffer: buf, mimeType: doc.file_type });
        }
      }
    }

    if (inputFiles.length === 0 && book.original_file_path && fs.existsSync(book.original_file_path)) {
      const buf = fs.readFileSync(book.original_file_path);
      const filename = book.original_filename || "documento.pdf";
      inputFiles.push({ filename, buffer: buf });
    }

    if (inputFiles.length === 0) {
      throw new Error(`Nenhum arquivo de entrada válido encontrado para o livro ${bookId}`);
    }

    if (signal.aborted) throw new PipelineAbortedError();

    const { MultiFileExtractor } = await import("@/lib/rag/multi-file-extractor");
    const { indexMultiFileBatch } = await import("@/lib/rag/ai-rag-engine");

    const extractor = new MultiFileExtractor(3);
    const extractionBatch = await runWithTimeout(
      () =>
        extractor.processFiles(inputFiles, (p) => {
          if (signal.aborted) throw new PipelineAbortedError();
          emitProgress(bookId, "ingesting", `${p.file}: ${p.status}`, p.percent);
        }),
      STAGE_TIMEOUTS.ingesting,
      "Ingestão e Extração de Arquivos",
      signal
    );

    if (signal.aborted) throw new PipelineAbortedError();

    emitProgress(
      bookId,
      "chunked",
      `Extração concluída (${extractionBatch.totalChunks} chunks). Deduplicados: ${extractionBatch.deduplicatedCount}.`,
      20
    );
    updateBook(bookId, {
      status: "chunked",
      current_step: `Processados ${extractionBatch.documents.length} documentos (${extractionBatch.totalChunks} chunks)`,
      progress_percent: 20,
    });

    // Vetorização e Indexação no Unified Vector Store com timeout estrito
    if (signal.aborted) throw new PipelineAbortedError();
    emitProgress(bookId, "vectorized", `Indexando no Unified Vector Store [ai-rag]...`, 25);
    updateBook(bookId, {
      status: "vectorized",
      current_step: `Indexando ${extractionBatch.totalChunks} chunks no Unified Vector Store [ai-rag]`,
      progress_percent: 25,
    });

    await runWithTimeout(
      () =>
        indexMultiFileBatch(
          bookId,
          extractionBatch,
          traceId,
          null,
          (pct, statusText) => {
            if (signal.aborted) throw new PipelineAbortedError();
            emitProgress(bookId, "vectorized", statusText, pct);
            updateBook(bookId, {
              status: "vectorized",
              current_step: statusText,
              progress_percent: pct,
            });
          }
        ),
      STAGE_TIMEOUTS.vectorized,
      "Vetorização e Indexação [ai-rag]",
      signal
    );

    // ---------------- FUNIL B: CEO, APRESENTAÇÃO E SUBAGENTES ESCRITORES ----------------
    if (signal.aborted) throw new PipelineAbortedError();
    emitProgress(bookId, "outlining", "CEO Orquestrador gerando o plano de sumário...", 35);
    updateBook(bookId, {
      status: "outlining",
      current_step: "CEO Orquestrador estruturando o plano de capítulos com First Principles...",
      progress_percent: 35,
    });
    let updatedBook = getBook(bookId)!;
    const plan = await runWithTimeout(
      () => generateCeoPlan(updatedBook, traceId),
      STAGE_TIMEOUTS.outlining_ceo,
      "Planejamento do CEO Orquestrador",
      signal
    );

    // Subagente de Apresentação formulando o texto de abertura (1 a 3 páginas no máximo)
    if (signal.aborted) throw new PipelineAbortedError();
    emitProgress(bookId, "outlining", "Subagente de Apresentação formulando a apresentação da obra (1 a 3 páginas)...", 40);
    updateBook(bookId, {
      status: "outlining",
      current_step: "Subagente de Apresentação formulando a apresentação da obra (1 a 3 páginas)...",
      progress_percent: 40,
    });
    updatedBook = getBook(bookId)!;
    await runWithTimeout(
      () => writeBookPresentationSubagent(updatedBook, traceId, "ceo_plan"),
      STAGE_TIMEOUTS.outlining_presentation,
      "Subagente de Apresentação",
      signal
    );

    // Disparar Subagentes Escritores em Paralelo com Concurrency Control (3 concurrent)
    if (signal.aborted) throw new PipelineAbortedError();
    emitProgress(bookId, "writing", "Subagentes redigindo capítulos em paralelo...", 45);
    updateBook(bookId, {
      status: "writing",
      current_step: "Subagentes de capítulo operando em paralelo com tool calling [ai-rag]",
      progress_percent: 50,
    });

    // Validação do Circuit Breaker no início do processo de escrita
    validateExecutionLimits(1, 0, updatedBook.total_tokens, updatedBook.total_cost_usd);

    const chapters = getChapters(bookId);
    const concurrency = 3;
    let completedCount = 0;

    for (let i = 0; i < chapters.length; i += concurrency) {
      if (signal.aborted) throw new PipelineAbortedError();
      const batch = chapters.slice(i, i + concurrency);
      const batchPromises = batch.map(async (chap) => {
        if (signal.aborted) throw new PipelineAbortedError();
        try {
          await writeChapterSubagent(chap, plan.bookTitle, traceId, chap.parent_task_id || "ceo_plan");
          completedCount++;
          const currentPercent = 50 + Math.round((completedCount / chapters.length) * 35);
          const stepMsg = `Capítulo ${chap.chapter_number} concluído (${completedCount}/${chapters.length})`;
          updateBook(bookId, {
            status: "writing",
            current_step: stepMsg,
            progress_percent: currentPercent,
          });
          emitProgress(
            bookId,
            "writing",
            stepMsg,
            currentPercent
          );
        } catch (err: any) {
          console.error(`Erro no subagente do capítulo ${chap.chapter_number}:`, err);
          updateChapter(chap.id, {
            status: "failed",
            error_message: err.message || String(err),
          });
          addAuditLog({
            id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            trace_id: traceId,
            parent_task_id: chap.parent_task_id,
            book_id: bookId,
            chapter_id: chap.id,
            agent_role: `WRITER (Capítulo ${chap.chapter_number})`,
            level: "error",
            message: `Falha na redação do capítulo ${chap.chapter_number}: ${err.message || err}`,
            metadata: JSON.stringify({ error: String(err) }),
            tokens: 0,
            cost_usd: 0,
            latency_ms: 0,
            skill_badge: null,
            timestamp: new Date().toISOString(),
          });
        }
      });

      await runWithTimeout(
        () => Promise.all(batchPromises),
        STAGE_TIMEOUTS.writing_batch,
        `Redação dos Capítulos (${batch.map((c) => c.chapter_number).join(", ")})`,
        signal
      );
    }

    // ---------------- VALIDAÇÃO DE INTEGRIDADE DOS CAPÍTULOS ----------------
    if (signal.aborted) throw new PipelineAbortedError();
    const finishedChapters = getChapters(bookId);
    const failedChapters = finishedChapters.filter((c) => c.status !== "completed");
    if (failedChapters.length > 0) {
      throw new Error(
        `Esteira interrompida: ${failedChapters.length} de ${finishedChapters.length} capítulos falharam durante a redação.`
      );
    }

    // ---------------- FUNIL C: DIAGRAMAÇÃO E EXPORTAÇÃO ----------------
    if (signal.aborted) throw new PipelineAbortedError();
    emitProgress(bookId, "formatting", "Subagente Designer padronizando tipografia e layout...", 88);
    updateBook(bookId, {
      status: "formatting",
      current_step: "Designer aplicando tipografia editorial e estilos Paged Media",
      progress_percent: 88,
    });

    const latestBook = getBook(bookId)!;
    validateExecutionLimits(2, 0, latestBook.total_tokens, latestBook.total_cost_usd);

    const formattedOutput = await runWithTimeout(
      () => designAndFormatBook(latestBook, finishedChapters, traceId, "ceo_consolidation"),
      STAGE_TIMEOUTS.formatting_designer,
      "Diagramação & Formatação",
      signal
    );

    // ---------------- FUNIL D: REVISÃO EDITORIAL E CONTROLE DE QUALIDADE COMERCIAL ----------------
    if (signal.aborted) throw new PipelineAbortedError();
    emitProgress(bookId, "formatting", "Subagente Revisor Editorial auditando e aperfeiçoando o livro...", 92);
    updateBook(bookId, {
      status: "formatting",
      current_step: "Revisor Editorial verificando padrão visual, fórmulas, gráficos e eliminando qualquer código/markdown residual",
      progress_percent: 92,
    });

    const reviewedOutput = await runWithTimeout(
      () => reviewAndPerfectBookManuscript(latestBook, finishedChapters, formattedOutput, traceId, "designer_format"),
      STAGE_TIMEOUTS.formatting_reviewer,
      "Revisão Editorial Comercial",
      signal
    );

    if (signal.aborted) throw new PipelineAbortedError();
    const remediationMsg = reviewedOutput.activeRemediationApplied
      ? ` (Remediação Ativa: Manuscrito expandido para ~${reviewedOutput.finalEstimatedPages} páginas)`
      : "";
    const compilingMsg = `Compilando arquivo PDF final${remediationMsg}...`;
    updateBook(bookId, {
      status: "formatting",
      current_step: compilingMsg,
      progress_percent: 96,
    });
    emitProgress(bookId, "formatting", compilingMsg, 96);

    const pdfFilePath = await runWithTimeout(
      () =>
        compileHtmlToPdf(
          bookId,
          reviewedOutput.htmlContent,
          traceId,
          "reviewer_format",
          latestBook.page_size
        ),
      STAGE_TIMEOUTS.compiling_pdf,
      "Compilação do Arquivo PDF",
      signal
    );

    // ---------------- FUNIL E: EXPORTAÇÃO EPUB (PADRÃO BULKHEAD) ----------------
    let epubFilePath: string | null = null;
    try {
      if (signal?.aborted) throw new PipelineAbortedError();
      emitProgress(bookId, "formatting", "Compilando arquivo EPUB reflowable (EPUB 3 / Kindle)...", 98);
      epubFilePath = await runWithTimeout(
        () => compileBookToEpub(bookId, traceId, "reviewer_format", latestBook, finishedChapters),
        STAGE_TIMEOUTS.compiling_epub,
        "Compilação do Arquivo EPUB",
        signal
      );
    } catch (epubErr: any) {
      // CRÍTICO: Se a esteira foi abortada pelo usuário via Force Stop, NUNCA engolir a exceção!
      if (epubErr instanceof PipelineAbortedError || signal?.aborted) {
        throw epubErr;
      }
      // Falha isolada do EPUB: apenas registrar aviso no audit log, mantendo o PDF 100% íntegro
      console.warn(`[Bulkhead Isolation] Aviso: Falha não fatal ao gerar EPUB para o livro ${bookId}:`, epubErr);
      addAuditLog({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        trace_id: traceId,
        parent_task_id: "reviewer_format",
        book_id: bookId,
        chapter_id: null,
        agent_role: "DESIGNER",
        level: "warning",
        message: `Aviso [Bulkhead]: Compilação do EPUB não pôde ser concluída, mas o PDF foi preservado com sucesso. Motivo: ${epubErr.message || epubErr}`,
        metadata: JSON.stringify({ error: String(epubErr) }),
        tokens: 0,
        cost_usd: 0,
        latency_ms: 0,
        skill_badge: "epub-compiler",
        timestamp: new Date().toISOString(),
      });
    }

    // Consolidação atômica final de tokens, custos, páginas e status 'completed'
    const finalBook = getBook(bookId);
    const allLogs = getAuditLogs(bookId);
    const allTasks = getTasks(bookId);
    const logTokens = allLogs.reduce((sum, l) => sum + (l.tokens || 0), 0);
    const logCost = allLogs.reduce((sum, l) => sum + (l.cost_usd || 0), 0);
    const taskTokens = allTasks.reduce((sum, t) => sum + (t.tokens_in || 0) + (t.tokens_out || 0), 0);
    const taskCost = allTasks.reduce((sum, t) => sum + (t.cost_usd || 0), 0);
    const finalTokens = Math.max(logTokens, taskTokens, finalBook?.total_tokens || 0);
    const finalCost = Math.max(logCost, taskCost, finalBook?.total_cost_usd || 0);
    const actualPages = finalBook?.actual_pages || reviewedOutput.finalEstimatedPages || null;

    // Geração de metadados de publicação (Capa Minimalista, Categorias e Resumo Comercial)
    let publishingMeta: any = null;
    try {
      publishingMeta = await generatePublishingMetadata(latestBook, finishedChapters);
    } catch (pubErr) {
      console.warn(`[Publishing Metadata] Falha não fatal ao gerar metadados de publicação:`, pubErr);
    }

    updateBook(bookId, {
      status: "completed",
      current_step: "Livro concluído e arquivos (PDF e EPUB) disponíveis para download",
      progress_percent: 100,
      total_tokens: finalTokens,
      total_cost_usd: finalCost,
      actual_pages: actualPages,
      pdf_path: finalBook?.pdf_path || pdfFilePath,
      epub_path: finalBook?.epub_path || epubFilePath,
      cover_prompt: publishingMeta?.coverPrompt || finalBook?.cover_prompt || null,
      suggested_categories: publishingMeta?.suggestedCategories || finalBook?.suggested_categories || null,
      marketing_description: publishingMeta?.marketingDescription || finalBook?.marketing_description || null,
      seo_keywords: publishingMeta?.seoKeywords || finalBook?.seo_keywords || null,
    });

    addAuditLog({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      trace_id: traceId,
      parent_task_id: null,
      book_id: bookId,
      chapter_id: null,
      agent_role: "SYSTEM",
      level: "info",
      message: `Esteira concluída com sucesso. Métricas consolidadas: ${finalTokens.toLocaleString()} tokens, $${finalCost.toFixed(4)} USD, ${actualPages ? `${actualPages} páginas físicas geradas` : "PDF gerado"}.`,
      metadata: JSON.stringify({ finalTokens, finalCost, actualPages, pdfFilePath }),
      tokens: 0,
      cost_usd: 0,
      latency_ms: 0,
      skill_badge: null,
      timestamp: new Date().toISOString(),
    });

    emitProgress(bookId, "completed", "Livro concluído com sucesso!", 100);
  } catch (error: any) {
    const isAborted = error instanceof PipelineAbortedError || signal.aborted;
    const isTimeout = error instanceof PipelineTimeoutError;
    const errorMessage = isAborted
      ? "Esteira cancelada manualmente pelo usuário (Force Stop)"
      : isTimeout
      ? error.message
      : `Erro: ${error.message || error}`;

    console.error(`Erro na esteira do livro ${bookId}:`, error);
    updateBook(bookId, {
      status: "failed",
      current_step: errorMessage,
      progress_percent: 0,
    });

    emitProgress(bookId, "failed", errorMessage, 0);

    addAuditLog({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      trace_id: traceId,
      parent_task_id: null,
      book_id: bookId,
      chapter_id: null,
      agent_role: "SYSTEM",
      level: isAborted ? "warning" : "error",
      message: `Esteira interrompida: ${errorMessage}`,
      metadata: JSON.stringify({ error: String(error), isAborted, isTimeout }),
      tokens: 0,
      cost_usd: 0,
      latency_ms: 0,
      skill_badge: null,
      timestamp: new Date().toISOString(),
    });
  } finally {
    activeAbortControllers.delete(bookId);
    activePipelines.delete(bookId);
  }
}

/**
 * Replays a single chapter node without re-running the entire book
 */
export async function replayChapterTask(
  bookId: string,
  chapterId: string
): Promise<void> {
  const traceId = `replay_${chapterId}_${Date.now()}`;
  const chapter = getChapter(chapterId);
  const book = getBook(bookId);

  if (!chapter || !book) {
    throw new Error("Livro ou Capítulo não encontrado para Replay.");
  }

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: chapter.parent_task_id,
    book_id: bookId,
    chapter_id: chapterId,
    agent_role: "SYSTEM",
    level: "info",
    message: `[Modo Replay]: Reexecutando exclusivamente o nó do Capítulo ${chapter.chapter_number} ("${chapter.title}").`,
    metadata: JSON.stringify({ chapterId, bookId }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: null,
    timestamp: new Date().toISOString(),
  });

  emitProgress(bookId, "writing", `Reexecutando Capítulo ${chapter.chapter_number}...`, 50);

  // Re-run the chapter subagent
  await writeChapterSubagent(chapter, book.title, traceId, chapter.parent_task_id || "ceo_plan");

  // Re-run the designer to update the consolidated book and recompile PDF
  emitProgress(bookId, "formatting", "Reintegrando capítulo no manuscrito e recompilando PDF...", 90);
  const allChapters = getChapters(bookId);
  const formatted = await designAndFormatBook(book, allChapters, traceId, "replay_consolidation");
  const pdfFilePath = await compileHtmlToPdf(bookId, formatted.htmlContent, traceId, "replay_pdf", book.page_size);

  let epubFilePath: string | null = null;
  try {
    epubFilePath = await compileBookToEpub(bookId, traceId, "replay_epub", book, allChapters);
  } catch (epubErr) {
    console.warn(`[Replay Bulkhead] Falha não fatal ao atualizar EPUB após replay:`, epubErr);
  }

  const finalBook = getBook(bookId);
  const allLogs = getAuditLogs(bookId);
  const allTasks = getTasks(bookId);
  const logTokens = allLogs.reduce((sum, l) => sum + (l.tokens || 0), 0);
  const logCost = allLogs.reduce((sum, l) => sum + (l.cost_usd || 0), 0);
  const taskTokens = allTasks.reduce((sum, t) => sum + (t.tokens_in || 0) + (t.tokens_out || 0), 0);
  const taskCost = allTasks.reduce((sum, t) => sum + (t.cost_usd || 0), 0);
  const finalTokens = Math.max(logTokens, taskTokens, finalBook?.total_tokens || 0);
  const finalCost = Math.max(logCost, taskCost, finalBook?.total_cost_usd || 0);

  updateBook(bookId, {
    status: "completed",
    current_step: `Replay do Capítulo ${chapter.chapter_number} concluído e arquivos atualizados`,
    progress_percent: 100,
    total_tokens: finalTokens,
    total_cost_usd: finalCost,
    actual_pages: finalBook?.actual_pages || book.actual_pages || null,
    pdf_path: finalBook?.pdf_path || pdfFilePath,
    epub_path: epubFilePath || finalBook?.epub_path || null,
  });

  emitProgress(bookId, "completed", `Replay do Capítulo ${chapter.chapter_number} concluído com sucesso!`, 100);
}

function emitProgress(
  bookId: string,
  status: string,
  message: string,
  percent: number
) {
  pipelineEmitter.emit(`progress:${bookId}`, {
    bookId,
    status,
    message,
    percent,
    timestamp: new Date().toISOString(),
  });
}
