// import { PluginInitializer } from '../../../src/core/types/plugin';

// Mock Data
const generateMockDrivers = () => {
    const vendors = ['HP', 'Canon', 'Epson', 'Brother', 'Kyocera', 'Xerox'];
    return Array.from({ length: 1000 }, (_, i) => {
        const vendor = vendors[Math.floor(Math.random() * vendors.length)];
        return {
            id: `mock-${i + 1}`,
            name: `${vendor} Generic Driver ${i + 1}`,
            version: `${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 100)}`,
            os: 'Windows x64',
            vendor: vendor
        };
    });
};

export const MOCK_DRIVERS = generateMockDrivers();

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
