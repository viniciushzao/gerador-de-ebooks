import { extractCleanJsonObject, repairJsonString } from "../lib/utils/json-parser";
import { createBook, getBook, getChapters, getTasks } from "../lib/db/client";

async function runTests() {
  console.log("=== INICIANDO TESTES DE RESILIÊNCIA DE PARSER JSON DO CEO ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`[PASS] ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${description}`);
      failed++;
    }
  }

  // 1. Caso Normal: JSON puro válido
  console.log("\n--- Teste 1: JSON Puro Válido ---");
  const jsonPure = JSON.stringify({
    bookTitle: "Título Válido",
    chapters: [{ chapterNumber: 1, title: "Capítulo 1" }],
  });
  const res1 = extractCleanJsonObject(jsonPure);
  assert(res1.bookTitle === "Título Válido", "Extraiu JSON puro com sucesso");

  // 2. O Erro Exato que Aconteceu: JSON válido seguido de texto com chaves adicionais { ... }
  console.log("\n--- Teste 2: Reprodução do Erro (Posição 10698 com Chaves Trailing) ---");
  // Simula o JSON de 10.600 caracteres seguido de comentários e chaves adicionais
  const filler = "x".repeat(10000);
  const jsonWithTrailingBraces = `{
    "bookTitle": "Breaking the Charts",
    "executiveSummary": "Resumo do livro com muito conteúdo: ${filler}",
    "chapters": [
      { "chapterNumber": 1, "title": "Introdução" }
    ]
  }
  
  Observação adicional do modelo: Foi levado em consideração os tópicos { de vendas, conversão } e { marketing direto }.`;

  try {
    const res2 = extractCleanJsonObject(jsonWithTrailingBraces);
    assert(res2.bookTitle === "Breaking the Charts", "Extraiu objeto raiz ignorando texto e chaves após o fechamento");
    assert(res2.chapters.length === 1, "Capítulos intactos apesar do texto trailing");
  } catch (err: any) {
    assert(false, `Falhou no Teste 2: ${err.message}`);
  }

  // 3. Markdown Code Block com Comentários Antes e Depois
  console.log("\n--- Teste 3: Markdown Code Fences com Comentários ---");
  const markdownFenced = `Aqui está o plano solicitado pelo CEO Orquestrador:
\`\`\`json
{
  "bookTitle": "Vender como Louco",
  "chapters": [
    { "chapterNumber": 1, "title": "Fase 1" },
    { "chapterNumber": 2, "title": "Fase 2" }
  ]
}
\`\`\`
Espero que este plano atenda aos requisitos de 90 páginas.`;

  const res3 = extractCleanJsonObject(markdownFenced);
  assert(res3.bookTitle === "Vender como Louco", "Extraiu JSON dentro do bloco markdown");
  assert(res3.chapters.length === 2, "2 capítulos extraídos com sucesso");

  // 4. Trailing Commas (Vírgulas no final de objetos/arrays)
  console.log("\n--- Teste 4: Trailing Commas ---");
  const jsonWithTrailingCommas = `{
    "bookTitle": "Copywriting de Alta Conversão",
    "chapters": [
      { "chapterNumber": 1, "title": "Gatilhos", },
    ],
  }`;

  const res4 = extractCleanJsonObject(jsonWithTrailingCommas);
  assert(res4.bookTitle === "Copywriting de Alta Conversão", "Reparou e parseou trailing commas");

  // 5. Strings contendo aspas escapadas e chaves literais no texto
  console.log("\n--- Teste 5: Aspas Escapadas e Chaves Literais em Valores String ---");
  const complexStringJson = `{
    "bookTitle": "O Guia \\"Definitivo\\" {Volume 1}",
    "synopsis": "Analisando a fórmula: f(x) = { x | x > 0 }",
    "chapters": []
  }
  Nota extra: { final }`;

  const res5 = extractCleanJsonObject(complexStringJson);
  assert(res5.bookTitle.includes('"Definitivo"'), "Preservou aspas escapadas em strings");
  assert(res5.synopsis.includes("{ x | x > 0 }"), "Preservou chaves literais dentro da string");

  // 6. Teste de Criação de Capítulos do CEO com o Objeto Extraído
  console.log("\n--- Teste 6: Simulação do Fluxo do CEO e Criação de Capítulos ---");
  const testBookId = `test_ceo_fix_${Date.now()}`;
  createBook({
    id: testBookId,
    title: "Livro Teste CEO Fix",
    original_filename: "doc.pdf",
    original_file_path: "/tmp/doc.pdf",
    author_name: "Autor Teste",
    target_audience: "Público",
    tone_of_voice: "Técnico",
    min_pages: 90,
    max_pages: 200,
    typography: "Palatino",
    spacing: 1.15,
    page_size: "DIGEST",
    status: "outlining",
    current_step: "CEO Orquestrador estruturando plano",
    progress_percent: 30,
    total_tokens: 0,
    total_cost_usd: 0,
    pdf_path: null,
    actual_pages: null,
    executive_summary: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const simulatedCeoResponse = `{
    "bookTitle": "Breaking the Charts Editorial",
    "executiveSummary": "Resumo executivo First Principles",
    "targetAudience": "Empreendedores",
    "toneOfVoice": "Analítico",
    "totalTargetWords": 22000,
    "decidedChapterCount": 6,
    "decisionRationale": "6 capítulos de 3.600 palavras atingem 95 páginas no formato Digest",
    "chapters": [
      {
        "chapterNumber": 1,
        "title": "Desconstrução Causal da Oferta",
        "synopsis": "Sinopse do capítulo 1",
        "keyTopics": ["Oferta", "Primeiros Princípios"],
        "ragSearchQueries": ["como criar oferta irresistível"],
        "topicCluster": "vendas",
        "targetWords": 3600,
        "sections": [
          { "sectionNumber": 1, "title": "1.1 Fundamentos", "scope": "Escopo 1", "targetWords": 1000 },
          { "sectionNumber": 2, "title": "1.2 Modelos Operacionais", "scope": "Escopo 2", "targetWords": 1200 },
          { "sectionNumber": 3, "title": "1.3 Estudos de Caso", "scope": "Escopo 3", "targetWords": 1400 }
        ],
        "specificDirectives": ["Focar em métricas CAC/LTV"]
      },
      {
        "chapterNumber": 2,
        "title": "Engenharia de Tráfego e Aquisição",
        "synopsis": "Sinopse do capítulo 2",
        "keyTopics": ["Tráfego", "Conversão"],
        "ragSearchQueries": ["canais de aquisição escaláveis"],
        "topicCluster": "marketing",
        "targetWords": 3600,
        "sections": [
          { "sectionNumber": 1, "title": "2.1 Funis de Alta Conversão", "scope": "Escopo 1", "targetWords": 1800 },
          { "sectionNumber": 2, "title": "2.2 Playbook de Escala", "scope": "Escopo 2", "targetWords": 1800 }
        ],
        "specificDirectives": ["Exemplos práticos de campanhas"]
      }
    ]
  }
  
  // Notas adicionais do LLM que antes causavam o SyntaxError at position 10698
  { "debugInfo": "gerado com sucesso", "status": 200 }`;

  const parsedPlan = extractCleanJsonObject(simulatedCeoResponse);
  assert(parsedPlan.chapters.length === 2, "Plano do CEO parseado com 2 capítulos");
  assert(parsedPlan.decidedChapterCount === 6, "Metadados do plano preservados");

  console.log(`\n=== RESUMO DOS TESTES: ${passed} PASSOU, ${failed} FALHOU ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
