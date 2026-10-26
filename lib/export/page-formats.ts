export interface PageFormatSpec {
  id: string;
  name: string;
  description: string;
  cssSize: string;
  puppeteerFormat?: "A5" | "A4" | "Letter" | "Legal";
  widthMm: number;
  heightMm: number;
  puppeteerWidth: string;
  puppeteerHeight: string;
  margins: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  wordsPerPage: number;
}

export const STANDARD_PAGE_FORMATS: Record<string, PageFormatSpec> = {
  A5: {
    id: "A5",
    name: "A5 (148 × 210 mm)",
    description: "Padrão Editorial / Não-Ficção (Recomendado)",
    cssSize: "148mm 210mm",
    puppeteerFormat: "A5",
    widthMm: 148,
    heightMm: 210,
    wordsPerPage: 250,
    puppeteerWidth: "148mm",
    puppeteerHeight: "210mm",
    margins: {
      top: "22mm",
      bottom: "22mm",
      left: "20mm",
      right: "18mm",
    },
  },
  TRADE: {
    id: "TRADE",
    name: "Trade Book 6\" × 9\" (152 × 229 mm)",
    description: "Padrão Internacional / Amazon KDP",
    cssSize: "152.4mm 228.6mm",
    widthMm: 152.4,
    heightMm: 228.6,
    wordsPerPage: 270,
    puppeteerWidth: "152.4mm",
    puppeteerHeight: "228.6mm",
    margins: {
      top: "22mm",
      bottom: "22mm",
      left: "20mm",
      right: "18mm",
    },
  },
  DIGEST: {
    id: "DIGEST",
    name: "Digest 5.5\" × 8.5\" (140 × 216 mm)",
    description: "Romance & Desenvolvimento Pessoal",
    cssSize: "139.7mm 215.9mm",
    widthMm: 139.7,
    heightMm: 215.9,
    wordsPerPage: 230,
    puppeteerWidth: "139.7mm",
    puppeteerHeight: "215.9mm",
    margins: {
      top: "20mm",
      bottom: "20mm",
      left: "18mm",
      right: "16mm",
    },
  },
  A4: {
    id: "A4",
    name: "A4 (210 × 297 mm)",
    description: "Manual Técnico / Apostila / Relatório",
    cssSize: "210mm 297mm",
    puppeteerFormat: "A4",
    widthMm: 210,
    heightMm: 297,
    wordsPerPage: 450,
    puppeteerWidth: "210mm",
    puppeteerHeight: "297mm",
    margins: {
      top: "25mm",
      bottom: "25mm",
      left: "25mm",
      right: "20mm",
    },
  },
  POCKET: {
    id: "POCKET",
    name: "Pocket (120 × 180 mm)",
    description: "Livro de Bolso Compacto",
    cssSize: "120mm 180mm",
    widthMm: 120,
    heightMm: 180,
    wordsPerPage: 190,
    puppeteerWidth: "120mm",
    puppeteerHeight: "180mm",
    margins: {
      top: "16mm",
      bottom: "16mm",
      left: "16mm",
      right: "14mm",
    },
  },
};

/**
 * Retorna a especificação de formato de folha baseada no ID (ex: "A5", "TRADE", "DIGEST", "A4").
 * Caso não seja fornecido ou seja inválido, faz fallback seguro para o padrão "A5".
 */
export function getPageFormatSpec(pageSizeId?: string | null): PageFormatSpec {
  if (!pageSizeId) return STANDARD_PAGE_FORMATS.A5;
  const normalized = pageSizeId.trim().toUpperCase();
  return STANDARD_PAGE_FORMATS[normalized] || STANDARD_PAGE_FORMATS.A5;
}

export interface VolumeRequirements {
  format: PageFormatSpec;
  targetPages: number;
  wordsPerPage: number;
  targetTotalWords: number;
  recommendedChaptersMin: number;
  recommendedChaptersMax: number;
  targetWordsPerChapter: number;
}

/**
 * Calcula dinamicamente o dimensionamento editorial do livro baseado no formato da folha
 * e na meta de páginas, imune a trocas futuras de formatos e modelos de LLM.
 * Garante matematicamente que o livro NUNCA seja subdimensionado em número de capítulos.
 */
export function calculateBookVolumeRequirements(
  pageSizeId?: string | null,
  minPages: number = 70,
  maxPages: number = 100,
  targetWordsPerChapter: number = 3200
): VolumeRequirements {
  const format = getPageFormatSpec(pageSizeId);
  const targetPages = Math.max(10, minPages);
  const wordsPerPage = format.wordsPerPage || 250;
  
  // Total de palavras alvo para atingir confortavelmente a meta mínima de páginas impressas
  const targetTotalWords = Math.round(targetPages * wordsPerPage);
  
  // Em publicação editorial, cada capítulo ocupa em média de 7 a 9 páginas físicas (incluindo aberturas, respiros e figuras).
  // Portanto, para atingir N páginas, o número de capítulos deve ser calibrado tanto pelo volume de palavras
  // quanto pela cadência física de páginas por capítulo.
  const minChaptersByWords = Math.ceil(targetTotalWords / targetWordsPerChapter);
  const minChaptersByPages = Math.ceil(targetPages / 8.5);
  
  const idealChapters = Math.max(minChaptersByWords, minChaptersByPages);
  const recommendedChaptersMin = Math.max(5, idealChapters);
  const recommendedChaptersMax = Math.min(30, Math.max(recommendedChaptersMin + 2, Math.ceil(idealChapters * 1.3)));

  return {
    format,
    targetPages,
    wordsPerPage,
    targetTotalWords,
    recommendedChaptersMin,
    recommendedChaptersMax,
    targetWordsPerChapter,
  };
}

export interface CoverDimensionSpec {
  formatId: string;
  formatName: string;
  description: string;
  widthMm: number;
  heightMm: number;
  widthInches: number;
  heightInches: number;
  aspectRatio: string;
  aspectRatioDecimal: number;
  aspectRatioFraction: string;
  printTrimWidthPx: number;
  printTrimHeightPx: number;
  printBleedWidthPx: number;
  printBleedHeightPx: number;
  ebookTargetWidthPx: number;
  ebookTargetHeightPx: number;
  kdpMinResolutionMet: boolean;
  kdpMinResolutionText: string;
  kdpIdealResolutionText: string;
  dpi: number;
  colorProfile: "sRGB";
}

/**
 * Mapeamento de frações editoriais canônicas para proporção de aspecto por folha.
 */
const FORMAT_ASPECT_FRACTIONS: Record<string, string> = {
  A5: "74:105",
  TRADE: "2:3",
  DIGEST: "11:17",
  A4: "1:1.41",
  POCKET: "2:3",
};

/**
 * Calcula determinística e matematicamente as dimensões, proporção de aspecto e resoluções gráficas
 * da capa em perfeita conformidade com as exigências da Amazon KDP (Kindle Direct Publishing),
 * garantindo que a capa gerada tenha O MESMO TAMANHO E PROPORÇÃO DA FOLHA selecionada pelo usuário.
 */
export function calculateCoverDimensions(pageSizeId?: string | null): CoverDimensionSpec {
  const format = getPageFormatSpec(pageSizeId);
  const widthMm = format.widthMm;
  const heightMm = format.heightMm;

  // 1 polegada = 25.4 mm
  const widthInches = Number((widthMm / 25.4).toFixed(2));
  const heightInches = Number((heightMm / 25.4).toFixed(2));

  // Relação de aspecto (Altura / Largura)
  const ratioDecimal = heightMm / widthMm;
  const aspectRatio = `1:${(ratioDecimal).toFixed(2)}`;
  const aspectRatioFraction = FORMAT_ASPECT_FRACTIONS[format.id] || `1:${(ratioDecimal).toFixed(2)}`;

  // Resolução de Impressão Gráfica a 300 DPI (Trim Size exato da folha)
  const printTrimWidthPx = Math.round((widthMm / 25.4) * 300);
  const printTrimHeightPx = Math.round((heightMm / 25.4) * 300);

  // Resolução de Impressão Gráfica com Sangria Amazon KDP (+0.125" largura externa, +0.250" altura total)
  const printBleedWidthPx = Math.round(((widthMm / 25.4) + 0.125) * 300);
  const printBleedHeightPx = Math.round(((heightMm / 25.4) + 0.250) * 300);

  // Resolução de eBook em Alta Definição preservando a proporção matemática da folha do usuário
  const ebookTargetHeightPx = 2560;
  const ebookTargetWidthPx = Math.round(2560 / ratioDecimal);

  // Validação categórica de conformidade Amazon KDP (mínimo absoluto 1000 x 625 px)
  const kdpMinResolutionMet = printTrimWidthPx >= 625 && printTrimHeightPx >= 1000;

  return {
    formatId: format.id,
    formatName: format.name,
    description: format.description,
    widthMm,
    heightMm,
    widthInches,
    heightInches,
    aspectRatio,
    aspectRatioDecimal: Number(ratioDecimal.toFixed(4)),
    aspectRatioFraction,
    printTrimWidthPx,
    printTrimHeightPx,
    printBleedWidthPx,
    printBleedHeightPx,
    ebookTargetWidthPx,
    ebookTargetHeightPx,
    kdpMinResolutionMet,
    kdpMinResolutionText: "1000 × 625 px (Mínimo Obrigatório KDP)",
    kdpIdealResolutionText: "2560 × 1600 px (Padrão KDP 1.6:1)",
    dpi: 300,
    colorProfile: "sRGB",
  };
}

export type PaperThicknessType = "white" | "cream" | "color_standard" | "color_premium";

export interface WraparoundCoverSpec {
  formatId: string;
  formatName: string;
  paperType: PaperThicknessType;
  pageCount: number;
  // Medidas em polegadas
  trimWidthInches: number;
  trimHeightInches: number;
  spineWidthInches: number;
  bleedInches: number;
  totalWidthInches: number;
  totalHeightInches: number;
  // Medidas em milímetros
  trimWidthMm: number;
  trimHeightMm: number;
  spineWidthMm: number;
  totalWidthMm: number;
  totalHeightMm: number;
  // Proporções de Tela
  aspectRatio: string;
  aspectRatioDecimal: number;
  // Resoluções em Pixels (300 DPI)
  totalWidthPx: number;
  totalHeightPx: number;
  spineWidthPx: number;
  frontCoverWidthPx: number;
  backCoverWidthPx: number;
  bleedPx: number;
  // Regras Editoriais Amazon KDP
  spineTextAllowed: boolean;
  spineTextGuideline: string;
  barcodeSafeZone: {
    widthInches: number;
    heightInches: number;
    widthPx: number;
    heightPx: number;
    placement: string;
    description: string;
  };
  kdpDimensionsString: string;
  dpi: number;
  colorProfile: "sRGB";
}

/**
 * Fatores oficiais de espessura de papel da Amazon KDP (polegadas por página).
 */
export const KDP_PAPER_THICKNESS_FACTORS: Record<PaperThicknessType, number> = {
  white: 0.002252,          // Livro P&B em Papel Branco
  cream: 0.002500,          // Livro P&B em Papel Creme
  color_standard: 0.002252, // Livro Colorido Standard
  color_premium: 0.002347,  // Livro Colorido Premium
};

/**
 * Calcula matematicamente o Spread Contínuo Panorâmico Único (Full Wraparound Cover)
 * para livros impressos (Paperback / Hardcover) da Amazon KDP:
 * Contracapa (Back Cover) + Lombada (Spine) + Capa da Frente (Front Cover) + Sangria (Bleed 0.125" em todas as bordas).
 * 
 * Atende com precisão milimétrica a exigências como 12.615" × 9.250" (para Trade 6x9 com ~162 páginas).
 */
export function calculateWraparoundCoverDimensions(
  pageSizeId?: string | null,
  actualPages?: number | null,
  paperType: PaperThicknessType = "white"
): WraparoundCoverSpec {
  const format = getPageFormatSpec(pageSizeId);
  const trimWidthInches = Number((format.widthMm / 25.4).toFixed(3));
  const trimHeightInches = Number((format.heightMm / 25.4).toFixed(3));

  // Determinar número de páginas (default seguro de 162 páginas, limites físicos KDP: 24 a 828 pgs)
  const KDP_MAX_PAPERBACK_PAGES = 828;
  const pageCount = actualPages && actualPages > 0 
    ? Math.min(KDP_MAX_PAPERBACK_PAGES, Math.max(24, Math.round(actualPages))) 
    : 162;

  // Fator de espessura
  const factor = KDP_PAPER_THICKNESS_FACTORS[paperType] || KDP_PAPER_THICKNESS_FACTORS.white;

  // Largura da lombada em polegadas (ex: 162 * 0.002252 = 0.3648" ≈ 0.365")
  const spineWidthInches = Number((pageCount * factor).toFixed(3));
  const bleedInches = 0.125;

  // Largura Total = Sangria Esq (0.125") + Contracapa + Lombada + Capa Frente + Sangria Dir (0.125")
  const totalWidthInches = Number(((trimWidthInches * 2) + spineWidthInches + (bleedInches * 2)).toFixed(3));

  // Altura Total = Sangria Sup (0.125") + Altura Trim + Sangria Inf (0.125")
  const totalHeightInches = Number((trimHeightInches + (bleedInches * 2)).toFixed(3));

  // Milímetros
  const trimWidthMm = Number(format.widthMm.toFixed(1));
  const trimHeightMm = Number(format.heightMm.toFixed(1));
  const spineWidthMm = Number((spineWidthInches * 25.4).toFixed(1));
  const totalWidthMm = Number((totalWidthInches * 25.4).toFixed(1));
  const totalHeightMm = Number((totalHeightInches * 25.4).toFixed(1));

  // Pixels a 300 DPI
  const totalWidthPx = Math.round(totalWidthInches * 300);
  const totalHeightPx = Math.round(totalHeightInches * 300);
  const spineWidthPx = Math.round(spineWidthInches * 300);
  const frontCoverWidthPx = Math.round((trimWidthInches + bleedInches) * 300);
  const backCoverWidthPx = Math.round((trimWidthInches + bleedInches) * 300);
  const bleedPx = Math.round(bleedInches * 300);

  // Proporções
  const ratioDecimal = Number((totalWidthInches / totalHeightInches).toFixed(4));
  const aspectRatio = `${totalWidthInches.toFixed(3)}:${totalHeightInches.toFixed(3)}`;

  // Regra de texto de lombada da Amazon KDP: apenas se páginas >= 80
  const spineTextAllowed = pageCount >= 80;
  const spineTextGuideline = spineTextAllowed
    ? `Texto de lombada PERMITIDO (${pageCount} páginas >= 80 pgs mínimas). Deixe 0.0625" (1.6mm) de margem de cada lado da dobra.`
    : `Lombada LISA sem texto (${pageCount} páginas < 80 pgs). A Amazon KDP não permite texto de lombada para livros com menos de 80 páginas devido à tolerância de corte gráfico.`;

  return {
    formatId: format.id,
    formatName: format.name,
    paperType,
    pageCount,
    trimWidthInches,
    trimHeightInches,
    spineWidthInches,
    bleedInches,
    totalWidthInches,
    totalHeightInches,
    trimWidthMm,
    trimHeightMm,
    spineWidthMm,
    totalWidthMm,
    totalHeightMm,
    aspectRatio,
    aspectRatioDecimal: ratioDecimal,
    totalWidthPx,
    totalHeightPx,
    spineWidthPx,
    frontCoverWidthPx,
    backCoverWidthPx,
    bleedPx,
    spineTextAllowed,
    spineTextGuideline,
    barcodeSafeZone: {
      widthInches: 2.0,
      heightInches: 1.2,
      widthPx: 600,
      heightPx: 360,
      placement: "lower_right_back_cover",
      description: "Área reservada de 2.0\" × 1.2\" no canto inferior da contracapa, totalmente livre de textos e grafismos para a etiqueta de código de barras impressa pela Amazon KDP.",
    },
    kdpDimensionsString: `${totalWidthInches.toFixed(3)}x${totalHeightInches.toFixed(3)}`,
    dpi: 300,
    colorProfile: "sRGB",
  };
}

