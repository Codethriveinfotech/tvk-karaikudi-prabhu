const fs = require('fs');

// Read raw bytes
const rawBuf = fs.readFileSync('d:/priyanga/codethrive/karaikudi/developments.html');
const text = rawBuf.toString('utf8');

// The Tamil text in the file appears as Mojibake (double-encoded UTF-8)
// For example: à®¨à®¿ instead of நி
// This happened because: original UTF-8 bytes were read as Latin-1, giving those chars
// Fix: decode by treating each char's code point as a byte (reverse the double-encoding)

// Strategy: Replace the double-encoded sequences with correct Tamil
// We know the file bytes are actually correct UTF-8 raw bytes
// The view_file tool showed us Mojibake because it read them as Unicode codepoints

// Let's check: read raw bytes and decode properly
console.log('File size:', rawBuf.length);

// Test: find page-header-kicker span
const searchStr = Buffer.from('page-header-kicker">');
let pos = -1;
for (let i = 0; i < rawBuf.length - searchStr.length; i++) {
  let found = true;
  for (let j = 0; j < searchStr.length; j++) {
    if (rawBuf[i+j] !== searchStr[j]) { found = false; break; }
  }
  if (found) { pos = i; break; }
}
console.log('Found span at:', pos);

if (pos > 0) {
  // Find end of span content
  let end = pos + searchStr.length;
  while (end < rawBuf.length && rawBuf[end] !== 60) end++; // '<'
  const content = rawBuf.slice(pos + searchStr.length, end);
  console.log('Content bytes (hex):', content.slice(0,20).toString('hex'));
  console.log('Content as UTF-8:', content.toString('utf8'));
  console.log('Content as Latin-1:', content.toString('latin1'));
}
