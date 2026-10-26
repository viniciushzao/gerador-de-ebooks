import { formatTitleWordsInLines } from "../lib/agents/designer-formatter";
import { buildNanoBananaCoverJson } from "../lib/agents/publishing-metadata-generator";
import { purgeStrategicConnections } from "../lib/agents/chapter-writer";
import { BookRecord, ChapterRecord } from "../lib/db/schema";

async function runTests() {
  console.log("=== INICIANDO TESTES DE CONTRACAPA, NANO BANANA 2 E EXPURGO DE CONEXÃO ESTRATÉGICA ===");

  // TESTE 1: Contracapa - Separação palavra por palavra em linha única
  console.log("\n[TESTE 1] Contracapa: Separação de palavras em linhas únicas");
  const sampleTitle = "Vendendo como Louco";
  const formattedTitleHtml = formatTitleWordsInLines(sampleTitle);
  console.log("Título Original:", sampleTitle);
  console.log("HTML Gerado:\n" + formattedTitleHtml);

  const lines = formattedTitleHtml.split("\n").map((l) => l.trim());
  if (lines.length !== 3) {
    throw new Error(`Esperado 3 linhas, obtido: ${lines.length}`);
  }
  if (!lines[0].includes("Vendendo") || !lines[1].includes("Como") || !lines[2].includes("Louco")) {
    throw new Error("Palavras não correspondem ao esperado.");
  }
  console.log("✅ TESTE 1 PASSOU: Cada palavra está em sua linha isolada.");

  // TESTE 2: Nano Banana 2 - Schema JSON descritivo de imagem
  console.log("\n[TESTE 2] Nano Banana 2: Validação de Schema JSON");
  const mockBook: BookRecord = {
    id: "book_test_123",
    title: "Vendendo como Louco",
    author_name: "Sabri Suby",
    target_audience: "Empreendedores e Vendedores",
    tone_of_voice: "Direto e Agressivo",
    page_size: "trade",
    min_pages: 90,
    max_pages: 120,
    executive_summary: "O sistema definitivo de vendas e geração de leads.",
    status: "completed",
    current_step: "completed",
    progress_percent: 100,
    pdf_path: null,
    actual_pages: 95,
    original_filename: "test.pdf",
    original_file_path: "/tmp/test.pdf",
    typography: "merriweather",
    spacing: 1.5,
    cover_prompt: null,
    suggested_categories: null,
    marketing_description: null,
    total_tokens: 15000,
    total_cost_usd: 0.05,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockChapters: ChapterRecord[] = [
    {
      id: "ch_1",
      book_id: "book_test_123",
      chapter_number: 1,
      title: "Mentalidade Bilionária de Vendas",
      synopsis: "Desconstrução do processo de vendas em primeiros princípios.",
      prompt: "{}",
      content_markdown: "# Capítulo 1\n\nConteúdo analítico.",
      sections: ["Introdução", "Primeiros Princípios"],
      target_words: 3000,
      actual_words: 3200,
      tokens_used: 4000,
      cost_usd: 0.01,
      latency_ms: 5000,
      status: "completed",
      error_message: null,
      trace_id: "trace_1",
      parent_task_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "ch_2",
      book_id: "book_test_123",
      chapter_number: 2,
      title: "A Oferta Irresistível do Poderoso Chefão",
      synopsis: "Estruturação de ofertas que ninguém pode recusar.",
      prompt: "{}",
      content_markdown: "# Capítulo 2\n\nConteúdo analítico.",
      sections: ["Princípios da Oferta", "Mecanismo Único"],
      target_words: 3000,
      actual_words: 3400,
      tokens_used: 4200,
      cost_usd: 0.01,
      latency_ms: 5200,
      status: "completed",
      error_message: null,
      trace_id: "trace_2",
      parent_task_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  // TESTE 2: Nano Banana 2 - Schema JSON Minimalista Assimétrico & Amigável aos Olhos Humanos
  console.log("\n[TESTE 2] Nano Banana 2: Validação de Schema Assimétrico, Amigável e com Mais Detalhes");
  const nanoBananaJson = buildNanoBananaCoverJson(mockBook, mockChapters);
  console.log("JSON Nano Banana 2 Gerado:\n", JSON.stringify(nanoBananaJson, null, 2));

  if (!nanoBananaJson.image_type || nanoBananaJson.image_type !== "book_cover") {
    throw new Error("image_type inválido.");
  }
  // REGRA 1: Tema branco puro com textura tátil
  if (nanoBananaJson.theme?.mode !== "light" || nanoBananaJson.theme?.background_color !== "#ffffff") {
    throw new Error("Tema não é branco puro ou mode não é light.");
  }
  if (!nanoBananaJson.theme?.paper_texture) {
    throw new Error("paper_texture ausente.");
  }
  // REGRA 2: Sem estrutura de cards
  if (nanoBananaJson.cards !== undefined || nanoBananaJson.layout !== undefined) {
    throw new Error("Estrutura de cards ou layout de dashboard ainda presente no JSON da capa!");
  }
  // REGRA 3: Apenas o nome do livro na tipografia
  if (nanoBananaJson.typography?.title !== mockBook.title) {
    throw new Error("Título da obra ausente ou incorreto.");
  }
  // REGRA 4: Sem nome de autor
  const jsonStr = JSON.stringify(nanoBananaJson);
  if (jsonStr.includes(mockBook.author_name)) {
    throw new Error("Nome do autor presente indevidamente no JSON da capa!");
  }
  if (nanoBananaJson.author || nanoBananaJson.author_name) {
    throw new Error("Campo author presente indevidamente.");
  }
  // REGRA 5: Sem nome de editora
  if (nanoBananaJson.publisher || nanoBananaJson.publisher_name || nanoBananaJson.publishing_house) {
    throw new Error("Campo publisher presente indevidamente.");
  }
  // REGRA 6: Design Assimétrico
  if (nanoBananaJson.typography?.title_style?.alignment !== "left") {
    throw new Error("Alinhamento tipográfico não é assimétrico (deve ser 'left').");
  }
  if (!nanoBananaJson.layout_and_composition || !nanoBananaJson.layout_and_composition.grid_structure?.includes("asymmetric")) {
    throw new Error("layout_and_composition assimétrico ausente.");
  }
  if (nanoBananaJson.visual_elements?.primary_motif?.position !== "lower_right_offset") {
    throw new Error("Ponto focal principal não está posicionado de forma assimétrica em contraponto.");
  }
  // REGRA 7: Amigável aos Olhos Humanos
  if (!nanoBananaJson.human_ergonomics || !nanoBananaJson.human_ergonomics.visual_comfort) {
    throw new Error("human_ergonomics ausente.");
  }
  // REGRA 8: Mais itens e detalhes (~10% mais itens na composição)
  if (!Array.isArray(nanoBananaJson.visual_elements?.secondary_accents) || nanoBananaJson.visual_elements.secondary_accents.length < 2) {
    throw new Error("secondary_accents ausente ou com menos de 2 elementos de precisão editorial.");
  }
  if (!nanoBananaJson.global_rules || !nanoBananaJson.global_rules.no_cards || !nanoBananaJson.global_rules.no_author) {
    throw new Error("global_rules incompletas.");
  }
  console.log("✅ TESTE 2 PASSOU: JSON Nano Banana 2 perfeitamente assimétrico, amigável aos olhos humanos, com ~10% mais detalhes e sem autor/editora/cards.");

  // TESTE 3: Expurgo de 'Conexão Estratégica'
  console.log("\n[TESTE 3] Expurgo de 'Conexão Estratégica' e transições inter-capítulos");
  const dirtyMarkdown = `
# Capítulo 3: Máquinas de Tráfego

Este capítulo aborda a geração de tráfego previsível.

## Arquitetura de Conversão
Texto explicativo profundo.

### Síntese Executiva, Erros Críticos e Conexão Estratégica
Aqui temos o resumo dos erros operacionais. No próximo capítulo abordaremos a qualificação de leads.

### Conexão Estratégica
Como veremos no próximo capítulo, o funil precisa de fechadores de elite.
`;

  const cleanedMarkdown = purgeStrategicConnections(dirtyMarkdown);
  console.log("Markdown Sanitizado:\n", cleanedMarkdown);

  if (cleanedMarkdown.toLowerCase().includes("conexão estratégica") || cleanedMarkdown.toLowerCase().includes("conexao estrategica")) {
    throw new Error("Falha no expurgo: 'Conexão Estratégica' ainda presente no texto!");
  }
  if (cleanedMarkdown.includes("No próximo capítulo abordaremos") || cleanedMarkdown.includes("Como veremos no próximo capítulo")) {
    throw new Error("Falha no expurgo: Frases de transição inter-capítulos ainda presentes!");
  }
  if (!cleanedMarkdown.includes("Síntese Crítica, Erros Críticos a Evitar e Checklist de Execução")) {
    throw new Error("Substituição correta do cabeçalho de checklist não encontrada.");
  }
  console.log("✅ TESTE 3 PASSOU: 'Conexão Estratégica' e transições 100% expurgadas.");

  // TESTE 4: Validação de Capa Única Editorial e Expurgo Absoluto de Frases de Formato
  console.log("\n[TESTE 4] Validação de Capa Única Editorial e Ausência da Frase de Formato");
  const { formatEbookManuscript } = await import("../lib/agents/designer-formatter");
  const formattedEbook = await formatEbookManuscript(mockBook, mockChapters, "test-trace", "test-parent");
  const html = formattedEbook.htmlContent;

  // 1. Apenas UMA capa inicial
  const coverMatches = html.match(/class="cover-page"/g) || [];
  if (coverMatches.length !== 1) {
    throw new Error(`Esperado exatamente 1 capa inicial (cover-page), encontrado: ${coverMatches.length}`);
  }

  // 2. Não deve haver contracapa-page separada antes do sumário
  const tocIndex = html.indexOf('id="toc-section"');
  const contracapaBeforeToc = html.substring(0, tocIndex).includes('class="contracapa-page"');
  if (contracapaBeforeToc) {
    throw new Error("Contracapa separada duplicada ainda existe antes do sumário!");
  }

  // 3. Proibição categórica da frase de formato
  if (html.includes("Edição Comercial de Referência") || html.includes("Edicao Comercial de Referencia")) {
    throw new Error("VIOLAÇÃO CRÍTICA: A frase 'Edição Comercial de Referência' foi encontrada no HTML!");
  }
  if (html.includes("Formato: Trade Book") || html.includes("Formato:")) {
    throw new Error("VIOLAÇÃO CRÍTICA: Menção 'Formato:' encontrada no HTML!");
  }

  // 4. Supressão de cabeçalho corrente na capa
  if (!html.includes("@page cover") || !html.includes("@page :first")) {
    throw new Error("Regras de CSS @page cover ou @page :first ausentes.");
  }

  // 5. Presença obrigatória das micro-âncoras nas seções
  if (!html.includes('data-anchor-id="intro">[[PAGEREF:intro]]</span>')) {
    throw new Error("Micro-âncora de intro ausente no HTML!");
  }
  if (!html.includes('data-anchor-id="ch-1">[[PAGEREF:ch-1]]</span>') || !html.includes('data-anchor-id="ch-2">[[PAGEREF:ch-2]]</span>')) {
    throw new Error("Micro-âncoras dos capítulos ausentes no HTML!");
  }

  // 6. O Sumário Geral NUNCA deve conter a string [[PAGEREF:
  const tocHtml = html.substring(tocIndex, html.indexOf('id="chapter-intro"'));
  if (tocHtml.includes("[[PAGEREF:")) {
    throw new Error("VIOLAÇÃO CRÍTICA: Micro-âncora [[PAGEREF: encontrada dentro da seção do Sumário!");
  }

  console.log("✅ TESTE 4 PASSOU: Capa Única confirmada, sem duplicatas, micro-âncoras injetadas e frase proibida eliminada.");

  // TESTE 5: Compilação Real em PDF e Aferição Física do Sumário (Calibração 2-Pass)
  console.log("\n[TESTE 5] Compilação Real em PDF e Aferição Física do Sumário (Calibração 2-Pass)");
  const { compileHtmlToPdf } = await import("../lib/export/pdf-compiler");
  const pdfPath = await compileHtmlToPdf(
    mockBook.id,
    html,
    "test_trace_calib",
    "test_parent_calib",
    mockBook.page_size
  );

  const pdfParse = (await import("pdf-parse")).default;
  const fs = await import("fs");
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pageTexts: Record<number, string> = {};

  const parsedPdf = await pdfParse(pdfBuffer, {
    pagerender: (pd: any) =>
      pd.getTextContent().then((tc: any) => {
        const t = tc.items.map((i: any) => i.str).join(" ");
        pageTexts[pd.pageNumber] = t;
        return t;
      }),
  });

  console.log(`PDF compilado com sucesso: ${parsedPdf.numpages} páginas.`);

  // Extrair números gravados na página do Sumário
  let tocPageText = "";
  for (let p = 1; p <= parsedPdf.numpages; p++) {
    if (pageTexts[p]?.includes("Sumário Geral")) {
      tocPageText = pageTexts[p];
      console.log(`Sumário localizado fisicamente na Página ${p}:`, tocPageText);
      break;
    }
  }

  if (!tocPageText) {
    throw new Error("Seção 'Sumário Geral' não encontrada no PDF compilado!");
  }

  // Verificar que os capítulos NÃO estão todos com a página do sumário
  // Exemplo de texto no sumário: "Apresentação da Obra 3", "Capítulo 1: ... 4", "Capítulo 2: ... 6"
  const introMatch = tocPageText.match(/Apresentação\s+da\s+Obra\s+(\d+)/i);
  const ch1Match = tocPageText.match(/Capítulo\s+1[^\d]+(\d+)/i);
  const ch2Match = tocPageText.match(/Capítulo\s+2[^\d]+(\d+)/i);

  console.log("Valores aferidos no Sumário do PDF:", {
    introPage: introMatch ? introMatch[1] : "N/A",
    ch1Page: ch1Match ? ch1Match[1] : "N/A",
    ch2Page: ch2Match ? ch2Match[1] : "N/A",
  });

  if (!introMatch || !ch1Match || !ch2Match) {
    throw new Error("Não foi possível extrair os números de página do Sumário no PDF final!");
  }

  const pIntro = parseInt(introMatch[1], 10);
  const pCh1 = parseInt(ch1Match[1], 10);
  const pCh2 = parseInt(ch2Match[1], 10);

  // Validações lógicas estritas
  if (pCh1 <= 2) {
    throw new Error(`Capítulo 1 está com número de página inválido no sumário: ${pCh1}`);
  }
  if (pCh2 <= pCh1) {
    throw new Error(`Capítulo 2 (${pCh2}) não pode começar antes ou na mesma página do Capítulo 1 (${pCh1})!`);
  }
  if (pCh1 === 3 && pCh2 === 3 && pIntro === 3) {
    throw new Error("ERRO CRÍTICO REGRESSIVO: Todos os capítulos continuam com a página 3!");
  }

  console.log("✅ TESTE 5 PASSOU: Sumário calibrado perfeitamente com páginas físicas reais e progressão estrita!");

  console.log("\n=======================================================");
  console.log("🎉 TODOS OS TESTES PASSARAM COM SUCESSO!");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("❌ ERRO NO TESTE:", err);
  process.exit(1);
});
