import { InboxDriver } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * FileRepository Scanner for Windows Inbox Drivers
 * 
 * Scans C:\Windows\System32\DriverStore\FileRepository for all staged printer drivers,
 * not just installed ones. Designed for progressive/streaming results.
 */
export class FileRepositoryScanner {
    private static readonly FILEREPOSITORY_PATH = 'C:\\Windows\\System32\\DriverStore\\FileRepository';
    private static readonly SAMPLE_SIZE = 2048; // Read only 2KB to check class

    /**
     * Scans FileRepository for all printer drivers.
     * Yields results progressively for better UX.
     * 
     * @yields InboxDriver objects as they're discovered
     */
    static async *scanPrinterDrivers(): AsyncGenerator<InboxDriver, void, unknown> {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            console.log('[FileRepositoryScanner] Scanning:', this.FILEREPOSITORY_PATH);

            // Get all driver package folders
            const entries = await fs.readdir(this.FILEREPOSITORY_PATH, { withFileTypes: true });
            const driverFolders = entries.filter(e => e.isDirectory());

            console.log('[FileRepositoryScanner] Found', driverFolders.length, 'driver packages');

            let scannedCount = 0;
            let foundCount = 0;

            for (const folder of driverFolders) {
                scannedCount++;

                // Progress logging every 100 folders
                if (scannedCount % 100 === 0) {
                    console.log('[FileRepositoryScanner] Progress:', scannedCount, '/', driverFolders.length);
                }

                try {
                    const folderPath = path.join(this.FILEREPOSITORY_PATH, folder.name);

                    // Find first INF file
                    const files = await fs.readdir(folderPath);
                    const infFile = files.find(f => f.toLowerCase().endsWith('.inf'));

                    if (!infFile) continue;

                    const infPath = path.join(folderPath, infFile);

                    // Quick check: Read only first 2KB to see if it's a printer driver
                    const isPrinter = await this.isPrinterDriverFast(infPath);

                    if (isPrinter) {
                        foundCount++;

                        // Read full file for complete metadata
                        const fullContent = await fs.readFile(infPath, 'utf-8');
                        const driver = this.extractDriverMetadata(fullContent, infFile, folder.name);

                        if (driver) {
                            console.log('[FileRepositoryScanner] Found:', driver.displayName || driver.provider);
                            yield driver;
                        }
                    }
                } catch (err: any) {
                    // Skip inaccessible folders (permissions, etc.)
                    if (err.code !== 'EACCES' && err.code !== 'EPERM' && err.code !== 'ENOENT') {
                        console.warn('[FileRepositoryScanner] Error in', folder.name, ':', err.message);
                    }
                }
            }

            console.log('[FileRepositoryScanner] Scan complete:', foundCount, 'printer drivers found');
        } catch (error: any) {
            console.error('[FileRepositoryScanner] Fatal scan error:', error);
        }
    }

    /**
     * Fast check if an INF is a printer driver (reads only 2KB).
     * 
     * @param infPath - Path to INF file
     * @returns True if printer driver
     */
    private static async isPrinterDriverFast(infPath: string): Promise<boolean> {
        try {
            const fs = await import('fs/promises');

            // Read only first 2KB
            const fd = await fs.open(infPath, 'r');
            const buffer = Buffer.alloc(this.SAMPLE_SIZE);
            await fd.read(buffer, 0, this.SAMPLE_SIZE, 0);
            await fd.close();

            const content = buffer.toString('utf-8').toLowerCase();

            // Check for Class=Printer or printer ClassGuid
            return content.includes('class=printer') ||
                content.includes('class = printer') ||
                content.includes('{4d36e979-e325-11ce-bfc1-08002be10318}');
        } catch {
            return false;
        }
    }

    /**
     * Extracts complete driver metadata from INF content.
     * 
     * @param content - Full INF file content
     * @param infFileName - INF file name
     * @param folderName - Driver folder name
     * @returns InboxDriver or null
     */
    private static extractDriverMetadata(content: string, infFileName: string, folderName: string): InboxDriver | null {
        try {
            const lines = content.split('\n');
            let provider = 'Unknown';
            let version = 'Unknown';
            let date = 'Unknown';
            let displayName: string | undefined;

            // Parse [Strings] section for name resolution
            const strings: Record<string, string> = {};
            let inStrings = false;

            for (const line of lines) {
                const trimmed = line.trim();

                // Detect [Strings] section
                if (trimmed.toLowerCase() === '[strings]') {
                    inStrings = true;
                    continue;
                } else if (trimmed.startsWith('[') && inStrings) {
                    inStrings = false;
                }

                // Parse strings
                if (inStrings && trimmed.includes('=')) {
                    const match = trimmed.match(/^([^=]+)=\s*["']?([^"'\r\n]+)["']?/);
                    if (match) {
                        strings[match[1].trim()] = match[2].trim();
                    }
                }

                // Provider
                if (trimmed.toLowerCase().startsWith('provider')) {
                    const match = trimmed.match(/=\s*["']?([^"'\r\n]+)["']?/i);
                    if (match) {
                        const value = match[1].trim();
                        provider = value.startsWith('%') && value.endsWith('%')
                            ? strings[value.slice(1, -1)] || value
                            : value;
                    }
                }

                // DriverVer
                if (trimmed.toLowerCase().startsWith('driverver')) {
                    const match = trimmed.match(/=\s*([^,\r\n]+),\s*([^\r\n]+)/i);
                    if (match) {
                        date = match[1].trim();
                        version = match[2].trim();
                    }
                }

                // DriverDesc (for display name)
                if (!displayName && trimmed.toLowerCase().startsWith('driverdesc')) {
                    const match = trimmed.match(/=\s*["']?([^"'\r\n]+)["']?/i);
                    if (match) {
                        const value = match[1].trim();
                        displayName = value.startsWith('%') && value.endsWith('%')
                            ? strings[value.slice(1, -1)] || value
                            : value;
                    }
                }
            }

            // Try to extract display name from common string keys
            if (!displayName) {
                const nameKeys = ['DriverDesc', 'DeviceDesc', 'DiskName', 'ClassName'];
                for (const key of nameKeys) {
                    if (strings[key]) {
                        displayName = strings[key];
                        break;
                    }
                }
            }

            return {
                oemInf: `${folderName}/${infFileName}`,
                provider,
                className: 'Printer',
                version,
                date,
                displayName: displayName || infFileName.replace('.inf', ''),
                signerName: 'Microsoft Windows'
            };
        } catch (err: any) {
            console.warn('[FileRepositoryScanner] Failed to parse', infFileName, ':', err.message);
            return null;
        }
    }
}
