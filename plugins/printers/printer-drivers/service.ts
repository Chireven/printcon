
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
     * This is optional - service can work without it by accessing StorageBroker directly.
     */
    static initialize(api: PluginAPI): void {
        this.api = api;
    }

    /**
     * Gets storage interface - either from PluginAPI or directly from StorageBroker.
     * This allows the service to work in both plugin and API route contexts.
     */
    private static async getStorage() {
        if (this.api) {
            // Use PluginAPI if available (plugin context)
            return this.api.storage;
        } else {
            // Fall back to direct StorageBroker access (API route context)
            const { StorageBroker } = await import('../../../src/core/storage-broker');
            const storageConfig = await import('../../../src/config/storage.json'); // Re-use core config

            // Ensure initialized (safe now that it's idempotent)
            // Fix: pass 'default' if it exists (module import) and waitForDynamic=true
            const config = (storageConfig as any).default || storageConfig;
            await StorageBroker.initialize(config, true);

            return {
                write: (path: string, buffer: Buffer) => StorageBroker.write(path, buffer),
                read: (path: string) => StorageBroker.read(path),
                exists: (path: string) => StorageBroker.exists(path),
                delete: (path: string) => StorageBroker.delete(path),
                list: (prefix: string) => StorageBroker.list(prefix)
            };
        }
    }

    /**
     * Helper to access Database securely.
     */
    private static async getDB() {
        if (this.api) {
            return this.api.database;
        } else {
            // Fallback for API routes (Admin context)
            const { DatabaseBroker } = await import('../../../src/core/database-broker');
            const dbConfig = await import('../../../src/config/database.json');

            await DatabaseBroker.initialize(dbConfig as any);

            // Return Adapter compatible with PluginAPI.database
            return {
                query: <T>(sql: string, params?: any) =>
                    DatabaseBroker.query<T>('printer-drivers', sql, params)
            };
        }
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

        const existingResult = await (await this.getDB()).query<{ Id: number }>(existingQuery, {
            hash: hash
        });

        if (existingResult.length > 0) {
            // Package already exists, return existing ID with manifest
            return { id: existingResult[0].Id, manifest };
        }

        // 4. Write file to storage using sharded path
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
     * @param packageGuid - The public PackageId (GUID)
     * @returns Object indicating success and whether the physical file was removed
     * @throws Error if package is in use or not found
     */
    public static async deletePackage(packageGuid: string): Promise<{ success: boolean, fileDeleted: boolean }> {
        const db = await this.getDB();
        const storage = await this.getStorage();

        // 1. Get Internal ID and Hash
        const lookupQuery = `
            SELECT Id, StorageHash 
            FROM [plg_printer_drivers].Packages 
            WHERE PackageId = @packageGuid
        `;
        const lookup = await db.query<{ Id: number, StorageHash: string }>(lookupQuery, { packageGuid });

        if (lookup.length === 0) {
            throw new Error('Package not found');
        }

        const { Id: internalId, StorageHash: hash } = lookup[0];

        // 2. Delete from Database (Transaction-like via order)
        // Note: If this fails due to FK constraint (e.g. used by Printers), it throws and aborts.

        // A. Remove Supported Models
        await db.query('DELETE FROM [plg_printer_drivers].SupportedModels WHERE PackageId = @internalId', { internalId });

        // B. Remove Package Record
        await db.query('DELETE FROM [plg_printer_drivers].Packages WHERE Id = @internalId', { internalId });

        // 3. Check Reference Count (Is file used by another package?)
        // Note: Even though current save logic deduplicates, we support N:1 here for safety/future-proofing.
        const refCheckQuery = `
            SELECT Count(Id) as Count 
            FROM [plg_printer_drivers].Packages 
            WHERE StorageHash = @hash
        `;
        // Use generic 'any' or specific interface since count returns might vary by driver
        const refResult = await db.query<any>(refCheckQuery, { hash });
        // Start counting safe
        const refCount = refResult[0]?.Count || 0;

        let fileDeleted = false;

        if (refCount === 0) {
            // 4. Safe to Delete File from Storage
            const hashLower = hash.toLowerCase();
            const shard1 = hashLower.substring(0, 2);
            const relativePath = `${shard1}/${hashLower}.pd`;

            try {
                await storage.delete(relativePath);
                fileDeleted = true;
            } catch (e) {
                console.warn(`[PrinterService] Failed to delete file ${relativePath}, ignoring as DB is clean.`, e);
            }
        } else {
            console.log(`[PrinterService] File for hash ${hash} preserved (Ref Count: ${refCount})`);
        }

        return { success: true, fileDeleted };
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
