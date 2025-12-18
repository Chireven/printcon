import { AllowedTools } from './types/plugin';

/**
 * Core Execution Engine
 * Rule #10: The "Mock-First" Requirement
 */
export async function execute(
    tool: AllowedTools,
    scriptName: string,
    params: Record<string, any>
): Promise<any> {
    // Rule #10: The "Mock-First" Requirement
    // Check if we should use mock data based on NODE_ENV
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment) {
        return handleMockExecution(tool, scriptName, params);
    }

    // Real execution logic would go here
    throw new Error(`Real execution for tool ${tool} in ${process.env.NODE_ENV} environment not implemented yet.`);
}

async function handleMockExecution(
    tool: AllowedTools,
    scriptName: string,
    params: Record<string, any>
): Promise<any> {
    // Only log if explicitly in a dev environment to keep stdout clean
    if (process.env.NODE_ENV === 'development') {
        console.log(`[Mock Execution] ${tool}: ${scriptName}`, params);
    }

    switch (scriptName) {
        case 'get-printers':
            return [
                { "id": "1", "name": "HR-LaserJet", "status": "Online", "jobs": 0 },
                { "id": "2", "name": "Marketing-Color", "status": "Paper Jam", "jobs": 4 },
                { "id": "3", "name": "Warehouse-Labels", "status": "Offline", "jobs": 0 }
            ];

        case 'get-ports':
            return ['IP_192.168.1.50', 'LPT1', 'USB001'];

        case 'get-drivers':
            return ['HP Universal Print Driver', 'Microsoft XPS Document Writer'];

        default:
            return { success: true, mock: true };
    }
}
