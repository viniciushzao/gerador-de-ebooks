import fs from "fs";
import { callGemini } from "./gemini-client";
import { getSystemConfig } from "@/lib/config";
import {
  BookRecord,
  createTask,
  updateTask,
  addAuditLog,
  updateBook,
} from "@/lib/db/client";
import { queryRag } from "@/lib/rag/ai-rag-engine";
import { translateMermaidToEditorialGraphics } from "@/lib/export/visual-translator";
import { purgeMermaidDiagrams, cleanLatexMathFormatting } from "./chapter-writer";
import { generateNanoBananaVisualGraphic } from "@/lib/export/gemini-image-generator";

/**
 * Subagente Especialista em Apresentação do Livro
 * Elabora a apresentação oficial da obra: sucinta, clara e curta (1 a 3 páginas no máximo, ~300 a 700 palavras).
 */
export async function writeBookPresentationSubagent(
  book: BookRecord,
  traceId: string,
  parentTaskId: string | null
): Promise<string> {
  const config = getSystemConfig();
  const startTime = Date.now();
  const taskId = `task_presentation_${book.id}_${Date.now()}`;

  createTask({
    id: taskId,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: book.id,
    chapter_id: null,
    agent_role: "PRESENTATION_WRITER",
    status: "running",
    input_payload: JSON.stringify({
      title: book.title,
      targetPages: "1 a 3 páginas no máximo",
      toneOfVoice: config.TONE_OF_VOICE,
    }),
    output_payload: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_used: "useful-ai-prompts",
    error: null,
    created_at: new Date().toISOString(),
    finished_at: null,
  });

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: book.id,
    chapter_id: null,
    agent_role: "PRESENTATION_WRITER",
    level: "info",
    message: `Subagente de Apresentação ativado [Skill: useful-ai-prompts]. Formulando apresentação sucinta, clara e curta (1 a 3 páginas no máximo).`,
    metadata: JSON.stringify({
      bookTitle: book.title,
      targetPages: "1 a 3 páginas no máximo (~300 a 700 palavras)",
    }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_badge: "useful-ai-prompts",
    timestamp: new Date().toISOString(),
  });

  // Query RAG for holistic themes and core thesis of the book
  const ragResult = await queryRag(
    book.id,
    "tese central problema fundamental proposito valor pratico visao geral da obra",
    5,
    traceId,
    taskId,
    null
  );

  const contextText = ragResult.chunks
    .map((c) => `[Página ${c.pageNumber}]:\n${c.content}`)
    .join("\n\n---\n\n");

  const systemInstruction = `Você é o Subagente Especialista em Apresentação Editorial de Livros, operando sob o framework de First Principles de Elon Musk (/elon-musk) e munido das habilidades de alta densidade analítica [useful-ai-prompts].

SUA MISSÃO EXCLUSIVA:
Redigir a APRESENTAÇÃO OFICIAL DO LIVRO (Prefácio / Apresentação da Obra).
A apresentação deve ser SUCINTA, CLARA E CURTA, com extensão de 1 a 3 páginas no máximo (~300 a 700 palavras no total).

ESTRUTURA EDITORIAL DA APRESENTAÇÃO (OBRIGATÓRIA):
# Apresentação da Obra

## 1. O Problema Fundamental e a Tese Central
(1 a 2 parágrafos diretos e objetivos explicando por que este livro existe, o problema prático que ele soluciona e a premissa central da obra).

## 2. Visão Geral da Obra e Eixos Principais
(1 a 2 parágrafos sucintos sintetizando como o conhecimento está organizado e como os tópicos se articulam logicamente).

## 3. Como Extrair o Máximo Desta Leitura
(1 a 2 parágrafos concisos com orientações práticas para aplicação direta pelo leitor).

DIRETRIZES FUNDAMENTAIS & GUARDRAILS (TOLERÂNCIA ZERO):
1. SUCINTA, CLARA E DIRETA: Vá direto ao ponto, com prosa elegante, fluida e cativante. Não encha linguiça nem use clichês corporativos.
2. EXTENSÃO MÁXIMA: 1 a 3 páginas no máximo (~300 a 700 palavras). O texto deve ser compacto e legível em poucos minutos.
3. PROIBIÇÃO TOTAL DE DIAGRAMAS EM TEXTO: É expressamente PROIBIDO desenhar qualquer árvore ou caixa em texto ou ASCII.
4. PROIBIÇÃO TOTAL DE FORMATAÇÃO LATEX / MATH: É TERMINANTEMENTE PROIBIDO usar símbolos LaTeX ($...$, \\text, etc.).
5. PROIBIÇÃO ABSOLUTA DE MENÇÃO AO ANTIGRAVITY OU IA: O livro é de autoria estritamente humana de ${config.AUTHOR_NAME}.`;

  const userPrompt = `LIVRO: "${book.title}"
AUTOR: ${config.AUTHOR_NAME}
PÚBLICO-ALVO: ${config.TARGET_AUDIENCE}
TOM DE VOZ: ${config.TONE_OF_VOICE}

CONTEXTO DO LIVRO RECUPERADO VIA PLUGIN [ai-rag]:
${contextText}

Redija agora a Apresentação Oficial da Obra completa em Markdown, mantendo o texto sucinto, claro e curto (1 a 3 páginas no máximo, ~300 a 700 palavras):`;

  const geminiRes = await callGemini(userPrompt, {
    systemInstruction,
    maxOutputTokens: 2048,
  });

  let presentationMarkdown = geminiRes.text.trim();

  // Expurgar qualquer resquício de diagramas de texto ou LaTeX
  presentationMarkdown = purgeMermaidDiagrams(presentationMarkdown);
  presentationMarkdown = cleanLatexMathFormatting(presentationMarkdown);

  const wordCount = presentationMarkdown.split(/\s+/).filter(Boolean).length;
  const latencyMs = Date.now() - startTime;

  // Atualizar registro da tarefa
  updateTask(taskId, {
    status: "completed",
    output_payload: JSON.stringify({ wordCount, pages: Math.ceil(wordCount / 250) }),
    tokens_in: geminiRes.tokensIn,
    tokens_out: geminiRes.tokensOut,
    cost_usd: geminiRes.costUsd,
    latency_ms: latencyMs,
    finished_at: new Date().toISOString(),
  });

  // Atualizar livro no banco com a nova apresentação
  updateBook(book.id, {
    executive_summary: presentationMarkdown,
    total_tokens: book.total_tokens + geminiRes.tokensIn + geminiRes.tokensOut,
    total_cost_usd: Number((book.total_cost_usd + geminiRes.costUsd).toFixed(6)),
  });

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: book.id,
    chapter_id: null,
    agent_role: "PRESENTATION_WRITER",
    level: "info",
    message: `Apresentação da obra formulada com sucesso (${wordCount} palavras, ~${Math.ceil(wordCount / 250)} páginas).`,
    metadata: JSON.stringify({
      wordCount,
      estimatedPages: Math.ceil(wordCount / 250),
      tokensIn: geminiRes.tokensIn,
      tokensOut: geminiRes.tokensOut,
      costUsd: geminiRes.costUsd,
      latencyMs,
    }),
    tokens: geminiRes.tokensIn + geminiRes.tokensOut,
    cost_usd: geminiRes.costUsd,
    latency_ms: latencyMs,
    skill_badge: "useful-ai-prompts",
    timestamp: new Date().toISOString(),
  });

  return presentationMarkdown;
}
