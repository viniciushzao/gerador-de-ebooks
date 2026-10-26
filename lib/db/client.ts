import fs from "fs";
import path from "path";
import {
  BookRecord,
  ChapterRecord,
  TaskRecord,
  AuditLogRecord,
  RagChunkRecord,
} from "./schema";

export * from "./schema";

interface DatabaseState {
  books: Record<string, BookRecord>;
  chapters: Record<string, ChapterRecord>;
  tasks: Record<string, TaskRecord>;
  auditLogs: Record<string, AuditLogRecord>;
  ragChunks: Record<string, RagChunkRecord>;
}

let dbState: DatabaseState | null = null;
let dataDirInitialized = false;

function ensureDataDirectories() {
  if (dataDirInitialized) return;
  const dataDir = path.join(process.cwd(), "data");
  const uploadsDir = path.join(dataDir, "uploads");
  const vectorDir = path.join(dataDir, "vectorstore");
  const outputDir = path.join(dataDir, "output");

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(vectorDir)) fs.mkdirSync(vectorDir, { recursive: true });
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  dataDirInitialized = true;
}

function getDbFilePath(): string {
  ensureDataDirectories();
  return path.join(process.cwd(), "data", "ebook_generator_db.json");
}

let lastMtimeMs = 0;

function loadState(): DatabaseState {
  ensureDataDirectories();
  const filePath = getDbFilePath();

  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      // Se já temos dbState em memória e o arquivo no disco NÃO foi modificado, utiliza cache
      if (dbState && stats.mtimeMs <= lastMtimeMs) {
        return dbState;
      }

      const raw = fs.readFileSync(filePath, "utf-8");
      dbState = JSON.parse(raw);
      lastMtimeMs = stats.mtimeMs;
      return dbState!;
    } catch (e) {
      console.warn("Erro ao carregar banco de dados JSON do disco:", e);
      if (dbState) return dbState;
    }
  }

  if (dbState) return dbState;

  dbState = {
    books: {},
    chapters: {},
    tasks: {},
    auditLogs: {},
    ragChunks: {},
  };
  persistState();
  return dbState;
}

let isWriting = false;
let writeQueued = false;

function persistState(): void {
  if (!dbState) return;
  
  if (isWriting) {
    writeQueued = true;
    return;
  }

  isWriting = true;
  const filePath = getDbFilePath();
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;

  try {
    const data = JSON.stringify(dbState);
    fs.writeFileSync(tempPath, data, "utf-8");
    try {
      fs.renameSync(tempPath, filePath);
    } catch {
      // Fallback para cópia direta caso rename falhe no Windows
      fs.copyFileSync(tempPath, filePath);
      fs.unlinkSync(tempPath);
    }
    try {
      lastMtimeMs = fs.statSync(filePath).mtimeMs;
    } catch {}
  } catch (err) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(dbState), "utf-8");
      lastMtimeMs = fs.statSync(filePath).mtimeMs;
    } catch (fallbackErr) {
      console.error("Erro crítico ao persistir banco de dados:", fallbackErr);
    }
  } finally {
    isWriting = false;
    if (writeQueued) {
      writeQueued = false;
      persistState();
    }
  }
}

// ---------------- BOOKS ----------------

export function createBook(book: BookRecord): void {
  const state = loadState();
  state.books[book.id] = { ...book };
  persistState();
}

export function getBook(id: string): BookRecord | null {
  const state = loadState();
  return state.books[id] ? { ...state.books[id] } : null;
}

export function listBooks(): BookRecord[] {
  const state = loadState();
  return Object.values(state.books).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function updateBook(id: string, updates: Partial<BookRecord>): void {
  const state = loadState();
  if (!state.books[id]) return;
  state.books[id] = {
    ...state.books[id],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  persistState();
}

// ---------------- CHAPTERS ----------------

export function createChapter(chapter: ChapterRecord): void {
  const state = loadState();
  state.chapters[chapter.id] = { ...chapter };
  persistState();
}

export function getChapters(bookId: string): ChapterRecord[] {
  const state = loadState();
  return Object.values(state.chapters)
    .filter((c) => c.book_id === bookId)
    .sort((a, b) => a.chapter_number - b.chapter_number);
}

export function getChapter(id: string): ChapterRecord | null {
  const state = loadState();
  return state.chapters[id] ? { ...state.chapters[id] } : null;
}

export function updateChapter(id: string, updates: Partial<ChapterRecord>): void {
  const state = loadState();
  if (!state.chapters[id]) return;
  state.chapters[id] = {
    ...state.chapters[id],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  persistState();
}

// ---------------- TASKS ----------------

export function createTask(task: TaskRecord): void {
  const state = loadState();
  state.tasks[task.id] = { ...task };
  persistState();
}

export function updateTask(id: string, updates: Partial<TaskRecord>): void {
  const state = loadState();
  if (!state.tasks[id]) return;
  state.tasks[id] = {
    ...state.tasks[id],
    ...updates,
  };
  persistState();
}

export function getTasks(bookId: string): TaskRecord[] {
  const state = loadState();
  return Object.values(state.tasks)
    .filter((t) => t.book_id === bookId)
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
}

// ---------------- AUDIT LOGS ----------------

export type AuditLogListener = (log: AuditLogRecord) => void;
const auditLogListeners = new Set<AuditLogListener>();

export function onAuditLog(listener: AuditLogListener): () => void {
  auditLogListeners.add(listener);
  return () => {
    auditLogListeners.delete(listener);
  };
}

export function addAuditLog(log: AuditLogRecord): void {
  const state = loadState();
  state.auditLogs[log.id] = { ...log };
  persistState();

  // Notificar imediatamente todos os listeners ativos (zero latência)
  for (const listener of auditLogListeners) {
    try {
      listener({ ...log });
    } catch (e) {
      console.warn("Erro no listener de audit log:", e);
    }
  }
}

export function getAuditLogs(bookId: string): AuditLogRecord[] {
  const state = loadState();
  return Object.values(state.auditLogs)
    .filter((l) => l.book_id === bookId)
    .sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

// ---------------- RAG CHUNKS ----------------

export function insertChunks(chunks: RagChunkRecord[]): void {
  const state = loadState();
  for (const chunk of chunks) {
    // Conforme .agent/rules/pipeline_state_invariants.md, nunca salvar vetores de 768 floats no JSON
    const { embedding, ...lightweightChunk } = chunk;
    state.ragChunks[chunk.id] = { ...lightweightChunk, embedding: "[]" };
  }
  persistState();
}

export function getChunks(bookId: string): RagChunkRecord[] {
  const state = loadState();
  return Object.values(state.ragChunks)
    .filter((c) => c.book_id === bookId)
    .sort((a, b) => a.chunk_index - b.chunk_index);
}

export function clearBookData(bookId: string): void {
  const state = loadState();
  for (const id in state.ragChunks) {
    if (state.ragChunks[id].book_id === bookId) delete state.ragChunks[id];
  }
  for (const id in state.auditLogs) {
    if (state.auditLogs[id].book_id === bookId) delete state.auditLogs[id];
  }
  for (const id in state.tasks) {
    if (state.tasks[id].book_id === bookId) delete state.tasks[id];
  }
  for (const id in state.chapters) {
    if (state.chapters[id].book_id === bookId) delete state.chapters[id];
  }
  persistState();
}
