export interface BookRecord {
  id: string;
  title: string;
  original_filename: string;
  original_file_path: string;
  author_name: string;
  target_audience: string;
  tone_of_voice: string;
  min_pages: number;
  max_pages: number;
  typography: string;
  spacing: number;
  page_size?: string;
  files_count?: number;
  source_documents?: Array<{
    id: string;
    filename: string;
    file_path: string;
    file_hash: string;
    file_size: number;
    file_type: string;
    status: string;
    deduplicated?: boolean;
    chunks_count?: number;
  }>;
  topic_namespaces?: string[];
  status:
    | "pending"
    | "ingesting"
    | "chunked"
    | "vectorized"
    | "outlining"
    | "writing"
    | "formatting"
    | "completed"
    | "failed";
  current_step: string;
  progress_percent: number;
  total_tokens: number;
  total_cost_usd: number;
  pdf_path: string | null;
  epub_path?: string | null;
  actual_pages?: number | null;
  executive_summary: string | null;
  cover_prompt?: string | null;
  cover_visual_prompt?: string | null;
  cover_negative_prompt?: string | null;
  cover_image_path?: string | null;
  cover_pdf_path?: string | null;
  suggested_categories?: string | null;
  marketing_description?: string | null;
  seo_keywords?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentFileRecord {
  id: string; // SHA-256 Hash
  file_name: string;
  file_type: "pdf" | "docx" | "txt" | "md";
  mime_type: string;
  file_size_bytes: number;
  total_sections_pages: number;
  total_chunks: number;
  total_tokens: number;
  status: "pending" | "processing" | "indexed" | "failed";
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookDocumentRelation {
  id: string;
  book_id: string;
  document_id: string; // SHA-256 Hash
  display_order: number;
  role_badge: "primary" | "reference" | "framework" | "financial" | "case_study";
  created_at: string;
}

export interface TopicClusterRecord {
  id: string;
  namespace: string;
  topic_name: string;
  keywords: string[];
  chunk_count: number;
  created_at: string;
}

export interface ChapterRecord {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string;
  synopsis: string;
  prompt: string;
  target_words: number;
  actual_words: number;
  status: "pending" | "running" | "completed" | "failed" | "retrying";
  sections?: string[];
  content_markdown: string;
  trace_id: string;
  parent_task_id: string | null;
  tokens_used: number;
  cost_usd: number;
  latency_ms: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRecord {
  id: string;
  trace_id: string;
  parent_task_id: string | null;
  book_id: string;
  chapter_id: string | null;
  agent_role: "CEO" | "PRESENTATION_WRITER" | "WRITER" | "DESIGNER" | "RAG_PROCESSOR" | "IMAGE_REVIEWER" | "BOOK_REVIEWER";
  status: "pending" | "running" | "completed" | "failed";
  input_payload: string;
  output_payload: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
  skill_used: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface AuditLogRecord {
  id: string;
  trace_id: string;
  parent_task_id: string | null;
  book_id: string;
  chapter_id: string | null;
  agent_role: string;
  level: "info" | "warning" | "error" | "skill_call";
  message: string;
  metadata: string; // JSON
  tokens: number;
  cost_usd: number;
  latency_ms: number;
  skill_badge: string | null; // e.g. "ai-rag", "book-designer", "pdf-compiler"
  timestamp: string;
}

export interface RagChunkRecord {
  id: string;
  book_id: string;
  file_id?: string;
  file_hash?: string;
  chunk_index: number;
  page_number: number;
  content: string;
  token_count: number;
  embedding: string; // JSON float array or BLOB reference
  metadata: string; // JSON
  topic_cluster?: string;
  tags?: string[];
}
