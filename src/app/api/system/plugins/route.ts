import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
