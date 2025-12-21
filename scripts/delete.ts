/**
 * Plugin Deletion Script
 * 
 * This script identifies a plugin via its registration, removes the files from disk,
 * and clears the entry from the registry to ensure the system no longer attempts to load it.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventHub } from '../src/core/events';

async function main() {
    const pluginId = process.argv[2];

    if (!pluginId) {
        console.error('Error: Please provide a plugin ID to delete.');
        console.log('Usage: npm run plugin:delete <plugin-id>');
        process.exit(1);
    }

    try {
        const registryPath = path.join(process.cwd(), 'src', 'core', 'registry.json');

        if (!fs.existsSync(registryPath)) {
            console.error(`Error: Registry not found at ${registryPath}`);
            process.exit(1);
        }

        const content = fs.readFileSync(registryPath, 'utf8');
        let registry: any[];
        try {
            registry = JSON.parse(content);
        } catch (e) {
            console.error('Error: registry.json is malformed.');
            process.exit(1);
        }

        const pluginEntry = registry.find(p => p.id === pluginId);

        if (!pluginEntry) {
            console.warn(`\n[Info] Plugin ID '${pluginId}' not found in registry. Checking disk for orphans...`);

            // Fallback: Check for orphan on disk
            const categories = ['features', 'loggingProviders', 'logonproviders', 'printers', 'databaseProviders', 'storageProviders'];
            let foundOrphanPath = '';

            for (const cat of categories) {
                const candidatePath = path.join(process.cwd(), 'plugins', cat, pluginId);
                if (fs.existsSync(candidatePath)) {
                    foundOrphanPath = candidatePath;
                    break;
                }
            }

            if (foundOrphanPath) {
                console.log(`[Delete] Found orphan plugin at: ${foundOrphanPath}`);
                console.log(`[Delete] Removing files from disk...`);
                fs.rmSync(foundOrphanPath, { recursive: true, force: true });
                console.log(`\n[Success] Orphan plugin '${pluginId}' deleted physically.`);
                await EventHub.emit('system:plugin:delete', pluginId, 'success');
                return;
            } else {
                console.error(`\n[Failure] Error: Plugin ID '${pluginId}' not found in registry OR on disk.`);
                process.exit(1);
            }
        }

        // Step 0: Check for Protection Locks (Rule #23)
        if (pluginEntry.locked) {
            await EventHub.emit('system:plugin:delete', pluginId, 'failure');
            throw new Error(`Plugin ${pluginId} is LOCKED. Rule #23 Protection Active. Run unlock first.`);
        }

        const pluginPath = path.join(process.cwd(), pluginEntry.path);

        console.log(`[Delete] Identified plugin: ${pluginEntry.name}`);
        console.log(`[Delete] Installation path: ${pluginPath}`);

        // 1. Remove from disk
        if (fs.existsSync(pluginPath)) {
            console.log(`[Delete] Removing files from disk...`);
            fs.rmSync(pluginPath, { recursive: true, force: true });
        } else {
            console.warn(`[Warning] Plugin directory not found on disk at ${pluginPath}, proceeding to unregister.`);
        }

        // 2. Unregister from registry.json
        console.log(`[Delete] Unregistering from registry...`);
        const updatedRegistry = registry.filter(p => p.id !== pluginId);
        fs.writeFileSync(registryPath, JSON.stringify(updatedRegistry, null, 2));

        console.log(`\n[Success] Plugin '${pluginId}' has been deleted and unregistered.`);

        await EventHub.emit('system:plugin:delete', pluginId, 'success');
    } catch (error: any) {
        console.error(`\n[Failure] Deletion failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        const { listPlugins } = await import('./list.js');
        await listPlugins();
    }
}

main();
