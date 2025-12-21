
import { EventHub } from './events';

/**
 * Variable Resolution Service
 * 
 * Provides a mechanism for plugins to publish configuration values that can be
 * consumed by other parts of the system (like Core services).
 * 
 * Features:
 * - Async resolution: waiting for variables to be published
 * - Scoped keys: variables are namespaced by plugin ID
 * - Reactive: emits events when variables change
 */
export class VariableService {

    // Use globalThis to persist across HMR
    private static get variables(): Map<string, any> {
        if (!(globalThis as any)._coreVariables) {
            (globalThis as any)._coreVariables = new Map();
        }
        return (globalThis as any)._coreVariables;
    }

    private static get pendingResolvers(): Map<string, Function[]> {
        if (!(globalThis as any)._coreResolvers) {
            (globalThis as any)._coreResolvers = new Map();
        }
        return (globalThis as any)._coreResolvers;
    }

    /**
     * Publishes a variable to the system.
     * 
     * @param pluginId - The ID of the plugin publishing the variable
     * @param key - The variable key (will be prefixed with pluginId)
     * @param value - The value to publish
     */
    static publish(pluginId: string, key: string, value: any) {
        const fullKey = `${pluginId}.${key}`;

        // Update value
        this.variables.set(fullKey, value);

        console.log(`[VariableService] Published: ${fullKey} = ${JSON.stringify(value)}`);

        // Notify any pending waiters
        if (this.pendingResolvers.has(fullKey)) {
            const resolvers = this.pendingResolvers.get(fullKey)!;
            console.log(`[VariableService] Resolving ${resolvers.length} pending waiters for ${fullKey}`);
            resolvers.forEach(resolve => resolve(value));
            this.pendingResolvers.delete(fullKey);
        }

        // Emit event for real-time updates
        EventHub.emit('system:variable:updated', { key: fullKey, value });
    }

    /**
     * Gets a variable, waiting for it to be published if necessary.
     * 
     * @param key - The full variable key (e.g. 'printer-drivers.DriverRepository')
     * @param timeoutMs - How long to wait before timing out (default 5000ms)
     */
    static async get<T>(key: string, timeoutMs: number = 5000): Promise<T> {
        // If already exists, return immediately
        if (this.variables.has(key)) {
            return this.variables.get(key) as T;
        }

        // Special Case: Environment Variables
        if (key.startsWith('env.')) {
            const envKey = key.substring(4);
            const value = process.env[envKey];
            if (value !== undefined) {
                return value as T;
            }
            // If not in env, we could throw or wait. 
            // Ideally wait? Or assume missing? 
            // For env vars, usually they are static.
            // Let's debug log and return/wait.
            console.log(`[VariableService] Env var ${envKey} not found in process.env`);
        }

        console.log(`[VariableService] Waiting for variable: ${key}`);

        return new Promise((resolve, reject) => {
            // Set timeout
            const timer = setTimeout(() => {
                if (this.pendingResolvers.has(key)) {
                    // Remove this specific resolver
                    const resolvers = this.pendingResolvers.get(key)!;
                    const index = resolvers.indexOf(resolveWrapper);
                    if (index > -1) {
                        resolvers.splice(index, 1);
                    }
                }
                reject(new Error(`Variable '${key}' resolution timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            // Wrapper to clear timeout
            const resolveWrapper = (value: T) => {
                clearTimeout(timer);
                resolve(value);
            };

            // Add to pending
            if (!this.pendingResolvers.has(key)) {
                this.pendingResolvers.set(key, []);
            }
            this.pendingResolvers.get(key)!.push(resolveWrapper);
        });
    }

    /**
     * Synchronously gets a variable if it exists.
     */
    static getSync<T>(key: string): T | undefined {
        if (key.startsWith('env.')) {
            return process.env[key.substring(4)] as T;
        }
        return this.variables.get(key) as T;
    }
}
