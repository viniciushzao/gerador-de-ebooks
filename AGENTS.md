# Gerador de E-books & Livros Editoriais (RAG Multi-Arquivo & Amazon KDP)

> Harness operacional unificado conforme o Vibe Coding Toolkit.

## Produto e Stack

- **Escopo e regras do produto:** `PRODUCT.md`
- **Stack observada:** Next.js 15.1.7 (App Router), React 19, TypeScript 5.7.3, Tailwind CSS 3.4.17, Node.js 24+ (Windows).
- **IA & Modelos:** Google Gemini API (`gemini-3.8-flash` / `gemini-3.7-flash`), `gemini-embedding-001` (embeddings 768d).
- **Banco de Dados:** Store estruturado JSON atômico com verificação de timestamp físico (`data/ebook_generator_db.json`) e banco vetorial unificado persistente.
- **Renderização e Saída:** Puppeteer (PDF editorial com CSS Paged Media e Capa Wraparound KDP 300 DPI).
- **Documentação de apoio:** Diretório `docs/` (`architecture.md`, `design.md`, `onboarding.md`, `quality.md`, `setup.md`).

## Comandos Canônicos

- **Instalar:** `npm install`
- **Desenvolver:** `npm run dev` (porta 3000)
- **Tipos:** `npx tsc --noEmit`
- **Lint:** `npm run lint`
- **Build:** `npm run build`
- **Verificar base:** `npm run verify`

## Acordos de Trabalho

- Ler código e instruções pertinentes antes de editar; separar fatos de hipóteses.
- Entregar sempre a menor mudança completa suficiente (Ponytail full / escopo enxuto).
- Preservar tipagem estrita, imutabilidade, validação de inputs e segurança contra XSS e Path Traversal.
- Respeitar a regra de 1 escritor por arquivo e zero commits por subagentes.
- Comunicação no chat: direta e concisa (Caveman style), mantendo código e documentação técnicos e completos.
- Sugerir de 3 a 8 ciclos posteriores de code review após cada entrega de funcionalidade ou correção.

## Padrões e Arquitetura

- **RAG & Ingestão:** Multi-arquivo (até 5 arquivos simultâneos: PDF, DOCX, TXT, MD), deduplicação criptográfica SHA-256 (CAS), embeddings em lote e roteamento semântico de tópicos para os capítulos.
- **Orquestração DAG:** CEO Orchestrator calcula volume e escopo analítico dinâmico -> Subagente Apresentação -> Subagentes Chapter Writers paralelos (Two-Stage Deep Drafting >3.000 palavras/capítulo) -> Designer Formatter (SVG inline 300 DPI) -> Subagente Revisor Editorial -> Compilador Puppeteer.
- **Capa KDP:** Dimensões matemáticas exatas com lombada (spine width) proporcional à contagem real de páginas, sangria de 0.125" e resolução de 300 DPI.
