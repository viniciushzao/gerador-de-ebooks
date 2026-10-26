import fs from "fs";
import { marked } from "marked";

function parseMarkdownWithProtectedFigures(markdown: string): string {
  if (!markdown) return "";
  const figures: string[] = [];
  const placeholderPrefix = "EDITORIAL_FIGURE_PLACEHOLDER_";

  // 1. Extrair figuras e substituir por placeholders simples
  const protectedMarkdown = markdown.replace(/<figure[\s\S]*?<\/figure>/gi, (match) => {
    const idx = figures.length;
    figures.push(match);
    return `\n\n${placeholderPrefix}${idx}\n\n`;
  });

  marked.setOptions({ gfm: true, breaks: false });

  // 2. O marked.parse roda APENAS no texto markdown (nunca toca no XML do SVG)
  let html = marked.parse(protectedMarkdown) as string;

  // 3. Restaurar as figuras no HTML final, substituindo qualquer <p>placeholder</p>
  for (let idx = 0; idx < figures.length; idx++) {
    const rawSvgFigure = figures[idx];
    const ph = `${placeholderPrefix}${idx}`;
    // Substitui <p>EDITORIAL_FIGURE_PLACEHOLDER_0</p> ou EDITORIAL_FIGURE_PLACEHOLDER_0
    const regex = new RegExp(`<p>\\s*${ph}\\s*<\\/p>|${ph}`, "g");
    html = html.replace(regex, `\n${rawSvgFigure}\n`);
  }

  return html;
}

async function testFix() {
  const execSummary = fs.readFileSync("scratch/debug_exec_summary.md", "utf-8");
  const fixedHtml = parseMarkdownWithProtectedFigures(execSummary);

  console.log("Fixed HTML has <svg:", fixedHtml.includes("<svg"));
  console.log("Fixed HTML has <pre><code>:", fixedHtml.includes("<pre><code>"));
  console.log("Fixed HTML has &lt;g transform:", fixedHtml.includes("&lt;g transform"));
  console.log("Fixed HTML has raw <g transform:", fixedHtml.includes("<g transform"));

  fs.writeFileSync("scratch/debug_fixed_parsed.html", fixedHtml);
  console.log("Saved fixed HTML to scratch/debug_fixed_parsed.html");
}

testFix().catch(console.error);
