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
            const key = `[${schema.toLowerCase()}].[${table.toLowerCase()}]`;

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
        const { tables: expectedTables, schemas: expectedSchemas, schemaToPluginMap } = await getAggregatedSchema();

        const results: any[] = [];
        const validatedPlugins = new Set<string>();

        // 3. Validate Schemas
        expectedSchemas.forEach(s => {
            if (s !== 'dbo') {
                const exists = currentSchemasList.some(cs => cs.toLowerCase() === s.toLowerCase());
                results.push({
                    tableName: `Schema: ${s}`,
                    status: exists ? 'valid' : 'missing',
                    issues: exists ? [] : [`Schema '${s}' does not exist.`]
                });

                if (exists) {
                    const pluginId = schemaToPluginMap[s];
                    if (pluginId) validatedPlugins.add(pluginId);
                }
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
                        issues.push(`Missing column: ${expectedCol.name} `);
                    }
                });
            } else {
                console.log(`[SchemaValidate] Missing Table: ${key} `);
            }

            results.push({
                tableName: schema !== 'dbo' ? `${schema}.${expected.name}` : expected.name,
                status,
                issues
            });
        });

        const hasIssues = results.some(r => r.status !== 'valid');

        // 5. Clear Alerts for Validated Plugins
        // If a plugin's schema was validated successfully, we update its System Status to green.
        if (validatedPlugins.size > 0) {
            // Import dynamically to avoid circular dependencies that might cause 500 errors
            const { SystemStatus } = await import('../../../../core/system-status');

            validatedPlugins.forEach(pluginId => {
                // Check if this plugin has any outstanding issues in the results
                // We need to know which tables belong to which plugin (via schema)
                // Since our 'results' are flat, we filter by schema name.

                // Find schema name for this plugin
                const schemaName = Object.keys(schemaToPluginMap).find(key => schemaToPluginMap[key] === pluginId);

                if (schemaName) {
                    const pluginIssues = results.filter(r => {
                        // Check if result belongs to this schema
                        return r.tableName.includes(schemaName) && r.status !== 'valid';
                    });

                    if (pluginIssues.length === 0) {
                        console.log(`[SchemaValidate] Clearing alert for plugin: ${pluginId} `);
                        SystemStatus.update(pluginId, [
                            { label: 'Database', value: 'Synced', severity: 'success' }
                        ]);
                    }
                }
            });
        }

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
