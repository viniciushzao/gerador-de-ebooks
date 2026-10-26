import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBook, getChapters } from "@/lib/db/client";
import { compileBookToEpubDeduplicated } from "@/lib/export/epub-compiler";

function isSafeOutputPath(targetPath: string, baseDir: string): boolean {
  const normalizedTarget = path.normalize(path.resolve(targetPath));
  const normalizedBase = path.normalize(path.resolve(baseDir));

  // No Windows, normalizar para minúsculas para prevenir divergência de letra da unidade (c: vs C:)
  const targetLower = normalizedTarget.toLowerCase();
  const baseLower = normalizedBase.toLowerCase();

  const safePrefix = baseLower.endsWith(path.sep.toLowerCase())
    ? baseLower
    : baseLower + path.sep.toLowerCase();

  return targetLower.startsWith(safePrefix) && fs.existsSync(normalizedTarget);
}

function buildContentDisposition(title: string, extension: "pdf" | "epub"): string {
  const asciiFallback = (title || "livro")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);

  const fallbackFilename = `${asciiFallback || "livro"}_conclusivo.${extension}`;
  const encodedFilename = encodeURIComponent(`${title || "livro"}_conclusivo.${extension}`);

  // RFC 5987 / RFC 6266 para suporte completo a caracteres internacionais e acentos sem crash
  return `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const book = getBook(id);

    if (!book) {
      return NextResponse.json(
        { success: false, error: "Livro não encontrado." },
        { status: 404 }
      );
    }

    const outputDir = path.resolve(process.cwd(), "data", "output");
    const format = (req.nextUrl.searchParams.get("format") || "pdf").toLowerCase();

    // ================= FLUXO EPUB =================
    if (format === "epub") {
      let targetEpubPath = book.epub_path;

      // Fallback On-Demand: Se o EPUB ainda não foi gerado ou arquivo foi limpo do disco
      const needsOnDemandGeneration =
        !targetEpubPath ||
        !fs.existsSync(path.resolve(targetEpubPath));

      if (needsOnDemandGeneration) {
        if (book.status !== "completed" && book.status !== "formatting") {
          return NextResponse.json(
            { success: false, error: "Livro ainda em processamento. Aguarde a conclusão para baixar o EPUB." },
            { status: 400 }
          );
        }

        const chapters = getChapters(id);
        const traceId = `ondemand_epub_${id}_${Date.now()}`;
        targetEpubPath = await compileBookToEpubDeduplicated(
          id,
          traceId,
          "download_ondemand",
          book,
          chapters
        );
      }

      if (!targetEpubPath || !isSafeOutputPath(targetEpubPath, outputDir)) {
        return NextResponse.json(
          { success: false, error: "Arquivo EPUB não encontrado ou acesso restrito." },
          { status: 403 }
        );
      }

      const fileBuffer = fs.readFileSync(path.resolve(targetEpubPath));
      const contentDisposition = buildContentDisposition(book.title, "epub");

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Disposition": contentDisposition,
          "Content-Length": fileBuffer.length.toString(),
        },
      });
    }

    // ================= FLUXO PDF (PADRÃO / 100% RETROCOMPATÍVEL) =================
    if (!book.pdf_path) {
      return NextResponse.json(
        { success: false, error: "Arquivo PDF ainda não disponível para download." },
        { status: 404 }
      );
    }

    if (!isSafeOutputPath(book.pdf_path, outputDir)) {
      return NextResponse.json(
        { success: false, error: "Arquivo PDF não encontrado ou acesso restrito." },
        { status: 403 }
      );
    }

    const resolvedPdfPath = path.resolve(book.pdf_path);
    const fileBuffer = fs.readFileSync(resolvedPdfPath);
    const contentDisposition = buildContentDisposition(book.title, "pdf");

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao processar download do livro." },
      { status: 500 }
    );
  }
}
