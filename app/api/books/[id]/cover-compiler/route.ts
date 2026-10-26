import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBook, getChapters, updateBook } from "@/lib/db/client";
import {
  generateAndSaveNativeKdpCover,
  processAndCompileUploadedCoverImage,
} from "@/lib/export/cover-compiler-engine";
import { calculateWraparoundCoverDimensions } from "@/lib/export/page-formats";

function isPathSafe(targetPath: string | null | undefined): boolean {
  if (!targetPath || typeof targetPath !== "string") return false;
  const resolved = path.resolve(targetPath);
  const dataDir = path.resolve(process.cwd(), "data");
  return (resolved === dataDir || resolved.startsWith(dataDir + path.sep)) && !resolved.includes("\0");
}

function buildCoverContentDisposition(
  title: string,
  extension: "pdf" | "png",
  isDownload: boolean
): string {
  const asciiFallback = (title || "capa_kdp")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);

  const fallbackFilename = `capa_kdp_oficial_${asciiFallback}.${extension}`;
  const encodedFilename = encodeURIComponent(`capa_kdp_oficial_${title || "livro"}.${extension}`);
  const dispositionType = isDownload ? "attachment" : "inline";

  return `${dispositionType}; filename="${fallbackFilename}"; filename*=UTF-8''${encodedFilename}`;
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

    const searchParams = req.nextUrl.searchParams;
    const format = (searchParams.get("format") || "").toLowerCase();
    const isDownload = searchParams.get("download") === "true";
    const requestedPages = searchParams.get("pages") || searchParams.get("page_count")
      ? parseInt((searchParams.get("pages") || searchParams.get("page_count"))!, 10)
      : null;
    const pageCountToUse = requestedPages && requestedPages > 0 ? requestedPages : (book.actual_pages || 162);

    const dimensions = calculateWraparoundCoverDimensions(book.page_size, pageCountToUse);

    // Servir arquivo PNG ou PDF se solicitado
    if (format === "png" || format === "pdf") {
      let targetPath = format === "pdf" ? book.cover_pdf_path : book.cover_image_path;

      if (!targetPath || !fs.existsSync(targetPath)) {
        // Tentar caminho padrão
        const fallbackPath = path.resolve(
          process.cwd(),
          "data",
          "books",
          id,
          format === "pdf" ? "cover_kdp.pdf" : "cover_300dpi.png"
        );
        if (fs.existsSync(fallbackPath)) {
          targetPath = fallbackPath;
        }
      }

      if (!targetPath || !isPathSafe(targetPath) || !fs.existsSync(targetPath)) {
        return NextResponse.json(
          {
            success: false,
            error: `Arquivo de capa ${format.toUpperCase()} ainda não foi gerado ou compilado.`,
          },
          { status: 404 }
        );
      }

      const fileBuffer = fs.readFileSync(targetPath);
      const contentType = format === "pdf" ? "application/pdf" : "image/png";

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileBuffer.length.toString(),
          "Content-Disposition": buildCoverContentDisposition(book.title, format, isDownload),
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Status da capa e especificações KDP
    const defaultPngPath = path.resolve(process.cwd(), "data", "books", id, "cover_300dpi.png");
    const defaultPdfPath = path.resolve(process.cwd(), "data", "books", id, "cover_kdp.pdf");

    const pngPath =
      book.cover_image_path && isPathSafe(book.cover_image_path)
        ? book.cover_image_path
        : defaultPngPath;
    const pdfPath =
      book.cover_pdf_path && isPathSafe(book.cover_pdf_path)
        ? book.cover_pdf_path
        : defaultPdfPath;

    const pngExists = fs.existsSync(pngPath);
    const pdfExists = fs.existsSync(pdfPath);

    return NextResponse.json({
      success: true,
      data: {
        has_cover: pngExists && pdfExists,
        png_exists: pngExists,
        pdf_exists: pdfExists,
        cover_image_url: pngExists ? `/api/books/${id}/cover-compiler?format=png` : null,
        cover_pdf_url: pdfExists ? `/api/books/${id}/cover-compiler?format=pdf&download=true` : null,
        dimensions,
        cover_visual_prompt: book.cover_visual_prompt,
        cover_negative_prompt: book.cover_negative_prompt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao consultar status da capa." },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const chapters = getChapters(id);
    const searchParams = req.nextUrl.searchParams;
    const contentType = req.headers.get("content-type") || "";

    // 1. Processamento de Upload via multipart/form-data
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const requestedPages = formData.get("pages") || formData.get("page_count")
        ? parseInt((formData.get("pages") || formData.get("page_count")) as string, 10)
        : (searchParams.get("pages") ? parseInt(searchParams.get("pages")!, 10) : null);
      const pageCountToUse = requestedPages && requestedPages > 0 ? requestedPages : (book.actual_pages || 162);
      const spec = calculateWraparoundCoverDimensions(book.page_size, pageCountToUse);

      if (!file) {
        return NextResponse.json(
          { success: false, error: "Nenhum arquivo de imagem foi enviado no formulário." },
          { status: 400 }
        );
      }

      const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB
      const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

      if (file.size > MAX_UPLOAD_SIZE) {
        return NextResponse.json(
          { success: false, error: "O arquivo de imagem excede o limite máximo permitido de 20 MB." },
          { status: 400 }
        );
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        return NextResponse.json(
          {
            success: false,
            error: `Formato de arquivo inválido (${file.type}). Envie apenas imagens PNG, JPEG ou WebP.`,
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuffer);

      const result = await processAndCompileUploadedCoverImage(imageBuffer, spec, book.id);

      if (!result.success || !result.pngPath || !result.pdfPath) {
        return NextResponse.json(
          { success: false, error: result.error || "Falha ao processar e compilar imagem de capa." },
          { status: 500 }
        );
      }

      updateBook(id, {
        actual_pages: pageCountToUse,
        cover_image_path: result.pngPath,
        cover_pdf_path: result.pdfPath,
      });

      return NextResponse.json({
        success: true,
        message: `Imagem da IA compilada com sucesso em 300 DPI oficial KDP (${spec.totalWidthInches.toFixed(3)}" × ${spec.totalHeightInches.toFixed(3)}")!`,
        data: {
          png_url: `/api/books/${id}/cover-compiler?format=png`,
          pdf_url: `/api/books/${id}/cover-compiler?format=pdf&download=true`,
          dimensions: result.dimensions,
        },
      });
    }

    // 2. Processamento via JSON
    const body = await req.json().catch(() => ({}));
    const action = body.action || "generate_native";
    const requestedPages = body.pages || body.page_count
      ? parseInt(String(body.pages || body.page_count), 10)
      : (searchParams.get("pages") ? parseInt(searchParams.get("pages")!, 10) : null);
    const pageCountToUse = requestedPages && requestedPages > 0 ? requestedPages : (book.actual_pages || 162);
    const spec = calculateWraparoundCoverDimensions(book.page_size, pageCountToUse);

    if (action === "process_uploaded_image") {
      const imageBase64 = body.imageBase64 as string | undefined;
      if (!imageBase64) {
        return NextResponse.json(
          { success: false, error: "Propriedade imageBase64 não fornecida." },
          { status: 400 }
        );
      }

      // Limite de tamanho para Base64: ~28MB (equivalente a ~20MB em binário)
      const MAX_BASE64_LENGTH = 28 * 1024 * 1024;
      if (imageBase64.length > MAX_BASE64_LENGTH) {
        return NextResponse.json(
          { success: false, error: "A imagem em Base64 excede o limite máximo permitido de 20 MB." },
          { status: 400 }
        );
      }

      // Remover prefixo data:image/png;base64, se existir
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      const imageBuffer = Buffer.from(cleanBase64, "base64");

      const result = await processAndCompileUploadedCoverImage(imageBuffer, spec, book.id);

      if (!result.success || !result.pngPath || !result.pdfPath) {
        return NextResponse.json(
          { success: false, error: result.error || "Falha ao processar e compilar imagem de capa." },
          { status: 500 }
        );
      }

      updateBook(id, {
        actual_pages: pageCountToUse,
        cover_image_path: result.pngPath,
        cover_pdf_path: result.pdfPath,
      });

      return NextResponse.json({
        success: true,
        message: `Imagem da IA compilada com sucesso em 300 DPI oficial KDP (${spec.totalWidthInches.toFixed(3)}" × ${spec.totalHeightInches.toFixed(3)}")!`,
        data: {
          png_url: `/api/books/${id}/cover-compiler?format=png`,
          pdf_url: `/api/books/${id}/cover-compiler?format=pdf&download=true`,
          dimensions: result.dimensions,
        },
      });
    }

    // 3. Ação Padrão: Geração Nativa 1-Click Direta em 300 DPI
    const result = await generateAndSaveNativeKdpCover(book, chapters, pageCountToUse);

    if (!result.success || !result.pngPath || !result.pdfPath) {
      return NextResponse.json(
        { success: false, error: result.error || "Falha ao compilar capa nativa KDP." },
        { status: 500 }
      );
    }

    updateBook(id, {
      actual_pages: pageCountToUse,
      cover_image_path: result.pngPath,
      cover_pdf_path: result.pdfPath,
    });

    return NextResponse.json({
      success: true,
      message: "Capa editorial KDP gerada e compilada com sucesso a 300 DPI!",
      data: {
        png_url: `/api/books/${id}/cover-compiler?format=png`,
        pdf_url: `/api/books/${id}/cover-compiler?format=pdf&download=true`,
        dimensions: result.dimensions,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao compilar capa oficial KDP.",
      },
      { status: 500 }
    );
  }
}
