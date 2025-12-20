// import { PluginInitializer } from '../../../src/core/types/plugin';

// Mock Data
// Data cleared by request
export const MOCK_DRIVERS: any[] = [];

export const initialize = async (api: any) => {
    // console.log('[PrinterDrivers] Initializing...');

    // Subscribe to REQUEST_DRIVERS
    api.events.on('REQUEST_DRIVERS', (payload: any) => {
        // console.log('[PrinterDrivers] Received request:', payload);

        // Simulate processing delay
        setTimeout(() => {
            api.events.emit('RESPONSE_DRIVERS', 'printer-drivers', 'success', {
                drivers: MOCK_DRIVERS
            });
        }, 500);
    });

    api.logger.info('Printer Drivers plugin ready.', 'printer-drivers');
};
