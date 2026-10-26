import fs from "fs";
import { callGemini } from "./gemini-client";
import { getSystemConfig } from "@/lib/config";
import {
  ChapterRecord,
  createTask,
  updateTask,
  updateChapter,
  addAuditLog,
} from "@/lib/db/client";
import { queryRag } from "@/lib/rag/ai-rag-engine";
import { generateExplanatoryGraphic } from "@/lib/export/image-generator";
import { reviewAndValidateImage } from "./image-reviewer";
import { translateMermaidToEditorialGraphics } from "@/lib/export/visual-translator";
import { generateNanoBananaVisualGraphic } from "@/lib/export/gemini-image-generator";

export async function writeChapterSubagent(
  chapter: ChapterRecord,
  bookTitle: string,
  traceId: string,
  parentTaskId: string
): Promise<string> {
  const config = getSystemConfig();
  const startTime = Date.now();
  const taskId = `task_writer_${chapter.id}_${Date.now()}`;

  createTask({
    id: taskId,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: chapter.book_id,
    chapter_id: chapter.id,
    agent_role: "WRITER",
    status: "running",
    input_payload: JSON.stringify({
      chapterNumber: chapter.chapter_number,
      title: chapter.title,
      targetWords: chapter.target_words,
    }),
    output_payload: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_used: "snow-d3,opendata-openchart,useful-ai-prompts,ai-rag",
    error: null,
    created_at: new Date().toISOString(),
    finished_at: null,
  });

  try {
    addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: chapter.book_id,
    chapter_id: chapter.id,
    agent_role: `WRITER (Capítulo ${chapter.chapter_number})`,
    level: "info",
    message: `Subagente Escritor ativado para o Capítulo ${chapter.chapter_number}: "${chapter.title}" [Skills: snow-d3, opendata-openchart, useful-ai-prompts].`,
    metadata: JSON.stringify({
      chapterNumber: chapter.chapter_number,
      title: chapter.title,
      targetWords: chapter.target_words,
    }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: "snow-d3",
    timestamp: new Date().toISOString(),
  });

  // Extract search queries, topicCluster, sections and specificDirectives from chapter prompt
  let searchQueries: string[] = [chapter.title];
  let topicCluster: string | undefined = undefined;
  let parsedSections: Array<{ sectionNumber?: number; title: string; scope: string; targetWords?: number }> = [];
  let specificDirectives: string[] = [];

  try {
    const parsedPrompt = JSON.parse(chapter.prompt);
    if (parsedPrompt.ragSearchQueries && parsedPrompt.ragSearchQueries.length > 0) {
      searchQueries = parsedPrompt.ragSearchQueries;
    }
    if (parsedPrompt.topicCluster) {
      topicCluster = parsedPrompt.topicCluster;
    }
    if (parsedPrompt.sections && Array.isArray(parsedPrompt.sections) && parsedPrompt.sections.length > 0) {
      parsedSections = parsedPrompt.sections;
    }
    if (parsedPrompt.specificDirectives && Array.isArray(parsedPrompt.specificDirectives)) {
      specificDirectives = parsedPrompt.specificDirectives;
    }
  } catch (e) {
    searchQueries = [chapter.title, ...chapter.synopsis.split(" ").slice(0, 5)];
  }

  // Fallback de seções estruturais caso não tenham sido enviadas pelo CEO
  if (parsedSections.length === 0) {
    parsedSections = [
      {
        sectionNumber: 1,
        title: "Tese Central e Fundamentos por Primeiros Princípios",
        scope: "Decomposição lógica das premissas fundamentais, origem dos conceitos e definições operacionais.",
        targetWords: 900,
      },
      {
        sectionNumber: 2,
        title: "Frameworks Conceituais e Mecanismos Causais",
        scope: "Estruturação das relações de causa e efeito, equações lineares e modelos conceituais.",
        targetWords: 1000,
      },
      {
        sectionNumber: 3,
        title: "Casos Práticos, Aplicação no Mundo Real e Teardowns",
        scope: "Análise de aplicação detalhada, estudos de caso do material de referência e cenários reais.",
        targetWords: 900,
      },
      {
        sectionNumber: 4,
        title: "Síntese Crítica, Armadilhas a Evitar e Checklist de Execução",
        scope: "Guia tático de implementação, erros frequentes e checklist prático de execução.",
        targetWords: 700,
      },
    ];
  }

  // Retrieve relevant RAG chunks in parallel with topic routing
  const ragResults = await Promise.all(
    searchQueries.map((query) =>
      queryRag(
        chapter.book_id,
        query,
        5,
        traceId,
        taskId,
        chapter.id,
        topicCluster
      )
    )
  );

  let combinedContext = "";
  for (let i = 0; i < searchQueries.length; i++) {
    const query = searchQueries[i];
    const ragResult = ragResults[i];
    const chunkText = ragResult.chunks
      .map((c) => `[Página ${c.pageNumber}]:\n${c.content}`)
      .join("\n\n");
    combinedContext += `\n\n--- Resultados para "${query}" ---\n${chunkText}`;
  }

  const systemInstruction = `Você é um Escritor Especialista e Subagente de Capítulo de Livro, treinado com as metodologias de visualização e design de dados [snow-d3, opendata-openchart, useful-ai-prompts] e operando sob as diretrizes de First Principles de Elon Musk (/elon-musk).
Sua missão é redigir um texto de altíssimo nível editorial, rigor conceitual e máxima densidade analítica, atuando como um "FACILITADOR DO ENTENDIMENTO DO LIVRO INICIAL".

HABILIDADES DE VISUALIZAÇÃO E DESIGN (SNOW-D3 & OPENDATA):
- PROIBIÇÃO TOTAL E INEGOCIÁVEL DE DIAGRAMAS EM TEXTO (ZERO ASCII & ZERO UNICODE BOXES):
  * É EXPRESSAMENTE E CATEGORICAMENTE PROIBIDO desenhar caixas de texto ou árvores hierárquicas usando caracteres como: ┌, ┐, └, ┘, ├, ┤, ┬, ┴, ─, │, ▼, ▲, ├──, └──, +---+, |, v, -->, ====.
  * É PROIBIDO desenhar linhas do tempo com barras verticais e setas (ex: "Ano 0 -> ... | Ano 1 -> ...").
- TRADUÇÃO VISUAL & MOTOR NANO BANANA 2 (REGRA OBRIGATÓRIA):
  * A geração de gráficos NÃO É OBRIGATÓRIA em todas as seções. Coloque figuras APENAS quando julgar estritamente necessário para elucidar um modelo mental, arquitetura, matriz de decisão ou fluxo estratégico.
  * Se for incluir um gráfico, use SEMPRE o bloco json:nano-banana:
    \`\`\`json:nano-banana
    {
      "conceptType": "strategic_flow" | "conceptual_pillars" | "comparison_table" | "decision_matrix" | "timeline" | "financial_cascade",
      "title": "Título Claro e Conciso da Figura",
      "caption": "Legenda explicativa sucinta da figura",
      "items": [
        { "label": "Rótulo 1", "description": "Explicação técnica clara e concisa." },
        { "label": "Rótulo 2", "description": "Explicação técnica clara e concisa." }
      ]
    }
    \`\`\`

DIRETRIZES FUNDAMENTAIS:
1. ANCORAGEM FACTUAL ESTREITA: Baseie todas as explicações estritamente no conteúdo recuperado do livro original fornecido no contexto.
2. PROIBIÇÃO ABSOLUTA DE ALUCINAÇÃO OU CRIAÇÃO DE OBRAS FICTÍCIAS: É TERMINANTEMENTE PROIBIDO inventar livros, artigos, pesquisas, títulos de obras ou teses inexistentes e atribuir autoria ao autor ${config.AUTHOR_NAME} ou a terceiros. Todo o conteúdo, conceitos e citações devem derivar exclusivamente do material de referência anexado.
3. PROIBIÇÃO CATEGÓRICA DE 'CONEXÃO ESTRATÉGICA' E TRANSIÇÕES INTER-CAPÍTULOS: É TERMINANTEMENTE PROIBIDO criar títulos, subtítulos ou seções chamadas "Conexão Estratégica" ou usar frases de transição entre capítulos (ex: "como veremos no próximo capítulo", "no próximo capítulo abordaremos", "no capítulo seguinte"). Cada capítulo deve ser 100% autocontido, denso, aprofundado e focado estritamente em sua própria tese e checklist de execução prática.
4. DENSIDADE ANALÍTICA & ZERO FLUFF: Raciocine por primeiros princípios. Decomponha os mecanismos causais passo a passo com profundidade real.
5. PROIBIÇÃO ABSOLUTA DE FORMATAÇÃO LATEX / MATH: É TERMINANTEMENTE PROIBIDO usar símbolos LaTeX ($...$, $$...$$, \\text, \\frac, etc.). Escreva equações matemáticas em PROSA CLARA ou em NOTAÇÃO LINEAR (ex: R$, %, /).
6. PROIBIÇÃO ABSOLUTA DE MENÇÃO AO ANTIGRAVITY OU IA: O livro é assinado estritamente por ${config.AUTHOR_NAME}.`;

  // Divisão em dois blocos complementares para garantir >3.000 palavras no capítulo consolidado
  const midpoint = Math.ceil(parsedSections.length / 2);
  const part1Sections = parsedSections.slice(0, midpoint);
  const part2Sections = parsedSections.slice(midpoint);

  const directivesText = specificDirectives.length > 0
    ? `\nDIRETRIZES ESPECÍFICAS DO CEO:\n${specificDirectives.map((d) => `- ${d}`).join("\n")}`
    : "";

  // ---------------- FASE 1: TESE INICIAL, FUNDAMENTOS & DESCONSTRUÇÃO ANALÍTICA ----------------
  const promptPart1 = `LIVRO: "${bookTitle}"
AUTOR: ${config.AUTHOR_NAME}
PÚBLICO-ALVO: ${config.TARGET_AUDIENCE}
TOM DE VOZ: ${config.TONE_OF_VOICE}

CAPÍTULO: ${chapter.chapter_number} - "${chapter.title}"
SINOPSE: ${chapter.synopsis}
${directivesText}

MISSÃO DA PARTE 1 (META: ~1.800 A 2.200 PALAVRAS):
Redija a ABERTURA e a PRIMEIRA METADE deste capítulo.
PROIBIÇÃO MANDATÓRIA DE RESUMOS TELEGRÁFICOS: Desenvolva cada subseção com riqueza de detalhes, causas-raiz, desconstrução por primeiros princípios e no mínimo 4 a 6 parágrafos aprofundados por seção.
Estruture o texto obrigatoriamente com:
# Capítulo ${chapter.chapter_number}: ${chapter.title}

Introdução aprofundada: tese central por primeiros princípios e desconstrução do problema.

${part1Sections
  .map(
    (s, idx) => `## ${s.title}
**Escopo Mandatório:** ${s.scope}
(Meta Mandatória: desenvolva uma análise exaustiva, profunda e detalhada com aproximadamente ${Math.max(s.targetWords || 900, 900)} palavras nesta seção)`
  )
  .join("\n\n")}

CONTEXTO VETORIZADO DO LIVRO ORIGINAL [ai-rag]:
${combinedContext || "Utilize os conceitos centrais do livro base."}

Redija agora a Parte 1 em Markdown denso, aprofundado e rico em mecanismos explicativos (mínimo de 1.800 palavras):`;

  const part1Res = await callGemini(promptPart1, {
    systemInstruction,
    maxOutputTokens: 8192,
  });

  // ---------------- FASE 2: FRAMEWORKS OPERACIONAIS, ESTUDOS DE CASO & PLAYBOOK PRÁTICO ----------------
  const promptPart2 = `LIVRO: "${bookTitle}"
AUTOR: ${config.AUTHOR_NAME}
PÚBLICO-ALVO: ${config.TARGET_AUDIENCE}
TOM DE VOZ: ${config.TONE_OF_VOICE}

CAPÍTULO: ${chapter.chapter_number} - "${chapter.title}"
SINOPSE: ${chapter.synopsis}
${directivesText}

MISSÃO DA PARTE 2 (META: ~1.800 A 2.200 PALAVRAS):
Você é a CONTINUAÇÃO DIRETA E IMEDIATA da Parte 1 deste mesmo capítulo. A Parte 1 já apresentou a tese inicial e os fundamentos teóricos.
Sua missão é redigir a SEGUNDA METADE prática, analítica e conclusiva do capítulo.
PROIBIÇÃO MANDATÓRIA DE RESUMOS CURTOS: Não sintetize de forma breve. Detalhe os passos operacionais, frameworks práticos, erros críticos a evitar e casos reais com máxima profundidade.
NÃO repita o título principal "# Capítulo ${chapter.chapter_number}". Comece diretamente na primeira seção indicada abaixo.

Estruture o texto obrigatoriamente com:
${part2Sections
  .map(
    (s, idx) => `## ${s.title}
**Escopo Mandatório:** ${s.scope}
(Meta Mandatória: desenvolva uma análise minuciosa com exemplos, teardowns e aproximadamente ${Math.max(s.targetWords || 900, 900)} palavras nesta seção)`
  )
  .join("\n\n")}

### Síntese Crítica, Erros Críticos a Evitar e Checklist de Execução
(Apresente um checklist aprofundado de execução prática com armadilhas a evitar e métricas de controle imediatas. NUNCA crie seções chamadas 'Conexão Estratégica' nem adicione transições para o próximo capítulo; o capítulo deve ser 100% autocontido).

CONTEXTO VETORIZADO DO LIVRO ORIGINAL [ai-rag]:
${combinedContext || "Utilize os conceitos centrais do livro base."}

Redija agora a Parte 2 em Markdown, com máxima densidade de aplicação e foco em execução (mínimo de 1.800 palavras):`;

  const part2Res = await callGemini(promptPart2, {
    systemInstruction,
    maxOutputTokens: 8192,
  });

  // Consolidação harmoniosa das duas partes do capítulo (>3.000 palavras garantidas)
  let contentMarkdown = `${part1Res.text.trim()}\n\n${part2Res.text.trim()}`;

  const totalTokensIn = part1Res.tokensIn + part2Res.tokensIn;
  const totalTokensOut = part1Res.tokensOut + part2Res.tokensOut;
  const totalCostUsd = Number((part1Res.costUsd + part2Res.costUsd).toFixed(6));

  // Tradução automática e inteligente de qualquer Mermaid, diagrama ASCII ou árvores Unicode residuais para Imagens Vetoriais D3/OpenChart
  const translationRes = await translateMermaidToEditorialGraphics(
    contentMarkdown,
    chapter.book_id,
    chapter.id,
    chapter.chapter_number,
    traceId,
    taskId
  );
  contentMarkdown = translationRes.markdown;

  // Expurgar de forma agressiva qualquer resquício de diagramas mermaid, blocos em texto, arte ASCII ou Unicode box drawings
  contentMarkdown = purgeMermaidDiagrams(contentMarkdown);

  // Sanitização ativa de LaTeX / Math formulas para prosa limpa e legível
  contentMarkdown = cleanLatexMathFormatting(contentMarkdown);

  // Expurgar qualquer menção residual a 'Conexão Estratégica' e transições entre capítulos
  contentMarkdown = purgeStrategicConnections(contentMarkdown);

  // GERAÇÃO DE IMAGENS EXPLICATIVAS (NANO BANANA 2 / GEMINI ENGINE):
  // Não é obrigatório em todos os capítulos; o subagente aciona apenas quando julgar estritamente necessário.
  const requiresVisualGraphic =
    contentMarkdown.includes("[GERAR_FIGURA]") ||
    contentMarkdown.includes("[MODELO_VISUAL]") ||
    (chapter.chapter_number === 1 && !contentMarkdown.includes("<figure class=\"editorial-image\">"));

  if (requiresVisualGraphic && !contentMarkdown.includes("<figure class=\"editorial-image\">")) {
    let keyTopics = [
      { label: "Fundamento Lógico", description: "Decomposição por primeiros princípios e validação causal." },
      { label: "Execução Prática", description: "Implementação direta com autoridade e eliminação de fricção." },
      { label: "Síntese Conclusiva", description: "Resultados mensuráveis e impacto escalável." },
    ];

    try {
      const parsedPrompt = JSON.parse(chapter.prompt);
      if (parsedPrompt.keyTopics && parsedPrompt.keyTopics.length > 0) {
        keyTopics = parsedPrompt.keyTopics.slice(0, 4).map((t: string) => ({
          label: t,
          description: `Análise estruturada e desdobramento estratégico de ${t} no contexto do capítulo.`,
        }));
      }
    } catch {}

    const visualResult = await generateNanoBananaVisualGraphic({
      bookId: chapter.book_id,
      chapterNumber: chapter.chapter_number,
      title: `Arquitetura Conceitual: ${chapter.title}`,
      conceptDescription: chapter.synopsis,
      conceptType: chapter.chapter_number % 2 === 0 ? "strategic_flow" : "conceptual_pillars",
      items: keyTopics,
      traceId,
      taskId,
    });

    if (visualResult.success && visualResult.htmlTag) {
      // Inserir a imagem após a introdução do capítulo
      const introSplit = contentMarkdown.split("\n\n");
      if (introSplit.length > 3) {
        introSplit.splice(3, 0, visualResult.htmlTag);
        contentMarkdown = introSplit.join("\n\n");
      } else {
        contentMarkdown += visualResult.htmlTag;
      }
    }
  }

  // Limpar marcadores residuais de pedido de imagem
  contentMarkdown = contentMarkdown.replace(/\[(?:GERAR_FIGURA|MODELO_VISUAL|IMAGEM_EXPLICATIVA)[^\]]*\]/gi, "");

  const wordCount = contentMarkdown.split(/\s+/).filter(Boolean).length;
  const latencyMs = Date.now() - startTime;

  // Update chapter record
  updateChapter(chapter.id, {
    status: "completed",
    content_markdown: contentMarkdown,
    actual_words: wordCount,
    tokens_used: totalTokensIn + totalTokensOut,
    cost_usd: totalCostUsd,
    latency_ms: latencyMs,
    error_message: null,
  });

  // Update task record
  updateTask(taskId, {
    status: "completed",
    output_payload: JSON.stringify({ wordCount, length: contentMarkdown.length }),
    tokens_in: totalTokensIn,
    tokens_out: totalTokensOut,
    cost_usd: totalCostUsd,
    latency_ms: latencyMs,
    finished_at: new Date().toISOString(),
  });

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: chapter.book_id,
    chapter_id: chapter.id,
    agent_role: `WRITER (Capítulo ${chapter.chapter_number})`,
    level: "info",
    message: `Subagente Escritor finalizou o Capítulo ${chapter.chapter_number} (${wordCount} palavras geradas).`,
    metadata: JSON.stringify({
      chapterNumber: chapter.chapter_number,
      wordCount,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
      costUsd: totalCostUsd,
      latencyMs,
    }),
    tokens: totalTokensIn + totalTokensOut,
    cost_usd: totalCostUsd,
    latency_ms: latencyMs,
    skill_badge: "snow-d3",
    timestamp: new Date().toISOString(),
  });

  return contentMarkdown;
} catch (err: any) {
  updateTask(taskId, {
    status: "failed",
    error: err.message || String(err),
    latency_ms: Date.now() - startTime,
    finished_at: new Date().toISOString(),
  });
  throw err;
}
}

/**
 * Completely eliminates any Mermaid code block, inline textual diagram syntax, Unicode tree/box drawings, or raw ASCII art boxes.
 * Forces all visual representations to be high-resolution images.
 */
export function purgeMermaidDiagrams(raw: string): string {
  if (!raw) return "";

  let cleaned = raw;

  // 1. Remove fenced code blocks with mermaid or diagram identifiers
  cleaned = cleaned.replace(/```\s*(?:mermaid|graph|flowchart|sequenceDiagram|classDiagram|gantt|pie|erDiagram|journey|gitGraph|mindmap|timeline)[\s\S]*?```/gi, "");

  // 2. Remove any HTML containers with mermaid class
  cleaned = cleaned.replace(/<\s*(?:pre|div)\b[^>]*class\s*=\s*['"][^'"]*mermaid[^'"]*['"][^>]*>[\s\S]*?<\s*\/\s*(?:pre|div)\s*>/gi, "");

  // 3. Remove raw un-fenced Mermaid definitions that might leak into the markdown
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:graph\s+(?:TD|TB|BT|RL|LR)|flowchart\s+(?:TD|TB|BT|RL|LR)|sequenceDiagram|classDiagram|erDiagram)[\s\S]*?(?=\n\s*\n\s*#|\n\s*\n\s*##|\n\s*\n\s*###|$)/gi, "");

  // 4. Remove residual ASCII box art diagrams (+---+, | ... |, +---+)
  cleaned = cleaned.replace(/(?:[ \t]*\+[-+=| \t]+\+[ \t]*\n)+(?:[ \t]*\|[^\n]*\|[ \t]*\n|[ \t]*\+[-+=| \t]+\+[ \t]*\n|[ \t]*[|v^>< \t]+\n)+[ \t]*\+[-+=| \t]+\+/gi, "");

  // 5. Remove residual Unicode box drawing diagrams (┌───┐, └───┘, │, ├, ┤, ┬, ┴, ├──, └──)
  cleaned = cleaned.replace(/(?:[ \t]*[┌+├└│▼▲├──└──|─\-–=]{2,}[^\n]*\n(?:[ \t]*[│|┌┐└┘├┤┬┴▼▲├──└──].*\n?)+)/gi, "");

  // 6. Clean isolated border characters that may remain
  cleaned = cleaned.replace(/^[ \t]*[┌┐└┘├┤┬┴─│▼▲├──└──+=\-|]{3,}[ \t]*$/gm, "");

  // 7. Clean consecutive divider lines like ======
  cleaned = cleaned.replace(/^[ \t]*={4,}[ \t]*$/gm, "");

  return cleaned;
}

/**
 * Sanitizes and converts LaTeX/MathJax syntax ($...$, $$...$$, \frac, \text, etc.)
 * into clean, readable linear text and blockquotes for books without KaTeX renderers.
 */
export function cleanLatexMathFormatting(raw: string): string {
  if (!raw) return "";

  let cleaned = raw;

  // 0. Converter moeda isolada com cifrão ($150.000 -> R$ 150.000) para evitar conflito com delimitador LaTeX
  cleaned = cleaned.replace(/(?<![A-Za-z])\$(\d+(?:[.,]\d+)*)/g, "R$ $1");

  // 1. Process block math $$ ... $$
  cleaned = cleaned.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => {
    const expr = formatLatexExpression(inner.trim());
    return `\n\n> **Fórmula / Relação:** ${expr}\n\n`;
  });

  // 2. Process inline math $ ... $
  cleaned = cleaned.replace(/\$([^\$\n]+?)\$/g, (_, inner) => {
    return formatLatexExpression(inner.trim());
  });

  // 3. Process decimal commas in Portuguese notation: 0{,}90 -> 0,90
  cleaned = cleaned.replace(/(\d+)\s*\{,\}\s*(\d+)/g, "$1,$2");
  cleaned = cleaned.replace(/\{,\}/g, ",");

  // 4. Process remaining unescaped LaTeX tags without destroying paragraph breaks
  for (let i = 0; i < 5 && /\\(text|mathrm|mathbf|mathcal|textit|textbf)\s*\{([\s\S]*?)\}/.test(cleaned); i++) {
    cleaned = cleaned.replace(/\\(text|mathrm|mathbf|mathcal|textit|textbf)\s*\{([\s\S]*?)\}/g, "$2");
  }
  cleaned = cleaned.replace(/text\{\s*([^\}]+)\s*\}/gi, "$1");

  for (let i = 0; i < 5 && /\\frac\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/.test(cleaned); i++) {
    cleaned = cleaned.replace(/\\frac\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g, "($1 / $2)");
  }

  cleaned = cleaned.replace(/_\{([\s\S]*?)\}/g, "_$1");
  cleaned = cleaned.replace(/\^\{([\s\S]*?)\}/g, "^$1");
  cleaned = cleaned.replace(/\\times/g, " * ");
  cleaned = cleaned.replace(/\\cdot/g, " * ");
  cleaned = cleaned.replace(/\\div/g, " / ");
  cleaned = cleaned.replace(/\\sum/g, "Somatório de");
  cleaned = cleaned.replace(/\\approx/g, " ≈ ");
  cleaned = cleaned.replace(/\\neq/g, " != ");
  cleaned = cleaned.replace(/\\le(q)?/g, " <= ");
  cleaned = cleaned.replace(/\\ge(q)?/g, " >= ");
  cleaned = cleaned.replace(/\\infty/g, "infinito");
  cleaned = cleaned.replace(/\\Delta/g, "Variação ");
  cleaned = cleaned.replace(/\\%/g, "%");
  cleaned = cleaned.replace(/\\([ \t])/g, "$1");
  cleaned = cleaned.replace(/\\([$%&_#])/g, "$1");

  // Fix escaped currency symbols: R\ 1.330.000 -> R$ 1.330.000
  cleaned = cleaned.replace(/R\\\s*(\d)/gi, "R$ $1");
  cleaned = cleaned.replace(/R\s*\\\s*(\d)/gi, "R$ $1");

  // Clean numbers wrapped in braces: {1.000.000} -> 1.000.000
  cleaned = cleaned.replace(/\{(\d+(?:[.,]\d+)?)\}/g, "$1");

  // Clean empty parentheses leftover from removed symbols
  cleaned = cleaned.replace(/\(\s*\)/g, "");

  // Format single-line equations to prevent page margin overflows
  cleaned = formatEquationsForEditorial(cleaned);

  return cleaned;
}

export function formatEquationsForEditorial(markdown: string): string {
  if (!markdown) return "";
  const lines = markdown.split("\n");
  const processed: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Evitar interceptar linhas de diagramas, JSONs, listas ou títulos
    const isDiagramOrStructure =
      trimmed.startsWith("[") ||
      trimmed.startsWith("(") ||
      trimmed.startsWith("|") ||
      trimmed.startsWith("v") ||
      trimmed.startsWith("-->") ||
      trimmed.startsWith("->") ||
      trimmed.startsWith("{") ||
      trimmed.startsWith("}") ||
      trimmed.startsWith("\"") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("<") ||
      trimmed.startsWith("```") ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("-") ||
      trimmed.startsWith("•");

    const isEquation =
      !isDiagramOrStructure &&
      trimmed.includes(" = ") &&
      /[/*+%\-]/.test(trimmed) &&
      trimmed.length > 25;

    if (isEquation) {
      processed.push(`\n<div class="editorial-formula-box">\n  <span class="formula-label">Fórmula / Relação Analítica:</span>\n  <div class="formula-content">${trimmed}</div>\n</div>\n`);
    } else {
      processed.push(line);
    }
  }

  return processed.join("\n");
}

function formatLatexExpression(expr: string): string {
  let res = expr;

  // Decimal comma in math mode: 0{,}90 -> 0,90
  res = res.replace(/(\d+)\s*\{,\}\s*(\d+)/g, "$1,$2");
  res = res.replace(/\{,\}/g, ",");

  // Replace common currency commands inside math
  res = res.replace(/\\text\{\s*R\$\s*\}/gi, "R$ ");
  res = res.replace(/\\text\{\s*\$\s*\}/gi, "R$ ");
  res = res.replace(/\\text\{\s*USD\s*\}/gi, "USD ");
  res = res.replace(/text\{\s*R\\?\$?\s*\}/gi, "R$ ");

  // Unroll \text{...}, \mathrm, \mathbf, \mathcal, \textit, \textbf first
  for (let i = 0; i < 5 && /\\(text|mathrm|mathbf|mathcal|textit|textbf)\s*\{([\s\S]*?)\}/.test(res); i++) {
    res = res.replace(/\\(text|mathrm|mathbf|mathcal|textit|textbf)\s*\{([\s\S]*?)\}/g, "$2");
  }
  res = res.replace(/text\{\s*([^\}]+)\s*\}/gi, "$1");

  // Handle \frac{A}{B} recursively with multiline support
  for (let i = 0; i < 5 && /\\frac\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/.test(res); i++) {
    res = res.replace(/\\frac\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g, "($1 / $2)");
  }

  // Handle subscripts and superscripts like P_{marca} or MS_{un}
  res = res.replace(/_\{([\s\S]*?)\}/g, "_$1");
  res = res.replace(/\^\{([\s\S]*?)\}/g, "^$1");

  // Operators & Mathematical Symbols
  res = res.replace(/\\times/g, " * ");
  res = res.replace(/\\cdot/g, " * ");
  res = res.replace(/\\div/g, " / ");
  res = res.replace(/\\sum/g, "Somatório de");
  res = res.replace(/\\approx/g, " ≈ ");
  res = res.replace(/\\neq/g, " != ");
  res = res.replace(/\\le(q)?/g, " <= ");
  res = res.replace(/\\ge(q)?/g, " >= ");
  res = res.replace(/\\infty/g, "infinito");
  res = res.replace(/\\Delta/g, "Variação ");
  res = res.replace(/\\%/g, "%");
  res = res.replace(/\\([ \t])/g, "$1");
  res = res.replace(/\\([$%&_#])/g, "$1");

  // Clean numbers wrapped in braces: {1.000.000} -> 1.000.000
  res = res.replace(/\{(\d+(?:[.,]\d+)?)\}/g, "$1");

  // Clean remaining isolated LaTeX backslashes before words
  res = res.replace(/\\([a-zA-Z]+)/g, "$1");

  // Clean empty parentheses leftover
  res = res.replace(/\(\s*\)/g, "");

  // Clean excessive spaces or linebreaks inside the single formula
  res = res.replace(/[ \t]+/g, " ");
  res = res.replace(/\s*\n\s*/g, " ");

  return res.trim();
}

/**
 * Remove qualquer menção ou título de 'Conexão Estratégica' e transições inter-capítulos,
 * assegurando que cada capítulo seja 100% autocontido e analítico.
 */
export function purgeStrategicConnections(raw: string): string {
  if (!raw) return "";

  let cleaned = raw;

  // 1. Substituir cabeçalhos que mencionam Conexão Estratégica
  cleaned = cleaned.replace(
    /#{1,4}\s*(?:Síntese\s+Executiva,?\s*)?(?:Erros\s+Críticos\s+e\s*)?Conex[aã]o\s+Estrat[eé]gica[^\n]*/gi,
    "### Síntese Crítica, Erros Críticos a Evitar e Checklist de Execução"
  );
  cleaned = cleaned.replace(
    /#{1,4}\s*Conex[aã]o\s+Estrat[eé]gica[^\n]*/gi,
    "### Checklist de Execução e Diretrizes Práticas"
  );

  // 2. Limpar frases de transição explícitas para próximos capítulos
  cleaned = cleaned.replace(
    /(?:No\s+próximo\s+capítulo|No\s+capítulo\s+seguinte|Como\s+veremos\s+no\s+próximo\s+capítulo)[^.\n]*\./gi,
    ""
  );

  return cleaned;
}
