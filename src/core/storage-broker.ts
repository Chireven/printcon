import type { IStorageProvider } from './types/storage';
import path from 'path';

/**
 * Storage Broker
 * 
 * Central service that routes storage operations from plugins to the configured
 * storage provider. Uses the plugin registry for dynamic provider loading,
 * enabling true plugin extensibility without Core code changes.
 */
export class StorageBroker {
    private static provider: IStorageProvider | null = null;
    private static initialized = false;

    /**
     * Initializes the storage broker with the configured provider.
     * Called during Core startup.
     * 
     * @param config - Storage configuration specifying provider and settings
     */
    static async initialize(config: StorageConfig): Promise<void> {
        // Idempotency check? 
        // We might want to allow re-initialization for hot-swapping, 
        // so we check if it's the SAME config, but here just assume re-init is allowed if called explicitly.
        // Actually, if we are called from startup, we want to run.
        // If we are called slightly later, valid.

        let { providerPlugin, providerConfig } = config;

        console.log(`[StorageBroker] Initializing with provider: ${providerPlugin}`);

        try {
            // Handle Variable Resolution for repositoryPath
            if (providerConfig.repositoryPath && providerConfig.repositoryPath.startsWith('@')) {
                const variableKey = providerConfig.repositoryPath.substring(1); // Remove '@'
                console.log(`[StorageBroker] Resolving dynamic path (BACKGROUND): ${variableKey}`);

                // Start background resolution
                (async () => {
                    try {
                        // Import VariableService dynamically
                        const { VariableService } = await import('./variables');
                        const { EventHub } = await import('./events');

                        // Wait for the variable (long timeout allowed in background)
                        const resolvedPath = await VariableService.get<string>(variableKey, 30000); // 30s timeout
                        console.log(`[StorageBroker] Resolved ${variableKey} -> ${resolvedPath}`);

                        // Update local config
                        providerConfig.repositoryPath = resolvedPath;

                        // Continue initialization
                        await StorageBroker.setupProvider(providerPlugin, providerConfig);

                        // Subscribe to updates for Hot Reloading
                        EventHub.on('system:variable:updated', async (payload: any) => {
                            if (payload.key === variableKey) {
                                console.log(`[StorageBroker] Hot-Reloading storage path: ${payload.value}`);
                                await StorageBroker.swapProvider(providerPlugin, { ...providerConfig, repositoryPath: payload.value });
                            }
                        });

                    } catch (err: any) {
                        console.error(`[StorageBroker] Failed to resolve storage path variable: ${err.message}`);
                        // System will remain uninitialized
                    }
                })();

                // Return immediately to unblock startup
                return;
            }

            // Normal initialization (static config)
            await StorageBroker.setupProvider(providerPlugin, providerConfig);

        } catch (error: any) {
            console.error(`[StorageBroker] Failed to initialize provider: ${error.message}`);
            // Don't throw, just log. This allows the app to start even if storage is broken.
        }
    }

    /**
     * Instantiates the provider.
     */
    private static async setupProvider(providerPlugin: string, providerConfig: any) {
        const registry = await import('./registry.json');
        const providerEntry = registry.default.find((p: any) => p.id === providerPlugin);

        if (!providerEntry) {
            throw new Error(
                `Storage provider '${providerPlugin}' not found in plugin registry. ` +
                `Make sure the plugin is installed via 'npm run plugin:install'.`
            );
        }

        console.log(`[StorageBroker] Loading provider from: ${providerEntry.path}`);

        const fullPath = path.join(process.cwd(), providerEntry.path, 'index.ts');

        // eslint-disable-next-line no-eval
        const providerModule = eval('require')(fullPath);

        const factoryName = `create${StorageBroker.toPascalCase(providerPlugin.replace('storage-', ''))}Provider`;

        if (typeof providerModule[factoryName] === 'function') {
            StorageBroker.provider = providerModule[factoryName](providerConfig.repositoryPath || providerConfig);
            StorageBroker.initialized = true;
            console.log(`[StorageBroker] Successfully initialized with ${providerPlugin}`);
        } else {
            throw new Error(
                `Storage provider '${providerPlugin}' does not export factory function '${factoryName}'.`
            );
        }
    }

    /**
     * Helper to hot-swap the provider instance.
     */
    private static async swapProvider(pluginId: string, config: any) {
        // Re-run initialization logic for the provider part
        // Since we verified the plugin exists during init, we can be a bit faster here, 
        // but reusing the logic is safer. 
        // However, 'initialize' is static and might have side effects if full re-run.
        // Let's just re-instantiate the provider.
        try {
            const registry = await import('./registry.json');
            const providerEntry = registry.default.find((p: any) => p.id === pluginId);
            if (!providerEntry) return;

            const fullPath = path.join(process.cwd(), providerEntry.path, 'index.ts');
            // eslint-disable-next-line no-eval
            const providerModule = eval('require')(fullPath);
            const factoryName = `create${StorageBroker.toPascalCase(pluginId.replace('storage-', ''))}Provider`;

            if (typeof providerModule[factoryName] === 'function') {
                StorageBroker.provider = providerModule[factoryName](config.repositoryPath || config);
                console.log(`[StorageBroker] Provider hot-swapped successfully.`);
            }
        } catch (err) {
            console.error('[StorageBroker] Hot-swap failed', err);
        }
    }

    /**
     * Writes a file to storage.
     * 
     * @param relativePath - Path relative to storage root (e.g., "12/abc123.pd")
     * @param buffer - File content
     */
    static async write(relativePath: string, buffer: Buffer): Promise<void> {
        console.log('[StorageBroker] Writing file (Class Ref Check):', relativePath);
        StorageBroker.ensureInitialized();
        return StorageBroker.provider!.write(relativePath, buffer);
    }

    /**
     * Reads a file from storage.
     * 
     * @param relativePath - Path relative to storage root
     * @returns File content as Buffer
     */
    static async read(relativePath: string): Promise<Buffer> {
        StorageBroker.ensureInitialized();
        return StorageBroker.provider!.read(relativePath);
    }

    /**
     * Checks if a file exists in storage.
     * 
     * @param relativePath - Path relative to storage root
     * @returns True if file exists, false otherwise
     */
    static async exists(relativePath: string): Promise<boolean> {
        StorageBroker.ensureInitialized();
        return StorageBroker.provider!.exists(relativePath);
    }

    /**
     * Deletes a file from storage.
     * 
     * @param relativePath - Path relative to storage root
     */
    static async delete(relativePath: string): Promise<void> {
        StorageBroker.ensureInitialized();
        return StorageBroker.provider!.delete(relativePath);
    }

    /**
     * Lists files with a given prefix.
     * 
     * @param prefix - Path prefix (e.g., "12/" for all files in shard 12)
     * @returns Array of relative paths
     */
    static async list(prefix: string): Promise<string[]> {
        StorageBroker.ensureInitialized();
        return StorageBroker.provider!.list(prefix);
    }

    /**
     * Gets the total number of files in storage.
     * Used for capacity monitoring.
     * 
     * @returns File count
     */
    static async getFileCount(): Promise<number> {
        StorageBroker.ensureInitialized();
        return StorageBroker.provider!.getFileCount();
    }

    /**
     * Ensures the broker has been initialized.
     * @throws Error if not initialized
     */
    private static ensureInitialized(): void {
        if (!StorageBroker.initialized || !StorageBroker.provider) {
            throw new Error('StorageBroker not initialized. Call initialize() during Core startup.');
        }
    }

    /**
     * Converts kebab-case to PascalCase.
     * Example: "local-disk" -> "LocalDisk"
     */
    private static toPascalCase(str: string): string {
        return str
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }
}

/**
 * Storage configuration interface.
 */
export interface StorageConfig {
    /** Plugin ID of the storage provider (e.g., "storage-localdisk") */
    providerPlugin: string;
    /** Provider-specific configuration */
    providerConfig: {
        /** Absolute path to storage root directory (for local disk) */
        repositoryPath?: string;
        /** Additional provider-specific settings */
        [key: string]: any;
    };
}
