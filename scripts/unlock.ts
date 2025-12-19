/**
 * Plugin Unlocking Script (Enterprise Edition)
 * 
 * Implements Rule #23 using a stateful flow through the Next.js API.
 */

import * as readline from 'readline/promises';

async function main() {
    const pluginId = process.argv[2];

    if (!pluginId) {
        console.error('Error: Please provide a plugin ID to unlock.');
        console.log('Usage: npm run plugin:unlock <plugin-id>');
        process.exit(1);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        // Step A: Initiate Challenge
        console.log(`\n[Unlock] Initiating challenge for ${pluginId}...`);
        const initRes = await fetch('http://localhost:3000/api/system/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unlock-init', pluginId })
        });

        if (!initRes.ok) {
            const data = await initRes.json();
            throw new Error(data.error || 'Failed to initiate challenge');
        }

        console.log('\n' + '!'.repeat(50));
        console.log(' SECURITY CHALLENGE ACTIVE');
        console.log('!'.repeat(50));
        console.log('A security PIN has been broadcast to the Debug Console.');

        // Step C: Prompt for PIN
        const pin = await rl.question('\nEnter the PIN displayed in the Debug UI to unlock: ');

        // Step D: Verify PIN
        console.log(`\n[Unlock] Verifying PIN...`);
        const verifyRes = await fetch('http://localhost:3000/api/system/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unlock-verify', pluginId, pin })
        });

        if (!verifyRes.ok) {
            const data = await verifyRes.json();
            throw new Error(data.error || 'Invalid PIN');
        }

        console.log(`\n[Success] PIN Verified. Plugin ${pluginId} is now UNLOCKED.`);
    } catch (err: any) {
        console.error(`\n[Failure] Unlock failed: ${err.message}`);
        process.exit(1);
    } finally {
        rl.close();
        try {
            const { listPlugins } = await import('./list.js');
            await listPlugins();
        } catch { }
    }
}

main();
