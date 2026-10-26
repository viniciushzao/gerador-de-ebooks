import puppeteer from "puppeteer";
import pdfParse from "pdf-parse";

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @page { size: A4; margin: 20mm; }
        .page { page-break-before: always; }
        .marker {
          color: transparent;
          font-size: 0.1pt;
          line-height: 0;
          display: inline-block;
          user-select: none;
        }
      </style>
    </head>
    <body>
      <div id="cover">
        <h1>Capa do Livro</h1>
      </div>
      <div class="page" id="toc">
        <h2>Sumário Geral</h2>
        <p>Apresentação: <span id="toc-intro">?</span></p>
        <p>Capítulo 1: <span id="toc-ch-1">?</span></p>
        <p>Capítulo 2: <span id="toc-ch-2">?</span></p>
      </div>
      <div class="page" id="intro">
        <span class="marker">[[PAGEREF:intro]]</span>
        <h2>Apresentação da Obra</h2>
        <p>Texto da apresentação...</p>
      </div>
      <div class="page" id="ch-1">
        <span class="marker">[[PAGEREF:ch-1]]</span>
        <h2>Capítulo 1: Começo</h2>
        <p>Texto do capítulo 1...</p>
      </div>
      <div class="page" id="ch-2">
        <span class="marker">[[PAGEREF:ch-2]]</span>
        <h2>Capítulo 2: Avançado</h2>
        <p>Texto do capítulo 2...</p>
      </div>
    </body>
    </html>
  `;
  await page.setContent(html);
  const pdfBuffer = Buffer.from(await page.pdf({ format: "A4" }));

  const pageTexts: Record<number, string> = {};
  await pdfParse(pdfBuffer, {
    pagerender: (pd: any) =>
      pd.getTextContent().then((tc: any) => {
        const t = tc.items.map((i: any) => i.str).join(" ");
        pageTexts[pd.pageNumber] = t;
        return t;
      }),
  });

  console.log("Pages extracted:");
  for (const [p, text] of Object.entries(pageTexts)) {
    console.log(`Page ${p}: ${text.trim()}`);
  }

  const map: Record<string, number> = {};
  for (const [p, text] of Object.entries(pageTexts)) {
    const matches = text.matchAll(/\[\[PAGEREF:([a-zA-Z0-9_-]+)\]\]/g);
    for (const m of matches) {
      map[m[1]] = parseInt(p, 10);
    }
  }

  console.log("\nDetected Section Map:", map);
  await browser.close();
}

main().catch(console.error);
