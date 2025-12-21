import type { PluginInitializer } from '../../../src/core/types/plugin';
import { PrinterService } from './service.ts';

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

    console.log('[PrinterDrivers] Plugin initialized with Storage Broker support');
};
