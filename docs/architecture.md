# Arquitetura do Sistema

## 1. Visão Geral da Arquitetura

O sistema adota uma arquitetura em camadas orientada a eventos e filas de execução, dividida em módulos desacoplados:

```
[ Camada de Apresentação (Next.js App Router / Client State) ]
                      ↓
[ Camada de API REST & Server-Sent Events (SSE) ]
                      ↓
[ Motor de Fila & Orquestração (Task Engine / Pipeline Watchdog) ]
                      ↓
[ Grafo de Subagentes Especializados (DAG) ]
  ├── CEO Orchestrator
  ├── Presentation Writer
  ├── Chapter Writers (Concorrentes)
  ├── Designer Formatter & Visual Translator (SVG Inline)
  └── Subagente Revisor Editorial (Auditoria Factual)
                      ↓
[ Motores de Dados & Exportação ]
  ├── Store Transacional Atômico (ebook_generator_db.json com mtimeMs)
  ├── Banco Vetorial Unificado (Cosine Similarity / Deduplicação CAS)
  └── Compilador Físico Puppeteer (Livro Miolo & Capa Wraparound KDP 300 DPI)
```

---

## 2. Padrões de Persistência e Concorrência

1. **Persistência Transacional Sem Conflitos:**
   - O arquivo `data/ebook_generator_db.json` possui rastreamento por timestamp de disco (`mtimeMs`).
   - Leituras no Next.js detectam modificações do disco imediatamente, evitando servir snapshots obsoletos em memória.
2. **Prevenção de Corrida no Front-end (Monotonic Updates):**
   - O cliente SSE atualiza o estado em tempo real. O polling REST atua exclusivamente como fallback resiliente.
   - Atualizações de progresso são monotônicas: snapshots atrasados nunca regridem porcentagens ou alteram o status de um livro completado.
3. **Watchdog de Timeout com Auto-Cura:**
   - O `PipelineWatchdog` monitora cada fase do pipeline com limites calibrados para acomodar múltiplos PDFs sem interrupções prematuras.

---

## 3. Integração com a Google Gemini API

- **Modelos Utilizados:** `gemini-3.8-flash` / `gemini-3.7-flash` para orquestração e redação; `gemini-embedding-001` para vetorização.
- **Conformidade com Diretrizes Recentes:**
  - Parâmetros de amostragem descontinuados (`temperature`, `top_p`, `top_k`) foram expurgados.
  - Suporte ao controle de raciocínio via `thinking_level` (`minimal`, `low`, `medium`, `high`).
  - Geração de embeddings em lotes com `batchEmbedContents` e timeout protegido por `Promise.race`.
