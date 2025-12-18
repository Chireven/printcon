/**
 * Plugin Listing Script
 * 
 * This script reads the central registry and displays all installed plugins
 * in a formatted table. It also includes an "Auto-Recovery" feature to 
 * sync the registry with folders on disk.
 */

import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const registryPath = path.join(process.cwd(), 'src', 'core', 'registry.json');
    const pluginsDir = path.join(process.cwd(), 'plugins');

    // 1. Ensure registry exists
    let registry: any[] = [];
    if (fs.existsSync(registryPath)) {
        try {
            registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        } catch (e) {
            console.error('[Error] registry.json is malformed. Initializing empty.');
            registry = [];
        }
    }

    // 2. Auto-Recovery: Sync disk folders with registry
    console.log('[Sync] Checking for orphaned plugin folders...');
    const categories = ['features', 'logging', 'logonproviders'];
    let syncCount = 0;

    for (const cat of categories) {
        const catPath = path.join(pluginsDir, cat);
        if (!fs.existsSync(catPath)) continue;

        const folders = fs.readdirSync(catPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const folder of folders) {
            const pluginPath = path.join('plugins', cat, folder).replace(/\\/g, '/');
            const fullPluginPath = path.join(process.cwd(), pluginPath);
            const manifestPath = path.join(fullPluginPath, 'manifest.json');

            // If not in registry but folder exists
            if (!registry.some(p => p.path === pluginPath)) {
                if (fs.existsSync(manifestPath)) {
                    try {
                        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        console.log(`[Sync] Found unregistered plugin: ${manifest.id}. Adding...`);

                        registry.push({
                            id: manifest.id,
                            name: manifest.name,
                            version: manifest.version,
                            type: manifest.type,
                            path: pluginPath,
                            installedAt: new Date().toISOString(),
                            recovered: true
                        });
                        syncCount++;
                    } catch (e) {
                        console.warn(`[Warning] Could not read manifest for ${folder} at ${manifestPath}`);
                    }
                }
            }
        }
    }

    if (syncCount > 0) {
        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
        console.log(`[Sync] Successfully recovered ${syncCount} plugins.\n`);
    } else {
        console.log('[Sync] Registry is up to date.\n');
    }

    // 3. Display Table
    if (registry.length === 0) {
        console.log('[Info] No plugins are currently registered or found on disk.');
        return;
    }

    console.log('='.repeat(100));
    console.log(' INSTALLED PLUGINS'.padEnd(100));
    console.log('='.repeat(100));

    const header = [
        'ID'.padEnd(20),
        'VERSION'.padEnd(10),
        'TYPE'.padEnd(15),
        'NAME'.padEnd(25),
        'STATUS'
    ].join(' ');

    console.log(header);
    console.log('-'.repeat(100));

    for (const entry of registry) {
        let status = entry.recovered ? 'RECOVERED' : 'VERIFIED';

        const row = [
            entry.id.padEnd(20),
            entry.version.padEnd(10),
            entry.type.padEnd(15),
            entry.name.padEnd(25),
            status.padEnd(10)
        ].join(' ');

        console.log(row);
    }

    console.log('='.repeat(100));
    console.log(`Total Plugins: ${registry.length}\n`);
}

main().catch(err => {
    console.error('\nAn error occurred:', err);
    process.exit(1);
});
