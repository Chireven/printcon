import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const registryPath = path.join(process.cwd(), 'src/core/registry.json');
        const registryData = await fs.readFile(registryPath, 'utf-8');
        const registry = JSON.parse(registryData);

        return NextResponse.json({ plugins: registry });
    } catch (e: any) {
        console.error('[API] Failed to load registry:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
