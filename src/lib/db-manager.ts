/**
 * Database Manager
 * 
 * Central access point for the Database Layer.
 * Selects and initializes the appropriate provider based on configuration.
 */

import { IDatabaseProvider } from './interfaces/database';
// Importing directly from the plugin (Relative path mapping as @ alias is uncompiled)
import { MssqlProvider } from '../../plugins/databaseProviders/database-mssql';

class DatabaseManager {
    private static provider: IDatabaseProvider | null = null;

    /**
     * Retrieves the singleton database provider instance.
     * Initializes it if not already created.
     */
    public static getProvider(): IDatabaseProvider {
        if (this.provider) {
            return this.provider;
        }

        const providerType = process.env.DB_PROVIDER || 'mssql';

        switch (providerType.toLowerCase()) {
            case 'mssql':
                this.provider = new MssqlProvider();
                break;
            default:
                throw new Error(`Unknown DB_PROVIDER: ${providerType}. Supported providers: mssql.`);
        }

        return this.provider;
    }
}

// Export a ready-to-use instance
export const db = DatabaseManager.getProvider();
