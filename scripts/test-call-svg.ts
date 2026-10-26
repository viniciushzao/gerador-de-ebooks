import { generateBespokeCoverSvg } from "../lib/export/cover-compiler-engine";
import { generateDynamicBookMetaphor } from "../lib/agents/publishing-metadata-generator";
import { getBook, getChapters } from "../lib/db/client";

async function test() {
  const book = getBook("book_1791302151884_p9t6f8");
  if (!book) {
    console.log("Livro não encontrado!");
    return;
  }
  const chapters = getChapters("book_1791302151884_p9t6f8");
  console.log("Livro:", book.title);
  console.log("Gerando metaphor...");
  const metaphor = await generateDynamicBookMetaphor(book, chapters);
  console.log("Metaphor gerada:", metaphor.kickerText);
  console.log("Chamando generateBespokeCoverSvg...");
  const svg = await generateBespokeCoverSvg(book, chapters, metaphor);
  console.log("SVG gerado?", !!svg, "Tamanho:", svg ? svg.length : 0);
  if (svg) {
    console.log("Snippet do SVG:", svg.slice(0, 300));
  }
}
test().catch(console.error);
