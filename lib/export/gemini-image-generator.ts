import fs from "fs";
import path from "path";
import { callGemini } from "@/lib/agents/gemini-client";
import { generateExplanatoryGraphic, GraphicConceptType } from "./image-generator";
import { reviewAndValidateImage } from "@/lib/agents/image-reviewer";
import { extractCleanJsonObject } from "@/lib/utils/json-parser";

export interface NanoBananaImageRequest {
  bookId: string;
  chapterNumber: number;
  title: string;
  conceptDescription: string;
  conceptType?: GraphicConceptType;
  items?: Array<{ label: string; description: string }>;
  caption?: string;
  traceId: string;
  taskId: string;
}

export interface NanoBananaImageResult {
  success: boolean;
  htmlTag: string;
  filePath: string | null;
  error?: string;
}

/**
 * Nano Banana 2 — Motor Especializado de Geração e Validação Visual com Gemini
 * Processa estruturas JSON criadas pelos subagentes ou gera via Gemini.
 * Só insere a figura se for 100% aprovada e apta para renderização no PDF sem quebras.
 */
export async function generateNanoBananaVisualGraphic(
  req: NanoBananaImageRequest
): Promise<NanoBananaImageResult> {
  const { bookId, chapterNumber, title, conceptDescription, traceId, taskId } = req;

  try {
    let conceptType: GraphicConceptType = req.conceptType || "conceptual_pillars";
    let graphicTitle = (title || "").substring(0, 50);
    let caption = req.caption || `Figura ${chapterNumber}.1 — ${graphicTitle} [Nano Banana 2 / OpenChart].`;
    let items = req.items || [];

    // Se o subagente forneceu explicitamente items com menos de 2 elementos, rejeitar imediatamente
    if (req.items && req.items.length < 2) {
      return { success: false, htmlTag: "", filePath: null, error: "Mínimo de 2 itens estruturados exigidos para figura editorial" };
    }

    // Se os itens não foram enviados, solicitar estruturação via Gemini
    if (items.length < 2) {
      const geminiPrompt = `Você é o motor Nano Banana 2 de design gráfico e visualização editorial (snow-d3, OpenChart).
Estruture um modelo visual claro e sofisticado para o seguinte conceito:

TÍTULO: "${title}"
DESCRIÇÃO DO CONCEITO: "${conceptDescription}"

Responda OBRIGATORIAMENTE em JSON válido com esta estrutura:
{
  "conceptType": "strategic_flow" | "conceptual_pillars" | "comparison_table" | "decision_matrix" | "timeline" | "financial_cascade",
  "title": "Título Editorial Limpo (máximo 45 caracteres)",
  "caption": "Legenda explicativa sucinta da figura",
  "items": [
    {
      "label": "Rótulo do Pilar / Etapa (máximo 35 caracteres)",
      "description": "Explicação analítica e diretriz prática (1 a 2 frases claras)"
    },
    {
      "label": "Rótulo do Pilar / Etapa (máximo 35 caracteres)",
      "description": "Explicação analítica e diretriz prática (1 a 2 frases claras)"
    }
  ]
}`;

      const geminiRes = await callGemini(geminiPrompt, {
        responseMimeType: "application/json",
      });

      let parsed: any = null;
      try {
        parsed = extractCleanJsonObject(geminiRes.text);
      } catch (err: any) {
        console.warn("Falha ao decodificar JSON do conceito de imagem:", err.message);
      }

      if (!parsed || !parsed.items || parsed.items.length < 2) {
        return { success: false, htmlTag: "", filePath: null, error: "Conceito insuficiente para gerar gráfico (mínimo de 2 itens)" };
      }

      conceptType = parsed.conceptType || conceptType;
      graphicTitle = (parsed.title || graphicTitle).substring(0, 50);
      caption = parsed.caption || caption;
      items = parsed.items;
    }

    // Garantir que temos entre 2 e 4 itens válidos
    const validItems = items.filter((it) => it && it.label && it.label.trim().length > 1).slice(0, 4);
    if (validItems.length < 2) {
      return { success: false, htmlTag: "", filePath: null, error: "Mínimo de 2 itens estruturados exigidos" };
    }

    // 2. Gerar o arquivo vetorial SVG de alta resolução
    const graphic = generateExplanatoryGraphic(
      bookId,
      chapterNumber,
      graphicTitle,
      conceptType,
      validItems,
      caption
    );

    // 3. Validação Rigorosa de Aptidão Visual com o Quality Gate (Image Reviewer)
    const review = await reviewAndValidateImage(
      bookId,
      `chap_${bookId}_${chapterNumber}`,
      chapterNumber,
      graphic.filePath,
      traceId,
      taskId
    );

    if (!review.valid) {
      console.warn(`[Nano Banana 2] Figura "${graphicTitle}" reprovada no quality gate visual.`);
      return { success: false, htmlTag: "", filePath: null, error: "Reprovado no Quality Gate Visual" };
    }

    // 4. Validar integridade física do arquivo e codificação Base64
    if (!fs.existsSync(graphic.filePath)) {
      return { success: false, htmlTag: "", filePath: null, error: "Arquivo de imagem não encontrado em disco" };
    }

    const svgContent = fs.readFileSync(graphic.filePath, "utf-8");
    if (!svgContent || svgContent.length < 100 || !svgContent.includes("<svg") || !svgContent.includes("</svg>")) {
      return { success: false, htmlTag: "", filePath: null, error: "SVG malformado ou corrompido" };
    }

    // Renderização direta como Inline SVG dentro de <figure> para garantir 100% de compatibilidade
    // com o motor Blink/Chromium do Puppeteer sem bloqueios de foreignObject.
    const htmlTag = `\n\n<figure class="editorial-image">\n${svgContent.trim()}\n  <figcaption>${escapeHtml(graphic.caption)}</figcaption>\n</figure>\n\n`;

    return {
      success: true,
      htmlTag,
      filePath: graphic.filePath,
    };
  } catch (err: any) {
    console.error("[Nano Banana 2] Erro na geração de imagem:", err);
    return { success: false, htmlTag: "", filePath: null, error: err.message || String(err) };
  }
}

/**
 * Processa blocos JSON explícitos ```json:nano-banana, ```json ou { "conceptType": ... }
 * emitidos pelos subagentes escritores e converte em figuras editoriais de 300 DPI.
 */
export async function processNanoBananaJsonBlocks(
  markdown: string,
  bookId: string,
  chapterNumber: number,
  traceId: string,
  taskId: string
): Promise<{ markdown: string; graphicsGenerated: number }> {
  if (!markdown) return { markdown: "", graphicsGenerated: 0 };

  let resultMarkdown = markdown;
  let graphicsGenerated = 0;

  // 1. Regex para capturar blocos ```json:nano-banana ou ```json com conceptType
  const fencedJsonRegex = /```(?:json:nano-banana|json)?\s*\n([\s\S]*?"conceptType"[\s\S]*?)\n```/gi;

  // 2. Regex para capturar objetos JSON puros { "conceptType": ... } soltos no texto
  const rawJsonRegex = /(?:^|\n)\s*(\{\s*"conceptType"\s*:\s*"[^"]+"[\s\S]*?\n\s*\})/gi;

  const extractAndConvert = async (regex: RegExp) => {
    const matches: Array<{ fullMatch: string; jsonContent: string }> = [];
    let match;
    while ((match = regex.exec(resultMarkdown)) !== null) {
      matches.push({ fullMatch: match[0], jsonContent: match[1] || match[0] });
    }

    for (const item of matches) {
      try {
        const cleanJsonStr = item.jsonContent.trim().replace(/^```(?:json:nano-banana|json)?|```$/gi, "").trim();
        const parsed = JSON.parse(cleanJsonStr);

        if (parsed && (parsed.conceptType || parsed.items)) {
          const visualResult = await generateNanoBananaVisualGraphic({
            bookId,
            chapterNumber,
            title: parsed.title || `Modelo Estratégico (Capítulo ${chapterNumber})`,
            conceptDescription: parsed.description || parsed.title || "Modelo analítico de suporte à tomada de decisão.",
            conceptType: parsed.conceptType || "conceptual_pillars",
            items: parsed.items,
            caption: parsed.caption,
            traceId,
            taskId,
          });

          if (visualResult.success && visualResult.htmlTag) {
            resultMarkdown = resultMarkdown.replace(item.fullMatch, `\n\n${visualResult.htmlTag}\n\n`);
            graphicsGenerated++;
          } else {
            // Se falhou ou tem menos de 2 itens, remove o bloco JSON para não poluir o livro
            resultMarkdown = resultMarkdown.replace(item.fullMatch, "");
          }
        }
      } catch {
        // JSON malformado do subagente: remove o bloco com segurança para não vazar código
        resultMarkdown = resultMarkdown.replace(item.fullMatch, "");
      }
    }
  };

  await extractAndConvert(fencedJsonRegex);
  await extractAndConvert(rawJsonRegex);

  return {
    markdown: resultMarkdown,
    graphicsGenerated,
  };
}

/**
 * Validador de segurança para evitar tags quebradas no PDF
 */
export function validateFigureFitness(figureHtml: string): boolean {
  if (!figureHtml) return false;
  if (!figureHtml.includes("<figure") || !figureHtml.includes("</figure>")) return false;
  // Suporta Inline SVG e imagens com base64
  const hasValidSvg = figureHtml.includes("<svg") && figureHtml.includes("</svg>");
  const hasValidImg = figureHtml.includes("<img") && figureHtml.includes("data:image/svg+xml");
  if (!hasValidSvg && !hasValidImg) return false;
  return true;
}

function escapeHtml(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
