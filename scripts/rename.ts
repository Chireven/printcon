/**
 * Plugin Rename Script
 * 
 * This script renames a plugin's ID, name, and folder.
 * 
 * Usage: npm run plugin:rename <name> <newName>
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

    let currentId = process.argv[2];
    let newId = process.argv[3];

    if (!currentId) {
        currentId = await rl.question('Enter the current Plugin ID to rename: ');
    }

    if (!newId) {
        newId = await rl.question('Enter the new Plugin ID: ');
    }

    if (!currentId || !newId) {
        console.error('Error: Both current name and new name are required.');
        rl.close();
        process.exit(1);
    }

    currentId = currentId.trim();
    newId = newId.trim();

    try {
        const registryPath = path.join(process.cwd(), 'src', 'core', 'registry.json');
        if (!fs.existsSync(registryPath)) {
            throw new Error('Registry not found.');
        }

        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        const entryIndex = registry.findIndex((p: any) => p.id === currentId);

        if (entryIndex === -1) {
            throw new Error(`Plugin '${currentId}' not found in registry.`);
        }

        const pluginEntry = registry[entryIndex];
        const oldPath = path.join(process.cwd(), pluginEntry.path);

        // 1. Calculate new folder path
        const categoryDir = path.dirname(pluginEntry.path); // e.g. plugins/features
        const newRelativePath = path.join(categoryDir, newId).replace(/\\/g, '/');
        const newFullPath = path.join(process.cwd(), newRelativePath);

        if (fs.existsSync(newFullPath)) {
            throw new Error(`Target directory already exists: ${newRelativePath}`);
        }

        console.log(`[Rename] Renaming ${currentId} -> ${newId}`);

        // 2. Update Manifest
        const manifestPath = path.join(oldPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest.id = newId;
            // Update the display name if it matches the ID format (optional but helpful)
            if (manifest.name === currentId.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')) {
                manifest.name = newId.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            }
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            console.log(`[Rename] Manifest updated.`);
        }

        // 3. Rename Folder
        fs.renameSync(oldPath, newFullPath);
        console.log(`[Rename] Folder moved to ${newRelativePath}`);

        // 4. Update Registry
        pluginEntry.id = newId;
        pluginEntry.path = newRelativePath;
        // Also update display name in registry if it was auto-generated
        if (pluginEntry.name === currentId.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')) {
            pluginEntry.name = newId.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }

        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
        console.log(`[Rename] Registry updated.`);

        console.log(`\n[Success] Plugin '${currentId}' renamed to '${newId}' successfully.`);

        await EventHub.emit('PLUGIN_RENAMED', { oldId: currentId, newId: newId });

    } catch (error: any) {
        console.error(`\n[Failure] Rename failed: ${error.message}`);
        process.exit(1);
    } finally {
        rl.close();
        const { listPlugins } = await import('./list.js');
        await listPlugins();
    }
}

main();
