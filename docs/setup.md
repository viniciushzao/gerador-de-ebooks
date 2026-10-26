# Setup do Projeto & Histórico de Adoção do Toolkit

## 1. Registro de Adoção do Vibe Coding Toolkit

- **Data da Adoção:** Outubro de 2026.
- **Origem / Revisão do Toolkit:** Instalação local em `~/.gemini/config/plugins/vibe-coding-toolkit` (`soumatheusgomes/vibe-coding-toolkit`).
- **Prompt Utilizado:** `docs/prompts/12-existing-project-setup.md` (Adoção em Projeto Existente).

---

## 2. Matriz Final de Cobertura

| Componente | Estado | Decisão & Ação Realizada |
| :--- | :--- | :--- |
| **Harness de Documentação** | Concluído | Criados `AGENTS.md`, `CLAUDE.md`, `PRODUCT.md` e subdocs em `docs/` (`architecture.md`, `design.md`, `onboarding.md`, `quality.md`, `setup.md`). |
| **ESLint & Quality Gates** | Concluído | Criada configuração explícita e não-interativa do ESLint com scripts no `package.json`. |
| **Scripts Canônicos** | Concluído | Adicionados comandos `"test"` e `"verify"` unificando `tsc`, `lint` e testes existentes. |
| **Graphify Knowledge Graph** | Concluído | Grafo AST mantido e atualizado em `graphify-out/` com exclusões seguras. |
| **Skills & Regras Antigravity** | Concluído | Incorporadas as diretrizes de subagentes, Ponytail full e Caveman communication. |

---

## 3. Comandos de Manutenção

- **Executar Verificação Total:**
  ```bash
  npm run verify
  ```
- **Atualizar o Grafo de Conhecimento:**
  ```bash
  graphify update .
  ```
- **Limpeza de Caches Temporários:**
  ```bash
  npm run clean # se configurado, ou remover .next/
  ```
