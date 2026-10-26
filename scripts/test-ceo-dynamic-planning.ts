import { calculateBookVolumeRequirements, getPageFormatSpec } from "../lib/export/page-formats";

console.log("=================================================");
console.log("TESTE DE CÁLCULO DINÂMICO DE CAPÍTULOS & FORMATOS");
console.log("=================================================\n");

const formats = ["trade", "a5", "a4", "digest", "pocket"];

for (const fmt of formats) {
  const spec = getPageFormatSpec(fmt);
  const volume = calculateBookVolumeRequirements(fmt, 90, 150, 3200);

  console.log(`[FORMATO: ${spec.name} (${spec.id})]`);
  console.log(`  - Dimensões CSS: ${spec.cssSize}`);
  console.log(`  - Densidade média: ${volume.wordsPerPage} palavras/página`);
  console.log(`  - Meta páginas: ${volume.targetPages} págs`);
  console.log(`  - Palavras totais alvo: ${volume.targetTotalWords} palavras`);
  console.log(`  - Meta por capítulo: ${volume.targetWordsPerChapter} palavras`);
  console.log(`  - Faixa recomendada de capítulos: ${volume.recommendedChaptersMin} a ${volume.recommendedChaptersMax} capítulos\n`);
}

console.log("✓ Todos os cálculos dinâmicos executados com sucesso!");
