import { NextResponse } from 'next/server';
import { MssqlProvider } from '../../../../../plugins/databaseProviders/database-mssql';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const provider = new MssqlProvider(body);

        await provider.createDatabase();

        return NextResponse.json({
            status: 'success',
            message: 'Database created successfully'
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
