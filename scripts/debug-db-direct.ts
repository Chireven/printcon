
import sql from 'mssql';
import config from '../src/config/database.json';

async function main() {
    try {
        console.log('Connecting...');
        const pool = await sql.connect(config as any);
        console.log('Connected.');

        const result = await pool.request().query('SELECT * FROM [plg_printer_drivers].Packages');
        console.log(`Rows: ${result.recordset.length}`);
        console.table(result.recordset);

        // Also check SupportedModels just in case
        const models = await pool.request().query('SELECT * FROM [plg_printer_drivers].SupportedModels');
        console.table(models.recordset);

        await pool.close();
    } catch (err) {
        console.error('Failed:', err);
    }
}

main();
