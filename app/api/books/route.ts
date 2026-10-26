import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { listBooks, createBook } from "@/lib/db/client";
import { getSystemConfig } from "@/lib/config";
import { FileDeduplicator } from "@/lib/rag/deduplicator";

export async function GET() {
  try {
    const books = listBooks();
    return NextResponse.json({ success: true, data: books });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao listar livros" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const config = getSystemConfig();
    const formData = await req.formData();
    const titleInput = formData.get("title") as string | null;
    const typographyInput = (formData.get("typography") as string) || config.DESIGN_TYPOGRAPHY;

    if (!titleInput || !titleInput.trim()) {
      return NextResponse.json(
        { success: false, error: "O título do livro é um campo obrigatório de preenchimento." },
        { status: 400 }
      );
    }

    // Coleta arquivos enviados (campo 'files' ou 'file', múltiplos arquivos)
    const rawFiles = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;
    let files: File[] = rawFiles.filter((f) => f && f.size > 0);

    if (files.length === 0 && singleFile && singleFile.size > 0) {
      files = [singleFile];
    }

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo válido foi enviado. Selecione de 1 a 5 arquivos (PDF, DOCX, TXT, MD)." },
        { status: 400 }
      );
    }

    if (files.length > 5) {
      return NextResponse.json(
        { success: false, error: "Limite máximo de 5 arquivos simultâneos excedido." },
        { status: 400 }
      );
    }

    const uploadsDir = path.join(process.cwd(), "data", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const bookId = `book_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const deduplicator = new FileDeduplicator();
    const sourceDocuments: Array<{
      id: string;
      filename: string;
      file_path: string;
      file_hash: string;
      file_size: number;
      file_type: string;
      status: string;
      deduplicated: boolean;
      chunks_count: number;
    }> = [];

    const ALLOWED_EXTS = [".pdf", ".docx", ".txt", ".md"];
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB por arquivo

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name).toLowerCase();

      if (!ALLOWED_EXTS.includes(ext)) {
        return NextResponse.json(
          {
            success: false,
            error: `Arquivo "${file.name}" possui formato inválido. Apenas .pdf, .docx, .txt e .md são permitidos.`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `O arquivo "${file.name}" excede o limite máximo permitido de 50MB.` },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Validação de magic bytes para PDF
      if (ext === ".pdf") {
        if (buffer.length < 4 || buffer.subarray(0, 4).toString() !== "%PDF") {
          return NextResponse.json(
            { success: false, error: `O arquivo "${file.name}" é um PDF corrompido ou inválido.` },
            { status: 400 }
          );
        }
      }

      const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
      const dedupCheck = deduplicator.checkFile(buffer);

      const safeFilename = `${bookId}_f${i + 1}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(filePath, buffer);

      const fileType = ext.replace(".", "") as "pdf" | "docx" | "txt" | "md";

      sourceDocuments.push({
        id: fileHash,
        filename: file.name,
        file_path: filePath,
        file_hash: fileHash,
        file_size: file.size,
        file_type: fileType,
        status: dedupCheck.isDeduplicated ? "indexed" : "pending",
        deduplicated: dedupCheck.isDeduplicated,
        chunks_count: dedupCheck.existingDoc?.total_chunks || 0,
      });
    }

    const pageSizeInput =
      ((formData.get("pageSize") || formData.get("page_size")) as string) ||
      config.DEFAULT_PAGE_SIZE ||
      "A5";

    const derivedTitle = titleInput.trim();
    const primaryFile = sourceDocuments[0];
    const now = new Date().toISOString();

    const newBook = {
      id: bookId,
      title: derivedTitle,
      original_filename: primaryFile.filename,
      original_file_path: primaryFile.file_path,
      files_count: sourceDocuments.length,
      source_documents: sourceDocuments,
      topic_namespaces: [],
      author_name: config.AUTHOR_NAME,
      target_audience: config.TARGET_AUDIENCE,
      tone_of_voice: config.TONE_OF_VOICE,
      min_pages: config.MIN_PAGES,
      max_pages: config.MAX_PAGES,
      typography: typographyInput,
      spacing: config.DESIGN_SPACING,
      page_size: pageSizeInput,
      status: "pending" as const,
      current_step: `${sourceDocuments.length} arquivo(s) carregado(s). Pronto para iniciar a esteira.`,
      progress_percent: 0,
      total_tokens: 0,
      total_cost_usd: 0.0,
      pdf_path: null,
      epub_path: null,
      executive_summary: null,
      created_at: now,
      updated_at: now,
    };

    createBook(newBook);

    return NextResponse.json({ success: true, data: newBook });
  } catch (error: any) {
    console.error("Erro ao fazer upload do livro:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno ao processar upload." },
      { status: 500 }
    );
  }
}
