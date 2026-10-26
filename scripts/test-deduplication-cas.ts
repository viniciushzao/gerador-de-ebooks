import { FileDeduplicator } from "../lib/rag/deduplicator";
import { UnifiedVectorStore } from "../lib/rag/unified-vector-store";

async function runDeduplicationCasTest() {
  console.log("=== TESTE 1: CAS DEDUPLICATION & SHA-256 LOOKUP ===");
  const vectorStore = UnifiedVectorStore.getInstance();
  const deduplicator = new FileDeduplicator(vectorStore);

  const uniqueString = `Conteúdo editorial exclusivo para teste de deduplicação criptográfica SHA-256 - ${Date.now()}`;
  const sampleBuffer = Buffer.from(uniqueString);
  const hash = deduplicator.calculateFileHash(sampleBuffer);
  console.log(`[PASS] Hash SHA-256 gerado: ${hash}`);

  // 1. Verificação de Cache Miss inicial
  const check1 = deduplicator.checkFile(sampleBuffer);
  console.log(`[PASS] Primeiro check (Inédito): isDeduplicated = ${check1.isDeduplicated}`);
  if (check1.isDeduplicated) {
    throw new Error("Deveria ser false para arquivo inédito");
  }

  // 2. Simula indexação do documento
  vectorStore.saveDocument({
    id: hash,
    file_name: "teste_manual_dinamico.txt",
    file_type: "txt",
    mime_type: "text/plain",
    file_size_bytes: sampleBuffer.length,
    total_sections_pages: 1,
    total_chunks: 3,
    total_tokens: 150,
    status: "indexed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // 3. Verificação de Cache Hit (CAS)
  const startTime = Date.now();
  const check2 = deduplicator.checkFile(sampleBuffer);
  const latencyMs = Date.now() - startTime;

  console.log(`[PASS] Segundo check (Reenvio): isDeduplicated = ${check2.isDeduplicated} (${latencyMs}ms)`);
  if (!check2.isDeduplicated) {
    throw new Error("Deveria ser true após indexação no CAS");
  }

  console.log(`[PASS] Documento recuperado: ${check2.existingDoc?.file_name} com ${check2.existingDoc?.total_chunks} chunks.`);
  console.log("=== TESTE 1 CONCLUÍDO COM 100% DE SUCESSO ===\n");
}

runDeduplicationCasTest().catch((err) => {
  console.error("Erro no teste CAS:", err);
  process.exit(1);
});
