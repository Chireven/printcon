
import { NextRequest, NextResponse } from 'next/server';
import { PrinterService } from '../../../../../plugins/printers/printer-drivers/service';

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Route params are now Promises in strict Next.js types
) {
    try {
        const { id } = await context.params;
        const body = await req.json();


        // Basic validation
        if (!id) {
            return NextResponse.json({ error: 'Driver ID is required' }, { status: 400 });
        }

        console.log('[UPDATE DRIVER] Request Body:', JSON.stringify(body, null, 2));
        console.log('[UPDATE DRIVER] Package ID:', id);

        await PrinterService.updatePackage(id, {
            displayName: body.name,
            version: body.version,
            vendor: body.vendor,
            os: body.os // Service might ignore this if not in DB schema yet, but safe to pass
        });

        console.log('[UPDATE DRIVER] Update completed successfully');

        return NextResponse.json({ success: true, message: 'Driver updated successfully' });
    } catch (error: any) {
        console.error('Update Driver API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update driver' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: 'Driver ID is required' }, { status: 400 });
        }

        console.log('[DELETE DRIVER] Package ID:', id);

        const result = await PrinterService.deletePackage(id);

        console.log('[DELETE DRIVER] Deletion completed:', result);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Delete Driver API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete driver' },
            { status: 500 }
        );
    }
}
