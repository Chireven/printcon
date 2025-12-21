import { NextResponse } from 'next/server';
// Re-importing from Root Plugins Directory (4 levels up from src/app/api/test-db)
import { MssqlProvider } from '../../../../plugins/databaseProviders/database-mssql';
import { DatabaseBroker } from '../../../core/database-broker';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const result = await DatabaseBroker.query('SELECT @@VERSION as version');
        return NextResponse.json({ status: 'success', data: result });
    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Mode 1: Sync Schema (Manual Admin Action)
        if (body.action === 'syncSchema') {
            console.log('Admin triggered Schema Sync...');

            // 1. Initialize Provider with passed creds
            const provider = new MssqlProvider(body.config);
            await provider.connect();

            // 2. Load all active plugin manifests to find requirements
            // We need to read registry.json manually here since we are in a route
            const fs = require('fs');
            const path = require('path');
            const registry = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/core/registry.json'), 'utf8'));

            const results = [];

            for (const plugin of registry) {
                if (!plugin.active) continue;

                const manifestPath = path.join(process.cwd(), plugin.path, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    if (manifest.database) {
                        try {
                            const synced = await provider.syncSchema(manifest.database, true); // FORCE = TRUE
                            results.push({ plugin: plugin.id, status: synced ? 'synced' : 'failed' });
                        } catch (e: any) {
                            results.push({ plugin: plugin.id, status: 'error', message: e.message });
                        }
                    }
                }
            }

            return NextResponse.json({ status: 'success', data: results });
        }

        // Mode 2: Standard Connection Test
        console.log('Testing DB with dynamic credentials...');

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
