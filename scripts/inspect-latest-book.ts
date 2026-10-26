import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { listBooks, getChapters, getAuditLogs } from "../lib/db/client";

async function inspect() {
  console.log("=== INSPEÇÃO DO BANCO E DO PDF ===");
  const books = listBooks();
  console.log("Total de livros no banco:", books.length);
  for (const b of books) {
    console.log(`- Livro ID: ${b.id}, Título: ${b.title}, Status: ${b.status}, PDF: ${b.pdf_path}`);
  }

  const pdfPath = "C:/Users/vihsp/Downloads/M_tricas_de_Marketing_conclusivo.pdf";
  if (fs.existsSync(pdfPath)) {
    console.log("\nEncontrado PDF em Downloads! Analisando...");
    const buf = fs.readFileSync(pdfPath);
    const data = await pdfParse(buf);
    console.log("Páginas:", data.numpages);
    console.log("Trecho com SVG/código:");
    const lines = data.text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("Decomposição") || lines[i].includes("<g transform") || lines[i].includes("DIMENSÃO")) {
        console.log(`Linha ${i}:`, lines.slice(Math.max(0, i - 5), i + 20).join("\n"));
        break;
      }
    }
  } else {
    console.log("PDF em downloads não encontrado.");
  }

  // Verificar capítulos no banco
  if (books.length > 0) {
    const lastBook = books[books.length - 1];
    const chapters = getChapters(lastBook.id);
    console.log(`\nCapítulos do último livro (${lastBook.id}):`, chapters.length);
    for (const c of chapters) {
      if (c.content_markdown.includes("<g transform") || c.content_markdown.includes("svg") || c.content_markdown.includes("```")) {
        console.log(`Capítulo ${c.chapter_number} tem tags ou code blocks!`);
      }
    }
  }
}

inspect().catch(console.error);
