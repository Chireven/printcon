/**
 * Mock Data for Printer Drivers
 * Rule #10: Mock-First Requirement
 */

import { PrinterDriver } from '../../../src/core/types/plugin';

export const MOCK_DRIVERS: PrinterDriver[] = [
    {
        id: 'drv-001',
        name: 'HP Universal Printing PCL 6',
        version: '7.1.0',
        os: 'Windows x64'
    },
    {
        id: 'drv-002',
        name: 'Canon Generic Plus UFR II',
        version: '2.90',
        os: 'Windows x64'
    }
];
