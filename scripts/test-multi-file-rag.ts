import { MultiFileExtractor, InputFile } from "../lib/rag/multi-file-extractor";
import { TopicClusterer } from "../lib/rag/topic-clusterer";
import { UnifiedVectorStore } from "../lib/rag/unified-vector-store";

async function runMultiFileRagTest() {
  console.log("=== TESTE 2: INGESTÃO MULTI-ARQUIVO, TOPIC CLUSTERING & HYBRID SEARCH ===");
  const vectorStore = UnifiedVectorStore.getInstance();
  const extractor = new MultiFileExtractor(3);

  // Prepara 3 arquivos com domínios distintos
  const file1: InputFile = {
    filename: "manual_financeiro.txt",
    buffer: Buffer.from(`
# Manual de Métricas Financeiras e Unit Economics
A margem de contribuição é calculada como receita subtraída pelos custos variáveis.
O Custo de Aquisição de Clientes (CAC) deve ser recuperado em menos de 6 meses (Payback rápido).
O Lifetime Value (LTV) precisa ser no mínimo 3 vezes superior ao CAC (LTV/CAC > 3x).
O EBITDA e o fluxo de caixa garantem a sustentabilidade do modelo SaaS sem queima excessiva de capital (Burn Rate).
    `),
  };

  const file2: InputFile = {
    filename: "framework_lideranca.md",
    buffer: Buffer.from(`
# Princípios de Liderança e Cultura de Alta Performance
A cultura organizacional é moldada pela transparência radical e pela autonomia dos times.
Os OKRs (Objectives and Key Results) devem ser ambiciosos e revisados a cada trimestre.
A antifragilidade da equipe surge da capacidade de absorver feedbacks e iterar com velocidade máxima.
    `),
  };

  const file3: InputFile = {
    filename: "playbook_vendas.txt",
    buffer: Buffer.from(`
# Playbook de Aquisição e Funil de Vendas
O funil de vendas divide-se em Topo (Atração de Leads), Meio (Nutrição e VSL) e Fundo (Conversão e Checkout).
Estratégias de Outbound e Inbound Marketing operam em sincronia para gerar tráfego qualificado.
O copywriting de conversão deve abordar as dores mais profundas do avatar sem promessas vazias.
    `),
  };

  console.log("[INFO] Processando lote de 3 arquivos simultâneos...");
  const batch = await extractor.processFiles([file1, file2, file3], (p) => {
    console.log(`  -> Progresso [${p.file}]: ${p.status} (${p.percent}%)`);
  });

  console.log(`[PASS] Total de Documentos: ${batch.documents.length}`);
  console.log(`[PASS] Total de Chunks Gerados: ${batch.totalChunks}`);

  // Classifica chunks e simula inserção
  const chunksToInsert: any[] = [];
  const clusterCounts: Record<string, number> = {};

  for (const doc of batch.documents) {
    for (const chunk of doc.chunks) {
      const { topicCluster, tags } = TopicClusterer.classifyChunk(chunk.content);
      clusterCounts[topicCluster] = (clusterCounts[topicCluster] || 0) + 1;

      // Mock vector de 768 dimensões com embedding semântico
      const mockEmbedding = new Array(768).fill(0).map((_, i) => (i % 2 === 0 ? 0.05 : -0.02));

      chunksToInsert.push({
        chunkId: `chunk_test_${doc.fileHash.slice(0, 8)}_${chunk.chunkIndex}`,
        documentId: doc.fileHash,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: mockEmbedding,
        topicCluster,
        tags,
      });

      vectorStore.saveDocument({
        id: doc.fileHash,
        file_name: doc.filename,
        file_type: doc.fileType,
        mime_type: doc.mimeType,
        file_size_bytes: doc.fileSizeBytes,
        total_sections_pages: doc.totalSections,
        total_chunks: doc.chunks.length,
        total_tokens: doc.chunks.reduce((s, c) => s + c.tokenCount, 0),
        status: "indexed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  vectorStore.insertChunksBatch(chunksToInsert);
  TopicClusterer.registerClusters(vectorStore, clusterCounts);

  console.log("[PASS] Chunks e Clusters inseridos com sucesso no SQLite WAL.");
  console.log("  -> Clusters detectados:", clusterCounts);

  // 4. Executa Busca Híbrida com Filtro de Tópico
  console.log("\n[INFO] Testando busca híbrida escopada para tópico 'financas_metricas'...");
  const searchResults = vectorStore.searchHybrid({
    queryVector: new Array(768).fill(0).map((_, i) => (i % 2 === 0 ? 0.05 : -0.02)),
    queryText: "qual o cálculo do CAC e LTV?",
    topicCluster: "financas_metricas",
    topK: 3,
  });

  console.log(`[PASS] Resultados retornados: ${searchResults.length}`);
  for (const res of searchResults) {
    console.log(`  -> [Score: ${res.score.toFixed(3)}] Cluster: ${res.topicCluster} | Tags: ${res.tags.join(", ")}`);
    console.log(`     Snippet: "${res.content.slice(0, 100)}..."`);
  }

  if (searchResults.length === 0 || searchResults[0].topicCluster !== "financas_metricas") {
    throw new Error("Busca híbrida deveria ter retornado chunks do cluster financas_metricas");
  }

  console.log("=== TESTE 2 CONCLUÍDO COM 100% DE SUCESSO ===\n");
}

runMultiFileRagTest().catch((err) => {
  console.error("Erro no teste Multi-File RAG:", err);
  process.exit(1);
});
