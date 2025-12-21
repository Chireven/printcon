import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> } // Next.js 15+ params are promises (safe pattern) or generic access
) {
    // Await params if necessary or access directly depending on Next.js version in use. 
    // Given package.json says next ^16.0.10, params is a Promise.
    const { id: driverId } = await context.params;
    const { searchParams } = new URL(req.url);
    const requestedName = searchParams.get('name');

    // Sanitize filename: Replace non-alphanumeric (except spaces/dots/hyphens) with underscore
    let filename = driverId;
    if (requestedName) {
        filename = requestedName.replace(/[^a-z0-9 \.\-_]/gi, '_').trim();
    }

    // Ensure .zip extension
    if (!filename.toLowerCase().endsWith('.zip')) {
        filename += '.zip';
    }

    try {
        // 1. Resolve Package Hash from DB
        const { PrinterService } = await import('../../../../../../plugins/printers/printer-drivers/service');
        const db = await (PrinterService as any).getDB(); // Cast to access private/adapter logic

        // We need the database to look up the hash. 
        // PrinterService.getDB returns the adapter { query: ... }
        const lookup = await db.query('SELECT StorageHash FROM [plg_printer_drivers].Packages WHERE PackageId = @driverId', { driverId });

        if (!lookup || lookup.length === 0) {
            return NextResponse.json({ error: 'Driver package not found' }, { status: 404 });
        }

        const hash = lookup[0].StorageHash;

        // 2. Read File from Storage
        // We can replicate the storage path logic here or expose a helper in Service.
        // For speed, let's replicate logic: {shard1}/{hash}.pd
        const hashLower = hash.toLowerCase();
        const shard1 = hashLower.substring(0, 2);
        const relativePath = `${shard1}/${hashLower}.pd`;

        const storage = await (PrinterService as any).getStorage();

        let fileBuffer: Buffer;
        try {
            fileBuffer = await storage.read(relativePath);
        } catch (e) {
            // Fallback to 2-tier check? Service handles writes to 1-tier, but reads might be legacy?
            // "DriverRepository Storage Architecture" says read handles fallback.
            // But storage.read might be raw FS.
            // Let's assume standard path for now as we just wrote it.
            console.error(`File not found at ${relativePath}:`, e);
            return NextResponse.json({ error: 'Package file missing from storage' }, { status: 500 });
        }

        // 3. Open Real Package
        const sourceZip = new AdmZip(fileBuffer);
        const targetZip = new AdmZip();
        const entries = sourceZip.getEntries();

        // 4. Repackage - Flatten Payload
        entries.forEach((entry) => {
            if (entry.entryName.startsWith('payload/') && !entry.isDirectory) {
                const newName = entry.entryName.replace(/^payload\//, '');
                if (newName) {
                    targetZip.addFile(newName, entry.getData());
                }
            }
        });

        const downloadBuffer = targetZip.toBuffer();

        return new NextResponse(downloadBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error: any) {
        console.error('Download Error:', error);
        return NextResponse.json(
            { error: 'Failed to process download', details: error.message },
            { status: 500 }
        );
    }
}
