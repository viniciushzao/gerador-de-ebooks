const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'agents', 'publishing-metadata-generator.ts');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// 1. Remove margin_safety_inches
const idxMargin = lines.findIndex(l => l.includes('"margin_safety_inches"'));
if (idxMargin !== -1) {
  lines.splice(idxMargin, 1);
  console.log('Removed margin_safety_inches at line', idxMargin + 1);
}

// 2. Replace barcode_reservation_box
const idxBarcode = lines.findIndex(l => l.includes('"barcode_reservation_box"'));
if (idxBarcode !== -1) {
  lines.splice(idxBarcode, 5, 
    '          "barcode_area": {',
    '            "type": "empty_white_negative_space",',
    '            "position": "canto inferior da contracapa",',
    '            "instruction": "Área em branco puro totalmente livre de textos, linhas ou molduras, reservada para o código de barras. NÃO desenhar retângulo, linha ou etiqueta."',
    '          },'
  );
  console.log('Replaced barcode_reservation_box at line', idxBarcode + 1);
}

// 3. Remove width_inches
const idxWidth = lines.findIndex(l => l.includes('"width_inches"'));
if (idxWidth !== -1) {
  lines.splice(idxWidth, 1);
  console.log('Removed width_inches at line', idxWidth + 1);
}

// 4. Remove crease_lines
const idxCrease = lines.findIndex(l => l.includes('"crease_lines"'));
if (idxCrease !== -1) {
  lines.splice(idxCrease, 1);
  console.log('Removed crease_lines at line', idxCrease + 1);
}

// 5. Replace margin_safety in spine
const idxMarginSpine = lines.findIndex(l => l.includes('"margin_safety"'));
if (idxMarginSpine !== -1) {
  lines[idxMarginSpine] = '            "instruction": "Título verticalizado e centralizado ao longo da lombada contínua, sem linhas de dobra visíveis."';
  console.log('Replaced margin_safety at line', idxMarginSpine + 1);
}

// 6. Replace scale_calibration_indices
const idxScale = lines.findIndex(l => l.includes('"scale_calibration_indices"'));
if (idxScale !== -1) {
  lines[idxScale] = lines[idxScale].replace('"scale_calibration_indices"', '"minimal_geometric_accent"');
  if (lines[idxScale + 1] && lines[idxScale + 1].includes('Micro-marcadores de escala')) {
    lines[idxScale + 1] = '                "description": "Pequeno ponto ou traço geométrico abstrato discreto de precisão editorial, sem números e sem texto",';
  }
  console.log('Replaced scale_calibration_indices at line', idxScale + 1);
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Line-based prompt residual cleanup finished successfully!');
