import {
  insertChunks,
  getChunks,
  addAuditLog,
  RagChunkRecord,
} from "@/lib/db/client";
import { generateEmbedding, generateBatchEmbeddings } from "@/lib/agents/gemini-client";
import { SemanticChunk } from "./chunker";
import { getSystemConfig } from "@/lib/config";
import { UnifiedVectorStore } from "./unified-vector-store";
import { TopicClusterer } from "./topic-clusterer";
import { SemanticRouter } from "./semantic-router";
import { MultiFileIngestionBatch } from "./multi-file-extractor";

export interface RagQueryResult {
  chunks: Array<{
    id: string;
    chunkIndex: number;
    pageNumber: number;
    content: string;
    similarityScore: number;
    topicCluster?: string;
    tags?: string[];
  }>;
  totalTokens: number;
  sources: string[];
}

/**
 * Ingesta e vetoriza um lote multi-arquivo no Unified Vector Store com persistência permanente e CAS.
 */
export async function indexMultiFileBatch(
  bookId: string,
  batch: MultiFileIngestionBatch,
  traceId: string,
  parentTaskId: string | null,
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<{ totalIndexed: number; totalTokens: number }> {
  const startTime = Date.now();
  const vectorStore = UnifiedVectorStore.getInstance();
  let totalIndexed = 0;
  let totalTokens = 0;
  const clusterCounts: Record<string, number> = {};

  // 1. Processa cada documento do lote
  for (let docIdx = 0; docIdx < batch.documents.length; docIdx++) {
    const doc = batch.documents[docIdx];
    if (doc.error) continue;

    // Se o documento já estava deduplicado no CAS
    if (doc.isDeduplicated) {
      vectorStore.attachDocumentToBook(bookId, doc.fileHash, docIdx + 1, "reference");
      onProgress?.(
        30 + Math.round(((docIdx + 1) / batch.documents.length) * 5),
        `Documento ${doc.filename} recuperado do cache CAS (0ms)`
      );
      continue;
    }

    // Registra o novo documento
    vectorStore.saveDocument({
      id: doc.fileHash,
      file_name: doc.filename,
      file_type: doc.fileType,
      mime_type: doc.mimeType,
      file_size_bytes: doc.fileSizeBytes,
      total_sections_pages: doc.totalSections,
      total_chunks: doc.chunks.length,
      total_tokens: doc.chunks.reduce((sum, c) => sum + c.tokenCount, 0),
      status: "indexed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    vectorStore.attachDocumentToBook(bookId, doc.fileHash, docIdx + 1, docIdx === 0 ? "primary" : "reference");

    // 2. Gera embeddings em lotes para os chunks novos
    const batchSize = 25;
    const chunksToInsert: any[] = [];
    const legacyRecords: RagChunkRecord[] = [];

    for (let i = 0; i < doc.chunks.length; i += batchSize) {
      const chunkBatch = doc.chunks.slice(i, i + batchSize);
      const texts = chunkBatch.map((c) => c.content);

      const embeddings = await generateBatchEmbeddings(texts);

      for (let j = 0; j < chunkBatch.length; j++) {
        const chunk = chunkBatch[j];
        const embedding = embeddings[j] || [];
        totalTokens += chunk.tokenCount;
        totalIndexed++;

        // Classificação semântica do chunk
        const { topicCluster, tags } = TopicClusterer.classifyChunk(chunk.content);
        clusterCounts[topicCluster] = (clusterCounts[topicCluster] || 0) + 1;

        const chunkId = `chunk_${doc.fileHash.slice(0, 12)}_${chunk.chunkIndex}`;

        chunksToInsert.push({
          chunkId,
          documentId: doc.fileHash,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding,
          topicCluster,
          tags,
          metadata: {
            filename: doc.filename,
            fileType: doc.fileType,
            source_page: chunk.pageNumber,
            indexed_at: new Date().toISOString(),
          },
        });

        legacyRecords.push({
          id: chunkId,
          book_id: bookId,
          file_id: doc.fileHash,
          file_hash: doc.fileHash,
          chunk_index: chunk.chunkIndex,
          page_number: chunk.pageNumber,
          content: chunk.content,
          token_count: chunk.tokenCount,
          embedding: "[]",
          topic_cluster: topicCluster,
          tags,
          metadata: JSON.stringify({
            filename: doc.filename,
            source_page: chunk.pageNumber,
          }),
        });
      }

      const currentProgress = Math.min(
        34,
        25 + Math.round(((docIdx * doc.chunks.length + i + chunkBatch.length) / (batch.totalChunks || 1)) * 9)
      );
      onProgress?.(currentProgress, `Vetorizando ${doc.filename} [ai-rag]...`);
    }

    // Inserção em lote no SQLite WAL
    vectorStore.insertChunksBatch(chunksToInsert);
    // Inserção no repositório JSON legada para retrocompatibilidade
    insertChunks(legacyRecords);
  }

  // Registra clusters de tópicos detectados
  TopicClusterer.registerClusters(vectorStore, clusterCounts);

  const latencyMs = Date.now() - startTime;
  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: bookId,
    chapter_id: null,
    agent_role: "RAG_PROCESSOR",
    level: "skill_call",
    message: `Plugin [ai-rag]: Ingestão multi-arquivo concluída. ${totalIndexed} novos chunks indexados no SQLite WAL (${latencyMs}ms). Deduplicados: ${batch.deduplicatedCount}.`,
    metadata: JSON.stringify({
      indexedCount: totalIndexed,
      deduplicatedCount: batch.deduplicatedCount,
      totalTokens,
      filesCount: batch.documents.length,
      provider: getSystemConfig().VECTOR_DB_PROVIDER,
      latencyMs,
    }),
    tokens: totalTokens,
    cost_usd: 0.0,
    latency_ms: latencyMs,
    skill_badge: "ai-rag",
    timestamp: new Date().toISOString(),
  });

  return { totalIndexed, totalTokens };
}

/**
 * Indexes single-file semantic chunks into the vector store (Legacy wrapper)
 */
export async function indexDocumentChunks(
  bookId: string,
  chunks: SemanticChunk[],
  traceId: string,
  parentTaskId: string | null,
  onProgress?: (indexedCount: number, totalCount: number, percent: number) => void
): Promise<{ indexedCount: number; totalTokens: number }> {
  const startTime = Date.now();
  let totalTokens = 0;
  const chunkRecords: RagChunkRecord[] = [];
  const vectorStore = UnifiedVectorStore.getInstance();
  const chunksToInsert: any[] = [];
  const clusterCounts: Record<string, number> = {};

  if (!chunks || chunks.length === 0) {
    return { indexedCount: 0, totalTokens: 0 };
  }

  const batchSize = 25;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.content);

    const embeddings = await generateBatchEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = embeddings[j] || [];
      totalTokens += chunk.tokenCount;

      const { topicCluster, tags } = TopicClusterer.classifyChunk(chunk.content);
      clusterCounts[topicCluster] = (clusterCounts[topicCluster] || 0) + 1;

      const chunkId = `chunk_${bookId}_${chunk.chunkIndex}`;

      chunksToInsert.push({
        chunkId,
        documentId: bookId,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding,
        topicCluster,
        tags,
        metadata: {
          source_page: chunk.pageNumber,
          indexed_at: new Date().toISOString(),
        },
      });

      chunkRecords.push({
        id: chunkId,
        book_id: bookId,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber,
        content: chunk.content,
        token_count: chunk.tokenCount,
        embedding: "[]",
        topic_cluster: topicCluster,
        tags,
        metadata: JSON.stringify({
          source_page: chunk.pageNumber,
          indexed_at: new Date().toISOString(),
        }),
      });
    }

    const currentCount = Math.min(i + batch.length, chunks.length);
    const progressPercent = Math.min(34, 25 + Math.round((currentCount / chunks.length) * 9));

    if (onProgress) {
      onProgress(currentCount, chunks.length, progressPercent);
    }
  }

  // Persistir chunks no SQLite WAL e no banco local JSON
  vectorStore.insertChunksBatch(chunksToInsert);
  insertChunks(chunkRecords);
  TopicClusterer.registerClusters(vectorStore, clusterCounts);

  const latencyMs = Date.now() - startTime;
  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: bookId,
    chapter_id: null,
    agent_role: "RAG_PROCESSOR",
    level: "skill_call",
    message: `Plugin [ai-rag]: Vetorização concluída com sucesso. ${chunkRecords.length} chunks indexados (${latencyMs}ms).`,
    metadata: JSON.stringify({
      indexedCount: chunkRecords.length,
      totalTokens,
      provider: getSystemConfig().VECTOR_DB_PROVIDER,
      latencyMs,
    }),
    tokens: totalTokens,
    cost_usd: 0.0,
    latency_ms: latencyMs,
    skill_badge: "ai-rag",
    timestamp: new Date().toISOString(),
  });

  return {
    indexedCount: chunkRecords.length,
    totalTokens,
  };
}

/**
 * Queries the vector database using cosine similarity and hybrid routing
 */
export async function queryRag(
  bookId: string,
  query: string,
  topK: number = 5,
  traceId?: string,
  parentTaskId?: string | null,
  chapterId?: string | null,
  topicCluster?: string
): Promise<RagQueryResult> {
  const startTime = Date.now();
  const vectorStore = UnifiedVectorStore.getInstance();
  const rawQueryVec = await generateEmbedding(query);

  // Busca híbrida no Unified Vector Store
  const searchResults = vectorStore.searchHybrid({
    bookId,
    queryVector: rawQueryVec,
    queryText: query,
    topicCluster,
    topK,
    minScore: 0.2,
  });

  if (searchResults.length > 0) {
    const totalTokens = searchResults.reduce(
      (sum, c) => sum + (c.metadata?.token_count || 150),
      0
    );
    const sources = Array.from(
      new Set(searchResults.map((c) => `Página ${c.pageNumber}`))
    );

    const latencyMs = Date.now() - startTime;
    if (traceId) {
      addAuditLog({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        trace_id: traceId,
        parent_task_id: parentTaskId || null,
        book_id: bookId,
        chapter_id: chapterId || null,
        agent_role: "RAG_PROCESSOR",
        level: "skill_call",
        message: `Plugin [ai-rag]: Consulta vetorial híbrida para "${query.slice(0, 60)}..." retornou ${searchResults.length} chunks.`,
        metadata: JSON.stringify({
          query,
          topK,
          topicCluster: topicCluster || "all",
          scores: searchResults.map((s) => s.score.toFixed(3)),
        }),
        tokens: totalTokens,
        cost_usd: 0.0,
        latency_ms: latencyMs,
        skill_badge: "ai-rag",
        timestamp: new Date().toISOString(),
      });
    }

    return {
      chunks: searchResults.map((s, idx) => ({
        id: s.chunkId,
        chunkIndex: idx,
        pageNumber: s.pageNumber,
        content: s.content,
        similarityScore: s.score,
        topicCluster: s.topicCluster,
        tags: s.tags,
      })),
      totalTokens,
      sources,
    };
  }

  // Fallback para getChunks legada caso o SQLite não tenha os registros desse bookId
  const records = getChunks(bookId);
  if (records.length === 0) {
    return { chunks: [], totalTokens: 0, sources: [] };
  }

  const queryVec = new Float32Array(rawQueryVec);
  const scored = records.map((rec) => {
    let floatArr: Float32Array;
    try {
      floatArr = new Float32Array(JSON.parse(rec.embedding));
    } catch {
      floatArr = new Float32Array(768);
    }

    let dot = 0;
    const len = Math.min(queryVec.length, floatArr.length);
    for (let i = 0; i < len; i++) dot += queryVec[i] * floatArr[i];

    return {
      id: rec.id,
      chunkIndex: rec.chunk_index,
      pageNumber: rec.page_number,
      content: rec.content,
      similarityScore: dot,
      tokenCount: rec.token_count,
    };
  });

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  const selected = scored.slice(0, topK);
  const totalTokens = selected.reduce((sum, c) => sum + c.tokenCount, 0);
  const sources = Array.from(new Set(selected.map((c) => `Página ${c.pageNumber}`)));

  return {
    chunks: selected.map((s) => ({
      id: s.id,
      chunkIndex: s.chunkIndex,
      pageNumber: s.pageNumber,
      content: s.content,
      similarityScore: s.similarityScore,
    })),
    totalTokens,
    sources,
  };
}
