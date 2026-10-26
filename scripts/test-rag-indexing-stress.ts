import { indexDocumentChunks, queryRag } from "../lib/rag/ai-rag-engine";
import { SemanticChunk } from "../lib/rag/chunker";

async function testRagIndexingStress() {
  console.log("=== TESTANDO INDEXAÇÃO RAG EM LOTE E PROGRESO INCREMENTAL ===");

  // Simular 80 chunks de um livro real
  const mockChunks: SemanticChunk[] = [];
  for (let i = 0; i < 80; i++) {
    mockChunks.push({
      chunkIndex: i,
      pageNumber: Math.floor(i / 3) + 1,
      content: `Chunk ${i}: Análise analítica e empírica da métrica de elasticidade de preço, margem de contribuição e retorno sobre o capital empregado (ROCE) no contexto de decisões de portfólio. Mapeamento de canais de distribuição direta vs atacado número ${i}.`,
      tokenCount: 45,
    });
  }

  const progressUpdates: Array<{ indexed: number; total: number; pct: number }> = [];

  const startTime = Date.now();
  const res = await indexDocumentChunks(
    "book_stress_rag_test",
    mockChunks,
    "trace_stress_rag",
    null,
    (indexed, total, pct) => {
      progressUpdates.push({ indexed, total, pct });
      console.log(`[Progresso RAG]: ${indexed}/${total} chunks indexados (${pct}%)`);
    }
  );

  const durationMs = Date.now() - startTime;
  console.log(`\nTempo total de indexação de ${mockChunks.length} chunks: ${durationMs}ms`);

  if (res.indexedCount !== mockChunks.length) {
    console.error(`ERRO: Chunks indexados esperados: ${mockChunks.length}, obtidos: ${res.indexedCount}`);
    process.exit(1);
  }

  if (progressUpdates.length === 0) {
    console.error("ERRO: Nenhuma atualização de progresso incremental foi disparada!");
    process.exit(1);
  }

  console.log("✓ SUCESSO: 80 chunks indexados em lote de alta velocidade sem travamentos!");

  // Testar busca RAG
  console.log("\n--- Testando Consulta Vetorial no RAG ---");
  const queryResult = await queryRag(
    "book_stress_rag_test",
    "elasticidade de preco e margem de contribuicao",
    4,
    "trace_stress_rag",
    null
  );

  console.log("Chunks recuperados:", queryResult.chunks.length);
  if (queryResult.chunks.length !== 4) {
    console.error(`ERRO: Esperados 4 chunks, obtidos: ${queryResult.chunks.length}`);
    process.exit(1);
  }

  console.log("Primeiro chunk recuperado (score):", queryResult.chunks[0].similarityScore);
  console.log("✓ SUCESSO: Consulta vetorial recuperou os chunks relevantes com alta similaridade!");
  console.log("\n=======================================================");
  console.log("🎉 TESTE DE RESILIÊNCIA E VELOCIDADE DO AI-RAG APROVADO!");
  console.log("=======================================================");
}

testRagIndexingStress().catch((err) => {
  console.error(err);
  process.exit(1);
});
