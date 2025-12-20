import { NextResponse } from 'next/server';
import fs from 'fs';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { infPath } = body;

        if (!infPath || !fs.existsSync(infPath)) {
            if (process.env.NODE_ENV === 'development' && infPath.includes('Mock')) {
                return NextResponse.json({
                    models: ['HP LaserJet Mock 100', 'HP LaserJet Mock 200']
                });
            }
            return NextResponse.json({ status: 'error', message: 'INF not found' }, { status: 404 });
        }

        // Handle encoding
        const buffer = fs.readFileSync(infPath);
        let text = '';
        if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
            text = buffer.toString('utf16le');
        } else {
            text = buffer.toString('utf8');
        }

        const lines = text.split(/\r?\n/);
        let currentSection = '';
        const manufacturers: string[] = [];
        const models = new Set<string>();
        const strings = new Map<string, string>();

        // 1. Parse Strings Section First
        let inStrings = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';')) continue;

            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                const sec = trimmed.slice(1, -1).toLowerCase();
                inStrings = (sec === 'strings');
                continue;
            }

            if (inStrings) {
                // Key = "Value" or Key = Value
                const parts = trimmed.split('=');
                if (parts.length > 1) {
                    const key = parts[0].trim().replace(/^"|"$/g, '');
                    let val = parts.slice(1).join('=').trim();
                    if (val.startsWith('"') && val.endsWith('"')) {
                        val = val.slice(1, -1);
                    }
                    strings.set(key.toLowerCase(), val);
                }
            }
        }

        // 2. Find Manufacturers
        let inManufacturer = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';')) continue;

            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                currentSection = trimmed.slice(1, -1);
                inManufacturer = (currentSection.toLowerCase() === 'manufacturer');
                continue;
            }

            if (inManufacturer) {
                const parts = trimmed.split('=');
                if (parts.length > 1) {
                    const rhs = parts[1].trim();
                    const tokens = rhs.split(',').map(t => t.trim());
                    if (tokens.length > 0) {
                        let mfgName = tokens[0];
                        // Resolve RHS substitution (e.g. %Msft% = %MsftSection% or "Microsoft" = %MsftSection%)
                        if (mfgName.startsWith('%') && mfgName.endsWith('%')) {
                            const token = mfgName.slice(1, -1).toLowerCase();
                            if (strings.has(token)) {
                                mfgName = strings.get(token) || mfgName;
                            }
                        }
                        manufacturers.push(mfgName);
                    }
                }
            }
        }

        // 3. Find Models
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';')) continue;

            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                currentSection = trimmed.slice(1, -1);
                continue;
            }

            const isTarget = manufacturers.some(m =>
                currentSection.toLowerCase() === m.toLowerCase() ||
                currentSection.toLowerCase().startsWith(m.toLowerCase() + '.') ||
                currentSection.toLowerCase().startsWith(m.toLowerCase() + ',')
            );

            if (isTarget) {
                // "Model Name" = ...
                // Or %String% = ...
                let match = trimmed.match(/^"(.+?)"\s*=/);
                let rawName = match ? match[1] : null;

                // Try unquoted
                if (!rawName) {
                    const parts = trimmed.split('=');
                    if (parts.length > 1) {
                        rawName = parts[0].trim();
                    }
                }

                if (rawName) {
                    // Check for variable substitution
                    // e.g. %HP_M402%
                    if (rawName.startsWith('%') && rawName.endsWith('%')) {
                        const token = rawName.slice(1, -1).toLowerCase();
                        if (strings.has(token)) {
                            rawName = strings.get(token);
                        }
                    }

                    // Map known Core Driver GUIDs to friendly names
                    const coreDriverGUIDs: { [key: string]: string } = {
                        '{D20EA372-DD35-4950-9ED8-A6335AFE79F0}': 'Microsoft Universal Printer Driver (Unidrv Core)',
                        '{D20EA372-DD35-4950-9ED8-A6335AFE79F5}': 'Microsoft PostScript Printer Driver (PScript Core)',
                        '{46D1E203-D018-4568-B70F-985A3F053916}': 'Microsoft PostScript Printer Driver (PScript5 Core)',
                    };

                    // Check if rawName is a known core driver GUID
                    if (rawName && rawName.match(/^\{[0-9a-fA-F-]{36}\}$/)) {
                        const friendlyName = coreDriverGUIDs[rawName.toUpperCase()];
                        if (friendlyName) {
                            models.add(friendlyName);
                        }
                        // Skip unknown GUIDs - they're likely internal interfaces
                    } else if (rawName) {
                        models.add(rawName);
                    }
                }
            }
        }

        return NextResponse.json({ models: Array.from(models).sort() });

    } catch (e: any) {
        return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
    }
}
