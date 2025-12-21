import path from 'path';
import fs from 'fs';
import semver from 'semver';
import { PluginAPI } from './types/plugin';
import { EventHub } from './events';
import { VariableService } from './variables';
import { Logger } from './logger';
import registryData from './registry.json';
import packageJson from '../../package.json';
import { InitializationTimeoutError, CoreVersionMismatchError } from './errors';

interface PluginEntry {
    id: string;
    path: string;
    entry?: string;
    type: string;
    active: boolean;
}

const activePlugins: PluginEntry[] = registryData.filter(p => p.active !== false) as unknown as PluginEntry[];
let isLoaded = false;
const INIT_TIMEOUT_MS = 30000; // 30s Rule #1

export async function loadPlugins() {
    if (isLoaded) return;
    Logger.system(`Initializing plugins (Core v${packageJson.version})...`);

    for (const plugin of activePlugins) {
        try {
            const pluginDir = path.join(process.cwd(), plugin.path);
            const entryPath = path.join(pluginDir, plugin.entry || 'index.ts');
            const manifestPath = path.join(pluginDir, 'manifest.json');

            Logger.info('loader', 'core', `Loading (${plugin.type}): ${plugin.id}`);

            // 1. Version Compatibility Check (Rule #2)
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

                if (manifest.requiredCoreVersion) {
                    if (!semver.satisfies(packageJson.version, manifest.requiredCoreVersion)) {
                        throw new CoreVersionMismatchError(plugin.id, manifest.requiredCoreVersion, packageJson.version);
                    }
                }
            }

            // Load Module
            // eslint-disable-next-line no-eval
            const createJiti = eval('require')('jiti');
            const jiti = createJiti(__filename);
            const pluginModule = jiti(entryPath);

            if (typeof pluginModule.initialize === 'function') {
                Logger.info('loader', 'core', `Initializing plugin: ${plugin.id}`);

                // Prepare API
                const scopedApi = createScopedApi(plugin);

                // 2. Watchdog Timer (Rule #1)
                const initPromise = (async () => {
                    // DB Sync Logic (Moved inside to be covered by timeout)
                    await handleDatabaseSync(plugin, pluginDir);
                    await pluginModule.initialize(scopedApi);
                })();

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new InitializationTimeoutError(plugin.id, INIT_TIMEOUT_MS)), INIT_TIMEOUT_MS);
                });

                await Promise.race([initPromise, timeoutPromise]);

                Logger.info('loader', 'core', `Plugin mounted: ${plugin.id}`);
                EventHub.emit('PLUGIN_MOUNTED', plugin.id, 'success', { id: plugin.id, type: plugin.type });
            }
        } catch (e: any) {
            Logger.error('loader', 'core', `Failed to load ${plugin.id}`, e);

            // Update Status
            const { SystemStatus } = await import('./system-status');
            SystemStatus.update(plugin.id, [
                { label: 'Status', value: 'Failed to Load', severity: 'error' },
                { label: 'Error', value: e.message, severity: 'error' }
            ]);

            EventHub.emit('PLUGIN_FAILED', plugin.id, 'failure', { message: e.message });
        }
    }

    isLoaded = true;
    Logger.system('Initialization complete.');
}

// Helper: Database Sync Logic
async function handleDatabaseSync(plugin: PluginEntry, pluginDir: string) {
    const manifestPath = path.join(pluginDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        if (manifest.database) {
            Logger.info('loader', 'core', `Verifying schema for ${plugin.id}...`);
            const { DatabaseBroker } = await import('./database-broker');
            const dbConfigModule = await import('../config/database.json');
            const dbConfig = dbConfigModule.default || dbConfigModule;

            // Ensure Broker is ready
            await DatabaseBroker.initialize(dbConfig as any);

            console.log(`[Loader] Syncing Schema for ${plugin.id}...`);
            const inSync = await DatabaseBroker.syncSchema(manifest.database, false);
            console.log(`[Loader] ${plugin.id} inSync: ${inSync}`);

            if (!inSync) {
                Logger.error('loader', 'core', `SCHEMA MISMATCH for ${plugin.id}.`);

                // Update System Status for persistence
                const { SystemStatus } = await import('./system-status');

                console.log(`[Loader] Writing mismatch status for ${plugin.id}...`);
                SystemStatus.update(plugin.id, [
                    { label: 'Database', value: 'Schema Mismatch', severity: 'error' },
                    { label: 'Action', value: 'Review Required', severity: 'warning' }
                ]);
                console.log(`[Loader] Status written.`);

                // Use EventHub to notify UI
                EventHub.emit('SYSTEM_ALERT', plugin.id, 'failure', {
                    title: 'Database Schema Mismatch',
                    message: `Schema mismatch for ${plugin.id}.`
                });
            } else {
                Logger.info('loader', 'core', `Schema verified for ${plugin.id}.`);
            }
        }
    }
}

// Helper: API Factory
function createScopedApi(plugin: PluginEntry): PluginAPI {
    return {
        events: {
            emit: (event, payload) => EventHub.emit(event, plugin.id, 'success', payload),
            on: (event, callback) => EventHub.on(event, callback)
        },
        log: (severity, message) => {
            if (severity === 'Error') Logger.error(plugin.type, plugin.id, message);
            else Logger.info(plugin.type, plugin.id, message);
        },
        execute: async () => null, // Placeholder
        storage: {
            write: async (rel, buf) => (await import('./storage-broker')).StorageBroker.write(rel, buf),
            read: async (rel) => (await import('./storage-broker')).StorageBroker.read(rel),
            exists: async (rel) => (await import('./storage-broker')).StorageBroker.exists(rel),
            delete: async (rel) => (await import('./storage-broker')).StorageBroker.delete(rel),
            list: async (pre) => (await import('./storage-broker')).StorageBroker.list(pre)
        },
        variables: {
            publish: (key, val) => VariableService.publish(plugin.id, key, val),
            get: (key) => VariableService.get(key)
        },
        database: {
            query: async (q, p) => (await import('./database-broker')).DatabaseBroker.query(plugin.id, q, p)
        }
    };
}
