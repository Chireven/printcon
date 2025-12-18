/**
 * Plugin Scaffolding Script
 * 
 * Rule #2: Manifest First - If a feature isn't in the manifest.json, it doesn't exist.
 * Rule #6: Dependency Injection Only - Plugins must be passive and receive tools from the Core.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline/promises';
import { emitSystemEvent } from '../src/core/events';

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\n--- PrintCon Plugin Generator ---');

    const name = await rl.question('Plugin Name (e.g. printer-status): ');
    const typeInput = await rl.question('Plugin Type (logonprovider, logging, feature): ');

    const type = typeInput.toLowerCase().trim();

    if (!['logonprovider', 'logging', 'feature'].includes(type)) {
        console.error('Invalid plugin type. Must be: logonprovider, logging, or feature.');
        process.exit(1);
    }

    const baseDir = path.join(process.cwd(), 'plugins');
    const typeMap: Record<string, string> = {
        'logonprovider': 'logonproviders',
        'logging': 'logging',
        'feature': 'features'
    };

    const targetDir = path.join(baseDir, typeMap[type], name);

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

    console.log(`Success! Plugin ${name} generated successfully.`);
    console.log(`Location: ${targetDir}`);

    await emitSystemEvent('PLUGIN_CREATED', name);

    rl.close();
}

main().catch(err => {
    console.error('\nAn error occurred:', err);
    process.exit(1);
});
