import { NextRequest, NextResponse } from 'next/server';
import { getAggregatedSchema } from '../../../../lib/schema/registry';
import sql from 'mssql';

/**
 * POST /api/schema/fix
 * Creates missing schemas and tables
 */
export async function POST(req: NextRequest) {
    try {
        const config = await req.json();
        const { tables, schemas } = await getAggregatedSchema();

        // Build connection config
        const dbConfig: sql.config = {
            server: config.server,
            database: config.database,
            options: {
                encrypt: false,
                trustServerCertificate: true,
                instanceName: config.instance || undefined
            },
            ...(config.logonType === 'sql'
                ? { user: config.username, password: config.password, authentication: { type: 'default' } }
                : { authentication: { type: 'ntlm', options: { domain: '', userName: '', password: '' } } }
            )
        };

        const pool = await sql.connect(dbConfig);
        const fixed = [];

        // Create missing schemas
        for (const schemaName of schemas) {
            const schemaCheck = await pool.request()
                .input('schemaName', sql.NVarChar, schemaName)
                .query(`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = @schemaName`);

            if (schemaCheck.recordset.length === 0) {
                await pool.request().query(`CREATE SCHEMA [${schemaName}]`);
                fixed.push(`Created schema: ${schemaName}`);
            }
        }

        // Create missing tables
        for (const table of tables) {
            const schemaName = table.schema || 'dbo';
            const tableName = table.name;

            const tableCheck = await pool.request()
                .input('tableName', sql.NVarChar, tableName)
                .input('schemaName', sql.NVarChar, schemaName)
                .query(`
                    SELECT TABLE_NAME 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = @schemaName AND TABLE_NAME = @tableName
                `);

            if (tableCheck.recordset.length === 0) {
                // Build CREATE TABLE statement
                const columnDefs = table.columns.map(col => {
                    const parts = [
                        `[${col.name}]`,
                        col.type,
                        col.nullable === false ? 'NOT NULL' : 'NULL'
                    ];

                    if (col.primaryKey) parts.push('PRIMARY KEY');
                    if (col.identity) parts.push('IDENTITY(1,1)');
                    if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);

                    return parts.join(' ');
                }).join(', ');

                const createSql = `CREATE TABLE [${schemaName}].[${tableName}] (${columnDefs})`;
                await pool.request().query(createSql);
                fixed.push(`Created table: ${schemaName}.${tableName}`);
            }
        }

        await pool.close();

        return NextResponse.json({
            status: 'success',
            message: `Fixed ${fixed.length} schema issues`,
            fixed
        });
    } catch (error: any) {
        console.error('[API] Schema fix error:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
