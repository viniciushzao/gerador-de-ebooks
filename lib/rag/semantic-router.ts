import { UnifiedVectorStore, HybridSearchResult } from "./unified-vector-store";
import { generateEmbedding } from "../agents/gemini-client";

export interface SemanticQueryOptions {
  bookId?: string;
  documentIds?: string[];
  topicCluster?: string;
  topK?: number;
  minScore?: number;
}

export interface RoutedContextResult {
  formattedContext: string;
  results: HybridSearchResult[];
  totalChunksFound: number;
}

export class SemanticRouter {
  private vectorStore: UnifiedVectorStore;

  constructor(vectorStore?: UnifiedVectorStore) {
    this.vectorStore = vectorStore || UnifiedVectorStore.getInstance();
  }

  /**
   * Executa busca semântica híbrida roteada por tópicos com formatação editorial do contexto.
   */
  public async routeAndQueryRag(
    queryText: string,
    options: SemanticQueryOptions = {}
  ): Promise<RoutedContextResult> {
    const {
      bookId,
      documentIds,
      topicCluster,
      topK = 6,
      minScore = 0.25,
    } = options;

    if (!queryText || queryText.trim().length === 0) {
      return { formattedContext: "", results: [], totalChunksFound: 0 };
    }

    // 1. Gera embedding do vetor da consulta
    const queryVector = await generateEmbedding(queryText);

    // 2. Executa busca híbrida escopada no Unified Vector Store
    const searchResults = this.vectorStore.searchHybrid({
      bookId,
      documentIds,
      queryVector,
      queryText,
      topicCluster,
      topK,
      minScore,
    });

    if (searchResults.length === 0) {
      return { formattedContext: "", results: [], totalChunksFound: 0 };
    }

    // 3. Formata o contexto editorial limpo para injeção no prompt do agente
    const contextBlocks = searchResults.map((res, index) => {
      const tagsStr = res.tags.length > 0 ? ` [Tags: ${res.tags.join(", ")}]` : "";
      const clusterStr = res.topicCluster !== "general" ? ` (Tópico: ${res.topicCluster})` : "";
      return `--- EXCERTO ${index + 1}${clusterStr}${tagsStr} ---\n${res.content.trim()}`;
    });

    return {
      formattedContext: contextBlocks.join("\n\n"),
      results: searchResults,
      totalChunksFound: searchResults.length,
    };
  }
}
