import fs from 'fs';
import path from 'path';
import { SchemaDefinitions, TableDefinition } from './definitions';

const PLUGINS_DIR = path.join(process.cwd(), 'plugins');

interface PluginManifest {
    id: string;
    database?: {
        schema?: string;
        tables: TableDefinition[];
    };
}

export async function getAggregatedSchema(): Promise<{ tables: TableDefinition[], schemas: string[], schemaToPluginMap: Record<string, string> }> {
    const tables: TableDefinition[] = [...SchemaDefinitions];
    const schemas = new Set<string>();
    const schemaToPluginMap: Record<string, string> = {};

    if (!fs.existsSync(PLUGINS_DIR)) {
        return { tables, schemas: [], schemaToPluginMap: {} };
    }

    try {
        // Scan plugins directory structure: plugins/{category}/{pluginId}/manifest.json
        const categories = await fs.promises.readdir(PLUGINS_DIR, { withFileTypes: true });

        for (const cat of categories) {
            if (!cat.isDirectory()) continue;

            const catPath = path.join(PLUGINS_DIR, cat.name);
            const plugins = await fs.promises.readdir(catPath, { withFileTypes: true });

            for (const plug of plugins) {
                if (!plug.isDirectory()) continue;

                const manifestPath = path.join(catPath, plug.name, 'manifest.json');
                if (fs.existsSync(manifestPath)) {
                    try {
                        const content = await fs.promises.readFile(manifestPath, 'utf8');
                        const manifest = JSON.parse(content) as PluginManifest;

                        if (manifest.database) {
                            const dbSchema = manifest.database.schema;
                            if (dbSchema) {
                                schemas.add(dbSchema);
                                schemaToPluginMap[dbSchema] = manifest.id;
                            }

                            if (manifest.database.tables) {
                                manifest.database.tables.forEach(t => {
                                    tables.push({
                                        ...t,
                                        schema: dbSchema || 'dbo'
                                    });
                                });
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to load manifest for ${plug.name}:`, e);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error scanning plugins for schema:', e);
    }

    return { tables, schemas: Array.from(schemas), schemaToPluginMap };
}
