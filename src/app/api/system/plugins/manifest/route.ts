import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const pluginId = searchParams.get('pluginId');

        if (!pluginId) {
            return NextResponse.json({ error: 'Plugin ID required' }, { status: 400 });
        }

        // Load registry to find plugin path
        const registryPath = path.join(process.cwd(), 'src/core/registry.json');
        const registryData = await fs.readFile(registryPath, 'utf-8');
        const registry = JSON.parse(registryData);

        const plugin = registry.find((p: any) => p.id === pluginId);

        if (!plugin) {
            return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
        }

        // Load manifest
        const manifestPath = path.join(process.cwd(), plugin.path, 'manifest.json');
        const manifestData = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestData);

        return NextResponse.json(manifest);
    } catch (e: any) {
        console.error('[API] Failed to load manifest:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
