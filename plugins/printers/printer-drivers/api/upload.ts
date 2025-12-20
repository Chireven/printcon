import { NextResponse } from 'next/server';
import { PrinterService } from '../service';

/**
 * Driver Package Upload API
 * Handles driver package uploads with automatic deduplication.
 */
export async function POST(req: Request) {
    try {
        // Parse multipart form data
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const user = formData.get('user') as string || 'system';

        if (!file) {
            return NextResponse.json(
                { status: 'error', message: 'No file provided' },
                { status: 400 }
            );
        }

        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);

        // Save package (with deduplication and manifest extraction)
        const { id, manifest } = await PrinterService.savePackage(
            fileBuffer,
            file.name,
            user
        );

        return NextResponse.json({
            status: 'success',
            message: 'Driver package uploaded successfully',
            packageId: id,
            manifest: {
                displayName: manifest.driverMetadata.displayName,
                version: manifest.driverMetadata.version,
                supportedModels: manifest.hardwareSupport.compatibleModels.length,
                pnpIds: manifest.hardwareSupport.pnpIds.length
            }
        });

    } catch (error: any) {
        console.error('Driver Upload Error:', error);
        return NextResponse.json(
            { status: 'error', message: error.message || 'Upload failed' },
            { status: 500 }
        );
    }
}
