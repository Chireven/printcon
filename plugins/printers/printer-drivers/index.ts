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
            ) as { id: number; manifest: any; isDuplicateName?: boolean };

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


    // ========================================
    // Driver Details & Models
    // ========================================

    // Get supported models for a driver package (from database)
    api.events.on('REQUEST_DRIVER_MODELS', async (data: { packageId: string }) => {
        try {
            const db = api.database;
            const result = await db.query(
                `SELECT ModelName, HardwareId 
                 FROM [plg_printer_drivers].SupportedModels 
                 WHERE PackageId = @packageId
                 ORDER BY ModelName`,
                { packageId: data.packageId }
            ) as any;

            // Handle both array and recordset formats
            const records = Array.isArray(result) ? result : result?.recordset || [];

            api.events.emit('RESPONSE_DRIVER_MODELS', {
                success: true,
                packageId: data.packageId,
                models: records.map((r: any) => ({
                    modelName: r.ModelName,
                    hardwareId: r.HardwareId
                }))
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to fetch driver models:', e);
            api.events.emit('RESPONSE_DRIVER_MODELS', {
                success: false,
                packageId: data.packageId,
                error: e.message,
                models: []
            });
        }
    });

    // Get comprehensive driver details (extracts .pd and analyzes with INFpossible)
    api.events.on('REQUEST_DRIVER_DETAILS', async (data: { packageId: string }) => {
        try {
            console.log('[PrinterDrivers] Analyzing driver package:', data.packageId);

            const db = api.database;
            const fs = await import('fs/promises');
            const path = await import('path');
            const os = await import('os');

            // 1. Get package from database
            const packageIdInt = parseInt(data.packageId, 10);

            const pkgResult = await db.query(
                `SELECT Id, PackageId, OriginalFilename, StorageHash, UploadedBy, CreatedAt  
                 FROM [plg_printer_drivers].Packages 
                 WHERE Id = @id`,
                { id: packageIdInt }
            ) as any;

            // Handle both array and recordset formats
            const pkgRecords = Array.isArray(pkgResult) ? pkgResult : pkgResult?.recordset || [];

            if (!pkgRecords || pkgRecords.length === 0) {
                throw new Error('Driver package not found');
            }

            const pkg = pkgRecords[0];

            // 2. Load .pd package from storage
            const hashLower = pkg.StorageHash.toLowerCase();
            const shard1 = hashLower.substring(0, 2);
            const relativePath = `${shard1}/${hashLower}.pd`;

            const pdBuffer = await api.storage.read(relativePath);

            // 3. Extract to temp directory
            const tempDir = path.join(os.tmpdir(), `printcon-analysis-${Date.now()}`);
            await fs.mkdir(tempDir, { recursive: true });

            const pdPath = path.join(tempDir, pkg.OriginalFilename);
            await fs.writeFile(pdPath, pdBuffer);

            // 4. Extract .pd package
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(pdPath);
            zip.extractAllTo(tempDir, true);

            // 5. Find INF file in payload/
            const payloadDir = path.join(tempDir, 'payload');
            const files = await fs.readdir(payloadDir);
            const infFile = files.find(f => f.toLowerCase().endsWith('.inf'));

            if (!infFile) {
                throw new Error('No INF file found in package');
            }

            const infPath = path.join(payloadDir, infFile);

            // 6. Analyze with INFpossible
            const { InfParser } = await import('./infpossible/parser');
            const { InfAnalyzer } = await import('./infpossible/analyzer');
            const { DependencyTracker } = await import('./infpossible/dependencies');

            const infContent = await fs.readFile(infPath, 'utf-8');
            const parsedInf = InfParser.parseInfFile(infContent, infFile);
            const metadata = InfAnalyzer.extractDriverMetadata(parsedInf);
            const dependencies = DependencyTracker.buildDependencyGraph(parsedInf);

            // 7. Get supported models from database
            const modelsResult = await db.query(
                `SELECT ModelName, HardwareId 
                 FROM [plg_printer_drivers].SupportedModels 
                 WHERE PackageId = @packageId
                 ORDER BY ModelName`,
                { packageId: packageIdInt }
            ) as any;

            // Handle both array and recordset formats
            const modelRecords = Array.isArray(modelsResult) ? modelsResult : modelsResult?.recordset || [];

            // 8. Cleanup temp directory
            await fs.rm(tempDir, { recursive: true, force: true });

            // 9. Return comprehensive details with defensive checks
            api.events.emit('RESPONSE_DRIVER_DETAILS', {
                success: true,
                packageId: data.packageId,
                details: {
                    // Basic metadata
                    name: pkg.OriginalFilename || 'Unknown',
                    version: metadata?.version || 'Unknown',
                    date: 'Unknown',
                    provider: metadata?.manufacturer || 'Unknown',

                    // Driver characteristics
                    driverClass: metadata?.driverClass || 'v3',
                    isolation: metadata?.driverIsolation || 'None',
                    architectures: metadata?.architecture || [],

                    // Supported models
                    models: modelRecords.map((r: any) => ({
                        modelName: r?.ModelName || 'Unknown',
                        hardwareId: r?.HardwareId || 'Unknown'
                    })),

                    // File dependencies
                    files: (dependencies || []).map((f: any) => ({
                        name: f?.fileName || 'Unknown',
                        compressed: (f?.compressedName || '').length > 0,
                        size: f?.size || null,
                        diskId: f?.diskId || null
                    })),

                    // Hardware IDs from metadata
                    hardwareIds: metadata?.hardwareIds || [],

                    // Statistics
                    stats: {
                        modelCount: modelRecords.length,
                        fileCount: (dependencies || []).length,
                        compressedFileCount: (dependencies || []).filter((f: any) => (f?.compressedName || '').length > 0).length
                    },

                    // Raw INF file content
                    infContent: infContent,
                    infFileName: infFile
                }
            });

        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to analyze driver:', e);
            api.events.emit('RESPONSE_DRIVER_DETAILS', {
                success: false,
                packageId: data.packageId,
                error: e.message
            });
        }
    });


    // ========================================
    // Inbox Driver Extraction
    // ========================================

    // List local inbox drivers (Hybrid: pnputil + FileRepository)
    api.events.on('REQUEST_LIST_INBOX_DRIVERS', async (data: any) => {
        try {
            console.log('[PrinterDrivers] Listing inbox drivers (Hybrid mode)...');

            // Phase 1: Quick pnputil enumeration (immediate results)
            const { LocalInboxExtractor } = await import('./infpossible/inbox-extractor/local');
            const pnpDrivers = await LocalInboxExtractor.listInboxDrivers();

            console.log('[PrinterDrivers] pnputil found', pnpDrivers.length, 'installed drivers');

            // Send immediate response with pnputil results
            api.events.emit('RESPONSE_LIST_INBOX_DRIVERS', {
                success: true,
                drivers: pnpDrivers,
                scanning: true  // Indicates FileRepository scan is pending
            });

            // Phase 2: Async FileRepository scan (progressive results)
            // This runs in background and emits updates
            (async () => {
                try {
                    const { FileRepositoryScanner } = await import('./infpossible/inbox-extractor/filerepository');
                    const allDrivers = [...pnpDrivers];  // Start with pnputil drivers

                    // Stream results as they're found
                    for await (const driver of FileRepositoryScanner.scanPrinterDrivers()) {
                        // Check for duplicates (by oemInf)
                        const isDuplicate = allDrivers.some(d =>
                            d.oemInf === driver.oemInf ||
                            d.oemInf.endsWith(driver.oemInf)
                        );

                        if (!isDuplicate) {
                            allDrivers.push(driver);

                            // Emit update every 5 new drivers
                            if (allDrivers.length % 5 === 0) {
                                api.events.emit('UPDATE_INBOX_DRIVERS', {
                                    drivers: allDrivers,
                                    scanning: true
                                });
                            }
                        }
                    }

                    // Final update with complete results
                    console.log('[PrinterDrivers] FileRepository scan complete:', allDrivers.length, 'total drivers');
                    api.events.emit('UPDATE_INBOX_DRIVERS', {
                        drivers: allDrivers,
                        scanning: false  // Scan complete
                    });
                } catch (e: any) {
                    console.error('[PrinterDrivers] FileRepository scan failed:', e);
                    // Don't fail the whole request - pnputil results are already sent
                }
            })();

        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to list inbox drivers:', e);
            api.events.emit('RESPONSE_LIST_INBOX_DRIVERS', {
                success: false,
                error: e.message,
                drivers: []
            });
        }
    });

    // Extract and import inbox driver
    api.events.on('REQUEST_EXTRACT_INBOX_DRIVER', async (data: any) => {
        try {
            console.log('[PrinterDrivers] Extracting inbox driver:', data.oemInf);
            const { LocalInboxExtractor } = await import('./infpossible/inbox-extractor/local');
            const { PDPackageBuilder } = await import('./pd-builder');
            const os = await import('os');
            const path = await import('path');

            // Create temp directory for extraction
            const tempDir = path.join(os.tmpdir(), 'printcon-inbox-' + Date.now());

            // Export driver from DriverStore
            const exportPath = await LocalInboxExtractor.exportInboxDriver(data.oemInf, tempDir);

            if (data.importToRepository) {
                // Build .pd package
                console.log('[PrinterDrivers] Building .pd package from inbox driver...');
                const username = data.user || 'system';
                const { packageBuffer, manifest, contentHash } = await PDPackageBuilder.buildPackage(
                    exportPath,
                    username
                );

                // Save to repository
                const result = await PrinterService.savePackage(
                    packageBuffer,
                    `${manifest.driverMetadata.displayName}.pd`,
                    username,
                    contentHash
                );

                // Cleanup temp folder
                const fs = await import('fs/promises');
                await fs.rm(tempDir, { recursive: true, force: true });

                api.events.emit('RESPONSE_EXTRACT_INBOX_DRIVER', {
                    success: true,
                    packageId: result.id,
                    displayName: manifest.driverMetadata.displayName,
                    imported: true
                });
            } else {
                // User wants to export to a folder
                api.events.emit('RESPONSE_EXTRACT_INBOX_DRIVER', {
                    success: true,
                    exportPath,
                    imported: false
                });
            }
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to extract inbox driver:', e);
            api.events.emit('RESPONSE_EXTRACT_INBOX_DRIVER', {
                success: false,
                error: e.message
            });
        }
    });


    console.log('[PrinterDrivers] Plugin initialized with Storage Broker support');
};
