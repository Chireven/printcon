/**
 * Plugin: Database Mssql
 */
import sql from 'mssql';
import { IDatabaseProvider, ISqlParams } from '../../../src/lib/interfaces/database';

export class MssqlProvider implements IDatabaseProvider {
  // Required by Interface
  public providerType = 'mssql';

  // Instance Config
  private config: sql.config | null = null;

  // Connection State (Instance-scoped now, allowing independent connections for testing)
  private pool: sql.ConnectionPool | null = null;
  private isConnecting: boolean = false;

  constructor(config?: any) {
    if (config) {
      this.config = {
        user: config.username || process.env.DB_USER,
        password: config.password || process.env.DB_PASSWORD,
        server: config.server || process.env.DB_SERVER || 'localhost',
        database: config.database || process.env.DB_NAME,
        options: {
          encrypt: true,
          trustServerCertificate: true,
          instanceName: config.instance || process.env.DB_INSTANCE
        }
      };
    }
  }

  /**
   * Connects to the SQL Server.
   */
  async connect(): Promise<void> {
    if (this.pool && this.pool.connected) {
      return;
    }

    if (this.isConnecting) {
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.pool && this.pool.connected) return;
    }

    this.isConnecting = true;

    try {
      // Priority: Instance Config -> Process Env
      const config: sql.config = this.config || {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER || 'localhost',
        database: process.env.DB_NAME,
        options: {
          encrypt: true,
          trustServerCertificate: true,
          instanceName: process.env.DB_INSTANCE
        }
      };

      // Sanitize Instance
      if (config.options && 'instanceName' in config.options && config.options.instanceName === '') {
        delete config.options.instanceName;
      }

      console.log('[MssqlProvider] Connecting Attempt:', {
        server: config.server,
        instance: config.options?.instanceName,
        database: config.database,
        user: config.user,
        fromEnv: !this.config
      });

      // Basic validation
      if (!config.user || !config.password || !config.server || !config.database) {
        throw new Error('Connection failed: Missing database credentials in environment or configuration.');
      }

      this.pool = await sql.connect(config);
      console.log('MSSQL Connected successfully.');
    } catch (err: any) {
      console.error('MSSQL Connection Failed:', err.message);
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Executes a query against the SQL Server.
   */
  async query<T>(query: string, params?: ISqlParams): Promise<T[]> {
    try {
      await this.connect(); // Ensure connection

      if (!this.pool) {
        throw new Error('Database connection pool is not initialized.');
      }

      const request = this.pool.request();

      // Secure Parameter Injection
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          request.input(key, value);
        }
      }

      const result = await request.query<T>(query);
      return result.recordset;
    } catch (err: any) {
      console.error(`MSSQL Query Error: ${err.message}`, { query, params });
      throw err;
    }
  }

  getScopedConnection(schema: string): this {
    return this;
  }

  /**
   * Checks if the configured database exists.
   * Connects to 'master' to query sys.databases.
   */
  async checkDatabaseExists(): Promise<boolean> {
    let masterPool: sql.ConnectionPool | null = null;
    try {
      // Create config for Master
      const masterConfig = { ...this.getEffectiveConfig() };
      masterConfig.database = 'master';

      masterPool = await new sql.ConnectionPool(masterConfig).connect();
      const dbName = this.getEffectiveConfig().database;

      const result = await masterPool.request()
        .input('name', dbName)
        .query('SELECT name FROM sys.databases WHERE name = @name');

      return result.recordset.length > 0;
    } catch (err) {
      console.error('Check DB Exists Failed:', err);
      throw err;
    } finally {
      if (masterPool) await masterPool.close();
    }
  }

  /**
   * Creates the configured database.
   */
  async createDatabase(): Promise<void> {
    let masterPool: sql.ConnectionPool | null = null;
    try {
      const masterConfig = { ...this.getEffectiveConfig() };
      masterConfig.database = 'master';

      masterPool = await new sql.ConnectionPool(masterConfig).connect();
      const dbName = this.getEffectiveConfig().database;

      // Simple create (Sanitize dbName? MSSQL identifiers are strict)
      // Using bracket quoting for safety [Name]
      await masterPool.request().query(`CREATE DATABASE [${dbName}]`);
    } catch (err) {
      console.error('Create DB Failed:', err);
      throw err;
    } finally {
      if (masterPool) await masterPool.close();
    }
  }

  /**
   * Retrieves current schema (Tables and Columns).
   */
  async getCurrentSchema(): Promise<any[]> {
    // Query Information Schema
    const query = `
            SELECT
                t.TABLE_SCHEMA as SchemaName,
                t.TABLE_NAME as TableName,
                c.COLUMN_NAME as ColumnName,
                c.DATA_TYPE as DataType,
                c.IS_NULLABLE as IsNullable
            FROM INFORMATION_SCHEMA.TABLES t
            JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
            WHERE t.TABLE_TYPE = 'BASE TABLE'
        `;
    return this.query(query);
  }

  /**
   * Retrieves list of existing schemas.
   */
  async getSchemas(): Promise<string[]> {
    const result = await this.query<{ SCHEMA_NAME: string }>(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('dbo', 'guest', 'sys', 'INFORMATION_SCHEMA')"
    );
    return result.map(r => r.SCHEMA_NAME);
  }

  /**
   * Helper to resolve config priority without side effects
   */
  private getEffectiveConfig(): sql.config {
    return this.config || {
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_NAME!,
      options: {
        encrypt: true,
        trustServerCertificate: true
      }
    };
  }
}
