# Invariantes de Estado da Esteira e Higiene de Persistência (Pipeline State Invariants)

Este documento define as regras mandatórias para evitar congelamentos de interface (UI freeze), bloqueio de Event Loop e inconsistências de estado no ecossistema Antigravity.

---

## 1. Invariante de Transição Atômica de Estado

Toda e qualquer transição de etapa na esteira (`ingesting` -> `chunked` -> `vectorized` -> `outlining` -> `writing` -> `formatting` -> `reviewing` -> `completed`) DEVE:

1. Disparar `emitProgress(bookId, status, message, percent)` via SSE.
2. Atualizar IMEDIATAMENTE e de forma síncrona o registro do livro no banco de dados:
   ```typescript
   updateBook(bookId, {
     status: newStatus,
     current_step: statusMessage,
     progress_percent: percent,
   });
   ```
3. **Proibição Estrita de Atraso de Persistência:** É expressamente proibido disparar subagentes assíncronos demorados (ex: `generateCeoPlan`, `writeBookPresentationSubagent`, `writeChapterSubagent`, `formatEditorialManuscript`) sem antes persistir no banco a alteração de status correspondente.

---

## 2. Segregação Estrita de Dados Vetoriais e Metadados (Zero Heavy Embeddings in JSON)

1. **Unified Vector Store (SQLite WAL):** É o repositório EXCLUSIVO para embeddings vetoriais (armazenados de forma binária de alta densidade como BLOB `Float32Array`).
2. **Repositório de Metadados (`ebook_generator_db.json`):** O arquivo de metadados deve armazenar APENAS dados leves de governança (livros, capítulos, tarefas e logs de auditoria).
3. **Proibição de Duplicação Vetorial:** É terminantemente proibido serializar vetores de embeddings (arrays de 768 floats) dentro do arquivo de metadados JSON. O campo `ragChunks` não deve conter strings ou arrays com vetores numéricos.
4. **Higiene de I/O:** `persistState()` não deve formatar payloads gigantes (`null, 2`) em produção e deve operar com debounce eficiente para não bloquear a thread principal do Node.js.
