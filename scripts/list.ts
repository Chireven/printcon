/**
 * Plugin Listing Script
 * 
 * This script reads the central registry and displays all installed plugins
 * in a formatted table. It also includes an "Auto-Recovery" feature to 
 * sync the registry with folders on disk.
 */

import * as fs from 'fs';
import * as path from 'path';

import { fileURLToPath } from 'url';

export async function listPlugins() {
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
    const categories = ['features', 'logging', 'logonproviders', 'printers', 'databaseProviders'];
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

    const col = {
        id: 20,
        ver: 10,
        type: 18,
        name: 25,
        lock: 8,
        stat: 12
    };

    const colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
        dim: '\x1b[2m',
        cyan: '\x1b[36m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m',
        magenta: '\x1b[35m',
        blue: '\x1b[34m',
    };

    const totalWidth = (col.id + 2) + (col.ver + 2) + (col.type + 2) + (col.name + 2) + (col.lock + 2) + (col.stat + 2) + 5;

    const drawColorLine = (left: string, mid: string, right: string, sep: string) => {
        return colors.blue + left +
            '─'.repeat(col.id + 2) + sep +
            '─'.repeat(col.ver + 2) + sep +
            '─'.repeat(col.type + 2) + sep +
            '─'.repeat(col.name + 2) + sep +
            '─'.repeat(col.lock + 2) + sep +
            '─'.repeat(col.stat + 2) + right + colors.reset;
    };

    const title = ' INSTALLED PLUGINS ';
    const titlePadding = Math.floor((totalWidth - title.length) / 2);
    const centeredTitle = ' '.repeat(titlePadding) + colors.bright + colors.cyan + title + colors.reset + ' '.repeat(totalWidth - title.length - titlePadding);

    console.log('\n' + colors.blue + '┌' + '─'.repeat(totalWidth) + '┐' + colors.reset);
    console.log(colors.blue + '│' + colors.reset + centeredTitle + colors.blue + '│' + colors.reset);
    console.log(drawColorLine('├', '┬', '┤', '┬'));

    const header = colors.blue + '│ ' + colors.reset +
        colors.bright + colors.cyan + 'ID'.padEnd(col.id) + colors.reset + colors.blue + ' │ ' + colors.reset +
        colors.bright + colors.cyan + 'VERSION'.padEnd(col.ver) + colors.reset + colors.blue + ' │ ' + colors.reset +
        colors.bright + colors.cyan + 'TYPE'.padEnd(col.type) + colors.reset + colors.blue + ' │ ' + colors.reset +
        colors.bright + colors.cyan + 'NAME'.padEnd(col.name) + colors.reset + colors.blue + ' │ ' + colors.reset +
        colors.bright + colors.cyan + 'LOCKED'.padEnd(col.lock) + colors.reset + colors.blue + ' │ ' + colors.reset +
        colors.bright + colors.cyan + 'STATUS'.padEnd(col.stat) + colors.reset + colors.blue + ' │' + colors.reset;

    console.log(header);
    console.log(drawColorLine('├', '┼', '┤', '┼'));

    for (const entry of registry) {
        const isLocked = !!entry.locked;
        const lockedText = isLocked ? colors.red + 'YES'.padEnd(col.lock) + colors.reset : colors.green + 'NO'.padEnd(col.lock) + colors.reset;

        const isRecovered = !!entry.recovered;
        const statusText = isRecovered ? colors.yellow + 'RECOVERED'.padEnd(col.stat) + colors.reset : colors.green + 'VERIFIED'.padEnd(col.stat) + colors.reset;

        let typeColor = colors.reset;
        if (entry.type === 'printers') typeColor = colors.magenta;
        else if (entry.type === 'logging') typeColor = colors.blue;
        else if (entry.type === 'logonprovider') typeColor = colors.cyan;
        else if (entry.type === 'feature') typeColor = colors.yellow;
        else if (entry.type === 'databaseProvider') typeColor = colors.red;

        const row = colors.blue + '│ ' + colors.reset +
            colors.bright + entry.id.substring(0, col.id).padEnd(col.id) + colors.reset + colors.blue + ' │ ' + colors.reset +
            entry.version.substring(0, col.ver).padEnd(col.ver) + colors.blue + ' │ ' + colors.reset +
            typeColor + entry.type.substring(0, col.type).padEnd(col.type) + colors.reset + colors.blue + ' │ ' + colors.reset +
            entry.name.substring(0, col.name).padEnd(col.name) + colors.blue + ' │ ' + colors.reset +
            lockedText + colors.blue + ' │ ' + colors.reset +
            statusText + colors.blue + ' │' + colors.reset;

        console.log(row);
    }

    console.log(drawColorLine('└', '┴', '┘', '┴'));
    console.log(` ${colors.dim}Total Plugins: ${registry.length}${colors.reset}\n`);
}

// Run if called directly
if (import.meta.url.startsWith('file:') && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    listPlugins().catch(err => {
        console.error('\nAn error occurred:', err);
        process.exit(1);
    });
}
