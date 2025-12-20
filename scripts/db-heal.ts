/**
 * CLI Tool: Database Schema Healing
 * Usage: npm run db:heal
 */

import { MssqlProvider } from '../plugins/databaseProviders/database-mssql';
import { SchemaDefinitions, TableDefinition } from '../src/lib/schema/definitions';

function generateCreateTableSQL(table: TableDefinition): string {
    const columnDefs = table.columns.map(col => {
        let def = `[${col.name}] ${col.type}`;
        if (col.identity) def += ' IDENTITY(1,1)';
        if (!col.nullable) def += ' NOT NULL';
        if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
        if (col.primaryKey) def += ' PRIMARY KEY';
        return def;
    }).join(',\n    ');

    return `CREATE TABLE [${table.name}] (\n    ${columnDefs}\n);`;
}

function generateAddColumnSQL(tableName: string, col: any): string {
    let def = `ALTER TABLE [${tableName}] ADD [${col.name}] ${col.type}`;
    if (!col.nullable) def += ' NOT NULL';
    if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
    return def + ';';
}

async function healSchema() {
    console.log('🔧 Starting Database Schema Healing...\n');

    // Use env vars (assumes .env is loaded)
    const provider = new MssqlProvider();

    try {
        // Get current schema
        console.log('📊 Analyzing current schema...');
        const currentSchema = await provider.getCurrentSchema();

        const currentTables: Record<string, any[]> = {};
        currentSchema.forEach((row: any) => {
            if (!currentTables[row.TableName]) {
                currentTables[row.TableName] = [];
            }
            currentTables[row.TableName].push({
                name: row.ColumnName,
                type: row.DataType
            });
        });

        // Generate fix scripts
        const scripts: string[] = [];

        for (const expected of SchemaDefinitions) {
            if (!currentTables[expected.name]) {
                console.log(`❌ Table missing: ${expected.name}`);
                scripts.push(generateCreateTableSQL(expected));
            } else {
                const currentCols = currentTables[expected.name];
                for (const expectedCol of expected.columns) {
                    const found = currentCols.find(c => c.name.toLowerCase() === expectedCol.name.toLowerCase());
                    if (!found) {
                        console.log(`⚠️  Column missing: ${expected.name}.${expectedCol.name}`);
                        scripts.push(generateAddColumnSQL(expected.name, expectedCol));
                    }
                }
            }
        }

        if (scripts.length === 0) {
            console.log('\n✅ Schema is healthy! No fixes needed.');
            return;
        }

        console.log(`\n🔨 Applying ${scripts.length} fix(es)...`);
        for (const script of scripts) {
            console.log(`  Executing: ${script.substring(0, 50)}...`);
            await provider.query(script);
        }

        console.log('\n✅ Schema healing completed successfully!');
    } catch (error: any) {
        console.error('\n❌ Healing failed:', error.message);
        process.exit(1);
    }
}

healSchema();
