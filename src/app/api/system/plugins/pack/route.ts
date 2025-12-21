import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { broadcastSystemEvent } from '../../events/route';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const { pluginId } = await req.json();

        if (!pluginId) {
            return NextResponse.json({ error: 'Plugin ID is required' }, { status: 400 });
        }

        // Execute the pack script
        // Using --force to overwrite existing
        const { stdout, stderr } = await execAsync(`npm run plugin:pack -- ${pluginId} --force`);

        console.log('[API] Pack Output:', stdout);
        if (stderr) console.error('[API] Pack Stderr:', stderr);

        // Broadcast event to UI
        broadcastSystemEvent({
            event: 'PLUGIN_PACKED',
            data: { pluginId, status: 'success' }
        });

        return NextResponse.json({
            status: 'success',
            message: `Plugin ${pluginId} packed successfully.`,
            output: stdout
        });

    } catch (error: any) {
        console.error('[API] Pack Failed:', error);
        return NextResponse.json({
            error: 'Failed to pack plugin',
            details: error.message
        }, { status: 500 });
    }
}
