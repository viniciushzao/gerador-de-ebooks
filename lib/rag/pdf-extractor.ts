import fs from "fs";
import pdfParse from "pdf-parse";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdf {
  title: string;
  totalPages: number;
  pages: ExtractedPage[];
  cleanedFullText: string;
}

export async function extractCleanTextFromPdfBuffer(
  dataBuffer: Buffer,
  fileName: string = "documento.pdf"
): Promise<ExtractedPdf> {
  const data = await pdfParse(dataBuffer);

  const rawText = data.text || "";
  const totalPages = data.numpages || 1;

  // Split text by page separators or line sequences
  const rawPages = rawText.split(/\f|\n\s*---\s*Page \d+\s*---\n/gi);
  const pages: ExtractedPage[] = [];
  const cleanedPageTexts: string[] = [];

  for (let i = 0; i < rawPages.length; i++) {
    const rawPage = rawPages[i];
    const cleaned = cleanPageText(rawPage);
    if (cleaned.length > 20) {
      pages.push({
        pageNumber: i + 1,
        text: cleaned,
      });
      cleanedPageTexts.push(cleaned);
    }
  }

  // If page splitting didn't yield multiple pages, slice evenly
  if (pages.length === 0 && rawText.trim().length > 0) {
    const cleaned = cleanPageText(rawText);
    pages.push({
      pageNumber: 1,
      text: cleaned,
    });
    cleanedPageTexts.push(cleaned);
  }

  // Derive title from filename or metadata
  const infoTitle = data.info?.Title ? String(data.info.Title).trim() : "";
  const fallbackTitle = fileName.replace(/\.pdf$/i, "") || "Documento PDF";

  return {
    title: infoTitle || fallbackTitle,
    totalPages: pages.length || totalPages,
    pages,
    cleanedFullText: cleanedPageTexts.join("\n\n"),
  };
}

export async function extractCleanTextFromPdf(filePath: string): Promise<ExtractedPdf> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo PDF não encontrado: ${filePath}`);
  }

  const dataBuffer = fs.readFileSync(filePath);
  const fileName = filePath.split(/[\\/]/).pop() || "documento.pdf";
  return extractCleanTextFromPdfBuffer(dataBuffer, fileName);
}

/**
 * Cleans headers, footers, isolated page numbers, and formatting noise
 */
export function cleanPageText(text: string): string {
  if (!text) return "";

  let cleaned = text
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Remove isolated single-number lines (page numbers)
    .replace(/^\s*\d+\s*$/gm, "")
    // Remove typical header/footer repetitions (e.g., "Page 12 of 150", "Capítulo 1 | ...")
    .replace(/^.*(?:Página|Page)\s*\d+.*$/gim, "")
    // Remove excess whitespace and hyphenated line breaks
    .replace(/(\w+)-\n(\w+)/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}
