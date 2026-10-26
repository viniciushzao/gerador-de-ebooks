const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = [
    'Você é um Diretor de Arte Editorial para capas de livros de alta distinção internacional (estilo Penguin Press, Gestalten, MIT Press).',
    'O livro é: "Motores de Combustão Interna: Entenda o Básico".',
    '',
    'DIRETRIZ ESTÉTICA OBRIGATÓRIA SOLICITADA PELO AUTOR:',
    'Uma COMBINAÇÃO PERFEITA de dois estilos que não caminham separados:',
    '1. Linha Técnica Estilizada (Blueprint Editorial): Desenho técnico limpo, preciso e estilizado do mecanismo ou objeto central do livro (ex: contorno preciso em corte do cilindro, coroa do pistão, anéis, válvulas e câmara em traços finos de 1.0pt a 1.5pt).',
    '2. Linhas de Fluxo Orgânicas e Dinâmicas: Ondas contínuas e fluidas de energia, calor, vórtice de combustão e dinâmica de fluidos/termodinâmica que atravessam, emergem ou envolvem a estrutura mecânica em curvas Bézier harmônicas e planos translúcidos com linearGradient.',
    '',
    'REGRAS TÉCNICAS DO SVG:',
    '- O desenho deve caber dentro de um viewBox "0 0 470 470" (coordenadas entre 20 e 440).',
    '- ZERO TEXTO, ZERO NÚMEROS, ZERO COTAS, ZERO RÉGUAS.',
    '- Fundo transparente/branco (será renderizado sobre fundo branco #ffffff).',
    '- Cores: destaque em âmbar/cobre/fogo (#b45309, #d97706, #ea580c), contraste em ardósia/azul técnico (#0f172a, #0284c7, #334155) e linhas de apoio suaves.',
    '- Retorne APENAS um objeto JSON com:',
    '{',
    '  "concept": "explicação concisa da fusão técnica + orgânica",',
    '  "svg": "código SVG interno (começando por <defs>...</defs><g>...</g>)"',
    '}'
  ].join('\n');

  console.log('Enviando prompt ao Gemini...');
  const res = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' }
  });

  const parsed = JSON.parse(res.response.text());
  console.log('Conceito:', parsed.concept);
  console.log('Tamanho do SVG:', parsed.svg.length);
  fs.writeFileSync('scripts/sample_generated_svg.html', `
    <html>
      <body style="background: #ffffff; display: flex; align-items: center; justify-content: center; height: 100vh;">
        <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
          <svg viewBox="0 0 470 470" width="470" height="470" xmlns="http://www.w3.org/2000/svg">
            ${parsed.svg}
          </svg>
        </div>
      </body>
    </html>
  `);
  console.log('Salvo em scripts/sample_generated_svg.html');
}

run().catch(console.error);
