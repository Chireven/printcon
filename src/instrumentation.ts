export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('[Instrumentation] Registering system hooks...');

        // Initialize Storage Broker
        const { StorageBroker } = await import('./core/storage-broker');
        const storageConfig = await import('./config/storage.json');
        await StorageBroker.initialize(storageConfig);

        // Load plugins
        const { loadPlugins } = await import('./core/loader');
        await loadPlugins();
    }
}
