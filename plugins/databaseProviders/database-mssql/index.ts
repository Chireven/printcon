import sql from 'mssql';
import { IDatabaseProvider, DatabaseTable } from '../../../src/lib/interfaces/database';
import { Logger } from '../../../src/core/logger';
import type { PluginInitializer } from '../../../src/core/types/plugin';
import fs from 'fs';
import path from 'path';

export class MssqlProvider implements IDatabaseProvider {
    providerType = 'mssql';
    private pool: sql.ConnectionPool | null = null;
    private config: sql.config | null = null;

    constructor(config?: any) {
        this.config = config || null;
    }

    async initialize(config: any): Promise<void> {
        this.config = config;
    }

    async connect(): Promise<void> {
        if (this.pool?.connected) return;

        try {
            const effectiveConfig = this.getEffectiveConfig();

            // Validate required config
            if (!effectiveConfig.server) {
                throw new Error('Database server is not configured. Check DB_SERVER environment variable or settings.');
            }
            if (!effectiveConfig.database) {
                throw new Error('Database name is not configured. Check DB_NAME environment variable or settings.');
            }

            Logger.info('databaseProvider', 'mssql', `Connecting to ${effectiveConfig.server} (${effectiveConfig.database})`);
            this.pool = await new sql.ConnectionPool(effectiveConfig).connect();
        } catch (err: any) {
            const cleanError = this.extractErrorMessage(err);
            Logger.error('databaseProvider', 'mssql', 'Connection failed', cleanError);
            throw new Error(cleanError);
        }
    }

    async query<T = any>(sql: string, params?: any): Promise<T[]> {
        await this.connect();
        const request = this.pool!.request();

        if (params) {
            for (const key in params) {
                request.input(key, params[key]);
            }
        }

        const result = await request.query(sql);
        return result.recordset as T[];
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }

    /**
     * Helper to list schemas (for debug/validation)
     */
    async listSchemas(): Promise<string[]> {
        await this.connect();
        const result = await this.query<{ SCHEMA_NAME: string }>(
            "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('dbo', 'guest', 'sys', 'INFORMATION_SCHEMA')"
        );
        return result.map(r => r.SCHEMA_NAME);
    }

    async checkDatabaseExists(): Promise<boolean> {
        try {
            // Cannot connect to the specific db if checking if it exists, 
            // so we might fail if we try to connect to a non-existent DB in connect().
            // However, connect() uses the config.database.
            // If the DB doesn't exist, connect() will throw.
            // Strategy: 
            // 1. Try to connect. If valid, it exists.
            // 2. If it fails with specific error (db not found), return false.
            // 3. Alternatively, connect to 'master' and query.

            // Given existing structure, let's try connecting to master.
            const masterConfig = { ...this.getEffectiveConfig(), database: 'master' };
            const pool = await new sql.ConnectionPool(masterConfig).connect();

            const dbName = this.getEffectiveConfig().database;
            const result = await pool.request()
                .input('name', dbName)
                .query('SELECT name FROM sys.databases WHERE name = @name');

            await pool.close();
            return result.recordset.length > 0;
        } catch (err) {
            Logger.error('databaseProvider', 'mssql', 'Failed to check database existence', err);
            // If we can't connect to master, we can't verify. Throwing is appropriate.
            throw err;
        }
    }

    async getSchemas(): Promise<string[]> {
        await this.connect();
        const result = await this.query<{ SCHEMA_NAME: string }>(
            "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('dbo', 'guest', 'sys', 'INFORMATION_SCHEMA')"
        );
        return result.map(r => r.SCHEMA_NAME);
    }

    async getCurrentSchema(): Promise<any[]> {
        await this.connect();
        const sql = `
            SELECT 
                t.TABLE_SCHEMA as SchemaName,
                t.TABLE_NAME as TableName,
                c.COLUMN_NAME as ColumnName,
                c.DATA_TYPE as DataType,
                c.IS_NULLABLE as IsNullable
            FROM INFORMATION_SCHEMA.TABLES t
            JOIN INFORMATION_SCHEMA.COLUMNS c 
                ON t.TABLE_SCHEMA = c.TABLE_SCHEMA 
                AND t.TABLE_NAME = c.TABLE_NAME
            WHERE t.TABLE_TYPE = 'BASE TABLE'
        `;
        return this.query(sql);
    }

    async syncSchema(requirements: any, force: boolean = false): Promise<boolean> {
        try {
            await this.connect();

            const { schema, tables } = requirements;
            let inSync = true;

            // 1. Check/Create Schema
            const schemaExists = await this.query(`SELECT * FROM sys.schemas WHERE name = @name`, { name: schema });
            if (schemaExists.length === 0) {
                if (force) {
                    Logger.info('databaseProvider', 'mssql', `Creating schema: ${schema}`);
                    await this.query(`EXEC('CREATE SCHEMA [${schema}]')`);
                } else {
                    Logger.warn('databaseProvider', 'mssql', `Schema missing: ${schema}`);
                    inSync = false;
                }
            }

            // 2. Check/Create Tables and Columns
            for (const table of tables) {
                const tableName = `[${schema}].[${table.name}]`;
                const checkTable = `SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table`;

                const tableExists = await this.query(checkTable, { schema: schema, table: table.name });

                if (tableExists.length === 0) {
                    // Table doesn't exist - Create it
                    if (force) {
                        Logger.info('databaseProvider', 'mssql', `Creating table: ${tableName}`);

                        const columns = table.columns.map((col: any) => {
                            let def = `[${col.name}] ${col.type}`;
                            if (col.identity) def += ' IDENTITY(1,1)';
                            if (col.primaryKey) def += ' PRIMARY KEY';
                            if (col.nullable === false) def += ' NOT NULL';
                            if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
                            return def;
                        }).join(', ');

                        await this.query(`CREATE TABLE ${tableName} (${columns})`);
                    } else {
                        Logger.warn('databaseProvider', 'mssql', `Table missing: ${tableName}`);
                        inSync = false;
                    }
                } else {
                    // Table exists - Check for missing columns (Schema Evolution)
                    for (const col of table.columns) {
                        const checkColumn = `
              SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = @schema 
              AND TABLE_NAME = @table 
              AND COLUMN_NAME = @column
            `;

                        const colExists = await this.query(checkColumn, {
                            schema: schema,
                            table: table.name,
                            column: col.name
                        });

                        if (colExists.length === 0) {
                            if (force) {
                                Logger.info('databaseProvider', 'mssql', `Adding missing column: ${tableName}.${col.name}`);
                                let def = `[${col.name}] ${col.type}`;
                                if (col.nullable === false) def += ' NOT NULL';
                                if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;

                                await this.query(`ALTER TABLE ${tableName} ADD ${def}`);
                            } else {
                                Logger.warn('databaseProvider', 'mssql', `Column missing: ${tableName}.${col.name}`);
                                inSync = false;
                            }
                        }
                    }
                }
            }

            return inSync;
        } catch (err: any) {
            Logger.error('databaseProvider', 'mssql', 'Schema Sync Failed', err);
            throw err;
        }
    }

    private getEffectiveConfig(): sql.config {
        // Priority 1: Config passed via constructor/initialize
        // Priority 2: Process Env Variables

        const raw = this.config || {};
        const isWindows = raw.logonType === 'windows';

        let server = raw.server || process.env.DB_SERVER || 'localhost';

        // Handle Instance Name (use single backslash for SQL Server)
        if (raw.instance && raw.instance.trim() !== '') {
            // If server doesn't already have instance syntax (server\instance)
            if (!server.includes('\\')) {
                server = `${server}\\${raw.instance}`;
            }
        } else if (process.env.DB_INSTANCE) {
            if (!server.includes('\\')) {
                server = `${server}\\${process.env.DB_INSTANCE}`;
            }
        }

        const config: sql.config = {
            server: server,
            database: raw.database || process.env.DB_NAME || '',
            options: {
                encrypt: true, // Azure required
                trustServerCertificate: true // Self-signed certs
            }
        };

        if (isWindows) {
            // Windows Auth (requires driver support or running as user)
            // msg-nodesqlv8 is usually required for true Integrated Security on Windows
            // but for 'tedious' (default), we might need domain settings or just ignore user/pass.
            // CAUTION: 'tedious' driver (default in node-mssql) does NOT support SSPI (Windows Auth) natively on non-Windows or without extensive setup.
            // However, usually 'trustedConnection: true' is the key.
            (config as any).options.trustedConnection = true;
        } else {
            // SQL Auth
            config.user = raw.username || process.env.DB_USER || '';
            config.password = raw.password || process.env.DB_PASSWORD || '';
        }

        return config;
    }

    /**
     * Extracts a clean, human-readable error message from mssql errors.
     * MSSQL errors can be deeply nested with XML/JSON structures.
     */
    private extractErrorMessage(err: any): string {
        // Try to get the most meaningful message
        if (typeof err === 'string') return err;

        // Check for nested originalError (common in mssql driver)
        if (err?.originalError?.message) {
            return err.originalError.message;
        }

        // Check for nested info (connection errors)
        if (err?.originalError?.info?.message) {
            return err.originalError.info.message;
        }

        // Standard message
        if (err?.message) {
            // Strip XML/JSON garbage if present
            let msg = err.message;

            // Sometimes errors have XML-like content, extract just the text
            if (msg.includes('<') && msg.includes('>')) {
                // Try to extract text between tags or just use the first line
                const firstLine = msg.split('\n')[0];
                if (firstLine.length < msg.length) {
                    msg = firstLine;
                }
            }

            return msg;
        }

        return 'Unknown database error';
    }
}

// Factory function accepting config
export const createMssqlProvider = (config?: any) => new MssqlProvider(config);

// Plugin initialization with Event Hub handlers
export const initialize: PluginInitializer = async (api) => {
    console.log('[DatabaseMSSQL] Initializing database provider plugin...');

    // Subscribe to REQUEST_TEST_DB_CONNECTION
    api.events.on('REQUEST_TEST_DB_CONNECTION', async (payload: any) => {
        try {
            console.log('[DatabaseMSSQL] Testing database connection...');

            if (payload.action === 'syncSchema') {
                // Schema sync operation
                const provider = new MssqlProvider(payload.config);
                await provider.connect();

                // Load all active plugin manifests
                const registry = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/core/registry.json'), 'utf8'));
                const results = [];

                for (const plugin of registry) {
                    if (!plugin.active) continue;

                    const manifestPath = path.join(process.cwd(), plugin.path, 'manifest.json');
                    if (fs.existsSync(manifestPath)) {
                        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                        if (manifest.database) {
                            try {
                                const synced = await provider.syncSchema(manifest.database, true);
                                results.push({ plugin: plugin.id, status: synced ? 'synced' : 'failed' });
                            } catch (e: any) {
                                results.push({ plugin: plugin.id, status: 'error', message: e.message });
                            }
                        }
                    }
                }

                api.events.emit('RESPONSE_TEST_DB_CONNECTION', {
                    success: true,
                    data: results
                });
            } else {
                // Simple connection test
                const provider = new MssqlProvider(payload);
                const result = await provider.query<{ version: string }>('SELECT @@VERSION as version');

                api.events.emit('RESPONSE_TEST_DB_CONNECTION', {
                    success: true,
                    data: result
                });
            }
        } catch (e: any) {
            console.error('[DatabaseMSSQL] Connection test failed:', e);
            api.events.emit('RESPONSE_TEST_DB_CONNECTION', {
                success: false,
                error: e.message
            });
        }
    });

    // Subscribe to REQUEST_VALIDATE_SCHEMA
    api.events.on('REQUEST_VALIDATE_SCHEMA', async (payload: any) => {
        try {
            console.log('[DatabaseMSSQL] Validating schema...');
            const provider = new MssqlProvider(payload);

            // Get current state
            const currentSchemaCols = await provider.getCurrentSchema();
            const currentSchemasList = await provider.getSchemas();

            const currentTables: Record<string, any[]> = {};
            currentSchemaCols.forEach((row: any) => {
                const schema = row.SchemaName || 'dbo';
                const table = row.TableName;
                const key = `[${schema.toLowerCase()}].[${table.toLowerCase()}]`;

                if (!currentTables[key]) {
                    currentTables[key] = [];
                }
                currentTables[key].push({
                    name: row.ColumnName,
                    type: row.DataType,
                    nullable: row.IsNullable === 'YES'
                });
            });

            // Get expected state
            const { getAggregatedSchema } = await import('../../../src/lib/schema/registry');
            const { tables: expectedTables, schemas: expectedSchemas, schemaToPluginMap } = await getAggregatedSchema();

            const results: any[] = [];
            const validatedPlugins = new Set<string>();

            // Validate schemas
            expectedSchemas.forEach(s => {
                if (s !== 'dbo') {
                    const exists = currentSchemasList.some(cs => cs.toLowerCase() === s.toLowerCase());
                    results.push({
                        tableName: `Schema: ${s}`,
                        status: exists ? 'valid' : 'missing',
                        issues: exists ? [] : [`Schema '${s}' does not exist.`]
                    });

                    if (exists) {
                        const pluginId = schemaToPluginMap[s];
                        if (pluginId) validatedPlugins.add(pluginId);
                    }
                }
            });

            // Validate tables
            expectedTables.forEach(expected => {
                const schema = expected.schema || 'dbo';
                const key = `[${schema.toLowerCase()}].[${expected.name.toLowerCase()}]`;

                const exists = !!currentTables[key];
                let status: 'missing' | 'valid' | 'invalid' = 'missing';
                const issues: string[] = [];

                if (exists) {
                    status = 'valid';
                    const currentCols = currentTables[key];

                    expected.columns.forEach(expectedCol => {
                        const found = currentCols.find(c => c.name.toLowerCase() === expectedCol.name.toLowerCase());
                        if (!found) {
                            status = 'invalid';
                            issues.push(`Missing column: ${expectedCol.name}`);
                        }
                    });
                }

                results.push({
                    tableName: schema !== 'dbo' ? `${schema}.${expected.name}` : expected.name,
                    status,
                    issues
                });
            });

            const hasIssues = results.some(r => r.status !== 'valid');

            // Clear alerts for validated plugins
            if (validatedPlugins.size > 0) {
                const { SystemStatus } = await import('../../../src/core/system-status');

                validatedPlugins.forEach(pluginId => {
                    const schemaName = Object.keys(schemaToPluginMap).find(key => schemaToPluginMap[key] === pluginId);

                    if (schemaName) {
                        const pluginIssues = results.filter(r => {
                            return r.tableName.includes(schemaName) && r.status !== 'valid';
                        });

                        if (pluginIssues.length === 0) {
                            SystemStatus.update(pluginId, [
                                { label: 'Database', value: 'Synced', severity: 'success' }
                            ]);
                        }
                    }
                });
            }

            api.events.emit('RESPONSE_VALIDATE_SCHEMA', {
                success: true,
                tables: results,
                needsHealing: hasIssues
            });
        } catch (e: any) {
            console.error('[DatabaseMSSQL] Schema validation failed:', e);
            api.events.emit('RESPONSE_VALIDATE_SCHEMA', {
                success: false,
                error: e.message
            });
        }
    });

    // Subscribe to REQUEST_FIX_SCHEMA
    api.events.on('REQUEST_FIX_SCHEMA', async (payload: any) => {
        try {
            console.log('[DatabaseMSSQL] Applying schema fixes...');
            const provider = new MssqlProvider(payload);

            // Load aggregated schema requirements
            const { getAggregatedSchema } = await import('../../../src/lib/schema/registry');
            const { schemas, tables } = await getAggregatedSchema();

            const results = [];

            // Process each schema
            for (const schemaName of schemas) {
                if (schemaName === 'dbo') continue;

                const schemaTables = tables.filter(t => t.schema === schemaName);
                const requirement = { schema: schemaName, tables: schemaTables };

                try {
                    const synced = await provider.syncSchema(requirement, true);
                    results.push({
                        schema: schemaName,
                        status: synced ? 'synced' : 'partial',
                        message: synced ? 'Schema synchronized' : 'Partial sync completed'
                    });
                } catch (e: any) {
                    results.push({
                        schema: schemaName,
                        status: 'error',
                        message: e.message
                    });
                }
            }

            api.events.emit('RESPONSE_FIX_SCHEMA', {
                success: true,
                results: results
            });
        } catch (e: any) {
            console.error('[DatabaseMSSQL] Schema fix failed:', e);
            api.events.emit('RESPONSE_FIX_SCHEMA', {
                success: false,
                error: e.message
            });
        }
    });

    // Subscribe to REQUEST_DB_STATUS
    api.events.on('REQUEST_DB_STATUS', async (payload: any) => {
        try {
            console.log('[DatabaseMSSQL] Checking database status...');
            const provider = new MssqlProvider(payload);
            const exists = await provider.checkDatabaseExists();

            api.events.emit('RESPONSE_DB_STATUS', {
                success: true,
                exists: exists
            });
        } catch (e: any) {
            console.error('[DatabaseMSSQL] Status check failed:', e);
            api.events.emit('RESPONSE_DB_STATUS', {
                success: false,
                error: e.message,
                exists: false
            });
        }
    });

    // Subscribe to REQUEST_DB_CREATE
    api.events.on('REQUEST_DB_CREATE', async (payload: any) => {
        try {
            console.log('[DatabaseMSSQL] Creating database:', payload.database);
            const provider = new MssqlProvider(payload);

            // Connect to master to create database
            const masterConfig = { ...payload, database: 'master' };
            const masterProvider = new MssqlProvider(masterConfig);
            await masterProvider.connect();

            await masterProvider.query(`CREATE DATABASE [${payload.database}]`);
            await masterProvider.disconnect();

            api.events.emit('RESPONSE_DB_CREATE', {
                success: true,
                message: `Database '${payload.database}' created successfully`
            });
        } catch (e: any) {
            console.error('[DatabaseMSSQL] Database creation failed:', e);
            api.events.emit('RESPONSE_DB_CREATE', {
                success: false,
                error: e.message
            });
        }
    });

    console.log('[DatabaseMSSQL] Plugin initialized with Event Hub support');
};
