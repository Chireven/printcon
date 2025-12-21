import { NextRequest, NextResponse } from 'next/server';
import { getAggregatedSchema } from '../../../../lib/schema/registry';
import sql from 'mssql';

/**
 * POST /api/schema/validate
 * Validates database schema against plugin manifests
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
        const results = [];
        let needsHealing = false;

        // Check schemas first
        for (const schemaName of schemas) {
            const schemaCheck = await pool.request()
                .input('schemaName', sql.NVarChar, schemaName)
                .query(`SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = @schemaName`);

            if (schemaCheck.recordset.length === 0) {
                results.push({
                    tableName: `Schema: ${schemaName}`,
                    status: 'missing',
                    issues: ['Schema does not exist']
                });
                needsHealing = true;
            } else {
                results.push({
                    tableName: `Schema: ${schemaName}`,
                    status: 'valid'
                });
            }
        }

        // Check tables
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
                results.push({
                    tableName: `${schemaName}.${tableName}`,
                    status: 'missing',
                    issues: ['Table does not exist']
                });
                needsHealing = true;
            } else {
                // TODO: Check columns if needed
                results.push({
                    tableName: `${schemaName}.${tableName}`,
                    status: 'valid'
                });
            }
        }

        await pool.close();

        return NextResponse.json({
            status: 'success',
            tables: results,
            needsHealing
        });
    } catch (error: any) {
        console.error('[API] Schema validation error:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
