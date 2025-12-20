import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * File Reading API
 * Reads a file from the server filesystem and returns it as a blob.
 * Supports large files (hundreds of MB).
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { filePath } = body;

        if (!filePath) {
            return NextResponse.json(
                { status: 'error', message: 'File path is required' },
                { status: 400 }
            );
        }

        // Security: Ensure the path exists and is accessible
        const resolvedPath = path.resolve(filePath);

        try {
            const stats = await fs.stat(resolvedPath);

            if (!stats.isFile() && !stats.isDirectory()) {
                return NextResponse.json(
                    { status: 'error', message: 'Path is not a file or directory' },
                    { status: 400 }
                );
            }

            // If it's a directory, we need to zip it first
            // For now, we'll assume the user selected a ZIP file or we need to handle directories
            // Let's read the file directly if it's a file
            if (!stats.isFile()) {
                return NextResponse.json(
                    { status: 'error', message: 'Please select a ZIP file, not a directory' },
                    { status: 400 }
                );
            }

            // Read the file
            const fileBuffer = await fs.readFile(resolvedPath);

            // Return as a blob with appropriate content type
            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': fileBuffer.length.toString()
                }
            });

        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return NextResponse.json(
                    { status: 'error', message: 'File not found' },
                    { status: 404 }
                );
            }
            throw error;
        }

    } catch (error: any) {
        console.error('File Read Error:', error);
        return NextResponse.json(
            { status: 'error', message: error.message || 'Failed to read file' },
            { status: 500 }
        );
    }
}
