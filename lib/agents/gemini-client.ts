import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnvConfig, getSystemConfig } from "@/lib/config";

export interface GeminiResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  model: string;
}

// Pricing constants for gemini-3.5-flash-lite (per million tokens: $0.025 prompt / $0.10 completion)
const PROMPT_COST_PER_MILLION = 0.025;
const COMPLETION_COST_PER_MILLION = 0.10;

export function calculateCost(tokensIn: number, tokensOut: number): number {
  const inputCost = (tokensIn / 1_000_000) * PROMPT_COST_PER_MILLION;
  const outputCost = (tokensOut / 1_000_000) * COMPLETION_COST_PER_MILLION;
  return Number((inputCost + outputCost).toFixed(6));
}

let genAiInstance: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI | null {
  if (genAiInstance) {
    return genAiInstance;
  }
  const { GEMINI_API_KEY } = getEnvConfig();
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
    return null;
  }
  genAiInstance = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAiInstance;
}

export async function callGemini(
  prompt: string,
  options?: {
    systemInstruction?: string;
    thinkingLevel?: "minimal" | "low" | "medium" | "high";
    maxOutputTokens?: number;
    responseMimeType?: string;
  }
): Promise<GeminiResponse> {
  const systemConfig = getSystemConfig();
  const modelName = systemConfig.LLM_MODEL || "gemini-3.8-flash";
  const startTime = Date.now();

  const client = getGeminiClient();

  if (!client) {
    // Graceful deterministic generation for test / offline pipelines
    const latencyMs = 120 + Math.floor(Math.random() * 80);
    const isJsonResponse = options?.responseMimeType === "application/json" || prompt.includes("JSON válido");

    let simulatedText = "";
    if (prompt.includes("Nano Banana 2")) {
      simulatedText = JSON.stringify(
        {
          conceptType: "decision_matrix",
          title: "Matriz Estratégica de Decisão",
          caption: "Figura 3.1 — Matriz Estratégica de Decisão [Nano Banana 2 / OpenChart].",
          items: [
            { label: "Liderança de Mercado", description: "Alta diferenciação e baixa sensibilidade a preço." },
            { label: "Competitividade em Custo", description: "Escala operacional e margem unitária controlada." },
            { label: "Nicho de Alto Valor", description: "Segmentação profunda e retenção qualificada." }
          ]
        },
        null,
        2
      );
    } else if (prompt.includes("AUDITORIA EDITORIAL EXECUTIVA") || options?.systemInstruction?.includes("Diretor Editorial Sênior")) {
      simulatedText = JSON.stringify(
        {
          volumeAudit: {
            targetPages: systemConfig.MIN_PAGES || 70,
            estimatedPages: 22,
            pageDeficit: (systemConfig.MIN_PAGES || 70) - 22,
            score: 25,
            status: "deficit",
            critique: `Déficit volumétrico substancial de ${(systemConfig.MIN_PAGES || 70) - 22} páginas em relação à meta contratual. Capítulos gerados exigem enriquecimento ativo de conteúdo.`,
          },
          typographyAudit: {
            score: 95,
            fontFamily: "Garamond",
            lineSpacing: 1.38,
            critique: "Entrelinha editorial 1.38 e tipografia clássica com espaçamento adequado para leitura.",
            recommendations: "Manter padrão editorial atual.",
          },
          linguisticAudit: {
            score: 94,
            grammarObservations: ["Estrutura sintática coesa e registro formal sem desvios aparentes."],
            toneConsistency: "Excelente",
            critique: "Texto gramaticalmente correto e com tom facilitador bem estruturado.",
          },
          conceptualAudit: {
            score: 92,
            thesisAdherence: "Fiel aos primeiros princípios",
            depthLevel: "profundo",
            critique: "Conceitos centrais desconstruídos adequadamente nos capítulos existentes.",
          },
          overallQualityScore: 68,
          remediationActionRequired: true,
          remediationPlanSummary: "Necessário acionar remediação ativa e gerar Caderno de Aplicação Executiva para preencher o volume contratado.",
        },
        null,
        2
      );
    } else if (prompt.includes("Caderno de Aplicação Executiva") || prompt.includes("apêndice analítico completo")) {
      simulatedText = `# Caderno de Aplicação Executiva & Estudos de Caso Práticos

## 1. Diagnóstico Avançado de Falhas & Antipatterns Reais

A aplicação prática dos princípios de tração e gestão estratégica exige a eliminação de vícios operacionais historicamente arraigados nas organizações. O primeiro erro crítico reside na ausência de validação de hipóteses por primeiros princípios: líderes frequentemente adotam soluções pré-fabricadas por analogia, ignorando os mecanismos causais específicos do seu mercado. Quando a estratégia falha em decompor o problema em suas variáveis atômicas, os investimentos subsequentes tornam-se ineficientes e diluídos.

O segundo erro recorrente é a otimização prematura de canais secundários antes da consolidação do modelo econômico unitário. Conforme evidenciado pelas análises deste compêndio, organizações que expandem despesas comerciais sem domínio estrito de margem unitária amplificam prejuízos em escala exponencial. A governança exige que métricas de sustentação sejam comprovadas antes de qualquer iniciativa de crescimento agressivo.

O terceiro vício reside na ausência de rituais sistemáticos de inspeção e feedback factual. Processos de decisão baseados em intuição não calibrada geram desalinhamento crônico entre equipes operacionais e os objetivos estratégicos da diretoria. Institucionalizar revisões baseadas em evidências elimina discussões de opinião e ancora o avanço corporativo em dados mensuráveis.

O quarto erro consiste na tolerância à complexidade burocrática desnecessária ("fluff operacional"). Adicionar etapas de aprovação redundantes sob o pretexto de controle mitiga a agilidade executiva e cria silos comunicacionais. A liderança deve praticar o princípio de simplificação agressiva: qualquer processo que não gere valor direto ou proteção contra riscos catastróficos deve ser sumariamente extinto.

Por fim, a quinta falha crítica é a desconexão entre a remuneração de equipes e as métricas fundamentais de tração. Incentivos desalinhados geram comportamentos míopes de curto prazo, comprometendo a saúde financeira e a reputação da marca no longo prazo.

## 2. Matrizes Decisórias & Frameworks Práticos Passo a Passo

Para operacionalizar as tomadas de decisão e eliminar o viés cognitivo nas rotinas de gestão, estabelecemos a seguinte matriz de priorização de iniciativas estratégicas:

| Dimensão de Avaliação | Peso Estratégico | Critério de Aceitação Mínima | Impacto no Caixa |
| :--- | :--- | :--- | :--- |
| **Alavancagem Unitária** | 35% | Margem de contribuição superior a 60% | Retorno em < 90 dias |
| **Previsibilidade de Demanda** | 25% | Histórico comprovado de conversão em 3 coortes | Redução de CAC em > 20% |
| **Velocidade de Implementação** | 20% | Go-to-market em no máximo 4 semanas | Faturamento imediato |
| **Barreira Competitiva** | 20% | Ativo proprietário ou efeito de rede sustentável | Proteção de longo prazo |

O protocolo de implementação deve seguir obrigatoriamente a sequência lógica de 4 etapas:
1. **Mapeamento de Hipóteses Críticas:** Listar as 3 premissas fundamentais que sustentam a oportunidade.
2. **Experimento Controlado de Menor Escala:** Realizar teste prático delimitado no tempo para aferir a elasticidade de resposta.
3. **Validação de Métricas de Eficiência:** Comparar os dados reais obtidos contra os benchmarks contratuais do projeto.
4. **Escala Operacional ou Descarte Imediato:** Expandir apenas as iniciativas que superaram 80% do índice de corte da matriz.

## 3. Estudos de Caso Comparativos de Implementação

### Caso de Fracasso Analítico: A armadilha do crescimento sem fundamentos
Uma consultoria de tecnologia com faturamento de 15 milhões anuais tentou triplicar sua operação expandindo paralelamente para 4 novas verticais de negócio. Sem decompor as variáveis fundamentais de cada vertical, contratou executivos seniores e elevou seu custo fixo em 180%. Em menos de 9 meses, o índice de cancelamento triplicou e o capital de giro evaporou. A causa-raiz identificada foi a violação do princípio de foco em tração previsível e a negligência das métricas unitárias de retenção.

### Caso de Sucesso Exemplar: A virada por primeiros princípios
Em contrapartida, uma prestadora de serviços analíticos no mesmo setor aplicou o método estruturado deste livro. Diante de estagnação de margens, o comitê executivo auditou cada linha de custo, eliminou 40% das ofertas marginais de baixa lucratividade e concentrou 100% da força de vendas nas 2 ofertas com maior valor percebido e menor ciclo comercial. O resultado foi um aumento de 140% no lucro líquido em 180 dias, acompanhado de uma elevação do NPS de 62 para 89 pontos.

## 4. Playbook Operacional de Execução & Métricas de Controle

A execução sustentável exige disciplina metodológica e acompanhamento periódico. O cronograma abaixo sintetiza o ciclo de maturação para os primeiros 90 dias:

### Cronograma de Execução:
- **Dias 1 a 30 (Diagnóstico & Saneamento):** Auditoria factual de processos, eliminação de gargalos burocráticos e treinamento das lideranças nos frameworks essenciais da obra.
- **Dias 31 a 60 (Implementação Piloto & Ajustes):** Lançamento de protocolos operacionais nas unidades prioritárias com acompanhamento semanal de fricção e conversão.
- **Dias 61 a 90 (Consolidação & Escala):** Institucionalização definitiva dos KPIs de controle, expansão para todas as áreas e auditoria de sustentabilidade dos resultados.

### KPIs Mandatórios de Monitoramento Contínuo:
- **Índice de Eficiência Decisória (IED):** Tempo médio entre a identificação do problema e a execução da intervenção corretiva.
- **Densidade de Valor Unitário (DVU):** Retorno financeiro líquido gerado por hora operacional investida.
- **Taxa de Sustentação de Resultados (TSR):** Percentual de iniciativas que mantêm ou superam as metas estabelecidas após 12 semanas de operação plena.`;
    } else if (isJsonResponse && (prompt.includes("publicação editorial de livros") || prompt.includes("coverPrompt"))) {
      simulatedText = JSON.stringify(
        {
          coverPrompt: "Design minimalista e sofisticado para capa de livro editorial. Formato de folha: Royal Octavo (152.4 x 228.6 mm / proporção vertical 1:1.5 com sangria de 3mm). Composição equilibrada com amplo espaço negativo, tipografia serifada clássica de alto contraste e uma metáfora gráfica linear e sutil no terço inferior simbolizando clareza estratégica. Paleta cromática refinada em tons de azul ardósia profundo, papel linho cru e toques de cobre escovado. Acabamento visual para publicação de luxo.",
          suggestedCategories: "Administração, Negócios e Economia; Não-ficção; Autoajuda",
          marketingDescription: "GESTÃO ESTRATÉGICA & LIDERANÇA ÁGIL: O GUIA DEFINITIVO\n\nSobre a Obra:\nEste compêndio consolida as metodologias fundamentais da gestão contemporânea, integrando arquiteturas de decisão descentralizada, frameworks de objetivos dinâmicos (OKRs) e o cultivo intencional de uma cultura organizacional antifrágil.\n\nPúblico-Alvo:\nDesenvolvido especialmente para líderes executivos, gestores de equipes e empreendedores que buscam alta performance operacional.\n\nPrincipais Tópicos Abordados:\n- Descentralização e redução de fricção burocrática em decisões críticas\n- Arquitetura de metas de tração e alinhamento tático de times\n- Princípios práticos de antifragilidade e aprendizado com erros experimentais\n\nPor que ler este livro:\nUma síntese analítica, direta ao ponto e enriquecida com ferramentas de aplicação prática imediata para alavancar resultados organizacionais sustentáveis."
        },
        null,
        2
      );
    } else if (isJsonResponse) {
      simulatedText = JSON.stringify(
        {
          bookTitle: "Gestão Estratégica & Liderança Ágil: O Guia Definitivo",
          executiveSummary:
            "Este compêndio consolida as metodologias fundamentais da gestão contemporânea, integrando arquiteturas de decisão descentralizada, frameworks de objetivos dinâmicos (OKRs) e o cultivo intencional de uma cultura organizacional antifrágil. Voltado a líderes e gestores que operam em cenários de alta complexidade e incerteza.",
          targetAudience: systemConfig.TARGET_AUDIENCE,
          toneOfVoice: systemConfig.TONE_OF_VOICE,
          totalTargetWords: Math.round(systemConfig.MIN_PAGES * 280),
          chapters: [
            {
              chapterNumber: 1,
              title: "A Velocidade da Decisão Estruturada",
              synopsis: "Análise dos princípios de tomada de decisão descentralizada e redução de latência burocrática.",
              keyTopics: ["Agilidade Decisória", "Heurísticas de Ação", "Autonomia de Ponta"],
              ragSearchQueries: ["tomada de decisão", "agilidade decisória", "equipes autônomas"],
              targetWords: 3200
            },
            {
              chapterNumber: 2,
              title: "Arquitetura de Objetivos Dinâmicos e Alinhamento de Metas",
              synopsis: "Estruturação de métricas de resultado-chave conectadas à visão de longo prazo da organização.",
              keyTopics: ["OKRs Dinâmicos", "Métricas de Sucesso", "Sinergia Interdepartamental"],
              ragSearchQueries: ["OKRs", "metas dinâmicas", "alinhamento estratégico"],
              targetWords: 3200
            },
            {
              chapterNumber: 3,
              title: "Construção de uma Cultura Organizacional Antifrágil",
              synopsis: "Como cultivar segurança psicológica e converter erros experimentais em vantagem competitiva sustentável.",
              keyTopics: ["Antifragilidade", "Segurança Psicológica", "Liderança de Alta Performance"],
              ragSearchQueries: ["antifragilidade", "cultura forte", "segurança psicológica"],
              targetWords: 3200
            }
          ]
        },
        null,
        2
      );
    } else {
      simulatedText = `## Introdução ao Tema e Fundamentos Estruturados\n\nA liderança estratégica contemporânea exige uma transição definitiva de modelos hierárquicos rígidos para ecossistemas de alta adaptabilidade. Conforme evidenciado pelos dados do livro original, organizações com tomada de decisão descentralizada alcançam reduções de até 70% na latência de resposta a transformações de mercado.\n\n### Princípios de Operação e Aplicação Prática\n\n1. **Redução da Fricção Decisória:** Criação de protocolos claros onde equipes têm autoridade de execução imediata.\n2. **Alinhamento Transparente:** Comunicação contínua da tese central da empresa para garantir coerência operacional.\n3. **Cultura de Aprendizado Contínuo:** Institucionalização de retrospectivas sistemáticas e análise factual de resultados.\n\n> "A agilidade não é impulsividade, mas a capacidade estruturada de transformar dados em ações coordenadas de alto impacto."\n\n### Deduções Analíticas e Síntese Conclusiva\n\nO sucesso na implementação desses pilares reside na disciplina de execução e na blindagem de processos contra o excesso de burocracia, preparando a organização para prosperar em condições de volatilidade.`;
    }

    const tokensIn = Math.ceil(prompt.length / 4);
    const tokensOut = Math.ceil(simulatedText.length / 4);
    const costUsd = calculateCost(tokensIn, tokensOut);

    return {
      text: simulatedText,
      tokensIn,
      tokensOut,
      costUsd,
      latencyMs,
      model: `${modelName} (simulado)`,
    };
  }

  const generationConfig: Record<string, any> = {
    maxOutputTokens: options?.maxOutputTokens ?? 8192,
  };
  if (options?.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }
  if (options?.thinkingLevel) {
    generationConfig.thinking_level = options.thinkingLevel;
    generationConfig.thinkingConfig = {
      thinkingLevel: options.thinkingLevel,
    };
  }

  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: options?.systemInstruction,
    generationConfig: generationConfig as any,
  });

  const TIMEOUT_MS = 45_000;
  let retries = 2;
  let lastError: any = null;

  while (retries > 0) {
    let timerId: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(
          () => reject(new Error("Timeout excedido (45s) na chamada à API do Gemini")),
          TIMEOUT_MS
        );
      });

      const result = (await Promise.race([
        model.generateContent(prompt),
        timeoutPromise,
      ])) as any;

      const latencyMs = Date.now() - startTime;
      const response = result.response;
      const text = response.text();

      const usage = response.usageMetadata;
      const tokensIn = usage?.promptTokenCount || Math.ceil(prompt.length / 4);
      const tokensOut = usage?.candidatesTokenCount || Math.ceil(text.length / 4);
      const costUsd = calculateCost(tokensIn, tokensOut);

      return {
        text,
        tokensIn,
        tokensOut,
        costUsd,
        latencyMs,
        model: modelName,
      };
    } catch (err: any) {
      lastError = err;
      retries--;
      if (retries > 0) {
        await new Promise((res) => setTimeout(res, 1500 * (3 - retries)));
      }
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  }

  throw new Error(`Falha na chamada ao Gemini (${modelName}): ${lastError?.message || lastError}`);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getGeminiClient();
  if (!client || !text || !text.trim()) {
    return createFallbackEmbedding(text);
  }

  const model = client.getGenerativeModel({ model: "gemini-embedding-001" });
  const EMBED_TIMEOUT_MS = 10_000;

  let retries = 2;
  while (retries > 0) {
    let timerId: NodeJS.Timeout | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error("Timeout excedido (10s) na geração de embedding")), EMBED_TIMEOUT_MS);
      });

      const result = await Promise.race([
        model.embedContent({
          content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
          outputDimensionality: 768,
        } as any),
        timeoutPromise,
      ]);

      if (result && result.embedding && result.embedding.values) {
        return result.embedding.values;
      }
      return createFallbackEmbedding(text);
    } catch (err) {
      retries--;
      if (retries > 0) {
        await new Promise((res) => setTimeout(res, 1000));
      } else {
        return createFallbackEmbedding(text);
      }
    } finally {
      if (timerId) clearTimeout(timerId);
    }
  }
  return createFallbackEmbedding(text);
}

/**
 * Gera embeddings em lote (batch) de forma rápida e segura, evitando rate limits e travamentos
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) return [];

  const client = getGeminiClient();
  if (!client) {
    return texts.map((t) => createFallbackEmbedding(t));
  }

  const model = client.getGenerativeModel({ model: "gemini-embedding-001" });
  const BATCH_TIMEOUT_MS = 25_000;
  let timerId: NodeJS.Timeout | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error("Timeout excedido (25s) no lote de embeddings")), BATCH_TIMEOUT_MS);
    });

    const result = await Promise.race([
      model.batchEmbedContents({
        requests: texts.map((t) => ({
          content: { role: "user", parts: [{ text: (t || " ").slice(0, 8000) }] },
          outputDimensionality: 768,
        } as any)),
      }),
      timeoutPromise,
    ]);

    if (result && result.embeddings && Array.isArray(result.embeddings)) {
      return result.embeddings.map((emb, idx) =>
        emb && emb.values ? emb.values : createFallbackEmbedding(texts[idx])
      );
    }
    return texts.map((t) => createFallbackEmbedding(t));
  } catch (err: any) {
    console.warn(`[ai-rag] Falha no batch embedding (${err.message || err}), usando fallback determinístico.`);
    return texts.map((t) => createFallbackEmbedding(t));
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

// Deterministic semantic feature vector fallback for offline/test reliability
function createFallbackEmbedding(text: string): number[] {
  const dim = 768;
  const vec = new Array(dim).fill(0);
  const words = (text || "").toLowerCase().match(/\w+/g) || [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }
  // Normalize vector
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vec.map((v) => v / norm);
}
