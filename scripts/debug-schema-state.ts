
import { MssqlProvider } from '../plugins/databaseProviders/database-mssql/index';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log('--- Debugging DB State ---');
    const provider = new MssqlProvider({
        server: process.env.DB_SERVER,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        logonType: process.env.DB_USER ? 'sql' : 'windows'
    });

    try {
        console.log('Connecting...');
        await provider.connect();

        console.log('\n--- getSchemas() Output ---');
        const schemas = await provider.getSchemas();
        console.log(schemas);

        console.log('\n--- getCurrentSchema() Output (Filtered for test_isolation) ---');
        const tables = await provider.getCurrentSchema();
        const testTables = tables.filter((t: any) => t.SchemaName === 'test_isolation');
        console.log(JSON.stringify(testTables, null, 2));

        console.log('\n--- Raw Verification ---');
        // Check SCHEMATA directly
        const rawSchemas = await provider.query("SELECT * FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'test_isolation'");
        console.log('Raw SCHEMATA check:', rawSchemas);

        await provider.disconnect();
    } catch (e) {
        console.error(e);
    }
}

run();
