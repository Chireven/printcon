
import { loadPlugins } from '../src/core/loader';
import { EventHub } from '../src/core/events';

async function verify() {
    console.log('--- Verifying Printer Drivers Plugin (Event-Driven) ---');

    // 1. Set Environment
    process.env.APP_ENV = 'development';
    process.env.NODE_ENV = 'development';

    // 2. Setup Listener for Response
    const responsePromise = new Promise((resolve) => {
        EventHub.on('RESPONSE_DRIVERS', (payload) => {
            console.log('\n[Success] Received RESPONSE_DRIVERS:');
            console.table(payload.drivers);
            resolve(payload);
        });
    });

    // 3. Initialize Plugins
    await loadPlugins();

    // 4. Trigger Request
    console.log('\n[Test] Sending REQUEST_DRIVERS...');
    await EventHub.emit('REQUEST_DRIVERS', 'system-test');

    // 5. Wait for matches
    const result = await Promise.race([
        responsePromise,
        new Promise((_, reject) => setTimeout(() => reject('Timeout waiting for response'), 5000))
    ]);

    if (result) {
        console.log('\nVerification Passed!');
        process.exit(0);
    }
}

verify().catch(err => {
    console.error('\n[Failed]', err);
    process.exit(1);
});
