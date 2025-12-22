import type { PluginInitializer } from '../../../src/core/types/plugin';
import { PrinterService } from './service';

// Mock Data
// Data cleared by request
export const MOCK_DRIVERS: any[] = [];

export const initialize: PluginInitializer = async (api) => {
    // Initialize PrinterService with PluginAPI
    PrinterService.initialize(api);

    // Publish Driver Repository Path (Variable Resolution)
    try {
        const path = await import('path');
        const fs = await import('fs');

        // Load config.json
        // We use process.cwd() to be safe across different execution contexts
        const configPath = path.join(process.cwd(), 'plugins/printers/printer-drivers/config.json');

        let repoPath = 'C:\\PrintCon\\DriverRepository'; // Default

        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.repositoryPath) {
                repoPath = config.repositoryPath;
            }
        }

        // Publish to system
        api.variables.publish('DriverRepository', repoPath);
        console.log(`[PrinterDrivers] Published DriverRepository: ${repoPath}`);
    } catch (e: any) {
        console.error('[PrinterDrivers] Failed to publish variable:', e);
        // Fallback publish to unblock system
        api.variables.publish('DriverRepository', 'C:\\PrintCon\\DriverRepository');
    }

    // Subscribe to REQUEST_DRIVERS
    api.events.on('REQUEST_DRIVERS', async (payload: any) => {
        try {
            console.log('[PrinterDrivers] Fetching drivers from database...');
            const drivers = await PrinterService.listPackages();
            api.events.emit('RESPONSE_DRIVERS', {
                drivers: drivers
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to list drivers:', e);
            api.events.emit('RESPONSE_DRIVERS', {
                drivers: [],
                error: e.message
            });
        }
    });

    // Subscribe to REQUEST_UPDATE_DRIVER
    api.events.on('REQUEST_UPDATE_DRIVER', async (payload: any) => {
        try {
            console.log('[PrinterDrivers] Updating driver - full payload:', JSON.stringify(payload, null, 2));
            const { id, metadata } = payload;
            console.log('[PrinterDrivers] Extracted id:', id, 'metadata:', metadata);
            await PrinterService.updatePackage(id, metadata);
            api.events.emit('RESPONSE_UPDATE_DRIVER', {
                success: true,
                id: id
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to update driver:', e);
            api.events.emit('RESPONSE_UPDATE_DRIVER', {
                success: false,
                error: e.message
            });
        }
    });

    // Handle Fetch Driver Models
    api.events.on('REQUEST_DRIVER_MODELS', async (data: any) => {
        try {
            const models = await PrinterService.getDriverModels(data.packageId);
            api.events.emit('RESPONSE_DRIVER_MODELS', {
                success: true,
                packageId: data.packageId,
                models
            });
        } catch (e: any) {
            api.events.emit('RESPONSE_DRIVER_MODELS', {
                success: false,
                error: e.message
            });
        }
    });

    // Subscribe to REQUEST_DELETE_DRIVER
    api.events.on('REQUEST_DELETE_DRIVER', async (payload: any) => {
        try {
            console.log('[PrinterDrivers] Deleting driver:', payload.id, 'forceDbOnly:', payload.forceDbOnly);
            const result = await PrinterService.deletePackage(payload.id, payload.forceDbOnly);
            api.events.emit('RESPONSE_DELETE_DRIVER', {
                success: true,
                fileDeleted: result.fileDeleted,
                fileMissing: result.fileMissing
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to delete driver:', e);
            api.events.emit('RESPONSE_DELETE_DRIVER', {
                success: false,
                error: e.message,
                fileMissing: e.message === 'DRIVER_FILE_MISSING'
            });
        }
    });

    // Subscribe to REQUEST_DOWNLOAD_DRIVER
    api.events.on('REQUEST_DOWNLOAD_DRIVER', async (payload: any) => {
        try {
            console.log('[PrinterDrivers] Preparing driver download:', payload.id);
            const packageBuffer = await PrinterService.getRawPackage(payload.id);

            // Import AdmZip for repackaging
            const AdmZip = (await import('adm-zip')).default;
            const sourceZip = new AdmZip(packageBuffer);
            const targetZip = new AdmZip();
            const entries = sourceZip.getEntries();

            // Flatten payload/ folder
            entries.forEach((entry) => {
                if (entry.entryName.startsWith('payload/') && !entry.isDirectory) {
                    const newName = entry.entryName.replace(/^payload\//, '');
                    if (newName) {
                        targetZip.addFile(newName, entry.getData());
                    }
                }
            });

            const downloadBuffer = targetZip.toBuffer();

            api.events.emit('RESPONSE_DOWNLOAD_DRIVER', {
                success: true,
                buffer: downloadBuffer.toString('base64'), // Base64 encode for transmission
                filename: payload.filename || `${payload.id}.zip`
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to prepare download:', e);
            api.events.emit('RESPONSE_DOWNLOAD_DRIVER', {
                success: false,
                error: e.message
            });
        }
    });

    // Subscribe to REQUEST_BUILD_PACKAGE
    api.events.on('REQUEST_BUILD_PACKAGE', async (payload: any) => {
        try {
            console.log('[PrinterDrivers] Building package from path:', payload.sourcePath);
            const { PDPackageBuilder } = await import('./pd-builder');

            const username = payload.user || 'system';
            const { packageBuffer, manifest, contentHash } = await PDPackageBuilder.buildPackage(
                payload.sourcePath,
                username
            );

            // Upload package using service (with content hash for deduplication)
            const result = await PrinterService.savePackage(
                packageBuffer,
                `${manifest.driverMetadata.displayName}.pd`,
                username,
                contentHash // Pass content hash for deduplication
            );

            api.events.emit('RESPONSE_BUILD_PACKAGE', {
                success: true,
                packageId: result.id,
                isDuplicateName: result.isDuplicateName || false,
                manifest: {
                    displayName: manifest.driverMetadata.displayName,
                    version: manifest.driverMetadata.version,
                    supportedModels: manifest.hardwareSupport.compatibleModels.length,
                    pnpIds: manifest.hardwareSupport.pnpIds.length
                }
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to build package:', e);
            api.events.emit('RESPONSE_BUILD_PACKAGE', {
                success: false,
                error: e.message
            });
        }
    });

    // Subscribe to REQUEST_VALIDATE_INF
    api.events.on('REQUEST_VALIDATE_INF', async (payload: any) => {
        try {
            console.log('[PrinterDrivers] Validating INF path:', payload.filePath);
            const { PDPackageBuilder } = await import('./pd-builder');

            const validation = await PDPackageBuilder.validateInfPath(payload.filePath);

            api.events.emit('RESPONSE_VALIDATE_INF', {
                success: true,
                validation: validation
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to validate INF path:', e);
            api.events.emit('RESPONSE_VALIDATE_INF', {
                success: false,
                error: e.message,
                validation: { valid: false, error: e.message }
            });
        }
    });

    // Subscribe to REQUEST_SAVE_SETTINGS
    api.events.on('REQUEST_SAVE_SETTINGS', async (payload: any) => {
        try {
            console.log('[PrinterDrivers] Saving settings:', payload);

            const db = api.database;

            // Save each setting to database
            const settings = payload as { repositoryPath?: string, autoCleanupFolders?: boolean };

            for (const [key, value] of Object.entries(settings)) {
                const query = `
                    MERGE [plg_printer_drivers].Settings AS target
                    USING (SELECT @key AS SettingKey) AS source
                    ON target.SettingKey = source.SettingKey
                    WHEN MATCHED THEN
                        UPDATE SET SettingValue = @value
                    WHEN NOT MATCHED THEN
                        INSERT (SettingKey, SettingValue) VALUES (@key, @value);
                `;

                await db.query(query, {
                    key: key,
                    value: String(value)
                });
            }

            api.events.emit('RESPONSE_SAVE_SETTINGS', {
                success: true
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to save settings:', e);
            api.events.emit('RESPONSE_SAVE_SETTINGS', {
                success: false,
                error: e.message
            });
        }
    });

    // ========================================
    // Storage Transfers Integration
    // ========================================

    // Listen for completed uploads from storage-transfers
    // Build .pd package when upload is finalized
    api.events.on('UPLOAD_COMPLETED', async (data: any) => {
        try {
            if (!data.success || !data.tempPath) {
                return; // Storage-transfers handled the error
            }

            const { tempPath, sessionId } = data;
            const username = 'admin'; // TODO: Get from context

            console.log('[PrinterDrivers] Building .pd package from uploaded files:', tempPath);

            // Emit progress: Building package
            api.events.emit('UPLOAD_PROGRESS', {
                stage: 'building',
                message: 'Building .pd package from driver files'
            });

            // Build .pd package
            const { PDPackageBuilder } = await import('./pd-builder');
            const { packageBuffer, manifest } = await PDPackageBuilder.buildPackage(tempPath, username);

            // Compute content hash for deduplication
            const crypto = await import('crypto');
            const contentHash = crypto.createHash('sha256').update(packageBuffer).digest('hex');

            console.log('[PrinterDrivers] ✅ Package built. Size:', packageBuffer.length, 'bytes, Hash:', contentHash);

            // Emit progress: Saving package
            api.events.emit('UPLOAD_PROGRESS', {
                stage: 'saving',
                message: `Saving package to repository`
            });

            // Save to repository
            console.log('[PrinterDrivers] 💾 Saving package to repository...');
            const result = await PrinterService.savePackage(
                packageBuffer,
                `${manifest.driverMetadata.displayName}.pd`,
                username,
                contentHash
            );

            // Request cleanup
            api.events.emit('REQUEST_CLEANUP_SESSION', {
                sessionId: sessionId  // Pass directly, not nested
            });

            console.log('[PrinterDrivers] Package built successfully:', result.id);

            // Emit completion event
            api.events.emit('UPLOAD_COMPLETE', {
                success: true,
                packageId: result.id,
                displayName: manifest.driverMetadata.displayName
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to build package:', e);

            // Notify user of the error
            api.events.emit('PACKAGE_BUILD_FAILED', {
                success: false,
                error: e.message,
                details: e.stack
            });
        }
    });


    console.log('[PrinterDrivers] Plugin initialized with Storage Broker support');
};
