import { getBook, getChapters } from "../lib/db/client";
import fs from "fs";

async function checkBook() {
  const bookId = "book_1788140802073_frrcnn";
  const book = getBook(bookId);
  if (!book) {
    console.log("Book not found");
    return;
  }
  console.log("Book Title:", book.title);
  console.log("Executive Summary Length:", book.executive_summary?.length);
  if (!fs.existsSync("scratch")) fs.mkdirSync("scratch", { recursive: true });
  fs.writeFileSync("scratch/debug_exec_summary.md", book.executive_summary || "");

  const chapters = getChapters(bookId);
  console.log("Total chapters:", chapters.length);
  for (const c of chapters) {
    fs.writeFileSync(`scratch/debug_chap_${c.chapter_number}.md`, c.content_markdown || "");
    console.log(`Chap ${c.chapter_number}: ${c.title}, Words: ${c.actual_words}`);
  }
}

checkBook().catch(console.error);
