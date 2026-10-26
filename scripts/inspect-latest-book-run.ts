import { listBooks, getChapters, getAuditLogs } from "../lib/db/client";

function inspectDb() {
  const books = listBooks().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  console.log("=== TOTAL BOOKS ===", books.length);
  for (const b of books.slice(0, 10)) {
    console.log({
      id: b.id,
      title: b.title,
      status: b.status,
      current_step: b.current_step,
      progress_percent: b.progress_percent,
      created_at: b.created_at,
      updated_at: b.updated_at,
      pdf_path: b.pdf_path,
    });
  }

  const latestBook = books[0];
  if (latestBook) {
    console.log("\n=== LATEST BOOK DETAILS ===", latestBook.id, latestBook.title);
    console.log("Status:", latestBook.status, "Progress:", latestBook.progress_percent, "Step:", latestBook.current_step);

    const chapters = getChapters(latestBook.id);
    console.log("\n=== CHAPTERS ===");
    for (const c of chapters) {
      console.log({
        num: c.chapter_number,
        title: c.title,
        status: c.status,
        words: c.actual_words,
        error: c.error_message,
      });
    }

    console.log("\n=== LAST 25 AUDIT LOGS ===");
    const logs = getAuditLogs(latestBook.id);
    for (const l of logs.slice(-25)) {
      console.log(`[${l.timestamp}] [${l.agent_role}] ${l.level}: ${l.message}`);
    }
  }
}

inspectDb();
