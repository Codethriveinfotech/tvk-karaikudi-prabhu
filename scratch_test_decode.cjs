const fs = require('fs');

const cp1252Map = {
  0x20AC: 0x80,
  0x201A: 0x82,
  0x0192: 0x83,
  0x201E: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02C6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8A,
  0x2039: 0x8B,
  0x0152: 0x8C,
  0x017D: 0x8E,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201C: 0x93,
  0x201D: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02DC: 0x98,
  0x2122: 0x99,
  0x0161: 0x9A,
  0x203A: 0x9B,
  0x0153: 0x9C,
  0x017E: 0x9E,
  0x0178: 0x9F
};

const filepath = 'd:/priyanga/codethrive/karaikudi/developments.html';
const contentStr = fs.readFileSync(filepath, 'utf8');

const bytes = [];
for (let i = 0; i < contentStr.length; i++) {
  const code = contentStr.charCodeAt(i);
  if (cp1252Map[code] !== undefined) {
    bytes.push(cp1252Map[code]);
  } else if (code < 256) {
    bytes.push(code);
  } else {
    // If it's a high code point (like a normal Unicode char that shouldn't have been double-encoded),
    // we should encode it back to UTF-8 bytes? Or keep it?
    // Let's see: if the file has normal English/symbols, it's < 256 anyway.
    // Let's encode the character as UTF-8 bytes if it's not double-encoded.
    const buf = Buffer.from(contentStr[i], 'utf8');
    for (let j = 0; j < buf.length; j++) {
      bytes.push(buf[j]);
    }
  }
}

const decodedStr = Buffer.from(bytes).toString('utf8');

console.log('--- TEST DECODED ---');
const spanIndex = decodedStr.indexOf('page-header-kicker">');
if (spanIndex !== -1) {
  console.log(decodedStr.substring(spanIndex, spanIndex + 250));
} else {
  console.log('Kicker span not found');
}
