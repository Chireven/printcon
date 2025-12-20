import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = util.promisify(exec);

const logDebug = (msg: string) => {
    try {
        fs.appendFileSync('debug-drivers.log', `${new Date().toISOString()} - ${msg}\n`);
    } catch { }
};

// Fast Heuristic for counting models
const countModels = (infPath: string): number => {
    try {
        if (!infPath || !fs.existsSync(infPath)) return 0;

        const buffer = fs.readFileSync(infPath);
        let text = '';
        if (buffer[0] === 0xFF && buffer[1] === 0xFE) text = buffer.toString('utf16le');
        else text = buffer.toString('utf8');

        const matches = text.match(/^\s*"[^"]+"\s*=/gm);
        return matches ? matches.length : 0;
    } catch { return 0; }
};

export async function GET(req: Request) {
    logDebug('Starting Driver Enumeration');
    try {
        // Extract serverName from query params
        const { searchParams } = new URL(req.url);
        const serverName = searchParams.get('serverName');

        if (serverName) {
            logDebug(`Querying remote server: ${serverName}`);
        }

        const drivers: any[] = [];
        const queries = [];

        // 1. Spooler Query (supports remote via -ComputerName)
        queries.push((async () => {
            try {
                const computerNameArg = serverName ? ` -ComputerName "${serverName}"` : '';
                const psCommand = `Get-PrinterDriver${computerNameArg} | Select-Object Name, DriverVersion, Manufacturer, InfPath | ConvertTo-Json -Compress`;
                const { stdout } = await execAsync(`powershell -Command "${psCommand}"`);
                const data = JSON.parse(stdout || '[]');
                const list = Array.isArray(data) ? data : [data];
                logDebug(`Spooler found ${list.length} drivers`);
                return list.map((d: any) => ({
                    Name: d.Name,
                    Version: d.DriverVersion,
                    Provider: d.Manufacturer,
                    Source: 'Spooler',
                    InfPath: d.InfPath,
                    ModelCount: serverName ? 0 : countModels(d.InfPath) // Skip count for remote (no direct file access)
                }));
            } catch (e: any) {
                logDebug(`Spooler Error: ${e.message}`);
                return [];
            }
        })());

        // 2. Driver Store Query (only for local - Get-WindowsDriver doesn't support -ComputerName)
        if (!serverName) {
            queries.push((async () => {
                try {
                    const cmd = 'powershell -Command "Get-WindowsDriver -Online -All | Where-Object { $_.ClassName -eq \'Printer\' -or $_.Class -eq \'Printer\' } | Select-Object ClassName, ProviderName, Version, OriginalFileName, Driver | ConvertTo-Json -Compress"';
                    logDebug('Executing Store Query...');
                    const { stdout } = await execAsync(cmd);

                    if (!stdout || !stdout.trim()) return [];

                    const data = JSON.parse(stdout);
                    const list = Array.isArray(data) ? data : [data];
                    logDebug(`Store found ${list.length} drivers`);

                    return list.map((d: any) => ({
                        Name: d.Driver || path.basename(d.OriginalFileName || 'Unknown'),
                        Version: d.Version,
                        Provider: d.ProviderName,
                        Source: 'DriverStore',
                        InfPath: d.OriginalFileName,
                        ModelCount: countModels(d.OriginalFileName)
                    }));
                } catch (e: any) {
                    logDebug(`Store Error: ${e.message}`);
                    return [];
                }
            })());
        }

        const results = await Promise.all(queries);
        const spoolerDrivers = results[0];
        const storeDrivers = results[1] || [];

        const driverMap = new Map();

        spoolerDrivers.forEach((d: any) => {
            if (d.InfPath) driverMap.set(d.InfPath.toLowerCase(), d);
        });

        storeDrivers.forEach((d: any) => {
            if (d.InfPath) {
                const key = d.InfPath.toLowerCase();
                if (driverMap.has(key)) {
                    const existing = driverMap.get(key);
                    existing.Source = 'Spooler & Store';
                } else {
                    driverMap.set(key, d);
                }
            }
        });

        const finalDrivers = Array.from(driverMap.values());
        return NextResponse.json({ files: finalDrivers });

    } catch (error: any) {
        logDebug(`Global Error: ${error.message}`);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
