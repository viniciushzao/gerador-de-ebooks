import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { BookRecord, ChapterRecord } from "@/lib/db/schema";
import { WraparoundCoverSpec, calculateWraparoundCoverDimensions } from "./page-formats";
import {
  extractCleanNaturalSynopsis,
  DynamicVisualMetaphor,
  generateDynamicBookMetaphor,
  generateDefaultDynamicMetaphor,
  extractMetaphorFromCoverPrompt,
} from "@/lib/agents/publishing-metadata-generator";
import { callGemini, getGeminiClient } from "@/lib/agents/gemini-client";

export interface CoverCompilationResult {
  success: boolean;
  pdfPath: string | null;
  pngPath: string | null;
  pdfBuffer: Buffer | null;
  pngBuffer: Buffer | null;
  dimensions: {
    widthInches: number;
    heightInches: number;
    widthPx: number;
    heightPx: number;
    dpi: number;
  };
  error?: string;
}

/**
 * Cria o diretório de destino para exportação das capas KDP.
 */
function ensureCoversDir(): string {
  const dir = path.join(process.cwd(), "data", "exports", "covers");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Sanitiza strings para interpolação segura em HTML, prevenindo ataques XSS.
 */
function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Gera uma arte vetorial SVG personalizada de alto nível editorial com o Gemini,
 * concebida especificamente para a tese, nicho e metáforas visuais do livro gerado.
 */
export async function generateBespokeCoverSvg(
  book: BookRecord,
  chapters: ChapterRecord[] = [],
  metaphor?: DynamicVisualMetaphor
): Promise<string | undefined> {
  const client = getGeminiClient();
  if (!client) return undefined;

  // Resolver metáfora visual dinâmica (definida pelo LLM para este livro)
  const dynamicMetaphor =
    metaphor ||
    extractMetaphorFromCoverPrompt(book.cover_prompt) ||
    generateDefaultDynamicMetaphor(book, chapters);

  const chaptersContext = chapters.slice(0, 5).map(c => `- ${c.title}: ${c.synopsis || ""}`).join("\n");

  const prompt = `Gere o código de ilustração vetorial SVG para o motivo visual da capa deste livro:
TÍTULO: "${book.title}"
CONCEITO: "${dynamicMetaphor.metaphorConcept}"
DESCRIÇÃO: "${dynamicMetaphor.motifDescription}"
FORMAS: "${dynamicMetaphor.motifShapes}"
CORES: Destaque "${dynamicMetaphor.accentColor}", Contraste Neutro "${dynamicMetaphor.secondaryColor}"

INSTRUÇÕES OBRIGATÓRIAS DE DESIGN:
1. FUSÃO DE 2 ESTILOS:
   - Traços Blueprint Técnicos de alta precisão (stroke="#334155" ou stroke="${dynamicMetaphor.secondaryColor}", stroke-width="1.2" a "1.6") desenhando os mecanismos, componentes ou eixos centrais do assunto.
   - Linhas e Ondas de Fluxo Orgânicas (<path> em curvas Bézier com degradê <linearGradient> em opacidade 0.3 a 0.7) simbolizando energia, calor, dinâmica de fluidos ou transição contínua.
2. Dimensões: viewBox="0 0 470 470". O desenho deve caber na área de 30 a 430.
3. ZERO TEXTO: NUNCA crie tags <text>, <tspan>, nem desenhe números, cotas ou letras.
4. Fundo: Transparente (será colocado sobre fundo branco #ffffff).
5. FORMATO DE SAÍDA: Retorne EXCLUSIVAMENTE os elementos internos do SVG começando por <defs> e <g>. NÃO escreva explicações em prosa, NÃO use markdown.`;

  try {
    console.log("[generateBespokeCoverSvg] Iniciando chamada ao Gemini para gerar SVG...");
    const callPromise = callGemini(prompt, {
      systemInstruction: "Você é um gerador autônomo de código vetorial SVG puro. Sua única saída permitida é código XML/SVG puro (<defs> e <g>). É expressamente proibido escrever qualquer explicação em linguagem natural, comentários em prosa, crases markdown ou texto fora do SVG.",
      maxOutputTokens: 4096,
    });

    let timerId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error("Timeout de 35s ao gerar SVG personalizado")), 35000);
    });

    let response: any;
    try {
      response = await Promise.race([callPromise, timeoutPromise]);
    } finally {
      if (timerId) clearTimeout(timerId);
    }
    console.log("[generateBespokeCoverSvg] Resposta recebida do Gemini! Comprimento:", response.text.length);
    let rawSvg = response.text.trim();

    // Limpeza de markdown codeblocks
    rawSvg = rawSvg.replace(/```(?:xml|svg|html)?/gi, "").replace(/```/g, "").trim();

    // Se a IA gerou a tag <svg> externa, extrair apenas o conteúdo interno
    const innerSvgMatch = rawSvg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    if (innerSvgMatch) {
      rawSvg = innerSvgMatch[1].trim();
    }

    // Validações estritas de conformidade e segurança
    if (rawSvg.includes("<text") || rawSvg.includes("</text>") || rawSvg.includes("<tspan")) {
      console.warn("[generateBespokeCoverSvg] SVG rejeitado por conter tag <text>:", rawSvg.slice(0, 150));
      return undefined;
    }
    if (rawSvg.includes("<script") || rawSvg.includes("onload=") || rawSvg.includes("onerror=")) {
      console.warn("[generateBespokeCoverSvg] SVG rejeitado por conter scripts.");
      return undefined;
    }
    if (!rawSvg.includes("<path") && !rawSvg.includes("<line") && !rawSvg.includes("<polygon") && !rawSvg.includes("<circle") && !rawSvg.includes("<rect")) {
      console.warn("[generateBespokeCoverSvg] SVG rejeitado por não conter elementos vetoriais. Raw output:", rawSvg.slice(0, 200));
      return undefined;
    }

    return rawSvg;
  } catch (err: any) {
    console.warn("[generateBespokeCoverSvg] Erro/Timeout na geração de SVG. Fallback:", err?.message || err);
    return undefined;
  }
}

/**
 * Biblioteca procedural de metáforas visuais conceituais de alta sofisticação.
 * Cada composição é desenhada especificamente para transmitir visualmente o assunto do livro com 50% mais criatividade.
 */
export function getThematicCoverSvg(
  book: BookRecord,
  chapters: ChapterRecord[] = [],
  metaphor?: DynamicVisualMetaphor
): { svgGraphic: string; accentColor: string; secondaryColor: string; kickerText: string } {
  const cleanTitle = (book.title || "").replace(/[#*_`]/g, "").trim();
  const t = (cleanTitle + " " + (book.target_audience || "") + " " + (book.executive_summary || "")).toLowerCase();

  // Detecção cirúrgica de temas com priorização por afinidade conceitual
  const isThermalMotors =
    t.includes("motor") ||
    t.includes("combustão") ||
    t.includes("combustao") ||
    t.includes("termodinâm") ||
    t.includes("termodinam") ||
    t.includes("pistão") ||
    t.includes("pistao") ||
    t.includes("cilindro") ||
    t.includes("biela") ||
    t.includes("virabrequim") ||
    t.includes("válvula") ||
    t.includes("valvula") ||
    t.includes("quatro tempos") ||
    t.includes("ciclo otto") ||
    t.includes("ciclo diesel") ||
    t.includes("ignição") ||
    t.includes("ignicao");

  const isMechanicalEng =
    !isThermalMotors &&
    (t.includes("nbr") ||
      t.includes("tolerânc") ||
      t.includes("toleranc") ||
      t.includes("acoplamento") ||
      t.includes("mecânic") ||
      t.includes("mecanic") ||
      (t.includes("eixo") && (t.includes("furo") || t.includes("peça") || t.includes("usinagem") || t.includes("tolerânc"))) ||
      (t.includes("ajuste") && (t.includes("nbr") || t.includes("mecânic") || t.includes("tolerânc") || t.includes("dimensional") || t.includes("eixo"))) ||
      t.includes("intercambi") ||
      t.includes("usinagem") ||
      (t.includes("engenhar") && !t.includes("prompt") && !t.includes("software") && !t.includes("dados")));

  const isAiTech =
    t.includes("prompt") ||
    t.includes("inteligência") ||
    t.includes("inteligencia") ||
    t.includes("neural") ||
    t.includes("machine learning") ||
    t.includes("deep learning") ||
    t.includes("software") ||
    t.includes("algoritmo") ||
    t.includes("computa") ||
    t.includes("llm") ||
    t.includes("código") ||
    t.includes("codigo") ||
    t.includes("programação") ||
    t.includes("programacao") ||
    (t.includes("ia") && (t.includes("modelo") || t.includes("gerador") || t.includes("redes") || t.includes("vetor")));

  const isMarketing =
    t.includes("marketing") ||
    t.includes("venda") ||
    t.includes("funil") ||
    t.includes("taxa de conversão") ||
    t.includes("taxa de conversao") ||
    t.includes("conversão de vendas") ||
    t.includes("conversao de vendas") ||
    t.includes("louco") ||
    t.includes("demanda") ||
    t.includes("cac") ||
    t.includes("ltv") ||
    t.includes("roas") ||
    t.includes("tráfego") ||
    t.includes("trafego") ||
    (t.includes("conversão") && !t.includes("energia") && !t.includes("mecânic") && !t.includes("física") && !t.includes("termodinâm")) ||
    (t.includes("conversao") && !t.includes("energia") && !t.includes("mecanic") && !t.includes("fisica") && !t.includes("termodinam")) ||
    (t.includes("métrica") && !t.includes("dimensional") && !t.includes("mecânic"));

  // 0. MOTORES DE COMBUSTÃO INTERNA / TERMODINÂMICA / MÁQUINAS TÉRMICAS
  if (isThermalMotors) {
    return {
      accentColor: "#ea580c",
      secondaryColor: "#1e293b",
      kickerText: "TERMODINÂMICA & MOTORES TÉRMICOS",
      svgGraphic: `
        <defs>
          <linearGradient id="heatGradient" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ea580c" stop-opacity="0.85" />
            <stop offset="50%" stop-color="#d97706" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#b45309" stop-opacity="1" />
          </linearGradient>
          <linearGradient id="combustionGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#b45309" stop-opacity="0.75" />
            <stop offset="50%" stop-color="#d97706" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#ea580c" stop-opacity="0.85" />
          </linearGradient>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0284c7" stop-opacity="0.65" />
            <stop offset="50%" stop-color="#334155" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.25" />
          </linearGradient>
        </defs>
        <g>
          <!-- 1. Blueprint Técnico do Cilindro e Cabeçote -->
          <rect x="150" y="50" width="170" height="365" rx="5" ry="5" fill="none" stroke="#334155" stroke-width="1.6" />
          <line x1="235" y1="30" x2="235" y2="435" stroke="#64748b" stroke-width="1.0" stroke-dasharray="14,4,4,4" />

          <!-- Válvula de Admissão -->
          <path d="M 185 70 L 185 105 C 185 115 195 115 195 105 L 195 70 Z" fill="#0284c7" fill-opacity="0.1" stroke="#0284c7" stroke-width="1.2" />
          <circle cx="190" cy="115" r="13" fill="none" stroke="#0284c7" stroke-width="1.2" />

          <!-- Válvula de Escape -->
          <path d="M 275 70 L 275 105 C 275 115 285 115 285 105 L 285 70 Z" fill="#ea580c" fill-opacity="0.1" stroke="#ea580c" stroke-width="1.2" />
          <circle cx="280" cy="115" r="13" fill="none" stroke="#ea580c" stroke-width="1.2" />

          <!-- Câmara de Combustão -->
          <path d="M 150 145 C 150 115 165 95 185 95 C 205 95 220 85 235 85 C 250 85 265 95 285 95 C 305 95 320 115 320 145 L 320 280 L 150 280 Z" fill="none" stroke="#0284c7" stroke-width="1.2" />

          <!-- Corpo do Pistão e Canaletas de Anéis -->
          <rect x="165" y="275" width="140" height="100" rx="3" ry="3" fill="#f8fafc" stroke="#1e293b" stroke-width="1.8" />
          <path d="M 165 275 Q 235 255 305 275 Z" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.6" />
          <line x1="165" y1="285" x2="305" y2="285" stroke="#334155" stroke-width="1.2" />
          <line x1="165" y1="292" x2="305" y2="292" stroke="#334155" stroke-width="1.2" />
          <line x1="165" y1="299" x2="305" y2="299" stroke="#334155" stroke-width="1.2" />

          <!-- Biela e Pino do Pistão -->
          <circle cx="235" cy="325" r="12" fill="#e2e8f0" stroke="#1e293b" stroke-width="1.5" />
          <path d="M 226 335 L 220 415 L 250 415 L 244 335 Z" fill="none" stroke="#334155" stroke-width="1.6" />

          <!-- 2. Linhas de Fluxo Orgânicas e Vórtice de Combustão -->
          <path d="M 235 85 C 260 120 270 165 260 185 C 250 205 225 205 215 185 C 200 160 210 120 235 85 Z" fill="url(#combustionGradient)" opacity="0.65" />
          <path d="M 235 85 C 250 108 255 135 250 155 C 244 175 228 175 224 155 C 218 135 226 108 235 85 Z" fill="url(#heatGradient)" opacity="0.75" />

          <!-- Ondas de Calor Térmico em Curvas Bézier -->
          <path d="M 220 100 C 208 118 198 145 204 165 C 210 185 232 195 248 185 C 264 175 274 152 268 132 C 262 110 240 95 220 100 Z" fill="none" stroke="url(#heatGradient)" stroke-width="1.8" opacity="0.85" />
          <path d="M 235 90 Q 252 112 262 142 Q 272 172 252 188 Q 232 202 212 188 Q 192 172 202 142 Q 212 112 235 90 Z" fill="none" stroke="url(#combustionGradient)" stroke-width="1.4" opacity="0.75" />

          <!-- Fluxo de Admissão de Ar (Frio) -->
          <path d="M 190 60 C 178 78 174 105 180 125 C 186 145 198 150 204 135 C 210 118 202 92 190 60 Z" fill="url(#flowGradient)" opacity="0.55" />
          <path d="M 190 60 C 182 70 178 92 182 108 C 186 124 194 128 198 112 C 202 96 198 76 190 60 Z" fill="none" stroke="url(#flowGradient)" stroke-width="1.2" opacity="0.75" />

          <!-- Fluxo de Escape de Gases (Quente) -->
          <path d="M 280 60 C 292 78 296 105 290 125 C 284 145 272 150 266 135 C 260 118 268 92 280 60 Z" fill="url(#heatGradient)" opacity="0.55" />
          <path d="M 280 60 C 288 70 292 92 288 108 C 284 124 276 128 272 112 C 268 96 272 76 280 60 Z" fill="none" stroke="url(#heatGradient)" stroke-width="1.2" opacity="0.75" />

          <!-- Linhas de Dinâmica dos Fluidos e Dissipação Térmica -->
          <path d="M 150 220 C 115 270 115 320 150 370" fill="none" stroke="#ea580c" stroke-width="1.3" opacity="0.75" />
          <path d="M 320 220 C 355 270 355 320 320 370" fill="none" stroke="#d97706" stroke-width="1.3" opacity="0.75" />
          <path d="M 165 320 C 140 340 140 365 165 385" fill="none" stroke="#0284c7" stroke-width="1.0" opacity="0.65" />
          <path d="M 305 320 C 330 340 330 365 305 385" fill="none" stroke="#0284c7" stroke-width="1.0" opacity="0.65" />
        </g>
      `,
    };
  }

  const isFinance =
    t.includes("financ") ||
    (t.includes("invest") && !t.includes("investiga")) ||
    t.includes("dinheiro") ||
    t.includes("patrimônio") ||
    t.includes("patrimonio") ||
    t.includes("lucro") ||
    (t.includes("capital") && !t.includes("capital humano")) ||
    t.includes("valuation") ||
    t.includes("riqueza") ||
    t.includes("dividend") ||
    t.includes("bolsa de valores") ||
    t.includes("renda fixa");

  const isHealth =
    t.includes("saúde") ||
    t.includes("saude") ||
    t.includes("médic") ||
    t.includes("medic") ||
    t.includes("biolog") ||
    t.includes("fisiolog") ||
    /\bcorpo\b/i.test(t) ||
    /\bmente\b/i.test(t) ||
    t.includes("psicolog") ||
    t.includes("neuro") ||
    t.includes("nutriç") ||
    t.includes("nutric") ||
    t.includes("clínic") ||
    t.includes("clinic");

  const isHumanities =
    t.includes("educa") ||
    t.includes("ensino") ||
    t.includes("filosof") ||
    t.includes("direito") ||
    t.includes("juríd") ||
    t.includes("jurid") ||
    t.includes("históri") ||
    t.includes("histori") ||
    t.includes("pedagog") ||
    t.includes("dialétic") ||
    t.includes("dialetic") ||
    t.includes("conhecimento");

  const isLeadership =
    t.includes("gestão") ||
    t.includes("gestao") ||
    t.includes("liderança") ||
    t.includes("lideranca") ||
    t.includes("estratégia") ||
    t.includes("estrategia") ||
    t.includes("negócio") ||
    t.includes("negocio") ||
    t.includes("executivo") ||
    t.includes("governança") ||
    t.includes("governanca") ||
    t.includes("ágil") ||
    t.includes("agil") ||
    t.includes("okr");

  // 1. MARKETING / VENDAS / MÉTRICAS DE MARKETING / CONVERSÃO / TRAÇÃO
  if (isMarketing) {
    return {
      accentColor: "#b45309",
      secondaryColor: "#0f172a",
      kickerText: "MENSURAÇÃO, DESEMPENHO & CRESCIMENTO COMERCIAL",
      svgGraphic: `
        <defs>
          <linearGradient id="mktFunnelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.30" />
            <stop offset="100%" stop-color="#b45309" stop-opacity="0.08" />
          </linearGradient>
          <linearGradient id="mktCurveGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#b45309" />
            <stop offset="100%" stop-color="#f59e0b" />
          </linearGradient>
          <linearGradient id="mktPillarGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#b45309" stop-opacity="0.10" />
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.25" />
          </linearGradient>
        </defs>
        <g transform="translate(25, 25)">
          <!-- Eixos base e horizonte de métricas -->
          <line x1="20" y1="410" x2="420" y2="410" stroke="#cbd5e1" stroke-width="1.2" />
          <line x1="420" y1="410" x2="420" y2="20" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />
          <line x1="20" y1="280" x2="420" y2="280" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4,4" />

          <!-- 1. FUNIL ISOMÉTRICO DE CONVERSÃO EDITORIAL -->
          <ellipse cx="140" cy="95" rx="85" ry="24" fill="url(#mktFunnelGrad)" stroke="#b45309" stroke-width="1.8" />
          <ellipse cx="140" cy="155" rx="55" ry="16" fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4,3" />
          <polygon points="55,95 225,95 175,230 105,230" fill="#b45309" fill-opacity="0.06" stroke="#b45309" stroke-width="1.6" />
          <rect x="115" y="230" width="50" height="35" fill="#0f172a" fill-opacity="0.04" stroke="#0f172a" stroke-width="1.4" />
          <line x1="140" y1="95" x2="140" y2="265" stroke="#b45309" stroke-width="1" stroke-dasharray="3,3" />

          <!-- 2. PILARES DE CRESCIMENTO E MENSURAÇÃO (CAC -> LTV -> ROI) -->
          <rect x="195" y="320" width="28" height="90" rx="3" fill="#0f172a" fill-opacity="0.06" stroke="#0f172a" stroke-width="1.2" />
          <rect x="235" y="255" width="28" height="155" rx="3" fill="#b45309" fill-opacity="0.08" stroke="#b45309" stroke-width="1.4" />
          <rect x="275" y="185" width="28" height="225" rx="3" fill="url(#mktPillarGrad)" stroke="#b45309" stroke-width="1.6" />
          <rect x="315" y="105" width="28" height="305" rx="3" fill="#f59e0b" fill-opacity="0.14" stroke="#f59e0b" stroke-width="1.8" />

          <!-- 3. CURVA EXPONENCIAL DE DEMANDA & TRAÇÃO COMERCIAL -->
          <path d="M 140 265 Q 220 300 289 185 T 395 35" fill="none" stroke="url(#mktCurveGrad)" stroke-width="3.5" />
          <path d="M 70 410 Q 230 370 340 105" fill="none" stroke="#0f172a" stroke-width="1.4" stroke-dasharray="6,4" />

          <!-- 4. ANÉIS CONCÊNTRICOS DE RETENÇÃO E APEX -->
          <circle cx="395" cy="35" r="20" fill="none" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4,3" />
          <circle cx="395" cy="35" r="36" fill="none" stroke="#b45309" stroke-width="0.8" stroke-dasharray="2,4" />
          <circle cx="395" cy="35" r="7" fill="#b45309" />
          <circle cx="140" cy="265" r="5" fill="#0f172a" />
          <circle cx="289" cy="185" r="5" fill="#b45309" />

          <!-- 5. MIRAS DE PRECISÃO NOS PONTOS DE EQUILÍBRIO -->
          <g stroke="#b45309" stroke-width="1.2">
            <line x1="284" y1="185" x2="294" y2="185" />
            <line x1="289" y1="180" x2="289" y2="190" />
            <line x1="135" y1="265" x2="145" y2="265" />
            <line x1="140" y1="260" x2="140" y2="270" />
            <line x1="390" y1="35" x2="400" y2="35" />
            <line x1="395" y1="30" x2="395" y2="40" />
          </g>
        </g>
      `,
    };
  }

  // 2. ENGENHARIA MECÂNICA / NBR / TOLERÂNCIAS / AJUSTES / MANUFATURA
  if (isMechanicalEng) {
    return {
      accentColor: "#0284c7",
      secondaryColor: "#1e293b",
      kickerText: "ENGENHARIA MECÂNICA & PRECISÃO DIMENSIONAL",
      svgGraphic: `
        <defs>
          <linearGradient id="engShaftGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0284c7" stop-opacity="0.18" />
            <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.06" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.22" />
          </linearGradient>
          <linearGradient id="engHoleGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1e293b" stop-opacity="0.08" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <g transform="translate(25, 25)">
          <!-- Linhas de centro industriais (traço-ponto) -->
          <line x1="30" y1="225" x2="420" y2="225" stroke="#64748b" stroke-width="1.2" stroke-dasharray="18,4,4,4" />
          <line x1="225" y1="20" x2="225" y2="430" stroke="#64748b" stroke-width="1.2" stroke-dasharray="18,4,4,4" />

          <!-- 1. CORTE DE ACOPLAMENTO EIXO-FURO (SHAFT & HOLE INTERFERENCE FIT) -->
          <!-- Furo externo (Sleeve) -->
          <path d="M 100 70 L 350 70 L 350 380 L 100 380 Z" fill="url(#engHoleGrad)" stroke="#1e293b" stroke-width="1.6" />
          <!-- Eixo mecânico interno de precisão -->
          <rect x="155" y="40" width="140" height="370" rx="8" fill="url(#engShaftGrad)" stroke="#0284c7" stroke-width="2" />
          <!-- Chanfros de entrada de ajuste NBR -->
          <polygon points="155,40 170,25 280,25 295,40" fill="#0284c7" fill-opacity="0.15" stroke="#0284c7" stroke-width="1.6" />
          <!-- Linha de tolerância e folga microscópica -->
          <line x1="155" y1="40" x2="155" y2="410" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="4,3" />
          <line x1="295" y1="40" x2="295" y2="410" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="4,3" />

          <!-- 2. CAMPOS DE TOLERÂNCIA CONCÊNTRICOS NBR (IT6 / IT7) -->
          <circle cx="225" cy="225" r="155" fill="none" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="6,4" />
          <circle cx="225" cy="225" r="110" fill="none" stroke="#1e293b" stroke-width="1.4" stroke-dasharray="4,3" />
          <circle cx="225" cy="225" r="65" fill="none" stroke="#38bdf8" stroke-width="1.5" />
          <circle cx="225" cy="225" r="6" fill="#0284c7" />

          <!-- 3. GRADUAÇÃO VERNIER MICROMÉTRICA (SEM NÚMEROS) -->
          <line x1="365" y1="120" x2="365" y2="330" stroke="#0284c7" stroke-width="1.4" />
          <g stroke="#0284c7" stroke-width="1.2">
            <line x1="365" y1="130" x2="380" y2="130" />
            <line x1="365" y1="145" x2="373" y2="145" />
            <line x1="365" y1="160" x2="373" y2="160" />
            <line x1="365" y1="175" x2="380" y2="175" />
            <line x1="365" y1="190" x2="373" y2="190" />
            <line x1="365" y1="205" x2="373" y2="205" />
            <line x1="365" y1="220" x2="383" y2="220" stroke-width="1.8" />
            <line x1="365" y1="235" x2="373" y2="235" />
            <line x1="365" y1="250" x2="373" y2="250" />
            <line x1="365" y1="265" x2="380" y2="265" />
            <line x1="365" y1="280" x2="373" y2="280" />
            <line x1="365" y1="295" x2="373" y2="295" />
            <line x1="365" y1="310" x2="380" y2="310" />
          </g>

          <!-- 4. DIAGONAL DE TENSÃO E PONTOS DE ANCORAGEM -->
          <line x1="30" y1="410" x2="410" y2="30" stroke="#0284c7" stroke-width="2.6" stroke-opacity="0.85" />
          <circle cx="410" cy="30" r="6" fill="#0284c7" />
          <circle cx="410" cy="30" r="15" fill="none" stroke="#0284c7" stroke-width="1" stroke-opacity="0.4" />
          <circle cx="30" cy="410" r="5" fill="#1e293b" />

          <!-- 5. MIRAS DE ALINHAMENTO GEOMÉTRICO (+) -->
          <g stroke="#0284c7" stroke-width="1.4">
            <line x1="220" y1="225" x2="230" y2="225" />
            <line x1="225" y1="220" x2="225" y2="230" />
            <line x1="150" y1="40" x2="160" y2="40" />
            <line x1="155" y1="35" x2="155" y2="45" />
            <line x1="290" y1="40" x2="300" y2="40" />
            <line x1="295" y1="35" x2="295" y2="45" />
          </g>
        </g>
      `,
    };
  }

  // 3. FINANÇAS / INVESTIMENTOS / DINHEIRO / VALUATION / PATRIMÔNIO
  if (isFinance) {
    return {
      accentColor: "#047857",
      secondaryColor: "#92400e",
      kickerText: "GESTÃO FINANCEIRA, VALUATION & CAPITAL",
      svgGraphic: `
        <defs>
          <linearGradient id="finSpiralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#047857" />
            <stop offset="100%" stop-color="#10b981" />
          </linearGradient>
          <linearGradient id="finBlockGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#047857" stop-opacity="0.14" />
            <stop offset="100%" stop-color="#92400e" stop-opacity="0.04" />
          </linearGradient>
        </defs>
        <g transform="translate(25, 25)">
          <!-- Eixos coordenados e horizonte de capital -->
          <line x1="20" y1="410" x2="420" y2="410" stroke="#cbd5e1" stroke-width="1.2" />
          <line x1="420" y1="410" x2="420" y2="20" stroke="#cbd5e1" stroke-width="1.2" />
          <line x1="20" y1="230" x2="420" y2="230" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4,4" />

          <!-- 1. MOSAICO DE ALOCAÇÃO DE ATIVOS DE FIBONACCI (ASSET ALLOCATION TILES) -->
          <rect x="200" y="200" width="55" height="55" fill="#047857" fill-opacity="0.12" stroke="#047857" stroke-width="1.5" />
          <rect x="200" y="255" width="90" height="90" fill="#92400e" fill-opacity="0.07" stroke="#92400e" stroke-width="1.5" />
          <rect x="90" y="200" width="110" height="145" fill="url(#finBlockGrad)" stroke="#047857" stroke-width="1.6" />
          <rect x="90" y="55" width="200" height="145" fill="#047857" fill-opacity="0.05" stroke="#92400e" stroke-width="1.3" stroke-dasharray="5,4" />

          <!-- 2. ESPIRAL LOGARÍTMICA DE JUROS COMPOSTOS & RETORNO ACUMULADO -->
          <path d="M 410 410 A 320 320 0 0 0 90 90 A 200 200 0 0 1 290 200 A 90 90 0 0 1 200 255" fill="none" stroke="url(#finSpiralGrad)" stroke-width="3.6" />

          <!-- 3. FULCRO DE EQUILÍBRIO RISCO-RETORNO (CAPITAL SCALE BEAM) -->
          <polygon points="245,395 235,410 255,410" fill="#92400e" stroke="#92400e" />
          <line x1="160" y1="380" x2="330" y2="395" stroke="#92400e" stroke-width="2.2" />
          <circle cx="160" cy="380" r="6" fill="#047857" />
          <circle cx="330" cy="395" r="7" fill="#92400e" />

          <!-- 4. ÓRBITAS ELÍPTICAS DE LIQUIDEZ E NÓS TANGENCIAIS -->
          <ellipse cx="245" cy="225" rx="145" ry="95" transform="rotate(-25 245 225)" fill="none" stroke="#047857" stroke-width="1" stroke-dasharray="6,4" stroke-opacity="0.5" />
          <circle cx="90" cy="90" r="6.5" fill="#047857" />
          <circle cx="90" cy="90" r="16" fill="none" stroke="#047857" stroke-width="1.2" stroke-opacity="0.4" />
          <circle cx="410" cy="410" r="7" fill="#92400e" />
          <circle cx="410" cy="410" r="18" fill="none" stroke="#92400e" stroke-width="1.2" stroke-opacity="0.35" />

          <!-- 5. MIRAS CARTESIANAS (+) -->
          <g stroke="#047857" stroke-width="1.3">
            <line x1="85" y1="90" x2="95" y2="90" />
            <line x1="90" y1="85" x2="90" y2="95" />
            <line x1="285" y1="200" x2="295" y2="200" />
            <line x1="290" y1="195" x2="290" y2="205" />
          </g>
        </g>
      `,
    };
  }

  // 4. INTELIGÊNCIA ARTIFICIAL / CIÊNCIA DE DADOS / SOFTWARE / LLMS / PROMPT
  if (isAiTech) {
    return {
      accentColor: "#2563eb",
      secondaryColor: "#0284c7",
      kickerText: "INTELIGÊNCIA ARTIFICIAL & CIÊNCIA DE DADOS",
      svgGraphic: `
        <defs>
          <linearGradient id="aiTensorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2563eb" />
            <stop offset="100%" stop-color="#38bdf8" />
          </linearGradient>
          <linearGradient id="aiClusterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.14" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.03" />
          </linearGradient>
        </defs>
        <g transform="translate(25, 25)">
          <!-- 1. RADAR DE DIFUSÃO CONCÊNTRICO DE INFERÊNCIA -->
          <circle cx="225" cy="225" r="175" fill="none" stroke="#e2e8f0" stroke-width="1.2" />
          <circle cx="225" cy="225" r="120" fill="none" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="6,4" stroke-opacity="0.5" />
          <circle cx="225" cy="225" r="65" fill="none" stroke="#2563eb" stroke-width="1.4" stroke-dasharray="4,3" stroke-opacity="0.6" />

          <!-- 2. FACETA DE ESPAÇO LATENTE DE EMBEDDINGS (VORONOI / DELAUNAY) -->
          <polygon points="110,210 225,120 340,190 280,330 150,310" fill="url(#aiClusterGrad)" stroke="#2563eb" stroke-width="1.6" />
          <polygon points="225,120 340,190 390,90" fill="#0284c7" fill-opacity="0.05" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="4,3" />

          <!-- 3. CAMADAS DE REDE NEURAL (INPUT -> LATENT -> DECISION) -->
          <!-- Camada de Entrada -->
          <circle cx="80" cy="130" r="5" fill="#1e293b" />
          <circle cx="80" cy="195" r="5" fill="#1e293b" />
          <circle cx="80" cy="260" r="5" fill="#1e293b" />
          <circle cx="80" cy="325" r="5" fill="#1e293b" />

          <!-- Camada Oculta / Atenção -->
          <circle cx="225" cy="120" r="6" fill="#0284c7" />
          <circle cx="225" cy="225" r="8" fill="#2563eb" />
          <circle cx="225" cy="225" r="18" fill="none" stroke="#2563eb" stroke-width="1.4" stroke-opacity="0.4" />
          <circle cx="225" cy="330" r="6" fill="#0284c7" />

          <!-- Camada de Saída -->
          <circle cx="370" cy="150" r="5.5" fill="#2563eb" />
          <circle cx="370" cy="225" r="7" fill="#38bdf8" />
          <circle cx="370" cy="300" r="5.5" fill="#2563eb" />

          <!-- Filamentos de Conexão Tensor e Fluxo Sináptico -->
          <line x1="80" y1="130" x2="225" y2="120" stroke="url(#aiTensorGrad)" stroke-width="1.8" />
          <line x1="80" y1="195" x2="225" y2="225" stroke="url(#aiTensorGrad)" stroke-width="2.4" />
          <line x1="80" y1="260" x2="225" y2="225" stroke="url(#aiTensorGrad)" stroke-width="2.4" />
          <line x1="80" y1="325" x2="225" y2="330" stroke="url(#aiTensorGrad)" stroke-width="1.8" />
          
          <line x1="225" y1="120" x2="370" y2="150" stroke="#0284c7" stroke-width="1.6" />
          <line x1="225" y1="225" x2="370" y2="225" stroke="url(#aiTensorGrad)" stroke-width="2.6" />
          <line x1="225" y1="330" x2="370" y2="300" stroke="#0284c7" stroke-width="1.6" />
          <line x1="225" y1="120" x2="370" y2="225" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,3" />
          <line x1="225" y1="330" x2="370" y2="225" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,3" />

          <!-- 4. MIRAS CARTESIANAS (+) -->
          <g stroke="#2563eb" stroke-width="1.3">
            <line x1="220" y1="225" x2="230" y2="225" />
            <line x1="225" y1="220" x2="225" y2="230" />
            <line x1="365" y1="225" x2="375" y2="225" />
            <line x1="370" y1="220" x2="370" y2="230" />
          </g>
        </g>
      `,
    };
  }

  // 5. GESTÃO ESTRATÉGICA / LIDERANÇA ÁGIL / GOVERNANÇA CORPORATIVA
  if (isLeadership) {
    return {
      accentColor: "#334155",
      secondaryColor: "#0f172a",
      kickerText: "LIDERANÇA EXECUTIVA & ESTRATÉGIA CORPORATIVA",
      svgGraphic: `
        <defs>
          <linearGradient id="stratGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#475569" />
          </linearGradient>
          <linearGradient id="stratFacet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#334155" stop-opacity="0.12" />
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.03" />
          </linearGradient>
        </defs>
        <g transform="translate(25, 25)">
          <!-- Eixos ortogonais de coordenadas estratégicas -->
          <line x1="20" y1="410" x2="420" y2="410" stroke="#cbd5e1" stroke-width="1.2" />
          <line x1="420" y1="410" x2="420" y2="20" stroke="#cbd5e1" stroke-width="1.2" />
          <line x1="20" y1="235" x2="420" y2="235" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4,4" />

          <!-- 1. BÚSSOLA DE HORIZONTE ESTRATÉGICO (DIREÇÃO NORDESTE 45°) -->
          <line x1="50" y1="390" x2="385" y2="55" stroke="url(#stratGrad)" stroke-width="3.4" />
          <polygon points="385,55 345,72 368,95" fill="#1e293b" stroke="#1e293b" />

          <!-- 2. PIRÂMIDE DE GOVERNANÇA DESCENTRALIZADA EM PLANOS ISOMÉTRICOS -->
          <polygon points="90,360 270,360 350,250 170,250" fill="url(#stratFacet)" stroke="#1e293b" stroke-width="1.6" />
          <polygon points="170,250 350,250 350,140 170,140" fill="#334155" fill-opacity="0.05" stroke="#475569" stroke-width="1.3" stroke-dasharray="5,4" />
          <rect x="210" y="80" width="110" height="110" fill="none" stroke="#1e293b" stroke-width="1.2" />

          <!-- 3. CICLOS ÁGEIS CONCÊNTRICOS DE FEEDBACK (SPRINT RINGS) -->
          <circle cx="260" cy="195" r="115" fill="none" stroke="#334155" stroke-width="1.2" stroke-dasharray="8,5" />
          <circle cx="260" cy="195" r="65" fill="none" stroke="#64748b" stroke-width="1.4" stroke-dasharray="4,3" />
          <circle cx="260" cy="195" r="6.5" fill="#1e293b" />

          <!-- 4. NÓS DE GOVERNANÇA E EQUILÍBRIO ÁUREO -->
          <circle cx="385" cy="55" r="7" fill="#1e293b" />
          <circle cx="385" cy="55" r="18" fill="none" stroke="#1e293b" stroke-width="1.2" stroke-opacity="0.4" />
          <circle cx="50" cy="390" r="5" fill="#475569" />
          <circle cx="170" cy="250" r="4.5" fill="#334155" />
          <circle cx="270" cy="360" r="4.5" fill="#1e293b" />

          <!-- 5. MIRAS DECISÓRIAS CARTESIANAS (+) -->
          <g stroke="#1e293b" stroke-width="1.3">
            <line x1="255" y1="195" x2="265" y2="195" />
            <line x1="260" y1="190" x2="260" y2="200" />
            <line x1="165" y1="250" x2="175" y2="250" />
            <line x1="170" y1="245" x2="170" y2="255" />
          </g>
        </g>
      `,
    };
  }

  // 6. SAÚDE, MEDICINA, BIOLOGIA & FISIOLOGIA HUMANA
  if (isHealth) {
    return {
      accentColor: "#0d9488",
      secondaryColor: "#134e4a",
      kickerText: "CIÊNCIA BIOLÓGICA, MEDICINA & FISIOLOGIA HUMANA",
      svgGraphic: `
        <defs>
          <linearGradient id="bioHelixGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0d9488" />
            <stop offset="100%" stop-color="#14b8a6" />
          </linearGradient>
          <linearGradient id="bioPulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0d9488" stop-opacity="0.18" />
            <stop offset="100%" stop-color="#134e4a" stop-opacity="0.04" />
          </linearGradient>
        </defs>
        <g transform="translate(25, 25)">
          <!-- 1. ANÉIS DE EQUILÍBRIO HOMEOSTÁTICO -->
          <circle cx="225" cy="225" r="175" fill="none" stroke="#cbd5e1" stroke-width="1.2" />
          <circle cx="225" cy="225" r="120" fill="none" stroke="#0d9488" stroke-width="1.3" stroke-dasharray="6,4" stroke-opacity="0.6" />
          <circle cx="225" cy="225" r="65" fill="none" stroke="#14b8a6" stroke-width="1.5" />

          <!-- 2. RITMO DE DUPLA HÉLICE MOLECULAR E PONTES DE LIGAÇÃO -->
          <path d="M 60 140 Q 140 70 225 140 T 390 140" fill="none" stroke="url(#bioHelixGrad)" stroke-width="3.2" />
          <path d="M 60 310 Q 140 380 225 310 T 390 310" fill="none" stroke="url(#bioHelixGrad)" stroke-width="3.2" />

          <!-- Pontes de ligação de base molecular -->
          <line x1="110" y1="100" x2="110" y2="350" stroke="#0d9488" stroke-width="1.3" stroke-dasharray="4,4" />
          <line x1="170" y1="95" x2="170" y2="355" stroke="#134e4a" stroke-width="1.3" stroke-dasharray="4,4" />
          <line x1="225" y1="140" x2="225" y2="310" stroke="#0d9488" stroke-width="2" />
          <line x1="280" y1="95" x2="280" y2="355" stroke="#134e4a" stroke-width="1.3" stroke-dasharray="4,4" />
          <line x1="340" y1="100" x2="340" y2="350" stroke="#0d9488" stroke-width="1.3" stroke-dasharray="4,4" />

          <!-- 3. PULSO CARDÍACO / FREQUÊNCIA VITAL -->
          <path d="M 40 225 L 140 225 L 165 170 L 190 270 L 210 205 L 225 240 L 240 225 L 410 225" fill="none" stroke="#134e4a" stroke-width="2.4" />

          <!-- 4. NÓS SINÁPTICOS E CENTRO HOMEOSTÁTICO -->
          <circle cx="225" cy="225" r="7.5" fill="#0d9488" />
          <circle cx="225" cy="225" r="18" fill="none" stroke="#0d9488" stroke-width="1.2" stroke-opacity="0.4" />
          <circle cx="110" cy="225" r="5" fill="#134e4a" />
          <circle cx="340" cy="225" r="5" fill="#134e4a" />
          <circle cx="60" cy="140" r="6" fill="#0d9488" />
          <circle cx="390" cy="310" r="6" fill="#0d9488" />

          <!-- 5. MIRAS HOMEOSTÁTICAS (+) -->
          <g stroke="#0d9488" stroke-width="1.3">
            <line x1="219" y1="225" x2="231" y2="225" />
            <line x1="225" y1="219" x2="225" y2="231" />
          </g>
        </g>
      `,
    };
  }

  // 7. EDUCAÇÃO, FILOSOFIA, DIREITO & HUMANIDADES
  if (isHumanities) {
    return {
      accentColor: "#6366f1",
      secondaryColor: "#312e81",
      kickerText: "FUNDAMENTAÇÃO DIALÉTICA, HISTÓRIA & CONHECIMENTO",
      svgGraphic: `
        <defs>
          <linearGradient id="humPrismGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#6366f1" />
            <stop offset="100%" stop-color="#818cf8" />
          </linearGradient>
          <linearGradient id="humPlaneGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.14" />
            <stop offset="100%" stop-color="#312e81" stop-opacity="0.04" />
          </linearGradient>
        </defs>
        <g transform="translate(25, 25)">
          <!-- 1. PRISMA ANALÍTICO DE REFRAÇÃO CONCEITUAL -->
          <polygon points="225,50 380,350 70,350" fill="url(#humPlaneGrad)" stroke="#6366f1" stroke-width="1.8" />
          <polygon points="225,50 280,350 170,350" fill="#6366f1" fill-opacity="0.06" stroke="#312e81" stroke-width="1.2" stroke-dasharray="5,4" />

          <!-- 2. ANÉIS CONCÊNTRICOS DE INVESTIGAÇÃO DIALÉTICA -->
          <circle cx="225" cy="245" r="145" fill="none" stroke="#cbd5e1" stroke-width="1.2" />
          <circle cx="225" cy="245" r="95" fill="none" stroke="#6366f1" stroke-width="1.4" stroke-dasharray="6,4" />
          <circle cx="225" cy="245" r="45" fill="none" stroke="#818cf8" stroke-width="1.6" />

          <!-- 3. PLANOS DE SUSTENTAÇÃO HISTÓRICA E DIALÓGICA -->
          <line x1="40" y1="380" x2="410" y2="380" stroke="#312e81" stroke-width="1.8" />
          <line x1="80" y1="400" x2="370" y2="400" stroke="#6366f1" stroke-width="1.2" stroke-dasharray="4,4" />

          <!-- 4. RAIO DE SÍNTESE E NÓS DE EQUILÍBRIO ÁUREO -->
          <line x1="50" y1="120" x2="225" y2="245" stroke="#312e81" stroke-width="1.8" stroke-dasharray="6,4" />
          <line x1="225" y1="245" x2="400" y2="370" stroke="url(#humPrismGrad)" stroke-width="2.8" />
          <circle cx="225" cy="50" r="7" fill="#6366f1" />
          <circle cx="225" cy="50" r="16" fill="none" stroke="#6366f1" stroke-width="1" stroke-opacity="0.4" />
          <circle cx="225" cy="245" r="6.5" fill="#312e81" />
          <circle cx="380" cy="350" r="5" fill="#6366f1" />
          <circle cx="70" cy="350" r="5" fill="#6366f1" />

          <!-- 5. MIRAS DE PRECISÃO CONCEITUAL (+) -->
          <g stroke="#6366f1" stroke-width="1.3">
            <line x1="219" y1="245" x2="231" y2="245" />
            <line x1="225" y1="239" x2="225" y2="251" />
          </g>
        </g>
      `,
    };
  }

  // 8. DEFAULT EDITORIAL DE REFERÊNCIA (PRIMEIROS PRINCÍPIOS)
  const dynamicAccent = metaphor?.accentColor || "#0284c7";
  const dynamicSecondary = metaphor?.secondaryColor || "#1e293b";
  const dynamicKicker = metaphor?.kickerText || "EDIÇÃO DE REFERÊNCIA EDITORIAL";

  return {
    accentColor: dynamicAccent,
    secondaryColor: dynamicSecondary,
    kickerText: dynamicKicker,
    svgGraphic: `
      <defs>
        <linearGradient id="defGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${dynamicAccent}" />
          <stop offset="100%" stop-color="${dynamicSecondary}" />
        </linearGradient>
        <linearGradient id="defFacet" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${dynamicAccent}" stop-opacity="0.10" />
          <stop offset="100%" stop-color="${dynamicSecondary}" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <g transform="translate(25, 25)">
        <line x1="20" y1="410" x2="420" y2="410" stroke="#e2e8f0" stroke-width="1.2" />
        <line x1="420" y1="410" x2="420" y2="20" stroke="#e2e8f0" stroke-width="1.2" />
        <polygon points="120,340 320,340 380,240 180,240" fill="url(#defFacet)" stroke="${dynamicAccent}" stroke-width="1.4" />
        <rect x="180" y="140" width="180" height="110" fill="${dynamicAccent}" fill-opacity="0.05" stroke="${dynamicSecondary}" stroke-width="1.5" />
        <line x1="30" y1="400" x2="400" y2="30" stroke="url(#defGrad)" stroke-width="2.8" />
        <circle cx="280" cy="180" r="75" fill="none" stroke="${dynamicAccent}" stroke-width="1" stroke-dasharray="6,4" />
        <circle cx="400" cy="30" r="6.5" fill="${dynamicAccent}" />
        <circle cx="400" cy="30" r="15" fill="none" stroke="${dynamicAccent}" stroke-width="1" stroke-opacity="0.4" />
        <circle cx="30" cy="400" r="5" fill="${dynamicSecondary}" />
        <g stroke="${dynamicAccent}" stroke-width="1.2">
          <line x1="275" y1="180" x2="285" y2="180" />
          <line x1="280" y1="175" x2="280" y2="185" />
        </g>
      </g>
    `,
  };
}

/**
 * Gera o HTML/SVG nativo de alta resolução (300 DPI) para o spread completo da capa:
 * - Zona Esquerda: Contracapa com sinopse analítica e área de código de barras vazia
 * - Zona Central: Lombada milimétrica com título vertical (se >= 80 páginas)
 * - Zona Direita: Capa frontal assimétrica, tipografia assertiva com kicker e motivo vetorial que reflete o assunto do livro
 */
export function buildNativeCoverHtml(
  book: BookRecord,
  chapters: ChapterRecord[],
  spec: WraparoundCoverSpec,
  customSvgGraphic?: string,
  customMetaphor?: DynamicVisualMetaphor
): string {
  const naturalSynopsis = extractCleanNaturalSynopsis(
    book.executive_summary,
    book.target_audience,
    480
  );
  const backCoverSynopsis = escapeHtml(naturalSynopsis);

  // Cálculos de larguras relativas baseadas na geometria exata da folha KDP
  const totalW = spec.totalWidthInches;
  const totalH = spec.totalHeightInches;
  const bleed = spec.bleedInches;
  const trimW = spec.trimWidthInches;
  const spineW = spec.spineWidthInches;

  const leftZoneWidthPct = (((bleed + trimW) / totalW) * 100).toFixed(4);
  const spineZoneWidthPct = ((spineW / totalW) * 100).toFixed(4);
  const rightZoneWidthPct = (((trimW + bleed) / totalW) * 100).toFixed(4);

  // Paleta elegante e sóbria
  const cleanTitle = (book.title || "TÍTULO DA OBRA").replace(/[#*_`]/g, "").trim();
  const safeTitle = escapeHtml(cleanTitle);

  // Calibração óptica do tamanho da fonte única para o título integral na capa
  let titleFontSize = "0.44in";
  if (cleanTitle.length > 55) {
    titleFontSize = "0.30in";
  } else if (cleanTitle.length > 32) {
    titleFontSize = "0.36in";
  }

  // Resolver metáfora visual dinâmica
  const metaphor =
    customMetaphor ||
    extractMetaphorFromCoverPrompt(book.cover_prompt) ||
    generateDefaultDynamicMetaphor(book, chapters);

  // Obter paleta temática e motivo vetorial que traduz o assunto do livro
  const thematic = getThematicCoverSvg(book, chapters, metaphor);
  const accentColor = metaphor.accentColor || thematic.accentColor;
  const secondaryColor = metaphor.secondaryColor || thematic.secondaryColor;
  const kickerText = escapeHtml(metaphor.kickerText || thematic.kickerText);
  const svgGraphic =
    customSvgGraphic && customSvgGraphic.trim().length > 30
      ? customSvgGraphic
      : thematic.svgGraphic;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Capa Completa KDP - ${safeTitle}</title>
  <style>
    @page {
      size: ${totalW}in ${totalH}in;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: ${totalW}in;
      height: ${totalH}in;
      background-color: #ffffff;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }
    .spread-container {
      display: flex;
      width: 100%;
      height: 100%;
      position: relative;
      background-color: #ffffff;
    }
    
    /* ZONA ESQUERDA: CONTRACAPA */
    .back-cover-zone {
      width: ${leftZoneWidthPct}%;
      height: 100%;
      padding: ${bleed + 0.6}in 0.7in ${bleed + 0.6}in ${bleed + 0.7}in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .synopsis-header {
      font-size: 0.16in;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${accentColor};
      margin-bottom: 0.18in;
      display: flex;
      align-items: center;
      gap: 0.08in;
    }
    .synopsis-header::before {
      content: "";
      display: inline-block;
      width: 0.18in;
      height: 2px;
      background-color: ${accentColor};
    }
    .synopsis-text {
      font-size: 0.145in;
      line-height: 1.65;
      color: #334155;
      text-align: justify;
      hyphens: auto;
      font-weight: 400;
    }
    .synopsis-highlights {
      margin-top: 0.25in;
      padding-top: 0.2in;
      border-top: 1px solid #e2e8f0;
    }
    .highlight-item {
      font-size: 0.13in;
      line-height: 1.5;
      color: #475569;
      margin-bottom: 0.1in;
      display: flex;
      align-items: flex-start;
      gap: 0.08in;
    }
    .highlight-item::before {
      content: "▪";
      color: ${accentColor};
      font-size: 0.15in;
      line-height: 1;
    }
    
    /* ÁREA RESERVADA PARA CÓDIGO DE BARRAS (BRANCO PURO SEM BORDAS E SEM LABELS) */
    .barcode-safe-area {
      width: 2.0in;
      height: 1.2in;
      background: #ffffff;
      align-self: flex-end;
      margin-top: auto;
      /* Área intencionalmente vazia para a etiqueta impressa pela gráfica da Amazon KDP */
    }

    /* ZONA CENTRAL: LOMBADA */
    .spine-zone {
      width: ${spineZoneWidthPct}%;
      height: 100%;
      background-color: #ffffff;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .spine-title {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      font-size: 0.14in;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #111827;
      white-space: nowrap;
      max-height: 80%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ZONA DIREITA: CAPA DA FRENTE */
    .front-cover-zone {
      width: ${rightZoneWidthPct}%;
      height: 100%;
      padding: ${bleed + 0.8}in ${bleed + 0.8}in ${bleed + 0.8}in 0.8in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      background-color: #ffffff;
    }
    .front-top-marker {
      display: flex;
      align-items: center;
      gap: 0.12in;
      margin-bottom: 0.25in;
    }
    .front-marker-bar {
      width: 0.45in;
      height: 4px;
      background-color: ${accentColor};
    }
    .front-kicker {
      font-size: 0.13in;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${accentColor};
    }
    .front-title {
      font-size: ${titleFontSize};
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.02em;
      color: #111827;
      text-transform: uppercase;
      max-width: 90%;
    }
    .front-divider {
      width: 1.2in;
      height: 2px;
      background-color: #e2e8f0;
      margin-top: 0.25in;
    }
    .front-graphic-container {
      align-self: flex-end;
      width: 4.0in;
      height: 4.0in;
      margin-top: auto;
      display: flex;
      align-items: flex-end;
      justify-content: flex-end;
    }
  </style>
</head>
<body>
  <div class="spread-container">
    <!-- 1. ZONA ESQUERDA: CONTRACAPA -->
    <div class="back-cover-zone">
      <div>
        <div class="synopsis-header">Visão Geral da Obra</div>
        <p class="synopsis-text">${backCoverSynopsis}</p>
        <div class="synopsis-highlights">
          <div class="highlight-item">Fundamentação conceitual ancorada em primeiros princípios.</div>
          <div class="highlight-item">Frameworks analíticos e métodos práticos para aplicação imediata.</div>
          <div class="highlight-item">Estrutura editorial desenhada para referência técnica contínua.</div>
        </div>
      </div>
      <!-- Área 100% limpa e branca reservada para a impressão do código de barras pela Amazon KDP -->
      <div class="barcode-safe-area"></div>
    </div>

    <!-- 2. ZONA CENTRAL: LOMBADA MILIMÉTRICA -->
    <div class="spine-zone">
      ${
        spec.spineTextAllowed
          ? `<div class="spine-title">${safeTitle}</div>`
          : `<!-- Lombada lisa (< 80 pgs conforme norma KDP) -->`
      }
    </div>

    <!-- 3. ZONA DIREITA: CAPA FRONTAL -->
    <div class="front-cover-zone">
      <div>
        <div class="front-top-marker">
          <div class="front-marker-bar"></div>
          <span class="front-kicker">${kickerText}</span>
        </div>
        <h1 class="front-title">${safeTitle}</h1>
        <div class="front-divider"></div>
      </div>

      <div class="front-graphic-container">
        <svg viewBox="0 0 470 470" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          ${svgGraphic}
        </svg>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Garante que o MediaBox, CropBox e TrimBox do PDF reflitam com exatidão matemática
 * em pontos tipográficos (72 pt/polegada) as dimensões exigidas pela Amazon KDP,
 * eliminando variações de arredondamento do motor de renderização do Chromium.
 */
function setExactPdfMediaBox(pdfBuffer: Buffer, targetWidthInches: number, targetHeightInches: number): Buffer {
  const targetPtW = Number((targetWidthInches * 72).toFixed(2));
  const targetPtH = Number((targetHeightInches * 72).toFixed(2));

  let content = pdfBuffer.toString("latin1");

  // Substitui /MediaBox [0 0 ...]
  content = content.replace(/\/MediaBox\s*\[\s*0\s+0\s+[0-9.]+\s+[0-9.]+\s*\]/g, () => {
    return `/MediaBox [0 0 ${targetPtW} ${targetPtH}]`;
  });

  // Substitui /CropBox [0 0 ...] se existir
  content = content.replace(/\/CropBox\s*\[\s*0\s+0\s+[0-9.]+\s+[0-9.]+\s*\]/g, () => {
    return `/CropBox [0 0 ${targetPtW} ${targetPtH}]`;
  });

  // Substitui /TrimBox [0 0 ...] se existir
  content = content.replace(/\/TrimBox\s*\[\s*0\s+0\s+[0-9.]+\s+[0-9.]+\s*\]/g, () => {
    return `/TrimBox [0 0 ${targetPtW} ${targetPtH}]`;
  });

  return Buffer.from(content, "latin1");
}

/**
 * Compila uma capa KDP oficial (PDF e PNG a 300 DPI) a partir de um HTML renderizado no Puppeteer.
 */
export async function compileCoverHtmlToFiles(
  htmlContent: string,
  spec: WraparoundCoverSpec,
  filePrefix: string
): Promise<{ pdfBuffer: Buffer; pngBuffer: Buffer; pdfPath: string; pngPath: string }> {
  const coversDir = ensureCoversDir();
  const timestamp = Date.now();
  const pdfPath = path.join(coversDir, `${filePrefix}_${timestamp}.pdf`);
  const pngPath = path.join(coversDir, `${filePrefix}_${timestamp}.png`);

  let browser: any = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    const page = await browser.newPage();
    // No Chromium, unidades CSS em polegadas são avaliadas a 96 px por polegada.
    // Para gerar uma imagem a 300 DPI com dimensões exatas (spec.totalWidthPx x spec.totalHeightPx),
    // definimos o viewport em pixels CSS (96 DPI) e o deviceScaleFactor como (300 / 96 = 3.125).
    const cssWidth = Math.round(spec.totalWidthInches * 96);
    const cssHeight = Math.round(spec.totalHeightInches * 96);
    await page.setViewport({
      width: cssWidth,
      height: cssHeight,
      deviceScaleFactor: 300 / 96,
    });

    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded", timeout: 60000,
    });

    // 1. Gera o PDF oficial com tamanho físico exato em polegadas e 0 margem
    const pdfUint8 = await page.pdf({
      width: `${spec.totalWidthInches}in`,
      height: `${spec.totalHeightInches}in`,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      printBackground: true,
    });
    const rawPdfBuffer = Buffer.from(pdfUint8);
    const pdfBuffer = setExactPdfMediaBox(rawPdfBuffer, spec.totalWidthInches, spec.totalHeightInches);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // 2. Gera o PNG em alta resolução (300 DPI)
    const pngUint8 = await page.screenshot({
      type: "png",
      fullPage: true,
    });
    const pngBuffer = Buffer.from(pngUint8);
    fs.writeFileSync(pngPath, pngBuffer);

    return { pdfBuffer, pngBuffer, pdfPath, pngPath };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Processa uma imagem enviada pelo usuário (ex: gerada por IA a 1200x880 ou com mockup),
 * executa auto-crop inteligente para eliminar molduras cinzas e sombras,
 * faz o upscale bicúbico a 300 DPI e compila o PDF oficial do Amazon KDP.
 */
export async function processAndCompileUploadedCoverImage(
  imageBuffer: Buffer,
  spec: WraparoundCoverSpec,
  bookId: string
): Promise<CoverCompilationResult> {
  let mimeType = "image/png";
  if (imageBuffer[0] === 0xff && imageBuffer[1] === 0xd8) {
    mimeType = "image/jpeg";
  } else if (
    imageBuffer.length >= 12 &&
    imageBuffer[0] === 0x52 &&
    imageBuffer[1] === 0x49 &&
    imageBuffer[2] === 0x46 &&
    imageBuffer[3] === 0x46 &&
    imageBuffer[8] === 0x57 &&
    imageBuffer[9] === 0x45 &&
    imageBuffer[10] === 0x42 &&
    imageBuffer[11] === 0x50
  ) {
    mimeType = "image/webp";
  }
  const base64Data = imageBuffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64Data}`;

  const coversDir = ensureCoversDir();
  const timestamp = Date.now();
  const pdfPath = path.join(coversDir, `cover_kdp_ai_${bookId}_${timestamp}.pdf`);
  const pngPath = path.join(coversDir, `cover_kdp_ai_${bookId}_${timestamp}.png`);

  let browser: any = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: spec.totalWidthPx,
      height: spec.totalHeightPx,
      deviceScaleFactor: 1,
    });

    // Página HTML com Canvas para Auto-Crop e Upscale de Alta Precisão
    const processHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${spec.totalWidthPx}px;
      height: ${spec.totalHeightPx}px;
      overflow: hidden;
      background: #ffffff;
    }
    #canvas {
      width: ${spec.totalWidthPx}px;
      height: ${spec.totalHeightPx}px;
      display: block;
    }
  </style>
</head>
<body>
  <canvas id="canvas" width="${spec.totalWidthPx}" height="${spec.totalHeightPx}"></canvas>
  <script>
    window.processImage = function(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
          const canvas = document.getElementById('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          // 1. Cria canvas temporário para analisar bordas e mockups
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(img, 0, 0);

          let cropX = 0;
          let cropY = 0;
          let cropW = img.width;
          let cropH = img.height;

          try {
            const imgData = tempCtx.getImageData(0, 0, img.width, img.height);
            const data = imgData.data;

            // Amostragem dinâmica das 4 quinas: (0,0), (w-1,0), (0,h-1), (w-1,h-1)
            const c0 = [data[0], data[1], data[2]];
            const c1Idx = (img.width - 1) * 4;
            const c1 = [data[c1Idx], data[c1Idx + 1], data[c1Idx + 2]];
            const c2Idx = ((img.height - 1) * img.width) * 4;
            const c2 = [data[c2Idx], data[c2Idx + 1], data[c2Idx + 2]];
            const c3Idx = ((img.height - 1) * img.width + (img.width - 1)) * 4;
            const c3 = [data[c3Idx], data[c3Idx + 1], data[c3Idx + 2]];

            function colorDist(r1, g1, b1, r2, g2, b2) {
              return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
            }

            // Verifica se as quinas superiores possuem cor consistente (fundo de mockup ou mesa)
            const cornersUniform = colorDist(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2]) < 40;
            const bgR = Math.round((c0[0] + c1[0] + c2[0] + c3[0]) / 4);
            const bgG = Math.round((c0[1] + c1[1] + c2[1] + c3[1]) / 4);
            const bgB = Math.round((c0[2] + c1[2] + c2[2] + c3[2]) / 4);

            function isMockupBorder(r, g, b) {
              if (cornersUniform) {
                // Se as quinas forem uniformes, pixel é borda se for similar à cor da quina
                return colorDist(r, g, b, bgR, bgG, bgB) < 35;
              }
              // Fallback para mockups com fundo cinza/escuro padrão
              return (r < 240 || g < 240 || b < 240);
            }

            // Escaneia margens para detectar molduras de mockup
            const midY = Math.floor(img.height / 2);
            let leftFound = 0;
            for (let x = 0; x < img.width * 0.2; x++) {
              const idx = (midY * img.width + x) * 4;
              if (!isMockupBorder(data[idx], data[idx+1], data[idx+2])) {
                leftFound = x;
                break;
              }
            }

            let rightFound = img.width - 1;
            for (let x = img.width - 1; x > img.width * 0.8; x--) {
              const idx = (midY * img.width + x) * 4;
              if (!isMockupBorder(data[idx], data[idx+1], data[idx+2])) {
                rightFound = x;
                break;
              }
            }

            const midX = Math.floor(img.width / 2);
            let topFound = 0;
            for (let y = 0; y < img.height * 0.2; y++) {
              const idx = (y * img.width + midX) * 4;
              if (!isMockupBorder(data[idx], data[idx+1], data[idx+2])) {
                topFound = y;
                break;
              }
            }

            let bottomFound = img.height - 1;
            for (let y = img.height - 1; y > img.height * 0.8; y--) {
              const idx = (y * img.width + midX) * 4;
              if (!isMockupBorder(data[idx], data[idx+1], data[idx+2])) {
                bottomFound = y;
                break;
              }
            }

            // Se detectou bordas de mockup superiores a 2% e inferiores a 20%, aplica crop
            if (leftFound > img.width * 0.01 && rightFound < img.width * 0.99) {
              cropX = leftFound;
              cropW = rightFound - leftFound;
            }
            if (topFound > img.height * 0.01 && bottomFound < img.height * 0.99) {
              cropY = topFound;
              cropH = bottomFound - topFound;
            }
          } catch(e) {
            console.warn("Auto-crop fallthrough", e);
          }

          // 2. Renderiza no canvas principal em 300 DPI com interpolação de alta qualidade
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
          
          resolve(true);
        };
        img.onerror = reject;
        img.src = src;
      });
    };
  </script>
</body>
</html>`;

    await page.setContent(processHtml, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(async (src: string) => {
      await (window as any).processImage(src);
    }, dataUri);

    // 1. Gera PNG em 300 DPI
    const pngUint8 = await page.screenshot({ type: "png", fullPage: true });
    const pngBuffer = Buffer.from(pngUint8);
    fs.writeFileSync(pngPath, pngBuffer);

    // 2. Compila PDF com medidas físicas exatas da folha KDP
    const pdfPageHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    @page {
      size: ${spec.totalWidthInches}in ${spec.totalHeightInches}in;
      margin: 0;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${spec.totalWidthInches}in;
      height: ${spec.totalHeightInches}in;
      overflow: hidden;
      background: #ffffff;
    }
    img.kdp-cover {
      width: 100%;
      height: 100%;
      object-fit: fill;
      display: block;
    }
  </style>
</head>
<body>
  <img class="kdp-cover" src="data:image/png;base64,${pngBuffer.toString("base64")}" />
</body>
</html>`;

    await page.setContent(pdfPageHtml, { waitUntil: "domcontentloaded", timeout: 60000 });
    const pdfUint8 = await page.pdf({
      width: `${spec.totalWidthInches}in`,
      height: `${spec.totalHeightInches}in`,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      printBackground: true,
    });
    const rawPdfBuffer = Buffer.from(pdfUint8);
    const pdfBuffer = setExactPdfMediaBox(rawPdfBuffer, spec.totalWidthInches, spec.totalHeightInches);
    fs.writeFileSync(pdfPath, pdfBuffer);

    return {
      success: true,
      pdfPath,
      pngPath,
      pdfBuffer,
      pngBuffer,
      dimensions: {
        widthInches: spec.totalWidthInches,
        heightInches: spec.totalHeightInches,
        widthPx: spec.totalWidthPx,
        heightPx: spec.totalHeightPx,
        dpi: 300,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      pdfPath: null,
      pngPath: null,
      pdfBuffer: null,
      pngBuffer: null,
      dimensions: {
        widthInches: spec.totalWidthInches,
        heightInches: spec.totalHeightInches,
        widthPx: spec.totalWidthPx,
        heightPx: spec.totalHeightPx,
        dpi: 300,
      },
      error: error.message || "Erro durante o processamento da capa.",
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Gera nativamente (1-click) a capa editorial completa KDP em PDF e PNG 300 DPI.
 */
export async function generateAndSaveNativeKdpCover(
  book: BookRecord,
  chapters: ChapterRecord[] = [],
  customPageCount?: number | null
): Promise<CoverCompilationResult> {
  const pageCountToUse = customPageCount && customPageCount > 0 ? customPageCount : book.actual_pages;
  const spec = calculateWraparoundCoverDimensions(book.page_size, pageCountToUse);

  // 1. Gerar dinamicamente com o LLM (Gemini 3.8 Flash) a metáfora visual com fusão de Linha Técnica (Blueprint) + Linhas de Fluxo Orgânicas
  let metaphor: DynamicVisualMetaphor;
  try {
    metaphor = await generateDynamicBookMetaphor(book, chapters);
  } catch {
    metaphor = extractMetaphorFromCoverPrompt(book.cover_prompt) || generateDefaultDynamicMetaphor(book, chapters);
  }

  let bespokeSvg: string | undefined;
  try {
    bespokeSvg = await generateBespokeCoverSvg(book, chapters, metaphor);
  } catch (err: any) {
    console.warn("[CoverCompiler] Usando motor procedural temático:", err?.message || err);
  }

  const html = buildNativeCoverHtml(book, chapters, spec, bespokeSvg, metaphor);

  try {
    const { pdfBuffer, pngBuffer, pdfPath, pngPath } = await compileCoverHtmlToFiles(
      html,
      spec,
      `cover_kdp_native_${book.id}`
    );

    return {
      success: true,
      pdfPath,
      pngPath,
      pdfBuffer,
      pngBuffer,
      dimensions: {
        widthInches: spec.totalWidthInches,
        heightInches: spec.totalHeightInches,
        widthPx: spec.totalWidthPx,
        heightPx: spec.totalHeightPx,
        dpi: 300,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      pdfPath: null,
      pngPath: null,
      pdfBuffer: null,
      pngBuffer: null,
      dimensions: {
        widthInches: spec.totalWidthInches,
        heightInches: spec.totalHeightInches,
        widthPx: spec.totalWidthPx,
        heightPx: spec.totalHeightPx,
        dpi: 300,
      },
      error: error.message || "Erro ao compilar capa nativa KDP.",
    };
  }
}
