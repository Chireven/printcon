import { NextResponse } from 'next/server';
import { PrinterService } from '../service';

/**
 * Driver Package List API
 * Retrieves all uploaded driver packages.
 */
export async function GET() {
    try {
        const packages = await PrinterService.listPackages();

        return NextResponse.json({
            status: 'success',
            packages: packages
        });

    } catch (error: any) {
        console.error('List Drivers Error:', error);
        return NextResponse.json(
            { status: 'error', message: error.message || 'Failed to retrieve drivers' },
            { status: 500 }
        );
    }
}
