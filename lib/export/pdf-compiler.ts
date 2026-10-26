import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import pdfParse from "pdf-parse";
import { createTask, updateTask, addAuditLog, updateBook } from "@/lib/db/client";
import { getPageFormatSpec } from "@/lib/export/page-formats";

export async function compileHtmlToPdf(
  bookId: string,
  htmlContent: string,
  traceId: string,
  parentTaskId: string,
  pageSize?: string
): Promise<string> {
  const startTime = Date.now();
  const taskId = `task_pdf_${bookId}_${Date.now()}`;
  const pageSpec = getPageFormatSpec(pageSize);

  createTask({
    id: taskId,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: bookId,
    chapter_id: null,
    agent_role: "DESIGNER",
    status: "running",
    input_payload: JSON.stringify({ bookId, pageSize: pageSpec.id, pageSizeName: pageSpec.name }),
    output_payload: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_used: "pdf-compiler",
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
    message: `Skill [pdf-compiler]: Iniciando renderização e compilação do arquivo PDF editorial (${pageSpec.name}).`,
    metadata: JSON.stringify({ bookId, pageSize: pageSpec.id, pageSizeName: pageSpec.name }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: "pdf-compiler",
    timestamp: new Date().toISOString(),
  });

  const outputDir = path.join(process.cwd(), "data", "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pdfFileName = `ebook_${bookId}_${Date.now()}.pdf`;
  const pdfFilePath = path.join(outputDir, pdfFileName);

  let physicalPageMap: Record<string, number> = {};
  let browser: any = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    const page = await browser.newPage();
    // Prevenção estrita de XSS/SSRF no headless browser
    await page.setJavaScriptEnabled(false);
    await page.setContent(htmlContent, {
      waitUntil: ["load", "networkidle0"],
    });

    const basePdfOptions: any = {
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: pageSpec.margins.top,
        bottom: pageSpec.margins.bottom,
        left: pageSpec.margins.left,
        right: pageSpec.margins.right,
      },
    };

    if (pageSpec.puppeteerFormat) {
      basePdfOptions.format = pageSpec.puppeteerFormat;
    } else {
      basePdfOptions.width = pageSpec.puppeteerWidth;
      basePdfOptions.height = pageSpec.puppeteerHeight;
    }

    // PASSO 1: Renderiza PDF de sondagem em memória para aferição física milimétrica das páginas
    const probeBuffer = await page.pdf(basePdfOptions);

    const pageTexts: Record<number, string> = {};
    let probeTotalPages = 0;
    try {
      const probeParsed = await pdfParse(probeBuffer, {
        pagerender: (pageData: any) => {
          return pageData.getTextContent().then((textContent: any) => {
            let text = "";
            for (const item of textContent.items) {
              text += (item.str || "") + " ";
            }
            pageTexts[pageData.pageNumber] = text;
            return text;
          });
        },
      });
      probeTotalPages = probeParsed.numpages || Object.keys(pageTexts).length;
    } catch (parseErr) {
      console.warn("Aviso na extração de texto do probeBuffer:", parseErr);
    }

    // Mapear páginas físicas reais de cada seção via Micro-Âncoras Unívocas [[PAGEREF:id]]
    physicalPageMap = {};
    const totalPagesToCheck = probeTotalPages || Object.keys(pageTexts).length;

    for (let p = 1; p <= totalPagesToCheck; p++) {
      const t = pageTexts[p] || "";
      // Busca unívoca por micro-âncoras (100% imune a títulos repetidos no Sumário Geral)
      const matches = t.matchAll(/\[\[PAGEREF:([a-zA-Z0-9_-]+)\]\]/g);
      for (const match of matches) {
        const targetKey = match[1];
        if (!physicalPageMap[targetKey]) {
          physicalPageMap[targetKey] = p;
        }
      }
    }

    // Fallback de contingência inteligente: caso alguma âncora não seja extraída,
    // varrer os títulos ignorando categoricamente as páginas do Sumário Geral.
    let lastTocPage = 2;
    for (let p = 1; p <= totalPagesToCheck; p++) {
      if ((pageTexts[p] || "").includes("Sumário Geral")) {
        lastTocPage = p;
      }
    }

    if (!physicalPageMap["intro"]) {
      for (let p = lastTocPage + 1; p <= totalPagesToCheck; p++) {
        if (/Apresentação\s+da\s+Obra/i.test(pageTexts[p] || "")) {
          physicalPageMap["intro"] = p;
          break;
        }
      }
      if (!physicalPageMap["intro"]) {
        physicalPageMap["intro"] = lastTocPage + 1;
      }
    }

    // PASSO 2: Injetar os números de páginas físicas no DOM do Puppeteer antes de imprimir o PDF final
    if (Object.keys(physicalPageMap).length > 0) {
      await page.evaluate((mapping: Record<string, number>) => {
        for (const [key, physicalPage] of Object.entries(mapping)) {
          const el =
            document.getElementById(`toc-page-${key}`) ||
            document.querySelector(`[data-toc-target="${key}"]`);
          if (el) {
            el.textContent = String(physicalPage);
          }
        }
      }, physicalPageMap);
    }

    // Gerar o arquivo PDF final com o sumário 100% calibrado
    await page.pdf({
      ...basePdfOptions,
      path: pdfFilePath,
    });

    await browser.close();
  } catch (err: any) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    updateTask(taskId, {
      status: "failed",
      error: err.message || String(err),
      latency_ms: Date.now() - startTime,
      finished_at: new Date().toISOString(),
    });
    throw new Error(`Falha ao compilar PDF via Puppeteer: ${err.message || err}`);
  }

  let actualPages: number | null = null;
  try {
    const pdfBuffer = fs.readFileSync(pdfFilePath);
    const parsedPdf = await pdfParse(pdfBuffer);
    actualPages = parsedPdf.numpages || null;
  } catch (err) {
    // Silently fall back if pdf parsing encounters issue
  }

  const latencyMs = Date.now() - startTime;

  updateTask(taskId, {
    status: "completed",
    output_payload: JSON.stringify({ pdfPath: pdfFilePath, pdfFileName, actualPages }),
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
    message: `Skill [pdf-compiler]: PDF compilado e sumário calibrado fisicamente via 2-pass rendering (${pdfFileName}${actualPages ? `, ${actualPages} páginas físicas geradas` : ""}).`,
    metadata: JSON.stringify({ pdfFilePath, pdfFileName, actualPages, latencyMs, physicalPageMap }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: latencyMs,
    skill_badge: "pdf-compiler",
    timestamp: new Date().toISOString(),
  });

  updateBook(bookId, {
    pdf_path: pdfFilePath,
    actual_pages: actualPages,
  });

  return pdfFilePath;
}
