import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper to get registry
function getRegistry() {
    const regPath = path.resolve(process.cwd(), 'src/core/registry.json');
    if (!fs.existsSync(regPath)) return [];
    return JSON.parse(fs.readFileSync(regPath, 'utf8'));
}

export async function GET(req: Request, { params }: { params: Promise<{ pluginId: string }> }) {
    try {
        const { pluginId } = await params;
        const registry = getRegistry();
        const plugin = registry.find((p: any) => p.id === pluginId);

        if (!plugin) {
            return NextResponse.json({ status: 'error', message: 'Plugin not found' }, { status: 404 });
        }

        const configPath = path.resolve(process.cwd(), plugin.path, 'config.json');

        if (!fs.existsSync(configPath)) {
            // Return empty config
            return NextResponse.json({ status: 'success', config: {} });
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return NextResponse.json({ status: 'success', config });
    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ pluginId: string }> }) {
    try {
        const { pluginId } = await params;
        const body = await req.json();

        // Debug
        const debugPath = path.resolve(process.cwd(), 'debug-config.log');
        // fs.appendFileSync(debugPath, `\n[${new Date().toISOString()}] POST ${pluginId}\n`);

        const registry = getRegistry();
        const plugin = registry.find((p: any) => p.id === pluginId);

        if (!plugin) {
            return NextResponse.json({ status: 'error', message: 'Plugin not found' }, { status: 404 });
        }

        const configPath = path.resolve(process.cwd(), plugin.path, 'config.json');

        // Write
        fs.writeFileSync(configPath, JSON.stringify(body, null, 2));

        return NextResponse.json({ status: 'success', message: 'Saved' });
    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
