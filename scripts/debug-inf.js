const fs = require('fs');
const path = require('path');

const targetDir = 'C:\\Windows\\INF';
const targetFile = 'ntprint.inf';

try {
    if (!fs.existsSync(targetDir)) {
        console.log(`Dir not found: ${targetDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(targetDir);
    const found = files.find(f => f.toLowerCase() === targetFile.toLowerCase());

    if (!found) {
        console.log(`${targetFile} not found in ${targetDir}`);
        process.exit(1);
    }

    const fullPath = path.join(targetDir, found);
    console.log(`Reading: ${fullPath}`);

    const buffer = fs.readFileSync(fullPath);
    let content = '';
    // Check BOM
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        content = buffer.toString('utf16le');
    } else {
        content = buffer.toString('utf8');
    }

    console.log('--- HEAD ---');
    console.log(content.slice(0, 500));

    console.log('\n--- STRINGS ---');
    const stringsIdx = content.toLowerCase().indexOf('[strings]');
    if (stringsIdx !== -1) {
        console.log(content.slice(stringsIdx, stringsIdx + 500));
    }

    console.log('\n--- MANUFACTURER ---');
    const mfgIdx = content.toLowerCase().indexOf('[manufacturer]');
    if (mfgIdx !== -1) {
        console.log(content.slice(mfgIdx, mfgIdx + 500));
    }

} catch (e) {
    console.error(e);
}
