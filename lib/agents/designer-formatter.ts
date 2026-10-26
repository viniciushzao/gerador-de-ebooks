import { marked } from "marked";
import { BookRecord, ChapterRecord } from "@/lib/db/schema";
import { createTask, updateTask, addAuditLog } from "@/lib/db/client";
import { getSystemConfig } from "@/lib/config";
import { purgeMermaidDiagrams, cleanLatexMathFormatting } from "./chapter-writer";
import { getPageFormatSpec } from "@/lib/export/page-formats";

export interface FormattedEbook {
  htmlContent: string;
  markdownManuscript: string;
  totalWords: number;
  estimatedPages: number;
}

/**
 * Processes markdown by safely protecting <figure>...</figure> blocks from BOTH
 * regex manipulation (LaTeX / Mermaid purges) AND the markdown parser (marked.parse).
 * This prevents marked from treating indented SVG XML as code blocks (<pre><code>).
 */
export function formatMarkdownToEditorialHtml(markdown: string): string {
  if (!markdown) return "";
  const figures: string[] = [];
  const placeholderPrefix = "EDITORIAL_FIGURE_PLACEHOLDER_";

  // 1. Extrair figuras e substituir por placeholders simples sem indentação
  const protectedMarkdown = markdown.replace(/<figure[\s\S]*?<\/figure>/gi, (match) => {
    const idx = figures.length;
    figures.push(match.trim());
    return `\n\n${placeholderPrefix}${idx}\n\n`;
  });

  // 2. Aplicar limpezas no texto Markdown puro
  const cleanedMarkdown = cleanLatexMathFormatting(purgeMermaidDiagrams(protectedMarkdown));

  // 3. marked.parse converte o Markdown em HTML sem tocar nos SVGs
  marked.setOptions({
    gfm: true,
    breaks: false,
  });
  const rawHtml = marked.parse(cleanedMarkdown) as string;

  // 4. Sanitizar HTML (remover scripts, etc.)
  let cleanHtml = sanitizeEditorialHtml(rawHtml);

  // 5. Restaurar as figuras no HTML final, substituindo qualquer <p>placeholder</p>
  for (let idx = 0; idx < figures.length; idx++) {
    const rawSvgFigure = figures[idx];
    const ph = `${placeholderPrefix}${idx}`;
    const regex = new RegExp(`<p>\\s*${ph}\\s*<\\/p>|${ph}`, "g");
    cleanHtml = cleanHtml.replace(regex, `\n${rawSvgFigure}\n`);
  }

  return cleanHtml;
}

export function cleanMarkdownTextOnly(markdown: string): string {
  if (!markdown) return "";
  return cleanLatexMathFormatting(purgeMermaidDiagrams(markdown));
}

/**
 * Separa o título do livro palavra por palavra, com cada palavra
 * formatada em sua própria linha isolada para a contracapa.
 * Exemplo: "Vendendo como Louco" ->
 * <div class="contracapa-title-line">Vendendo</div>
 * <div class="contracapa-title-line">Como</div>
 * <div class="contracapa-title-line">Louco</div>
 */
export function formatTitleWordsInLines(title: string): string {
  if (!title) return "";
  return title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const formatted = word.charAt(0).toUpperCase() + word.slice(1);
      return `<div class="cover-title-line contracapa-title-line">${escapeHtml(formatted)}</div>`;
    })
    .join("\n      ");
}

export async function formatEbookManuscript(
  book: BookRecord,
  chapters: ChapterRecord[],
  traceId: string,
  parentTaskId: string
): Promise<FormattedEbook> {
  const config = getSystemConfig();
  const pageSpec = getPageFormatSpec(book.page_size || config.DEFAULT_PAGE_SIZE);
  const startTime = Date.now();
  const taskId = `task_designer_${book.id}_${Date.now()}`;

  createTask({
    id: taskId,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: book.id,
    chapter_id: null,
    agent_role: "DESIGNER",
    status: "running",
    input_payload: JSON.stringify({ bookId: book.id, totalChapters: chapters.length }),
    output_payload: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_used: "book-designer",
    error: null,
    created_at: new Date().toISOString(),
    finished_at: null,
  });

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: book.id,
    chapter_id: null,
    agent_role: "DESIGNER",
    level: "info",
    message: `Subagente Designer & Formatter iniciado. Estruturando regras de diagramação, tipografia e formato de folha ${pageSpec.name}.`,
    metadata: JSON.stringify({
      title: book.title,
      chaptersCount: chapters.length,
      author: book.author_name,
      pageSize: pageSpec.id,
      pageSizeName: pageSpec.name,
    }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: "book-designer",
    timestamp: new Date().toISOString(),
  });

  // Sort chapters by chapter_number
  const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);

  // Build full Markdown manuscript
  let fullMarkdown = `# ${book.title}\n\n`;
  fullMarkdown += `**Autor:** ${book.author_name}\n\n`;
  fullMarkdown += `---\n\n`;
  fullMarkdown += `## Apresentação da Obra\n\n${book.executive_summary || ""}\n\n---\n\n`;

  let totalWords = (book.executive_summary || "").split(/\s+/).filter(Boolean).length;

  for (const ch of sortedChapters) {
    fullMarkdown += `${ch.content_markdown}\n\n---\n\n`;
    totalWords += ch.actual_words || ch.content_markdown.split(/\s+/).filter(Boolean).length;
  }

  const estimatedPages = Math.ceil(totalWords / (pageSpec.wordsPerPage || 250));

  // Choose typography font family
  const typography = book.typography || config.DESIGN_TYPOGRAPHY || "Garamond";
  const spacing = Math.max(1.35, book.spacing || config.DESIGN_SPACING || 1.38);

  let fontFamilyCss = "Garamond, Georgia, serif";
  if (typography.toLowerCase().includes("baskerville")) {
    fontFamilyCss = "Baskerville, 'Baskerville Old Face', Georgia, serif";
  } else if (typography.toLowerCase().includes("palatino")) {
    fontFamilyCss = "'Palatino Linotype', Palatino, Georgia, serif";
  } else if (typography.toLowerCase().includes("georgia")) {
    fontFamilyCss = "Georgia, serif";
  }

  // Configurar marked para tabelas GFM nativas e HTML seguro
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  // Convert markdown chapters to HTML com sanitização de segurança e proteção de figuras
  const parsedChaptersHtml = sortedChapters
    .map((ch) => {
      const cleanHtml = formatMarkdownToEditorialHtml(ch.content_markdown);
      return `
        <section class="chapter-container" id="chapter-${ch.chapter_number}" data-chapter-num="${ch.chapter_number}">
          <span class="editorial-page-anchor" data-anchor-id="ch-${ch.chapter_number}">[[PAGEREF:ch-${ch.chapter_number}]]</span>
          <div class="chapter-content">
            ${cleanHtml}
          </div>
        </section>
      `;
    })
    .join("\n");

  const introHtml = formatMarkdownToEditorialHtml(book.executive_summary || "");

  // Estimativa estrutural de páginas para o sumário (Pág 1: Capa Única, Pág 2+: Sumário, Pág 3/4+: Apresentação)
  const totalTocItems = sortedChapters.length + 1; // +1 para Apresentação
  const estimatedTocPages = totalTocItems > 13 ? 2 : 1;
  const introStartPage = 2 + estimatedTocPages;
  const introWords = (book.executive_summary || "").split(/\s+/).filter(Boolean).length;
  const introPages = Math.max(1, Math.ceil(introWords / (pageSpec.wordsPerPage || 250)));
  let runningPageTracker = introStartPage + introPages;
  const initialChapterPageMap: Record<number, number> = {};

  for (const ch of sortedChapters) {
    initialChapterPageMap[ch.chapter_number] = runningPageTracker;
    const words = ch.actual_words || ch.content_markdown.split(/\s+/).filter(Boolean).length;
    const chPages = Math.max(2, Math.ceil(words / (pageSpec.wordsPerPage || 250)));
    runningPageTracker += chPages;
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(book.title)}</title>
  <style>
    @page {
      size: ${pageSpec.cssSize};
      margin-top: ${pageSpec.margins.top};
      margin-bottom: ${pageSpec.margins.bottom};
      margin-left: ${pageSpec.margins.left};
      margin-right: ${pageSpec.margins.right};
      @bottom-center {
        content: counter(page);
        font-family: ${fontFamilyCss};
        font-size: 9pt;
        color: #555555;
      }
    }

    @page cover {
      margin-top: 0;
      margin-bottom: 0;
      margin-left: 0;
      margin-right: 0;
      @top-left { content: none !important; }
      @top-right { content: none !important; }
      @top-center { content: none !important; }
      @bottom-center { content: none !important; }
    }

    @page :first {
      @top-left { content: none !important; }
      @top-right { content: none !important; }
      @top-center { content: none !important; }
      @bottom-center { content: none !important; }
    }

    @page :left {
      @top-left {
        content: "${escapeCssString(book.title)}";
        font-family: ${fontFamilyCss};
        font-size: 8pt;
        color: #777777;
        font-style: italic;
      }
    }

    @page :right {
      @top-right {
        content: "${escapeCssString(book.author_name)}";
        font-family: ${fontFamilyCss};
        font-size: 8pt;
        color: #777777;
        font-style: italic;
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: ${fontFamilyCss};
      font-size: 11.5pt;
      line-height: ${spacing};
      color: #1a1a1a;
      text-align: justify;
      hyphens: auto;
      margin: 0;
      padding: 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
      max-width: 100%;
    }

    p, div, li, span, h1, h2, h3, h4, h5, h6, blockquote {
      word-wrap: break-word;
      overflow-wrap: break-word;
      max-width: 100%;
    }

    pre, code {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: break-word;
      max-width: 100%;
    }

    /* Invisible high-precision micro-anchors for 2-pass physical pagination */
    .editorial-page-anchor {
      color: transparent !important;
      font-size: 0.1pt !important;
      line-height: 0 !important;
      display: inline-block !important;
      user-select: none !important;
      pointer-events: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Cover Styling (Capa Única Editorial) */
    .cover-page,
    .contracapa-page {
      page: cover;
      page-break-after: always;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 50px 30px;
      box-sizing: border-box;
    }

    .cover-header-badge,
    .contracapa-header-badge {
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 2.5px;
      color: #64748b;
      margin-bottom: 30px;
      font-weight: 600;
    }

    .cover-title-container,
    .contracapa-title-container {
      margin-bottom: 25px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }

    .cover-title-line,
    .contracapa-title-line {
      font-size: 26pt;
      font-weight: 800;
      line-height: 1.15;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: capitalize;
      font-family: ${fontFamilyCss};
    }

    .cover-subtitle,
    .contracapa-subtitle {
      font-size: 11pt;
      color: #475569;
      margin-bottom: 30px;
      font-style: italic;
      max-width: 85%;
      line-height: 1.4;
    }

    .cover-divider,
    .contracapa-divider {
      width: 60px;
      height: 2px;
      background: #0f172a;
      margin: 0 auto 20px auto;
    }

    .cover-author,
    .contracapa-author {
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 30px;
      letter-spacing: 0.5px;
    }

    .cover-colophon,
    .contracapa-colophon {
      font-size: 8pt;
      color: #64748b;
      line-height: 1.6;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
      width: 80%;
    }

    /* Quarta Capa (Contracapa Final da Obra) */
    .quarta-capa-page {
      page-break-before: always;
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 50px 30px;
      box-sizing: border-box;
      background: #fafafa;
    }

    .quarta-capa-author {
      font-size: 11pt;
      color: #334155;
      margin-bottom: 20px;
    }

    .quarta-capa-synopsis {
      font-size: 9.5pt;
      line-height: 1.6;
      color: #475569;
      max-width: 90%;
      text-align: justify;
      margin-bottom: 30px;
      padding: 16px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .quarta-capa-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 15px;
      width: 85%;
    }

    .quarta-capa-badge {
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .quarta-capa-meta {
      font-size: 7.5pt;
      color: #64748b;
    }

    /* TOC Styling */
    .toc-page {
      page-break-after: always;
      padding-top: 30px;
    }

    .toc-title {
      font-size: 18pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 30px;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
    }

    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .toc-item {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 12px;
      font-size: 10.5pt;
      border-bottom: 1px dotted #cbd5e1;
      padding-bottom: 3px;
    }

    .toc-item-title {
      color: #1e293b;
      font-weight: 500;
    }

    .toc-page-num {
      font-family: ${fontFamilyCss};
      font-weight: 700;
      color: #0f172a;
      margin-left: 10px;
    }

    /* Chapters Container */
    .chapter-container {
      page-break-before: always;
      padding-top: 20px;
    }

    h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 24px;
      line-height: 1.25;
      text-align: left;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 8px;
    }

    h2 {
      font-size: 14pt;
      font-weight: bold;
      color: #1e293b;
      margin-top: 28px;
      margin-bottom: 12px;
      line-height: 1.3;
      page-break-after: avoid;
    }

    h3 {
      font-size: 12pt;
      font-weight: 600;
      color: #334155;
      margin-top: 20px;
      margin-bottom: 8px;
      line-height: 1.3;
      page-break-after: avoid;
    }

    p {
      margin-top: 0;
      margin-bottom: 14px;
      text-indent: 1.5em;
    }

    p.lead, .chapter-content > p:first-of-type {
      text-indent: 0;
    }

    .chapter-content > p:first-of-type::first-letter {
      font-size: 320%;
      float: left;
      line-height: 0.8;
      margin-right: 8px;
      margin-bottom: -2px;
      color: #0f172a;
      font-weight: bold;
    }

    blockquote {
      margin: 18px 0 18px 15px;
      padding: 10px 18px;
      border-left: 3px solid #cbd5e1;
      font-style: italic;
      color: #334155;
      background: #f8fafc;
      page-break-inside: avoid;
    }

    blockquote p {
      text-indent: 0;
      margin-bottom: 0;
    }

    /* Editorial Formula Box */
    .editorial-formula-box {
      margin: 20px 0;
      padding: 14px 18px;
      background: #f8fafc;
      border-left: 3px solid #2563eb;
      border-radius: 0 8px 8px 0;
      page-break-inside: avoid;
    }

    .formula-label {
      display: block;
      font-size: 8.5pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #1e293b;
      margin-bottom: 6px;
    }

    .formula-content {
      font-family: 'Georgia', 'Garamond', serif;
      font-size: 10.5pt;
      font-style: italic;
      color: #0f172a;
      line-height: 1.5;
      word-wrap: break-word;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 14px;
      padding-left: 24px;
    }

    li {
      margin-bottom: 6px;
    }

    hr {
      border: 0;
      height: 1px;
      background: #e2e8f0;
      margin: 24px 0;
    }

    /* Editorial High-Resolution Figures (Inline SVG & Images) */
    figure.editorial-image {
      margin: 28px 0;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      text-align: center;
      page-break-inside: avoid;
    }

    figure.editorial-image svg {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      display: block;
      margin: 0 auto;
    }

    figure.editorial-image img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      display: block;
      margin: 0 auto;
    }

    figcaption {
      margin-top: 10px;
      font-size: 8.5pt;
      font-style: italic;
      color: #64748b;
      text-align: center;
      line-height: 1.4;
    }

    /* Editorial Styled Tables (GFM Markdown Tables) */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 9.5pt;
      line-height: 1.4;
      page-break-inside: avoid;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }

    thead {
      background: #0f172a;
      color: #ffffff;
    }

    th {
      padding: 9px 12px;
      font-weight: 700;
      text-align: left;
      font-family: ${fontFamilyCss};
      border-bottom: 2px solid #0f172a;
      color: #ffffff;
      font-size: 9pt;
      letter-spacing: 0.3px;
    }

    td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: middle;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    tr:last-child td {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <!-- Single Cover Page (Capa Única Editorial com Título Palavra por Palavra em Linhas Individuais) -->
  <div class="cover-page" id="cover-page">
    <div class="cover-header-badge">Obra de Referência & Consultoria</div>
    <div class="cover-title-container">
      ${formatTitleWordsInLines(book.title)}
    </div>
    <div class="cover-subtitle">Tratado Aprofundado, Desconstrução por Primeiros Princípios e Playbooks de Ação</div>
    <div class="cover-divider"></div>
    <div class="cover-author">${escapeHtml(book.author_name)}</div>
    <div class="cover-colophon">
      <div>Publicação Autônoma • Todos os direitos reservados</div>
    </div>
  </div>

  <!-- Table of Contents (Sumário Geral) -->
  <div class="toc-page" id="toc-section">
    <div class="toc-title">Sumário Geral</div>
    <ul class="toc-list">
      <li class="toc-item">
        <span class="toc-item-title">Apresentação da Obra</span>
        <span class="toc-page-num" id="toc-page-intro" data-toc-target="intro">${introStartPage}</span>
      </li>
      ${sortedChapters
        .map(
          (ch) => `
        <li class="toc-item">
          <span class="toc-item-title">Capítulo ${ch.chapter_number}: ${escapeHtml(ch.title)}</span>
          <span class="toc-page-num" id="toc-page-ch-${ch.chapter_number}" data-toc-target="ch-${ch.chapter_number}">${initialChapterPageMap[ch.chapter_number] || "--"}</span>
        </li>
      `
        )
        .join("")}
    </ul>
  </div>

  <!-- Apresentação da Obra -->
  <section class="chapter-container" id="chapter-intro" data-chapter-target="intro">
    <span class="editorial-page-anchor" data-anchor-id="intro">[[PAGEREF:intro]]</span>
    ${introHtml.includes("<h1") ? "" : '<h1 class="chapter-title">Apresentação da Obra</h1>'}
    <div class="chapter-content">
      ${introHtml}
    </div>
  </section>

  <!-- Chapters -->
  ${parsedChaptersHtml}

  <!-- Quarta Capa (Contracapa Final da Obra com Título em Linhas Individuais) -->
  <div class="quarta-capa-page" id="quarta-capa">
    <span class="editorial-page-anchor" data-anchor-id="quarta-capa">[[PAGEREF:quarta-capa]]</span>
    <div class="contracapa-title-container">
      ${formatTitleWordsInLines(book.title)}
    </div>
    <div class="quarta-capa-author">Por <strong>${escapeHtml(book.author_name)}</strong></div>
    <div class="quarta-capa-synopsis">
      ${escapeHtml(book.executive_summary || "Um tratado analítico indispensável para profissionais que exigem rigor conceitual e aplicação prática comprovada.")}
    </div>
    <div class="quarta-capa-footer">
      <div class="quarta-capa-badge">EDIÇÃO ESPECIAL DE ALTA PERFORMANCE</div>
      <div class="quarta-capa-meta">Publicação Comercial Digital • Todos os direitos reservados</div>
    </div>
  </div>
</body>
</html>`;

  const latencyMs = Date.now() - startTime;

  updateTask(taskId, {
    status: "completed",
    output_payload: JSON.stringify({ totalWords, estimatedPages }),
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: latencyMs,
    finished_at: new Date().toISOString(),
  });

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: book.id,
    chapter_id: null,
    agent_role: "DESIGNER",
    level: "info",
    message: `Diagramação concluída com sucesso. Manuscrito unificado (${totalWords} palavras, ~${estimatedPages} páginas estimadas).`,
    metadata: JSON.stringify({
      totalWords,
      estimatedPages,
      typography,
      spacing,
    }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: latencyMs,
    skill_badge: "book-designer",
    timestamp: new Date().toISOString(),
  });

  return {
    htmlContent: fullHtml,
    markdownManuscript: fullMarkdown,
    totalWords,
    estimatedPages,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeCssString(str: string): string {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

function sanitizeEditorialHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    // Strip dangerous tags completely, leaving svg, figure, table, etc. safe
    .replace(/<\s*(script|iframe|object|embed|applet|form|base|link|meta)\b[^>]*>.*?<\s*\/\s*\1\s*>/gis, "")
    .replace(/<\s*(script|iframe|object|embed|applet|form|base|link|meta)\b[^>]*>/gis, "")
    // Strip dangerous event handler attributes
    .replace(/\s+on\w+\s*=\s*(['"]).*?\1/gis, "")
    .replace(/\s+on\w+\s*=\s*[^>\s]+/gis, "")
    // Strip javascript: pseudoprotocol
    .replace(/href\s*=\s*(['"])javascript:.*?\1/gis, 'href="#"')
    // Remove any accidental mention of Antigravity in user-facing book text
    .replace(/\bAntigravity\b/gi, "");
}

export const designAndFormatBook = formatEbookManuscript;
