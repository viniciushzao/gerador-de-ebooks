# Manual do Operador — Sistema Autônomo de RAG e Coautoria de Livros

Este documento orienta a operação completa do sistema autônomo de RAG, orquestração multi-agente e diagramação de livros em PDF no ecossistema **Google Antigravity**.

---

## 1. Visão Geral da Arquitetura

O sistema automatiza integralmente o ciclo de vida de coautoria de livros a partir de um documento original em PDF, operando em esteira contínua sem aprovação manual a cada página:

```
[ Upload do PDF ]
        ↓
[ Ingestão & Limpeza Semântica ] (Remoção de ruídos, quebras e cabeçalhos)
        ↓
[ Fatiamento (Chunking) ] (Regido pelo plugin local "ai-rag" - 800 tokens, 150 overlap)
        ↓
[ Vetorização & Indexação ] (Embeddings Gemini + ChromaDB Vector Store)
        ↓
[ CEO Agente Orquestrador ] (Sumário Estratégico, cálculo de metas de 90 a 200 pgs, DAG)
        ↓
[ Subagentes Escritores ] (Operação paralela com Tool Calling no plugin "ai-rag")
        ↓
[ Subagente Designer ] (Tipografia Garamond/Baskerville/Palatino/Georgia, entrelinha 1.15)
        ↓
[ Compilador PDF Editorial ] (CSS Paged Media, numeração e download direto)
```

---

## 2. Configurações de Negócio (`config/system.json`)

Todas as regras e restrições de negócio são lidas estritamente de `config/system.json` (fonte única da verdade):

```json
{
  "AUTHOR_NAME": "VINÍCIUS HIQUE DA SILVA PROENÇA",
  "TARGET_AUDIENCE": "PESSOAS QUE LEEM O MESMO TEMA DO LIVRO ANEXADO",
  "TONE_OF_VOICE": "FACILITADOR DO ENTENDIMENTO DO LIVRO INICIAL",
  "MIN_PAGES": 90,
  "MAX_PAGES": 200,
  "VECTOR_DB_PROVIDER": "ChromaDB",
  "LLM_MODEL": "gemini-3.7-flash",
  "DESIGN_TYPOGRAPHY": "Garamond",
  "DESIGN_SPACING": 1.15
}
```

---

## 3. Instalação e Inicialização Rápida

### Pré-requisitos
- **Node.js**: Versão 18, 20, 22 ou 24+
- **Chave de API do Google Gemini**: Necessária para o modelo `gemini-3.7-flash` e embeddings.

### Passo a Passo

1. **Configurar o Arquivo `.env`:**
   Copie `.env.example` para `.env` e insira sua chave da API do Google Gemini:
   ```bash
   cp .env.example .env
   ```
   No `.env`:
   ```env
   GEMINI_API_KEY=sua_chave_gemini_aqui
   VECTOR_DB_PROVIDER=ChromaDB
   PORT=3000
   NODE_ENV=development
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Iniciar o Servidor de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a aplicação no navegador em: `http://localhost:3000`.

---

## 4. Como Operar a Plataforma

### 1. Criar um Novo Livro / Projeto
- Na barra lateral esquerda (ou na página inicial), clique em **"Novo Livro / Ingestão PDF"**.
- Selecione o arquivo PDF do livro base.
- Escolha a tipografia desejada (`Garamond`, `Baskerville`, `Palatino Linotype` ou `Georgia`).
- Clique em **"Criar e Iniciar RAG"**.

### 2. Disparar a Esteira de Produção
- No painel do livro, clique em **"Iniciar Esteira Autônoma"**.
- A esteira executará todas as etapas de forma automática e descentralizada:
  - Extração e limpeza do PDF.
  - Chunking semântico e indexação vetorial.
  - O Agente CEO analisa o RAG e gera o sumário com metas de páginas.
  - Os Subagentes Escritores executam em paralelo fazendo buscas vetoriais no plugin `ai-rag`.
  - O Subagente Designer aplica tipografia, entrelinha de 1.15 e formata o manuscrito.
  - O Compilador gera o PDF final com layout editorial.

### 3. Acompanhar a Trilha de Auditoria (Audit Trail & Grafo DAG)
- Clique em **"Ver Trilha de Auditoria (Grafo DAG)"** no painel do livro.
- Você verá:
  - A árvore visual de dependências dos agentes (`CEO -> Subagente Cap X -> Designer`).
  - O consumo exato de tokens (entrada e saída) em cada chamada.
  - O custo estimado em dólares com base na tabela do **Gemini 3.7 Flash** ($0.075 / 1M prompt, $0.30 / 1M completion).
  - O tempo de latência em milissegundos.
  - As badges visuais de ativação do plugin `[ai-rag]` e das skills locais.

### 4. Usar o Modo Replay (Recuperação de Erros por Nó)
- Se desejar reescrever ou corrigir um capítulo específico sem precisar rodar todo o livro novamente:
  1. Vá até a **Trilha de Auditoria**.
  2. No card do capítulo desejado, clique no botão **"Reexecutar Nó (Replay)"**.
  3. O subagente reexecutará a consulta ao `ai-rag`, reescreverá o capítulo e o Designer atualizará o manuscrito e recompilará o PDF automaticamente.

### 5. Download do Livro Final (PDF & EPUB)
- Assim que a esteira atingir 100%, os botões de download ficam disponíveis no cabeçalho e na visão geral do livro:
  - **"Download PDF"** (botão verde): Arquivo PDF editorial com paginação fixa Paged Media.
  - **"Download EPUB"** (botão índigo): Arquivo EPUB 3 reflowable com suporte a Dark Mode, sumário dinâmico e compatibilidade retroativa com leitores digitais (Kindle, Kobo, Apple Books).

### 6. Divulgação & Capa (Metadados Comerciais e Prompt de Capa)
- Localizada na aba **"Divulgação & Capa"** no painel de leitura do livro (`/books/[id]`):
  - **Prompt para Geração de Capas:** Prompt detalhado e formatado para IAs geradoras de imagem (Midjourney, DALL-E, Ideogram, Flux), contendo as dimensões e proporções exatas da folha selecionada (`page_size`), estilo estritamente minimalista, paleta sóbria e ampla área negativa para títulos.
  - **Sugestão de Categorias Editoriais:** Sugestões selecionadas estritamente a partir da tabela oficial de 32 categorias comerciais, com badges interativos para adição/remoção rápida.
  - **Descrição / Resumo Comercial da Obra:** Texto persuasivo estruturado para captura de SEO e apresentação em marketplaces (Amazon KDP, Hotmart, Eduzz, etc.), limitado rigorosamente a 4.000 caracteres em formato **texto simples puro** (sem Markdown ou fontes especiais).
  - **Ações Rápidas:** Botões dedicados de cópia com 1 clique para cada campo, botão **"Regenerar com IA"** e **"Salvar Alterações"** com persistência em banco de dados (`/api/books/[id]/publishing`).

---

## 5. Estrutura de Diretórios e Persistência

- `config/system.json`: Configurações de negócio estritas.
- `data/uploads/`: Armazenamento seguro dos PDFs enviados.
- `data/vectorstore/`: Armazenamento de vetores e chunks indexados.
- `data/output/`: Arquivos finais compilados em PDF e EPUB prontos para distribuição.
- `data/ebook_generator_db.json`: Banco de dados relacional atômico de projetos, capítulos, tarefas do DAG e logs de auditoria.
- `.agent/rules/agent_hierarchy_dag.md`: Regras de governança do Grafo DAG.
- `.agent/skills/`: Plugins e skills locais com progressive disclosure (`ai-rag`, `book-designer`, `pdf-compiler`, `epub-compiler`).
