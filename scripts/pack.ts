/**
 * Plugin Packaging Script
 * 
 * Rule #2: Manifest First - Verify manifest.json exists before packing.
 * Rule #14: Standardized Distribution Format (.plugin) - Export as renamed ZIP.
 * Rule #15: File Naming - [plugin-id]-[version].plugin and handle force overwrite.
 */

import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import AdmZip from 'adm-zip';
import { EventHub } from '../src/core/events';

async function main() {
    const pluginId = process.argv[2];
    const force = process.argv.includes('--force');

    if (!pluginId) {
        console.error('Error: Please provide a plugin ID to pack.');
        console.log('Usage: npm run plugin:pack <plugin-id> [--force]');
        process.exit(1);
    }

    // Find the plugin folder
    const searchDirs = ['features', 'loggingProviders', 'logonproviders', 'printers', 'databaseProviders', 'storageProviders'];
    let pluginSourceDir = '';

    for (const dir of searchDirs) {
        const potentialPath = path.join(process.cwd(), 'plugins', dir, pluginId);
        if (fs.existsSync(potentialPath)) {
            pluginSourceDir = potentialPath;
            break;
        }
    }

    if (!pluginSourceDir) {
        console.error(`Error: Plugin with ID '${pluginId}' not found in /plugins subdirectories.`);
        process.exit(1);
    }

    // Rule #2: Verify manifest.json exists
    const manifestPath = path.join(pluginSourceDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.error(`Error: manifest.json not found in ${pluginSourceDir}. (Rule #2)`);
        process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const version = manifest.version || '1.0.0';
    const outFileName = `${pluginId}-${version}.plugin`;
    const distDir = path.join(process.cwd(), 'dist', 'plugins');
    const outPath = path.join(distDir, outFileName);

    // Rule #15: Handle force parameter
    if (fs.existsSync(outPath) && !force) {
        console.error(`Error: File ${outFileName} already exists in /dist/plugins.`);
        console.log('Use --force to overwrite.');
        process.exit(1);
    }

    // Ensure dist directory exists
    fs.mkdirSync(distDir, { recursive: true });

    console.log(`[Pack] Packing plugin '${pluginId}' v${version}...`);

    try {
        const zip = new AdmZip();
        zip.addLocalFolder(pluginSourceDir);
        zip.writeZip(outPath);

        console.log(`\n[Success] Plugin packed successfully!`);
        console.log(`Location: ${outPath}`);
        console.log(`\n[Tip] You can now share this .plugin file with a teammate for installation using:`);
        console.log(`npm run plugin:install ${outPath}`);

        await EventHub.emit('system:plugin:pack', pluginId, 'success');
    } catch (error: any) {
        console.error(`\n[Failure] Packaging failed: ${error.message}`);
        process.exit(1);
    } finally {
        const { listPlugins } = await import('./list.js');
        await listPlugins();
    }
}

main();
