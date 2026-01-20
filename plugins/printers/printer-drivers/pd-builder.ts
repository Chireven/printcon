import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import crypto from 'crypto';
import { PDManifestSchema } from './service';

/**
 * Utility for building .pd packages from INF driver folders
 * Extracts metadata from Windows driver INF files and creates compliant packages
 */
export class PDPackageBuilder {
    /**
     * Validates that a folder path contains a valid printer driver INF file.
     * 
     * @param folderPath - Path to the driver folder
     * @returns Validation result with INF file path if valid
     */
    static async validateInfPath(folderPath: string): Promise<{
        valid: boolean;
        infFile?: string;
        error?: string;
    }> {
        try {
            // Check if path exists
            const stats = await fs.stat(folderPath);
            if (!stats.isDirectory()) {
                return { valid: false, error: 'Path is not a directory' };
            }

            // Search for .inf files
            const files = await fs.readdir(folderPath);
            const infFiles = files.filter(f => f.toLowerCase().endsWith('.inf'));

            if (infFiles.length === 0) {
                return { valid: false, error: 'No INF files found in folder' };
            }

            // Check all INF files to find a printer driver
            // Prioritize: Printer class > Image class > Others
            let printerInf: string | null = null;
            let imageInf: string | null = null;
            let anyInf: string | null = null;

            for (const infFile of infFiles) {
                const infPath = path.join(folderPath, infFile);
                const content = await fs.readFile(infPath, 'utf8');

                // Check if this is a printer driver
                if (content.includes('Class=Printer') ||
                    content.includes('Class = Printer') ||
                    content.includes('ClassGuid={4D36E979-E325-11CE-BFC1-08002BE10318}')) {
                    printerInf = infPath;
                    break; // Found printer driver, use it
                }

                // Check if this is an image/scanner driver (multi-function device)
                if (!imageInf && (
                    content.includes('Class=Image') ||
                    content.includes('Class       = Image') ||
                    content.match(/SubClass\s*=\s*StillImage/i) !== null
                )) {
                    imageInf = infPath;
                }

                // Keep track of any INF as fallback
                if (!anyInf) {
                    anyInf = infPath;
                }
            }

            // Use printer INF if found, otherwise image INF, otherwise first INF
            const selectedInf = printerInf || imageInf || anyInf;

            if (!selectedInf) {
                return { valid: false, error: 'No valid INF files found' };
            }

            // Validate the selected INF is printer-related
            const content = await fs.readFile(selectedInf, 'utf8');
            const isPrinterDriver =
                content.includes('Class=Printer') ||
                content.includes('Class = Printer') ||
                content.includes('ClassGuid={4D36E979-E325-11CE-BFC1-08002BE10318}') ||
                content.match(/SubClass\s*=\s*StillImage/i) !== null || // Brother multi-function devices
                content.includes('Class=Image') ||
                content.includes('Class       = Image') ||
                content.match(/PrinterDriverData/i) !== null ||
                content.match(/PrintProcessor/i) !== null;

            if (!isPrinterDriver) {
                return { valid: false, error: 'INF file is not a printer driver' };
            }

            return { valid: true, infFile: selectedInf };
        } catch (error: any) {
            return { valid: false, error: error.message || 'Unknown error' };
        }
    }

    /**
     * Parses metadata from an INF file using INFpossible.
     * 
     * @param infPath - Path to the INF file
     * @returns Extracted driver metadata
     */
    static async parseInfMetadata(infPath: string): Promise<{
        displayName: string;
        version: string;
        manufacturer: string;
        architecture: string[];
        hardwareIds: string[];
        models: string[];
    }> {
        // Read INF file content
        const content = await fs.readFile(infPath, 'utf8');
        const fileName = path.basename(infPath);

        // Import INFpossible modules
        const { InfParser } = await import('./infpossible/parser');
        const { InfResolver } = await import('./infpossible/resolver');
        const { InfAnalyzer } = await import('./infpossible/analyzer');

        // Parse INF file
        const parsedInf = InfParser.parseInfFile(content, fileName);

        // Resolve string substitutions
        InfResolver.resolveStrings(parsedInf);

        // Extract metadata
        const metadata = InfAnalyzer.extractDriverMetadata(parsedInf);

        // Return in format expected by buildPackage
        return {
            displayName: metadata.displayName,
            version: metadata.version,
            manufacturer: metadata.manufacturer,
            architecture: metadata.architecture,
            hardwareIds: metadata.hardwareIds,
            models: metadata.models
        };
    }

    /**
     * Builds a .pd package from a driver source folder.
     * 
     * @param sourcePath - Path to the driver folder containing INF
     * @param user - Username performing the build
     * @returns Package buffer and manifest
     */
    static async buildPackage(
        sourcePath: string,
        user: string
    ): Promise<{ packageBuffer: Buffer; manifest: PDManifestSchema; contentHash: string }> {
        // 1. Validate INF path
        const validation = await this.validateInfPath(sourcePath);
        if (!validation.valid || !validation.infFile) {
            throw new Error(validation.error || 'Invalid INF path');
        }

        // 2. Parse INF metadata
        const metadata = await this.parseInfMetadata(validation.infFile);

        // 3. Get INF filename for entryPoint
        const infFilename = path.basename(validation.infFile);

        // 4. Generate manifest with correct entryPoint
        const manifest = this.generateManifest(metadata, user, infFilename);

        // 5. Create deterministic hash from file contents (not ZIP metadata)
        // This allows us to preserve original timestamps while ensuring identical drivers get same hash
        const contentHash = await this.hashDriverContents(sourcePath, manifest);

        // 6. Create ZIP structure with ORIGINAL timestamps preserved
        const zip = new AdmZip();

        // Add manifest.json at root
        zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

        // Add all driver files to payload/ folder
        await this.addPayloadToZip(zip, sourcePath);

        // 7. Generate buffer
        const packageBuffer = zip.toBuffer();

        return { packageBuffer, manifest, contentHash };
    }

    /**
     * Generates a compliant .pd manifest from INF metadata.
     * 
     * @param metadata - Parsed INF metadata
     * @param user - Username
     * @param infFilename - Name of the INF file for entryPoint
     * @returns PDManifestSchema object
     */
    private static generateManifest(
        metadata: {
            displayName: string;
            version: string;
            manufacturer: string;
            architecture: string[];
            hardwareIds: string[];
            models: string[];
        },
        user: string,
        infFilename: string
    ): PDManifestSchema {
        // Generate deterministic package ID based on driver content
        // This ensures the same driver uploaded twice produces the same hash
        const deterministicString = `${metadata.displayName}-${metadata.version}-${metadata.manufacturer}`;
        const packageId = crypto.createHash('sha256').update(deterministicString).digest('hex');

        // Set entryPoint to the actual INF file in payload folder
        const entryPoint = `payload/${infFilename}`;

        return {
            schemaVersion: '1.0',
            packageInfo: {
                id: packageId,
                createdAt: '2024-01-01T00:00:00.000Z', // Fixed timestamp for deterministic hashing
                createdBy: user
            },
            driverMetadata: {
                displayName: metadata.displayName,
                version: metadata.version,
                vendor: metadata.manufacturer,
                architecture: metadata.architecture,
                supportedOS: ['Windows 10', 'Windows 11', 'Windows Server 2016', 'Windows Server 2019', 'Windows Server 2022'],
                driverClass: 'v4',
                entryPoint: entryPoint
            },
            hardwareSupport: {
                pnpIds: metadata.hardwareIds,
                compatibleModels: metadata.models
            }
        };
    }

    /**
     * Adds all files from source folder to the ZIP under payload/ directory.
     * Original timestamps are preserved.
     * 
     * @param zip - AdmZip instance
     * @param sourcePath - Source folder path
     */
    private static async addPayloadToZip(zip: AdmZip, sourcePath: string): Promise<void> {
        const files = await fs.readdir(sourcePath, { withFileTypes: true });

        for (const file of files) {
            const fullPath = path.join(sourcePath, file.name);

            if (file.isDirectory()) {
                // Recursively add directory contents
                const subFiles = await this.getAllFiles(fullPath);
                for (const subFile of subFiles) {
                    const relativePath = path.relative(sourcePath, subFile);
                    const fileContent = await fs.readFile(subFile);
                    zip.addFile(`payload/${relativePath}`, fileContent);
                }
            } else {
                // Add individual file
                const fileContent = await fs.readFile(fullPath);
                zip.addFile(`payload/${file.name}`, fileContent);
            }
        }
    }

    /**
     * Creates deterministic hash from driver files ONLY (payload directory).
     * Completely ignores manifest, metadata, and ZIP structure.
     * This allows format evolution without affecting deduplication.
     * 
     * @param sourcePath - Path to driver folder (becomes payload/)
     * @param manifest - Package manifest (not used for hashing)
     * @returns SHA256 hash of driver file contents only
     */
    private static async hashDriverContents(sourcePath: string, manifest: PDManifestSchema): Promise<string> {
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha256');

        // Get all files from driver folder and sort by path for deterministic order
        const allFiles = await this.getAllFiles(sourcePath);
        const sortedFiles = allFiles.sort();

        // Hash ONLY the driver file contents in sorted order
        // No manifest, no metadata - pure driver content
        for (const filePath of sortedFiles) {
            const relativePath = path.relative(sourcePath, filePath);
            const content = await fs.readFile(filePath);

            // Include relative filename in hash to detect renames
            hash.update(relativePath);
            hash.update(content);
        }

        return hash.digest('hex');
    }

    /**
     * Recursively gets all files in a directory.
     * 
     * @param dirPath - Directory path
     * @returns Array of file paths
     */
    private static async getAllFiles(dirPath: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await this.getAllFiles(fullPath);
                files.push(...subFiles);
            } else {
                files.push(fullPath);
            }
        }

        return files;
    }
}
