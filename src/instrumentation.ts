export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        console.log('[Instrumentation] Registering system hooks...');
        const { loadPlugins } = await import('./core/loader');
        await loadPlugins();
    }
}
