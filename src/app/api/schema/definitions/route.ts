import { NextRequest, NextResponse } from 'next/server';
import { getAggregatedSchema } from '../../../../lib/schema/registry';

/**
 * GET /api/schema/definitions
 * Returns all schema definitions from core + plugins
 */
export async function GET(req: NextRequest) {
    try {
        const { tables, schemas, schemaToPluginMap } = await getAggregatedSchema();

        // Format for UI consumption - match validate route format
        const definitions = [
            // Add schema badges first
            ...schemas.map(schemaName => ({
                tableName: `Schema: ${schemaName}`,
                status: 'idle'
            })),
            // Then add tables with fully qualified names (schema.table)
            ...tables.map(table => {
                const schemaName = table.schema || 'dbo';
                return {
                    tableName: `${schemaName}.${table.name}`,
                    status: 'idle'
                };
            })
        ];

        return NextResponse.json({
            status: 'success',
            definitions
        });
    } catch (error: any) {
        console.error('[API] Schema definitions error:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
