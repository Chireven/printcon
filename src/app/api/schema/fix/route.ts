import { NextResponse } from 'next/server';
import { MssqlProvider } from '../../../../../plugins/databaseProviders/database-mssql';
import { getAggregatedSchema } from '../../../../lib/schema/registry';
import { TableDefinition } from '../../../../lib/schema/definitions';

export const dynamic = 'force-dynamic';

function generateCreateTableSQL(table: TableDefinition): string {
    const schema = table.schema || 'dbo';
    const tableName = `[${schema}].[${table.name}]`;

    const columnDefs = table.columns.map(col => {
        let def = `[${col.name}] ${col.type}`;
        if (col.identity) def += ' IDENTITY(1,1)';
        if (!col.nullable) def += ' NOT NULL';
        if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
        if (col.primaryKey) def += ' PRIMARY KEY';
        return def;
    }).join(',\n    ');

    return `CREATE TABLE ${tableName} (\n    ${columnDefs}\n);`;
}

function generateAddColumnSQL(tableName: string, col: any): string {
    let def = `ALTER TABLE ${tableName} ADD [${col.name}] ${col.type}`;
    if (!col.nullable) def += ' NOT NULL';
    if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
    return def + ';';
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const provider = new MssqlProvider(body);

        // Get current schema
        const currentSchema = await provider.getCurrentSchema();
        const currentTables: Record<string, any[]> = {};
        currentSchema.forEach((row: any) => {
            const schema = row.SchemaName || 'dbo';
            const table = row.TableName;
            const key = `[${schema.toLowerCase()}].[${table.toLowerCase()}]`;

            if (!currentTables[key]) {
                currentTables[key] = [];
            }
            currentTables[key].push({
                name: row.ColumnName,
                type: row.DataType
            });
        });

        // Generate fix scripts
        const scripts: string[] = [];
        const { tables: expectedTables, schemas: expectedSchemas } = await getAggregatedSchema();

        // 1. Ensure Schemas Exist
        for (const s of expectedSchemas) {
            if (s !== 'dbo') {
                scripts.push(`IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = '${s}') EXEC('CREATE SCHEMA [${s}]')`);
            }
        }

        // 2. Ensure Tables Exist
        for (const expected of expectedTables) {
            const schema = expected.schema || 'dbo';
            const key = `[${schema.toLowerCase()}].[${expected.name.toLowerCase()}]`;

            if (!currentTables[key]) {
                // Table missing - create it
                scripts.push(generateCreateTableSQL(expected));
            } else {
                // Check columns
                const currentCols = currentTables[key];
                for (const expectedCol of expected.columns) {
                    const found = currentCols.find(c => c.name.toLowerCase() === expectedCol.name.toLowerCase());
                    if (!found) {
                        const tableName = `[${schema}].[${expected.name}]`;
                        scripts.push(generateAddColumnSQL(tableName, expectedCol));
                    }
                }
            }
        }

        // Execute scripts
        const executedScripts: string[] = [];
        for (const script of scripts) {
            await provider.query(script);
            executedScripts.push(script);
        }

        return NextResponse.json({
            status: 'success',
            message: `Applied ${executedScripts.length} fix(es)`,
            scriptsExecuted: executedScripts
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
