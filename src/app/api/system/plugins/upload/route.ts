import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { broadcastSystemEvent } from '../../events/route';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    let tempPath: string | null = null;

    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Save file to temp
        const buffer = Buffer.from(await file.arrayBuffer());
        tempPath = path.join(os.tmpdir(), file.name);
        fs.writeFileSync(tempPath, buffer);

        console.log(`[API] Uploaded file saved to ${tempPath}, triggering install...`);

        // Execute the install script
        const { stdout, stderr } = await execAsync(`npm run plugin:install "${tempPath}"`);

        console.log('[API] Install Output:', stdout);
        if (stderr) console.error('[API] Install Stderr:', stderr);

        // Extract plugin ID from output
        const idMatch = stdout.match(/\[Success\] Plugin ([^\s]+) installed successfully!/);
        const pluginId = idMatch ? idMatch[1] : null;

        console.log('[API] Check:', { pluginId });

        // Broadcast event to UI
        broadcastSystemEvent({
            event: 'PLUGIN_INSTALLED',
            data: { status: 'success', pluginId }
        });

        return NextResponse.json({
            status: 'success',
            message: `Plugin installed successfully.`,
            output: stdout,
            pluginId
        });

    } catch (error: any) {
        console.error('[API] Install Failed:', error);
        return NextResponse.json({
            error: 'Failed to install plugin',
            details: error.message
        }, { status: 500 });
    } finally {
        // Robust Cleanup
        if (tempPath) {
            try {
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                    console.log(`[API] Cleanup successful: ${tempPath}`);
                }
            } catch (e) {
                console.warn(`[API] Failed to cleanup temp file ${tempPath}`, e);
            }
        }
    }
}
