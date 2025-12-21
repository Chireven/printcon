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
            console.log('[PrinterDrivers] Updating driver:', payload.id);
            await PrinterService.updatePackage(payload.id, payload.metadata);
            api.events.emit('RESPONSE_UPDATE_DRIVER', {
                success: true,
                id: payload.id
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to update driver:', e);
            api.events.emit('RESPONSE_UPDATE_DRIVER', {
                success: false,
                error: e.message
            });
        }
    });

    // Subscribe to REQUEST_DELETE_DRIVER
    api.events.on('REQUEST_DELETE_DRIVER', async (payload: any) => {
        try {
            console.log('[PrinterDrivers] Deleting driver:', payload.id);
            const result = await PrinterService.deletePackage(payload.id);
            api.events.emit('RESPONSE_DELETE_DRIVER', {
                success: true,
                fileDeleted: result.fileDeleted
            });
        } catch (e: any) {
            console.error('[PrinterDrivers] Failed to delete driver:', e);
            api.events.emit('RESPONSE_DELETE_DRIVER', {
                success: false,
                error: e.message
            });
        }
    });

    console.log('[PrinterDrivers] Plugin initialized with Storage Broker support');
};
