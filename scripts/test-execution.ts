import { execute } from '../src/core/execution';

async function runTest() {
    console.log('--- Testing PowerShell Mock Service ---');

    // Set the environment to development to trigger the mock
    process.env.NODE_ENV = 'development';

    try {
        const printers = await execute('powershell', 'get-printers', {});
        console.log('\n--- Mock Printers ---');
        console.table(printers);

        const ports = await execute('powershell', 'get-ports', {});
        console.log('\n--- Mock Ports ---');
        console.log(ports);

        const drivers = await execute('powershell', 'get-drivers', {});
        console.log('\n--- Mock Drivers ---');
        console.log(drivers);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTest();
