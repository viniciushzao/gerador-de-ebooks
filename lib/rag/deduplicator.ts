import crypto from "node:crypto";
import { DocumentFileRecord } from "../db/schema";
import { UnifiedVectorStore } from "./unified-vector-store";

export interface DedupCheckResult {
  isDeduplicated: boolean;
  fileHash: string;
  existingDoc: DocumentFileRecord | null;
}

export class FileDeduplicator {
  private vectorStore: UnifiedVectorStore;

  constructor(vectorStore?: UnifiedVectorStore) {
    this.vectorStore = vectorStore || UnifiedVectorStore.getInstance();
  }

  /**
   * Calcula o hash SHA-256 criptográfico a partir de um Buffer binário.
   */
  public calculateFileHash(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Calcula o hash SHA-256 de um texto normalizado (sem espaços excessivos ou caracteres de controle).
   */
  public calculateContentHash(text: string): string {
    const normalized = text
      .trim()
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ");
    return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  /**
   * Verifica se o arquivo já existe no Unified Vector Store (CAS Lookup em < 5ms).
   */
  public checkFile(buffer: Buffer): DedupCheckResult {
    const fileHash = this.calculateFileHash(buffer);
    const existingDoc = this.vectorStore.getDocumentByHash(fileHash);

    if (existingDoc && existingDoc.status === "indexed" && existingDoc.total_chunks > 0) {
      return {
        isDeduplicated: true,
        fileHash,
        existingDoc,
      };
    }

    return {
      isDeduplicated: false,
      fileHash,
      existingDoc: null,
    };
  }
}
