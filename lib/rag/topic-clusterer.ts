import { TopicClusterRecord } from "../db/schema";
import { UnifiedVectorStore } from "./unified-vector-store";

export interface ExtractedTopicInfo {
  topicCluster: string;
  tags: string[];
}

export class TopicClusterer {
  private static readonly PREDEFINED_CLUSTERS: Record<string, { label: string; keywords: string[] }> = {
    financas_metricas: {
      label: "Finanças, Métricas & Unit Economics",
      keywords: [
        "cac", "ltv", "ebitda", "margem", "receita", "roi", "cpa", "payback",
        "custo", "financeiro", "lucro", "faturamento", "dolar", "investimento",
        "burn rate", "valuation", "churn", "mrr", "arr", "fluxo de caixa",
      ],
    },
    gestao_lideranca: {
      label: "Gestão, Cultura & Liderança",
      keywords: [
        "okr", "liderança", "cultura", "autonomia", "equipe", "gestão", "feedforward",
        "feedback", "execução", "governança", "estratégia", "antifragilidade",
        "mentalidade", "tomada de decisão", "organização", "delegação",
      ],
    },
    marketing_vendas: {
      label: "Marketing, Growth & Vendas",
      keywords: [
        "funil", "conversão", "tráfego", "copywriting", "inbound", "outbound",
        "leads", "vsl", "oferta", "posicionamento", "branding", "growth",
        "anúncios", "campanhas", "audiência", "conteúdo", "engajamento",
      ],
    },
    engenharia_tech: {
      label: "Engenharia, Produto & Tecnologia",
      keywords: [
        "arquitetura", "software", "api", "código", "desenvolvimento", "ia",
        "algoritmo", "dados", "banco de dados", "pipeline", "automação",
        "infraestrutura", "segurança", "sistema", "backend", "frontend",
      ],
    },
    metodologia_processos: {
      label: "Metodologias & Processos Operacionais",
      keywords: [
        "scrum", "kanban", "sprint", "processo", "framework", "padronização",
        "eficiência", "produtividade", "fluxo", "qualidade", "melhoria contínua",
        "kaizen", "lean", "rotina", "checklist", "manual",
      ],
    },
  };

  /**
   * Classifica um chunk e extrai tags semânticas baseadas em densidade de palavras-chave.
   */
  public static classifyChunk(content: string): ExtractedTopicInfo {
    const textLower = content.toLowerCase();
    const scores: Record<string, number> = {};
    const matchedTags: Set<string> = new Set();

    for (const [namespace, cluster] of Object.entries(TopicClusterer.PREDEFINED_CLUSTERS)) {
      let score = 0;
      for (const keyword of cluster.keywords) {
        // Regex com boundary de palavra
        const regex = new RegExp(`\\b${keyword}\\b`, "i");
        if (regex.test(textLower)) {
          score += 1;
          matchedTags.add(keyword);
        }
      }
      scores[namespace] = score;
    }

    // Identifica o cluster com maior pontuação
    let bestCluster = "geral";
    let maxScore = 0;

    for (const [namespace, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestCluster = namespace;
      }
    }

    return {
      topicCluster: bestCluster,
      tags: Array.from(matchedTags).slice(0, 8),
    };
  }

  /**
   * Registra e atualiza os clusters de tópicos detectados no Unified Vector Store.
   */
  public static registerClusters(
    vectorStore: UnifiedVectorStore,
    clusterCounts: Record<string, number>
  ): void {
    for (const [namespace, count] of Object.entries(clusterCounts)) {
      if (count > 0 && TopicClusterer.PREDEFINED_CLUSTERS[namespace]) {
        const clusterDef = TopicClusterer.PREDEFINED_CLUSTERS[namespace];
        const record: TopicClusterRecord = {
          id: `cluster_${namespace}`,
          namespace,
          topic_name: clusterDef.label,
          keywords: clusterDef.keywords,
          chunk_count: count,
          created_at: new Date().toISOString(),
        };
        vectorStore.saveTopicCluster(record);
      }
    }
  }
}
