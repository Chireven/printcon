import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BLACKLISTED = ['$RECYCLE.BIN', 'System Volume Information', 'Config.Msi', 'Recovery'];

function getDrives(): string[] {
    try {
        // Use wmic to get drives
        const output = execSync('wmic logicaldisk get name').toString();
        // Parse output
        const lines = output.split('\r\r\n');
        const drives = lines
            .slice(1) // Skip header
            .map(l => l.trim())
            .filter(l => l.length > 0);
        return drives;
    } catch (e) {
        // Fallback: Check A-Z
        const drives = [];
        for (let i = 67; i <= 90; i++) { // C-Z
            const drive = String.fromCharCode(i) + ':';
            if (fs.existsSync(drive + '/')) {
                drives.push(drive);
            }
        }
        return drives;
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const requestedPath = body.path; // Absolute path or empty

        // 1. If no path, return drives
        if (!requestedPath) {
            const drives = getDrives();
            const items = drives.map(d => ({
                name: d,
                type: 'folder', // Treat drives as folders
                path: d + '\\'
            }));
            return NextResponse.json({ status: 'success', items, isRoot: true });
        }

        // 2. Validate Path
        const safePath = path.resolve(requestedPath);
        if (!fs.existsSync(safePath)) {
            return NextResponse.json({ status: 'error', message: 'Path not found' }, { status: 404 });
        }

        // 3. Read Directory
        const dirents = fs.readdirSync(safePath, { withFileTypes: true });

        const items = dirents
            .filter(d => !BLACKLISTED.includes(d.name))
            .filter(d => !d.name.startsWith('.')) // Hide hidden files
            .map(d => {
                const ext = d.name.split('.').pop();
                return {
                    name: d.name,
                    type: d.isDirectory() ? 'folder' : 'file',
                    ext: d.isDirectory() ? undefined : ext,
                    path: path.join(safePath, d.name)
                };
            })
            // Sort: Folders first, then Files
            .sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
            });

        return NextResponse.json({ status: 'success', items, isRoot: false, currentPath: safePath });

    } catch (error: any) {
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
