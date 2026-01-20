import type { IDatabaseProvider, ISqlParams } from '../lib/interfaces/database';
import path from 'path';
import { Logger } from './logger';

export interface DatabaseConfig {
    providerPlugin: string;
    providerConfig: {
        server?: string;
        database?: string;
        username?: string;
        password?: string;
        instance?: string;
        [key: string]: any;
    };
}

/**
 * Database Broker
 * 
 * Central service that routes database operations from plugins to the configured
 * database provider. Supports dynamic loading and variable resolution.
 */
export class DatabaseBroker {
    private static provider: IDatabaseProvider | null = null;
    private static initialized = false;

    /**
     * Initializes the database broker.
     */
    static async initialize(config: DatabaseConfig): Promise<void> {
        let { providerPlugin, providerConfig } = config;

        // Resolve Plugin ID from Variables if needed
        if (providerPlugin.startsWith('@')) {
            const { VariableService } = await import('./variables');
            const resolved = await VariableService.get<string>(providerPlugin.substring(1));
            Logger.info('databaseProvider', 'broker', `Resolved provider plugin: ${providerPlugin} -> ${resolved}`);
            providerPlugin = resolved;
        }

        Logger.info('databaseProvider', 'broker', `Initializing with provider: ${providerPlugin}`);

        try {
            // Resolve Variables in Config
            const keysToResolve = Object.keys(providerConfig).filter(k =>
                typeof providerConfig[k] === 'string' && providerConfig[k].startsWith('@')
            );

            if (keysToResolve.length > 0) {
                Logger.info('databaseProvider', 'broker', `Resolving variables for keys: ${keysToResolve.join(', ')}`);

                // Import VariableService dynamically
                const { VariableService } = await import('./variables');

                // Resolve all variables concurrently
                const resolutions = await Promise.all(keysToResolve.map(async (key) => {
                    const varKey = providerConfig[key].substring(1);
                    // We use a shorter timeout here because DB config is usually critical for startup
                    // But we can make it async background if needed. For now, strict await.
                    // Actually, per user request, we should enable full VariableService usage.
                    return {
                        key,
                        value: await VariableService.get<string>(varKey)
                    };
                }));

                resolutions.forEach(res => {
                    providerConfig[res.key] = res.value;
                });

                // TODO: Hot Reloading subscription could be added here similar to StorageBroker
            }

            await DatabaseBroker.setupProvider(providerPlugin, providerConfig);

        } catch (error: any) {
            Logger.error('databaseProvider', 'broker', `Failed to initialize provider: ${error.message}`);
            throw error; // Rule #1: Fail fast if infrastructure fails
        }
    }

    private static async setupProvider(providerPlugin: string, providerConfig: any) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const registry = require('./registry.json');
        const providerEntry = registry.find((p: any) => p.id === providerPlugin);

        if (!providerEntry) {
            throw new Error(
                `Database provider '${providerPlugin}' not found in plugin registry.`
            );
        }

        Logger.info('databaseProvider', 'broker', `Loading provider from: ${providerEntry.path}`);
        const fullPath = path.join(process.cwd(), providerEntry.path, (providerEntry.entry || 'index.ts'));

        // Use Jiti for runtime TypeScript loading (Consistent with loader.ts)
        // eslint-disable-next-line no-eval
        const createJiti = eval('require')('jiti');
        const jiti = createJiti(__filename);
        const providerModule = jiti(fullPath);

        // Factory convention: create[PascalCase]Provider
        const factoryName = `create${DatabaseBroker.toPascalCase(providerPlugin.replace('database-', ''))}Provider`;

        if (typeof providerModule[factoryName] === 'function') {
            DatabaseBroker.provider = providerModule[factoryName](providerConfig);
            DatabaseBroker.initialized = true;
            Logger.info('databaseProvider', 'broker', `Successfully initialized with ${providerPlugin}`);
        } else {
            throw new Error(
                `Database provider '${providerPlugin}' does not export factory function '${factoryName}'.`
            );
        }
    }

    public static getSchemaForPlugin(pluginId: string): string {
        DatabaseBroker.ensureInitialized();
        // Look up plugin type from registry
        // We need the registry here. It's safe to require it as it's JSON.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const registry = require('./registry.json');
        const plugin = registry.find((p: any) => p.id === pluginId);

        if (!plugin) {
            // Fallback for system or unknown?
            // If pluginId is 'system' or 'admin', maybe return 'dbo'?
            if (pluginId === 'system') return 'dbo';
            throw new Error(`Unknown plugin ID: ${pluginId}`);
        }

        // Schema Name Format: plg_<type>_<name>
        // Clean name (remove special chars if any)
        const cleanName = plugin.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanType = plugin.type.toLowerCase();

        return `plg_${cleanType}_${cleanName}`;
    }

    public static async query<T>(pluginId: string, query: string, params?: ISqlParams): Promise<T[]> {
        DatabaseBroker.ensureInitialized();

        // 1. Enforce strict isolation (Section 2.3)
        // Verify plugin cannot access sys_ tables (PrintCon System) or sys. views (SQL System)
        const lowerQuery = query.toLowerCase();
        if (pluginId !== 'system' && (lowerQuery.includes('sys_') || lowerQuery.includes('sys.') || lowerQuery.includes('information_schema'))) {
            throw new Error(`Security Violation: Plugin '${pluginId}' attempted to access restricted system tables.`);
        }

        // 2. Get Schema Scope (Optional usage for now, but available)
        const schema = DatabaseBroker.getSchemaForPlugin(pluginId);

        // We pass the schema to the provider if it supports custom scoping,
        // otherwise we just run the query (and trust the Regex for now).
        // ideally: return DatabaseBroker.provider!.query<T>(query, params, schema);

        return DatabaseBroker.provider!.query<T>(query, params);
    }

    public static async syncSchema(requirements: any, force: boolean = false): Promise<boolean> {
        DatabaseBroker.ensureInitialized();
        if (DatabaseBroker.provider!.syncSchema) {
            return DatabaseBroker.provider!.syncSchema(requirements, force);
        }
        return true; // Provider doesn't support sync, assume ok
    }

    private static ensureInitialized(): void {
        if (!DatabaseBroker.initialized || !DatabaseBroker.provider) {
            throw new Error('DatabaseBroker not initialized. Call initialize() during Core startup.');
        }
    }

    private static toPascalCase(str: string): string {
        return str
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }
}
