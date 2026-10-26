import fs from "fs";
import { generateExplanatoryGraphic, GraphicConceptType } from "./image-generator";
import { reviewAndValidateImage } from "@/lib/agents/image-reviewer";
import { validateFigureFitness, processNanoBananaJsonBlocks } from "./gemini-image-generator";

export interface MermaidTranslationResult {
  markdown: string;
  graphicsGenerated: number;
}

/**
 * Checks if a block of text represents a standard Markdown table
 */
function isMarkdownTable(text: string): boolean {
  if (!text) return false;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.some((l) => /^\|?\s*:?-{2,}:?\s*(\|?\s*:?-{2,}:?\s*)+\|?$/.test(l));
}

/**
 * Translates explicit Nano Banana JSON blocks, Mermaid, and textual diagram syntax.
 * Emits direct INLINE SVGs inside <figure> tags for 100% reliable rendering in Chromium/Puppeteer.
 */
export async function translateMermaidToEditorialGraphics(
  rawMarkdown: string,
  bookId: string,
  chapterId: string | null,
  chapterNumber: number,
  traceId: string,
  taskId: string
): Promise<MermaidTranslationResult> {
  if (!rawMarkdown) return { markdown: "", graphicsGenerated: 0 };

  // 1. Processar primeiro os blocos JSON explícitos do Nano Banana 2
  const nanoRes = await processNanoBananaJsonBlocks(
    rawMarkdown,
    bookId,
    chapterNumber,
    traceId,
    taskId
  );

  let markdown = nanoRes.markdown;
  let graphicsGenerated = nanoRes.graphicsGenerated;

  // 2. Capturar blocos de código com sintaxe de diagrama (```mermaid, ```graph, ```flowchart)
  const codeBlockRegex = /```\s*(?:mermaid|graph|flowchart|sequenceDiagram|classDiagram|gantt|pie|erDiagram)?\s*\n([\s\S]*?)```/gi;
  markdown = markdown.replace(codeBlockRegex, (match, innerContent) => {
    const trimmed = (innerContent || "").trim();
    if (isDiagramOrTreeContent(trimmed) && !isMarkdownTable(trimmed)) {
      const items = extractItemsFromDiagramText(trimmed);
      if (items.length < 2) return "";

      const title = extractTitleFromDiagramText(trimmed, `Estrutura Conceitual (Capítulo ${chapterNumber})`);
      const conceptType = determineConceptType(trimmed);

      const graphic = generateExplanatoryGraphic(
        bookId,
        chapterNumber,
        title,
        conceptType,
        items,
        `Figura ${chapterNumber}.${graphicsGenerated + 1} — ${title} [Nano Banana 2 / OpenChart].`
      );

      reviewAndValidateImage(bookId, chapterId, chapterNumber, graphic.filePath, traceId, taskId).catch(() => {});

      try {
        const svgRaw = fs.readFileSync(graphic.filePath, "utf-8");
        const figureTag = `\n\n<figure class="editorial-image">\n${svgRaw.trim()}\n  <figcaption>${escapeHtml(graphic.caption)}</figcaption>\n</figure>\n\n`;

        if (validateFigureFitness(figureTag)) {
          graphicsGenerated++;
          return figureTag;
        }
        return "";
      } catch {
        return "";
      }
    }
    return match;
  });

  // 3. Capturar árvores hierárquicas com ├──, └── ou caixas Unicode ┌──┐ com │/▼ (mínimo de 2 ramificações e não-tabela)
  const treeBranchRegex = /(?:(?:\[[A-ZÀ-Ú0-9\s_\-:]+\]|\*\*[^\n]+\*\*)\s*\n+)?(?:[ \t]*(?:├──|└──|┌[─┬┴]+┐)[^\n]*\n(?:[ \t]*[│|┌┐└┘├┤┬┴▼▲├──└──].*\n?){2,})/gi;
  markdown = markdown.replace(treeBranchRegex, (match) => {
    const trimmed = match.trim();
    if (isMarkdownTable(trimmed)) return match;

    const items = extractItemsFromDiagramText(trimmed);
    if (items.length < 2) return match;

    const title = extractTitleFromDiagramText(trimmed, `Arquitetura & Desdobramento Analítico (Capítulo ${chapterNumber})`);
    const conceptType = determineConceptType(trimmed);

    const graphic = generateExplanatoryGraphic(
      bookId,
      chapterNumber,
      title,
      conceptType,
      items,
      `Figura ${chapterNumber}.${graphicsGenerated + 1} — ${title} [Nano Banana 2 / OpenChart].`
    );

    reviewAndValidateImage(bookId, chapterId, chapterNumber, graphic.filePath, traceId, taskId).catch(() => {});

    try {
      const svgRaw = fs.readFileSync(graphic.filePath, "utf-8");
      const figureTag = `\n\n<figure class="editorial-image">\n${svgRaw.trim()}\n  <figcaption>${escapeHtml(graphic.caption)}</figcaption>\n</figure>\n\n`;

      if (validateFigureFitness(figureTag)) {
        graphicsGenerated++;
        return figureTag;
      }
      return "";
    } catch {
      return "";
    }
  });

  // 4. Capturar Cascatas Financeiras com ====
  const financialCascadeRegex = /(?:(?:CASCATA|[A-ZÀ-Ú\s]{4,})\s*\n+)?(?:[^\n]+\n[ \t]*\([+-]\)[^\n]+\n[ \t]*={3,}\n(?:[ \t]*=[^\n]+\n(?:[ \t]*\([+-]\)[^\n]+\n)?[ \t]*={3,}\n?)+[ \t]*=[^\n]+)/gi;
  markdown = markdown.replace(financialCascadeRegex, (match) => {
    const trimmed = match.trim();
    if (isMarkdownTable(trimmed)) return match;

    const items = extractItemsFromDiagramText(trimmed);
    if (items.length < 2) return match;

    const title = extractTitleFromDiagramText(trimmed, `Demonstrativo & Cascata Analítica (Capítulo ${chapterNumber})`);

    const graphic = generateExplanatoryGraphic(
      bookId,
      chapterNumber,
      title,
      "financial_cascade",
      items,
      `Figura ${chapterNumber}.${graphicsGenerated + 1} — ${title} [Nano Banana 2 / OpenChart].`
    );

    reviewAndValidateImage(bookId, chapterId, chapterNumber, graphic.filePath, traceId, taskId).catch(() => {});

    try {
      const svgRaw = fs.readFileSync(graphic.filePath, "utf-8");
      const figureTag = `\n\n<figure class="editorial-image">\n${svgRaw.trim()}\n  <figcaption>${escapeHtml(graphic.caption)}</figcaption>\n</figure>\n\n`;

      if (validateFigureFitness(figureTag)) {
        graphicsGenerated++;
        return figureTag;
      }
      return "";
    } catch {
      return "";
    }
  });

  // 5. Capturar Linhas do Tempo com etapas sequenciais
  const timelineRegex = /(?:(?:LINHA DO TEMPO|[A-ZÀ-Ú\s]{4,})\s*\n+)?(?:(?:Ano|Etapa|Fase|Mês|Passo)\s+\d+[:\s][^\n]+->[^\n]+\n[ \t]*\|[ \t]*\n?){2,}(?:(?:Ano|Etapa|Fase|Mês|Passo)\s+\d+[:\s][^\n]+)/gi;
  markdown = markdown.replace(timelineRegex, (match) => {
    const trimmed = match.trim();
    if (isMarkdownTable(trimmed)) return match;

    const items = extractItemsFromDiagramText(trimmed);
    if (items.length < 2) return match;

    const title = extractTitleFromDiagramText(trimmed, `Linha do Tempo Estratégica (Capítulo ${chapterNumber})`);

    const graphic = generateExplanatoryGraphic(
      bookId,
      chapterNumber,
      title,
      "timeline",
      items,
      `Figura ${chapterNumber}.${graphicsGenerated + 1} — ${title} [Nano Banana 2 / OpenChart].`
    );

    reviewAndValidateImage(bookId, chapterId, chapterNumber, graphic.filePath, traceId, taskId).catch(() => {});

    try {
      const svgRaw = fs.readFileSync(graphic.filePath, "utf-8");
      const figureTag = `\n\n<figure class="editorial-image">\n${svgRaw.trim()}\n  <figcaption>${escapeHtml(graphic.caption)}</figcaption>\n</figure>\n\n`;

      if (validateFigureFitness(figureTag)) {
        graphicsGenerated++;
        return figureTag;
      }
      return "";
    } catch {
      return "";
    }
  });

  // 6. Capturar Funis e Fluxos Verticais com [ Etapa ] | v [ Etapa ]
  const verticalFlowRegex = /(?:\[\s*[\w\d\s.,%À-Úa-z\-\/]+\s*\]\s*\n+[ \t]*(?:[|│▼▲v^]+|\([^\)]+\))[^\n]*\n+){2,}[ \t]*\[\s*[\w\d\s.,%À-Úa-z\-\/]+\s*\]/gi;
  markdown = markdown.replace(verticalFlowRegex, (match) => {
    const trimmed = match.trim();
    if (isMarkdownTable(trimmed)) return match;

    const items = extractItemsFromDiagramText(trimmed);
    if (items.length < 2) return match;

    const title = extractTitleFromDiagramText(trimmed, `Funil Analítico & Fluxo de Conversão (Capítulo ${chapterNumber})`);

    const graphic = generateExplanatoryGraphic(
      bookId,
      chapterNumber,
      title,
      "strategic_flow",
      items,
      `Figura ${chapterNumber}.${graphicsGenerated + 1} — ${title} [Nano Banana 2 / OpenChart].`
    );

    reviewAndValidateImage(bookId, chapterId, chapterNumber, graphic.filePath, traceId, taskId).catch(() => {});

    try {
      const svgRaw = fs.readFileSync(graphic.filePath, "utf-8");
      const figureTag = `\n\n<figure class="editorial-image">\n${svgRaw.trim()}\n  <figcaption>${escapeHtml(graphic.caption)}</figcaption>\n</figure>\n\n`;

      if (validateFigureFitness(figureTag)) {
        graphicsGenerated++;
        return figureTag;
      }
      return "";
    } catch {
      return "";
    }
  });

  return {
    markdown,
    graphicsGenerated,
  };
}

function isDiagramOrTreeContent(text: string): boolean {
  if (!text) return false;
  if (isMarkdownTable(text)) return false;
  if (/graph\s+(TD|TB|BT|RL|LR)|flowchart|sequenceDiagram|classDiagram/i.test(text)) return true;
  if (/(?:├──.*){2,}/.test(text) || (text.includes("├──") && text.includes("└──"))) return true;
  if (text.includes("┌") && text.includes("┐") && text.includes("│")) return true;
  return false;
}

function determineConceptType(text: string): GraphicConceptType {
  if (/LINHA DO TEMPO|Ano\s+\d+|Fase\s+\d+|Passo\s+\d+/i.test(text)) return "timeline";
  if (/CASCATA|EBIT|NOPAT|EVA|LUCRO|Receita/i.test(text) && /===|=/.test(text)) return "financial_cascade";
  if (/QUADRANTE|PONTUAÇÃO|ESTATURA|FORÇA DA MARCA|BAV|BCG|MATRIZ/i.test(text)) return "decision_matrix";
  if (/-->|->|├──|└──|Fluxo|Processo/i.test(text)) return "strategic_flow";
  return "conceptual_pillars";
}

function extractTitleFromDiagramText(text: string, fallback: string): string {
  const bracketMatch = text.match(/\[([A-ZÀ-Ú0-9\s_\-:]+)\]/i);
  if (bracketMatch && bracketMatch[1].length > 3) {
    return bracketMatch[1].trim();
  }

  const boldMatch = text.match(/\*\*([^\n]+)\*\*/);
  if (boldMatch && boldMatch[1].length > 3) {
    return boldMatch[1].trim();
  }

  const firstLine = text.split("\n")[0].trim().replace(/^#+\s*/, "");
  if (firstLine.length > 5 && firstLine.length < 60 && !/[┌+├└│├──└──|]/.test(firstLine)) {
    return firstLine;
  }

  return fallback;
}

function extractItemsFromDiagramText(rawText: string): Array<{ label: string; description: string }> {
  const items: Array<{ label: string; description: string }> = [];
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (/^[┌┐└┘├┤┬┴─│▼▲├──└──+=\-| \t]+$/.test(line)) continue;

    const treeMatch = line.match(/(?:├──|└──|\|\s*-+)\s*(?:(\d+\.\s*)?([^->\n]+))\s*->?\s*(.*)/i);
    if (treeMatch) {
      const label = (treeMatch[2] || "").replace(/[│┌┐└┘├┤+]/g, "").trim();
      const desc = (treeMatch[3] || "").trim() || `Diretriz operacional para ${label}.`;
      if (label.length > 2) {
        items.push({ label: label.substring(0, 50), description: desc });
        continue;
      }
    }

    const timelineMatch = line.match(/(?:Ano|Etapa|Fase|Passo)\s*(\d+\+?)[:\s]+([^->\n]+)(?:->(.*))?/i);
    if (timelineMatch) {
      const step = timelineMatch[1];
      const label = (timelineMatch[2] || "").trim();
      const desc = (timelineMatch[3] || "").trim() || `Execução da etapa ${step}.`;
      items.push({ label: `${label}`.substring(0, 50), description: desc });
      continue;
    }

    const cascadeMatch = line.match(/(?:=\s*|\(-?\)\s*)([A-ZÀ-Ú0-9\s()$%&/]+)/i);
    if (cascadeMatch && line.includes("(") && (line.includes("=") || line.includes("(-)"))) {
      const clean = cascadeMatch[1].replace(/[=()]/g, "").trim();
      if (clean.length > 3) {
        items.push({
          label: clean.substring(0, 45),
          description: `Componente financeiro e métrica de resultado: ${clean}.`,
        });
        continue;
      }
    }

    if (line.startsWith("│") && !isMarkdownTable(line)) {
      const content = line.replace(/^[│]|[│]$/g, "").trim();
      const cells = content.split(/[│]/).map((c) => c.trim()).filter(Boolean);
      for (const cell of cells) {
        const clean = cell
          .replace(/[┌┐└┘├┤┬┴▼▲()$]/g, "")
          .replace(/[-–=]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (clean.length > 3 && !items.some((it) => it.label === clean)) {
          items.push({
            label: clean.substring(0, 50),
            description: `Desdobramento analítico e diretriz técnica para ${clean}.`,
          });
        }
      }
      continue;
    }

    const bracketMatch = line.match(/\[(.*?)\]/g);
    if (bracketMatch && bracketMatch.length > 0) {
      const cleanLabel = bracketMatch[0].replace(/[\[\]"']/g, "").trim();
      const cleanDesc = bracketMatch.length > 1
        ? bracketMatch[1].replace(/[\[\]"']/g, "").trim()
        : `Implementação e diretriz analítica para ${cleanLabel}.`;

      if (cleanLabel.length > 2 && !items.some((it) => it.label === cleanLabel)) {
        items.push({
          label: cleanLabel.substring(0, 55),
          description: cleanDesc,
        });
      }
    }

    if (items.length >= 4) break;
  }

  return items;
}

function escapeHtml(text: string): string {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
