import { calculateWraparoundCoverDimensions, KDP_PAPER_THICKNESS_FACTORS } from "../lib/export/page-formats";

function runTests() {
  console.log("================================================================================");
  console.log("TESTE: DIMENSIONAMENTO MATEMÁTICO DA CAPA COMPLETA WRAPAROUND (AMAZON KDP)");
  console.log("================================================================================");

  // [TESTE 1] O erro relatado pelo usuário: Trade 6x9 com 162 páginas no KDP
  console.log("\n[TESTE 1] Validando Trade 6\"x9\" com 162 páginas (Caso Real do Erro do KDP)...");
  const tradeSpec = calculateWraparoundCoverDimensions("TRADE", 162, "white");

  console.log(`-> Formato: ${tradeSpec.formatName}`);
  console.log(`-> Páginas: ${tradeSpec.pageCount}`);
  console.log(`-> Largura Trim: ${tradeSpec.trimWidthInches}"`);
  console.log(`-> Altura Trim: ${tradeSpec.trimHeightInches}"`);
  console.log(`-> Lombada: ${tradeSpec.spineWidthInches}" (${tradeSpec.spineWidthMm} mm)`);
  console.log(`-> Largura Total Spread: ${tradeSpec.totalWidthInches}"`);
  console.log(`-> Altura Total Spread: ${tradeSpec.totalHeightInches}"`);
  console.log(`-> String KDP: ${tradeSpec.kdpDimensionsString}`);
  console.log(`-> Resolução a 300 DPI: ${tradeSpec.totalWidthPx} × ${tradeSpec.totalHeightPx} px`);
  console.log(`-> Texto de Lombada Permitido: ${tradeSpec.spineTextAllowed} (${tradeSpec.spineTextGuideline})`);

  // Assertivas do caso exato do KDP
  if (tradeSpec.totalWidthInches !== 12.615) {
    throw new Error(`Esperado totalWidthInches 12.615", recebido: ${tradeSpec.totalWidthInches}"`);
  }
  if (tradeSpec.totalHeightInches !== 9.25) {
    throw new Error(`Esperado totalHeightInches 9.250", recebido: ${tradeSpec.totalHeightInches}"`);
  }
  if (tradeSpec.totalWidthPx !== 3785) {
    throw new Error(`Esperado totalWidthPx 3785 px, recebido: ${tradeSpec.totalWidthPx}`);
  }
  if (tradeSpec.totalHeightPx !== 2775) {
    throw new Error(`Esperado totalHeightPx 2775 px, recebido: ${tradeSpec.totalHeightPx}`);
  }
  if (tradeSpec.spineWidthInches !== 0.365) {
    throw new Error(`Esperado spineWidthInches 0.365", recebido: ${tradeSpec.spineWidthInches}`);
  }
  if (!tradeSpec.spineTextAllowed) {
    throw new Error(`Para 162 páginas o texto de lombada deve ser permitido.`);
  }
  console.log("✓ Prova matemática dos 12.615x9.250 comprovada com 100% de exatidão.");

  // [TESTE 2] Validando livro com menos de 80 páginas (Lombada Lisa sem texto)
  console.log("\n[TESTE 2] Validando livro com 60 páginas (Regra KDP de Lombada Lisa)...");
  const thinSpec = calculateWraparoundCoverDimensions("TRADE", 60, "white");
  console.log(`-> Páginas: ${thinSpec.pageCount}`);
  console.log(`-> Lombada: ${thinSpec.spineWidthInches}"`);
  console.log(`-> Texto de Lombada Permitido: ${thinSpec.spineTextAllowed}`);
  if (thinSpec.spineTextAllowed) {
    throw new Error(`Para 60 páginas o texto de lombada NÃO deve ser permitido.`);
  }
  console.log("✓ Regra KDP para livros finos (< 80 páginas) validada com sucesso.");

  // [TESTE 3] Validando outros formatos (A5, Digest, A4, Pocket)
  console.log("\n[TESTE 3] Validando A5, DIGEST, A4 e POCKET...");
  const formats = ["A5", "DIGEST", "A4", "POCKET"];
  for (const fmt of formats) {
    const spec = calculateWraparoundCoverDimensions(fmt, 120, "white");
    console.log(`-> ${fmt}: Total ${spec.totalWidthInches}" × ${spec.totalHeightInches}" (${spec.totalWidthPx} × ${spec.totalHeightPx} px) | Lombada ${spec.spineWidthInches}"`);
    if (spec.totalWidthPx < 1000 || spec.totalHeightPx < 625) {
      throw new Error(`Resolução mínima KDP violada para ${fmt}`);
    }
  }
  console.log("✓ Todos os formatos calculados com resolução 300 DPI e sangria.");

  console.log("\n================================================================================");
  console.log("RESULTADO: TODOS OS TESTES PASSARAM COM SUCESSO!");
  console.log("================================================================================");
}

runTests();
