const fs = require('fs');

const content = fs.readFileSync('data/ebook_generator_db.json', 'utf8');
const auditLogsIndex = content.indexOf('"auditLogs":');
const ragChunksIndex = content.indexOf('"ragChunks":');
const logsStr = content.slice(auditLogsIndex + 12, ragChunksIndex !== -1 ? ragChunksIndex : undefined).trim().replace(/,\s*$/, '');
const logs = JSON.parse(logsStr);

const bookLogs = Object.values(logs).filter(l => l.book_id === 'book_1788724548697_ta7xoh');
console.log(`Found ${bookLogs.length} logs for book_1788724548697_ta7xoh`);
for (const l of bookLogs) {
  console.log(`[${l.timestamp}] [${l.agent_role}] ${l.message}`);
}
