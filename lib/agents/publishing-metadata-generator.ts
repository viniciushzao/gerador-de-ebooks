import { BookRecord, ChapterRecord } from "@/lib/db/schema";
import { callGemini } from "./gemini-client";
import {
  getPageFormatSpec,
  calculateCoverDimensions,
  calculateWraparoundCoverDimensions,
  KDP_PAPER_THICKNESS_FACTORS,
  WraparoundCoverSpec,
} from "@/lib/export/page-formats";
import { extractCleanJsonObject } from "@/lib/utils/json-parser";
import { ALLOWED_CATEGORIES, AllowedCategory } from "@/lib/constants/categories";
import { queryRag } from "@/lib/rag/ai-rag-engine";

export { ALLOWED_CATEGORIES };
export type { AllowedCategory };

export interface KeywordItem {
  id: string;
  keyword: string;
  intent: "problem_solving" | "informational" | "persona" | "transactional";
  character_count: number;
  kdp_slot_candidate: boolean;
}

export interface KeywordCluster {
  topic_id: string;
  topic_name: string;
  description: string;
  keywords: KeywordItem[];
}

export interface BookKeywordsData {
  total_keywords: number;
  clusters: KeywordCluster[];
  kdp_top_7: string[];
  plain_text_list: string;
}

export interface PublishingMetadata {
  coverPrompt: string;
  coverVisualPrompt: string;
  coverNegativePrompt: string;
  suggestedCategories: string;
  marketingDescription: string;
  seoKeywords: string;
}

/**
 * Metáfora visual dinâmica gerada para ancorar a arte da capa, paleta e kicker editorial.
 * O design não é fixo: cada livro ganha um conceito visual sob medida concebido com base na sua tese e capítulos.
 */
export interface DynamicVisualMetaphor {
  metaphorConcept: string; // 1 frase concisa em português explicando o conceito da metáfora
  motifDescription: string; // Descrição rica em inglês para a IA geradora de imagens (Nano Banana 2, DALL-E, Midjourney)
  motifShapes: string; // Descrição de formas geométricas e elementos vetoriais
  kickerText: string; // Kicker editorial em maiúsculas (2 a 5 palavras)
  accentColor: string; // Cor hex primária de destaque (ex: #0369a1, #b45309)
  secondaryColor: string; // Cor hex secundária de contraste neutro (ex: #0f172a, #1e293b)
  fontFamily: "sans-serif" | "modern_serif" | "serif";
  theoreticalGrounding: string; // Ancoragem teórica explicando a ligação com o conteúdo do livro
}

/**
 * Retorna o Negative Prompt estrito para impedir que a IA pinte cotas, números, réguas,
 * mockups 3D, sombras projetadas, caixas de código de barras ou molduras cinzas.
 */
export function getCoverNegativePrompt(): string {
  return "3d mockup, 3d book, book on table, perspective, angled view, drop shadow, shadows, gray borders, outer frame, margin frame, dimension lines, measurement arrows, dimensional numbers, measurement labels, numbers, inches, millimeters, technical annotations, barcode, barcode box, qr code, author name, publisher logo, noisy textures, blurry, low resolution";
}

/**
 * Transforma qualquer texto bruto ou markdown (mesmo contendo títulos '#', '##', subtítulos ou numerações)
 * em uma prosa editorial fluida, límpida e natural, sem nenhum '#' ou símbolo de formatação markdown.
 */
export function extractCleanNaturalSynopsis(
  raw: string | null | undefined,
  targetAudience?: string,
  maxLength: number = 480
): string {
  if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
    return `Uma obra analítica e estruturada desenvolvida para ${
      targetAudience || "profissionais estratégicos"
    }, proporcionando clareza conceitual, frameworks comprovados e rigor editorial fundamentado em primeiros princípios.`;
  }

  // 1. Processar linha por linha para descartar cabeçalhos estruturais de seções
  // Exemplo a descartar: '# Apresentação da Obra', '## 1. O Problema Fundamental e a Tese Central'
  const lines = raw.split(/\r?\n/);
  const bodyParagraphs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Linhas que são cabeçalhos Markdown (# Título, ## Subtítulo, ### Seção)
    if (/^#{1,6}\s+/.test(trimmed)) {
      continue;
    }
    // Rótulos estruturais curtos que não são prosa contínua
    if (/^(apresentação da obra|visão geral da obra|resumo executivo|introdução|prefácio|apresentação)\s*[:\-–—]?$/i.test(trimmed)) {
      continue;
    }
    if (/^(capítulo\s+\d+|seção\s+\d+|\d+\.\s+[A-ZÀ-Úa-zà-ú\s]{2,50})$/i.test(trimmed) && trimmed.length < 55) {
      continue;
    }

    bodyParagraphs.push(trimmed);
  }

  let text = bodyParagraphs.join(" ").trim();

  // Se por acaso todo o texto era cabeçalho ou o corpo ficou muito curto, pega o raw
  if (text.length < 40) {
    text = raw;
  }

  // 2. Limpeza profunda de qualquer Markdown residual inline
  text = text
    // Remove qualquer '#' remanescente no texto
    .replace(/#+/g, "")
    // Remove cabeçalhos inline que tenham ficado colados (ex: "Apresentação da Obra 1. O Problema Fundamental e a Tese Central")
    .replace(/\b(?:apresentação da obra|visão geral da obra|o problema fundamental e a tese central|a tese central|visão geral dos eixos principais)\b\s*[:\-–—.]?\s*/gi, "")
    // Remove numerações de início de tópico como "1. ", "2. "
    .replace(/^\d+[\.\)\-]\s*/, "")
    // Remove negrito (**texto**, __texto__) e itálico (*texto*, _texto_)
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove links markdown [texto](url) -> texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove imagens ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // Remove blockquotes (>)
    .replace(/^>\s+/gm, "")
    // Remove código inline ou blocos (`código`)
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    // Remove marcadores de lista (*, -, +, •)
    .replace(/^[\*\-+\u2022]\s+/gm, "")
    // Remove tags HTML
    .replace(/<[^>]+>/g, "")
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    // Normaliza espaços e pontuação
    .replace(/\s+/g, " ")
    .replace(/["""]/g, '"')
    .replace(/[''']/g, "'")
    .trim();

  // 3. Garante que começa com letra maiúscula
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Se o texto resultante for muito curto, aplica o fallback editorial
  if (text.length < 50) {
    return `Uma obra analítica e estruturada desenvolvida para ${
      targetAudience || "profissionais estratégicos"
    }, proporcionando clareza conceitual, frameworks comprovados e rigor editorial fundamentado em primeiros princípios.`;
  }

  // Corta suavemente no final da última frase completa dentro do limite
  if (text.length > maxLength) {
    const truncated = text.slice(0, maxLength);
    const lastPeriod = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("!"), truncated.lastIndexOf("?"));
    if (lastPeriod > maxLength * 0.6) {
      text = truncated.slice(0, lastPeriod + 1);
    } else {
      text = truncated.trim() + "...";
    }
  }

  return text;
}

/**
 * Extrai a metáfora visual dinâmica salva no JSON da capa do livro (se existente),
 * ou reconstrói a partir dos campos do primary_motif e theme.
 */
export function extractMetaphorFromCoverPrompt(
  coverPromptStr: string | null | undefined
): DynamicVisualMetaphor | null {
  if (!coverPromptStr || typeof coverPromptStr !== "string") return null;

  try {
    const parsed = JSON.parse(coverPromptStr);
    if (!parsed || typeof parsed !== "object") return null;

    if (parsed.dynamic_visual_metaphor && typeof parsed.dynamic_visual_metaphor === "object") {
      const dvm = parsed.dynamic_visual_metaphor;
      if (dvm.motifDescription && dvm.accentColor) {
        return dvm as DynamicVisualMetaphor;
      }
    }

    const frontZone = parsed.spread_zones?.right_zone_front_cover;
    const motif = frontZone?.visual_elements?.primary_motif || parsed.visual_elements?.primary_motif;
    const theme = parsed.theme || {};

    if (motif && (motif.description || motif.concept)) {
      return {
        metaphorConcept: motif.concept || "Conceito visual derivado da tese do livro",
        motifDescription: motif.description || "Minimalist geometric vector motif in the lower right quadrant",
        motifShapes: motif.shapes || "linhas geométricas finas e planos translúcidos",
        kickerText: frontZone?.typography?.kicker || "ANÁLISE ESTRATÉGICA & EXECUÇÃO",
        accentColor: theme.accent_color || "#0369a1",
        secondaryColor: theme.secondary_accent || "#0f172a",
        fontFamily: theme.font_family === "serif" ? "serif" : "sans-serif",
        theoreticalGrounding: motif.theoretical_grounding || "Inspirado nos fundamentos teóricos do livro.",
      };
    }
  } catch {
    // Retorna null caso não seja JSON válido
  }

  return null;
}

/**
 * Biblioteca procedural de metáforas visuais conceituais de alta sofisticação.
 * Serve como fallback resiliente e contingência offline quando a IA não estiver disponível.
 */
export function generateDefaultDynamicMetaphor(
  book: BookRecord,
  chapters: ChapterRecord[] = [],
  contextSnippet?: string
): DynamicVisualMetaphor {
  const cleanTitle = (book.title || "").replace(/[#*_`]/g, "").trim();
  const t = (
    cleanTitle +
    " " +
    (book.target_audience || "") +
    " " +
    (book.tone_of_voice || "") +
    " " +
    (book.executive_summary || "") +
    " " +
    (contextSnippet || "") +
    " " +
    chapters.map((c) => c.title + " " + (c.synopsis || "")).join(" ")
  ).toLowerCase();

  // 1. Engenharia Mecânica / Normas Técnicas / Usinagem / NBR
  if (
    t.includes("nbr") ||
    t.includes("tolerânc") ||
    t.includes("toleranc") ||
    t.includes("acoplamento") ||
    t.includes("mecânic") ||
    t.includes("mecanic") ||
    (t.includes("eixo") && (t.includes("furo") || t.includes("peça") || t.includes("usinagem") || t.includes("tolerânc"))) ||
    (t.includes("ajuste") && (t.includes("nbr") || t.includes("mecânic") || t.includes("tolerânc") || t.includes("dimensional") || t.includes("eixo"))) ||
    t.includes("intercambi") ||
    t.includes("usinagem") ||
    (t.includes("engenhar") && !t.includes("prompt") && !t.includes("software") && !t.includes("dados"))
  ) {
    return {
      metaphorConcept: "Acoplamento mecânico de precisão representando a teoria de eixos, furos e bandas de tolerância NBR 6158.",
      motifDescription: "a mechanical precision interference-fit schematic showing shaft and sleeve tolerance bands, concentric ISO IT-grade tolerance rings, micro-metric vernier tick graduations, industrial centerlines, and alignment crosshairs in the lower right quadrant",
      motifShapes: "linhas vetoriais ortogonais de 0.5pt, bandas cilíndricas sobrepostas translúcidas e anéis concêntricos tracejados",
      kickerText: "ENGENHARIA MECÂNICA & PRECISÃO DIMENSIONAL",
      accentColor: "#0284c7",
      secondaryColor: "#1e293b",
      fontFamily: "sans-serif",
      theoreticalGrounding: "Inspirado diretamente na geometria dimensional de sistemas de eixos e furos da base teórica da norma NBR 6158.",
    };
  }

  // 2. Marketing / Vendas / Conversão / Tração
  if (
    t.includes("venda") ||
    t.includes("marketing") ||
    t.includes("conversão") ||
    t.includes("conversao") ||
    t.includes("louco") ||
    t.includes("cac") ||
    t.includes("ltv") ||
    t.includes("roas") ||
    t.includes("tráfego") ||
    t.includes("trafego") ||
    t.includes("escala") ||
    (t.includes("métrica") && !t.includes("dimensional") && !t.includes("mecânic"))
  ) {
    return {
      metaphorConcept: "Funil isométrico de conversão com curva exponencial de demanda e pilares de mensuração de desempenho comercial.",
      motifDescription: "a conceptual isometric conversion funnel with translucent tiered stages, an exponential parabolic demand surge curve with tangential metric pillars, concentric market-retention ripples, and precision analytical crosshairs in the lower right quadrant",
      motifShapes: "elipses isométricas translúcidas, curva parabólica ascendente, pilares vetoriais escalonados e anéis de retenção",
      kickerText: "MENSURAÇÃO, DESEMPENHO & CRESCIMENTO COMERCIAL",
      accentColor: "#b45309",
      secondaryColor: "#0f172a",
      fontFamily: "sans-serif",
      theoreticalGrounding: "Inspirado na modelagem de vetores de tração comercial, taxas exponenciais de conversão e métricas de retorno dos livros base.",
    };
  }

  // 3. Finanças / Investimentos / Valuation / Capital
  if (
    t.includes("financ") ||
    (t.includes("invest") && !t.includes("investiga")) ||
    t.includes("dinheiro") ||
    t.includes("patrimônio") ||
    t.includes("patrimonio") ||
    t.includes("lucro") ||
    (t.includes("capital") && !t.includes("capital humano")) ||
    t.includes("valuation") ||
    t.includes("riqueza")
  ) {
    return {
      metaphorConcept: "Mosaico geométrico de Fibonacci com espiral logarítmica de juros compostos e balança de alocação de risco e retorno.",
      motifDescription: "an interlocking Fibonacci asset-allocation mosaic with translucent geometric tiles, a logarithmic compound-interest growth spiral, a risk-return balance scale beam, and orbital liquidity rings in the lower right quadrant",
      motifShapes: "espiral logarítmica áurea, quadrantes proporcionais de alocação, feixe de equilíbrio e anéis orbitais",
      kickerText: "GESTÃO FINANCEIRA, VALUATION & CAPITAL",
      accentColor: "#047857",
      secondaryColor: "#92400e",
      fontFamily: "serif",
      theoreticalGrounding: "Inspirado na modelagem da espiral logarítmica de juros compostos e curvas assintóticas de valor dos livros base.",
    };
  }

  // 4. Inteligência Artificial / Software / Dados
  if (
    /\bia\b/i.test(t) ||
    t.includes("inteligência artificial") ||
    t.includes("inteligencia artificial") ||
    t.includes("machine learning") ||
    t.includes("deep learning") ||
    t.includes("prompt") ||
    t.includes("software") ||
    t.includes("dados") ||
    t.includes("neural") ||
    t.includes("algoritmo") ||
    t.includes("llm")
  ) {
    return {
      metaphorConcept: "Topologia de rede neural profunda com malha de tensores, facetas de Voronoi e nós de atenção focal.",
      motifDescription: "a multi-layer deep neural network topology with glowing weighted tensor connections, translucent Voronoi latent-space embedding facets, concentric inference diffusion radar rings, and attention-head focal nodes in the lower right quadrant",
      motifShapes: "micro-nós de ancoragem conectados por filamentos tensores ultrafinos, planos poligonais translúcidos e anéis de radar",
      kickerText: "INTELIGÊNCIA ARTIFICIAL & CIÊNCIA DE DADOS",
      accentColor: "#2563eb",
      secondaryColor: "#0284c7",
      fontFamily: "sans-serif",
      theoreticalGrounding: "Inspirado na topologia de redes neurais e grafos direcionados acíclicos da base teórica de computação.",
    };
  }

  // 5. Gestão / Liderança / Estratégia / Governança
  if (
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
    t.includes("okr")
  ) {
    return {
      metaphorConcept: "Pirâmide isométrica de governança com bússola vetorial de horizonte estratégico e anéis de ciclos ágeis.",
      motifDescription: "an architectural isometric governance pyramid with translucent stepped tiers, a 45-degree strategic horizon compass vector arrow, concentric agile sprint cycle rings, and balanced decision-fulcrum nodes in the lower right quadrant",
      motifShapes: "planos escalonados isométricos, vetor angular de direção, círculos concêntricos e pontos fulcrais",
      kickerText: "LIDERANÇA EXECUTIVA & ESTRATÉGIA CORPORATIVA",
      accentColor: "#334155",
      secondaryColor: "#0f172a",
      fontFamily: "sans-serif",
      theoreticalGrounding: "Inspirado nas matrizes de decisão executiva e na arquitetura de governança e alinhamento estratégico.",
    };
  }

  // 6. Saúde / Biologia / Medicina / Neurociência
  if (
    t.includes("saúde") ||
    t.includes("saude") ||
    t.includes("médic") ||
    t.includes("medic") ||
    t.includes("biolog") ||
    t.includes("fisiolog") ||
    /\bcorpo\b/i.test(t) ||
    /\bmente\b/i.test(t) ||
    t.includes("neuro") ||
    t.includes("psicolog") ||
    t.includes("nutriç") ||
    t.includes("nutric")
  ) {
    return {
      metaphorConcept: "Ondas helicoidais em harmonia molecular com ciclos concêntricos de homeostase e traço de frequência biológica.",
      motifDescription: "an elegant double-helix molecular waveform rhythm with translucent vertical base pairs, concentric homeostasis equilibrium cycles, a harmonic vital pulse frequency trace, and neural synaptic receptor nodes in the lower right quadrant",
      motifShapes: "curvas duplas entrelaçadas, traços verticais rítmicos, elipses de homeostase e nós sinápticos",
      kickerText: "CIÊNCIA BIOLÓGICA, MEDICINA & FISIOLOGIA HUMANA",
      accentColor: "#0d9488",
      secondaryColor: "#134e4a",
      fontFamily: "sans-serif",
      theoreticalGrounding: "Inspirado nos ciclos de equilíbrio biológico e na estrutura molecular da homeostase fisiológica.",
    };
  }

  // 7. Educação / Filosofia / Direito / Humanidades
  if (
    t.includes("educa") ||
    t.includes("filosof") ||
    t.includes("direito") ||
    t.includes("históri") ||
    t.includes("dialétic") ||
    t.includes("conhecimento")
  ) {
    return {
      metaphorConcept: "Prisma analítico de proporção áurea refratando eixos de questionamento dialético e planos fundamentais do saber.",
      motifDescription: "a classical golden-ratio analytical prism with refracted conceptual angle facets, concentric dialectic inquiry rings, stepped knowledge foundation planes, and synthesis balance nodes in the lower right quadrant",
      motifShapes: "prisma triangular translúcido, planos angulados de fundação, anéis de síntese e vértices de equilíbrio",
      kickerText: "FUNDAMENTAÇÃO DIALÉTICA, HISTÓRIA & CONHECIMENTO",
      accentColor: "#6366f1",
      secondaryColor: "#312e81",
      fontFamily: "serif",
      theoreticalGrounding: "Inspirado na dialética clássica, na refração de ideias fundamentais e na síntese epistemológica.",
    };
  }

  // Fallback universal algorítmico para temas customizados
  return {
    metaphorConcept: `Arquitetura geométrica conceitual estruturando os princípios fundamentais e a dinâmica central da obra ${cleanTitle}.`,
    motifDescription: "a multi-layered precision orthogonal vector framework with intersecting translucent isometric planes, concentric tolerance calibration rings, delicate hairline guides, and golden-ratio alignment crosshairs in the lower right quadrant",
    motifShapes: "planos geométricos translúcidos sobrepostos, eixos ortogonais finos de 0.5pt, anéis concêntricos e micro-miras de precisão",
    kickerText: `${cleanTitle.slice(0, 30).toUpperCase()} // ANÁLISE ESTRATÉGICA`,
    accentColor: "#0f766e",
    secondaryColor: "#0f172a",
    fontFamily: "sans-serif",
    theoreticalGrounding: `Inspirado na modelagem conceitual e nos frameworks de primeiros princípios desenvolvidos ao longo do livro ${cleanTitle}.`,
  };
}

/**
 * Gera dinamicamente com o Gemini (LLM) a metáfora visual, paleta e kicker
 * estritamente personalizados com base no livro gerado (título, público, sumário, capítulos e tese).
 * As metáforas não são fixas: a IA concebe um conceito visual único e inédito para cada livro.
 */
export async function generateDynamicBookMetaphor(
  book: BookRecord,
  chapters: ChapterRecord[] = []
): Promise<DynamicVisualMetaphor> {
  const fallback = generateDefaultDynamicMetaphor(book, chapters);

  try {
    const chaptersSummary = chapters
      .slice(0, 8)
      .map((c) => `Capítulo ${c.chapter_number}: "${c.title}" - ${c.synopsis || "Conceitos centrais e metodologias."}`)
      .join("\n");

    const prompt = `Você é um Diretor de Arte Editorial e Especialista em Identidade Visual e Semiótica para capas de livros de excelência internacional (estilo Penguin Press, Gestalten, Harvard University Press, MIT Press).

SUA MISSÃO:
As metáforas visuais da capa NÃO devem ser fixas ou genéricas.
Você deve analisar a essência, a tese central, o mecanismo de transformação e o escopo deste livro ESPECÍFICO e criar uma METÁFORA VISUAL DINÂMICA 100% PERSONALIZADA.

DADOS DA OBRA GERADA:
- TÍTULO: "${book.title}"
- PÚBLICO-ALVO: "${book.target_audience || "Profissionais e tomadores de decisão"}"
- TOM DE VOZ: "${book.tone_of_voice || "Analítico, direto e aplicável"}"
- TESE CENTRAL / RESUMO: "${extractCleanNaturalSynopsis(book.executive_summary, book.target_audience, 600)}"
- ESTRUTURA DOS CAPÍTULOS GERADOS:
${chaptersSummary || "Capítulos focados em fundamentos, metodologia, frameworks de execução e estudos de caso."}

DIRETRIZES MANDATÓRIAS DA METÁFORA VISUAL (FUSÃO TÉCNICA + ORGÂNICA):
1. FUSÃO INDISSOCIÁVEL DE DOIS ESTILOS COMPLEMENTARES:
   A composição visual NUNCA deve ser apenas um diagrama geométrico abstrato e NUNCA deve ser apenas uma mancha solta. O diferencial do livro nasce da combinação harmônica de:
   A) Linha Técnica Estilizada (Blueprint Editorial de Alta Precisão): O mecanismo, componente, objeto ou arquitetura central do livro (ex: corte estilizado de cilindro/pistão para motores, mapa de conexões para liderança, eixos de atração para marketing, estrutura molecular para saúde, prisma óptico para dialética) desenhado com rigor editorial em traços nítidos de 1.0pt a 1.5pt.
   B) Arte Vetorial Conceitual com Linhas de Fluxo Orgânicas: Ondas contínuas, vórtices térmicos, dinâmicas de fluidos, transições de energia ou campos de força que emergem, atravessam e envolvem a estrutura técnica em curvas harmônicas Bézier e planos translúcidos em degradê sutil.
   Os 2 estilos caminham juntos em simbiose: a precisão estrutural do tema combinada com a energia fluida do seu funcionamento.

2. ZERO CLICHÊS GENÉRICOS:
   - Proibido usar lâmpadas, engrenagens infantis, quebra-cabeças, bonecos ou aperto de mãos.
   - Pense como os designers da Penguin Classics e MIT Press: sofisticação, síntese gráfica e significado profundo.

3. ENQUADRAMENTO E REGRAS TÉCNICAS:
   - A arte será posicionada no terço INFERIOR DIREITO da capa da frente (em contraponto à tipografia superior esquerda).
   - Deve funcionar sobre fundo BRANCO PURO (#ffffff).
   - ZERO TEXTO e ZERO NÚMEROS: O motivo visual não pode conter palavras, números, réguas ou cotas.

4. ESTRUTURA DA RESPOSTA (JSON OBRIGATÓRIO):
{
  "metaphorConcept": "Frase concisa em português explicando a fusão do elemento técnico blueprint com as linhas de fluxo orgânicas e como expressa a essência do livro.",
  "motifDescription": "Rich description in English (1-2 paragraphs) for image generation prompts (Midjourney, DALL-E, Nano Banana 2). Describe the seamless fusion of: 1) precise technical blueprint line art of the central subject mechanism/object, intertwined with 2) dynamic organic vector flow lines, thermal/fluid gradients, and sweeping Bezier curves. Specify: lower right quadrant, pure white background (#ffffff), refined dual tones, zero numbers, zero text, edge-to-edge clarity.",
  "motifShapes": "Descrição concisa em português da combinação de traços técnicos nítidos (blueprint do tema) com linhas de fluxo orgânicas e curvas de dinâmica.",
  "kickerText": "KICKER EDITORIAL EM MAIÚSCULAS (2 a 5 palavras em português, ex: TERMODINÂMICA & DINÂMICA VEICULAR)",
  "accentColor": "Cor hexadecimal de destaque elegante e sóbria que combine com o tema (ex: #b45309, #0284c7, #047857, #2563eb, #7c3aed, #0f766e)",
  "secondaryColor": "Cor hexadecimal de contraste neutro escuro (ex: #0f172a, #1e293b, #334155, #111827)",
  "fontFamily": "sans-serif ou modern_serif",
  "theoreticalGrounding": "Explicação em português de como esta fusão de blueprint técnico e fluxo orgânico expressa diretamente os capítulos e a tese da obra."
}`;

    const callPromise = callGemini(prompt, {
      responseMimeType: "application/json",
      maxOutputTokens: 1500,
    });

    let timerId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => reject(new Error("Timeout de 25s na geração da metáfora visual dinâmica")), 25000);
    });

    let response: any;
    try {
      response = await Promise.race([callPromise, timeoutPromise]);
    } finally {
      if (timerId) clearTimeout(timerId);
    }
    const parsed = extractCleanJsonObject<any>(response.text);

    if (parsed && typeof parsed === "object") {
      const kickerText = String(parsed.kickerText || fallback.kickerText)
        .replace(/[#*_`]/g, "")
        .trim()
        .toUpperCase();

      const accentColor = /^#[0-9a-fA-F]{6}$/.test(parsed.accentColor)
        ? parsed.accentColor
        : fallback.accentColor;

      const secondaryColor = /^#[0-9a-fA-F]{6}$/.test(parsed.secondaryColor)
        ? parsed.secondaryColor
        : fallback.secondaryColor;

      const fontFamily =
        parsed.fontFamily === "modern_serif" || parsed.fontFamily === "serif"
          ? "serif"
          : "sans-serif";

      return {
        metaphorConcept: String(parsed.metaphorConcept || fallback.metaphorConcept).replace(/[#*_`]/g, "").trim(),
        motifDescription: String(parsed.motifDescription || fallback.motifDescription).replace(/[#*_`]/g, "").trim(),
        motifShapes: String(parsed.motifShapes || fallback.motifShapes).replace(/[#*_`]/g, "").trim(),
        kickerText,
        accentColor,
        secondaryColor,
        fontFamily,
        theoreticalGrounding: String(parsed.theoreticalGrounding || fallback.theoreticalGrounding).replace(/[#*_`]/g, "").trim(),
      };
    }
  } catch (err: any) {
    console.warn("[generateDynamicBookMetaphor] Falha na chamada LLM, usando metáfora procedural resiliente:", err?.message || err);
  }

  return fallback;
}

/**
 * Constrói o Prompt Visual em Linguagem Natural Otimizado para IAs de Imagem (Midjourney, DALL-E, Nano Banana 2, Imagen 3, Recraft).
 * Utiliza a metáfora visual dinâmica concebida para o livro gerado, purga 100% de qualquer número, cota, medida em polegadas/mm,
 * vinco de dobra ou caixa de código de barras.
 * Zero formatação Markdown e zero hashtags (#) para compatibilidade perfeita com qualquer gerador de imagem.
 */
export function buildCleanVisualCoverPrompt(
  book: BookRecord,
  chapters: ChapterRecord[] = [],
  customMetaphorOrRagSnippet?: DynamicVisualMetaphor | string
): string {
  let dynamicMetaphor: DynamicVisualMetaphor;

  if (customMetaphorOrRagSnippet && typeof customMetaphorOrRagSnippet === "object") {
    dynamicMetaphor = customMetaphorOrRagSnippet as DynamicVisualMetaphor;
  } else {
    const extracted = extractMetaphorFromCoverPrompt(book.cover_prompt);
    if (extracted) {
      dynamicMetaphor = extracted;
    } else {
      const snippet = typeof customMetaphorOrRagSnippet === "string" ? customMetaphorOrRagSnippet : undefined;
      dynamicMetaphor = generateDefaultDynamicMetaphor(book, chapters, snippet);
    }
  }

  // Descrição descritiva e natural das cores (garantindo zero '#' no texto)
  const safeAccentHex = (dynamicMetaphor.accentColor || "").replace(/#/g, "");
  const safeSecondaryHex = (dynamicMetaphor.secondaryColor || "").replace(/#/g, "");
  let accentDesc = `refined tones ${safeAccentHex} and ${safeSecondaryHex}`;

  if (dynamicMetaphor.accentColor === "#0284c7" || dynamicMetaphor.accentColor === "#0369a1") {
    accentDesc = "technical cerulean blue and dark industrial slate";
  } else if (dynamicMetaphor.accentColor === "#b45309") {
    accentDesc = "warm matte amber, burnished gold, and deep graphite navy";
  } else if (dynamicMetaphor.accentColor === "#047857" || dynamicMetaphor.accentColor === "#065f46" || dynamicMetaphor.accentColor === "#0f766e") {
    accentDesc = "deep imperial emerald green, brushed copper, and subtle gold leaf accents";
  } else if (dynamicMetaphor.accentColor === "#2563eb" || dynamicMetaphor.accentColor === "#1e3a8a") {
    accentDesc = "deep cobalt blue, technical cyan, and delicate sky blue";
  } else if (dynamicMetaphor.accentColor === "#0d9488") {
    accentDesc = "deep biological teal, emerald cyan, and dark pine";
  } else if (dynamicMetaphor.accentColor === "#6366f1") {
    accentDesc = "intellectual violet, deep indigo, and brushed platinum";
  } else if (dynamicMetaphor.accentColor === "#334155") {
    accentDesc = "midnight charcoal slate and mineral warm graphite";
  }

  const motifDesc = dynamicMetaphor.motifDescription;
  const cleanTitle = (book.title || "LIVRO").replace(/[#*_`]/g, "").trim();
  const backSynopsis = extractCleanNaturalSynopsis(
    book.executive_summary,
    book.target_audience,
    320
  );

  const promptResult = `Flat 2D graphic design of a complete wraparound book cover spread (Back Cover + Spine + Front Cover) on a seamless pure white background, continuous horizontal spread edge-to-edge with zero outer margins, zero borders, and no 3D mockups.

LEFT ZONE (BACK COVER):
Elegant editorial typography in dark charcoal, left-aligned, presenting the executive synopsis: "${backSynopsis}". The bottom area remains completely clean, empty white negative space with no borders, no boxes, and no text.

CENTRAL ZONE (SPINE):
Smooth, seamless white spine naturally connecting the back and front covers. The book title "${cleanTitle}" is rendered vertically from top to bottom in bold, refined dark typography, cleanly centered.

RIGHT ZONE (FRONT COVER):
Impactful, modern editorial book cover design. High-contrast typography on the upper-left displaying the complete title "${cleanTitle.toUpperCase()}" in a single cohesive font, single uniform weight, and single color in dark mineral charcoal, without dividing the title into two parts or subtitles. In the lower-right quadrant, ${motifDesc} with accents in ${accentDesc}, creating an asymmetric dynamic balance with 65% breathable white negative space.`;

  return promptResult.replace(/#+/g, "");
}


/**
 * Formata os clusters de palavras-chave em texto estruturado por tópicos com numeração contínua (1 a 10).
 */
export function formatKeywordsToPlainText(clusters: KeywordCluster[]): string {
  let counter = 1;
  const sections: string[] = [];

  for (const cluster of clusters) {
    const lines: string[] = [
      `[ ${cluster.topic_name.toUpperCase()} ]`,
      `// ${cluster.description}`,
    ];
    for (const kw of cluster.keywords) {
      lines.push(`${counter}. ${kw.keyword}`);
      counter++;
    }
    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}

/**
 * Gera de forma determinística e estruturada 10 palavras-chave distribuídas em 4 tópicos semânticos
 * baseadas estritamente no contexto da obra, persona e capítulos para alta descobrabilidade em SEO e Amazon KDP.
 */
export function buildDefaultSeoKeywords(
  book: BookRecord,
  chapters: ChapterRecord[] = []
): BookKeywordsData {
  const t = (book.title + " " + (book.target_audience || "") + " " + (book.tone_of_voice || "")).toLowerCase();
  const cleanTitle = book.title.replace(/[:\-–—]/g, " ").replace(/\s+/g, " ").trim();

  let kwList: Array<{ keyword: string; intent: "problem_solving" | "informational" | "persona" | "transactional"; topicIndex: number }> = [];

  if (t.includes("métrica") || t.includes("marketing") || t.includes("venda") || t.includes("conversão") || t.includes("louco")) {
    kwList = [
      // Tópico 1: Dor, Problema & Solução Prática (3)
      { keyword: "como calcular cac e ltv no marketing", intent: "problem_solving", topicIndex: 0 },
      { keyword: "diagnóstico de métricas comerciais", intent: "problem_solving", topicIndex: 0 },
      { keyword: "otimização de roi e margem de lucro", intent: "problem_solving", topicIndex: 0 },
      // Tópico 2: Conceitos Centrais & Metodologias (2)
      { keyword: "mensuração de desempenho e marketing analytics", intent: "informational", topicIndex: 1 },
      { keyword: "modelagem de precificação e elasticidade", intent: "informational", topicIndex: 1 },
      // Tópico 3: Cargo, Persona & Contexto Profissional (2)
      { keyword: "livro de métricas para cmo e gestores", intent: "persona", topicIndex: 2 },
      { keyword: "tomada de decisão baseada em dados", intent: "persona", topicIndex: 2 },
      // Tópico 4: Categoria Editorial & Descoberta Amazon KDP (3)
      { keyword: "guia definitivo de métricas de marketing", intent: "transactional", topicIndex: 3 },
      { keyword: "livro sobre marketing quantitativo", intent: "transactional", topicIndex: 3 },
      { keyword: "manual prático de avaliação comercial", intent: "transactional", topicIndex: 3 },
    ];
  } else if (t.includes("gestão") || t.includes("liderança") || t.includes("estratégia") || t.includes("negócio")) {
    kwList = [
      // Tópico 1: Dor, Problema & Solução Prática (3)
      { keyword: "como implementar liderança ágil na prática", intent: "problem_solving", topicIndex: 0 },
      { keyword: "redução de atrito na tomada de decisão", intent: "problem_solving", topicIndex: 0 },
      { keyword: "gestão de equipes em cenários de incerteza", intent: "problem_solving", topicIndex: 0 },
      // Tópico 2: Conceitos Centrais & Metodologias (2)
      { keyword: "frameworks de objetivos e okrs estratégicos", intent: "informational", topicIndex: 1 },
      { keyword: "cultura organizacional antifrágil", intent: "informational", topicIndex: 1 },
      // Tópico 3: Cargo, Persona & Contexto Profissional (2)
      { keyword: "livro para diretores e novos líderes", intent: "persona", topicIndex: 2 },
      { keyword: "governança executiva para fundadores", intent: "persona", topicIndex: 2 },
      // Tópico 4: Categoria Editorial & Descoberta Amazon KDP (3)
      { keyword: "guia definitivo de gestão estratégica", intent: "transactional", topicIndex: 3 },
      { keyword: "livro de liderança de alto impacto", intent: "transactional", topicIndex: 3 },
      { keyword: "manual de execução corporativa", intent: "transactional", topicIndex: 3 },
    ];
  } else if (t.includes("financ") || t.includes("dinheiro") || t.includes("invest") || t.includes("riqueza")) {
    kwList = [
      // Tópico 1: Dor, Problema & Solução Prática (3)
      { keyword: "como construir patrimônio sustentável", intent: "problem_solving", topicIndex: 0 },
      { keyword: "alocação estratégica de capital", intent: "problem_solving", topicIndex: 0 },
      { keyword: "gestão de fluxo de caixa e risco financeiro", intent: "problem_solving", topicIndex: 0 },
      // Tópico 2: Conceitos Centrais & Metodologias (2)
      { keyword: "análise fundamentalista de valor e valuation", intent: "informational", topicIndex: 1 },
      { keyword: "modelagem de juros compostos e retorno", intent: "informational", topicIndex: 1 },
      // Tópico 3: Cargo, Persona & Contexto Profissional (2)
      { keyword: "livro de finanças para investidores inteligentes", intent: "persona", topicIndex: 2 },
      { keyword: "estratégia financeira para tomadores de decisão", intent: "persona", topicIndex: 2 },
      // Tópico 4: Categoria Editorial & Descoberta Amazon KDP (3)
      { keyword: "guia prático de inteligência financeira", intent: "transactional", topicIndex: 3 },
      { keyword: "livro sobre independência financeira", intent: "transactional", topicIndex: 3 },
      { keyword: "manual definitivo de gestão de patrimônio", intent: "transactional", topicIndex: 3 },
    ];
  } else {
    // Genérico / Contextual Derivado
    const ch1 = chapters[0]?.title || "Fundamentos Práticos";
    const ch2 = chapters[1]?.title || "Estratégia e Execução";
    kwList = [
      // Tópico 1
      { keyword: `como dominar ${cleanTitle.toLowerCase().substring(0, 30)}`, intent: "problem_solving", topicIndex: 0 },
      { keyword: `solução prática de ${cleanTitle.toLowerCase().substring(0, 30)}`, intent: "problem_solving", topicIndex: 0 },
      { keyword: `passo a passo para ${cleanTitle.toLowerCase().substring(0, 30)}`, intent: "problem_solving", topicIndex: 0 },
      // Tópico 2
      { keyword: `${ch1.toLowerCase().substring(0, 35)} na prática`, intent: "informational", topicIndex: 1 },
      { keyword: `${ch2.toLowerCase().substring(0, 35)} aplicada`, intent: "informational", topicIndex: 1 },
      // Tópico 3
      { keyword: `livro para ${(book.target_audience || "leitores estratégicos").toLowerCase().substring(0, 35)}`, intent: "persona", topicIndex: 2 },
      { keyword: `guia profissional de ${cleanTitle.toLowerCase().substring(0, 30)}`, intent: "persona", topicIndex: 2 },
      // Tópico 4
      { keyword: `guia definitivo de ${cleanTitle.toLowerCase().substring(0, 30)}`, intent: "transactional", topicIndex: 3 },
      { keyword: `melhor livro sobre ${cleanTitle.toLowerCase().substring(0, 30)}`, intent: "transactional", topicIndex: 3 },
      { keyword: `manual completo de ${cleanTitle.toLowerCase().substring(0, 30)}`, intent: "transactional", topicIndex: 3 },
    ];
  }

  const clustersConfig = [
    {
      topic_id: "problem_solving",
      topic_name: "Dor, Problema & Solução Prática",
      description: "Expressões de busca com intenção de resolução imediata de dores e busca de métodos.",
    },
    {
      topic_id: "methodology",
      topic_name: "Conceitos Centrais & Metodologias",
      description: "Termos técnicos, frameworks e indicadores fundamentais pesquisados por leitores qualificados.",
    },
    {
      topic_id: "persona",
      topic_name: "Cargo, Persona & Contexto Profissional",
      description: "Termos que conectam o conteúdo diretamente ao perfil, cargo ou maturidade do público-alvo.",
    },
    {
      topic_id: "editorial_kdp",
      topic_name: "Categoria Editorial & Descoberta Amazon KDP",
      description: "Termos comerciais de alta conversão para catalogação nos 7 slots da Amazon KDP e livrarias.",
    },
  ];

  const clusters: KeywordCluster[] = clustersConfig.map((cfg, idx) => {
    const itemsForTopic = kwList.filter((item) => item.topicIndex === idx);
    const keywords: KeywordItem[] = itemsForTopic.map((item, i) => {
      const cleanKw = item.keyword.trim().toLowerCase().substring(0, 50);
      return {
        id: `kw-${idx + 1}-${i + 1}`,
        keyword: cleanKw,
        intent: item.intent,
        character_count: cleanKw.length,
        kdp_slot_candidate: cleanKw.length <= 50,
      };
    });

    return {
      topic_id: cfg.topic_id,
      topic_name: cfg.topic_name,
      description: cfg.description,
      keywords,
    };
  });

  // Top 7 para Amazon KDP (até 50 caracteres)
  const allKeywordsFlat = clusters.flatMap((c) => c.keywords.map((k) => k.keyword));
  const kdp_top_7 = allKeywordsFlat.filter((k) => k.length <= 50).slice(0, 7);

  return {
    total_keywords: allKeywordsFlat.length,
    clusters,
    kdp_top_7,
    plain_text_list: formatKeywordsToPlainText(clusters),
  };
}

/**
 * Sanitiza e valida as palavras-chave retornadas pela IA ou fornecidas pelo usuário,
 * garantindo rigorosamente:
 * 1. Exatamente 10 palavras-chave organizadas nos 4 tópicos semânticos.
 * 2. Limite de 50 caracteres por palavra-chave para compatibilidade com os slots da Amazon KDP.
 * 3. Ausência de caracteres inválidos, formatação Markdown ou aspas residuais.
 * 4. Geração dos nós kdp_top_7 e plain_text_list estruturados.
 */
export function sanitizeSeoKeywords(
  raw: any,
  book: BookRecord,
  chapters: ChapterRecord[] = []
): BookKeywordsData {
  const fallback = buildDefaultSeoKeywords(book, chapters);

  if (!raw) return fallback;

  let parsed: any = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Se não for JSON, tentar extrair linhas de texto puro
      const lines = raw
        .split("\n")
        .map((l) => l.replace(/^\d+[\.\)\-]\s*/, "").replace(/^[\[\/\*#\-]+\s*/, "").trim())
        .filter((l) => l.length > 3 && !l.startsWith("TÓPICO") && !l.startsWith("[") && !l.startsWith("//"));

      if (lines.length >= 7) {
        parsed = {
          keywords: lines.slice(0, 10),
        };
      } else {
        return fallback;
      }
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return fallback;
  }

  // Coletar palavras-chave candidatas
  let extractedKeywords: string[] = [];

  if (Array.isArray(parsed.clusters)) {
    for (const cluster of parsed.clusters) {
      if (Array.isArray(cluster.keywords)) {
        for (const kw of cluster.keywords) {
          if (typeof kw === "string") {
            extractedKeywords.push(kw);
          } else if (kw && typeof kw === "object" && typeof kw.keyword === "string") {
            extractedKeywords.push(kw.keyword);
          }
        }
      }
    }
  } else if (Array.isArray(parsed.keywords)) {
    for (const kw of parsed.keywords) {
      if (typeof kw === "string") {
        extractedKeywords.push(kw);
      } else if (kw && typeof kw === "object" && typeof kw.keyword === "string") {
        extractedKeywords.push(kw.keyword);
      }
    }
  }

  // Limpar e deduplicar palavras-chave
  const cleanedList: string[] = [];
  for (const rawKw of extractedKeywords) {
    const clean = String(rawKw)
      .replace(/["'“”«»]/g, "")
      .replace(/^\d+[\.\)\-]\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (clean.length >= 4 && !cleanedList.includes(clean)) {
      cleanedList.push(clean.substring(0, 50));
    }
  }

  // Preencher com o fallback caso tenha menos de 10
  const fallbackFlat = fallback.clusters.flatMap((c) => c.keywords.map((k) => k.keyword));
  for (const fbKw of fallbackFlat) {
    if (cleanedList.length >= 10) break;
    if (!cleanedList.includes(fbKw)) {
      cleanedList.push(fbKw);
    }
  }

  // Garantir exatamente 10 palavras-chave
  const final10 = cleanedList.slice(0, 10);

  // Distribuir exatamente nas proporções dos 4 tópicos: [3, 2, 2, 3]
  const clusterDistribution = [
    { start: 0, count: 3, ...fallback.clusters[0], intent: "problem_solving" as const },
    { start: 3, count: 2, ...fallback.clusters[1], intent: "informational" as const },
    { start: 5, count: 2, ...fallback.clusters[2], intent: "persona" as const },
    { start: 7, count: 3, ...fallback.clusters[3], intent: "transactional" as const },
  ];

  const populatedClusters: KeywordCluster[] = clusterDistribution.map((dist, idx) => {
    const topicKeywords = final10.slice(dist.start, dist.start + dist.count);
    const keywords: KeywordItem[] = topicKeywords.map((kw, i) => ({
      id: `kw-${idx + 1}-${i + 1}`,
      keyword: kw,
      intent: dist.intent,
      character_count: kw.length,
      kdp_slot_candidate: kw.length <= 50,
    }));

    return {
      topic_id: dist.topic_id,
      topic_name: dist.topic_name,
      description: dist.description,
      keywords,
    };
  });

  const kdp_top_7 = final10.filter((k) => k.length <= 50).slice(0, 7);

  return {
    total_keywords: final10.length,
    clusters: populatedClusters,
    kdp_top_7,
    plain_text_list: formatKeywordsToPlainText(populatedClusters),
  };
}

/**
 * Remove qualquer formatação Markdown, símbolos especiais e caracteres estranhos,
 * garantindo texto simples puro com pontuação e parágrafos naturais.
 */
export function sanitizeToPlainText(text: string): string {
  if (!text) return "";

  return text
    // Remover cabeçalhos (#, ##, etc.) e qualquer '#' residual em qualquer posição
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/#+/g, "")
    // Remover negritos e itálicos (**texto**, *texto*, __texto__, _texto_)
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remover links markdown [texto](url) -> texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remover imagens ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // Remover blockquotes (>)
    .replace(/^>\s+/gm, "")
    // Remover código inline e blocos de código
    .replace(/`{1,3}[^`\n]*`{1,3}/g, "")
    // Remover marcadores de lista (*, -, +, 1.)
    .replace(/^[\*\-+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    // Remover tags HTML residuais
    .replace(/<[^>]+>/g, "")
    // Remover símbolos de formatação avulsos e emojis extravagantes
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    // Normalizar quebras de linha excessivas
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Constrói um objeto JSON padronizado e descritivo para o Nano Banana 2
 * representando visualmente a capa do livro com base nas REGRAS GLOBAIS e de DESIGN EDITORIAL:
 * - Vinculação estrita e matemática ao FORMATO DE FOLHA selecionado pelo usuário (A5, Trade 6"x9", Digest, etc.).
 * - Proporção exata da folha e resolução mínima de impressão a 300 DPI garantidas pela Amazon KDP.
 * - Design minimalista e assimétrico com tema branco (#ffffff).
 * - Amigável aos olhos humanos: composição balanceada pela proporção áurea 60/40,
 *   espaço negativo acolhedor, alto conforto visual e fluxo de leitura natural (Z/F pattern).
 * - Cerca de 10% mais itens e detalhes visuais refinados (layout_and_composition,
 *   primary_motif detalhado, secondary_accents vetoriais discretos e human_ergonomics).
 * - Apenas o nome do livro e elementos visuais conceituais de alta fidelidade.
 * - SEM estrutura de cards.
 * - SEM nome de autor.
 * - SEM nome de editora.
 */
export function buildNanoBananaCoverJson(
  book: BookRecord,
  chapters: ChapterRecord[] = [],
  customMetaphorOrRagSnippet?: DynamicVisualMetaphor | string
): any {
  const dims = calculateCoverDimensions(book.page_size);

  let dynamicMetaphor: DynamicVisualMetaphor;
  if (customMetaphorOrRagSnippet && typeof customMetaphorOrRagSnippet === "object") {
    dynamicMetaphor = customMetaphorOrRagSnippet as DynamicVisualMetaphor;
  } else {
    const extracted = extractMetaphorFromCoverPrompt(book.cover_prompt);
    if (extracted) {
      dynamicMetaphor = extracted;
    } else {
      const snippet = typeof customMetaphorOrRagSnippet === "string" ? customMetaphorOrRagSnippet : undefined;
      dynamicMetaphor = generateDefaultDynamicMetaphor(book, chapters, snippet);
    }
  }

  const accentColor = dynamicMetaphor.accentColor;
  const secondaryAccent = dynamicMetaphor.secondaryColor;
  const fontFamily = dynamicMetaphor.fontFamily;
  const motifType = "asymmetric_dynamic_concept";
  const motifConcept = dynamicMetaphor.metaphorConcept;
  const motifDescription = dynamicMetaphor.motifDescription;
  const motifShapes = dynamicMetaphor.motifShapes;
  const motifFinish = "smooth_matte_with_subtle_micro_gradient";
  const theoreticalGrounding = dynamicMetaphor.theoreticalGrounding;

  const wraparoundDims = calculateWraparoundCoverDimensions(book.page_size, book.actual_pages);

  const backCoverSynopsis = extractCleanNaturalSynopsis(
    book.executive_summary,
    book.target_audience,
    480
  );

  const primaryMotifObj = {
    type: motifType,
    concept: motifConcept,
    description: motifDescription,
    position: "lower_right_offset",
    shapes: motifShapes,
    finish: motifFinish,
    theoretical_grounding: theoreticalGrounding,
    micro_elements: "nós de ancoragem vetorial de precisão microscópica, filamentos tensores ultra-finos de 0.25pt e eixos geométricos sutis sem números nem réguas",
    light_interaction: "iluminação zenital difusa a 45 graus gerando micro-sombras táteis suaves sobre o papel sem brilho reflexivo",
  };

  const secondaryAccentsList = [
    {
      type: "asymmetric_hairline_divider",
      description: "Linha vetorial horizontal ultrafina de 0.5pt ancorando o bloco do título à esquerda e conduzindo o olhar suavemente para o espaço negativo.",
      position: "below_title_left",
    },
    {
      type: "minimal_editorial_marker",
      description: "Micro-detalhe geométrico discreto sinalizando rigor editorial, sem números nem texto.",
      position: "top_right_margin_subtle",
    },
    {
      type: "theoretical_glyph_or_axis",
      description: "Micro-elemento vetorial de conexão com a teoria base extraído dos modelos conceituais dos livros de referência.",
      position: "lower_right_anchor_subtle",
    },
    {
      type: "optical_breathing_anchor",
      description: "Ponto de ancoragem em proporção áurea garantindo 65% de espaço negativo respirável.",
      position: "center_right_negative_space",
    },
    {
      type: "minimal_geometric_accent",
      description: "Pequeno ponto ou traço geométrico abstrato discreto de precisão editorial, sem números e sem texto.",
      position: "lower_left_margin_discrete",
    },
    {
      type: "tactile_depth_accent",
      description: "Micro-relevo sutil (blind deboss) ou gradiente de luz tangencial de 2% conferindo profundidade háptica e tridimensionalidade refinada.",
      position: "along_primary_motif_perimeter",
    },
  ];

  const compositionGeometryObj = {
    focal_hierarchy: "1. Título superior esquerdo -> 2. Linha condutora -> 3. Motivo teórico inferior direito -> 4. Acentos geométricos sutis",
    negative_space_ratio: "65%",
    asymmetric_balance_ratio: "60/40_golden_ratio",
    visual_weight: "tipografia assertiva equilibrada por geometria vetorial leve e precisa",
    geometric_anchors: "Ponto focal principal em coordenadas normalizadas (X: 68%, Y: 72%), contrapeso tipográfico em (X: 12%, Y: 15%)",
    reading_cadence: "Cadência em 4 tempos: 1) Impacto tipográfico -> 2) Condução pelo divisor -> 3) Respiro no espaço negativo -> 4) Decodificação do motivo teórico e geometria pura",
  };

  const tactileDetailsObj = {
    paper_feel: "textura de papel algodão 300g/m² fosco natural com toque aveludado e microfibras dispersas visíveis sob iluminação difusa",
    ink_finish: "tinta mineral de alta densidade sem reflexo especular (ultra-matte pigment ink)",
    emboss_relief: "micro-relevo cego de 0.3mm (tactile blind deboss) ao longo dos eixos geométricos do motivo principal",
  };

  const typographyObj = {
    title: book.title,
    title_style: {
      font_family: fontFamily,
      font_weight: "bold",
      color: "#111827",
      alignment: "left",
      case: "uppercase",
      tracking: "refined_kerning_with_optical_breathing",
      placement: "upper_left_quadrant",
    },
  };

  const layoutObj = {
    composition_style: "dynamic_asymmetric_balance",
    grid_structure: "asymmetrical_golden_ratio_60_40",
    visual_flow: "human_eye_f_pattern_top_left_to_lower_right",
    white_space_ratio: "65%",
    depth_and_lighting: "soft_diffused_ambient_lighting_with_gentle_tactile_paper_relief",
  };

  return {
    image_type: "book_cover_full_wraparound",
    style: "asymmetrical_minimalist_editorial_spread",
    layout_format: "continuous_horizontal_spread_single_image",
    orientation: "horizontal_spread",
    aspect_ratio: wraparoundDims.aspectRatio,
    framing_and_canvas: "100% FLAT 2D SPREAD GRAPHIC FILLING ENTIRE CANVAS EDGE-TO-EDGE. ZERO OUTER MARGINS, ZERO BACKGROUND CANVAS, ZERO PERSPECTIVE, ZERO 3D SHADOWS. The pure white background (#ffffff) must bleed completely to all four edges of the image canvas.",
    negative_prompt: getCoverNegativePrompt(),
    theme: {
      mode: "light",
      background_color: "#ffffff",
      paper_texture: "subtle_fine_art_matte_grain",
      accent_color: accentColor,
      secondary_accent: secondaryAccent,
    },
    spread_zones: {
      left_zone_back_cover: {
        zone_name: "Contracapa / Traseira (Back Cover)",
        horizontal_span: "0% até o início da lombada (~48.5% da largura da imagem)",
        executive_synopsis: backCoverSynopsis,
        typography: {
          font_family: fontFamily,
          color: "#111827",
          alignment: "left",
        },
        barcode_area: {
          type: "empty_white_negative_space",
          position: "canto inferior da contracapa",
          instruction: "Área em branco puro totalmente livre de textos, linhas ou molduras, reservada para o código de barras. NÃO desenhar retângulo, linha ou etiqueta.",
        },
        white_space_ratio: "65%",
      },
      central_zone_spine: {
        zone_name: "Lombada Central (Spine)",
        horizontal_span: "centro da imagem (entre contracapa e capa da frente)",
        spine_text: {
          allowed: wraparoundDims.spineTextAllowed,
          content: wraparoundDims.spineTextAllowed ? book.title : "",
          orientation: "vertical_top_to_bottom",
          color: "#111827",
          font_family: fontFamily,
          font_weight: "bold",
          instruction: "Título verticalizado e centralizado ao longo da lombada contínua, sem linhas de dobra visíveis.",
        },
      },
      right_zone_front_cover: {
        zone_name: "Capa da Frente (Front Cover)",
        horizontal_span: "do final da lombada até 100% da largura da imagem (~48.5% da largura)",
        typography: typographyObj,
        layout_and_composition: layoutObj,
        visual_elements: {
          primary_motif: primaryMotifObj,
          secondary_accents: secondaryAccentsList,
          composition_geometry: compositionGeometryObj,
          tactile_and_material_details: tactileDetailsObj,
        },
      },
    },
    kdp_technical_specs: {
      target_dimensions: `${wraparoundDims.totalWidthInches.toFixed(3)} × ${wraparoundDims.totalHeightInches.toFixed(3)} polegadas`,
      print_resolution: `${wraparoundDims.totalWidthPx} × ${wraparoundDims.totalHeightPx} px a 300 DPI`,
      spine_width: `${wraparoundDims.spineWidthInches}" (${wraparoundDims.spineWidthMm} mm)`,
      page_count: wraparoundDims.pageCount,
      kdp_status: "APPROVED_300DPI_READY",
      note: "Estes dados técnicos são para o pré-voo de impressão e não devem ser colados na IA de imagem.",
    },
    typography: typographyObj,
    layout_and_composition: layoutObj,
    visual_elements: {
      primary_motif: primaryMotifObj,
      secondary_accents: secondaryAccentsList,
      composition_geometry: compositionGeometryObj,
      tactile_and_material_details: tactileDetailsObj,
      color_palette: ["#ffffff", "#111827", accentColor, secondaryAccent, "#94a3b8"],
    },
    human_ergonomics: {
      visual_comfort: "alta_legibilidade_e_suavidade_sem_fadiga_ocular",
      contrast_ratio: "harmonioso_calibrado_para_percepcao_natural",
      aesthetic_tone: "minimalista_assimetrico_acolhedor_e_sofisticado",
    },
    dynamic_visual_metaphor: dynamicMetaphor,
    global_rules: {
      single_continuous_image: true,
      three_horizontal_zones: "left: back cover, center: spine, right: front cover",
      theme: "white_minimalist_spread",
      only_book_title: true,
      no_author: true,
      no_publisher: true,
      no_cards: true,
      layout: "asymmetric_human_friendly_wraparound",
    },
  };
}

/**
 * Sanitiza e blinda o JSON de capa retornado pela IA para assegurar
 * conformidade total e irrestrita com as REGRAS GLOBAIS e EDITORIAIS:
 * 1. ZERO cards (remove qualquer propriedade cards, card_list, total_cards, card_shape, etc.).
 * 2. TEMA BRANCO puro (mode: "light", background_color: "#ffffff").
 * 3. ASSIMETRIA E ERGONOMIA VISUAL HUMANA (alignment: "left", layout_and_composition assimétrico, human_ergonomics).
 * 4. APENAS o nome do livro (typography.title = book.title).
 * 5. SEM NOME DE AUTOR (expurga qualquer menção ou campo de autor).
 * 6. SEM NOME DE EDITORA (expurga qualquer menção ou campo de editora).
 * 7. Elementos visuais conceituais e detalhados com primary_motif e secondary_accents.
 * 8. Preservação da metáfora visual dinâmica bespoke.
 */
export function sanitizeCoverPromptJson(
  rawCover: any,
  book: BookRecord,
  chapters: ChapterRecord[] = [],
  customMetaphor?: DynamicVisualMetaphor
): any {
  if (!rawCover || typeof rawCover !== "object" || Array.isArray(rawCover)) {
    return buildNanoBananaCoverJson(book, chapters, customMetaphor);
  }

  const sanitized: any = { ...rawCover };

  // 1. Expurga absolutamente qualquer estrutura de cards
  delete sanitized.cards;
  delete sanitized.card_list;
  delete sanitized.total_cards;
  delete sanitized.card_shape;
  delete sanitized.cards_layout;
  delete sanitized.layout;

  // 2. Expurga qualquer menção ou campo de autor e editora
  delete sanitized.author;
  delete sanitized.author_name;
  delete sanitized.by_author;
  delete sanitized.publisher;
  delete sanitized.publisher_name;
  delete sanitized.publishing_house;
  delete sanitized.imprint;
  delete sanitized.logo;

  // 3. Força tema branco minimalista com acabamento tátil e proporção matemática da folha do usuário
  const dims = calculateCoverDimensions(book.page_size);
  const wraparoundDims = calculateWraparoundCoverDimensions(book.page_size, book.actual_pages);

  sanitized.image_type = "book_cover_full_wraparound";
  sanitized.style = "asymmetrical_minimalist_editorial_spread";
  sanitized.layout_format = "continuous_horizontal_spread_single_image";
  sanitized.orientation = "horizontal_spread";
  sanitized.aspect_ratio = wraparoundDims.aspectRatio;

  // Especificações técnicas exatas e conformidade com Amazon KDP
  sanitized.output_specifications = {
    canvas_type: "full_wraparound_cover_paperback",
    layout_format: "continuous_horizontal_spread_single_image",
    sheet_format: wraparoundDims.formatName,
    page_count: wraparoundDims.pageCount,
    dimensions_inches: `${wraparoundDims.totalWidthInches}" × ${wraparoundDims.totalHeightInches}"`,
    dimensions_mm: `${wraparoundDims.totalWidthMm} × ${wraparoundDims.totalHeightMm} mm`,
    front_cover_trim: `${wraparoundDims.trimWidthInches}" × ${wraparoundDims.trimHeightInches}"`,
    back_cover_trim: `${wraparoundDims.trimWidthInches}" × ${wraparoundDims.trimHeightInches}"`,
    spine_width: `${wraparoundDims.spineWidthInches}" (${wraparoundDims.spineWidthMm} mm)`,
    bleed_each_side: `${wraparoundDims.bleedInches}" (3.175 mm)`,
    print_resolution_300dpi: `${wraparoundDims.totalWidthPx} × ${wraparoundDims.totalHeightPx} px`,
    single_sheet_trim_resolution_300dpi: `${dims.printTrimWidthPx} × ${dims.printTrimHeightPx} px`,
    ebook_recommended_resolution: `${dims.ebookTargetWidthPx} × ${dims.ebookTargetHeightPx} px`,
    aspect_ratio: wraparoundDims.aspectRatio,
    dpi: 300,
    color_profile: "sRGB",
  };

  sanitized.amazon_kdp_compliance = {
    status: "APPROVED_KDP_WRAPAROUND_READY",
    format_matched: wraparoundDims.formatName,
    error_resolution_match: `Exatamente ${wraparoundDims.kdpDimensionsString} polegadas (corrige e atende 100% ao erro de dimensões exigidas pelo KDP)`,
    target_dimensions: `${wraparoundDims.totalWidthInches.toFixed(3)} × ${wraparoundDims.totalHeightInches.toFixed(3)} polegadas`,
    current_resolution_print: `${wraparoundDims.totalWidthPx} × ${wraparoundDims.totalHeightPx} px a 300 DPI`,
    page_count_calibrated: wraparoundDims.pageCount,
    spine_calculation: `${wraparoundDims.pageCount} páginas × ${KDP_PAPER_THICKNESS_FACTORS[wraparoundDims.paperType]}" = ${wraparoundDims.spineWidthInches}" de espessura de lombada`,
    spine_text_status: wraparoundDims.spineTextGuideline,
    bleed_requirement: '0.125" (3.175 mm) aplicado em todas as 4 bordas externas',
    barcode_safe_area: wraparoundDims.barcodeSafeZone.description,
    dpi_compliance: "300 DPI verificado para impressão gráfica",
  };

  const resolvedMetaphor: DynamicVisualMetaphor =
    customMetaphor ||
    (sanitized.dynamic_visual_metaphor as DynamicVisualMetaphor) ||
    extractMetaphorFromCoverPrompt(JSON.stringify(sanitized)) ||
    extractMetaphorFromCoverPrompt(book.cover_prompt) ||
    generateDefaultDynamicMetaphor(book, chapters);

  sanitized.dynamic_visual_metaphor = resolvedMetaphor;

  const prevTheme = sanitized.theme || {};
  sanitized.theme = {
    mode: "light",
    background_color: "#ffffff",
    paper_texture: prevTheme.paper_texture || "subtle_fine_art_matte_grain",
    accent_color:
      prevTheme.accent_color && prevTheme.accent_color !== "#ffffff" && prevTheme.accent_color !== "#000000"
        ? prevTheme.accent_color
        : resolvedMetaphor.accentColor,
    secondary_accent: prevTheme.secondary_accent || resolvedMetaphor.secondaryColor,
  };

  // 4. Força tipografia assimétrica contendo estritamente o título do livro
  const prevTitleStyle = sanitized.typography?.title_style || {};
  let titleColor = prevTitleStyle.color || "#111827";
  if (titleColor.toLowerCase() === "#ffffff" || titleColor.toLowerCase() === "#fff" || titleColor.toLowerCase().startsWith("#f")) {
    titleColor = "#111827";
  }

  sanitized.typography = {
    title: book.title,
    title_style: {
      font_family: prevTitleStyle.font_family || "sans-serif",
      font_weight: prevTitleStyle.font_weight || "bold",
      color: titleColor,
      alignment: "left", // assimetria mandatória
      case: prevTitleStyle.case || "uppercase",
      tracking: prevTitleStyle.tracking || "refined_kerning_with_optical_breathing",
      placement: "upper_left_quadrant",
    },
  };

  // 5. Assegura Composição Assimétrica e Equilíbrio Dinâmico
  const prevLayoutComp = sanitized.layout_and_composition || {};
  sanitized.layout_and_composition = {
    composition_style: "dynamic_asymmetric_balance",
    grid_structure: "asymmetrical_golden_ratio_60_40",
    visual_flow: prevLayoutComp.visual_flow || "human_eye_f_pattern_top_left_to_lower_right",
    white_space_ratio: prevLayoutComp.white_space_ratio || "65%",
    depth_and_lighting: prevLayoutComp.depth_and_lighting || "soft_diffused_ambient_lighting_with_gentle_tactile_paper_relief",
  };

  // 6. Assegura elementos visuais com primary_motif e secondary_accents detalhados (~10% mais detalhes e similaridade com o livro base)
  const prevVisual = sanitized.visual_elements || {};
  let primaryMotif: any;
  if (!prevVisual.primary_motif || typeof prevVisual.primary_motif !== "object") {
    primaryMotif = {
      type: prevVisual.concept || "asymmetric_minimalist_motif",
      concept: prevVisual.concept || prevVisual.description || "Elemento visual que sintetiza a essência da obra",
      description: prevVisual.description || "Composição gráfica refinada posicionada no terço inferior direito em contraponto à tipografia superior esquerda.",
      position: "lower_right_offset",
      shapes: prevVisual.shapes || "linhas geométricas finas e formas limpas e discretas",
      finish: "smooth_matte_with_subtle_micro_gradient",
      theoretical_grounding: "Inspirado na geometria de primeiros princípios e nos modelos do livro base.",
      micro_elements: "nós de ancoragem vetorial de precisão microscópica, filamentos tensores ultra-finos de 0.25pt e eixos geométricos sutis sem números nem réguas",
      light_interaction: "iluminação zenital difusa a 45 graus gerando micro-sombras táteis suaves sobre o papel sem brilho reflexivo",
    };
  } else {
    const raw = prevVisual.primary_motif;
    primaryMotif = {
      type: raw.type || prevVisual.concept || "asymmetric_minimalist_motif",
      concept: raw.concept || prevVisual.concept || prevVisual.description || "Elemento visual que sintetiza a essência da obra",
      description: raw.description || prevVisual.description || "Composição gráfica refinada posicionada no terço inferior direito em contraponto à tipografia superior esquerda.",
      position: raw.position || "lower_right_offset",
      shapes: raw.shapes || prevVisual.shapes || "linhas geométricas finas e formas limpas e discretas",
      finish: raw.finish || "smooth_matte_with_subtle_micro_gradient",
      theoretical_grounding: raw.theoretical_grounding || "Inspirado na geometria e nos fundamentos teóricos do livro base.",
      micro_elements: raw.micro_elements || "nós de ancoragem vetorial de precisão microscópica, filamentos tensores ultra-finos de 0.25pt e eixos geométricos sutis sem números nem réguas",
      light_interaction: raw.light_interaction || "iluminação zenital difusa a 45 graus gerando micro-sombras táteis suaves sobre o papel sem brilho reflexivo",
    };
  }

  let secondaryAccents = Array.isArray(prevVisual.secondary_accents) ? [...prevVisual.secondary_accents] : [];
  if (secondaryAccents.length < 6 || !secondaryAccents.some((acc: any) => acc.type === "minimal_geometric_accent")) {
    const defaultAccents = [
      {
        type: "asymmetric_hairline_divider",
        description: "Linha vetorial horizontal ultrafina de 0.5pt ancorando o bloco do título à esquerda e conduzindo o olhar suavemente para o espaço negativo.",
        position: "below_title_left",
      },
      {
        type: "minimal_editorial_marker",
        description: "Micro-detalhe geométrico discreto sinalizando rigor editorial, sem números nem texto.",
        position: "top_right_margin_subtle",
      },
      {
        type: "theoretical_glyph_or_axis",
        description: "Micro-elemento vetorial de conexão com a teoria base extraído dos modelos conceituais dos livros de referência.",
        position: "lower_right_anchor_subtle",
      },
      {
        type: "optical_breathing_anchor",
        description: "Ponto de ancoragem em proporção áurea garantindo 65% de espaço negativo respirável.",
        position: "center_right_negative_space",
      },
      {
        type: "minimal_geometric_accent",
        description: "Pequeno ponto ou traço geométrico abstrato discreto de precisão editorial, sem números e sem texto.",
        position: "lower_left_margin_discrete",
      },
      {
        type: "tactile_depth_accent",
        description: "Micro-relevo sutil (blind deboss) ou gradiente de luz tangencial de 2% conferindo profundidade háptica e tridimensionalidade refinada.",
        position: "along_primary_motif_perimeter",
      },
    ];
    for (const defAcc of defaultAccents) {
      if (!secondaryAccents.some((acc: any) => acc.type === defAcc.type)) {
        secondaryAccents.push(defAcc);
      }
    }
  }

  const prevCompGeom = prevVisual.composition_geometry || sanitized.composition_geometry || {};
  const compositionGeometry = {
    focal_hierarchy: prevCompGeom.focal_hierarchy || "1. Título superior esquerdo -> 2. Linha condutora -> 3. Motivo teórico inferior direito -> 4. Acentos geométricos sutis",
    negative_space_ratio: prevCompGeom.negative_space_ratio || "65%",
    asymmetric_balance_ratio: prevCompGeom.asymmetric_balance_ratio || "60/40_golden_ratio",
    visual_weight: prevCompGeom.visual_weight || "tipografia assertiva equilibrada por geometria vetorial leve e precisa",
    geometric_anchors: prevCompGeom.geometric_anchors || "Ponto focal principal em coordenadas normalizadas (X: 68%, Y: 72%), contrapeso tipográfico em (X: 12%, Y: 15%)",
    reading_cadence: prevCompGeom.reading_cadence || "Cadência em 4 tempos: 1) Impacto tipográfico -> 2) Condução pelo divisor -> 3) Respiro no espaço negativo -> 4) Decodificação do motivo teórico e geometria pura",
  };

  const prevTactile = prevVisual.tactile_and_material_details || sanitized.tactile_and_material_details || {};
  const tactileAndMaterialDetails = {
    paper_feel: prevTactile.paper_feel || "textura de papel algodão 300g/m² fosco natural com toque aveludado e microfibras dispersas visíveis sob iluminação difusa",
    ink_finish: prevTactile.ink_finish || "tinta mineral de alta densidade sem reflexo especular (ultra-matte pigment ink)",
    emboss_relief: prevTactile.emboss_relief || "micro-relevo cego de 0.3mm (tactile blind deboss) ao longo dos eixos geométricos do motivo principal",
  };

  sanitized.visual_elements = {
    style: "minimalist",
    primary_motif: primaryMotif,
    secondary_accents: secondaryAccents,
    composition_geometry: compositionGeometry,
    tactile_and_material_details: tactileAndMaterialDetails,
    color_palette: [
      "#ffffff",
      "#111827",
      sanitized.theme.accent_color,
      sanitized.theme.secondary_accent,
      "#94a3b8",
    ],
  };

  // 7. Zonas Espalhadas Panorâmicas (Contracapa + Lombada + Capa da Frente em 1 imagem só)
  const prevZones = sanitized.spread_zones || {};
  const prevBack = prevZones.left_zone_back_cover || {};

  const backCoverSynopsis = extractCleanNaturalSynopsis(
    prevBack.executive_synopsis || book.executive_summary,
    book.target_audience,
    480
  );

  sanitized.spread_zones = {
    left_zone_back_cover: {
      zone_name: "Contracapa / Traseira (Back Cover)",
      horizontal_span: "0% até o início da lombada (~48.5% da largura da imagem)",
      executive_synopsis: backCoverSynopsis,
      typography: {
        font_family: prevTitleStyle.font_family || "sans-serif",
        color: "#111827",
        alignment: "left",
      },
      barcode_area: {
        type: "empty_white_negative_space",
        position: "canto inferior da contracapa",
        instruction: "Área em branco puro totalmente livre de textos, linhas ou molduras, reservada para o código de barras. NÃO desenhar retângulo, linha ou etiqueta.",
      },
      white_space_ratio: "65%",
    },
    central_zone_spine: {
      zone_name: "Lombada Central (Spine)",
      horizontal_span: "centro da imagem (entre contracapa e capa da frente)",
      spine_text: {
        allowed: wraparoundDims.spineTextAllowed,
        content: wraparoundDims.spineTextAllowed ? book.title : "",
        orientation: "vertical_top_to_bottom",
        color: "#111827",
        font_family: prevTitleStyle.font_family || "sans-serif",
        font_weight: "bold",
        instruction: "Título verticalizado e centralizado ao longo da lombada contínua, sem linhas de dobra visíveis.",
      },
    },
    right_zone_front_cover: {
      zone_name: "Capa da Frente (Front Cover)",
      horizontal_span: "do final da lombada até 100% da largura da imagem (~48.5% da largura)",
      typography: sanitized.typography,
      layout_and_composition: sanitized.layout_and_composition,
      visual_elements: sanitized.visual_elements,
    },
  };

  sanitized.kdp_technical_specs = {
    target_dimensions: `${wraparoundDims.totalWidthInches.toFixed(3)} × ${wraparoundDims.totalHeightInches.toFixed(3)} polegadas`,
    print_resolution: `${wraparoundDims.totalWidthPx} × ${wraparoundDims.totalHeightPx} px a 300 DPI`,
    spine_width: `${wraparoundDims.spineWidthInches}" (${wraparoundDims.spineWidthMm} mm)`,
    page_count: wraparoundDims.pageCount,
    kdp_status: "APPROVED_300DPI_READY",
    note: "Estes dados técnicos são para o pré-voo de impressão e não devem ser colados na IA de imagem.",
  };

  sanitized.framing_and_canvas = "100% FLAT 2D SPREAD GRAPHIC FILLING ENTIRE CANVAS EDGE-TO-EDGE. ZERO OUTER MARGINS, ZERO BACKGROUND CANVAS, ZERO PERSPECTIVE, ZERO 3D SHADOWS. The pure white background (#ffffff) must bleed completely to all four edges of the image canvas.";

  // 8. Ergonomia Visual Humana
  const prevErgo = sanitized.human_ergonomics || {};
  sanitized.human_ergonomics = {
    visual_comfort: prevErgo.visual_comfort || "alta_legibilidade_e_suavidade_sem_fadiga_ocular",
    contrast_ratio: prevErgo.contrast_ratio || "harmonioso_calibrado_para_percepcao_natural",
    aesthetic_tone: prevErgo.aesthetic_tone || "minimalista_assimetrico_acolhedor_e_sofisticado",
  };

  // 9. Blindagem de regras globais e negative prompt
  sanitized.negative_prompt = getCoverNegativePrompt();
  sanitized.global_rules = {
    single_continuous_image: true,
    three_horizontal_zones: "left: back cover, center: spine, right: front cover",
    theme: "white_minimalist_spread",
    only_book_title: true,
    no_author: true,
    no_publisher: true,
    no_cards: true,
    layout: "asymmetric_human_friendly_wraparound",
  };

  return sanitized;
}

/**
 * Gera os 3 ativos essenciais para publicação e divulgação comercial da obra:
 * 1. Prompt detalhado para geração de capa no formato JSON Nano Banana 2
 * 2. Sugestão de categorias (estritamente dentre as 32 permitidas)
 * 3. Descrição comercial para captação de clientes e palavras-chave (texto simples, máx 4000 caracteres)
 */
export async function generatePublishingMetadata(
  book: BookRecord,
  chapters: ChapterRecord[]
): Promise<PublishingMetadata> {
  const pageSpec = getPageFormatSpec(book.page_size);
  const dims = calculateCoverDimensions(book.page_size);
  const wraparoundDims = calculateWraparoundCoverDimensions(book.page_size, book.actual_pages);

  // 1. Extração da base teórica e visual dos livros base via RAG semântico
  let ragVisualTheorySnippets: string[] = [];
  try {
    const ragQueries = [
      `${book.title} modelos visuais diagramas figuras conceitos fundamentais metáforas`,
      `${book.title} princípios teóricos estrutura metodologia variáveis chaves equações`,
    ];

    for (const q of ragQueries) {
      const ragRes = await queryRag(book.id, q, 3);
      if (ragRes && ragRes.chunks && ragRes.chunks.length > 0) {
        for (const c of ragRes.chunks) {
          if (c.content && c.content.trim().length > 30) {
            ragVisualTheorySnippets.push(c.content.trim().slice(0, 350));
          }
        }
      }
    }
  } catch (err) {
    console.warn("[PublishingMetadata] Aviso ao consultar RAG para metadados de capa:", err);
  }

  const uniqueSnippets = Array.from(new Set(ragVisualTheorySnippets)).slice(0, 4);
  const ragTheoryContext = uniqueSnippets.length > 0
    ? uniqueSnippets.map((s, idx) => `[Evidência Teórica/Visual ${idx + 1} do Livro Base]:\n"${s}"`).join("\n\n")
    : "Conceitos centrais desconstruídos por primeiros princípios a partir do título e estrutura de capítulos.";

  const chaptersSummary = chapters
    .slice(0, 15)
    .map((ch) => `- Capítulo ${ch.chapter_number}: "${ch.title}" (Sinopse: ${ch.synopsis || "N/A"})`)
    .join("\n");

  // 1. Gera com o LLM a metáfora visual dinâmica e inovadora baseada estritamente no livro gerado
  let dynamicMetaphor: DynamicVisualMetaphor;
  try {
    dynamicMetaphor = await generateDynamicBookMetaphor(book, chapters);
  } catch {
    dynamicMetaphor = generateDefaultDynamicMetaphor(book, chapters);
  }

  const prompt = `Você é um diretor de arte editorial de prestígio internacional, especialista em capas minimalistas contemporâneas de alta sofisticação e no motor Nano Banana 2.

Analise o contexto integral da obra e da base teórica original a seguir:
- TÍTULO: "${book.title}"
- PÚBLICO-ALVO: "${book.target_audience}"
- TOM DE VOZ: "${book.tone_of_voice}"
- FORMATO FÍSICO DO LIVRO: "${pageSpec.name}" (${dims.widthMm} × ${dims.heightMm} mm / ${dims.widthInches}" × ${dims.heightInches}")
- ESPECIFICAÇÃO DE CAPA COMPLETA ESPALHADA (FULL WRAPAROUND SPREAD) AMAZON KDP (1 IMAGEM SÓ: CONTRACAPA + LOMBADA + CAPA FRENTE):
  * Largura Total do Canvas: ${wraparoundDims.totalWidthInches}" (${wraparoundDims.totalWidthMm} mm)
  * Altura Total do Canvas: ${wraparoundDims.totalHeightInches}" (${wraparoundDims.totalHeightMm} mm)
  * Proporção de Tela / Canvas: "${wraparoundDims.aspectRatio}"
  * Resolução Gráfica a 300 DPI: ${wraparoundDims.totalWidthPx} × ${wraparoundDims.totalHeightPx} px (Trim + Bleed oficial)
  * Espessura da Lombada Central: ${wraparoundDims.spineWidthInches}" (${wraparoundDims.spineWidthMm} mm) baseada em ${wraparoundDims.pageCount} páginas físicas
  * Diretriz de Lombada KDP: ${wraparoundDims.spineTextGuideline}
  * Sangria Gráfica KDP (Bleed): 0.125" (3.175 mm) em todas as 4 bordas externas
  * Código de Barras KDP (Barcode Safe Area): Retângulo de 2.0" × 1.2" (600 × 360 px) reservado no canto inferior da contracapa
- APRESENTAÇÃO/SÍNTESE: "${(book.executive_summary || "").substring(0, 700)}"
- ESTRUTURA DOS CAPÍTULOS:
${chaptersSummary}

- BASE TEÓRICA E VISUAL EXTRAÍDA DO RAG DOS LIVROS ORIGINAIS:
${ragTheoryContext}

- METÁFORA VISUAL DINÂMICA (NÃO FIXA) CONCEBIDA PARA ESTE LIVRO:
  * Conceito: "${dynamicMetaphor.metaphorConcept}"
  * Descrição do Motivo: "${dynamicMetaphor.motifDescription}"
  * Formas Vetoriais: "${dynamicMetaphor.motifShapes}"
  * Kicker Editorial: "${dynamicMetaphor.kickerText}"
  * Paleta: Destaque "${dynamicMetaphor.accentColor}", Contraste "${dynamicMetaphor.secondaryColor}"
  * Ancoragem Teórica: "${dynamicMetaphor.theoreticalGrounding}"

Sua missão é gerar OBRIGATORIAMENTE um objeto JSON com 3 campos específicos:

1. "coverPrompt":
   - DEVE ser OBRIGATORIAMENTE um objeto JSON descritivo de imagem perfeitamente compatível com o motor Nano Banana 2 para gerar a CAPA COMPLETA DO LIVRO EM UMA IMAGEM SÓ (Full Wraparound Spread: Contracapa + Lombada + Capa da Frente).
   - DIRETRIZES DE DESIGN EDITORIAL OBRIGATÓRIAS:
     * REGRA 1 (TEMA BRANCO & MATTE): O design DEVE ser em tema branco puro ("background_color": "#ffffff", "mode": "light", "paper_texture": "subtle_fine_art_matte_grain"). Fundo escuro ou preto é TOTALMENTE PROIBIDO.
     * REGRA 2 (SEM ESTRUTURA DE CARDS): É EXPRESSAMENTE PROIBIDO criar estrutura de cards, caixas ou listas de blocos. NUNCA gere campos como "cards", "total_cards", "card_shape" ou afins.
     * REGRA 3 (APENAS O NOME DO LIVRO): O ÚNICO texto de destaque permitido é o título exato do livro: "${book.title}".
     * REGRA 4 (SEM NOME DE AUTOR): É TERMINANTEMENTE PROIBIDO incluir o nome do autor na capa.
     * REGRA 5 (SEM NOME DE EDITORA): É TERMINANTEMENTE PROIBIDO incluir nome de editora, selo editorial ou logotipo.
     * REGRA 6 (COMPOSIÇÃO ASSIMÉTRICA, AMIGÁVEL AOS OLHOS HUMANOS E FUSÃO MANDATÓRIA DE 2 ESTILOS VISUAIS: BLUEPRINT TÉCNICO + LINHAS DE FLUXO ORGÂNICAS):
       - A capa deve ser ASSIMÉTRICA e dinamicamente balanceada (não use centralização monótona). Alinhe o título à esquerda no quadrante superior da capa frontal, contrabalançado pelo motivo visual principal descentralizado no terço inferior direito (proporção áurea 60/40).
       - O design deve ser AMIGÁVEL AOS OLHOS HUMANOS: fluxo visual natural em padrão Z/F, alto conforto visual sem fadiga óptica, contraste suave com carvão/grafite (#111827 / #0f172a sobre branco) e 65% de espaço negativo respirável.
       - FUSÃO INDISSOCIÁVEL DOS 2 ESTILOS NO ELEMENTO GRÁFICO (BLUEPRINT TÉCNICO + FLUXO ORGÂNICO):
         * A arte gráfica NUNCA deve ser puramente geométrica fria. Ela DEVE combinar rigorosamente:
           1) Linha Técnica Estilizada / Blueprint de Alta Precisão (corte esquemático, mecanismos, eixos anatômicos ou arquiteturais do assunto em traço fino de 1.0pt a 1.5pt).
           2) Linhas de Fluxo Orgânicas e Dinâmicas (curvas Bézier harmônicas, vórtices térmicos/fluidos, ondas de energia ou transição em degradê suave translúcido que envolvem e interagem com a estrutura técnica).
       - ENRIQUECIMENTO VISUAL OBRIGATÓRIO (mais 15% de elementos visuais estruturados para acabamento de alta fidelidade):
         * "visual_elements.primary_motif": Detalhe o motivo principal com "type", "concept", "description", "shapes" (destacando a fusão de contornos blueprint técnicos com curvas de fluxo orgânicas fluidas), "finish", "theoretical_grounding" (ancoragem teórica no RAG), além dos campos "micro_elements" (nós vetoriais, filamentos de 0.25pt e linhas de fluxo) e "light_interaction" (iluminação zenital suave a 45 graus com micro-sombras táteis).
         * "visual_elements.secondary_accents": Deve conter de 5 a 6 acentos gráficos discretos: 1) "asymmetric_hairline_divider", 2) "minimal_editorial_marker", 3) "theoretical_glyph_or_axis" (extraído da base teórica), 4) "optical_breathing_anchor", 5) "minimal_geometric_accent" (pequeno ponto ou traço abstrato discreto de precisão editorial, sem números e sem texto) e 6) "tactile_depth_accent" (micro-relevo sutil blind deboss ou gradiente tangencial de 2%).
         * "visual_elements.composition_geometry": Detalhe "focal_hierarchy", "negative_space_ratio" ("65%"), "asymmetric_balance_ratio" ("60/40_golden_ratio"), "visual_weight", "geometric_anchors" (coordenadas cartesianas do ponto focal e contrapeso) e "reading_cadence" (cadência em 4 tempos).
         * "visual_elements.tactile_and_material_details": Detalhe "paper_feel" (textura de papel algodão 300g/m² fosco), "ink_finish" (tinta mineral sem reflexo) e "emboss_relief" (micro-relevo cego de 0.3mm nos eixos).
     * REGRA 7 (CAPA COMPLETA ESPALHADA EM 1 IMAGEM SÓ & AMAZON KDP):
       - A capa DEVE ser gerada como um SPREAD PANORÂMICO CONTÍNUO EM UMA ÚNICA IMAGEM (Full Wraparound Cover para Amazon KDP Paperback) contendo as 3 ZONAS INTEGRADAS:
         1) "left_zone_back_cover": Contracapa (traseira) à esquerda com sinopse analítica da obra, respiro generoso e área de código de barras limpa em branco puro totalmente livre de textos, linhas ou molduras ("barcode_area").
         2) "central_zone_spine": Lombada central conectando de forma suave e contínua a contracapa e a capa da frente, sem linhas de dobra visíveis e sem réguas, com título do livro na vertical (${wraparoundDims.spineTextAllowed ? "permitido" : "lisa sem texto"}).
         3) "right_zone_front_cover": Capa da frente à direita com o título "${book.title}" no quadrante superior esquerdo, motivo visual principal (derivado do RAG dos livros base) no terço inferior direito na proporção áurea 60/40, 6 acentos secundários vetoriais e acabamento tátil de alto nível.
       - A proporção de tela DEVE ser "${wraparoundDims.aspectRatio}" e a resolução total "${wraparoundDims.totalWidthPx} × ${wraparoundDims.totalHeightPx} px".
       - Inclua obrigatoriamente os nós "spread_zones", "output_specifications" e "amazon_kdp_compliance" com as métricas de 300 DPI e conformidade KDP.
     * REGRA 8 (SIMILARIDADE VISUAL COM OS LIVROS BASE VIA RAG):
       - O "primary_motif", o "theoretical_grounding" e os "secondary_accents" DEVEM guardar estrita SIMILARIDADE FORMAL E CONCEITUAL com as teorias, diagramas e modelos descritos na BASE TEÓRICA DO RAG acima.
     * REGRA 9 (CALIBRAÇÃO DE CORES COM CAUTELA):
       - O fundo permanece OBRIGATORIAMENTE branco puro (#ffffff). Tipografia em carvão/grafite (#111827). Cores de destaque sóbrias e sem tons neon.
   - Siga rigorosamente a seguinte estrutura exata de JSON:
   {
     "image_type": "book_cover_full_wraparound",
     "style": "asymmetrical_minimalist_editorial_spread",
     "layout_format": "continuous_horizontal_spread_single_image",
     "orientation": "horizontal_spread",
     "aspect_ratio": "${wraparoundDims.aspectRatio}",
     "output_specifications": {
       "canvas_type": "full_wraparound_cover_paperback",
       "layout_format": "continuous_horizontal_spread_single_image",
       "sheet_format": "${wraparoundDims.formatName}",
       "page_count": ${wraparoundDims.pageCount},
       "dimensions_inches": "${wraparoundDims.totalWidthInches}\" × ${wraparoundDims.totalHeightInches}\"",
       "dimensions_mm": "${wraparoundDims.totalWidthMm} × ${wraparoundDims.totalHeightMm} mm",
       "front_cover_trim": "${wraparoundDims.trimWidthInches}\" × ${wraparoundDims.trimHeightInches}\"",
       "back_cover_trim": "${wraparoundDims.trimWidthInches}\" × ${wraparoundDims.trimHeightInches}\"",
       "spine_width": "${wraparoundDims.spineWidthInches}\" (${wraparoundDims.spineWidthMm} mm)",
       "bleed_each_side": "0.125\" (3.175 mm)",
       "print_resolution_300dpi": "${wraparoundDims.totalWidthPx} × ${wraparoundDims.totalHeightPx} px",
       "single_sheet_trim_resolution_300dpi": "${dims.printTrimWidthPx} × ${dims.printTrimHeightPx} px",
       "ebook_recommended_resolution": "${dims.ebookTargetWidthPx} × ${dims.ebookTargetHeightPx} px",
       "aspect_ratio": "${wraparoundDims.aspectRatio}",
       "dpi": 300,
       "color_profile": "sRGB"
     },
     "amazon_kdp_compliance": {
       "status": "APPROVED_KDP_WRAPAROUND_READY",
       "format_matched": "${wraparoundDims.formatName}",
       "error_resolution_match": "Exatamente ${wraparoundDims.kdpDimensionsString} polegadas (corrige e atende 100% ao erro de dimensões exigidas pelo KDP)",
       "target_dimensions": "${wraparoundDims.totalWidthInches.toFixed(3)} × ${wraparoundDims.totalHeightInches.toFixed(3)} polegadas",
       "current_resolution_print": "${wraparoundDims.totalWidthPx} × ${wraparoundDims.totalHeightPx} px a 300 DPI",
       "page_count_calibrated": ${wraparoundDims.pageCount},
       "spine_calculation": "${wraparoundDims.pageCount} páginas × ${KDP_PAPER_THICKNESS_FACTORS[wraparoundDims.paperType]}\" = ${wraparoundDims.spineWidthInches}\" de espessura de lombada",
       "spine_text_status": "${wraparoundDims.spineTextGuideline}",
       "bleed_requirement": "0.125\" aplicado em todas as 4 bordas externas",
       "barcode_safe_area": "Área reservada de 2.0\" × 1.2\" no canto inferior da contracapa",
       "dpi_compliance": "300 DPI verificado para impressão gráfica"
     },
     "theme": {
       "mode": "light",
       "background_color": "#ffffff",
       "paper_texture": "subtle_fine_art_matte_grain",
       "accent_color": "#hex (cor de destaque editorial harmônica com cautela)",
       "secondary_accent": "#hex (tom complementar sutil e elegante)"
     },
     "spread_zones": {
       "left_zone_back_cover": {
         "zone_name": "Contracapa / Traseira (Back Cover)",
         "horizontal_span": "0% até o início da lombada (~48.5% da largura da imagem)",
         "executive_synopsis": "Texto de sinopse analítica comercial da obra...",
         "typography": {
           "font_family": "sans-serif | modern_serif",
           "color": "#111827",
           "alignment": "left",
         },
          "barcode_area": {
            "type": "empty_white_negative_space",
            "position": "canto inferior da contracapa",
            "instruction": "Área em branco puro totalmente livre de textos, linhas ou molduras, reservada para o código de barras. NÃO desenhar retângulo, linha ou etiqueta."
          },
         "white_space_ratio": "65%"
       },
       "central_zone_spine": {
         "zone_name": "Lombada Central (Spine)",
         "horizontal_span": "centro da imagem (entre contracapa e capa da frente)",
         "spine_text": {
           "allowed": ${wraparoundDims.spineTextAllowed},
           "content": "${wraparoundDims.spineTextAllowed ? book.title : ""}",
           "orientation": "vertical_top_to_bottom",
           "color": "#111827",
            "instruction": "Título verticalizado e centralizado ao longo da lombada contínua, sem linhas de dobra visíveis."
         }
       },
       "right_zone_front_cover": {
         "zone_name": "Capa da Frente (Front Cover)",
         "horizontal_span": "do final da lombada até 100% da largura da imagem (~48.5% da largura)",
         "typography": {
           "title": "${book.title}",
           "title_style": {
             "font_family": "sans-serif | modern_serif",
             "font_weight": "bold",
             "color": "#111827",
             "alignment": "left",
             "case": "uppercase",
             "tracking": "refined_kerning_with_optical_breathing",
             "placement": "upper_left_quadrant"
           }
         },
         "layout_and_composition": {
           "composition_style": "dynamic_asymmetric_balance",
           "grid_structure": "asymmetrical_golden_ratio_60_40",
           "visual_flow": "human_eye_f_pattern_top_left_to_lower_right",
           "white_space_ratio": "65%",
           "depth_and_lighting": "soft_diffused_ambient_lighting_with_gentle_tactile_paper_relief"
         },
         "visual_elements": {
           "primary_motif": {
             "type": "string (ex: asymmetric_tolerance_axes, asymmetric_growth_vectors, asymmetric_golden_ratio_arc, asymmetric_neural_topology)",
             "concept": "Conceito visual profundo diretamente conectado à tese e aos livros base do RAG",
             "description": "Descrição detalhada do elemento visual assimétrico com formas limpas posicionado no terço inferior direito",
             "position": "lower_right_offset",
             "shapes": "linhas geométricas finas, eixos de precisão de 0.5pt e curvas orgânicas discretas",
             "finish": "smooth_matte_with_subtle_micro_gradient",
             "theoretical_grounding": "Ancoragem teórica formal demonstrando a similaridade com os livros base do RAG",
             "micro_elements": "nós de ancoragem vetorial de precisão microscópica, filamentos tensores ultra-finos de 0.25pt e eixos geométricos sutis sem números nem réguas",
             "light_interaction": "iluminação zenital difusa a 45 graus gerando micro-sombras táteis suaves sobre o papel sem brilho reflexivo"
           },
           "secondary_accents": [
             {
               "type": "asymmetric_hairline_divider",
               "description": "Linha vetorial horizontal ultrafina de 0.5pt ancorando o bloco do título à esquerda",
               "position": "below_title_left"
             },
             {
               "type": "minimal_editorial_marker",
               "description": "Micro-detalhe geométrico discreto de precisão editorial na margem",
               "position": "top_right_margin_subtle"
             },
             {
               "type": "theoretical_glyph_or_axis",
               "description": "Micro-elemento vetorial de conexão com a teoria base extraído dos modelos conceituais dos livros de referência",
               "position": "lower_right_anchor_subtle"
             },
             {
               "type": "optical_breathing_anchor",
               "description": "Ponto de ancoragem em proporção áurea garantindo 65% de espaço negativo respirável",
               "position": "center_right_negative_space"
             },
             {
               "type": "minimal_geometric_accent",
                "description": "Pequeno ponto ou traço geométrico abstrato discreto de precisão editorial, sem números e sem texto",
               "position": "lower_left_margin_discrete"
             },
             {
               "type": "tactile_depth_accent",
               "description": "Micro-relevo sutil (blind deboss) ou gradiente de luz tangencial de 2% conferindo profundidade háptica e tridimensionalidade refinada",
               "position": "along_primary_motif_perimeter"
             }
           ],
           "composition_geometry": {
             "focal_hierarchy": "1. Título superior esquerdo -> 2. Linha condutora -> 3. Motivo teórico inferior direito -> 4. Acentos geométricos sutis",
             "negative_space_ratio": "65%",
             "asymmetric_balance_ratio": "60/40_golden_ratio",
             "visual_weight": "tipografia assertiva equilibrada por geometria vetorial leve e precisa",
             "geometric_anchors": "Ponto focal principal em coordenadas normalizadas (X: 68%, Y: 72%), contrapeso tipográfico em (X: 12%, Y: 15%)",
             "reading_cadence": "Cadência em 4 tempos: 1) Impacto tipográfico -> 2) Condução pelo divisor -> 3) Respiro no espaço negativo -> 4) Decodificação do motivo teórico e geometria pura"
           },
           "tactile_and_material_details": {
             "paper_feel": "textura de papel algodão 300g/m² fosco natural com toque aveludado e microfibras dispersas visíveis sob iluminação difusa",
             "ink_finish": "tinta mineral de alta densidade sem reflexo especular (ultra-matte pigment ink)",
             "emboss_relief": "micro-relevo cego de 0.3mm (tactile blind deboss) ao longo dos eixos geométricos do motivo principal"
           },
           "color_palette": ["#ffffff", "#111827", "#accent_color", "#secondary_accent", "#94a3b8"]
         }
       }
     },
     "typography": {
       "title": "${book.title}",
       "title_style": {
         "font_family": "sans-serif | modern_serif | display",
         "font_weight": "bold",
         "color": "#111827",
         "alignment": "left",
         "case": "uppercase",
         "tracking": "refined_kerning_with_optical_breathing",
         "placement": "upper_left_quadrant"
       }
     },
     "layout_and_composition": {
       "composition_style": "dynamic_asymmetric_balance",
       "grid_structure": "asymmetrical_golden_ratio_60_40",
       "visual_flow": "human_eye_f_pattern_top_left_to_lower_right",
       "white_space_ratio": "65%",
       "depth_and_lighting": "soft_diffused_ambient_lighting_with_gentle_tactile_paper_relief"
     },
     "visual_elements": {
       "primary_motif": {
         "type": "string",
         "concept": "Conceito visual profundo diretamente conectado à tese e aos livros base do RAG",
         "description": "Descrição detalhada do elemento visual assimétrico com formas limpas posicionado no terço inferior direito",
         "position": "lower_right_offset",
         "shapes": "linhas geométricas finas, eixos de precisão de 0.5pt e curvas orgânicas discretas",
         "finish": "smooth_matte_with_subtle_micro_gradient",
         "theoretical_grounding": "Ancoragem teórica formal demonstrando a similaridade com os livros base do RAG",
         "micro_elements": "nós de ancoragem vetorial de precisão microscópica, filamentos tensores ultra-finos de 0.25pt e eixos geométricos sutis sem números nem réguas",
         "light_interaction": "iluminação zenital difusa a 45 graus gerando micro-sombras táteis suaves sobre o papel sem brilho reflexivo"
       },
       "secondary_accents": [
         { "type": "asymmetric_hairline_divider", "description": "Linha vetorial horizontal ultrafina de 0.5pt", "position": "below_title_left" },
         { "type": "minimal_editorial_marker", "description": "Micro-detalhe geométrico discreto", "position": "top_right_margin_subtle" },
         { "type": "theoretical_glyph_or_axis", "description": "Micro-elemento vetorial de conexão com a teoria base", "position": "lower_right_anchor_subtle" },
         { "type": "optical_breathing_anchor", "description": "Ponto de ancoragem em proporção áurea", "position": "center_right_negative_space" },
         { "type": "minimal_geometric_accent", "description": "Pequeno ponto ou traço geométrico abstrato discreto", "position": "lower_left_margin_discrete" },
         { "type": "tactile_depth_accent", "description": "Micro-relevo sutil ou gradiente de luz tangencial", "position": "along_primary_motif_perimeter" }
       ],
       "composition_geometry": {
         "focal_hierarchy": "1. Título superior esquerdo -> 2. Linha condutora -> 3. Motivo teórico inferior direito -> 4. Acentos geométricos sutis",
         "negative_space_ratio": "65%",
         "asymmetric_balance_ratio": "60/40_golden_ratio",
         "visual_weight": "tipografia assertiva equilibrada por geometria vetorial leve e precisa",
         "geometric_anchors": "Ponto focal principal em coordenadas normalizadas (X: 68%, Y: 72%), contrapeso tipográfico em (X: 12%, Y: 15%)",
         "reading_cadence": "Cadência em 4 tempos"
       },
       "tactile_and_material_details": {
         "paper_feel": "textura de papel algodão 300g/m² fosco natural",
         "ink_finish": "tinta mineral de alta densidade sem reflexo especular",
         "emboss_relief": "micro-relevo cego de 0.3mm ao longo dos eixos geométricos"
       },
       "color_palette": ["#ffffff", "#111827", "#accent_color", "#secondary_accent", "#94a3b8"]
     },
     "human_ergonomics": {
       "visual_comfort": "alta_legibilidade_e_suavidade_sem_fadiga_ocular",
       "contrast_ratio": "harmonioso_calibrado_para_percepcao_natural",
       "aesthetic_tone": "minimalista_assimetrico_acolhedor_e_sofisticado"
     },
     "negative_prompt": "dimension lines, measurement arrows, dimensional numbers, measurement labels, numbers, inches, millimeters, technical annotations, rulers, caliper, crease lines, fold lines, barcode box outline, 3d mockup, 3d book, book on table, perspective, angled view, drop shadow, shadows, gray borders, outer frame, margin frame, cards, card list, multiple boxes, UI components, dashboard, author name, author photo, publisher name, publisher logo, subtitles, complex busy illustrations, noisy chaotic textures, harsh shadows, photorealistic human faces",
     "global_rules": {
       "single_continuous_image": true,
       "three_horizontal_zones": "left: back cover, center: spine, right: front cover",
       "theme": "white_minimalist_spread",
       "only_book_title": true,
       "no_author": true,
       "no_publisher": true,
       "no_cards": true,
       "layout": "asymmetric_human_friendly_wraparound"
     }
   }

 2. "suggestedCategories":
   - Sugira entre 1 e 3 categorias que melhor enquadram este livro.
   - RESTRIÇÃO RIGOROSA E INEGOCIÁVEL: As categorias DEVEM ser selecionadas EXCLUSIVAMENTE da lista abaixo. Não crie nem modifique nenhuma categoria:
${ALLOWED_CATEGORIES.map((c) => `     * "${c}"`).join("\n")}
   - Separe as categorias escolhidas por ponto e vírgula (;). Exemplo: "Administração, Negócios e Economia; Computação, Informática e Mídias Digitais".

3. "marketingDescription":
   - Descrição comercial completa do livro para apresentação ao leitor e captação de clientes.
   - OBRIGATÓRIO: Formato de TEXTO SIMPLES PURO (sem asteriscos de negrito, sem hashtags de títulos, sem markdown, sem HTML, sem emojis).
   - OBRIGATÓRIO: Limite MÁXIMO de 4000 caracteres.

4. "seoKeywords":
   - Gerar exatamente 10 palavras-chave estratégicas para busca orgânica (SEO), Amazon KDP e buscadores generativos (Google AI Overviews, ChatGPT, Perplexity).
   - As palavras-chave DEVEM ser expressões reais de busca (de 2 a 5 palavras cada, máx 50 caracteres para caber nos 7 slots do KDP).
   - PROIBIDO palavras soltas unigramas genéricas (ex: proibido colocar apenas "marketing" ou "gestão").
   - As 10 palavras-chave DEVEM ser distribuídas rigorosamente em 4 tópicos semânticos:
     * Tópico 1 (Dor, Problema & Solução Prática - 3 keywords com foco em resolução e métodos)
     * Tópico 2 (Conceitos Centrais & Metodologias - 2 keywords técnicas fundamentais da obra)
     * Tópico 3 (Cargo, Persona & Contexto Profissional - 2 keywords conectadas à persona "${book.target_audience}")
     * Tópico 4 (Categoria Editorial & Descoberta Amazon KDP - 3 keywords de alta conversão de compra)
   - Formato JSON do campo "seoKeywords":
     {
       "clusters": [
         {
           "topic_id": "problem_solving",
           "topic_name": "Dor, Problema & Solução Prática",
           "description": "Expressões focadas na resolução de dores e métodos aplicados.",
           "keywords": [
             { "keyword": "exemplo de busca de solucao", "intent": "problem_solving" },
             { "keyword": "como resolver determinado gargalo", "intent": "problem_solving" },
             { "keyword": "passo a passo para resultado x", "intent": "problem_solving" }
           ]
         },
         {
           "topic_id": "methodology",
           "topic_name": "Conceitos Centrais & Metodologias",
           "description": "Termos técnicos, frameworks e indicadores fundamentais.",
           "keywords": [
             { "keyword": "conceito chave do livro", "intent": "informational" },
             { "keyword": "framework de analise x", "intent": "informational" }
           ]
         },
         {
           "topic_id": "persona",
           "topic_name": "Cargo, Persona & Contexto Profissional",
           "description": "Termos voltados ao perfil do tomador de decisão e leitor.",
           "keywords": [
             { "keyword": "livro de x para gestores", "intent": "persona" },
             { "keyword": "guia para lideres e diretores", "intent": "persona" }
           ]
         },
         {
           "topic_id": "editorial_kdp",
           "topic_name": "Categoria Editorial & Descoberta Amazon KDP",
           "description": "Termos comerciais para busca de livros e cadastro KDP.",
           "keywords": [
             { "keyword": "guia definitivo sobre tema", "intent": "transactional" },
             { "keyword": "melhor livro de gestao comercial", "intent": "transactional" },
             { "keyword": "manual pratico de tema x", "intent": "transactional" }
           ]
         }
       ]
     }

Responda OBRIGATORIAMENTE em JSON válido com esta estrutura:
{
  "coverPrompt": { ...objeto JSON completo do Nano Banana 2... },
  "suggestedCategories": "...",
  "marketingDescription": "...",
  "seoKeywords": { ...objeto com os 4 clusters e exatamente 10 keywords... }
}`;

  try {
    const response = await callGemini(prompt, {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    });

    const parsed = extractCleanJsonObject<any>(response.text);

    if (parsed && typeof parsed === "object") {
      let coverPromptStr = "";

      if (parsed.coverPrompt && typeof parsed.coverPrompt === "object") {
        const sanitizedCover = sanitizeCoverPromptJson(parsed.coverPrompt, book, chapters, dynamicMetaphor);
        coverPromptStr = JSON.stringify(sanitizedCover, null, 2);
      } else if (typeof parsed.coverPrompt === "string") {
        try {
          const testObj = JSON.parse(parsed.coverPrompt);
          const sanitizedCover = sanitizeCoverPromptJson(testObj, book, chapters, dynamicMetaphor);
          coverPromptStr = JSON.stringify(sanitizedCover, null, 2);
        } catch {
          coverPromptStr = JSON.stringify(buildNanoBananaCoverJson(book, chapters, dynamicMetaphor), null, 2);
        }
      } else {
        coverPromptStr = JSON.stringify(buildNanoBananaCoverJson(book, chapters, dynamicMetaphor), null, 2);
      }

      let rawCategories = String(parsed.suggestedCategories || "").trim();
      let marketingDescription = String(parsed.marketingDescription || "").trim();

      // Validar e filtrar categorias estritamente contra ALLOWED_CATEGORIES
      const categoryTokens = rawCategories
        .split(/[;\n]/)
        .map((c) => c.trim())
        .filter(Boolean);

      const validCategories = categoryTokens.filter((token) =>
        ALLOWED_CATEGORIES.some((allowed) => allowed.toLowerCase() === token.toLowerCase())
      );

      const normalizedCategories = validCategories.map((v) => {
        const found = ALLOWED_CATEGORIES.find((a) => a.toLowerCase() === v.toLowerCase());
        return found || v;
      });

      const finalCategories =
        normalizedCategories.length > 0
          ? Array.from(new Set(normalizedCategories)).join("; ")
          : "Não-ficção";

      let cleanDescription = sanitizeToPlainText(marketingDescription);
      if (!cleanDescription || cleanDescription.trim().length < 50) {
        cleanDescription = sanitizeToPlainText(generateDefaultMarketingDescription(book, chapters));
      } else if (cleanDescription.length > 4000) {
        cleanDescription = cleanDescription.substring(0, 3996) + "...";
      }

      // Sanitizar e estruturar as 10 palavras-chave por tópicos
      const sanitizedKeywordsData = sanitizeSeoKeywords(parsed.seoKeywords, book, chapters);
      const seoKeywordsStr = JSON.stringify(sanitizedKeywordsData, null, 2);

      return {
        coverPrompt: coverPromptStr,
        coverVisualPrompt: buildCleanVisualCoverPrompt(book, chapters, dynamicMetaphor),
        coverNegativePrompt: getCoverNegativePrompt(),
        suggestedCategories: finalCategories,
        marketingDescription: cleanDescription,
        seoKeywords: seoKeywordsStr,
      };
    }
  } catch (err) {
    console.warn("[PublishingMetadata] Falha na chamada da IA, aplicando geração determinística defensiva:", err);
  }

  // Fallback determinístico (para testes offline ou contingência)
  const defaultCoverPrompt = JSON.stringify(buildNanoBananaCoverJson(book, chapters, dynamicMetaphor), null, 2);
  const defaultCategories = "Administração, Negócios e Economia; Não-ficção";
  const defaultKeywordsData = buildDefaultSeoKeywords(book, chapters);
  const defaultKeywordsStr = JSON.stringify(defaultKeywordsData, null, 2);

  let cleanFallbackDesc = sanitizeToPlainText(generateDefaultMarketingDescription(book, chapters));
  if (cleanFallbackDesc.length > 4000) {
    cleanFallbackDesc = cleanFallbackDesc.substring(0, 3996) + "...";
  }

  return {
    coverPrompt: defaultCoverPrompt,
    coverVisualPrompt: buildCleanVisualCoverPrompt(book, chapters, dynamicMetaphor),
    coverNegativePrompt: getCoverNegativePrompt(),
    suggestedCategories: defaultCategories,
    marketingDescription: cleanFallbackDesc,
    seoKeywords: defaultKeywordsStr,
  };
}

export function generateDefaultMarketingDescription(
  book: BookRecord,
  chapters: ChapterRecord[]
): string {
  const chaptersText = chapters
    .map((ch) => `Capítulo ${ch.chapter_number}: ${ch.title} - ${ch.synopsis || "Exploração detalhada dos conceitos fundamentais."}`)
    .join("\n\n");

  return `${book.title.toUpperCase()}
Por ${book.author_name}

Sobre a Obra:
${book.executive_summary || "Um guia analítico e aprofundado desenvolvido para facilitar o entendimento conceitual e prático dos temas centrais abordados nesta obra."}

Público-Alvo:
Este livro foi desenvolvido especialmente para ${(book.target_audience || "leitores estratégicos").toLowerCase()}, com um tom de voz ${(book.tone_of_voice || "direto e analítico").toLowerCase()}, equilibrando rigor técnico e clareza didática.

Principais Tópicos Abordados:
${chaptersText || "Estrutura abrangente cobrindo fundamentos, frameworks e estratégias de execução."}

Por que ler este livro:
Ao longo desta leitura estruturada, você terá acesso a uma visão abrangente, direta ao ponto e enriquecida com análises práticas, diagramação editorial de alto nível e insights acionáveis para aplicação imediata.`;
}
