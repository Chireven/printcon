import { db } from '../../../src/lib/db-manager';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';

/**
 * .pd Package Manifest Schema Interfaces
 * Based on the PrintCon Driver Package (.pd) specification
 */
interface PackageInfo {
    id: string;
    createdAt: string;
    createdBy: string;
}

interface DriverMetadata {
    displayName: string;
    version: string;
    architecture: string[];
    supportedOS: string[];
    driverClass: string;
    entryPoint: string;
}

interface HardwareSupport {
    pnpIds: string[];
    compatibleModels: string[];
}

export interface PDManifestSchema {
    schemaVersion: string;
    packageInfo: PackageInfo;
    driverMetadata: DriverMetadata;
    hardwareSupport: HardwareSupport;
}

/**
 * Printer Driver Service
 * Handles driver package storage, deduplication, and model support management.
 */
export class PrinterService {
    private static STORAGE_PATH: string | null = null;

    /**
     * Lazy-loads the storage path from plugin configuration.
     * Falls back to 'C:\\Drivers' if not configured.
     */
    private static async getStoragePath(): Promise<string> {
        if (this.STORAGE_PATH) {
            return this.STORAGE_PATH;
        }

        try {
            // Read plugin config
            const configPath = path.resolve(process.cwd(), 'plugins/printers/printer-drivers/config.json');
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configContent);

            this.STORAGE_PATH = config.repositoryPath || 'C:\\Drivers';
        } catch (error) {
            // Config doesn't exist or is invalid, use default
            this.STORAGE_PATH = 'C:\\Drivers';
        }

        // Ensure storage directory exists
        await fs.mkdir(this.STORAGE_PATH, { recursive: true });

        return this.STORAGE_PATH;
    }

    /**
     * Extracts and validates the manifest.json from a .pd package.
     * 
     * @param fileBuffer - The .pd package buffer
     * @returns Parsed and validated manifest
     * @throws Error if ZIP is invalid or manifest is malformed
     */
    private static extractAndValidateManifest(fileBuffer: Buffer): PDManifestSchema {
        let zip: AdmZip;

        try {
            zip = new AdmZip(fileBuffer);
        } catch (error) {
            throw new Error('Invalid ZIP file: Unable to open package');
        }

        // 1. Verify manifest.json exists at root
        const manifestEntry = zip.getEntry('manifest.json');
        if (!manifestEntry) {
            throw new Error('Invalid .pd package: manifest.json not found at root');
        }

        // 2. Parse manifest
        let manifest: PDManifestSchema;
        try {
            const manifestContent = manifestEntry.getData().toString('utf8');
            manifest = JSON.parse(manifestContent);
        } catch (error) {
            throw new Error('Invalid manifest.json: Unable to parse JSON');
        }

        // 3. Validate required fields
        if (!manifest.schemaVersion) {
            throw new Error('Invalid manifest: schemaVersion is required');
        }
        if (!manifest.packageInfo?.id) {
            throw new Error('Invalid manifest: packageInfo.id is required');
        }
        if (!manifest.driverMetadata?.entryPoint) {
            throw new Error('Invalid manifest: driverMetadata.entryPoint is required');
        }

        // 4. Verify payload folder exists
        const payloadEntries = zip.getEntries().filter(entry => entry.entryName.startsWith('payload/'));
        if (payloadEntries.length === 0) {
            throw new Error('Invalid .pd package: payload/ folder not found');
        }

        // 5. Verify entryPoint exists within the ZIP
        const entryPointPath = manifest.driverMetadata.entryPoint;
        const entryPointEntry = zip.getEntry(entryPointPath);
        if (!entryPointEntry) {
            throw new Error(`Invalid manifest: entryPoint "${entryPointPath}" not found in package`);
        }

        return manifest;
    }

    /**
     * Populates the SupportedModels table from manifest hardware support data.
     * 
     * @param packageId - Database package ID
     * @param hardwareSupport - Hardware support section from manifest
     */
    private static async populateModels(
        packageId: number,
        hardwareSupport: HardwareSupport
    ): Promise<void> {
        const { pnpIds, compatibleModels } = hardwareSupport;

        // Insert each PnP ID as a supported model
        for (const pnpId of pnpIds) {
            const modelName = compatibleModels[0] || 'Unknown Model';
            await this.addModelSupport(packageId, modelName, pnpId);
        }

        // If there are compatible models without PnP IDs, add them too
        if (pnpIds.length === 0 && compatibleModels.length > 0) {
            for (const model of compatibleModels) {
                await this.addModelSupport(packageId, model, '');
            }
        }
    }

    /**
     * Saves a .pd driver package to disk and database with manifest-based metadata.
     * Automatically extracts manifest, validates structure, and populates hardware support.
     * 
     * @param fileBuffer - The .pd package file buffer
     * @param originalName - Original filename (e.g., "driver.pd")
     * @param user - Username performing the upload
     * @returns Object containing package ID and parsed manifest
     */
    public static async savePackage(
        fileBuffer: Buffer,
        originalName: string,
        user: string
    ): Promise<{ id: number; manifest: PDManifestSchema }> {
        // 1. Extract and validate manifest from .pd package
        const manifest = this.extractAndValidateManifest(fileBuffer);

        // 2. Calculate SHA256 hash for deduplication
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // 3. Check if package already exists (deduplication)
        const existingQuery = `
            SELECT Id 
            FROM [plg_printer_drivers].Packages 
            WHERE StorageHash = @hash
        `;

        const existingResult = await db.query<{ Id: number }>(existingQuery, {
            hash: hash
        });

        if (existingResult.length > 0) {
            // Package already exists, return existing ID with manifest
            return { id: existingResult[0].Id, manifest };
        }

        // 4. Write file to disk using hash as filename
        const storagePath = await this.getStoragePath();
        const fileExtension = path.extname(originalName);
        const diskFilename = `${hash}${fileExtension}`;
        const fullPath = path.join(storagePath, diskFilename);

        await fs.writeFile(fullPath, fileBuffer);

        // 5. Insert into database with PackageId from manifest
        const insertQuery = `
            INSERT INTO [plg_printer_drivers].Packages (
                PackageId,
                OriginalFilename,
                StorageHash,
                UploadedBy,
                CreatedAt
            )
            OUTPUT INSERTED.Id
            VALUES (
                @packageId,
                @originalName,
                @hash,
                @user,
                GETDATE()
            )
        `;

        const insertResult = await db.query<{ Id: number }>(insertQuery, {
            packageId: manifest.packageInfo.id,
            originalName: originalName,
            hash: hash,
            user: user
        });

        const packageDbId = insertResult[0].Id;

        // 6. Populate SupportedModels from manifest
        await this.populateModels(packageDbId, manifest.hardwareSupport);

        return { id: packageDbId, manifest };
    }

    /**
     * Associates a printer model with a driver package.
     * 
     * @param packageId - The driver package ID
     * @param modelName - Printer model name (e.g., "HP LaserJet Pro M404")
     * @param hardwareId - Hardware ID or PnP string
     */
    public static async addModelSupport(
        packageId: number,
        modelName: string,
        hardwareId: string
    ): Promise<void> {
        const insertQuery = `
            INSERT INTO [plg_printer_drivers].SupportedModels (
                PackageId,
                ModelName,
                HardwareId
            )
            VALUES (
                @packageId,
                @modelName,
                @hardwareId
            )
        `;

        await db.query(insertQuery, {
            packageId: packageId,
            modelName: modelName,
            hardwareId: hardwareId
        });
    }

    /**
     * Retrieves all driver packages from the database.
     * 
     * @returns Array of all packages ordered by creation date (newest first)
     */
    public static async listPackages(): Promise<any[]> {
        const query = `
            SELECT 
                Id,
                OriginalFilename,
                DiskFilename,
                StorageHash,
                FileSize,
                UploadedBy,
                UploadedAt,
                CreatedAt
            FROM [plg_printer_drivers].Packages 
            ORDER BY CreatedAt DESC
        `;

        const result = await db.query<any>(query);
        return result;
    }
}
