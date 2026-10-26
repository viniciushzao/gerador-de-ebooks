export interface TextExtractionResult {
  text: string;
  totalCharacters: number;
  sectionsCount: number;
}

export function extractCleanTextFromPlainText(
  buffer: Buffer,
  fileType: "txt" | "md" = "txt"
): TextExtractionResult {
  try {
    let rawText = buffer.toString("utf8");

    // Remove BOM se presente
    if (rawText.charCodeAt(0) === 0xfeff) {
      rawText = rawText.slice(1);
    }

    // Sanitização de caracteres perigosos ou invisíveis
    const cleanedText = rawText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Contagem de seções (H1/H2 no caso de Markdown, parágrafos no caso de TXT)
    let sectionsCount = 1;
    if (fileType === "md") {
      const headers = cleanedText.match(/^#{1,3}\s+.+$/gm);
      sectionsCount = headers ? headers.length : 1;
    } else {
      const paragraphs = cleanedText.split(/\n\n+/).filter((p) => p.trim().length > 0);
      sectionsCount = Math.max(1, paragraphs.length);
    }

    return {
      text: cleanedText,
      totalCharacters: cleanedText.length,
      sectionsCount,
    };
  } catch (error: any) {
    throw new Error(`Falha ao processar arquivo de texto: ${error?.message || error}`);
  }
}
