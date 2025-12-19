/**
 * Plugin Locking Script (Enterprise Edition)
 * 
 * Delegates locking logic to the Next.js Control Plane.
 */

async function main() {
    const pluginId = process.argv[2];

    if (!pluginId) {
        console.error('Error: Please provide a plugin ID to lock.');
        console.log('Usage: npm run plugin:lock <plugin-id>');
        process.exit(1);
    }

    try {
        const response = await fetch('http://localhost:3000/api/system/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'lock', pluginId })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Server responded with ${response.status}`);
        }

        console.log(`\n[Lock] Success: Plugin ${pluginId} is now LOCKED.`);
    } catch (err: any) {
        console.error(`\n[Error] Lock failed: ${err.message}`);
        console.error(`Ensure the Next.js application is running with 'npm run dev'.`);
        process.exit(1);
    } finally {
        const { listPlugins } = await import('./list.js');
        await listPlugins();
    }
}

main();
