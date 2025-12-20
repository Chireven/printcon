import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const config = {
            server: process.env.DB_SERVER || '',
            database: process.env.DB_NAME || '',
            username: process.env.DB_USER || '',
            password: process.env.DB_PASSWORD || '',
            instance: process.env.DB_INSTANCE || '',
            logonType: process.env.DB_AUTH_TYPE || 'windows'
        };

        return NextResponse.json({
            status: 'success',
            config
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'error',
            message: error.message
        }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { server, database, username, password, instance, logonType } = body;

        // Path to .env file (Root of project)
        const envPath = path.resolve(process.cwd(), '.env');

        // Read existing
        let content = '';
        if (fs.existsSync(envPath)) {
            content = fs.readFileSync(envPath, 'utf8');
        }

        // Helper to update/add key
        const updateKey = (key: string, value: string) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(content)) {
                content = content.replace(regex, `${key}=${value}`);
            } else {
                content += `\n${key}=${value}`;
            }
        };

        // Update Keys
        if (server) updateKey('DB_SERVER', server);
        if (database) updateKey('DB_NAME', database);
        if (username) updateKey('DB_USER', username);
        if (password) updateKey('DB_PASSWORD', password);
        if (instance) updateKey('DB_INSTANCE', instance);
        if (logonType) updateKey('DB_AUTH_TYPE', logonType);
        // Also set Provider
        updateKey('DB_PROVIDER', 'mssql');

        // Write back
        fs.writeFileSync(envPath, content.trim() + '\n');

        console.log('Updated .env file with new database config.');

        return NextResponse.json({ status: 'success', message: 'Environment updated.' });
    } catch (error: any) {
        console.error('Failed to save env:', error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
