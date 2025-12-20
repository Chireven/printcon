import { NextResponse } from 'next/server';
import { MssqlProvider } from '../../../../../plugins/databaseProviders/database-mssql';
import { getAggregatedSchema } from '../../../../lib/schema/registry';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const provider = new MssqlProvider(body);

        // 1. Get Current State
        const currentSchemaCols = await provider.getCurrentSchema();
        const currentSchemasList = await provider.getSchemas();

        const currentTables: Record<string, any[]> = {};
        currentSchemaCols.forEach((row: any) => {
            const schema = row.SchemaName || 'dbo';
            const table = row.TableName;
            const key = `[${schema.toLowerCase()}].[${table.toLowerCase()}]`; // Normalize case

            if (!currentTables[key]) {
                currentTables[key] = [];
            }
            currentTables[key].push({
                name: row.ColumnName,
                type: row.DataType,
                nullable: row.IsNullable === 'YES'
            });
        });

        // Debug Log
        console.log('[SchemaValidate] Found Tables:', Object.keys(currentTables));
        console.log('[SchemaValidate] Found Schemas:', currentSchemasList);

        // 2. Get Expected State
        const { tables: expectedTables, schemas: expectedSchemas } = await getAggregatedSchema();

        const results: any[] = [];

        // 3. Validate Schemas
        expectedSchemas.forEach(s => {
            if (s !== 'dbo') {
                const exists = currentSchemasList.some(cs => cs.toLowerCase() === s.toLowerCase());
                results.push({
                    tableName: `Schema: ${s}`,
                    status: exists ? 'valid' : 'missing',
                    issues: exists ? [] : [`Schema '${s}' does not exist.`]
                });
            }
        });

        // 4. Validate Tables
        expectedTables.forEach(expected => {
            const schema = expected.schema || 'dbo';
            const key = `[${schema.toLowerCase()}].[${expected.name.toLowerCase()}]`;

            const exists = !!currentTables[key];
            let status: 'missing' | 'valid' | 'invalid' = 'missing';
            const issues: string[] = [];

            if (exists) {
                status = 'valid';
                const currentCols = currentTables[key];

                expected.columns.forEach(expectedCol => {
                    const found = currentCols.find(c => c.name.toLowerCase() === expectedCol.name.toLowerCase());
                    if (!found) {
                        status = 'invalid';
                        issues.push(`Missing column: ${expectedCol.name}`);
                    }
                });
            } else {
                console.log(`[SchemaValidate] Missing Table: ${key}`);
            }

            results.push({
                tableName: schema !== 'dbo' ? `${schema}.${expected.name}` : expected.name,
                status,
                issues
            });
        });

        const hasIssues = results.some(r => r.status !== 'valid');

        return NextResponse.json({
            status: 'success',
            tables: results,
            needsHealing: hasIssues
        });
    } catch (error: any) {
        console.error('[SchemaValidate] Error:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
