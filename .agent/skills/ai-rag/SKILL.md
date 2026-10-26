---
name: ai-rag
description: Plugin de RAG Semântico para Ingestão de PDF, Fatiamento (Chunking), Embeddings e Consultas Vetoriais com Guardrails Anti-Alucinação.
---

# Skill: ai-rag (Motor RAG e Ingestão Semântica)

Este plugin é o padrão mandatório para toda a ingestão, fatiamento, vetorização e recuperação de contexto no ecossistema Antigravity.

## 1. Parâmetros de Extração e Chunking

- **Limpeza Semântica:** Remoção de cabeçalhos repetitivos, rodapés, números de página isolados e quebras de linha artificiais.
- **Tamanho do Chunk (`chunk_size`):** 800 tokens (~3.200 caracteres).
- **Sobreposição (`chunk_overlap`):** 150 tokens (~600 caracteres) para preservar coesão entre limites conceituais.
- **Estratégia de Divisão:** Recursiva baseada em limites semânticos (parágrafos, títulos de seção, sentenças completas).

## 2. Geração de Embeddings e Armazenamento Vetorial

- **Motor de Embeddings:** Modelo oficial do Gemini (`text-embedding-004` / Gemini Embedding API).
- **Provedor Vetorial:** ChromaDB / Vector Store local de alta performance com persistência SQLite.
- **Métrica de Distância:** Similaridade de Cosseno (Cosine Similarity).

## 3. Recuperação de Contexto (Tool Calling)

Os subagentes escritores utilizam esta ferramenta para buscar contexto de alta relevância:

```typescript
interface RagQueryResult {
  chunks: Array<{
    id: string;
    content: string;
    pageNumber: number;
    similarityScore: number;
  }>;
  totalTokens: number;
  sources: string[];
}
```

## 4. Guardrails Anti-Alucinação

1. **Ancoragem Estrita:** Toda afirmação factológica deve ser fundamentada nos chunks recuperados.
2. **Proibição de Fabricações:** Não inventar nomes de autores, estudos, dados quantitativos ou citações que não constem no livro base.
3. **Profundidade Analítica:** Expandir conceitos explicando o "porquê", o "como", analogias didáticas e aplicações práticas sem distorcer o conteúdo original.
