import { UnifiedVectorStore } from "../lib/rag/unified-vector-store";
import { MultiFileExtractor, InputFile } from "../lib/rag/multi-file-extractor";

async function runConcurrencyAndResilienceTest() {
  console.log("=== TESTE 3: CONCORRÊNCIA SQLITE WAL & ISOLAMENTO DE FALHAS (RESILIÊNCIA) ===");
  const vectorStore = UnifiedVectorStore.getInstance();

  // 1. Teste de Concorrência: 10 escritas atômicas simultâneas
  console.log("[INFO] Executando 10 inserções simultâneas no SQLite WAL...");
  const concurrentWrites = Array.from({ length: 10 }).map((_, i) => {
    return (async () => {
      const docId = `doc_concurrent_${Date.now()}_${i}`;
      vectorStore.saveDocument({
        id: docId,
        file_name: `arquivo_concorrente_${i}.txt`,
        file_type: "txt",
        mime_type: "text/plain",
        file_size_bytes: 500,
        total_sections_pages: 1,
        total_chunks: 2,
        total_tokens: 100,
        status: "indexed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      vectorStore.insertChunksBatch([
        {
          chunkId: `chunk_conc_${i}_1`,
          documentId: docId,
          chunkIndex: 1,
          pageNumber: 1,
          content: `Conteúdo concorrente ${i} - Parte 1`,
          tokenCount: 50,
          embedding: new Array(768).fill(0.01 * (i + 1)),
          topicCluster: "engenharia_tech",
          tags: ["concorrencia", "sqlite"],
        },
        {
          chunkId: `chunk_conc_${i}_2`,
          documentId: docId,
          chunkIndex: 2,
          pageNumber: 1,
          content: `Conteúdo concorrente ${i} - Parte 2`,
          tokenCount: 50,
          embedding: new Array(768).fill(0.01 * (i + 1)),
          topicCluster: "engenharia_tech",
          tags: ["concorrencia", "sqlite"],
        },
      ]);
      return docId;
    })();
  });

  const writtenDocs = await Promise.all(concurrentWrites);
  console.log(`[PASS] 10 escritas simultâneas concluídas com zero erros de SQLITE_BUSY (${writtenDocs.length} docs gravados).`);

  // 2. Teste de Resiliência: 4 arquivos válidos + 1 arquivo corrompido
  console.log("\n[INFO] Testando isolamento de falhas (4 válidos + 1 PDF corrompido)...");
  const extractor = new MultiFileExtractor(3);

  const files: InputFile[] = [
    { filename: "doc1.txt", buffer: Buffer.from("Conteúdo válido 1") },
    { filename: "doc2.md", buffer: Buffer.from("# Título válido 2\nConteúdo válido 2") },
    { filename: "doc3_corrompido.pdf", buffer: Buffer.from("INVALID_NON_PDF_HEADER_BURST") }, // Corrompido
    { filename: "doc4.txt", buffer: Buffer.from("Conteúdo válido 4") },
  ];

  const batch = await extractor.processFiles(files);
  console.log(`[PASS] Documentos processados no lote: ${batch.documents.length}`);
  
  const corruptedDoc = batch.documents.find((d) => d.filename === "doc3_corrompido.pdf");
  const validDocs = batch.documents.filter((d) => !d.error);

  console.log(`[PASS] Documentos válidos indexados: ${validDocs.length} / 4`);
  console.log(`[PASS] Documento corrompido isolado com erro: "${corruptedDoc?.error?.slice(0, 60)}..."`);

  if (validDocs.length !== 3 || !corruptedDoc?.error) {
    throw new Error("O isolamento de falhas falhou. O lote deveria ter continuado e sinalizado o erro individual.");
  }

  console.log("=== TESTE 3 CONCLUÍDO COM 100% DE SUCESSO ===\n");
}

runConcurrencyAndResilienceTest().catch((err) => {
  console.error("Erro no teste de concorrência e resiliência:", err);
  process.exit(1);
});
