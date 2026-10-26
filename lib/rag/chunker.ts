import { ExtractedPage } from "./pdf-extractor";

export interface SemanticChunk {
  chunkIndex: number;
  pageNumber: number;
  content: string;
  tokenCount: number;
}

const CHUNK_SIZE_TOKENS = 800; // ~3200 characters
const CHUNK_OVERLAP_TOKENS = 150; // ~600 characters
const APPROX_CHARS_PER_TOKEN = 4;

const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * APPROX_CHARS_PER_TOKEN;
const CHUNK_OVERLAP_CHARS = CHUNK_OVERLAP_TOKENS * APPROX_CHARS_PER_TOKEN;

/**
 * Splits extracted pages into overlapping semantic chunks
 * respecting paragraph and sentence boundaries.
 */
export function chunkDocument(pages: ExtractedPage[]): SemanticChunk[] {
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const text = page.text;
    if (text.length <= CHUNK_SIZE_CHARS) {
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        content: text,
        tokenCount: Math.ceil(text.length / APPROX_CHARS_PER_TOKEN),
      });
      continue;
    }

    // Split into paragraphs
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = "";

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      if (!paragraph) continue;

      if ((currentChunk + "\n\n" + paragraph).length <= CHUNK_SIZE_CHARS) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      } else {
        if (currentChunk.trim()) {
          chunks.push({
            chunkIndex: chunkIndex++,
            pageNumber: page.pageNumber,
            content: currentChunk.trim(),
            tokenCount: Math.ceil(currentChunk.length / APPROX_CHARS_PER_TOKEN),
          });

          // Calculate overlap from end of currentChunk
          const overlapSlice = currentChunk.slice(-CHUNK_OVERLAP_CHARS);
          currentChunk = overlapSlice + "\n\n" + paragraph;
        } else {
          // Large single paragraph: split by sentence
          const sentences = paragraph.split(/(?<=[.?!])\s+/);
          let sentenceBuffer = "";

          for (const sentence of sentences) {
            if ((sentenceBuffer + " " + sentence).length <= CHUNK_SIZE_CHARS) {
              sentenceBuffer = sentenceBuffer ? `${sentenceBuffer} ${sentence}` : sentence;
            } else {
              if (sentenceBuffer) {
                chunks.push({
                  chunkIndex: chunkIndex++,
                  pageNumber: page.pageNumber,
                  content: sentenceBuffer.trim(),
                  tokenCount: Math.ceil(sentenceBuffer.length / APPROX_CHARS_PER_TOKEN),
                });
                sentenceBuffer = sentenceBuffer.slice(-CHUNK_OVERLAP_CHARS) + " " + sentence;
              } else {
                // Hard slice if a single sentence is giant
                chunks.push({
                  chunkIndex: chunkIndex++,
                  pageNumber: page.pageNumber,
                  content: sentence.slice(0, CHUNK_SIZE_CHARS),
                  tokenCount: CHUNK_SIZE_TOKENS,
                });
                sentenceBuffer = sentence.slice(CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS);
              }
            }
          }

          currentChunk = sentenceBuffer;
        }
      }
    }

    if (currentChunk.trim().length > 50) {
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        content: currentChunk.trim(),
        tokenCount: Math.ceil(currentChunk.length / APPROX_CHARS_PER_TOKEN),
      });
    }
  }

  return chunks;
}

/**
 * Splits a full text string directly into overlapping semantic chunks
 */
export function splitTextIntoChunks(
  fullText: string,
  chunkSizeTokens: number = 800,
  overlapTokens: number = 150
): SemanticChunk[] {
  if (!fullText || fullText.trim().length === 0) return [];

  const chunkSizeChars = chunkSizeTokens * APPROX_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * APPROX_CHARS_PER_TOKEN;

  if (fullText.length <= chunkSizeChars) {
    return [
      {
        chunkIndex: 0,
        pageNumber: 1,
        content: fullText.trim(),
        tokenCount: Math.ceil(fullText.trim().length / APPROX_CHARS_PER_TOKEN),
      },
    ];
  }

  const paragraphs = fullText.split(/\n\n+/);
  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;
  let currentChunk = "";
  let pageEstimate = 1;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (!paragraph) continue;

    if ((currentChunk + "\n\n" + paragraph).length <= chunkSizeChars) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    } else {
      if (currentChunk.trim()) {
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: pageEstimate,
          content: currentChunk.trim(),
          tokenCount: Math.ceil(currentChunk.length / APPROX_CHARS_PER_TOKEN),
        });
        const overlapSlice = currentChunk.slice(-overlapChars);
        currentChunk = overlapSlice + "\n\n" + paragraph;
        pageEstimate = 1 + Math.floor(chunks.length / 2);
      } else {
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: pageEstimate,
          content: paragraph.slice(0, chunkSizeChars),
          tokenCount: chunkSizeTokens,
        });
        currentChunk = paragraph.slice(chunkSizeChars - overlapChars);
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunkIndex: chunkIndex++,
      pageNumber: pageEstimate,
      content: currentChunk.trim(),
      tokenCount: Math.ceil(currentChunk.length / APPROX_CHARS_PER_TOKEN),
    });
  }

  return chunks;
}

