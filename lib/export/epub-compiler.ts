import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { BookRecord, ChapterRecord } from "@/lib/db/schema";
import { createTask, updateTask, addAuditLog, updateBook, getBook, getChapters } from "@/lib/db/client";
import { formatMarkdownToEditorialHtml } from "@/lib/agents/designer-formatter";

// Mapa em memória para desduplicação de requisições concorrentes de compilação EPUB
const activeCompilations = new Map<string, Promise<string>>();

export interface EpubCompilerOptions {
  bookId: string;
  traceId: string;
  parentTaskId: string;
  bookData?: BookRecord;
  chaptersData?: ChapterRecord[];
}

/**
 * Compila o livro para formato EPUB 3 (com camada retrocompatível EPUB 2 NCX)
 * utilizando o padrão de desduplicação de concorrência por bookId.
 */
export async function compileBookToEpubDeduplicated(
  bookId: string,
  traceId: string,
  parentTaskId: string,
  bookData?: BookRecord,
  chaptersData?: ChapterRecord[]
): Promise<string> {
  const existing = activeCompilations.get(bookId);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    try {
      return await compileBookToEpub(bookId, traceId, parentTaskId, bookData, chaptersData);
    } finally {
      activeCompilations.delete(bookId);
    }
  })();

  activeCompilations.set(bookId, task);
  return task;
}

/**
 * Compilador Nativo de EPUB 3 em TypeScript puro.
 * Constrói o container OCF (Open Container Format), particiona capítulos em XHTML5 estrito,
 * extrai figuras vetoriais SVG e empacota via JSZip sem dependências externas de binários.
 */
export async function compileBookToEpub(
  bookId: string,
  traceId: string,
  parentTaskId: string,
  bookData?: BookRecord,
  chaptersData?: ChapterRecord[]
): Promise<string> {
  const startTime = Date.now();
  const taskId = `task_epub_${bookId}_${Date.now()}`;

  const book = bookData || getBook(bookId);
  if (!book) {
    throw new Error(`Livro ID ${bookId} não encontrado para compilação EPUB.`);
  }

  const rawChapters = chaptersData || getChapters(bookId);
  const chapters = [...rawChapters].sort((a, b) => a.chapter_number - b.chapter_number);

  createTask({
    id: taskId,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: bookId,
    chapter_id: null,
    agent_role: "DESIGNER",
    status: "running",
    input_payload: JSON.stringify({ bookId, totalChapters: chapters.length }),
    output_payload: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_used: "epub-compiler",
    error: null,
    created_at: new Date().toISOString(),
    finished_at: null,
  });

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: bookId,
    chapter_id: null,
    agent_role: "DESIGNER",
    level: "skill_call",
    message: `Skill [epub-compiler]: Iniciando geração do container EPUB 3 reflowable (${chapters.length} capítulos).`,
    metadata: JSON.stringify({ bookId, title: book.title, chaptersCount: chapters.length }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: "epub-compiler",
    timestamp: new Date().toISOString(),
  });

  const outputDir = path.join(process.cwd(), "data", "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const epubFileName = `ebook_${bookId}_${Date.now()}.epub`;
  const epubFilePath = path.join(outputDir, epubFileName);
  const tempFilePath = path.join(outputDir, `${epubFileName}.${Date.now()}.tmp`);

  try {
    const zip = new JSZip();

    // 1. O arquivo mimetype DEVE ser o primeiro arquivo no ZIP e armazenado SEM compressão (STORE)
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

    // 2. Metadados do container OCF
    zip.file("META-INF/container.xml", generateContainerXml());

    // 3. Estilos CSS Reflowable com suporte nativo a Dark Mode
    const stylesCss = buildEpubStyles(book.typography, book.spacing);
    zip.file("OEBPS/styles.css", stylesCss);

    // 4. Processamento dos capítulos, extração de SVGs e preparação dos documentos XHTML5
    const extractedImages: Array<{ filename: string; content: string; id: string }> = [];
    const chapterEntries: Array<{ id: string; filename: string; title: string; chapterNumber: number }> = [];

    // 4.1. Capa
    const coverXhtml = generateCoverXhtml(book.title, book.author_name);
    zip.file("OEBPS/text/cover.xhtml", coverXhtml);

    // 4.2. Apresentação da Obra (se existir)
    if (book.executive_summary && book.executive_summary.trim().length > 0) {
      const summaryClean = formatMarkdownToEditorialHtml(book.executive_summary);
      const presentationXhtml = generatePresentationXhtml(book.title, summaryClean);
      zip.file("OEBPS/text/presentation.xhtml", presentationXhtml);
    }

    // 4.3. Capítulos individuais
    for (const ch of chapters) {
      const cleanHtml = formatMarkdownToEditorialHtml(ch.content_markdown || "");
      const { sanitizedHtml, svgs } = extractAndExternalizeSvgs(cleanHtml, ch.chapter_number);

      for (const svg of svgs) {
        extractedImages.push(svg);
        zip.file(`OEBPS/${svg.filename}`, svg.content);
      }

      const chapterFilename = `text/chapter_${ch.chapter_number}.xhtml`;
      const chapterId = `chapter_${ch.chapter_number}`;
      const fullChapterXhtml = generateChapterXhtml(
        book.title,
        ch.chapter_number,
        ch.title,
        sanitizedHtml
      );

      zip.file(`OEBPS/${chapterFilename}`, fullChapterXhtml);
      chapterEntries.push({
        id: chapterId,
        filename: chapterFilename,
        title: ch.title,
        chapterNumber: ch.chapter_number,
      });
    }

    // 5. Gerações de Navegação e Manifesto
    const hasPresentation = !!(book.executive_summary && book.executive_summary.trim().length > 0);

    const contentOpf = generateContentOpf(
      book,
      chapterEntries,
      extractedImages,
      hasPresentation
    );
    zip.file("OEBPS/content.opf", contentOpf);

    const tocXhtml = generateTocXhtml(book.title, chapterEntries, hasPresentation);
    zip.file("OEBPS/toc.xhtml", tocXhtml);

    const tocNcx = generateTocNcx(book.id, book.title, book.author_name, chapterEntries, hasPresentation);
    zip.file("OEBPS/toc.ncx", tocNcx);

    // 6. Geração do Buffer binário com compressão DEFLATE máxima
    const epubBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
      mimeType: "application/epub+zip",
    });

    // 7. Gravação Atômica no Windows (grava em .tmp e renomeia para evitar leituras parciais concorrentes)
    fs.writeFileSync(tempFilePath, epubBuffer);

    try {
      if (fs.existsSync(epubFilePath)) {
        fs.unlinkSync(epubFilePath);
      }
      fs.renameSync(tempFilePath, epubFilePath);
    } catch (renameErr) {
      // Fallback para ambientes com lock temporário de arquivo no Windows
      fs.copyFileSync(tempFilePath, epubFilePath);
      try {
        fs.unlinkSync(tempFilePath);
      } catch {}
    }

    // Validação de integridade física final
    if (!fs.existsSync(epubFilePath) || fs.statSync(epubFilePath).size === 0) {
      throw new Error("Falha na persistência física do arquivo EPUB gerado.");
    }

    const latencyMs = Date.now() - startTime;

    updateTask(taskId, {
      status: "completed",
      output_payload: JSON.stringify({ epubPath: epubFilePath, epubFileName }),
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
      book_id: bookId,
      chapter_id: null,
      agent_role: "DESIGNER",
      level: "skill_call",
      message: `Skill [epub-compiler]: EPUB 3 compilado com sucesso (${epubFileName}, ${chapters.length} capítulos, ${extractedImages.length} figuras).`,
      metadata: JSON.stringify({ epubFilePath, epubFileName, chaptersCount: chapters.length, latencyMs }),
      tokens: 0,
      cost_usd: 0,
      latency_ms: latencyMs,
      skill_badge: "epub-compiler",
      timestamp: new Date().toISOString(),
    });

    updateBook(bookId, {
      epub_path: epubFilePath,
    });

    return epubFilePath;
  } catch (err: any) {
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {}
    }

    updateTask(taskId, {
      status: "failed",
      error: err.message || String(err),
      latency_ms: Date.now() - startTime,
      finished_at: new Date().toISOString(),
    });

    throw err;
  }
}

/**
 * Sanitiza HTML para XML/XHTML5 estrito, corrigindo auto-fechamento de tags,
 * convertendo entidades nomeadas para numéricas e escapando caracteres reservados.
 */
export function sanitizeToXhtml(html: string): string {
  if (!html) return "";

  let clean = html;

  // 1. Fechar tags void que não possuem fechamento no HTML convencional
  clean = clean.replace(/<(img|br|hr|input|meta|link)\b([^>]*?)(?<!\/)>/gi, "<$1$2 />");

  // 2. Converter entidades HTML comuns para entidades numéricas Unicode (XHTML aceita apenas &amp;, &lt;, &gt;, &quot;, &apos;)
  const entityMap: Record<string, string> = {
    "&nbsp;": "&#160;",
    "&mdash;": "&#8212;",
    "&ndash;": "&#8211;",
    "&ldquo;": "&#8220;",
    "&rdquo;": "&#8221;",
    "&lsquo;": "&#8216;",
    "&rsquo;": "&#8217;",
    "&hellip;": "&#8230;",
    "&laquo;": "&#171;",
    "&raquo;": "&#187;",
    "&bull;": "&#8226;",
    "&copy;": "&#169;",
    "&reg;": "&#174;",
    "&trade;": "&#8482;",
  };

  for (const [entity, replacement] of Object.entries(entityMap)) {
    clean = clean.split(entity).join(replacement);
  }

  // 3. Escapar ampersands isolados que não façam parte de uma entidade XML válida
  clean = clean.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");

  // 4. Remover atributos booleanos sem valor atribuído (ex: <input disabled> -> <input disabled="disabled" />)
  clean = clean.replace(/\s+(required|checked|disabled|readonly|multiple|autoplay|controls|loop|selected)(?=[\s>])/gi, ' $1="$1"');

  return clean;
}

/**
 * Extrai blocos <figure><svg ...>...</svg><figcaption>...</figcaption></figure>
 * para arquivos isolados em images/ e substitui por <img src="..." /> para compatibilidade EPUB.
 */
function extractAndExternalizeSvgs(
  htmlContent: string,
  chapterNumber: number
): { sanitizedHtml: string; svgs: Array<{ filename: string; content: string; id: string }> } {
  const svgs: Array<{ filename: string; content: string; id: string }> = [];
  let figureIndex = 0;

  const sanitizedHtml = htmlContent.replace(
    /<figure[\s\S]*?<svg([\s\S]*?)<\/svg>[\s\S]*?(?:<figcaption>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/gi,
    (match, svgBody, caption) => {
      figureIndex++;
      const svgId = `fig_ch${chapterNumber}_${figureIndex}`;
      const filename = `images/${svgId}.svg`;
      const cleanCaption = (caption || "").trim();

      // Reconstrói o SVG garantindo o namespace XML obrigatório
      let rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" ${svgBody.trim()}</svg>`;
      if (!rawSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        rawSvg = rawSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      svgs.push({
        filename,
        content: rawSvg,
        id: svgId,
      });

      const escapedCaption = escapeXml(cleanCaption);
      return `<figure class="editorial-image"><img src="../${filename}" alt="${escapedCaption || "Figura Editorial"}" class="epub-figure-img" />${escapedCaption ? `<figcaption>${escapedCaption}</figcaption>` : ""}</figure>`;
    }
  );

  return {
    sanitizedHtml: sanitizeToXhtml(sanitizedHtml),
    svgs,
  };
}

/**
 * Constrói o CSS Reflowable editorial para o EPUB.
 */
function buildEpubStyles(typography?: string, spacing?: number): string {
  let fontFamily = "Garamond, 'Times New Roman', Georgia, serif";
  if (typography && typography.toLowerCase().includes("baskerville")) {
    fontFamily = "Baskerville, 'Baskerville Old Face', Georgia, serif";
  } else if (typography && typography.toLowerCase().includes("palatino")) {
    fontFamily = "'Palatino Linotype', Palatino, Georgia, serif";
  } else if (typography && typography.toLowerCase().includes("georgia")) {
    fontFamily = "Georgia, serif";
  }

  const lineHeight = spacing && spacing >= 1.2 ? spacing : 1.4;

  return `
@charset "UTF-8";

/* Estilos Globais Reflowable para Leitores EPUB 3 */
body {
  font-family: ${fontFamily};
  font-size: 1em;
  line-height: ${lineHeight};
  margin: 5% 5% 5% 5%;
  text-align: justify;
  hyphens: auto;
  -webkit-hyphens: auto;
  color: #1a1a1a;
  background-color: transparent;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.25;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
  break-after: avoid;
  text-align: left;
}

h1 {
  font-size: 1.8em;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.3em;
  margin-top: 1em;
}

h2 {
  font-size: 1.4em;
  margin-top: 1.3em;
}

h3 {
  font-size: 1.2em;
}

p {
  margin: 0 0 0.8em 0;
  text-indent: 0;
}

blockquote {
  margin: 1.2em 0;
  padding: 0.6em 1.2em;
  border-left: 3px solid #3b82f6;
  background-color: rgba(59, 130, 246, 0.05);
  font-style: italic;
}

code, pre {
  font-family: "Courier New", Courier, monospace;
  font-size: 0.9em;
  background-color: rgba(0, 0, 0, 0.04);
}

pre {
  padding: 0.8em;
  overflow-x: auto;
  white-space: pre-wrap;
  border-radius: 4px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  font-size: 0.9em;
}

th, td {
  border: 1px solid #d1d5db;
  padding: 0.5em 0.8em;
  text-align: left;
}

th {
  background-color: rgba(0, 0, 0, 0.05);
  font-weight: bold;
}

/* Figuras e Imagens Editoriais */
figure.editorial-image {
  margin: 1.8em auto;
  text-align: center;
  max-width: 100%;
}

img.epub-figure-img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

figcaption {
  font-size: 0.85em;
  color: #555555;
  margin-top: 0.5em;
  font-style: italic;
  text-align: center;
}

/* Capa Editorial */
.cover-container {
  text-align: center;
  margin-top: 25%;
  page-break-after: always;
  break-after: page;
}

.cover-title {
  font-size: 2.2em;
  font-weight: 800;
  margin-bottom: 0.3em;
  color: #111827;
}

.cover-author {
  font-size: 1.2em;
  font-weight: 500;
  color: #4b5563;
  margin-top: 2em;
  letter-spacing: 0.05em;
}

.cover-badge {
  display: inline-block;
  font-size: 0.75em;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.3em 0.8em;
  border: 1px solid #d1d5db;
  border-radius: 9999px;
  color: #6b7280;
  margin-bottom: 2em;
}

/* Modo Escuro Nativo (Dark Mode para leitores compatíveis) */
@media (prefers-color-scheme: dark) {
  body {
    color: #e5e7eb;
    background-color: #111827;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #f9fafb;
  }
  h1 {
    border-bottom-color: #374151;
  }
  blockquote {
    border-left-color: #60a5fa;
    background-color: rgba(96, 165, 250, 0.1);
  }
  th, td {
    border-color: #374151;
  }
  th {
    background-color: rgba(255, 255, 255, 0.08);
  }
  figcaption {
    color: #9ca3af;
  }
  .cover-title {
    color: #f9fafb;
  }
  .cover-author {
    color: #d1d5db;
  }
}
`.trim();
}

function generateContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function generateContentOpf(
  book: BookRecord,
  chapters: Array<{ id: string; filename: string; title: string; chapterNumber: number }>,
  images: Array<{ filename: string; id: string }>,
  hasPresentation: boolean
): string {
  // dcterms:modified exige formato estrito YYYY-MM-DDTHH:MM:SSZ sem milissegundos
  const modifiedDate = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const bookUuid = `urn:uuid:${book.id}`;

  const manifestItems: string[] = [
    `<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="styles" href="styles.css" media-type="text/css"/>`,
    `<item id="cover" href="text/cover.xhtml" media-type="application/xhtml+xml"/>`,
  ];

  if (hasPresentation) {
    manifestItems.push(`<item id="presentation" href="text/presentation.xhtml" media-type="application/xhtml+xml"/>`);
  }

  for (const ch of chapters) {
    manifestItems.push(`<item id="${ch.id}" href="${ch.filename}" media-type="application/xhtml+xml"/>`);
  }

  for (const img of images) {
    manifestItems.push(`<item id="${img.id}" href="${img.filename}" media-type="image/svg+xml"/>`);
  }

  const spineItems: string[] = [
    `<itemref idref="cover"/>`,
  ];

  if (hasPresentation) {
    spineItems.push(`<itemref idref="presentation"/>`);
  }

  for (const ch of chapters) {
    spineItems.push(`<itemref idref="${ch.id}"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(bookUuid)}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.author_name)}</dc:creator>
    <dc:language>pt-BR</dc:language>
    <dc:publisher>Google Antigravity</dc:publisher>
    <meta property="dcterms:modified">${modifiedDate}</meta>
    ${book.executive_summary ? `<dc:description>${escapeXml(book.executive_summary.substring(0, 500))}</dc:description>` : ""}
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join("\n    ")}
  </spine>
</package>`;
}

function generateTocXhtml(
  bookTitle: string,
  chapters: Array<{ id: string; filename: string; title: string; chapterNumber: number }>,
  hasPresentation: boolean
): string {
  const navItems: string[] = [
    `<li><a href="text/cover.xhtml">Capa</a></li>`,
  ];

  if (hasPresentation) {
    navItems.push(`<li><a href="text/presentation.xhtml">Apresentação da Obra</a></li>`);
  }

  for (const ch of chapters) {
    navItems.push(`<li><a href="${ch.filename}">Capítulo ${ch.chapterNumber}: ${escapeXml(ch.title)}</a></li>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="pt-BR" lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Índice - ${escapeXml(bookTitle)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Sumário</h1>
    <ol>
      ${navItems.join("\n      ")}
    </ol>
  </nav>
</body>
</html>`;
}

function generateTocNcx(
  bookId: string,
  bookTitle: string,
  authorName: string,
  chapters: Array<{ id: string; filename: string; title: string; chapterNumber: number }>,
  hasPresentation: boolean
): string {
  let playOrder = 1;
  const navPoints: string[] = [
    `<navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
      <navLabel><text>Capa</text></navLabel>
      <content src="text/cover.xhtml"/>
    </navPoint>`,
  ];

  if (hasPresentation) {
    playOrder++;
    navPoints.push(
      `<navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
        <navLabel><text>Apresentação da Obra</text></navLabel>
        <content src="text/presentation.xhtml"/>
      </navPoint>`
    );
  }

  for (const ch of chapters) {
    playOrder++;
    navPoints.push(
      `<navPoint id="navPoint-${playOrder}" playOrder="${playOrder}">
        <navLabel><text>Capítulo ${ch.chapterNumber}: ${escapeXml(ch.title)}</text></navLabel>
        <content src="${ch.filename}"/>
      </navPoint>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${escapeXml(bookId)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(bookTitle)}</text>
  </docTitle>
  <docAuthor>
    <text>${escapeXml(authorName)}</text>
  </docAuthor>
  <navMap>
    ${navPoints.join("\n    ")}
  </navMap>
</ncx>`;
}

function generateCoverXhtml(title: string, author: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR" lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Capa</title>
  <link rel="stylesheet" type="text/css" href="../styles.css"/>
</head>
<body>
  <div class="cover-container">
    <div class="cover-badge">Edição Digital EPUB 3</div>
    <h1 class="cover-title">${escapeXml(title)}</h1>
    <div class="cover-author">${escapeXml(author)}</div>
  </div>
</body>
</html>`;
}

function generatePresentationXhtml(bookTitle: string, summaryHtml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR" lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Apresentação da Obra - ${escapeXml(bookTitle)}</title>
  <link rel="stylesheet" type="text/css" href="../styles.css"/>
</head>
<body>
  <section class="presentation-section">
    <h1>Apresentação da Obra</h1>
    ${summaryHtml}
  </section>
</body>
</html>`;
}

function generateChapterXhtml(
  bookTitle: string,
  chapterNumber: number,
  chapterTitle: string,
  contentHtml: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pt-BR" lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Capítulo ${chapterNumber}: ${escapeXml(chapterTitle)} - ${escapeXml(bookTitle)}</title>
  <link rel="stylesheet" type="text/css" href="../styles.css"/>
</head>
<body>
  <article class="chapter-article">
    ${contentHtml}
  </article>
</body>
</html>`;
}

function escapeXml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
