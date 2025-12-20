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
     * Parses metadata from an INF file.
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
        const content = await fs.readFile(infPath, 'utf8');
        const lines = content.split('\n').map(l => l.trim());

        // Extract driver name from file name as fallback
        const fallbackName = path.basename(infPath, '.inf');

        // Extract version (look for DriverVer line)
        let version = '1.0.0';
        const versionLine = lines.find(l => l.match(/^DriverVer\s*=/i));
        if (versionLine) {
            const versionMatch = versionLine.match(/DriverVer\s*=\s*[^,]*,\s*([0-9.]+)/i);
            if (versionMatch) {
                version = versionMatch[1];
            }
        }

        // Extract manufacturer - try multiple patterns
        let manufacturer = 'Unknown';

        // Pattern 1: [Manufacturer] section with company name
        const mfgSectionMatch = content.match(/\[Manufacturer\]\s*\n\s*([^=\n]+)\s*=/i);
        if (mfgSectionMatch) {
            manufacturer = mfgSectionMatch[1].trim().replace(/"/g, '');
        } else {
            // Pattern 2: Look for Provider in [Version] section
            const providerMatch = content.match(/Provider\s*=\s*([^,\n]+)/i);
            if (providerMatch) {
                manufacturer = providerMatch[1].trim().replace(/"/g, '').replace(/%/g, '');
            }
        }

        // Extract model names and hardware IDs
        const models: string[] = [];
        const hardwareIds: string[] = [];

        // Find manufacturer model sections (e.g., [Brother.NTamd64.6.1])
        const mfgModelSections: string[] = [];
        const sectionHeaderRegex = /^\[([^\]]+)\]/gm;
        let sectionMatch;

        while ((sectionMatch = sectionHeaderRegex.exec(content)) !== null) {
            const sectionName = sectionMatch[1];
            // Look for sections that contain manufacturer name or model definitions
            if (sectionName.toLowerCase().includes(manufacturer.toLowerCase().substring(0, 5)) ||
                sectionName.toLowerCase().includes('models') ||
                sectionName.match(/\.(nt|ntamd64|ntx86|ntarm)/i)) {
                mfgModelSections.push(sectionName);
            }
        }

        // Parse model definitions from manufacturer sections
        for (const sectionName of mfgModelSections) {
            const sectionRegex = new RegExp(`\\[${sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\s*\\n([^\\[]*)`, 'i');
            const sectionContent = content.match(sectionRegex);

            if (sectionContent && sectionContent[1]) {
                const sectionLines = sectionContent[1].split('\n');

                for (const line of sectionLines) {
                    if (!line.trim() || line.trim().startsWith(';')) continue;

                    // Pattern: "Model Name" = InstallSection, HWID
                    const modelMatch = line.match(/"([^"]+)"\s*=\s*([^,]+)(?:,\s*([^\s;]+))?/);
                    if (modelMatch) {
                        const modelName = modelMatch[1];
                        const hwid = modelMatch[3];

                        if (modelName && !models.includes(modelName)) {
                            models.push(modelName);
                        }
                        if (hwid && !hardwareIds.includes(hwid)) {
                            hardwareIds.push(hwid);
                        }
                    } else {
                        // Pattern without quotes: ModelName = InstallSection, HWID
                        const altMatch = line.match(/^([^=]+?)\s*=\s*([^,]+)(?:,\s*([^\s;]+))?/);
                        if (altMatch && !altMatch[1].startsWith('%')) {
                            const modelName = altMatch[1].trim();
                            const hwid = altMatch[3];

                            if (modelName && !models.includes(modelName)) {
                                models.push(modelName);
                            }
                            if (hwid && !hardwareIds.includes(hwid)) {
                                hardwareIds.push(hwid);
                            }
                        }
                    }
                }
            }
        }

        // If no models found, try to extract from Strings section
        if (models.length === 0) {
            const stringsMatch = content.match(/\[Strings\]\s*\n([^\[]*)/i);
            if (stringsMatch) {
                const stringLines = stringsMatch[1].split('\n');
                for (const line of stringLines) {
                    const stringMatch = line.match(/^\s*([^=]+)\s*=\s*"([^"]+)"/);
                    if (stringMatch && stringMatch[2].length > 3 && stringMatch[2].length < 100) {
                        // Use first reasonable string as model name
                        models.push(stringMatch[2]);
                        break;
                    }
                }
            }
        }

        // Extract display name (prefer first model name, fallback to file name)
        const displayName = models.length > 0 ? models[0] : fallbackName;

        // Determine architecture
        const architecture = ['x64'];
        if (content.match(/\.(ntamd64|amd64)/i)) {
            if (!architecture.includes('amd64')) architecture.push('amd64');
        }
        if (content.match(/\.(ntarm64|arm64)/i)) {
            architecture.push('arm64');
        }
        if (content.match(/\.(ntx86|x86)/i)) {
            architecture.push('x86');
        }

        return {
            displayName,
            version,
            manufacturer,
            architecture: architecture.length > 0 ? architecture : ['x64'], // Default to x64 if nothing found
            hardwareIds: hardwareIds.length > 0 ? hardwareIds : ['UNKNOWN'],
            models: models.length > 0 ? models : [displayName]
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
    ): Promise<{ packageBuffer: Buffer; manifest: PDManifestSchema }> {
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

        // 5. Create ZIP structure
        const zip = new AdmZip();

        // Add manifest.json at root
        zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

        // Add all driver files to payload/ folder
        await this.addPayloadToZip(zip, sourcePath);

        // 6. Generate buffer
        const packageBuffer = zip.toBuffer();

        return { packageBuffer, manifest };
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
        // Generate unique package ID
        const packageId = crypto.randomUUID();

        // Set entryPoint to the actual INF file in payload folder
        const entryPoint = `payload/${infFilename}`;

        return {
            schemaVersion: '1.0',
            packageInfo: {
                id: packageId,
                createdAt: new Date().toISOString(),
                createdBy: user
            },
            driverMetadata: {
                displayName: metadata.displayName,
                version: metadata.version,
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
