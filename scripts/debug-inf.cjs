const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Windows\\INF';
const files = fs.readdirSync(targetDir);
const found = files.find(f => f.toLowerCase() === 'ntprint.inf');
if (!found) process.exit(1);

const fullPath = path.join(targetDir, found);
const buffer = fs.readFileSync(fullPath);
let content = '';
if (buffer[0] === 0xFF && buffer[1] === 0xFE) content = buffer.toString('utf16le');
else content = buffer.toString('utf8');

const regex = /^"(\{[0-9a-fA-F-]{36}\})"\s*=/gm;
let match;
const guids = new Set();
while ((match = regex.exec(content)) !== null) {
    guids.add(match[1]);
}

console.log('--- FOUND GUIDS ---');
Array.from(guids).forEach(g => console.log(g));

console.log('--- CONTENT SAMPLE FOR GUID ---');
// Print context for first GUID
if (guids.size > 0) {
    const first = Array.from(guids)[0];
    const idx = content.indexOf(first);
    if (idx !== -1) {
        console.log(content.slice(Math.max(0, idx - 100), idx + 200));
    }
}
