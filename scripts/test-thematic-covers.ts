import { BookRecord, ChapterRecord } from "../lib/db/schema";
import { getThematicCoverSvg, buildNativeCoverHtml } from "../lib/export/cover-compiler-engine";
import { calculateWraparoundCoverDimensions } from "../lib/export/page-formats";

const domains = [
  {
    name: "Marketing & Vendas",
    book: {
      id: "book-mkt",
      title: "Métricas de Marketing e Aquisição de Clientes",
      target_audience: "CMOs e Gestores de Tráfego",
      executive_summary: "Guia analítico de mensuração de CAC, LTV, funil de conversão e escala comercial.",
      page_size: "TRADE",
      actual_pages: 162,
    } as BookRecord,
    expectedKicker: "MENSURAÇÃO, DESEMPENHO & CRESCIMENTO COMERCIAL",
    expectedGraphicPiece: "mktFunnelGrad",
  },
  {
    name: "Engenharia Mecânica & NBR 6158",
    book: {
      id: "book-eng",
      title: "Tolerâncias Dimensionais e Ajustes NBR 6158",
      target_audience: "Engenheiros mecânicos e projetistas industriais",
      executive_summary: "Estudo sobre acoplamento de eixo e furo, folga e interferência na manufatura mecânica.",
      page_size: "TRADE",
      actual_pages: 162,
    } as BookRecord,
    expectedKicker: "ENGENHARIA MECÂNICA & PRECISÃO DIMENSIONAL",
    expectedGraphicPiece: "engShaftGrad",
  },
  {
    name: "Inteligência Artificial & Dados",
    book: {
      id: "book-ai",
      title: "Arquitetura de LLMs e Engenharia de Prompt",
      target_audience: "Cientistas de dados e engenheiros de software",
      executive_summary: "Fundamentos de redes neurais profundas, embeddings latentes e modelos de inferência.",
      page_size: "TRADE",
      actual_pages: 162,
    } as BookRecord,
    expectedKicker: "INTELIGÊNCIA ARTIFICIAL & CIÊNCIA DE DADOS",
    expectedGraphicPiece: "aiTensorGrad",
  },
  {
    name: "Finanças & Investimentos",
    book: {
      id: "book-fin",
      title: "Valuation e Alocação de Capital",
      target_audience: "Investidores e diretores financeiros",
      executive_summary: "Modelagem de fluxo de caixa descontado, juros compostos e patrimônio de longo prazo.",
      page_size: "TRADE",
      actual_pages: 162,
    } as BookRecord,
    expectedKicker: "GESTÃO FINANCEIRA, VALUATION & CAPITAL",
    expectedGraphicPiece: "finSpiralGrad",
  },
  {
    name: "Saúde & Biologia",
    book: {
      id: "book-health",
      title: "Fisiologia Humana e Medicina Preventiva",
      target_audience: "Médicos e profissionais de saúde",
      executive_summary: "Tratado sobre homeostase, dinâmica molecular celular e regulação neurobiológica.",
      page_size: "TRADE",
      actual_pages: 162,
    } as BookRecord,
    expectedKicker: "CIÊNCIA BIOLÓGICA, MEDICINA & FISIOLOGIA HUMANA",
    expectedGraphicPiece: "bioHelixGrad",
  },
  {
    name: "Educação & Filosofia",
    book: {
      id: "book-edu",
      title: "Filosofia do Conhecimento e Dialética",
      target_audience: "Professores e pesquisadores",
      executive_summary: "Investigação epistemológica sobre a construção do saber histórico e pensamento crítico.",
      page_size: "TRADE",
      actual_pages: 162,
    } as BookRecord,
    expectedKicker: "FUNDAMENTAÇÃO DIALÉTICA, HISTÓRIA & CONHECIMENTO",
    expectedGraphicPiece: "humPrismGrad",
  },
  {
    name: "Liderança & Estratégia",
    book: {
      id: "book-lead",
      title: "Governança Corporativa e Gestão Estratégica",
      target_audience: "CEOs e conselheiros",
      executive_summary: "Frameworks de tomada de decisão executiva, liderança ágil e direção de horizontes.",
      page_size: "TRADE",
      actual_pages: 162,
    } as BookRecord,
    expectedKicker: "LIDERANÇA EXECUTIVA & ESTRATÉGIA CORPORATIVA",
    expectedGraphicPiece: "stratGrad",
  },
];

console.log("==================================================");
console.log("🎨 VALIDANDO METÁFORAS VISUAIS TEMÁTICAS E KICKERS");
console.log("==================================================");

for (const d of domains) {
  const theme = getThematicCoverSvg(d.book, []);
  console.log(`\n[Domínio: ${d.name}]`);
  console.log(`- Kicker gerado: "${theme.kickerText}"`);
  console.log(`- Cor de destaque: ${theme.accentColor}`);
  console.log(`- Cor secundária: ${theme.secondaryColor}`);

  if (theme.kickerText !== d.expectedKicker) {
    throw new Error(`[FALHA] Kicker incorreto para ${d.name}! Esperado: "${d.expectedKicker}", Recebido: "${theme.kickerText}"`);
  }
  if (!theme.svgGraphic.includes(d.expectedGraphicPiece)) {
    throw new Error(`[FALHA] SVG não contém a metáfora esperada '${d.expectedGraphicPiece}' para ${d.name}!`);
  }

  // Valida que o HTML contém o Kicker e o SVG
  const spec = calculateWraparoundCoverDimensions(d.book.page_size, d.book.actual_pages);
  const html = buildNativeCoverHtml(d.book, [], spec);
  const expectedHtmlKicker = theme.kickerText.replace(/&/g, "&amp;");
  if (!html.includes(expectedHtmlKicker)) {
    throw new Error(`[FALHA] O HTML gerado não incluiu o kicker no cabeçalho da capa frontal!`);
  }
  if (!html.includes('class="front-kicker"')) {
    throw new Error(`[FALHA] O HTML não possui a classe .front-kicker!`);
  }
  if (html.includes("<text") || html.includes("</text>")) {
    throw new Error(`[FALHA] O SVG gerado contém tags <text> proibidas!`);
  }

  console.log(`✅ Sucesso! Metáfora visual do assunto transmitida com precisão.`);
}

console.log("\n==================================================");
console.log("🎉 TODOS OS 7 DOMÍNIOS TEMÁTICOS PASSARAM COM SUCESSO!");
console.log("==================================================");
