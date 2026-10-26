# Guia de Onboarding e Operação

## 1. Pré-Requisitos

- **Node.js:** Versão 18, 20, 22 ou 24+ LTS.
- **Google Gemini API Key:** Necessária para os agentes de orquestração, redação e embeddings.

---

## 2. Configuração de Ambiente

1. Crie o arquivo `.env` na raiz do projeto:
   ```env
   GEMINI_API_KEY=sua_chave_gemini_aqui
   NODE_ENV=development
   PORT=3000
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicialize o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   Acesse: `http://localhost:3000`.

---

## 3. Fluxo de Trabalho do Usuário

1. **Ingestão:**
   - Acesse a interface e selecione de 1 a 5 arquivos (PDF, DOCX, TXT ou MD).
   - Defina o título do livro, público-alvo e o formato de folha desejado (Trade 6x9, A5, etc.).
2. **Execução Autônoma:**
   - Clique em **"Iniciar Esteira Autônoma"**.
   - Acompanhe em tempo real o progresso percentual, tokens consumidos, custos em USD e logs de cada subagente.
3. **Revisão e Exportação:**
   - Na aba "Leitura e Capítulos", inspecione os capítulos gerados com diagramas inline.
   - Na aba "Central de Publicação e Capa", visualize a capa KDP compilada em 300 DPI e faça o download do PDF do Miolo e da Capa KDP oficial.
