/**
 * Database Provider Interfaces
 * 
 * Defines the contract for database plugins to implement.
 * Compliant with Rule #11 (Interact via Types).
 */

/**
 * Key-value mapping for SQL parameters.
 * Keys = Parameter Names (e.g. '@id', 'firstName')
 * Values = Parameter Values
 */
export interface DatabaseTable {
    name: string;
    columns: Array<{
        name: string;
        type: string;
        nullable?: boolean;
        primaryKey?: boolean;
        identity?: boolean;
        defaultValue?: string;
    }>;
}

export interface ISqlParams {
    [key: string]: any;
}

/**
 * Standard interface for a Database Provider plugin.
 */
export interface IDatabaseProvider {
    /**
     * Identifies the type of database system (e.g., 'mssql', 'postgres', 'sqlite').
     * Used for driver selection and compatibility checks.
     */
    providerType: string;

    /**
     * Establish a connection to the database.
     * Should handle connection pooling and authentication internally.
     * @returns Promise that resolves when connected.
     * @throws Error if connection fails.
     */
    connect(): Promise<void>;

    /**
     * Execute a SQL query and return generic results.
     * @param sql The SQL statement to execute.
     * @param params Optional key-value parameters for parameterized queries.
     * @returns Promise resolving to an array of result objects of type T.
     */
    query<T>(sql: string, params?: ISqlParams): Promise<T[]>;

    /**
     * Synchronizes the database schema with the plugin manifest.
     * @param requirements The database requirements from the manifest.
     * @param force If true, applies changes. If false, only validates.
     * @returns Promise resolving to a boolean indicating if the schema is in sync (true = identical).
     */
    syncSchema(requirements: any, force?: boolean): Promise<boolean>;

    /**
     * Verifies if the configured database exists on the server.
     * @returns Promise resolving to true if exists, false otherwise.
     */
    checkDatabaseExists(): Promise<boolean>;

    /**
     * Retrieves the list of all schemas in the database.
     */
    getSchemas(): Promise<string[]>;

    /**
     * Retrieves the full schema (tables and columns) of the database.
     * Used for validation against expected schemas.
     */
    getCurrentSchema(): Promise<any[]>;
}
