import { NextResponse } from 'next/server';
// Re-importing from Root Plugins Directory (4 levels up from src/app/api/test-db)
import { MssqlProvider } from '../../../../plugins/databaseProviders/database-mssql';
import { db } from '../../../lib/db-manager';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const result = await db.query('SELECT @@VERSION as version');
        return NextResponse.json({ status: 'success', data: result });
    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('Testing DB with dynamic credentials from [Recreated File]...');

        // Transient Provider
        const provider = new MssqlProvider(body);

        const result = await provider.query<{ version: string }>('SELECT @@VERSION as version');

        return NextResponse.json({
            status: 'success',
            data: result
        });
    } catch (error: any) {
        console.error('DB Test Failed:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
