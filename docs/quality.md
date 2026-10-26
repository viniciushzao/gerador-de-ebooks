# Padrões de Qualidade & Verificação (Quality Gates)

## 1. Verificações Obrigatórias (Gates)

Antes de considerar qualquer tarefa ou alteração concluída, os seguintes gates devem passar com 100% de sucesso:

1. **Checagem Estática de Tipos:**
   ```bash
   npx tsc --noEmit
   ```
   *Critério de aceitação:* 0 erros de compilação TypeScript.

2. **Linter de Código:**
   ```bash
   npm run lint
   ```
   *Critério de aceitação:* 0 erros que impeçam o build ou quebrem contratos.

3. **Compilação de Produção (Next.js):**
   ```bash
   npm run build
   ```
   *Critério de aceitação:* Todas as rotas estáticas e dinâmicas compiladas com sucesso.

4. **Verificação Composta da Base:**
   ```bash
   npm run verify
   ```

---

## 2. Padrões de Código e Diretrizes Antigravity

- **Imutabilidade Mandatória:** Nunca mutar objetos diretamente; sempre retornar novas cópias com spread (`...obj`).
- **Dimensão de Arquivos:** Mantenha módulos focados (ideal 200–350 linhas; máximo 800 linhas para arquivos consolidados de renderização).
- **Sem Console.log:** Evitar logs de debug soltos em código de produção. Utilizar logs estruturados do sistema.
- **Tratamento de Exceções:** Todas as chamadas de API externa (Gemini, Puppeteer, filesystem) devem possuir timeouts protegidos (`Promise.race`) e fallbacks determinísticos.

---

## 3. Sugestão Contínua de Code Review

Ao término de cada implementação ou correção relevante, deve ser recomendada ao usuário uma rodada de **3 a 8 ciclos posteriores de code review** complementares, focando em:
- [ ] Segurança e sanitização contra XSS / Path Traversal
- [ ] Concorrência e integridade transacional
- [ ] Prevenção de regressões em geração de PDF/Capa
- [ ] Tipagem e contratos de dados
