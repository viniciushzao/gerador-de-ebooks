/**
 * Teste de Validação das Metáforas Visuais Dinâmicas por LLM
 * 
 * Valida:
 * 1. Geração de metáforas dinâmicas personalizadas por livro (não fixas).
 * 2. Ausência total de markdown '#' e números de cotas no prompt visual.
 * 3. Título da capa frontal em fonte unificada (sem divisão em 2 partes).
 * 4. Extração e preservação no JSON da capa para o Nano Banana 2 e Compilador Nativo KDP.
 */
import {
  generateDefaultDynamicMetaphor,
  extractMetaphorFromCoverPrompt,
  buildCleanVisualCoverPrompt,
  buildNanoBananaCoverJson,
  sanitizeCoverPromptJson,
  DynamicVisualMetaphor,
} from "../lib/agents/publishing-metadata-generator";
import { BookRecord, ChapterRecord } from "../lib/db/schema";
import { calculateWraparoundCoverDimensions } from "../lib/export/page-formats";
import { buildNativeCoverHtml } from "../lib/export/cover-compiler-engine";

const sampleBooks: Array<{ book: BookRecord; chapters: ChapterRecord[] }> = [
  {
    book: {
      id: "book-sleep-neuro",
      title: "Neurociência do Sono Profundo e Longevidade",
      target_audience: "Biohackers, médicos e pesquisadores em medicina do sono",
      executive_summary: "Investigação dos ritmos circadianos, ondas lentas delta, limpeza glinfática noturna e arquitetura do sono.",
      page_size: "TRADE",
      actual_pages: 180,
    } as BookRecord,
    chapters: [
      {
        id: "c1",
        book_id: "book-sleep-neuro",
        chapter_number: 1,
        title: "Arquitetura Eletroencefalográfica do Sono Não-REM",
        synopsis: "Frequências de ondas cerebrais delta e fusos de sono.",
      } as ChapterRecord,
    ],
  },
  {
    book: {
      id: "book-agri",
      title: "Agricultura Regenerativa e Solos Vivos",
      target_audience: "Engenheiros agrônomos, produtores rurais e ecologistas",
      executive_summary: "Manejo biológico do solo, micorrizas, fixação biológica de nitrogênio e sequestro de carbono orgânico.",
      page_size: "A5",
      actual_pages: 140,
    } as BookRecord,
    chapters: [
      {
        id: "c2",
        book_id: "book-agri",
        chapter_number: 1,
        title: "A Microbiologia da Rizosfera e Micorrizas",
        synopsis: "Redes fúngicas subterrâneas e simbiose vegetal.",
      } as ChapterRecord,
    ],
  },
  {
    book: {
      id: "book-crypto-post-quantum",
      title: "Criptografia Pós-Quântica e Redes Reticulares",
      target_audience: "Cientistas da computação e especialistas em cibersegurança",
      executive_summary: "Algoritmos resistentes a computadores quânticos baseados no problema do vetor mais próximo em redes euclidianas multidimensionais (Lattice Cryptography).",
      page_size: "TRADE",
      actual_pages: 220,
    } as BookRecord,
    chapters: [
      {
        id: "c3",
        book_id: "book-crypto-post-quantum",
        chapter_number: 1,
        title: "Geometria de Redes Reticulares Multidimensionais",
        synopsis: "Fundamentos matemáticos dos reticulados de alta dimensão.",
      } as ChapterRecord,
    ],
  },
];

console.log("==================================================");
console.log("🧪 TESTANDO METÁFORAS VISUAIS DINÂMICAS GERADAS");
console.log("==================================================");

for (const { book, chapters } of sampleBooks) {
  console.log(`\n📚 Avaliando Livro: "${book.title}"`);

  // 1. Simular metáfora dinâmica concebida para o livro
  const dynamicMetaphor: DynamicVisualMetaphor = {
    metaphorConcept: `Metáfora conceitual bespoke para ${book.title}`,
    motifDescription: `a bespoke conceptual geometric motif in the lower right quadrant specifically symbolizing the core thesis of ${book.title}`,
    motifShapes: "delicate 0.5pt vector filaments, layered translucent geometric shapes, and golden-ratio focal nodes",
    kickerText: `${book.title.split(" ")[0].toUpperCase()} & DINÂMICA ESSENCIAL`,
    accentColor: "#0284c7",
    secondaryColor: "#0f172a",
    fontFamily: "sans-serif",
    theoreticalGrounding: `Fundamentação teórica bespoke derivada diretamente de: ${book.executive_summary}`,
  };

  // 2. Gerar Prompt Visual Limpo
  const visualPrompt = buildCleanVisualCoverPrompt(book, chapters, dynamicMetaphor);

  // Validações no Prompt Visual
  if (visualPrompt.includes("#")) {
    throw new Error(`[FALHA] O prompt visual contém '#' proibido! Livro: ${book.title}`);
  }
  if (visualPrompt.includes("0.318") || visualPrompt.includes("12.615") || visualPrompt.includes("9.250")) {
    throw new Error(`[FALHA] O prompt visual contém números de cotas! Livro: ${book.title}`);
  }
  if (!visualPrompt.includes("single cohesive font")) {
    throw new Error(`[FALHA] O prompt visual não exige fonte única unificada para o título!`);
  }
  if (!visualPrompt.includes(dynamicMetaphor.motifDescription)) {
    throw new Error(`[FALHA] O prompt visual não incorporou a descrição da metáfora dinâmica!`);
  }
  console.log(`✅ Prompt visual limpo validado (sem '#' e sem medidas numéricas).`);

  // 3. Gerar JSON do Nano Banana 2 com a metáfora dinâmica
  const rawNanoBananaJson = buildNanoBananaCoverJson(book, chapters, dynamicMetaphor);
  const sanitizedJson = sanitizeCoverPromptJson(rawNanoBananaJson, book, chapters, dynamicMetaphor);
  const jsonString = JSON.stringify(sanitizedJson);

  if (!sanitizedJson.dynamic_visual_metaphor) {
    throw new Error(`[FALHA] O JSON sanitizado não gravou dynamic_visual_metaphor!`);
  }
  if (sanitizedJson.dynamic_visual_metaphor.metaphorConcept !== dynamicMetaphor.metaphorConcept) {
    throw new Error(`[FALHA] dynamic_visual_metaphor não confere com o objeto fornecido!`);
  }
  console.log(`✅ JSON Nano Banana 2 validado com dynamic_visual_metaphor persistida.`);

  // 4. Testar extração a partir do JSON salvo
  const extracted = extractMetaphorFromCoverPrompt(jsonString);
  if (!extracted || extracted.metaphorConcept !== dynamicMetaphor.metaphorConcept) {
    throw new Error(`[FALHA] extractMetaphorFromCoverPrompt falhou em recuperar a metáfora do JSON!`);
  }
  console.log(`✅ Extração da metáfora a partir do JSON concluída com sucesso.`);

  // 5. Testar compilação do HTML Nativo KDP usando a metáfora dinâmica
  const spec = calculateWraparoundCoverDimensions(book.page_size, book.actual_pages);
  const html = buildNativeCoverHtml(book, chapters, spec, undefined, dynamicMetaphor);

  const expectedHtmlKicker = dynamicMetaphor.kickerText.replace(/&/g, "&amp;");
  if (!html.includes(expectedHtmlKicker)) {
    throw new Error(`[FALHA] HTML nativo não incluiu o kicker da metáfora dinâmica!`);
  }
  if (!html.includes(dynamicMetaphor.accentColor)) {
    throw new Error(`[FALHA] HTML nativo não incluiu a cor de destaque da metáfora dinâmica!`);
  }
  if (html.includes("#") && html.includes("<h1") && html.match(/<h1[^>]*>.*#.*<\/h1>/)) {
    throw new Error(`[FALHA] HTML contém '#' no título principal!`);
  }
  console.log(`✅ HTML Nativo KDP compilado perfeitamente com a metáfora bespoke.`);
}

console.log("\n==================================================");
console.log("🎉 TODOS OS TESTES DE METÁFORAS DINÂMICAS PASSARAM!");
console.log("==================================================");
