import path from 'path';
import fs from 'fs';
import { PluginAPI, PluginInitializer } from './types/plugin';
import { EventHub } from './events';
import registryData from './registry.json';

interface PluginEntry {
    id: string;
    path: string;
    entry: string;
    type: string;
    active: boolean;
}

// Active plugin registry
const activePlugins: PluginEntry[] = registryData.filter(p => p.active) as PluginEntry[];

let isLoaded = false;

export async function loadPlugins() {
    if (isLoaded) return;
    console.log('[Loader] Initializing plugins...');

    const api: PluginAPI = {
        events: {
            emit: (event, pluginId, status, payload) => {
                EventHub.emit(event, pluginId, status, payload);
            },
            on: (event, callback) => {
                EventHub.on(event, callback);
            }
        },
        logger: {
            info: (msg, pluginId) => console.log(`[INFO][${pluginId}] ${msg}`),
            error: (msg, pluginId) => console.error(`[ERROR][${pluginId}] ${msg}`)
        }
    };

    for (const plugin of activePlugins) {
        try {
            // Construct absolute path
            // Construct absolute path
            // Note: plugin.path already includes 'plugins/' prefix from registry
            const pluginDir = path.join(process.cwd(), plugin.path);
            const entryPath = path.join(pluginDir, plugin.entry || 'index.ts');

            console.log(`[Loader] Loading (Runtime): ${entryPath}`);

            // Bypass Turbopack static analysis using eval('require')
            // This is necessary because Next.js tries to bundle dynamic imports deterministically
            // eslint-disable-next-line no-eval
            const pluginModule = eval('require')(entryPath);

            if (typeof pluginModule.initialize === 'function') {
                console.log(`[Loader] Initializing plugin: ${plugin.id}`);
                // Fix: Pass api as any to avoid runtime type checks if types aren't perfect in require
                await (pluginModule.initialize as any)(api);
                console.log(`[Loader] Loaded ${plugin.id}`);

                // Broadcast lifecycle event
                EventHub.emit('PLUGIN_MOUNTED', 'system', 'success', { pluginId: plugin.id });
            }
        } catch (e: any) {
            console.error(`[Loader] Failed to load ${plugin.id}:`, e.message);
        }
    }

    isLoaded = true;
    console.log('[Loader] Initialization complete.');
}
