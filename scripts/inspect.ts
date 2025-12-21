import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// @ts-ignore
import AdmZip from 'adm-zip';

async function main() {
    const pluginPath = process.argv[2];

    if (!pluginPath || !fs.existsSync(pluginPath)) {
        console.error(JSON.stringify({ error: 'File not found' }));
        process.exit(1);
    }

    try {
        const zip = new AdmZip(pluginPath);
        const manifestEntry = zip.getEntry('manifest.json');

        if (!manifestEntry) {
            console.error(JSON.stringify({ error: 'Missing manifest.json' }));
            process.exit(1);
        }

        const manifestContent = zip.readAsText(manifestEntry);
        const manifest = JSON.parse(manifestContent);

        console.log(JSON.stringify(manifest));
        process.exit(0);

    } catch (e: any) {
        console.error(JSON.stringify({ error: e.message }));
        process.exit(1);
    }
}

main().catch(e => {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
});
