
import { PluginAPI } from '../../../src/core/types/plugin';

export async function initialize(api: PluginAPI) {
    api.log('Info', 'Starting Isolation Test...');

    try {
        // Test 1: Valid Query
        api.log('Info', 'Attempting Valid Query (SELECT 1)...');
        await api.database.query('SELECT 1 as val');
        api.log('Info', '✅ Valid Query Passed');

        // Test 2: Forbidden Query
        api.log('Info', 'Attempting Forbidden Query (SELECT ... sys.databases)...');
        await api.database.query('SELECT name FROM sys.databases');
        api.log('Error', '❌ Forbidden Query SUCCEEDED (Security Verification FAILED)');
    } catch (e: any) {
        if (e.message.includes('Security Violation')) {
            api.log('Info', '✅ Forbidden Query BLOCKED (Security Verification PASSED)');
        } else {
            api.log('Error', `Unexpected Error: ${e.message}`);
        }
    }
}
