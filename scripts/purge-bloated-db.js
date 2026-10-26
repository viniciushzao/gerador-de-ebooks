const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'ebook_generator_db.json');

console.log('Iniciando limpeza e saneamento de data/ebook_generator_db.json...');
const initialStat = fs.statSync(dbPath);
console.log(`Tamanho inicial: ${(initialStat.size / (1024 * 1024)).toFixed(2)} MB (${initialStat.size} bytes)`);

const raw = fs.readFileSync(dbPath, 'utf8');
const state = JSON.parse(raw);

const chunksCount = Object.keys(state.ragChunks || {}).length;
console.log(`Encontrados ${chunksCount} chunks no repositório JSON.`);

// Todos os chunks e seus embeddings de 768 dimensões já estão indexados de forma binária no SQLite WAL
// Zerando a coleção de chunks legados pesados do JSON
state.ragChunks = {};

// Serializar sem indentação formatada de 48MB
const cleanData = JSON.stringify(state);
fs.writeFileSync(dbPath, cleanData, 'utf8');

const finalStat = fs.statSync(dbPath);
console.log(`Tamanho final após limpeza: ${(finalStat.size / 1024).toFixed(2)} KB (${finalStat.size} bytes)`);
const reduction = ((1 - finalStat.size / initialStat.size) * 100).toFixed(2);
console.log(`Redução de tamanho obtida: ${reduction}%!`);
