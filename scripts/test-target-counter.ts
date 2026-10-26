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
        .toc::after { content: " " target-counter(attr(href), page); }
        .page { page-break-before: always; }
      </style>
    </head>
    <body>
      <a class="toc" href="#c1">Capitulo 1</a>
      <div class="page" id="c1">Pagina 2 Conteudo</div>
    </body>
    </html>
  `;
  await page.setContent(html);
  const pdf = Buffer.from(await page.pdf({ format: "A4" }));
  const p = await pdfParse(pdf);
  console.log("Parsed text:", JSON.stringify(p.text));
  await browser.close();
}

main().catch(console.error);
