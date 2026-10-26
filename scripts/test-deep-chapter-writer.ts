import { purgeMermaidDiagrams, cleanLatexMathFormatting } from "../lib/agents/chapter-writer";

console.log("=================================================");
console.log("TESTE DOS FILTROS E GUARDRAILS DO CHAPTER WRITER");
console.log("=================================================\n");

// 1. Teste de expurgo de Mermaid e caixas ASCII/Unicode
const dirtyText = `
## Seção 1.1: Princípios Fundamentais

Aqui está uma explicação detalhada.

\`\`\`mermaid
graph TD
  A[Início] --> B[Processo]
  B --> C[Fim]
\`\`\`

Também temos uma caixa ASCII:
+-------------------+
|  Caixa de Teste   |
+-------------------+

E uma árvore Unicode:
├── Diretório A
│   └── Arquivo 1
└── Diretório B

Texto normal continua aqui com uma fórmula: $V = \\frac{1}{3} \\times \\pi \\times r^2$.
E valor em reais: $150.000 e 0{,}90 de margem.
`;

const cleaned1 = purgeMermaidDiagrams(dirtyText);
const cleaned2 = cleanLatexMathFormatting(cleaned1);

console.log("--- TEXTO SANITIZADO ---");
console.log(cleaned2);
console.log("------------------------\n");

// Verificações
const hasMermaid = cleaned2.includes("```mermaid");
const hasAsciiBox = cleaned2.includes("+---+");
const hasUnicodeTree = cleaned2.includes("├──");
const hasLatexComma = cleaned2.includes("{,}");
const hasUnparsedLatex = cleaned2.includes("\\frac") || cleaned2.includes("\\times");
const hasCurrencyNormalized = cleaned2.includes("R$ 150.000");

console.log(`Contém Mermaid? ${hasMermaid ? "SIM (ERRO)" : "NÃO (OK)"}`);
console.log(`Contém Caixa ASCII? ${hasAsciiBox ? "SIM (ERRO)" : "NÃO (OK)"}`);
console.log(`Contém Árvore Unicode? ${hasUnicodeTree ? "SIM (ERRO)" : "NÃO (OK)"}`);
console.log(`Contém LaTeX {,}? ${hasLatexComma ? "SIM (ERRO)" : "NÃO (OK)"}`);
console.log(`Contém LaTeX não sanitizado (frac/times)? ${hasUnparsedLatex ? "SIM (ERRO)" : "NÃO (OK)"}`);
console.log(`Normalizou moeda para R$? ${hasCurrencyNormalized ? "SIM (OK)" : "NÃO (ERRO)"}`);

if (!hasMermaid && !hasAsciiBox && !hasUnicodeTree && !hasLatexComma && !hasUnparsedLatex && hasCurrencyNormalized) {
  console.log("\n✓ TODOS OS GUARDRAILS FORAM VALIDADOS COM 100% DE SUCESSO!");
} else {
  console.error("\n✗ ALGUNS GUARDRAILS FALHARAM!");
  process.exit(1);
}
