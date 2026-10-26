import { STANDARD_PAGE_FORMATS, calculateCoverDimensions } from "../lib/export/page-formats";
import { buildNanoBananaCoverJson, sanitizeCoverPromptJson } from "../lib/agents/publishing-metadata-generator";
import { BookRecord } from "../lib/db/schema";

async function runTests() {
  console.log("================================================================================");
  console.log("TESTE DE CONFORMIDADE AMAZON KDP E DIMENSIONAMENTO DE CAPAS POR FOLHA DO USUÁRIO");
  console.log("================================================================================\n");

  const formatsToTest = ["A5", "TRADE", "DIGEST", "A4", "POCKET", null, "FORMATO_INEXISTENTE"];

  let allPassed = true;

  for (const fmtId of formatsToTest) {
    const dims = calculateCoverDimensions(fmtId);
    console.log(`\n--- Testando Formato: ${fmtId || "null (Fallback A5)"} ---`);
    console.log(`Format ID: ${dims.formatId} | Nome: ${dims.formatName}`);
    console.log(`Medidas: ${dims.widthMm} × ${dims.heightMm} mm (${dims.widthInches}" × ${dims.heightInches}")`);
    console.log(`Proporção: ${dims.aspectRatio} (Fração: ${dims.aspectRatioFraction}, Decimal: ${dims.aspectRatioDecimal})`);
    console.log(`Resolução Trim 300 DPI: ${dims.printTrimWidthPx} × ${dims.printTrimHeightPx} px`);
    console.log(`Resolução Bleed 300 DPI: ${dims.printBleedWidthPx} × ${dims.printBleedHeightPx} px`);
    console.log(`Resolução eBook KDP: ${dims.ebookTargetWidthPx} × ${dims.ebookTargetHeightPx} px`);
    console.log(`Mínimo KDP (1000 × 625 px) atendido: ${dims.kdpMinResolutionMet ? "SIM [APROVADO]" : "NÃO [FALHA]"}`);

    // Validações
    if (!dims.kdpMinResolutionMet) {
      console.error(`[FALHA] Formato ${fmtId} não atingiu o mínimo de 1000x625 px da Amazon KDP!`);
      allPassed = false;
    }

    if (dims.printTrimWidthPx < 625 || dims.printTrimHeightPx < 1000) {
      console.error(`[FALHA] Dimensões a 300 DPI (${dims.printTrimWidthPx}x${dims.printTrimHeightPx}) inferiores a 625x1000!`);
      allPassed = false;
    }

    // Testar geração do Nano Banana 2 para este formato
    const mockBook: BookRecord = {
      id: "test-book-kdp",
      title: "Métricas de Marketing O Guia Definitivo",
      original_filename: "metricas.pdf",
      original_file_path: "/uploads/metricas.pdf",
      author_name: "Dr. Roberto Silveira",
      target_audience: "Diretores, CMOs e Gestores de Tráfego",
      tone_of_voice: "Técnico e Analítico",
      min_pages: 90,
      max_pages: 180,
      typography: "Modern Sans",
      spacing: 1.5,
      page_size: fmtId || undefined,
      status: "completed",
      current_step: "completed",
      progress_percent: 100,
      total_tokens: 50000,
      total_cost_usd: 0.05,
      pdf_path: "/exports/book.pdf",
      executive_summary: "Guia analítico focado em ROI, CAC e LTV.",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const nanoJson = buildNanoBananaCoverJson(mockBook);

    if (nanoJson.aspect_ratio !== dims.aspectRatio) {
      console.error(`[FALHA] Nano Banana JSON aspect_ratio (${nanoJson.aspect_ratio}) diferente do calculado (${dims.aspectRatio})!`);
      allPassed = false;
    }

    if (!nanoJson.output_specifications || !nanoJson.amazon_kdp_compliance) {
      console.error(`[FALHA] Nano Banana JSON não contém os nós output_specifications e amazon_kdp_compliance!`);
      allPassed = false;
    }

    // Testar sanitização contra alucinação de IA
    const hallucinatedIaCover = {
      cards: [{ title: "Card 1" }],
      author: "Nome Indesejado",
      mode: "dark",
      aspect_ratio: "1:999", // proporção errada gerada pela IA
    };

    const sanitized = sanitizeCoverPromptJson(hallucinatedIaCover, mockBook);

    if (sanitized.aspect_ratio !== dims.aspectRatio) {
      console.error(`[FALHA] Sanitização não forçou o aspect_ratio correto da folha (${dims.aspectRatio})!`);
      allPassed = false;
    }

    if (sanitized.cards || sanitized.author || sanitized.theme.mode === "dark") {
      console.error(`[FALHA] Sanitização falhou em expurgar cards/autor/tema escuro!`);
      allPassed = false;
    }

    if (!sanitized.output_specifications || !sanitized.amazon_kdp_compliance) {
      console.error(`[FALHA] Sanitização não injetou os blocos técnicos KDP!`);
      allPassed = false;
    }
  }

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("RESULTADO GERAL: TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!");
    console.log("Conformidade Amazon KDP e Proporção por Folha do Usuário plenamente garantidas.");
  } else {
    console.error("RESULTADO GERAL: FORAM DETECTADAS FALHAS NOS TESTES!");
    process.exit(1);
  }
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Erro durante os testes:", err);
  process.exit(1);
});
