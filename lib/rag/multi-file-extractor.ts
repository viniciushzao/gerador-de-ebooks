import path from "node:path";
import { DocumentFileRecord } from "../db/schema";
import { FileDeduplicator } from "./deduplicator";
import { ConcurrencyPool } from "./concurrency-pool";
import { extractCleanTextFromPdfBuffer } from "./pdf-extractor";
import { extractCleanTextFromDocx } from "./docx-extractor";
import { extractCleanTextFromPlainText } from "./text-extractor";
import { splitTextIntoChunks, SemanticChunk } from "./chunker";

export interface InputFile {
  filename: string;
  buffer: Buffer;
  mimeType?: string;
}

export interface ProcessedDocumentResult {
  fileHash: string;
  filename: string;
  fileType: "pdf" | "docx" | "txt" | "md";
  mimeType: string;
  fileSizeBytes: number;
  totalSections: number;
  isDeduplicated: boolean;
  chunks: SemanticChunk[];
  error?: string;
}

export interface MultiFileIngestionBatch {
  documents: ProcessedDocumentResult[];
  totalChunks: number;
  totalTokens: number;
  deduplicatedCount: number;
  newDocumentsCount: number;
}

export class MultiFileExtractor {
  private deduplicator: FileDeduplicator;
  private pool: ConcurrencyPool;

  constructor(concurrency: number = 3) {
    this.deduplicator = new FileDeduplicator();
    this.pool = new ConcurrencyPool(concurrency);
  }

  /**
   * Detecta o tipo de arquivo baseado na extensão e magic bytes
   */
  public detectFileType(filename: string, buffer: Buffer): "pdf" | "docx" | "txt" | "md" {
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".pdf" || (buffer.length > 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF")) {
      return "pdf";
    }
    if (ext === ".docx" || (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b)) {
      return "docx";
    }
    if (ext === ".md") {
      return "md";
    }
    return "txt";
  }

  /**
   * Processa em lote de 1 a 5 arquivos concorrentemente com isolamento de falhas e CAS deduplication.
   */
  public async processFiles(
    files: InputFile[],
    onProgress?: (progress: { file: string; status: string; percent: number }) => void
  ): Promise<MultiFileIngestionBatch> {
    if (!files || files.length === 0) {
      throw new Error("Nenhum arquivo fornecido para processamento.");
    }
    if (files.length > 5) {
      throw new Error("Limite máximo de 5 arquivos simultâneos excedido.");
    }

    const results: ProcessedDocumentResult[] = [];
    let deduplicatedCount = 0;
    let newDocumentsCount = 0;

    // Executa em paralelo através do pool com isolamento de erros
    const promises = files.map((file, idx) =>
      this.pool.run(async () => {
        const fileType = this.detectFileType(file.filename, file.buffer);
        const mimeType =
          file.mimeType ||
          (fileType === "pdf"
            ? "application/pdf"
            : fileType === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : fileType === "md"
            ? "text/markdown"
            : "text/plain");

        onProgress?.({
          file: file.filename,
          status: "Verificando deduplicação criptográfica...",
          percent: 10 + Math.round((idx / files.length) * 20),
        });

        // 1. Verificação CAS SHA-256
        const dedup = this.deduplicator.checkFile(file.buffer);
        if (dedup.isDeduplicated && dedup.existingDoc) {
          deduplicatedCount++;
          onProgress?.({
            file: file.filename,
            status: "Arquivo já indexado (Cache Hit CAS)!",
            percent: 100,
          });

          return {
            fileHash: dedup.fileHash,
            filename: file.filename,
            fileType,
            mimeType,
            fileSizeBytes: file.buffer.length,
            totalSections: dedup.existingDoc.total_sections_pages,
            isDeduplicated: true,
            chunks: [], // Chunks já estão persistidos no banco vetorial
          } as ProcessedDocumentResult;
        }

        // 2. Extração de Conteúdo
        newDocumentsCount++;
        onProgress?.({
          file: file.filename,
          status: `Extraindo texto do ${fileType.toUpperCase()}...`,
          percent: 40 + Math.round((idx / files.length) * 30),
        });

        let fullText = "";
        let totalSections = 1;

        try {
          if (fileType === "pdf") {
            const pdfData = await extractCleanTextFromPdfBuffer(file.buffer, file.filename);
            fullText = pdfData.cleanedFullText;
            totalSections = pdfData.totalPages;
          } else if (fileType === "docx") {
            const docxData = await extractCleanTextFromDocx(file.buffer);
            fullText = docxData.text;
            totalSections = docxData.sectionsCount;
          } else {
            const textData = extractCleanTextFromPlainText(file.buffer, fileType);
            fullText = textData.text;
            totalSections = textData.sectionsCount;
          }

          // 3. Fatiamento em Chunks Semânticos
          const chunks = splitTextIntoChunks(fullText, 800, 150);

          onProgress?.({
            file: file.filename,
            status: `Extração concluída (${chunks.length} chunks gerados)`,
            percent: 80,
          });

          return {
            fileHash: dedup.fileHash,
            filename: file.filename,
            fileType,
            mimeType,
            fileSizeBytes: file.buffer.length,
            totalSections,
            isDeduplicated: false,
            chunks,
          } as ProcessedDocumentResult;
        } catch (err: any) {
          return {
            fileHash: dedup.fileHash,
            filename: file.filename,
            fileType,
            mimeType,
            fileSizeBytes: file.buffer.length,
            totalSections: 0,
            isDeduplicated: false,
            chunks: [],
            error: err?.message || String(err),
          } as ProcessedDocumentResult;
        }
      })
    );

    const settled = await Promise.all(promises);
    results.push(...settled);

    let totalChunks = 0;
    let totalTokens = 0;
    for (const doc of results) {
      for (const chunk of doc.chunks) {
        totalChunks++;
        totalTokens += chunk.tokenCount;
      }
    }

    return {
      documents: results,
      totalChunks,
      totalTokens,
      deduplicatedCount,
      newDocumentsCount,
    };
  }
}
