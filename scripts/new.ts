/**
 * Plugin Scaffolding Script
 * 
 * Rule #2: Manifest First - If a feature isn't in the manifest.json, it doesn't exist.
 * Rule #6: Dependency Injection Only - Plugins must be passive and receive tools from the Core.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline/promises';
import { EventHub } from '../src/core/events';

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n--- PrintCon Plugin Generator ---');

    // Check for command line arguments: <type> <name>
    const argType = process.argv[2];
    const argName = process.argv[3];



    let typeInput = argType;
    if (!typeInput) {
        typeInput = await rl.question('Plugin Type (logonProvider, loggingProvider, feature, printers, databaseProvider, storageProvider): ');
    } else {
        console.log(`Plugin Type: ${typeInput}`);
    }

    let name = argName;
    if (!name) {
        name = await rl.question('Plugin Name (e.g. printer-status): ');
    } else {
        console.log(`Plugin Name: ${name}`);
    }

    const normalizedInput = typeInput.toLowerCase().trim();
    const typeMap: Record<string, string> = {
        'logonprovider': 'logonprovider',
        'loggingprovider': 'loggingProvider',
        'logging': 'loggingProvider', // alias
        'feature': 'feature',
        'printers': 'printers',
        'databaseprovider': 'databaseProvider',
        'storageprovider': 'storageProvider'
    };

    const type = typeMap[normalizedInput];

    if (!type) {
        console.error('Invalid plugin type. Must be: logonProvider, loggingProvider, feature, printers, databaseProvider, or storageProvider.');
        process.exit(1);
    }

    const baseDir = path.join(process.cwd(), 'plugins');
    const folderMap: Record<string, string> = {
        'logonprovider': 'logonproviders',
        'loggingProvider': 'loggingProviders',
        'feature': 'features',
        'printers': 'printers',
        'databaseProvider': 'databaseProviders',
        'storageProvider': 'storageProviders'
    };

    const targetDir = path.join(baseDir, folderMap[type], name);

    if (fs.existsSync(targetDir)) {
        console.error(`\nError: Plugin directory already exists at ${targetDir}`);
        process.exit(1);
    }

    console.log(`\nCreating plugin: ${name} (${type})...`);

    // Create folder structure
    fs.mkdirSync(targetDir, { recursive: true });

    // 1. Create manifest.json (Rule #2)
    const manifest = {
        id: name,
        name: name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        version: '1.0.0',
        type: type,
        coreVersion: '^1.0.0',
        requiredPermissions: [],
        entryPoints: {
            main: 'index.ts'
        }
    };

    fs.writeFileSync(
        path.join(targetDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    );

    // 2. Create index.ts (Rule #6)
    const indexContent = `/**
 * Plugin: ${manifest.name}
 *
 * Rule #6: Dependency Injection Only.
 * This plugin receives the PluginAPI from the Core during initialization.
 */

import { PluginInitializer } from '../../../src/core/types/plugin';

export const initialize: PluginInitializer = async (api) => {
  api.log('Info', 'Plugin ${name} initialized');
  console.log('Plugin ${name} initialized');
};
`;

    fs.writeFileSync(path.join(targetDir, 'index.ts'), indexContent);

    // 3. Register in registry.json
    updateRegistry(manifest, path.join('plugins', folderMap[type], name));

    console.log(`Success! Plugin ${name} generated successfully.`);
    console.log(`Location: ${targetDir}`);

    await EventHub.emit('system:plugin:create', name, 'success');

    rl.close();

    const { listPlugins } = await import('./list.js');
    await listPlugins();
}

/**
 * Updates the central registry.json
 */
function updateRegistry(manifest: any, relativePath: string) {
    const registryPath = path.join(process.cwd(), 'src', 'core', 'registry.json');
    let registry: any[] = [];

    if (fs.existsSync(registryPath)) {
        try {
            registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        } catch (e) {
            registry = [];
        }
    }

    // Check for duplicates
    if (registry.some(p => p.id === manifest.id)) {
        console.warn(`[Warning] Plugin ${manifest.id} already exists in registry. Skipping registration.`);
        return;
    }

    registry.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        type: manifest.type,
        path: relativePath.replace(/\\/g, '/'), // Normalize for cross-platform
        installedAt: new Date().toISOString()
    });

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    console.log(`[Registry] Registered ${manifest.id} at ${relativePath}`);
}

main().catch(async err => {
    console.error('\nAn error occurred:', err);
    try {
        const { listPlugins } = await import('./list.js');
        await listPlugins();
    } catch { }
    process.exit(1);
});
