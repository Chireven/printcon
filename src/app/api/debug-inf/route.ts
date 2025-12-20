import { NextResponse } from 'next/server';
import fs from 'fs/promises';

/**
 * Debug endpoint to read and analyze INF file structure
 */
export async function POST(req: Request) {
    try {
        const { filePath } = await req.json();

        if (!filePath) {
            return NextResponse.json(
                { error: 'File path is required' },
                { status: 400 }
            );
        }

        // Read the INF file
        const content = await fs.readFile(filePath, 'utf8');

        // Extract key sections for debugging
        const analysis = {
            fileSize: content.length,
            lineCount: content.split('\n').length,

            // Check for printer class
            hasClassPrinter: content.includes('Class=Printer'),
            hasClassGuid: content.includes('4D36E979'),

            // Extract version
            versionMatch: content.match(/DriverVer\s*=\s*([^\n]+)/i),

            // Extract manufacturer section
            manufacturerSection: content.match(/\[Manufacturer\]\s*\n((?:[^\[\n]+\n)*)/i)?.[0],

            // Find model sections
            modelSections: [],

            // Raw content preview (first 2000 chars)
            preview: content.substring(0, 2000)
        };

        // Find all section headers
        const sectionMatches = content.matchAll(/^\[([^\]]+)\]/gm);
        const sections = Array.from(sectionMatches).map(m => m[1]);
        analysis.modelSections = sections;

        return NextResponse.json({
            status: 'success',
            analysis,
            fullContent: content // Return full content for detailed analysis
        });

    } catch (error: any) {
        console.error('Debug INF Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to read INF file' },
            { status: 500 }
        );
    }
}
