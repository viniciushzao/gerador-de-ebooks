import fs from "fs";
import path from "path";
import { BookRecord, ChapterRecord } from "../lib/db/schema";
import {
  buildCleanVisualCoverPrompt,
  getCoverNegativePrompt,
  buildNanoBananaCoverJson,
  sanitizeCoverPromptJson,
} from "../lib/agents/publishing-metadata-generator";
import {
  calculateWraparoundCoverDimensions,
} from "../lib/export/page-formats";
import {
  buildNativeCoverHtml,
  generateAndSaveNativeKdpCover,
  processAndCompileUploadedCoverImage,
} from "../lib/export/cover-compiler-engine";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 INICIANDO TESTES DO NOVO COVER COMPILER KDP");
  console.log("=================================================");

  const mockBook = {
    id: "test-book-kdp-fix",
    title: "Engenharia de Prompt e Métricas de Precisão",
    author_name: "Dr. Roberto Silva",
    target_audience: "Engenheiros de IA e Líderes Técnicos",
    tone_of_voice: "Analítico e Cirúrgico",
    page_size: "TRADE",
    status: "completed",
    current_step: "Concluído",
    progress_percent: 100,
    actual_pages: 162,
    total_tokens: 350000,
    total_cost_usd: 0.12,
    executive_summary: "# Apresentação da Obra\n## 1. O Problema Fundamental e a Tese Central\nNa engenharia mecânica e na manufatura de precisão, a intercambiabilidade de peças não é apenas um objetivo de design; é o alicerce da eficiência industrial.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as BookRecord;

  const mockChapters = [
    {
      id: "ch-1",
      book_id: mockBook.id,
      chapter_number: 1,
      title: "Fundamentos de Vetorização",
      synopsis: "Análise vetorial e representações matemáticas",
      content_markdown: "Capítulo introdutório com rigor analítico.",
      target_words: 3500,
      actual_words: 3600,
      status: "completed",
      cost_usd: 0.02,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as unknown as ChapterRecord[];

  // ==========================================
  // TESTE 1: PUREZA DO PROMPT VISUAL (ZERO NÚMEROS, ZERO COTAS, ZERO '#' OU MARKDOWN)
  // ==========================================
  console.log("\n[TESTE 1] Verificação de Pureza do Prompt Visual");
  const cleanVisualPrompt = buildCleanVisualCoverPrompt(mockBook, mockChapters, "tolerância dimensional e ajuste NBR 6158");
  const negativePrompt = getCoverNegativePrompt();

  console.log("--- PROMPT VISUAL GERADO ---");
  console.log(cleanVisualPrompt);
  console.log("\n--- NEGATIVE PROMPT ---");
  console.log(negativePrompt);

  if (cleanVisualPrompt.includes("#")) {
    throw new Error("[FALHA] O prompt visual contém '#' proibido! Nenhuma IA de geração de imagem entende markdown ou hashtags.");
  }
  if (cleanVisualPrompt.includes("Apresentação da Obra") || cleanVisualPrompt.includes("O Problema Fundamental")) {
    throw new Error("[FALHA] O prompt visual contém cabeçalhos estruturais Markdown em vez de prosa natural fluida!");
  }
  if (!cleanVisualPrompt.includes("Na engenharia mecânica e na manufatura de precisão")) {
    throw new Error("[FALHA] O prompt visual não conseguiu extrair a prosa natural do primeiro parágrafo!");
  }

  const forbiddenTokensInVisual = [
    '0.318"',
    '9.25 in',
    '9.250"',
    '0.25"',
    '0.0625"',
    '2.0"',
    '1.2"',
    "dimension lines",
    "caliper",
    "barcode box",
    "barcode outline",
    "crease lines",
    "ruler",
  ];

  for (const token of forbiddenTokensInVisual) {
    if (cleanVisualPrompt.includes(token)) {
      throw new Error(`[FALHA] O prompt visual contém o token proibido '${token}'! A IA pode pintar números.`);
    }
  }
  console.log("✅ [TESTE 1 PASSOU] Zero números de cotas, zero '#' e zero markdown no prompt visual.");

  // ==========================================
  // TESTE 2: NEGATIVE PROMPT AGRESSIVO
  // ==========================================
  console.log("\n[TESTE 2] Verificação do Negative Prompt");
  const requiredNegativeTokens = [
    "3d mockup",
    "drop shadow",
    "gray borders",
    "dimension lines",
    "measurement arrows",
    "barcode box",
  ];
  for (const token of requiredNegativeTokens) {
    if (!negativePrompt.includes(token)) {
      throw new Error(`[FALHA] O negative prompt não contém '${token}'!`);
    }
  }
  console.log("✅ [TESTE 2 PASSOU] Negative prompt contém todos os bloqueios necessários.");

  // ==========================================
  // TESTE 3: JSON NANO BANANA E SANITIZAÇÃO
  // ==========================================
  console.log("\n[TESTE 3] JSON Nano Banana e Sanitização Defensiva");
  const jsonCover = buildNanoBananaCoverJson(mockBook, mockChapters);
  const sanitized = sanitizeCoverPromptJson(jsonCover, mockBook, mockChapters);

  if (!sanitized.framing_and_canvas || !sanitized.framing_and_canvas.includes("FLAT 2D")) {
    throw new Error("[FALHA] framing_and_canvas ausente ou sem diretiva FLAT 2D!");
  }
  if (!sanitized.spread_zones?.left_zone_back_cover?.barcode_area) {
    throw new Error("[FALHA] barcode_area ausente na contracapa!");
  }
  if ((sanitized.spread_zones?.left_zone_back_cover as any)?.barcode_reservation_box) {
    throw new Error("[FALHA] barcode_reservation_box residual detectado!");
  }
  console.log("✅ [TESTE 3 PASSOU] JSON sanitizado contém framing_and_canvas e barcode_area limpa.");

  // ==========================================
  // TESTE 4: COMPILAÇÃO NATIVA 1-CLICK (PUPPETEER 300 DPI)
  // ==========================================
  console.log("\n[TESTE 4] Compilação Nativa KDP 1-Click a 300 DPI");
  const testSpec = calculateWraparoundCoverDimensions(mockBook.page_size, mockBook.actual_pages);
  const nativeHtml = buildNativeCoverHtml(mockBook, mockChapters, testSpec);

  if (nativeHtml.includes("# Apresentação da Obra") || nativeHtml.includes("## 1. O Problema Fundamental")) {
    throw new Error("[FALHA] HTML nativo contém títulos Markdown vazados no texto da contracapa!");
  }
  if (!nativeHtml.includes("Na engenharia mecânica e na manufatura de precisão")) {
    throw new Error("[FALHA] HTML nativo não contém a prosa limpa extraída!");
  }
  console.log("✅ Sinopse da contracapa no HTML nativo 100% limpa de markdown e '#'.");

  if (!nativeHtml.includes(`<h1 class="front-title">${mockBook.title}</h1>`)) {
    throw new Error("[FALHA] O título da capa não está unificado em uma única tag <h1> com fonte contínua!");
  }
  if (nativeHtml.includes('class="front-subtitle"')) {
    throw new Error("[FALHA] Subtítulo residual detectado na capa frontal! O título deve ser em fonte única e sem subtítulo.");
  }
  console.log("✅ Título da capa frontal 100% unificado em fonte única sem divisão em 2 partes ou subtítulo.");

  const nativeResult = await generateAndSaveNativeKdpCover(mockBook, mockChapters);

  console.log("Resultado da compilação nativa:", {
    success: nativeResult.success,
    pdfPath: nativeResult.pdfPath,
    pngPath: nativeResult.pngPath,
    dimensions: nativeResult.dimensions,
  });

  if (!nativeResult.success || !nativeResult.pdfPath || !nativeResult.pngPath) {
    throw new Error(`[FALHA] Falha na compilação nativa: ${nativeResult.error}`);
  }
  if (!fs.existsSync(nativeResult.pdfPath) || !fs.existsSync(nativeResult.pngPath)) {
    throw new Error("[FALHA] Arquivos PDF ou PNG não foram criados no disco!");
  }

  const pngStats = fs.statSync(nativeResult.pngPath);
  const pdfStats = fs.statSync(nativeResult.pdfPath);

  if (pngStats.size < 50000) {
    throw new Error(`[FALHA] PNG gerado muito pequeno (${pngStats.size} bytes)!`);
  }
  if (pdfStats.size < 5000) {
    throw new Error(`[FALHA] PDF gerado muito pequeno (${pdfStats.size} bytes)!`);
  }
  if (nativeResult.dimensions.widthPx !== 3785 || nativeResult.dimensions.heightPx !== 2775) {
    throw new Error(`[FALHA] Resolução incorreta: esperado 3785x2775 px a 300 DPI, recebido ${nativeResult.dimensions.widthPx}x${nativeResult.dimensions.heightPx}`);
  }
  console.log(`✅ [TESTE 4 PASSOU] Capa nativa gerada com sucesso!`);
  console.log(`   PNG 300 DPI: ${pngStats.size} bytes (${nativeResult.dimensions.widthPx} × ${nativeResult.dimensions.heightPx} px)`);
  console.log(`   PDF KDP: ${pdfStats.size} bytes (12.615" × 9.250")`);

  // ==========================================
  // TESTE 5: PROCESSAMENTO DE IMAGEM DA IA (AUTO-CROP + UPSCALE 300 DPI)
  // ==========================================
  console.log("\n[TESTE 5] Processamento de Imagem da IA (Auto-Crop + Upscale 300 DPI)");
  // Usar o PNG gerado como imagem de entrada para testar o pipeline de upscale e auto-crop
  const inputImageBuffer = fs.readFileSync(nativeResult.pngPath);
  const spec = calculateWraparoundCoverDimensions(mockBook.page_size, mockBook.actual_pages);

  const upscaleResult = await processAndCompileUploadedCoverImage(
    inputImageBuffer,
    spec,
    mockBook.id
  );

  console.log("Resultado do processamento da imagem:", {
    success: upscaleResult.success,
    pdfPath: upscaleResult.pdfPath,
    pngPath: upscaleResult.pngPath,
    dimensions: upscaleResult.dimensions,
  });

  if (!upscaleResult.success || !upscaleResult.pdfPath || !upscaleResult.pngPath) {
    throw new Error(`[FALHA] Processamento de imagem falhou: ${upscaleResult.error}`);
  }
  if (upscaleResult.dimensions.widthPx !== 3785 || upscaleResult.dimensions.heightPx !== 2775) {
    throw new Error(`[FALHA] Dimensões incorretas após upscale!`);
  }

  console.log("✅ [TESTE 5 PASSOU] Auto-crop e upscale para 300 DPI KDP concluídos com perfeição.");

  console.log("\n=================================================");
  console.log("🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("❌ ERRO NO TESTE:", err);
  process.exit(1);
});
