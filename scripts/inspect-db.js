const fs = require('fs');

try {
  const content = fs.readFileSync('data/ebook_generator_db.json', 'utf8');
  console.log('Read JSON. Total length in chars:', content.length);
  
  // Extract "books": { ... }
  const booksIndex = content.indexOf('"books":');
  const chaptersIndex = content.indexOf('"chapters":');
  
  if (booksIndex !== -1 && chaptersIndex !== -1) {
    const booksStr = content.slice(booksIndex + 8, chaptersIndex).trim().replace(/,\s*$/, '');
    const books = JSON.parse(booksStr);
    const booksList = Object.values(books);
    console.log('Total books:', booksList.length);
    const lastBooks = booksList.slice(-3);
    console.log('LAST BOOKS:');
    for (const b of lastBooks) {
      console.log({
        id: b.id,
        title: b.title,
        status: b.status,
        current_step: b.current_step,
        progress_percent: b.progress_percent,
        error_message: b.error_message,
        created_at: b.created_at,
        updated_at: b.updated_at
      });
    }
  }

  // Also check tasks
  const tasksIndex = content.indexOf('"tasks":');
  const auditLogsIndex = content.indexOf('"auditLogs":');
  if (tasksIndex !== -1 && auditLogsIndex !== -1) {
    const tasksStr = content.slice(tasksIndex + 8, auditLogsIndex).trim().replace(/,\s*$/, '');
    const tasks = JSON.parse(tasksStr);
    const tasksList = Object.values(tasks);
    console.log('Total tasks:', tasksList.length);
    const lastTasks = tasksList.slice(-5);
    console.log('LAST TASKS:');
    for (const t of lastTasks) {
      console.log({
        id: t.id,
        role: t.agent_role,
        status: t.status,
        error: t.error,
        created_at: t.created_at,
        finished_at: t.finished_at
      });
    }
  }

  // Also check last audit logs
  if (auditLogsIndex !== -1) {
    const ragChunksIndex = content.indexOf('"ragChunks":');
    const logsStr = content.slice(auditLogsIndex + 12, ragChunksIndex !== -1 ? ragChunksIndex : undefined).trim().replace(/,\s*$/, '');
    const logs = JSON.parse(logsStr);
    const logsList = Object.values(logs);
    console.log('Total logs:', logsList.length);
    const lastLogs = logsList.slice(-6);
    console.log('LAST AUDIT LOGS:');
    for (const l of lastLogs) {
      console.log({
        agent: l.agent_role,
        level: l.level,
        message: l.message,
        timestamp: l.timestamp
      });
    }
  }

} catch (err) {
  console.error('Error:', err);
}
