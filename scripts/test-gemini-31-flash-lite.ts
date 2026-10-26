import { callGemini, generateEmbedding, calculateCost } from "../lib/agents/gemini-client";
import { getSystemConfig } from "../lib/config";

async function runTests() {
  console.log("==================================================");
  console.log("TESTE DE VALIDAÇÃO: GEMINI-3.5-FLASH-LITE");
  console.log("==================================================");

  const config = getSystemConfig();
  console.log(`[Config] LLM_MODEL configurado: "${config.LLM_MODEL}"`);
  if (config.LLM_MODEL !== "gemini-3.5-flash-lite") {
    throw new Error(`LLM_MODEL esperado "gemini-3.5-flash-lite", mas obteve "${config.LLM_MODEL}"`);
  }

  // 1. Teste de Chamada Textual Direta
  console.log("\n[1/5] Testando chamada textual com gemini-3.5-flash-lite...");
  const textRes = await callGemini("Responda em uma única frase curta: Qual é o propósito de um livro de negócios?");
  console.log(`  -> Modelo reportado: ${textRes.model}`);
  console.log(`  -> Tokens entrada: ${textRes.tokensIn}, saída: ${textRes.tokensOut}`);
  console.log(`  -> Latência: ${textRes.latencyMs}ms`);
  console.log(`  -> Custo estimado: $${textRes.costUsd}`);
  console.log(`  -> Resposta: "${textRes.text.trim()}"`);

  // 2. Teste de Chamada com JSON Estruturado (usado pelo CEO Orchestrator e Revisor)
  console.log("\n[2/5] Testando modo JSON estruturado com gemini-3.5-flash-lite...");
  const jsonRes = await callGemini(
    'Gere um JSON com o esquema: {"status": "success", "agent": "CEO Orchestrator", "rating": 10, "verified": true}',
    {
      responseMimeType: "application/json",
    }
  );
  console.log(`  -> Resposta Bruta: ${jsonRes.text.trim()}`);
  const parsed = JSON.parse(jsonRes.text);
  console.log(`  -> JSON Parseado com Sucesso: status=${parsed.status}, agent=${parsed.agent}`);

  // 3. Teste de Geração de Gráfico Nano Banana 2 (Protocolo JSON)
  console.log("\n[3/5] Testando geração de figura Nano Banana 2...");
  const nanoBananaRes = await callGemini(
    `Você é o Designer Nano Banana 2. Retorne um JSON estrito para uma matriz de decisão:
{
  "conceptType": "decision_matrix",
  "title": "Matriz de Priorização",
  "caption": "Figura 1.1 - Priorização Estratégica [Nano Banana 2 / OpenChart].",
  "items": [
    {"label": "Ação Rápida", "description": "Alto impacto e baixo esforço."},
    {"label": "Projeto Estratégico", "description": "Alto impacto e alto esforço."}
  ]
}`,
    {
      responseMimeType: "application/json",
    }
  );
  const nanoParsed = JSON.parse(nanoBananaRes.text);
  console.log(`  -> Nano Banana 2 JSON Válido: title="${nanoParsed.title}", itens=${nanoParsed.items?.length}`);

  // 4. Teste de Vetorização / Embeddings (text-embedding-004)
  console.log("\n[4/5] Testando geração de embeddings (text-embedding-004)...");
  const embedding = await generateEmbedding("Gestão estratégica e liderança contemporânea");
  console.log(`  -> Dimensão do vetor: ${embedding.length} (esperado 768)`);
  if (embedding.length !== 768) {
    throw new Error(`Dimensão de embedding inválida: ${embedding.length}`);
  }

  // 5. Teste de Cálculo de Custo (Taxas Flash-Lite: $0.025 / $0.10 por milhão)
  console.log("\n[5/5] Testando tabela de preços gemini-3.5-flash-lite...");
  const costSample = calculateCost(1_000_000, 1_000_000);
  console.log(`  -> Custo para 1M in + 1M out: $${costSample} (esperado $0.125)`);
  if (costSample !== 0.125) {
    throw new Error(`Cálculo de custo inesperado: ${costSample}`);
  }

  console.log("\n==================================================");
  console.log("TODOS OS TESTES COM GEMINI-3.5-FLASH-LITE PASSARAM!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("ERRO NO TESTE:", err);
  process.exit(1);
});
