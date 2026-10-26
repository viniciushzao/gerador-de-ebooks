import fs from "fs";
import { calculateWraparoundCoverDimensions } from "../lib/export/page-formats";
import { buildNativeCoverHtml, getThematicCoverSvg, compileCoverHtmlToFiles } from "../lib/export/cover-compiler-engine";

async function main() {
  const db = JSON.parse(fs.readFileSync("data/ebook_generator_db.json", "utf8"));
  const book = db.books["book_1791302151884_p9t6f8"];
  const chapters = Object.values(db.chapters || {}).filter((c: any) => c.book_id === book.id) as any[];
  
  console.log("Book:", book.title);
  const spec = calculateWraparoundCoverDimensions(book.page_size, book.actual_pages || 162);
  const thematic = getThematicCoverSvg(book, chapters);
  console.log("Thematic kicker:", thematic.kickerText);
  console.log("Thematic svgGraphic length:", thematic.svgGraphic.length);

  const html = buildNativeCoverHtml(book, chapters, spec);
  fs.writeFileSync("test_motores.html", html);
  console.log("HTML gravado em test_motores.html. Contém <svg>?", html.includes("<svg"));
  console.log("Contém front-graphic-container?", html.includes("front-graphic-container"));

  // Vamos compilar com Puppeteer para ver se a imagem renderiza ou se algo fica branco
  const result = await compileCoverHtmlToFiles(html, spec, "debug_motores");
  console.log("PNG compilado:", result.pngPath);
  console.log("Tamanho do PNG:", fs.statSync(result.pngPath).size);
}

main().catch(console.error);
