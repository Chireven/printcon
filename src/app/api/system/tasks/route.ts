
import { NextResponse } from 'next/server';

interface SystemTask {
    id: string;
    name: string;
    description: string;
}

const TASKS: SystemTask[] = [
    { id: 'cache:clear', name: 'Clear System Cache', description: 'Flushes the internal Redis/Memory cache to ensure fresh data.' },
    { id: 'registry:sync', name: 'Synchronize Plugin Registry', description: 'Re-scans the plugins directory and updates the registry.json file.' },
    { id: 'logs:rotate', name: 'Rotate System Logs', description: 'Archives current logs and starts a fresh log file.' },
    { id: 'db:check', name: 'Integrity Check', description: 'Performs a quick connectivity and schema check on all active database providers.' }
];

export async function GET() {
    return NextResponse.json(TASKS);
}

// System Task Implementations
// Note: Dynamic imports are used to avoid loading these modules at startup if not needed
const TaskRunners: Record<string, () => Promise<string>> = {
    'registry:sync': async () => {
        const fs = await import('fs');
        const path = await import('path');

        const pluginsDir = path.join(process.cwd(), 'plugins');
        const registryPath = path.join(process.cwd(), 'src/core/registry.json');

        const categories = [
            'features',
            'printers',
            'databaseProviders',
            'storageProviders',
            'loggingProviders',
            'logonproviders'
        ];

        const newRegistry: any[] = [];
        let addedCount = 0;

        // 1. Scan Directories
        for (const cat of categories) {
            const catPath = path.join(pluginsDir, cat);
            if (fs.existsSync(catPath)) {
                const plugins = fs.readdirSync(catPath, { withFileTypes: true });
                for (const dirent of plugins) {
                    if (dirent.isDirectory()) {
                        const pluginId = dirent.name;
                        const manifestPath = path.join(catPath, pluginId, 'manifest.json');

                        if (fs.existsSync(manifestPath)) {
                            try {
                                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                                // Normalize path to be relative from root (e.g. "plugins/features/my-plugin")
                                const relPath = `plugins/${cat}/${pluginId}`;

                                newRegistry.push({
                                    id: manifest.id,
                                    name: manifest.name,
                                    version: manifest.version,
                                    type: manifest.type,
                                    path: relPath,
                                    active: manifest.active !== false
                                });
                                addedCount++;
                            } catch (e) {
                                console.error(`[RegistrySync] Failed to parse ${pluginId}`, e);
                            }
                        }
                    }
                }
            }
        }

        // 2. Write Registry
        fs.writeFileSync(registryPath, JSON.stringify(newRegistry, null, 4));

        return `Registry updated. Found ${addedCount} plugins. Refresh page/restart to load changes.`;
    },
    'cache:clear': async () => {
        await new Promise(r => setTimeout(r, 1000));
        return 'Cache cleared (Mock).';
    },
    'logs:rotate': async () => {
        await new Promise(r => setTimeout(r, 1000));
        return 'Logs rotated (Mock).';
    },
    'db:check': async () => {
        await new Promise(r => setTimeout(r, 1000));
        return 'Database Integrity Verified (Mock).';
    }
};

export async function POST(req: Request) {
    try {
        const { taskId } = await req.json();
        const runner = TaskRunners[taskId];

        if (!runner) {
            return NextResponse.json({ status: 'error', message: 'Task implementation not found' }, { status: 404 });
        }

        console.log(`[SystemTask] Executing: ${taskId}`);
        const result = await runner();

        return NextResponse.json({
            status: 'success',
            message: result,
            timestamp: new Date().toISOString()
        });

    } catch (e: any) {
        console.error(e);
        return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
    }
}
