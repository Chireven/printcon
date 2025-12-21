
import { DatabaseBroker } from '../src/core/database-broker';
import { MssqlProvider } from '../plugins/databaseProviders/database-mssql/index';
import config from '../src/config/database.json';

async function main() {
    try {
        console.log('Initializing DatabaseBroker...');
        await DatabaseBroker.initialize(config as any);

        console.log('Initializing MssqlProvider...');
        const provider = new MssqlProvider();

        const mockApi: any = {
            database: DatabaseBroker,
            storage: {},
            variables: { publish: () => { } },
            events: { on: () => { }, emit: () => { } }
        };
        await provider.initialize(mockApi);

        DatabaseBroker.registerProvider(provider);

        console.log('Querying Packages...');
        setTimeout(async () => {
            try {
                const drivers = await DatabaseBroker.query('SELECT * FROM [plg_printer_drivers].Packages');
                console.log(`Found ${drivers.length} drivers.`);
                console.table(drivers);
                process.exit(0);
            } catch (err) {
                console.error('Query Failed', err);
                process.exit(1);
            }
        }, 1000);

    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

main();
