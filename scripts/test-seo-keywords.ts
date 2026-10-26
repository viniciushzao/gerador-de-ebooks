import { buildDefaultSeoKeywords, sanitizeSeoKeywords } from "../lib/agents/publishing-metadata-generator";
import { BookRecord } from "../lib/db/schema";

async function runTests() {
  console.log("================================================================================");
  console.log("TESTE DO GERADOR DE PALAVRAS-CHAVE ESTRATÉGICAS (SEO & AMAZON KDP) POR TÓPICOS");
  console.log("================================================================================\n");

  const mockBookMarketing: BookRecord = {
    id: "test-book-seo-1",
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
    page_size: "TRADE",
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

  const mockBookGestao: BookRecord = {
    ...mockBookMarketing,
    id: "test-book-seo-2",
    title: "Gestão Estratégica & Liderança Ágil: O Guia Definitivo",
    target_audience: "Líderes, Executivos e Fundadores",
    executive_summary: "Frameworks práticos de objetivos dinâmicos e liderança corporativa.",
  };

  let allPassed = true;

  // [TESTE 1] Geração Padrão de 10 Palavras-Chave em 4 Tópicos
  console.log("[TESTE 1] Validando geração padrão de 10 palavras-chave em 4 tópicos...");
  const kwMarketing = buildDefaultSeoKeywords(mockBookMarketing);

  console.log(`Total de Palavras-Chave geradas: ${kwMarketing.total_keywords}`);
  console.log(`Quantidade de Tópicos gerados: ${kwMarketing.clusters.length}`);
  console.log(`Top 7 Amazon KDP gerados: ${kwMarketing.kdp_top_7.length}`);

  if (kwMarketing.total_keywords !== 10) {
    console.error(`[FALHA] Total de palavras-chave deve ser 10, mas foi ${kwMarketing.total_keywords}`);
    allPassed = false;
  }

  if (kwMarketing.clusters.length !== 4) {
    console.error(`[FALHA] Total de clusters deve ser 4, mas foi ${kwMarketing.clusters.length}`);
    allPassed = false;
  }

  if (kwMarketing.kdp_top_7.length !== 7) {
    console.error(`[FALHA] Total de slots KDP deve ser 7, mas foi ${kwMarketing.kdp_top_7.length}`);
    allPassed = false;
  }

  // Verificar limites de caracteres para KDP (máx 50)
  for (const c of kwMarketing.clusters) {
    console.log(`\n  * ${c.topic_name} (${c.keywords.length} palavras):`);
    for (const k of c.keywords) {
      console.log(`    - "${k.keyword}" [${k.character_count}c, intent: ${k.intent}]`);
      if (k.character_count > 50) {
        console.error(`[FALHA] Palavra-chave "${k.keyword}" ultrapassa 50 caracteres (${k.character_count}c)!`);
        allPassed = false;
      }
    }
  }

  console.log("\nTexto Puro Formatado:\n" + kwMarketing.plain_text_list);

  // [TESTE 2] Livro de Gestão / Liderança
  console.log("\n[TESTE 2] Validando livro de Gestão & Liderança...");
  const kwGestao = buildDefaultSeoKeywords(mockBookGestao);
  if (kwGestao.total_keywords !== 10 || kwGestao.clusters.length !== 4) {
    console.error(`[FALHA] Geração para gestão falhou nos requisitos de contagem!`);
    allPassed = false;
  }

  // [TESTE 3] Sanitização defensiva contra saída de IA imperfeita
  console.log("\n[TESTE 3] Validando sanitização contra alucinações e formatos incompletos...");
  const imperfectAiResponse = {
    clusters: [
      {
        topic_name: "Tópico Aleatório",
        keywords: [
          "1. \"COMO CALCULAR MÉTRICAS DE MARKETING\"   ",
          "MENSURAÇÃO DE CAC E LTV NA PRÁTICA",
          "termo que ultrapassa cinquenta caracteres de comprimento para testar corte de segurança e kdp",
        ],
      },
    ],
  };

  const sanitized = sanitizeSeoKeywords(imperfectAiResponse, mockBookMarketing);
  console.log(`Total pós-sanitização: ${sanitized.total_keywords}`);
  console.log(`Clusters pós-sanitização: ${sanitized.clusters.length}`);

  if (sanitized.total_keywords !== 10) {
    console.error(`[FALHA] Sanitização não normalizou para 10 palavras-chave (obteve ${sanitized.total_keywords})!`);
    allPassed = false;
  }

  if (sanitized.clusters.length !== 4) {
    console.error(`[FALHA] Sanitização não distribuiu nos 4 tópicos canônicos!`);
    allPassed = false;
  }

  for (const c of sanitized.clusters) {
    for (const k of c.keywords) {
      if (k.character_count > 50) {
        console.error(`[FALHA] Palavra sanitizada ultrapassa 50 caracteres: "${k.keyword}"!`);
        allPassed = false;
      }
      if (k.keyword.includes('"') || k.keyword.startsWith("1.")) {
        console.error(`[FALHA] Palavra sanitizada contém aspas ou prefixo numérico: "${k.keyword}"!`);
        allPassed = false;
      }
    }
  }

  console.log("\n================================================================================");
  if (allPassed) {
    console.log("RESULTADO GERAL: TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!");
    console.log("Gerador de Palavras-Chave Estratégicas (SEO & Amazon KDP) pronto para produção.");
  } else {
    console.error("RESULTADO GERAL: DETECTADAS FALHAS NOS TESTES!");
    process.exit(1);
  }
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Erro fatal nos testes:", err);
  process.exit(1);
});
