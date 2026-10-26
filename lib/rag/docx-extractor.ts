import mammoth from "mammoth";

export interface DocxExtractionResult {
  text: string;
  totalCharacters: number;
  sectionsCount: number;
}

export async function extractCleanTextFromDocx(buffer: Buffer): Promise<DocxExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value || "";

    // Sanitização e normalização
    const cleanedText = rawText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\u202A-\u202E\u2066-\u2069]/g, "") // remove caracteres de controle invisíveis e Bidi
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const paragraphs = cleanedText.split(/\n\n+/).filter((p) => p.trim().length > 0);

    return {
      text: cleanedText,
      totalCharacters: cleanedText.length,
      sectionsCount: Math.max(1, paragraphs.length),
    };
  } catch (error: any) {
    throw new Error(`Falha ao extrair texto de arquivo DOCX: ${error?.message || error}`);
  }
}
