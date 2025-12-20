import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { infPath, name, serverName } = body;

        console.log('Exporting Driver:', infPath, serverName ? `from ${serverName}` : '(local)');

        if (!infPath) {
            return NextResponse.json({ status: 'error', message: 'Missing infPath' }, { status: 400 });
        }

        // Convert local path to UNC if remote server
        let resolvedPath = infPath;
        if (serverName) {
            // Convert C:\Path\To\File to \\SERVER\C$\Path\To\File
            const match = infPath.match(/^([A-Z]):(\\.*)/i);
            if (match) {
                const drive = match[1];
                const restOfPath = match[2];
                resolvedPath = `\\\\${serverName}\\${drive}$${restOfPath}`;
                console.log('Converted to UNC:', resolvedPath);
            } else {
                return NextResponse.json({
                    status: 'error',
                    message: 'Invalid INF path format from remote server'
                }, { status: 400 });
            }
        }

        // Ensure it exists
        if (!fs.existsSync(resolvedPath)) {
            // If mock path
            if (process.env.NODE_ENV === 'development' && infPath.includes('Mock')) {
                return NextResponse.json({ status: 'error', message: 'Cannot export mock drivers.' }, { status: 400 });
            }
            return NextResponse.json({
                status: 'error',
                message: serverName
                    ? `Cannot access driver files on ${serverName}. Ensure administrative shares are enabled (C$).`
                    : 'INF File not found on server'
            }, { status: 404 });
        }

        const driverDir = path.dirname(resolvedPath);
        const tempDir = os.tmpdir();
        // Sanitize name for filename
        const safeName = (name || 'driver').replace(/[^a-z0-9]/gi, '_');
        const zipName = `${safeName}-${Date.now()}.zip`;
        const zipPath = path.join(tempDir, zipName);

        // Compress  
        const cmd = `powershell -Command "Compress-Archive -Path '${driverDir}\\*' -DestinationPath '${zipPath}' -Force"`;

        console.log('Executing:', cmd);
        await execAsync(cmd);

        if (!fs.existsSync(zipPath)) {
            return NextResponse.json({ status: 'error', message: 'Zip creation failed' }, { status: 500 });
        }

        const fileBuffer = fs.readFileSync(zipPath);

        // Cleanup
        try { fs.unlinkSync(zipPath); } catch (e) { console.error('Cleanup failed', e); }

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${safeName}.zip"`
            }
        });

    } catch (error: any) {
        console.error('Export Error:', error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
