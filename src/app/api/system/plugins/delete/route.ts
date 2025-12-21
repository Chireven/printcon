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

        // ... imports

        // Execute the delete script
        const { stdout, stderr } = await execAsync(`npm run plugin:delete ${pluginId}`);

        console.log('[API] Delete Output:', stdout);
        if (stderr) console.error('[API] Delete Stderr:', stderr);

        // Broadcast event to UI
        broadcastSystemEvent({
            event: 'PLUGIN_DELETED',
            data: { pluginId, status: 'success' }
        });

        return NextResponse.json({
            status: 'success',
            message: `Plugin ${pluginId} deleted successfully.`,
            output: stdout
        });

    } catch (error: any) {
        console.error('[API] Delete Failed:', error);
        return NextResponse.json({
            error: 'Failed to delete plugin',
            details: error.message
        }, { status: 500 });
    }
}
