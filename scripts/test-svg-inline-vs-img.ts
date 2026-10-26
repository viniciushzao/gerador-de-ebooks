import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function testPdfImageRendering() {
  console.log('=== TESTANDO RENDERIZAÇÃO DE SVG NO PUPPETEER ===');

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
      <rect width="1200" height="720" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
      <text x="40" y="55" font-family="Georgia, serif" font-size="24" font-weight="bold" fill="#0f172a">Teste de Visualização Editorial</text>
      <foreignObject x="40" y="100" width="300" height="200">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Georgia, serif; font-size: 16px; color: #334155; line-height: 1.4;">
          Texto dentro do foreignObject para verificar se renderiza no Puppeteer.
        </div>
      </foreignObject>
    </svg>
  `.trim();

  const b64 = Buffer.from(svgContent).toString('base64');

  const htmlWithImg = `
    <!DOCTYPE html>
    <html>
    <head><style>figure { border: 1px solid #ccc; padding: 10px; margin: 20px; }</style></head>
    <body>
      <h1>Teste 1: Via &lt;img src="data:image/svg+xml;base64,..."&gt;</h1>
      <figure class="editorial-image">
        <img src="data:image/svg+xml;base64,${b64}" style="max-width: 100%; height: auto;" />
        <figcaption>Legenda via img</figcaption>
      </figure>

      <h1>Teste 2: Via Inline &lt;svg&gt; direto no HTML</h1>
      <figure class="editorial-image">
        ${svgContent}
        <figcaption>Legenda via inline svg</figcaption>
      </figure>
    </body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setContent(htmlWithImg, { waitUntil: ['load'] });

  const testPdfPath = path.join(process.cwd(), 'data', 'output', 'test_render.pdf');
  await page.pdf({ path: testPdfPath, format: 'A5', printBackground: true });
  await browser.close();

  console.log('PDF de teste gerado em:', testPdfPath);
}

testPdfImageRendering().catch(console.error);
