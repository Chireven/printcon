import { InboxDriver } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Local Inbox Driver Extractor
 * 
 * Enumerates and exports printer drivers from local Windows DriverStore.
 */
export class LocalInboxExtractor {
    /**
     * Lists all printer drivers from local DriverStore using pnputil.
     * Shows only drivers currently installed in the DriverStore.
     * 
     * @returns Array of inbox drivers
     */
    static async listInboxDrivers(): Promise<InboxDriver[]> {
        try {
            console.log('[LocalInboxExtractor] Executing: pnputil /enum-drivers');

            const { stdout, stderr } = await execAsync('pnputil /enum-drivers');

            if (stderr) {
                console.warn('[LocalInboxExtractor] pnputil stderr:', stderr);
            }

            console.log('[LocalInboxExtractor] Raw pnputil output length:', stdout.length);

            const allDrivers = this.parsePnpUtilOutput(stdout);

            const printerDrivers = allDrivers.filter(d =>
                d.className?.toLowerCase() === 'printer'
            );

            console.log('[LocalInboxExtractor] Total drivers parsed:', allDrivers.length);
            console.log('[LocalInboxExtractor] Printer drivers found:', printerDrivers.length);

            return printerDrivers;
        } catch (error: any) {
            console.error('[LocalInboxExtractor] pnputil failed:', error);
            throw new Error(`Failed to enumerate drivers: ${error.message}`);
        }
    }

    /**
     * Checks if an INF file is a printer driver.
     * 
     * @param content - INF file content
     * @returns True if printer driver
     */
    private static isPrinterDriver(content: string): boolean {
        const lowerContent = content.toLowerCase();

        // Check for Class=Printer
        if (lowerContent.includes('class=printer') ||
            lowerContent.includes('class = printer')) {
            return true;
        }

        // Check for printer ClassGuid
        if (lowerContent.includes('{4d36e979-e325-11ce-bfc1-08002be10318}')) {
            return true;
        }

        return false;
    }

    /**
     * Extracts metadata from an INF file.
     * 
     * @param content - INF file content
     * @param infFileName - INF file name
     * @param folderName - Driver folder name
     * @returns InboxDriver metadata or null
     */
    private static extractInfMetadata(content: string, infFileName: string, folderName: string): InboxDriver | null {
        try {
            const lines = content.split('\n');
            let provider = 'Unknown';
            let version = 'Unknown';
            let date = 'Unknown';
            let displayName: string | undefined;
            let signerName: string | undefined;

            // Track string variables for substitution
            const strings: Record<string, string> = {};
            let inStringsSection = false;

            for (const line of lines) {
                const trimmed = line.trim();

                // Detect [Strings] section
                if (trimmed.toLowerCase() === '[strings]') {
                    inStringsSection = true;
                    continue;
                } else if (trimmed.startsWith('[') && inStringsSection) {
                    inStringsSection = false;
                }

                // Parse strings section
                if (inStringsSection && trimmed.includes('=')) {
                    const match = trimmed.match(/^([^=]+)=\s*["']?([^"'\r\n]+)["']?/);
                    if (match) {
                        strings[match[1].trim()] = match[2].trim();
                    }
                }

                // Provider="Microsoft" or Provider=%ProviderString%
                if (trimmed.toLowerCase().startsWith('provider')) {
                    const match = trimmed.match(/=\s*["']?([^"'\r\n]+)["']?/i);
                    if (match) {
                        const value = match[1].trim();
                        // Resolve string variable if it starts with %
                        provider = value.startsWith('%') && value.endsWith('%')
                            ? strings[value.slice(1, -1)] || value
                            : value;
                    }
                }

                // DriverVer=MM/DD/YYYY,1.0.0.0
                if (trimmed.toLowerCase().startsWith('driverver')) {
                    const match = trimmed.match(/=\s*([^,\r\n]+),\s*([^\r\n]+)/i);
                    if (match) {
                        date = match[1].trim();
                        version = match[2].trim();
                    }
                }

                // Try to get display name from Manufacturer or first model
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

            // Use folder name as OEM INF identifier
            const oemInf = folderName + '/' + infFileName;

            // If no display name found, try to extract from strings
            if (!displayName) {
                // Look for common driver name keys
                const nameKeys = ['DriverDesc', 'DeviceDesc', 'DiskName', 'ClassName'];
                for (const key of nameKeys) {
                    if (strings[key]) {
                        displayName = strings[key];
                        break;
                    }
                }
            }

            return {
                oemInf,
                provider,
                className: 'Printer',
                version,
                date,
                displayName: displayName || infFileName.replace('.inf', ''),
                signerName: signerName || 'Microsoft Windows'
            };
        } catch (err: any) {
            console.warn('[LocalInboxExtractor] Failed to extract metadata from', infFileName, ':', err.message);
            return null;
        }
    }

    /**
     * Exports a specific driver from DriverStore to a temporary folder.
     * 
     * @param oemInf - OEM INF name (e.g., "oem42.inf")
     * @param tempPath - Temporary path to export to
     * @returns Path to exported driver folder
     */
    static async exportInboxDriver(oemInf: string, tempPath: string): Promise<string> {
        try {
            // Ensure temp path exists
            const fs = await import('fs/promises');
            await fs.mkdir(tempPath, { recursive: true });

            // Execute pnputil to export the driver
            const exportPath = `${tempPath}\\${oemInf.replace('.inf', '')}`;
            const command = `pnputil /export-driver ${oemInf} /output-directory "${exportPath}"`;

            console.log('[LocalInboxExtractor] Exporting with command:', command);
            await execAsync(command);

            // Expand compressed files if any
            await this.expandCompressedFiles(exportPath);

            return exportPath;
        } catch (error: any) {
            console.error('[LocalInboxExtractor] Failed to export driver:', error);
            throw new Error(`Failed to export driver: ${error.message}`);
        }
    }

    /**
     * Parses pnputil /enum-drivers output into structured data.
     * 
     * @param output - Raw pnputil output
     * @returns Array of inbox drivers
     */
    private static parsePnpUtilOutput(output: string): InboxDriver[] {
        const drivers: InboxDriver[] = [];
        const lines = output.split('\n');

        let currentDriver: Partial<InboxDriver> = {};
        let driverCount = 0;

        for (const line of lines) {
            const trimmed = line.trim();

            // Published Name: oem42.inf
            if (trimmed.startsWith('Published Name') || trimmed.startsWith('Published name')) {
                if (currentDriver.oemInf) {
                    // Save previous driver if valid
                    driverCount++;
                    if (this.isValidDriver(currentDriver)) {
                        drivers.push(this.normalizeDriver(currentDriver));
                        console.log('[LocalInboxExtractor] Added driver:', currentDriver.oemInf, currentDriver.className);
                    } else {
                        console.log('[LocalInboxExtractor] Skipped incomplete driver:', currentDriver.oemInf, 'Missing:', this.getMissingFields(currentDriver));
                    }
                    currentDriver = {};
                }
                const match = trimmed.match(/:\s*(.+)/);
                if (match) currentDriver.oemInf = match[1].trim();
            }

            // Original Name: hpcu250u.inf (may contain provider info)
            if (trimmed.startsWith('Original Name')) {
                const match = trimmed.match(/:\s*(.+)/);
                if (match && !currentDriver.provider) {
                    currentDriver.provider = match[1].trim();
                }
            }

            // Provider Name: HP
            if (trimmed.startsWith('Provider Name')) {
                const match = trimmed.match(/:\s*(.+)/);
                if (match) currentDriver.provider = match[1].trim();
            }

            // Class Name: Printer
            if (trimmed.startsWith('Class Name')) {
                const match = trimmed.match(/:\s*(.+)/);
                if (match) currentDriver.className = match[1].trim();
            }

            // Driver Version: 1.0.0.0
            if (trimmed.startsWith('Driver Version')) {
                const match = trimmed.match(/:\s*(.+)/);
                if (match) {
                    // Extract just the version number (format: "MM/DD/YYYY 1.0.0.0")
                    const versionMatch = match[1].match(/(\d+\.\d+\.\d+\.\d+)/);
                    if (versionMatch) {
                        currentDriver.version = versionMatch[1];
                        // Also extract date if present
                        const dateMatch = match[1].match(/(\d{2}\/\d{2}\/\d{4})/);
                        if (dateMatch) {
                            currentDriver.date = dateMatch[1];
                        }
                    }
                }
            }

            // Driver Date: 12/20/2024 (standalone)
            if (trimmed.startsWith('Driver Date')) {
                const match = trimmed.match(/:\s*(.+)/);
                if (match) currentDriver.date = match[1].trim();
            }

            // Signer Name: Microsoft Windows Hardware Compatibility Publisher
            if (trimmed.startsWith('Signer Name')) {
                const match = trimmed.match(/:\s*(.+)/);
                if (match) currentDriver.signerName = match[1].trim();
            }
        }

        // Add last driver if valid
        if (currentDriver.oemInf) {
            driverCount++;
            if (this.isValidDriver(currentDriver)) {
                drivers.push(this.normalizeDriver(currentDriver));
                console.log('[LocalInboxExtractor] Added driver:', currentDriver.oemInf, currentDriver.className);
            } else {
                console.log('[LocalInboxExtractor] Skipped incomplete driver:', currentDriver.oemInf, 'Missing:', this.getMissingFields(currentDriver));
            }
        }

        console.log('[LocalInboxExtractor] Parsed', drivers.length, 'valid drivers from', driverCount, 'total driver entries');

        return drivers;
    }

    /**
     * Checks if a driver object has minimum required fields.
     * More lenient than before - only requires oemInf, provider, and className
     * 
     * @param driver - Partial driver object
     * @returns True if valid
     */
    private static isValidDriver(driver: Partial<InboxDriver>): boolean {
        return !!(driver.oemInf && driver.provider && driver.className);
    }

    /**
     * Normalizes a driver object, filling in defaults for missing fields.
     * 
     * @param driver - Partial driver object
     * @returns Complete InboxDriver
     */
    private static normalizeDriver(driver: Partial<InboxDriver>): InboxDriver {
        return {
            oemInf: driver.oemInf!,
            provider: driver.provider!,
            className: driver.className!,
            version: driver.version || 'Unknown',
            date: driver.date || 'Unknown',
            signerName: driver.signerName
        };
    }

    /**
     * Gets a list of missing required fields for debugging.
     * 
     * @param driver - Partial driver object
     * @returns Array of missing field names
     */
    private static getMissingFields(driver: Partial<InboxDriver>): string[] {
        const missing: string[] = [];
        if (!driver.oemInf) missing.push('oemInf');
        if (!driver.provider) missing.push('provider');
        if (!driver.className) missing.push('className');
        return missing;
    }

    /**
     * Expands compressed files in the exported driver folder.
     * Uses Windows expand.exe to decompress .dl_, .ex_, etc.
     * 
     * @param exportPath - Path to exported driver folder
     */
    private static async expandCompressedFiles(exportPath: string): Promise<void> {
        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            // Get all files in the export folder
            const files = await fs.readdir(exportPath);

            // Process compressed files
            for (const file of files) {
                if (file.endsWith('_')) {
                    // This is a compressed file
                    const compressedPath = path.join(exportPath, file);
                    const expandedName = this.getExpandedFileName(file);
                    const expandedPath = path.join(exportPath, expandedName);

                    // Use Windows expand.exe to decompress
                    const command = `expand "${compressedPath}" "${expandedPath}"`;
                    await execAsync(command);

                    console.log(`[LocalInboxExtractor] Expanded ${file} → ${expandedName}`);
                }
            }
        } catch (error: any) {
            console.warn('[LocalInboxExtractor] Some files may not have been expanded:', error.message);
            // Don't throw - some drivers may not have compressed files
        }
    }

    /**
     * Gets the expanded filename from a compressed filename.
     * 
     * @param compressedName - Compressed filename (e.g., "unidrv.dl_")
     * @returns Expanded filename (e.g., "unidrv.dll")
     */
    private static getExpandedFileName(compressedName: string): string {
        const { CompressionMapper } = require('../compression');
        return CompressionMapper.mapExpandedName(compressedName);
    }

    /**
     * Exports an inbox driver from DriverStore to a folder.
     * 
     * @param oemInf - OEM INF identifier (e.g., oem43.inf)
     * @param destinationPath - Target folder path
     * @returns Path to exported driver folder
     */
    static async exportInboxDriver(oemInf: string, destinationPath: string): Promise<string> {
        try {
            const fs = await import('fs/promises');

            // Extract just the INF filename
            const infFileName = oemInf.includes('/') ? oemInf.split('/').pop()! : oemInf;

            console.log('[LocalInboxExtractor] Exporting driver:', infFileName, 'to', destinationPath);

            // Ensure destination directory exists
            await fs.mkdir(destinationPath, { recursive: true });

            // Export using pnputil
            const command = `pnputil /export-driver "${infFileName}" "${destinationPath}"`;
            console.log('[LocalInboxExtractor] Executing:', command);

            const { stdout, stderr } = await execAsync(command);

            if (stderr) console.warn('[LocalInboxExtractor] stderr:', stderr);
            console.log('[LocalInboxExtractor] stdout:', stdout);

            // Verify export succeeded
            const files = await fs.readdir(destinationPath);
            const exportedInf = files.find(f => f.toLowerCase().endsWith('.inf'));

            if (!exportedInf) {
                throw new Error('Export completed but no INF file found in destination');
            }

            console.log('[LocalInboxExtractor] Successfully exported to:', destinationPath);
            return destinationPath;
        } catch (error: any) {
            console.error('[LocalInboxExtractor] Export failed:', error);
            throw new Error(`Failed to export driver: ${error.message}`);
        }
    }
}
