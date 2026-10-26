import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DocumentFileRecord, TopicClusterRecord, RagChunkRecord } from "../db/schema";

export interface StoredVectorChunk {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  tokenCount: number;
  embedding: Float32Array;
  topicCluster: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface HybridSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  pageNumber: number;
  topicCluster: string;
  tags: string[];
  score: number;
  metadata: Record<string, any>;
}

export class UnifiedVectorStore {
  private static instance: UnifiedVectorStore | null = null;
  private db: DatabaseSync;
  private dbPath: string;

  private constructor() {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, "unified_vector_store.sqlite");
    this.db = new DatabaseSync(this.dbPath);
    this.initDatabase();
  }

  public static getInstance(): UnifiedVectorStore {
    if (!UnifiedVectorStore.instance) {
      UnifiedVectorStore.instance = new UnifiedVectorStore();
    }
    return UnifiedVectorStore.instance;
  }

  private initDatabase(): void {
    // Configurações de Concorrência e Alta Performance (WAL)
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");

    // 1. Tabela de Documentos (CAS Hashes)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        total_sections_pages INTEGER NOT NULL DEFAULT 1,
        total_chunks INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'indexed',
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    `);

    // 2. Associação N:N entre Livros e Documentos
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS book_documents (
        id TEXT PRIMARY KEY,
        book_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        display_order INTEGER NOT NULL DEFAULT 1,
        role_badge TEXT NOT NULL DEFAULT 'reference',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(book_id, document_id),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_book_docs_book ON book_documents(book_id);
      CREATE INDEX IF NOT EXISTS idx_book_docs_doc ON book_documents(document_id);
    `);

    // 3. Tabela de Chunks e Embeddings em BLOB binário (Float32Array de 3.072 bytes)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vector_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        page_number INTEGER NOT NULL DEFAULT 1,
        content TEXT NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0,
        embedding_blob BLOB NOT NULL,
        topic_cluster TEXT NOT NULL DEFAULT 'general',
        tags_json TEXT NOT NULL DEFAULT '[]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_vector_chunks_doc ON vector_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_vector_chunks_topic ON vector_chunks(topic_cluster);
    `);

    // 4. Clusters de Tópicos
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS topic_clusters (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL UNIQUE,
        topic_name TEXT NOT NULL,
        keywords_json TEXT NOT NULL DEFAULT '[]',
        chunk_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  // --- MÉTODOS DE DOCUMENTO & CAS DEDUPLICATION ---

  public getDocumentByHash(fileHash: string): DocumentFileRecord | null {
    const stmt = this.db.prepare("SELECT * FROM documents WHERE id = ?");
    const row = stmt.get(fileHash) as any;
    if (!row) return null;

    return {
      id: row.id,
      file_name: row.file_name,
      file_type: row.file_type,
      mime_type: row.mime_type,
      file_size_bytes: Number(row.file_size_bytes),
      total_sections_pages: Number(row.total_sections_pages),
      total_chunks: Number(row.total_chunks),
      total_tokens: Number(row.total_tokens),
      status: row.status,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  public saveDocument(doc: DocumentFileRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO documents (
        id, file_name, file_type, mime_type, file_size_bytes,
        total_sections_pages, total_chunks, total_tokens, status, error_message, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        file_name = excluded.file_name,
        total_chunks = excluded.total_chunks,
        total_tokens = excluded.total_tokens,
        status = excluded.status,
        error_message = excluded.error_message,
        updated_at = datetime('now');
    `);
    stmt.run(
      doc.id,
      doc.file_name,
      doc.file_type,
      doc.mime_type,
      doc.file_size_bytes,
      doc.total_sections_pages,
      doc.total_chunks,
      doc.total_tokens,
      doc.status,
      doc.error_message || null
    );
  }

  public attachDocumentToBook(
    bookId: string,
    documentId: string,
    displayOrder: number = 1,
    roleBadge: "primary" | "reference" | "framework" | "financial" | "case_study" = "reference"
  ): void {
    const relId = `rel_${bookId}_${documentId}`;
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO book_documents (id, book_id, document_id, display_order, role_badge)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(relId, bookId, documentId, displayOrder, roleBadge);
  }

  public getBookDocuments(bookId: string): DocumentFileRecord[] {
    const stmt = this.db.prepare(`
      SELECT d.* FROM documents d
      JOIN book_documents bd ON d.id = bd.document_id
      WHERE bd.book_id = ?
      ORDER BY bd.display_order ASC
    `);
    const rows = stmt.all(bookId) as any[];
    return rows.map((row) => ({
      id: row.id,
      file_name: row.file_name,
      file_type: row.file_type,
      mime_type: row.mime_type,
      file_size_bytes: Number(row.file_size_bytes),
      total_sections_pages: Number(row.total_sections_pages),
      total_chunks: Number(row.total_chunks),
      total_tokens: Number(row.total_tokens),
      status: row.status,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  // --- MÉTODOS DE CHUNKS & VETORES BINÁRIOS ---

  public insertChunksBatch(
    chunks: Array<{
      chunkId: string;
      documentId: string;
      chunkIndex: number;
      pageNumber: number;
      content: string;
      tokenCount: number;
      embedding: number[];
      topicCluster?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    }>
  ): void {
    if (!chunks || chunks.length === 0) return;

    this.db.exec("BEGIN TRANSACTION;");
    try {
      const stmt = this.db.prepare(`
        INSERT INTO vector_chunks (
          id, document_id, chunk_index, page_number, content,
          token_count, embedding_blob, topic_cluster, tags_json, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          embedding_blob = excluded.embedding_blob,
          topic_cluster = excluded.topic_cluster,
          tags_json = excluded.tags_json,
          metadata_json = excluded.metadata_json;
      `);

      for (const chunk of chunks) {
        // Converte o array de floats para Buffer Float32Array (768 * 4 = 3072 bytes)
        const floatArray = new Float32Array(chunk.embedding);
        const blobBuffer = Buffer.from(floatArray.buffer);

        stmt.run(
          chunk.chunkId,
          chunk.documentId,
          chunk.chunkIndex,
          chunk.pageNumber,
          chunk.content,
          chunk.tokenCount,
          blobBuffer,
          chunk.topicCluster || "general",
          JSON.stringify(chunk.tags || []),
          JSON.stringify(chunk.metadata || {})
        );
      }
      this.db.exec("COMMIT;");
    } catch (err) {
      this.db.exec("ROLLBACK;");
      throw err;
    }
  }

  public getStoredChunksByDocument(documentId: string): StoredVectorChunk[] {
    const stmt = this.db.prepare(`
      SELECT * FROM vector_chunks
      WHERE document_id = ?
      ORDER BY chunk_index ASC
    `);
    const rows = stmt.all(documentId) as any[];

    return rows.map((row) => {
      const buffer = Buffer.isBuffer(row.embedding_blob)
        ? row.embedding_blob
        : Buffer.from(row.embedding_blob);
      const floatArray = new Float32Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
      );

      let tags: string[] = [];
      try {
        tags = JSON.parse(row.tags_json);
      } catch {}

      let metadata: Record<string, any> = {};
      try {
        metadata = JSON.parse(row.metadata_json);
      } catch {}

      return {
        chunkId: row.id,
        documentId: row.document_id,
        chunkIndex: Number(row.chunk_index),
        pageNumber: Number(row.page_number),
        content: row.content,
        tokenCount: Number(row.token_count),
        embedding: floatArray,
        topicCluster: row.topic_cluster,
        tags,
        metadata,
      };
    });
  }

  public getStoredChunksByBook(
    bookId: string,
    topicClusterFilter?: string
  ): StoredVectorChunk[] {
    let query = `
      SELECT vc.* FROM vector_chunks vc
      JOIN book_documents bd ON vc.document_id = bd.document_id
      WHERE bd.book_id = ?
    `;
    const params: any[] = [bookId];

    if (topicClusterFilter && topicClusterFilter !== "all") {
      query += " AND vc.topic_cluster = ?";
      params.push(topicClusterFilter);
    }

    query += " ORDER BY bd.display_order ASC, vc.chunk_index ASC";

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => {
      const buffer = Buffer.isBuffer(row.embedding_blob)
        ? row.embedding_blob
        : Buffer.from(row.embedding_blob);
      const floatArray = new Float32Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
      );

      let tags: string[] = [];
      try {
        tags = JSON.parse(row.tags_json);
      } catch {}

      let metadata: Record<string, any> = {};
      try {
        metadata = JSON.parse(row.metadata_json);
      } catch {}

      return {
        chunkId: row.id,
        documentId: row.document_id,
        chunkIndex: Number(row.chunk_index),
        pageNumber: Number(row.page_number),
        content: row.content,
        tokenCount: Number(row.token_count),
        embedding: floatArray,
        topicCluster: row.topic_cluster,
        tags,
        metadata,
      };
    });
  }

  // --- BUSCA VETORIAL & HÍBRIDA RRF (RECIPROCAL RANK FUSION) ---

  public searchHybrid(params: {
    bookId?: string;
    documentIds?: string[];
    queryVector: number[];
    queryText?: string;
    topicCluster?: string;
    topK?: number;
    minScore?: number;
  }): HybridSearchResult[] {
    const {
      bookId,
      documentIds,
      queryVector,
      queryText = "",
      topicCluster,
      topK = 5,
      minScore = 0.2,
    } = params;

    // 1. Recupera chunks escopados
    let chunks: StoredVectorChunk[] = [];
    if (bookId) {
      chunks = this.getStoredChunksByBook(bookId, topicCluster);
    } else if (documentIds && documentIds.length > 0) {
      for (const docId of documentIds) {
        chunks.push(...this.getStoredChunksByDocument(docId));
      }
    } else {
      // Busca global em todos os chunks
      const stmt = this.db.prepare("SELECT * FROM vector_chunks LIMIT 2000");
      const rows = stmt.all() as any[];
      chunks = rows.map((row) => {
        const buffer = Buffer.isBuffer(row.embedding_blob)
          ? row.embedding_blob
          : Buffer.from(row.embedding_blob);
        return {
          chunkId: row.id,
          documentId: row.document_id,
          chunkIndex: Number(row.chunk_index),
          pageNumber: Number(row.page_number),
          content: row.content,
          tokenCount: Number(row.token_count),
          embedding: new Float32Array(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
          ),
          topicCluster: row.topic_cluster,
          tags: JSON.parse(row.tags_json || "[]"),
          metadata: JSON.parse(row.metadata_json || "{}"),
        };
      });
    }

    if (chunks.length === 0) return [];

    const queryFloat = new Float32Array(queryVector);
    const queryNorm = this.vectorNorm(queryFloat);

    // 2. Pontuação por Similaridade de Cosseno (Dense)
    const scoredChunks = chunks.map((chunk) => {
      const dotProduct = this.dotProduct(queryFloat, chunk.embedding);
      const chunkNorm = this.vectorNorm(chunk.embedding);
      const cosineSim =
        queryNorm === 0 || chunkNorm === 0
          ? 0
          : dotProduct / (queryNorm * chunkNorm);

      // Pontuação Léxica Simples (Keyword Boost)
      let lexicalBonus = 0;
      if (queryText.trim()) {
        const terms = queryText
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 3);
        const contentLower = chunk.content.toLowerCase();
        let matches = 0;
        for (const term of terms) {
          if (contentLower.includes(term)) matches++;
        }
        if (terms.length > 0) {
          lexicalBonus = (matches / terms.length) * 0.15;
        }
      }

      // Topic Cluster Affinity Bonus
      let topicBonus = 0;
      if (topicCluster && chunk.topicCluster === topicCluster) {
        topicBonus = 0.1;
      }

      const totalScore = Math.min(1.0, cosineSim + lexicalBonus + topicBonus);

      return {
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        topicCluster: chunk.topicCluster,
        tags: chunk.tags,
        score: totalScore,
        metadata: chunk.metadata,
      };
    });

    return scoredChunks
      .filter((item) => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // --- CLUSTERS DE TÓPICOS ---

  public saveTopicCluster(cluster: TopicClusterRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO topic_clusters (id, namespace, topic_name, keywords_json, chunk_count, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(namespace) DO UPDATE SET
        topic_name = excluded.topic_name,
        keywords_json = excluded.keywords_json,
        chunk_count = excluded.chunk_count;
    `);
    stmt.run(
      cluster.id,
      cluster.namespace,
      cluster.topic_name,
      JSON.stringify(cluster.keywords || []),
      cluster.chunk_count
    );
  }

  public getTopicClusters(): TopicClusterRecord[] {
    const stmt = this.db.prepare("SELECT * FROM topic_clusters ORDER BY chunk_count DESC");
    const rows = stmt.all() as any[];
    return rows.map((row) => ({
      id: row.id,
      namespace: row.namespace,
      topic_name: row.topic_name,
      keywords: JSON.parse(row.keywords_json || "[]"),
      chunk_count: Number(row.chunk_count),
      created_at: row.created_at,
    }));
  }

  // --- FUNÇÕES MATEMÁTICAS SIMD-READY ---

  private dotProduct(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  private vectorNorm(v: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
      sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
  }
}
