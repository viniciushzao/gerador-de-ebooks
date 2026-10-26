const fs = require('fs');
const db = JSON.parse(fs.readFileSync('data/ebook_generator_db.json', 'utf-8'));
const chapters = Object.values(db.chapters || {});

console.log('Total Chapters in DB:', chapters.length);

for (const ch of chapters) {
  const figures = (ch.content_markdown || '').match(/<figure[\s\S]*?<\/figure>/gi) || [];
  console.log(`\n=== Chapter ${ch.chapter_number}: ${ch.title} ===`);
  console.log('Figures count:', figures.length);
  figures.forEach((f, idx) => {
    console.log(`--- Figure ${idx + 1} ---`);
    console.log(f.substring(0, 300) + '...');
    const srcMatch = f.match(/src="([^"]+)"/);
    if (srcMatch) {
      console.log('Src length:', srcMatch[1].length);
      console.log('Src preview:', srcMatch[1].substring(0, 100));
      if (srcMatch[1].startsWith('data:image/svg+xml;base64,')) {
        const b64 = srcMatch[1].replace('data:image/svg+xml;base64,', '');
        const decoded = Buffer.from(b64, 'base64').toString('utf-8');
        console.log('Decoded SVG starts with:', decoded.substring(0, 150));
        console.log('Decoded SVG valid tags:', decoded.includes('<svg') && decoded.includes('</svg>'));
      }
    } else {
      console.log('NO SRC FOUND in figure tag!');
    }
  });
}
