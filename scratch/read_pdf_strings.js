import fs from 'fs';

const buffer = fs.readFileSync('./public/REGISTRO_SECUNDARIA_1_2024.pdf');
const str = buffer.toString('binary');

// Find all PDF literal strings enclosed in parentheses (text streams)
const matches = str.match(/\(([^\)\\]+)\)/g);
if (matches) {
  const uniqueStrings = Array.from(new Set(matches.map(s => s.slice(1, -1).trim()))).filter(s => s.length > 1);
  console.log("Extracted PDF Strings Sample:");
  console.log(uniqueStrings.slice(0, 150).join('\n'));
} else {
  console.log("No plain text strings found or stream is compressed.");
}
