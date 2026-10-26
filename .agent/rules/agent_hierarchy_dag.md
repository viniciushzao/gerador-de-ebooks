# Hierarquia de Agentes e Regras do Grafo Acíclico Dirigido (DAG)

Este documento estabelece as regras estritas de governança, permissões, dependências e limites de decisão dos agentes autônomos no ecossistema Antigravity para Coautoria de Livros.

---

## 1. Topologia do Grafo (DAG)

O fluxo de trabalho opera exclusivamente como um Grafo Acíclico Dirigido (DAG), sem chamadas circulares:

```
[ Ingestão RAG (ai-rag) ]
            ↓
  [ CEO Orchestrator ] (Trace Root / Parent Task ID = NULL)
            ↓ (Dispara em Paralelo com isolamento)
    ┌───────┼───────┐
    ↓       ↓       ↓
[Writer 1] [Writer 2] [Writer N]  (Parent Task ID = CEO_PLAN_TASK_ID)
    │       │       │
    └───┬───┴───┬───┘
        ↓       ↓
  [ Subagente Revisor de Imagens ] (Quality Gate Visual: Zero Text Overlap)
        └───────┬───────┘
                ↓ (Consolidação)
        [ Designer / Formatter ]  (Parent Task ID = CEO_VALIDATE_TASK_ID)
                ↓
        [ PDF Compiler ]
```

---

## 2. Papéis e Limites de Decisão

### A. CEO (Agente Orquestrador)
- **Papel:** Líder estratégico do projeto. Lê o índice e metadados extraídos pelo plugin `ai-rag`.
- **Responsabilidades:**
  1. Definir o Sumário e Plano Estruturado de Capítulos baseado no livro base.
  2. Calcular metas de palavras por capítulo para garantir a meta de `MIN_PAGES` (90) a `MAX_PAGES` (200).
  3. Criar os nós de tarefas isoladas para cada capítulo e despachar para os Subagentes Escritores.
  4. Validar o retorno dos capítulos (profundidade analítica, ausência de repetição) e consolidar o manuscrito.
- **Limites:**
  - NÃO escreve o conteúdo corrido dos capítulos (delega 100% aos escritores).
  - NÃO envia o PDF inteiro no prompt (otimização de tokens: envia apenas o resumo e termos de busca RAG).

### B. Escritores de Capítulos (Subagentes Especialistas)
- **Papel:** Especialistas de redação analítica por capítulo temático.
- **Responsabilidades:**
  1. Executar chamadas de ferramenta (*Tool Calling*) no plugin `ai-rag` para obter os chunks relevantes do seu capítulo.
  2. Redigir o capítulo completo em formato Markdown rico (H1, H2, H3, listas, citações em bloco, exemplos práticos).
  3. Respeitar o tom de voz definido em `config/system.json` (`FACILITADOR DO ENTENDIMENTO DO LIVRO INICIAL`).
- **Limites:**
  - **PROIBIDA ALUCINAÇÃO:** Baseia-se estritamente nas passagens recuperadas pelo RAG. Proibido inventar dados, personagens ou referências inexistentes.
  - Não se comunica com outros subagentes escritores; reporta exclusivamente ao CEO.

### C. Designer & Suite Editorial (Subagente de Formatação e Diagramação)
- **Papel:** Especialista em design editorial, tipografia de alta classe e processamento de documentos multimodo.
- **Habilidades Habilitadas (Suite `agentic-bundle-aas-documents-presentations`):**
  1. `pdf-compiler` & `pdf-official`: Diagramação em CSS Paged Media, headers/footers correntes, numeração e compilação de PDFs editoriais.
  2. `docx-official` & `office-productivity`: Capacidade de exportação e estruturação de manuscritos no formato Word (.docx).
  3. `pptx-official` & `google-slides-automation`: Capacidade de geração de apresentações e resumos executivos de slides dos livros.
  4. `xlsx-official` & `google-sheets-automation`: Automação de planilhas de métricas, cronogramas editoriais e orçamentos de tokens.
  5. `google-docs-automation` & `pdf-conversion-router`: Integração com Google Docs e roteamento de conversão de documentos.
- **Responsabilidades:**
  1. Receber o manuscrito consolidado e aplicar a tipografia configurada (`Garamond`, `Baskerville`, `Palatino Linotype` ou `Georgia`).
  2. Padronizar o entrelinha (`DESIGN_SPACING = 1.15`), hierarquia de títulos, notas de rodapé e caixas de destaque.
  3. Gerar o documento HTML/CSS pronto para compilação editorial e os formatos auxiliares suportados pelo bundle.
- **Limites:**
  - Não altera o conteúdo conceitual do texto escrito pelos subagentes.

### D. Subagente Revisor de Imagens (Quality Gate Visual)
- **Papel:** Auditor de qualidade visual e conformidade tipográfica das ilustrações explicativas de alta resolução.
- **Invocação:** Disparado automaticamente a cada geração de ativo gráfico visual por qualquer subagente.
- **Responsabilidades:**
  1. Inspecionar o código estrutural dos gráficos vetoriais (SVG).
  2. Garantir 100% de contenção de textos (`foreignObject`, `word-wrap: break-word`), impedindo qualquer sangria ou sobreposição de palavras.
  3. Validar contrastes, integridade de `viewBox`, ausência de diagramas Mermaid e nitidez editorial.
  4. Executar autocorreção estrutural imediata caso qualquer risco de sobreposição seja detectado.

---

## 3. Circuit Breaker e Prevenção de Loops Infinitos

1. `max_depth = 3`: Nenhuma tarefa pode ultrapassar 3 níveis na árvore de derivação.
2. `max_loops_per_task = 2`: Se um subagente falhar ou o CEO rejeitar o rascunho por 2 vezes consecutivas, o sistema aciona fallback automático com o melhor rascunho intermediário e registra alerta na Trilha de Auditoria.
3. Cada nó tem limite de tempo de execução (*timeout*) e teto de tokens orçado.

---

## 4. Regra Global de Formatação: Proibição Estrita de LaTeX / Math

1. **PROIBIDO USO DE SINTAXE LATEX:** É expressamente proibido aos agentes gerar fórmulas matemáticas em blocos LaTeX ou símbolos como `$...$`, `$$...$$`, `\text{...}`, `\frac{...}{...}`, `\sum`, `\mathcal{...}`, `\times`, etc.
2. **MOTIVAÇÃO TÉCNICA:** O leitor de manuscrito e o compilador PDF utilizam renderizadores de Markdown/HTML puros sem interpretador LaTeX/KaTeX, fazendo com que tais códigos apareçam como ruídos ininteligíveis para o usuário final.
3. **NOTAÇÃO OBRIGATÓRIA:** Todas as equações, cálculos, métricas e proporções devem ser explicadas em **prosa clara e notação textual linear** (ex: `Participação de Mercado (%) = (Vendas da Marca / Total de Vendas) * 100` ou `Receita = Quantidade * Preço`).

---

## 5. Regra Global de Elementos Visuais: Proibição Absoluta de Mermaid & Obrigatoriedade de Imagens

1. **PROIBIÇÃO TOTAL DE MERMAID:** É terminantemente proibida a emissão de código Mermaid (\`\`\`mermaid, graph, flowchart, sequenceDiagram, etc.) no texto do livro.
2. **HABILIDADE DE APRESENTAÇÃO E IMAGENS:** Os subagentes possuem acesso às habilidades da suite de apresentações e documentos (`agentic-bundle-aas-documents-presentations`). Qualquer diagrama, fluxo, arquitetura ou matriz DEVE ser gerado como **Figura / Imagem Explicativa de Alta Resolução** (`<figure class="editorial-image"><img ... /></figure>`).
3. **FILTRO AUTOMÁTICO DE SEGURANÇA:** Todo texto gerado passa por filtros de expurgo (`purgeMermaidDiagrams`) e inspeção pelo `IMAGE_REVIEWER` para assegurar que nenhum resquício textual de diagramas chegue ao manuscrito final.
