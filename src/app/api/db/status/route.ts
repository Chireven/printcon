import { NextResponse } from 'next/server';
import { MssqlProvider } from '../../../../../plugins/databaseProviders/database-mssql';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const provider = new MssqlProvider(body);

        // Test connection to server
        let dbExists = false;
        try {
            dbExists = await provider.checkDatabaseExists();
        } catch (err: any) {
            // If we can't check (e.g., connection failed), return error
            return NextResponse.json({
                status: 'error',
                message: `Cannot connect to server: ${err.message}`
            }, { status: 500 });
        }

        return NextResponse.json({
            status: 'success',
            connected: true,
            databaseExists: dbExists
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}
