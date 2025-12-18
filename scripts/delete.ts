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
            console.error(`\n[Failure] Error: Plugin ID '${pluginId}' not found in the registry.`);
            console.log('Available plugins:');
            registry.forEach(p => console.log(` - ${p.id} (${p.name})`));
            process.exit(1);
        }

        // Step 0: Check for Protection Locks (Rule #23)
        if (pluginEntry.locked) {
            console.error(`\n[Access Denied] Plugin ${pluginId} is LOCKED.`);
            console.error(`Status: Rule #23 Protection Active.`);
            console.log(`Usage: npm run plugin:unlock ${pluginId} to proceed.`);

            await EventHub.emit('PLUGIN_DELETED', pluginId, 'failure');
            return; // Exit gracefully to hit the finally block
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

        await EventHub.emit('PLUGIN_DELETED', pluginId);
    } catch (error: any) {
        console.error(`\n[Failure] Deletion failed: ${error.message}`);
    }
}

main();
