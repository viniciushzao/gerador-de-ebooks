import { callGemini } from "./gemini-client";
import { getSystemConfig } from "@/lib/config";
import {
  BookRecord,
  ChapterRecord,
  createChapter,
  createTask,
  updateTask,
  addAuditLog,
  updateBook,
} from "@/lib/db/client";
import { queryRag } from "@/lib/rag/ai-rag-engine";
import { calculateBookVolumeRequirements, VolumeRequirements } from "@/lib/export/page-formats";
import { extractCleanJsonObject } from "@/lib/utils/json-parser";

export interface ChapterSectionPlan {
  sectionNumber: number;
  title: string;
  scope: string;
  targetWords: number;
}

export interface GeneratedChapterPlan {
  chapterNumber: number;
  title: string;
  synopsis: string;
  keyTopics: string[];
  ragSearchQueries: string[];
  topicCluster?: string;
  targetWords: number;
  sections?: ChapterSectionPlan[];
  specificDirectives?: string[];
}

export interface CeoBookPlan {
  bookTitle: string;
  executiveSummary: string;
  targetAudience: string;
  toneOfVoice: string;
  totalTargetWords: number;
  decidedChapterCount: number;
  decisionRationale?: string;
  chapters: GeneratedChapterPlan[];
}

/**
 * CEO Agent: Analyzes the vectorized book and builds the comprehensive chapter DAG plan
 */
export async function generateCeoPlan(
  book: BookRecord,
  traceId: string
): Promise<CeoBookPlan> {
  const config = getSystemConfig();
  const startTime = Date.now();

  const ceoTaskId = `task_ceo_plan_${book.id}_${Date.now()}`;
  createTask({
    id: ceoTaskId,
    trace_id: traceId,
    parent_task_id: null,
    book_id: book.id,
    chapter_id: null,
    agent_role: "CEO",
    status: "running",
    input_payload: JSON.stringify({
      bookTitle: book.title,
      minPages: config.MIN_PAGES,
      maxPages: config.MAX_PAGES,
      toneOfVoice: config.TONE_OF_VOICE,
    }),
    output_payload: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_used: "elon-musk",
    error: null,
    created_at: new Date().toISOString(),
    finished_at: null,
  });

  try {
    addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: null,
    book_id: book.id,
    chapter_id: null,
    agent_role: "CEO",
    level: "info",
    message: `CEO Orquestrador assumiu o comando sob a persona [Skill: elon-musk]. Aplicando First Principles Thinking e estruturando plano anti-fluff.`,
    metadata: JSON.stringify({ bookId: book.id, title: book.title, persona: "elon-musk" }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: "elon-musk",
    timestamp: new Date().toISOString(),
  });

  // Query RAG for overview chunks of the book
  const overviewResult = await queryRag(
    book.id,
    "resumo índice sumário tópicos principais introdução e conceitos centrais da obra",
    12,
    traceId,
    ceoTaskId,
    null
  );

  const contextText = overviewResult.chunks
    .map((c) => `[Página ${c.pageNumber}]:\n${c.content}`)
    .join("\n\n---\n\n");

  // Dimensionamento dinâmico e agnóstico de formatos e modelos de LLM
  const volume = calculateBookVolumeRequirements(
    book.page_size,
    book.min_pages || config.MIN_PAGES,
    book.max_pages || config.MAX_PAGES,
    3400 // meta de 3.400 palavras por capítulo para garantir densidade máxima
  );

  const prompt = `Você é o CEO e Agente Orquestrador Chefe de Coautoria de Livros no Antigravity, operando sob a persona e o framework intelectual de ELON MUSK (/elon-musk).

MISSÃO DO CEO (DECISOR CENTRAL & FIRST PRINCIPLES):
Você é o TOMADOR DE DECISÃO ABSOLUTO da arquitetura editorial da obra. Você NÃO opera com um número fixo ou reduzido de capítulos.
Sua responsabilidade é analisar os documentos originais submetidos via [ai-rag], desconstruir a temática em seus princípios mais fundamentais e DECIDIR DINAMICAMENTE:
1. QUANTIDADE EXATA DE CAPÍTULOS (REGRA MATEMÁTICA MANDATÓRIA):
   - Formato físico da folha selecionado: ${volume.format.name} (densidade média: ${volume.wordsPerPage} palavras/página).
   - Meta editorial mínima: ${volume.targetPages} páginas físicas reais impressas no PDF (totalizando aproximadamente ${volume.targetTotalWords} palavras no manuscrito completo).
   - Meta de profundidade por capítulo: Cada capítulo deve ser extenso e aprofundado, visando aproximadamente ${volume.targetWordsPerChapter} palavras (mínimo de 3.200 palavras).
   - CALIBRAÇÃO EXECUTIVA OBRIGATÓRIA: Para garantir que a obra atinja com segurança e rigor as ${volume.targetPages} páginas reais, você DEVE DEFINIR OBRIGATORIAMENTE ENTRE ${volume.recommendedChaptersMin} E ${volume.recommendedChaptersMax} CAPÍTULOS (É TERMINANTEMENTE PROIBIDO DEFINIR MENOS DE ${volume.recommendedChaptersMin} CAPÍTULOS). O array "chapters" deve conter todos os ${volume.recommendedChaptersMin} (ou mais) capítulos detalhados.
2. NOMES E ESCOPOS DOS CAPÍTULOS: Crie títulos de alto impacto, rigor analítico e sinopses ricas em primeiros princípios.
3. SEÇÕES ESTRUTURAIS OBRIGATÓRIAS POR CAPÍTULO: Para garantir que os subagentes escritores entreguem capítulos extensos (>3.200 palavras) com máxima densidade de conteúdo, você DEVE dividir CADA capítulo em 4 a 5 SEÇÕES ESTRUTURAIS EXPLÍCITAS (com títulos de subseção e escopo analítico claro visando de 800 a 1.100 palavras por seção).
4. DIRETRIZES EXECUTIVAS ESPECÍFICAS: Destaque os frameworks, dados e mecanismos do livro original que o escritor deve aprofundar obrigatoriamente.

DIRETRIZES DO CEO AOS SUBAGENTES:
1. RACIOCÍNIO POR PRIMEIROS PRINCÍPIOS: Não raciocine por analogia rasa. Decomponha cada conceito em suas verdades fundamentais.
2. ELIMINAÇÃO TOTAL DE FLUFF ("The best part is no part"): Máxima densidade analítica por palavra. Não resuma: aprofunde cada mecânica, causa-raiz, modelo de dados e playbook.
3. PROIBIÇÃO ABSOLUTA E INEGOCIÁVEL DE DIAGRAMAS EM TEXTO (MERMAID, ASCII & UNICODE BOXES): É terminantemente proibido gerar blocos Mermaid (\`\`\`mermaid), caixas ASCII (+---+, |, setas v, -->) ou caixas Unicode (┌, ┐, └, ┘, │, ├──, └──). Toda figura explicativa deve ser emitida via bloco json:nano-banana para renderização vetorial SVG 300 DPI.
4. PROIBIÇÃO ABSOLUTA DE FORMATAÇÃO LATEX / MATH: Use prosa clara ou equações em texto linear (ex: R$, %, /). Não use $ nem $$.
5. PROIBIÇÃO ABSOLUTA DE MENÇÃO AO ANTIGRAVITY OU IA: O livro é uma obra de autoria estritamente humana de ${config.AUTHOR_NAME}.
6. PROIBIÇÃO CATEGÓRICA DE 'CONEXÃO ESTRATÉGICA' E TRANSIÇÕES INTER-CAPÍTULOS: Nunca inclua nem instrua seções de 'Conexão Estratégica' ou transições entre capítulos. Cada capítulo deve ser 100% autocontido, denso e focado em sua própria tese e checklist de execução prática.
7. PROIBIÇÃO TOTAL DE CRIAÇÃO DE OBRAS FICTÍCIAS OU CRÉDITOS FALSOS: É expressamente PROIBIDO inventar livros, artigos, pesquisas ou teses inexistentes e atribuir autoria ao autor ${config.AUTHOR_NAME} ou a terceiros. Todo o conteúdo deve derivar estritamente do material original anexado ao RAG.

PARAMETROS DE NEGÓCIO:
- Autor: ${config.AUTHOR_NAME}
- Público-Alvo: ${config.TARGET_AUDIENCE}
- Tom de Voz: ${config.TONE_OF_VOICE}
- Formato de Folha: ${volume.format.name} (${volume.wordsPerPage} palavras/página)
- Meta de Páginas Físicas no PDF: Mínimo de ${volume.targetPages} páginas (Meta Total: ${volume.targetTotalWords} palavras)
- Meta por Capítulo: ~${volume.targetWordsPerChapter} palavras (mínimo de 3.200 palavras por capítulo)
- Faixa Obrigatória de Capítulos: ${volume.recommendedChaptersMin} a ${volume.recommendedChaptersMax} capítulos (NUNCA menos de ${volume.recommendedChaptersMin})

CONTEXTO VETORIZADO RECUPERADO VIA PLUGIN [ai-rag]:
${contextText}

Responda OBRIGATORIAMENTE em JSON válido com esta estrutura exata:
{
  "bookTitle": "Título Impactante e Conclusivo do Novo Livro",
  "executiveSummary": "Resumo executivo do livro (2 a 3 parágrafos delineando a tese central por primeiros princípios e a jornada do leitor)",
  "targetAudience": "${config.TARGET_AUDIENCE}",
  "toneOfVoice": "${config.TONE_OF_VOICE}",
  "totalTargetWords": ${volume.targetTotalWords},
  "decidedChapterCount": ${volume.recommendedChaptersMin},
  "decisionRationale": "Justificativa executiva do CEO explicando como esta estrutura com ${volume.recommendedChaptersMin} ou mais capítulos cobre o acervo original e atinge a meta de páginas físicas",
  "chapters": [
    /* ATENÇÃO OBRIGATÓRIA: Crie TODOS os capítulos de 1 a N (mínimo ${volume.recommendedChaptersMin} capítulos). Exemplo da estrutura de cada capítulo: */
    {
      "chapterNumber": 1,
      "title": "Título do Capítulo 1",
      "synopsis": "Descrição técnica e analítica por primeiros princípios do que este capítulo abordará",
      "keyTopics": ["Tópico A", "Tópico B", "Tópico C"],
      "ragSearchQueries": ["termo de busca 1 para ai-rag", "termo de busca 2"],
      "topicCluster": "geral",
      "targetWords": ${volume.targetWordsPerChapter},
      "sections": [
        {
          "sectionNumber": 1,
          "title": "Título da Seção 1.1",
          "scope": "Escopo e desconstrução analítica por primeiros princípios",
          "targetWords": 900
        },
        {
          "sectionNumber": 2,
          "title": "Título da Seção 1.2",
          "scope": "Frameworks causais e modelos mentais operacionais",
          "targetWords": 1100
        },
        {
          "sectionNumber": 3,
          "title": "Título da Seção 1.3",
          "scope": "Estudos de caso reais, desconstrução prática e playbooks",
          "targetWords": 900
        },
        {
          "sectionNumber": 4,
          "title": "Título da Seção 1.4",
          "scope": "Síntese conclusiva, armadilhas comuns e checklist de ação",
          "targetWords": 700
        }
      ],
      "specificDirectives": ["Diretriz executiva 1 para este capítulo", "Diretriz 2"]
    }
  ]
}

IMPORTANTE: Retorne ESTRITAMENTE o objeto JSON puro, sem formatação markdown envolvente, sem texto explicativo e sem comentários antes ou depois do fechamento da chave final }. Crie TODOS os capítulos no array (de 1 até ${volume.recommendedChaptersMin} ou mais).`;

  const geminiRes = await callGemini(prompt, {
    responseMimeType: "application/json",
  });

  let plan: CeoBookPlan;
  try {
    plan = extractCleanJsonObject<CeoBookPlan>(geminiRes.text);
  } catch (err: any) {
    console.error("Erro ao decodificar plano JSON do CEO:", err.message, "\nResposta bruta:\n", geminiRes.text?.substring(0, 500));
    throw new Error(`CEO não conseguiu gerar um plano JSON válido: ${err.message}`);
  }

  // Update book summary and metrics, preserving the user's defined title
  updateBook(book.id, {
    title: book.title || plan.bookTitle || "Livro Editorial",
    executive_summary: plan.executiveSummary,
    total_tokens: book.total_tokens + geminiRes.tokensIn + geminiRes.tokensOut,
    total_cost_usd: Number((book.total_cost_usd + geminiRes.costUsd).toFixed(6)),
    status: "outlining",
    current_step: "Plano de capítulos aprovado pelo CEO",
    progress_percent: 30,
  });

  // Create chapters and parallel tasks in DB
  for (const ch of plan.chapters) {
    const chapterId = `chap_${book.id}_${ch.chapterNumber}`;
    const sectionTitles = (ch.sections || []).map((s) => s.title);

    createChapter({
      id: chapterId,
      book_id: book.id,
      chapter_number: ch.chapterNumber,
      title: ch.title,
      synopsis: ch.synopsis,
      prompt: JSON.stringify({
        keyTopics: ch.keyTopics,
        ragSearchQueries: ch.ragSearchQueries,
        topicCluster: ch.topicCluster || "geral",
        sections: ch.sections || [],
        specificDirectives: ch.specificDirectives || [],
      }),
      target_words: ch.targetWords || volume.targetWordsPerChapter,
      actual_words: 0,
      status: "pending",
      sections: sectionTitles,
      content_markdown: "",
      trace_id: traceId,
      parent_task_id: ceoTaskId,
      tokens_used: 0,
      cost_usd: 0.0,
      latency_ms: 0,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const latencyMs = Date.now() - startTime;

  updateTask(ceoTaskId, {
    status: "completed",
    output_payload: JSON.stringify({
      decidedChapterCount: plan.chapters.length,
      totalTargetWords: plan.totalTargetWords,
    }),
    tokens_in: geminiRes.tokensIn,
    tokens_out: geminiRes.tokensOut,
    cost_usd: geminiRes.costUsd,
    latency_ms: latencyMs,
    finished_at: new Date().toISOString(),
  });

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: null,
    book_id: book.id,
    chapter_id: null,
    agent_role: "CEO",
    level: "info",
    message: `CEO definiu o plano dinâmico com ${plan.chapters.length} capítulos (Meta: ${plan.totalTargetWords} palavras, ~${volume.targetPages} págs no formato ${volume.format.name}). Racional: ${plan.decisionRationale || "Dimensionamento por primeiros princípios baseado no acervo."}`,
    metadata: JSON.stringify({
      bookTitle: plan.bookTitle,
      chapterCount: plan.chapters.length,
      targetTotalWords: plan.totalTargetWords,
      pageSize: volume.format.name,
      wordsPerPage: volume.wordsPerPage,
      decisionRationale: plan.decisionRationale,
    }),
    tokens: geminiRes.tokensIn + geminiRes.tokensOut,
    cost_usd: geminiRes.costUsd,
    latency_ms: latencyMs,
    skill_badge: "elon-musk",
    timestamp: new Date().toISOString(),
  });

  return plan;
} catch (err: any) {
  updateTask(ceoTaskId, {
    status: "failed",
    error: err.message || String(err),
    latency_ms: Date.now() - startTime,
    finished_at: new Date().toISOString(),
  });
  throw err;
}
}
