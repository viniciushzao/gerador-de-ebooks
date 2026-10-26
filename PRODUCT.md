# PRODUCT.md — Especificação e Escopo do Produto

## 1. Visão Geral do Produto

O **Gerador de E-books e Livros Editoriais** é uma plataforma autônoma projetada para criar compêndios, manuais técnicos e livros de negócios prontos para publicação física e digital (Amazon KDP e plataformas de infoprodutos), ancorados em conteúdo de referência fatiado e indexado via RAG (Retrieval-Augmented Generation).

---

## 2. Público-Alvo e Proposta de Valor

- **Público-Alvo:** Autores, especialistas técnicos, consultores, infoprodutores e pesquisadores que necessitam transformar materiais brutos e notas técnicas em livros de alto padrão editorial.
- **Proposta de Valor:** Automação completa de ponta a ponta sem intervenção manual a cada página:
  1. Leitura e fatiamento semântico de até 5 arquivos simultâneos (PDF, DOCX, TXT, MD).
  2. Planejamento estratégico First Principles pelo Agente CEO.
  3. Redação densa e analítica (>3.000 palavras por capítulo em Two-Stage Drafting).
  4. Formatação tipográfica profissional em padrões internacionais de livro (A5, Trade 6x9, Digest 5.5x8.5, A4).
  5. Compilação física de Capa Wraparound KDP a 300 DPI (Contracapa + Lombada proporcional + Frente) com elementos vetoriais e sem bordas de mockup.

---

## 3. Fluxos Críticos do Sistema

1. **Ingestão Multi-Arquivo & Deduplicação Criptográfica (CAS):**
   - Upload de até 5 arquivos.
   - Extração de texto e cálculo de hash SHA-256. Se o arquivo já foi vetorizado anteriormente, seus chunks e embeddings são reaproveitados instantaneamente com zero latência e zero chamadas de API redundantes.
2. **Esteira Autônoma DAG (Directed Acyclic Graph):**
   - **Vetorização RAG:** Geração de embeddings em lotes (`batchEmbedContents`) com timeout e fallback determinístico.
   - **CEO Orchestrator:** Definição do escopo, divisão em seções com diretrizes executivas e cálculo dinâmico de capítulos necessários para atingir o volume contratado.
   - **Apresentação:** Redação da apresentação oficial da obra (1 a 3 páginas).
   - **Chapter Writers:** Redação paralela com Two-Stage Deep Drafting (Parte 1: Tese & Fundamentos; Parte 2: Frameworks, Casos & Playbook).
   - **Designer Formatter & OpenChart:** Conversão de diagramas em SVG inline 300 DPI, limpeza de resíduos LaTeX e diagramação tipográfica editorial.
   - **Subagente Revisor Editorial:** Auditoria factual e expansão automática de apêndice analítico se houver déficit volumétrico.
   - **Compilador Puppeteer:** Geração do PDF final e registro do número real físico de páginas via `pdf-parse`.
3. **Central de Capa Oficial Amazon KDP (300 DPI):**
   - Cálculo milimétrico da largura da lombada com base na contagem real de páginas e tipo de papel (White / Cream).
   - Geração de arte vetorial de alta definição combinando Blueprint Técnico com Linhas de Fluxo Orgânicas.
   - Exportação em PNG 300 DPI e PDF com MediaBox exato da folha estendida.

---

## 4. Invariantes e Restrições Inegociáveis

- **Sem Alucinações de Diagramas Quebrados:** Proibição estrita de Mermaid textual cru vazando no texto final; todo elemento visual deve ser convertido para SVG inline.
- **Sem Fórmulas Quebradas:** Sanitização de LaTeX para notação editorial clara em português (ex: substituição de chaves decimais e moedas).
- **Sem Telas Brancas na Capa:** O compilador de capa deve sempre renderizar o motivo gráfico híbrido correspondente ao tema da obra.
- **Conformidade de API:** Eliminação de parâmetros de amostragem descontinuados (`temperature`, `top_p`, `top_k`, `thinking_budget`) conforme diretrizes do Google Gemini.
