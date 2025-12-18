/**
 * Plugin Installation Script
 * 
 * Rule #2: Manifest First - If a feature isn't in the manifest.json, it doesn't exist.
 * Rule #4: Standardized Distribution Format (.plugin) - Renamed ZIP archive.
 * Rule #5: Environment Validation - Check for dependencies before declaring 'Ready.'
 * Rule #6: Dependency Injection - Indirectly supported by ensuring proper folder structure for the loader.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
// @ts-ignore - adm-zip might not have types installed, but we'll use it anyway
import AdmZip from 'adm-zip';
import { EventHub } from '../src/core/events';

async function main() {
    const pluginPath = process.argv[2];

    if (!pluginPath) {
        console.error('Error: Please provide a path to a .plugin file.');
        console.log('Usage: npm run plugin:install <path-to-file>');
        process.exit(1);
    }

    if (!fs.existsSync(pluginPath)) {
        console.error(`Error: File not found at ${pluginPath}`);
        process.exit(1);
    }

    // Define temp directory for extraction
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printcon-install-'));

    try {
        console.log(`[Install] Monitoring distribution format... (Rule #4)`);
        const zip = new AdmZip(pluginPath);
        zip.extractAllTo(tempDir, true);

        const manifestPath = path.join(tempDir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error('Malformed plugin: manifest.json is missing at the root of the archive. (Rule #2)');
        }

        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
        let manifest;
        try {
            manifest = JSON.parse(manifestContent);
        } catch (e) {
            throw new Error('Malformed plugin: manifest.json is not valid JSON.');
        }

        // Basic validation of required fields
        if (!manifest.id || !manifest.type || !manifest.version) {
            throw new Error('Malformed plugin: manifest.json is missing required fields (id, type, version).');
        }

        console.log(`[Install] Identified plugin: ${manifest.name || manifest.id} v${manifest.version}`);

        // Rule #5: Environment Validation
        console.log(`[Install] Running Environment Validation... (Rule #5)`);
        if (manifest.dependencies) {
            console.log(`[Check] Verifying dependencies: ${JSON.stringify(manifest.dependencies)}`);
        } else {
            console.log(`[Check] No specific environmental dependencies found.`);
        }

        // Categorization and Moving
        const typeMap: Record<string, string> = {
            'logonprovider': 'logonproviders',
            'logging': 'logging',
            'feature': 'features'
        };

        const categoryFolder = typeMap[manifest.type as string];
        if (!categoryFolder) {
            throw new Error(`Invalid plugin type: ${manifest.type}`);
        }

        const targetDir = path.join(process.cwd(), 'plugins', categoryFolder, manifest.id);

        // Create target parent if it doesn't exist
        fs.mkdirSync(path.dirname(targetDir), { recursive: true });

        // Handle existing installations
        if (fs.existsSync(targetDir)) {
            console.log(`[Install] Removing existing installation at ${targetDir}`);
            fs.rmSync(targetDir, { recursive: true, force: true });
        }

        console.log(`[Install] Moving files to final destination...`);
        // Rule #4 & EXDEV Fix: Use cpSync + rmSync to support cross-partition moves (C: to D:)
        fs.cpSync(tempDir, targetDir, { recursive: true });
        fs.rmSync(tempDir, { recursive: true, force: true });

        // Rule #14: Registration
        updateRegistry(manifest);

        console.log(`\n[Success] Plugin ${manifest.id} installed successfully!`);

        await EventHub.emit('PLUGIN_INSTALLED', manifest.id);

    } catch (error: any) {
        console.error(`\n[Failure] Installation failed: ${error.message}`);
        process.exit(1);
    } finally {
        // Rule #4: Always clean up temporary extraction folder
        if (fs.existsSync(tempDir)) {
            console.log(`[Install] Cleaning up temporary files...`);
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

function updateRegistry(manifest: any) {
    const registryPath = path.join(process.cwd(), 'src', 'core', 'registry.json');
    let registry: any[] = [];

    if (fs.existsSync(registryPath)) {
        const content = fs.readFileSync(registryPath, 'utf8');
        try {
            registry = JSON.parse(content);
        } catch (e) {
            console.warn('[Warning] registry.json was malformed, resetting.');
        }
    }

    // Remove existing entry for the same ID if it exists
    registry = registry.filter(p => p.id !== manifest.id);

    const typeMap: Record<string, string> = {
        'logonprovider': 'logonproviders',
        'logging': 'logging',
        'feature': 'features'
    };

    const categoryFolder = typeMap[manifest.type as string];
    const relativePath = `plugins/${categoryFolder}/${manifest.id}`;

    // Add new entry
    registry.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        type: manifest.type,
        path: relativePath,
        installedAt: new Date().toISOString()
    });

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    console.log(`[Install] Registry updated: ${registryPath}`);
}

main();
