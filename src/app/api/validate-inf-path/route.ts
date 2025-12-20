import { NextResponse } from 'next/server';
import { PDPackageBuilder } from '../../../../plugins/printers/printer-drivers/pd-builder';

/**
 * API endpoint to validate if a folder path contains valid printer driver INF files
 */
export async function POST(req: Request) {
    try {
        const { filePath } = await req.json();

        if (!filePath) {
            return NextResponse.json(
                { valid: false, error: 'File path is required' },
                { status: 400 }
            );
        }

        const validation = await PDPackageBuilder.validateInfPath(filePath);

        return NextResponse.json(validation);
    } catch (error: any) {
        console.error('INF Validation Error:', error);
        return NextResponse.json(
            { valid: false, error: error.message || 'Validation failed' },
            { status: 500 }
        );
    }
}
