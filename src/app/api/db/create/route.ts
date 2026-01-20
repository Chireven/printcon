
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

        // Connect to master
        const sqlConfig: sql.config = {
            user: config.username,
            password: config.password,
            server: config.server,
            database: 'master',
            options: {
                encrypt: false,
                trustServerCertificate: true,
                instanceName: config.instance || undefined
            }
        };

        await sql.connect(sqlConfig);

        // Sanitize database name to prevent injection (basic alpha-numeric check)
        const dbName = config.database.replace(/[^a-zA-Z0-9_]/g, '');

        if (dbName !== config.database) {
            throw new Error('Invalid database name. Only alphanumeric characters and underscores allowed.');
        }

        // Create Database
        await sql.query(`CREATE DATABASE [${dbName}]`);

        await sql.close();

        return NextResponse.json({
            status: 'success',
            message: `Database '${dbName}' created successfully.`
        });

    } catch (error: any) {
        console.error('[API] DB Create Failed:', error);
        return NextResponse.json({
            status: 'error',
            message: error.message || 'Failed to create database'
        }, { status: 500 });
    }
}
