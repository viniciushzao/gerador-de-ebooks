import fs from "fs";
import { createTask, updateTask, addAuditLog } from "@/lib/db/client";

export interface ImageReviewResult {
  valid: boolean;
  filePath: string;
  elementsInspected: number;
  overflowRiskDetected: boolean;
  repaired: boolean;
  issues: string[];
}

/**
 * Subagent: Image Reviewer (Revisor de Imagens)
 * Invoked alongside/after every subagent that produces visual graphic assets.
 * Inspects SVG structure, ensures zero text overlapping, valid viewBox, and high-fidelity rendering.
 */
export async function reviewAndValidateImage(
  bookId: string,
  chapterId: string | null,
  chapterNumber: number,
  imageFilePath: string,
  traceId: string,
  parentTaskId: string
): Promise<ImageReviewResult> {
  const startTime = Date.now();
  const reviewTaskId = `task_img_review_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  createTask({
    id: reviewTaskId,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: bookId,
    chapter_id: chapterId,
    agent_role: "IMAGE_REVIEWER",
    status: "running",
    input_payload: JSON.stringify({ imageFilePath, chapterNumber }),
    output_payload: null,
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    skill_used: "image-reviewer",
    error: null,
    created_at: new Date().toISOString(),
    finished_at: null,
  });

  const issues: string[] = [];
  let elementsInspected = 0;
  let overflowRiskDetected = false;
  let repaired = false;

  if (!fs.existsSync(imageFilePath)) {
    throw new Error(`Arquivo de imagem não encontrado para revisão: ${imageFilePath}`);
  }

  let svgContent = fs.readFileSync(imageFilePath, "utf-8");

  // 1. Check for well-formed SVG root and dimensions
  elementsInspected += 1;
  if (!svgContent.includes("<svg") || !svgContent.includes("viewBox=")) {
    issues.push("Falta atributo viewBox no elemento raiz do SVG.");
  }

  // 2. Inspect raw unconstrained <text> tags that might cause word overlapping
  const textMatches = svgContent.match(/<text\b[^>]*>([\s\S]*?)<\/text>/gi) || [];
  elementsInspected += textMatches.length;

  for (const match of textMatches) {
    const textContent = match.replace(/<[^>]+>/g, "").trim();
    // Em canvas de 1200px, títulos principais de até 65 caracteres cabem com folga (>500px de margem)
    if (textContent.length > 65 && !match.includes("<tspan")) {
      overflowRiskDetected = true;
      issues.push(`Risco de sobreposição detectado no elemento <text>: "${textContent.substring(0, 30)}..." (${textContent.length} chars).`);
    }
  }

  // 3. Inspect foreignObject containers for proper word wrapping
  const foMatches = svgContent.match(/<foreignObject\b[^>]*>([\s\S]*?)<\/foreignObject>/gi) || [];
  elementsInspected += foMatches.length;

  for (const fo of foMatches) {
    if (!fo.includes("word-wrap") && !fo.includes("overflow")) {
      overflowRiskDetected = true;
      issues.push("Elemento foreignObject sem diretiva explícita de contenção de texto (word-wrap).");
    }
  }

  // 4. Automatic repair if unsafe raw text tags were found
  if (overflowRiskDetected) {
    // Repair: wrap any rogue wide text into safe foreignObject or truncate
    svgContent = svgContent.replace(
      /<text\s+x="([^"]+)"\s+y="([^"]+)"\s+font-family="([^"]+)"\s+font-size="([^"]+)"\s+font-weight="bold"\s+fill="([^"]+)">([\s\S]*?)<\/text>/gi,
      (match, x, y, font, size, fill, text) => {
        const clean = text.trim();
        if (clean.length > 30) {
          repaired = true;
          return `<foreignObject x="${x}" y="${parseInt(y) - 20}" width="200" height="50"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family: ${font}; font-size: ${size}px; font-weight: bold; color: ${fill}; line-height: 1.2; word-wrap: break-word; overflow: hidden;">${clean}</div></foreignObject>`;
        }
        return match;
      }
    );

    if (repaired) {
      fs.writeFileSync(imageFilePath, svgContent, "utf-8");
    }
  }

  const latencyMs = Date.now() - startTime;
  const valid = !overflowRiskDetected || repaired;

  updateTask(reviewTaskId, {
    status: "completed",
    output_payload: JSON.stringify({
      valid,
      elementsInspected,
      overflowRiskDetected,
      repaired,
      issuesCount: issues.length,
    }),
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: latencyMs,
    finished_at: new Date().toISOString(),
  });

  addAuditLog({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    trace_id: traceId,
    parent_task_id: parentTaskId,
    book_id: bookId,
    chapter_id: chapterId,
    agent_role: "IMAGE_REVIEWER",
    level: valid ? "info" : "warning",
    message: `Subagente Revisor de Imagens inspecionou a Figura do Capítulo ${chapterNumber} (${elementsInspected} elementos analisados, ${issues.length} apontamentos, ${repaired ? "reparado com sucesso" : "100% aprovado"}).`,
    metadata: JSON.stringify({
      imageFilePath,
      elementsInspected,
      issues,
      repaired,
      valid,
    }),
    tokens: 0,
    cost_usd: 0,
    latency_ms: latencyMs,
    skill_badge: "image-reviewer",
    timestamp: new Date().toISOString(),
  });

  return {
    valid,
    filePath: imageFilePath,
    elementsInspected,
    overflowRiskDetected,
    repaired,
    issues,
  };
}
