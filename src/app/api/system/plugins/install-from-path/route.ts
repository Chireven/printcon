import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { broadcastSystemEvent } from '../../events/route';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const { path: filePath } = await req.json();

        if (!filePath) {
            return NextResponse.json({ error: 'File path is required' }, { status: 400 });
        }

        console.log(`[API] Triggering install from local path: ${filePath}`);

        // Execute the install script
        const { stdout, stderr } = await execAsync(`npm run plugin:install "${filePath}" -- --update`);

        console.log('[API] Install Output:', stdout);
        if (stderr) console.error('[API] Install Stderr:', stderr);

        // Broadcast event to UI
        broadcastSystemEvent({
            event: 'PLUGIN_INSTALLED',
            data: { status: 'success' }
        });

        return NextResponse.json({
            status: 'success',
            message: `Plugin installed successfully.`,
            output: stdout
        });

    } catch (error: any) {
        console.error('[API] Install Failed:', error);
        return NextResponse.json({
            error: 'Failed to install plugin',
            details: error.message
        }, { status: 500 });
    }
}
