
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import type { PluginAPI } from '../../../src/core/types/plugin';

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
    vendor: string;
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
    private static api: PluginAPI | null = null;

    /**
     * Initializes the service with PluginAPI.
     * Called during plugin initialization.
     * 
     * @param api - PluginAPI instance
     * @required This MUST be called before using any service methods
     */
    static initialize(api: PluginAPI): void {
        this.api = api;
    }

    /**
     * Gets storage interface from PluginAPI.
     * 
     * @throws Error if service not initialized with PluginAPI
     */
    private static async getStorage() {
        if (!this.api) {
            throw new Error('PrinterService must be initialized with PluginAPI. Use PrinterService.initialize(api) during plugin initialization.');
        }
        return this.api.storage;
    }

    /**
     * Helper to access Database securely.
     * 
     * @throws Error if service not initialized with PluginAPI
     */
    private static async getDB() {
        if (!this.api) {
            throw new Error('PrinterService must be initialized with PluginAPI. Use PrinterService.initialize(api) during plugin initialization.');
        }
        return this.api.database;
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
     * @param contentHash - SHA256 hash of file contents (for deduplication)
     * @returns Object containing package ID and parsed manifest
     */
    public static async savePackage(
        fileBuffer: Buffer,
        originalName: string,
        user: string,
        contentHash: string
    ): Promise<{ id: number; manifest: PDManifestSchema }> {
        // 1. Extract and validate manifest from .pd package
        const manifest = this.extractAndValidateManifest(fileBuffer);

        // 2. Use provided content hash for deduplication (ignores ZIP metadata like timestamps)
        const hash = contentHash;

        // 3. Check for duplicate display name (warn user about name collision)
        const nameCheckQuery = `
            SELECT Id, DisplayName 
            FROM [plg_printer_drivers].Packages 
            WHERE DisplayName = @displayName
        `;
        const nameCheck = await (await this.getDB()).query<{ Id: number, DisplayName: string }>(nameCheckQuery, {
            displayName: manifest.driverMetadata.displayName
        });

        const isDuplicateName = nameCheck.length > 0;

        // 4. Check if package already exists by hash (deduplication)
        const existingQuery = `
            SELECT Id 
            FROM [plg_printer_drivers].Packages 
            WHERE StorageHash = @hash
        `;

        const existingResult = await (await this.getDB()).query<{ Id: number }>(existingQuery, {
            hash: hash
        });

        if (existingResult.length > 0) {
            // Package already exists, return existing ID with manifest and duplicate name flag
            return {
                id: existingResult[0].Id,
                manifest,
                isDuplicateName
            };
        }

        // 4. Write file to storage using sharded path
        const storage = await this.getStorage();

        const hashLower = hash.toLowerCase();
        const shard1 = hashLower.substring(0, 2);
        const relativePath = `${shard1}/${hashLower}.pd`;

        // Use storage interface (works in both Plugin and API contexts)
        await storage.write(relativePath, fileBuffer);

        // 5. Insert into database with PackageId from manifest
        const insertQuery = `
            INSERT INTO [plg_printer_drivers].Packages (
                PackageId,
                OriginalFilename,
                StorageHash,
                DisplayName,
                Version,
                Vendor,
                UploadedBy,
                CreatedAt
            )
            OUTPUT INSERTED.Id
            VALUES (
                @packageId,
                @originalName,
                @hash,
                @displayName,
                @version,
                @vendor,
                @user,
                GETDATE()
            )
        `;

        const insertResult = await (await this.getDB()).query<{ Id: number }>(insertQuery, {
            packageId: manifest.packageInfo.id,
            originalName: originalName,
            hash: hash,
            displayName: manifest.driverMetadata.displayName,
            version: manifest.driverMetadata.version,
            vendor: manifest.driverMetadata.vendor,
            user: user
        });

        const packageDbId = insertResult[0].Id;

        // 6. Populate SupportedModels from manifest
        await this.populateModels(packageDbId, manifest.hardwareSupport);

        return {
            id: packageDbId,
            manifest,
            isDuplicateName
        };
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

        await (await this.getDB()).query(insertQuery, {
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
                PackageId,
                OriginalFilename,
                DisplayName,
                Version,
                Vendor,
                StorageHash,
                UploadedBy,
                CreatedAt
            FROM [plg_printer_drivers].Packages 
            ORDER BY CreatedAt DESC
        `;

        const result = await (await this.getDB()).query<any>(query);

        // Map to UI Expected Interface (PrinterDriver)
        return result.map(row => ({
            id: row.PackageId,
            name: row.DisplayName || row.OriginalFilename.replace(/\.pd$/, '').replace(/_/g, ' '),
            version: row.Version || '1.0.0',
            os: 'Windows x64', // Keep fallback for now
            vendor: row.Vendor || 'Generic',
            hash: row.StorageHash,
            uploadedBy: row.UploadedBy,
            createdAt: row.CreatedAt
        }));
    }
    /**
     * Deletes a driver package and its associated data.
     * 
     * @param packageIdOrDbId - The public PackageId (UUID) or database ID (numeric string)
     * @param forceDbOnly - If true, only delete database record even if file is missing
     * @returns Object indicating success, whether the physical file was removed, and if file was missing
     * @throws Error if package is in use or not found
     */
    public static async deletePackage(packageIdOrDbId: string, forceDbOnly: boolean = false): Promise<{ success: boolean, fileDeleted: boolean, fileMissing?: boolean }> {
        const db = await this.getDB();
        const storage = await this.getStorage();

        // 1. Get Internal ID and Hash - support both PackageId (UUID) and database Id (numeric)
        const isNumeric = /^\d+$/.test(packageIdOrDbId);
        let lookupQuery: string;
        let lookupParams: any;

        if (isNumeric) {
            lookupQuery = `SELECT Id, StorageHash FROM [plg_printer_drivers].Packages WHERE Id = @id`;
            lookupParams = { id: parseInt(packageIdOrDbId) };
        } else {
            lookupQuery = `SELECT Id, StorageHash FROM [plg_printer_drivers].Packages WHERE PackageId = @packageGuid`;
            lookupParams = { packageGuid: packageIdOrDbId };
        }

        const lookup = await db.query<{ Id: number, StorageHash: string }>(lookupQuery, lookupParams);

        if (lookup.length === 0) {
            throw new Error('Package not found');
        }

        const { Id: internalId, StorageHash: hash } = lookup[0];

        // 2. Check Reference Count FIRST (Is file used by another package?)
        const refCheckQuery = `
            SELECT Count(Id) as Count 
            FROM [plg_printer_drivers].Packages 
            WHERE StorageHash = @hash
        `;
        const refResult = await db.query<any>(refCheckQuery, { hash });
        const refCount = refResult[0]?.Count || 0;

        let fileDeleted = false;
        let fileMissing = false;

        // 3. Check if file exists and handle accordingly (BEFORE deleting DB records)
        if (refCount === 1) {
            // This is the only package using this file
            const hashLower = hash.toLowerCase();
            const shard1 = hashLower.substring(0, 2);
            const relativePath = `${shard1}/${hashLower}.pd`;

            const fileExists = await storage.exists(relativePath);

            if (!fileExists) {
                console.warn(`[PrinterService] File ${relativePath} does not exist in storage`);
                fileMissing = true;

                if (!forceDbOnly) {
                    // File is missing, throw error so UI can prompt user
                    // DON'T delete database yet - let user decide
                    throw new Error('DRIVER_FILE_MISSING');
                }
                // If forceDbOnly is true, continue with DB deletion
            } else {
                // File exists, safe to delete it after DB cleanup
                fileDeleted = true;
            }
        }

        // 4. Delete from Database (only after confirming file handling is OK)
        // A. Remove Supported Models
        await db.query('DELETE FROM [plg_printer_drivers].SupportedModels WHERE PackageId = @internalId', { internalId });

        // B. Remove Package Record
        await db.query('DELETE FROM [plg_printer_drivers].Packages WHERE Id = @internalId', { internalId });

        // 5. Delete file if we marked it for deletion
        if (fileDeleted) {
            const hashLower = hash.toLowerCase();
            const shard1 = hashLower.substring(0, 2);
            const relativePath = `${shard1}/${hashLower}.pd`;

            try {
                await storage.delete(relativePath);

                // Auto-cleanup empty shard folder if enabled
                console.log(`[PrinterService] Attempting auto-cleanup for shard folder: ${shard1}`);
                if (forceDbOnly === false) { // Only cleanup on normal deletes, not force deletes
                    await this.cleanupEmptyShardFolder(storage, shard1);
                }
            } catch (e) {
                console.warn(`[PrinterService] Failed to delete file ${relativePath}`, e);
                // File delete failed, but DB is clean - log and continue
            }
        } else if (refCount > 1) {
            console.log(`[PrinterService] File for hash ${hash} preserved (Ref Count: ${refCount})`);
        }

        return { success: true, fileDeleted, fileMissing };
    }

    /**
     * Cleans up empty shard folder after file deletion (if auto-cleanup is enabled).
     * SAFETY: Never attempts to remove root folder, only shard subfolders.
     * 
     * @param storage - Storage interface
     * @param shardFolder - Shard folder name (e.g., "db")
     */
    private static async cleanupEmptyShardFolder(storage: any, shardFolder: string): Promise<void> {
        console.log(`[cleanupEmptyShardFolder] ENTRY - shard: ${shardFolder}`);
        try {
            // Get settings to check if auto-cleanup is enabled
            console.log(`[cleanupEmptyShardFolder] Fetching settings...`);
            const settings = await this.getSettings();
            console.log(`[cleanupEmptyShardFolder] Settings:`, settings);

            if (!settings.autoCleanupFolders) {
                console.log(`[cleanupEmptyShardFolder] Auto-cleanup disabled, exiting`);
                return; // Feature disabled
            }

            // SAFETY CHECK: Never attempt to remove root or invalid paths
            if (!shardFolder || shardFolder.length !== 2 || shardFolder.includes('/') || shardFolder.includes('\\')) {
                console.warn(`[PrinterService] Invalid shard folder for cleanup: ${shardFolder}`);
                return;
            }

            // Check if folder exists and get its contents
            const folderPath = `${shardFolder}/`;
            console.log(`[cleanupEmptyShardFolder] Checking if folder exists: ${folderPath}`);
            const exists = await storage.exists(folderPath);
            console.log(`[cleanupEmptyShardFolder] Folder exists:`, exists);

            if (!exists) {
                console.log(`[cleanupEmptyShardFolder] Folder doesn't exist, exiting`);
                return; // Folder already doesn't exist
            }

            // List files in the shard folder
            console.log(`[cleanupEmptyShardFolder] Listing files in: ${folderPath}`);
            const files = await storage.list(folderPath);
            console.log(`[cleanupEmptyShardFolder] Files found:`, files);

            // If folder is empty, remove it
            if (files.length === 0) {
                console.log(`[cleanupEmptyShardFolder] Folder is empty, deleting...`);
                await storage.deleteDirectory(folderPath);
                console.log(`[PrinterService] Cleaned up empty shard folder: ${shardFolder}/`);
            } else {
                console.log(`[cleanupEmptyShardFolder] Folder not empty (${files.length} files), keeping it`);
            }
        } catch (e) {
            // Non-critical error - log and continue
            console.error(`[cleanupEmptyShardFolder] ERROR:`, e);
            console.warn(`[PrinterService] Failed to cleanup shard folder ${shardFolder}:`, e);
        }
    }

    /**
     * Retrieves plugin settings from database.
     */
    private static async getSettings(): Promise<{ autoUpload: boolean, autoCleanupFolders: boolean }> {
        // Default settings
        const defaults = { autoUpload: false, autoCleanupFolders: true };

        try {
            const db = await this.getDB();
            const query = `SELECT SettingKey, SettingValue FROM [plg_printer_drivers].Settings`;
            const results = await db.query<{ SettingKey: string, SettingValue: string }>(query);

            const settings = { ...defaults };
            results.forEach(row => {
                if (row.SettingKey === 'autoUpload') {
                    settings.autoUpload = row.SettingValue === 'true';
                } else if (row.SettingKey === 'autoCleanupFolders') {
                    settings.autoCleanupFolders = row.SettingValue === 'true';
                }
            });

            return settings;
        } catch (e) {
            console.warn('[PrinterService] Failed to load settings, using defaults:', e);
            return defaults;
        }
    }

    /**
     * Retrieves the raw content of a driver package file.
     * Used for downloads and extraction.
     * 
     * @param packageGuid - The public PackageId (GUID)
     * @returns Buffer containing the file content
     */
    public static async getRawPackage(packageGuid: string): Promise<Buffer> {
        const db = await this.getDB();
        const storage = await this.getStorage();

        // 1. Get Hash
        const lookup = await db.query<{ StorageHash: string }>(
            'SELECT StorageHash FROM [plg_printer_drivers].Packages WHERE PackageId = @packageGuid',
            { packageGuid }
        );

        if (!lookup || lookup.length === 0) {
            throw new Error('Package not found');
        }

        const hash = lookup[0].StorageHash;

        // 2. Read from Storage
        // Dual-Path Resolution (Read Fallback logic per technical spec)
        const hashLower = hash.toLowerCase();
        const shard1 = hashLower.substring(0, 2);
        const relativePath = `${shard1}/${hashLower}.pd`;

        try {
            return await storage.read(relativePath);
        } catch (e) {
            // TODO: Add fallback to 2-tier path per spec if primary fails
            // For now, re-throw with context
            console.error(`[PrinterService] Failed to read package ${relativePath}`, e);
            throw new Error('Package file missing from storage');
        }
    }

    /**
     * Updates the metadata for a driver package.
     * Note: This does NOT update the file content, only the database record.
     * 
     * @param packageGuid - The public PackageId (GUID)
     * @param metadata - The fields to update
     */
    public static async updatePackage(
        packageGuid: string,
        metadata: {
            displayName?: string;
            version?: string;
            vendor?: string;
            os?: string; // Not currently stored in DB but passed in UI
        }
    ): Promise<void> {
        const db = await this.getDB();

        // Build dynamic query
        const updates: string[] = [];
        const params: any = { packageGuid };

        if (metadata.displayName !== undefined) {
            updates.push('DisplayName = @displayName');
            params.displayName = metadata.displayName;
        }
        if (metadata.version !== undefined) {
            updates.push('Version = @version');
            params.version = metadata.version;
        }
        if (metadata.vendor !== undefined) {
            updates.push('Vendor = @vendor');
            params.vendor = metadata.vendor;
        }

        if (updates.length === 0) return; // Nothing to update

        const query = `
            UPDATE [plg_printer_drivers].Packages
            SET ${updates.join(', ')}
            WHERE PackageId = @packageGuid
        `;

        console.log('[PrinterService.updatePackage] Executing query:', query);
        console.log('[PrinterService.updatePackage] Parameters:', JSON.stringify(params, null, 2));

        await db.query(query, params);

        console.log('[PrinterService.updatePackage] Update executed successfully');
    }
}
