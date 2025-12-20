import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { serverName } = body;

        if (!serverName || typeof serverName !== 'string') {
            return NextResponse.json({ online: false, error: 'Server name is required' }, { status: 400 });
        }

        // Test connectivity using Test-Connection
        const psCommand = `Test-Connection -ComputerName "${serverName}" -Count 1 -Quiet`;

        try {
            const { stdout } = await execAsync(`powershell.exe -Command "${psCommand}"`, {
                timeout: 10000 // 10 second timeout
            });

            const isOnline = stdout.trim().toLowerCase() === 'true';

            return NextResponse.json({
                online: isOnline,
                error: isOnline ? undefined : 'Server is not responding to ping'
            });
        } catch (error: any) {
            return NextResponse.json({
                online: false,
                error: error.message || 'Connection test failed'
            });
        }
    } catch (e: any) {
        return NextResponse.json({
            online: false,
            error: e.message || 'Invalid request'
        }, { status: 500 });
    }
}
