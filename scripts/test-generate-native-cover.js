const { generateAndSaveNativeKdpCover } = require('./lib/export/cover-compiler-engine');
const { getBookById, getChapters } = require('./lib/db/client');
const fs = require('fs');

async function test() {
  const targetId = 'book_1791302151884_p9t6f8';
  const book = getBookById(targetId);
  if (!book) {
    console.error('Livro não encontrado');
    return;
  }
  const chapters = getChapters(targetId);

  console.log('Iniciando geração da capa oficial KDP nativa com Gemini 3.8 Flash para:', book.title);
  const t0 = Date.now();
  const res = await generateAndSaveNativeKdpCover(book, chapters, 163);
  console.log('Finalizado em', Date.now() - t0, 'ms. Sucesso:', res.success);
  console.log('PDF gerado:', res.pdfPath, 'Existe:', fs.existsSync(res.pdfPath || ''));
  console.log('PNG gerado:', res.pngPath, 'Existe:', fs.existsSync(res.pngPath || ''));
  if (res.dimensions) {
    console.log('Dimensões:', res.dimensions.widthInches, 'x', res.dimensions.heightInches, 'polegadas @ 300 DPI');
    console.log('Resolução em pixels:', res.dimensions.widthPx, 'x', res.dimensions.heightPx, 'px');
  }
}

test().catch(console.error);
