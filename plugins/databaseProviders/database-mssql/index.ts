import sql from 'mssql';
import { IDatabaseProvider, DatabaseTable } from '../../../src/lib/interfaces/database';
import { Logger } from '../../../src/core/logger';

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
            Logger.info('databaseProvider', 'mssql', `Connecting to ${effectiveConfig.server} (${effectiveConfig.database})`);
            this.pool = await new sql.ConnectionPool(effectiveConfig).connect();
        } catch (err: any) {
            Logger.error('databaseProvider', 'mssql', 'Connection failed', err);
            throw err;
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

        // Handle Instance Name
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
            database: raw.database || process.env.DB_NAME!,
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
            config.user = raw.username || process.env.DB_USER!;
            config.password = raw.password || process.env.DB_PASSWORD!;
        }

        return config;
    }
}

// Factory function accepting config
export const createMssqlProvider = (config?: any) => new MssqlProvider(config);
