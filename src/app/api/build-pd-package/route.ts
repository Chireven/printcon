import { NextResponse } from 'next/server';
import { PDPackageBuilder } from '../../../../plugins/printers/printer-drivers/pd-builder';
import { PrinterService } from '../../../../plugins/printers/printer-drivers/service';

/**
 * API endpoint to build a .pd package from an INF driver folder and upload it
 */
export async function POST(req: Request) {
    try {
        const { sourcePath, user } = await req.json();

        if (!sourcePath) {
            return NextResponse.json(
                { status: 'error', message: 'Source path is required' },
                { status: 400 }
            );
        }

        const username = user || 'system';

        // 1. Build .pd package from INF folder
        const { packageBuffer, manifest } = await PDPackageBuilder.buildPackage(
            sourcePath,
            username
        );

        // 2. Upload package using existing service
        const result = await PrinterService.savePackage(
            packageBuffer,
            `${manifest.driverMetadata.displayName}.pd`,
            username
        );

        console.log(`[API] Saved package ${result.id} to database. Manifest:`, manifest.driverMetadata);

        // 3. Return success with manifest metadata
        return NextResponse.json({
            status: 'success',
            packageId: result.id,
            manifest: {
                displayName: manifest.driverMetadata.displayName,
                version: manifest.driverMetadata.version,
                supportedModels: manifest.hardwareSupport.compatibleModels.length,
                pnpIds: manifest.hardwareSupport.pnpIds.length
            }
        });

    } catch (error: any) {
        console.error('Package Build Error:', error);
        return NextResponse.json(
            { status: 'error', message: error.message || 'Package build failed' },
            { status: 500 }
        );
    }
}
