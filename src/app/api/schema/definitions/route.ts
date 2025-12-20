import { NextResponse } from 'next/server';
import { getAggregatedSchema } from '../../../../lib/schema/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { tables, schemas } = await getAggregatedSchema();

        const definitions: any[] = [];

        // Add Expected Schemas (excluding dbo)
        schemas.forEach(s => {
            if (s !== 'dbo') {
                definitions.push({
                    tableName: `Schema: ${s}`,
                    status: 'idle',
                    issues: []
                });
            }
        });

        // Add Tables
        tables.forEach(def => {
            definitions.push({
                tableName: def.schema && def.schema !== 'dbo' ? `${def.schema}.${def.name}` : def.name,
                status: 'idle', // Initial status
                issues: []
            });
        });

        return NextResponse.json({
            status: 'success',
            definitions
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
