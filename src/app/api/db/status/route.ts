
import { NextResponse } from 'next/server';
import sql from 'mssql';

export async function POST(request: Request) {
    try {
        const config = await request.json();

        if (!config.server || !config.database) {
            return NextResponse.json({
                status: 'error',
                message: 'Server and Database are required'
            }, { status: 400 });
        }

        // Build connection string
        const sqlConfig: sql.config = {
            user: config.username,
            password: config.password,
            server: config.server,
            database: 'master', // Connect to master first to check existence
            options: {
                encrypt: false, // For local dev
                trustServerCertificate: true,
                instanceName: config.instance || undefined
            }
        };

        // If windows auth (simulated or real), we might rely on the process identity
        // But here we just try standard connection

        await sql.connect(sqlConfig);

        // Check if database exists
        const result = await sql.query`SELECT name FROM sys.databases WHERE name = ${config.database}`;
        const databaseExists = result.recordset.length > 0;

        await sql.close();

        return NextResponse.json({
            status: 'success',
            databaseExists
        });

    } catch (error: any) {
        console.error('[API] DB Test Failed:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message || 'Failed to connect to server'
        }, { status: 500 });
    }
}
