import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const registryPath = path.join(process.cwd(), 'src', 'core', 'registry.json');

        if (!fs.existsSync(registryPath)) {
            return NextResponse.json([], { status: 200 });
        }

        const content = fs.readFileSync(registryPath, 'utf8');
        try {
            const registry = JSON.parse(content);
            return NextResponse.json(registry, { status: 200 });
        } catch (e) {
            return NextResponse.json([], { status: 200 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch registry' }, { status: 500 });
    }
}
export async function POST(req: Request) {
    try {
        const { pluginId, active } = await req.json();

        if (!pluginId) {
            return NextResponse.json({ error: 'pluginId is required' }, { status: 400 });
        }

        const registryPath = path.join(process.cwd(), 'src', 'core', 'registry.json');

        if (!fs.existsSync(registryPath)) {
            return NextResponse.json({ error: 'Registry not found' }, { status: 404 });
        }

        const content = fs.readFileSync(registryPath, 'utf8');
        let registry = [];
        try {
            registry = JSON.parse(content);
        } catch (e) {
            return NextResponse.json({ error: 'Malformed registry' }, { status: 500 });
        }

        const pluginIndex = registry.findIndex((p: any) => p.id === pluginId);

        if (pluginIndex === -1) {
            return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
        }

        // Toggle or Set specific status
        const newStatus = typeof active === 'boolean' ? active : !registry[pluginIndex].active;
        registry[pluginIndex].active = newStatus;

        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

        return NextResponse.json({
            success: true,
            pluginId,
            active: newStatus,
            message: `Plugin ${newStatus ? 'activated' : 'deactivated'}`
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
