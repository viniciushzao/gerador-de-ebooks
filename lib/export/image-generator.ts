import fs from "fs";
import path from "path";

export interface GeneratedEditorialImage {
  id: string;
  filePath: string;
  relativePath: string;
  title: string;
  caption: string;
  width: number;
  height: number;
}

export type GraphicConceptType =
  | "conceptual_pillars"
  | "strategic_flow"
  | "decision_matrix"
  | "comparison_table"
  | "quadrant"
  | "architecture"
  | "timeline"
  | "financial_cascade";

/**
 * Generates an ultra-high resolution vector/SVG explanatory graphic for editorial publication.
 * Implements visualization standards from snow-d3, tryopendata/skills (OpenChart), and aj-geddes/useful-ai-prompts.
 * Uses strict multiline containment and foreignObject wrapping to prevent any text overlapping.
 */
export function generateExplanatoryGraphic(
  bookId: string,
  chapterNumber: number,
  title: string,
  conceptType: GraphicConceptType,
  items: Array<{ label: string; description: string; tag?: string; value?: string }>,
  caption: string
): GeneratedEditorialImage {
  const imagesDir = path.join(process.cwd(), "data", "output", "images");
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const imageId = `img_${bookId}_c${chapterNumber}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const fileName = `${imageId}.svg`;
  const filePath = path.join(imagesDir, fileName);

  const width = 1200;
  const height = 720;

  // Modern editorial color palette (Snow-D3 & OpenData standard)
  const primaryColor = "#0f172a";
  const accentColor = "#059669";
  const secondaryColor = "#2563eb";
  const tertiaryColor = "#7c3aed";
  const amberColor = "#d97706";
  const bgCard = "#ffffff";
  const borderCard = "#e2e8f0";
  const textDark = "#0f172a";
  const textMuted = "#475569";

  const stripeColors = [primaryColor, accentColor, secondaryColor, tertiaryColor, amberColor];

  let contentSvg = "";

  if (conceptType === "strategic_flow" || conceptType === "timeline") {
    // Snow-D3 Flowchart, Timeline & Process Pipeline Translation
    const totalSteps = Math.min(Math.max(items.length, 1), 4);
    const gap = 36;
    const paddingX = 40;
    const availableW = width - (paddingX * 2) - ((totalSteps - 1) * gap);
    const cardWidth = Math.floor(availableW / totalSteps);

    contentSvg = items.slice(0, 4)
      .map((item, idx) => {
        const x = paddingX + idx * (cardWidth + gap);
        const y = 140;
        const h = 480;
        const color = stripeColors[idx % stripeColors.length];
        const isLast = idx === totalSteps - 1;

        return `
          <g transform="translate(${x}, ${y})">
            <!-- Card Container -->
            <rect width="${cardWidth}" height="${h}" rx="12" fill="${bgCard}" stroke="${borderCard}" stroke-width="1.5" />
            
            <!-- Step Badge Header -->
            <rect x="16" y="16" width="80" height="26" rx="6" fill="${color}" />
            <text x="56" y="33" font-family="'Georgia', serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">ETAPA ${idx + 1}</text>
            
            <!-- Label -->
            <foreignObject x="16" y="54" width="${cardWidth - 32}" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: ${textDark}; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                ${escapeXml(item.label)}
              </div>
            </foreignObject>
            
            <line x1="16" y1="125" x2="${cardWidth - 16}" y2="125" stroke="${borderCard}" stroke-width="1"/>
            
            <!-- Description Body -->
            <foreignObject x="16" y="138" width="${cardWidth - 32}" height="${h - 155}">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: ${textMuted}; text-align: left; word-wrap: break-word; overflow: hidden;">
                ${escapeXml(item.description)}
              </div>
            </foreignObject>
            
            ${!isLast ? `
              <!-- D3 Connecting Arrow to Next Step -->
              <g transform="translate(${cardWidth + 8}, ${h / 2 - 12})">
                <circle cx="10" cy="12" r="14" fill="#f1f5f9" stroke="${borderCard}" stroke-width="1.5"/>
                <path d="M 6 12 L 14 12 M 11 8 L 15 12 L 11 16" fill="none" stroke="${primaryColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </g>
            ` : ""}
          </g>
        `;
      })
      .join("\n");
  } else if (conceptType === "decision_matrix" || conceptType === "quadrant") {
    // 2x2 Matrix / Quadrant Grid
    const qW = (width - 120) / 2;
    const qH = 220;
    const gridItems = items.slice(0, 4);

    contentSvg = `
      <g transform="translate(40, 140)">
        ${gridItems.map((item, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const x = col * (qW + 40);
          const y = row * (qH + 25);
          const color = stripeColors[idx % stripeColors.length];

          return `
            <g transform="translate(${x}, ${y})">
              <rect width="${qW}" height="${qH}" rx="10" fill="${bgCard}" stroke="${borderCard}" stroke-width="1.5" />
              <rect x="0" y="0" width="${qW}" height="32" rx="10" fill="${color}" />
              <rect x="0" y="20" width="${qW}" height="12" fill="${color}" />
              <text x="16" y="21" font-family="'Georgia', serif" font-size="13" font-weight="bold" fill="#ffffff">QUADRANTE ${idx + 1}: ${escapeXml(item.label.substring(0, 30))}</text>
              <foreignObject x="16" y="44" width="${qW - 32}" height="${qH - 54}">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.45; color: ${textDark}; word-wrap: break-word; overflow: hidden; padding-top: 6px;">
                  <strong>${escapeXml(item.label)}:</strong> ${escapeXml(item.description)}
                </div>
              </foreignObject>
            </g>
          `;
        }).join("\n")}
      </g>
    `;
  } else if (conceptType === "comparison_table" || conceptType === "financial_cascade") {
    // OpenData / OpenChart Structured Data Table & Calculation Cascade
    const rowH = 70;
    const tableW = width - 80;
    const startX = 40;
    const startY = 140;

    contentSvg = `
      <g transform="translate(${startX}, ${startY})">
        <!-- Table Header -->
        <rect width="${tableW}" height="45" rx="8" fill="${primaryColor}" />
        <text x="24" y="28" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">DIMENSÃO / ETAPA OPERACIONAL</text>
        <text x="420" y="28" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">DESDOBRAMENTO ESTRATÉGICO & DIRETRIZ</text>
        
        <!-- Rows -->
        ${items.slice(0, 6).map((item, idx) => {
          const y = 55 + idx * rowH;
          const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
          return `
            <g transform="translate(0, ${y})">
              <rect width="${tableW}" height="${rowH - 8}" rx="8" fill="${bg}" stroke="${borderCard}" stroke-width="1"/>
              <rect x="0" y="0" width="6" height="${rowH - 8}" rx="3" fill="${stripeColors[idx % stripeColors.length]}"/>
              <foreignObject x="20" y="8" width="380" height="${rowH - 24}">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13.5px; font-weight: bold; color: ${textDark}; line-height: 1.25; word-wrap: break-word; overflow: hidden;">
                  ${escapeXml(item.label)}
                </div>
              </foreignObject>
              <foreignObject x="420" y="8" width="${tableW - 440}" height="${rowH - 24}">
                <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; color: ${textMuted}; line-height: 1.4; word-wrap: break-word; overflow: hidden;">
                  ${escapeXml(item.description)}
                </div>
              </foreignObject>
            </g>
          `;
        }).join("\n")}
      </g>
    `;
  } else {
    // Conceptual Pillars & Distribution Taxonomy (Default)
    const totalItems = Math.min(Math.max(items.length, 1), 4);
    const gap = 20;
    const paddingX = 40;
    const availableW = width - (paddingX * 2) - ((totalItems - 1) * gap);
    const cardWidth = Math.floor(availableW / totalItems);

    contentSvg = items.slice(0, 4)
      .map((item, idx) => {
        const x = paddingX + idx * (cardWidth + gap);
        const y = 140;
        const h = 500;
        const stripeColor = stripeColors[idx % stripeColors.length];
        const labelText = item.label.length > 60 ? item.label.substring(0, 57) + "..." : item.label;

        return `
          <g transform="translate(${x}, ${y})">
            <!-- Card Base -->
            <rect width="${cardWidth}" height="${h}" rx="10" fill="${bgCard}" stroke="${borderCard}" stroke-width="1.5" />
            
            <!-- Header Stripe -->
            <path d="M 0 10 Q 0 0 10 0 L ${cardWidth - 10} 0 Q ${cardWidth} 0 ${cardWidth} 10 L ${cardWidth} 38 L 0 38 Z" fill="${stripeColor}" />
            <text x="16" y="24" font-family="'Georgia', serif" font-size="14" font-weight="bold" fill="#ffffff">PILAR ${idx + 1}</text>
            
            <!-- Dynamic Wrapped Title -->
            <foreignObject x="16" y="50" width="${cardWidth - 32}" height="65">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 15px; font-weight: bold; color: ${textDark}; line-height: 1.25; word-wrap: break-word; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">
                ${escapeXml(labelText)}
              </div>
            </foreignObject>
            
            <!-- Divider -->
            <line x1="16" y1="120" x2="${cardWidth - 16}" y2="120" stroke="${borderCard}" stroke-width="1"/>
            
            <!-- Description Block -->
            <foreignObject x="16" y="130" width="${cardWidth - 32}" height="${h - 145}">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', serif; font-size: 13px; line-height: 1.5; color: ${textMuted}; text-align: left; word-wrap: break-word; overflow: hidden;">
                ${escapeXml(item.description)}
              </div>
            </foreignObject>
          </g>
        `;
      })
      .join("\n");
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
  </defs>

  <!-- Background Canvas -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" stroke="#cbd5e1" stroke-width="2" rx="14"/>

  <!-- Wrapped Title & Subtitle Banner -->
  <g transform="translate(40, 30)">
    <foreignObject x="0" y="0" width="${width - 80}" height="75">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: 'Georgia', 'Garamond', serif;">
        <h1 style="margin: 0; font-size: 22px; font-weight: bold; color: ${primaryColor}; line-height: 1.2; word-wrap: break-word; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
          ${escapeXml(title)}
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: ${textMuted}; font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
          ${escapeXml(caption)}
        </p>
      </div>
    </foreignObject>
    <line x1="0" y1="85" x2="${width - 80}" y2="85" stroke="#0f172a" stroke-width="2"/>
  </g>

  <!-- Graphic Elements -->
  ${contentSvg}

  <!-- Footer Watermark -->
  <g transform="translate(40, ${height - 20})">
    <text x="0" y="0" font-family="'Georgia', serif" font-size="11" fill="#94a3b8" font-weight="600" letter-spacing="0.5">
      FIGURA EXPLICATIVA DE ALTA RESOLUÇÃO · EDIÇÃO EDITORIAL
    </text>
  </g>
</svg>`;

  fs.writeFileSync(filePath, svg, "utf-8");

  return {
    id: imageId,
    filePath,
    relativePath: `/data/output/images/${fileName}`,
    title,
    caption,
    width,
    height,
  };
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
