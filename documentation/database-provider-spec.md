
# Database Provider Specification

## Overview

The **Database Provider** subsystem abstracts the storage and retrieval of relational data. It adheres to the **Broker Pattern**, where the Core provides a generic API (`DatabaseBroker`) that delegates actual operations to a dynamically loaded plugin (the Provider).

## Architecture

### The Broker (`DatabaseBroker`)
*   **Location**: `src/core/database-broker.ts`
*   **Role**:
    *   Reads `src/config/database.json`.
    *   Resolves configuration variables (e.g., connection strings).
    *   Dynamically loads the configured provider plugin.
    *   Exposes a unified `query<T>(sql, params)` interface.

### The Provider Interface (`IDatabaseProvider`)
All database plugins must implement this interface:

```typescript
export interface IDatabaseProvider {
    providerType: string;
    connect(): Promise<void>;
    query<T>(query: string, params?: ISqlParams): Promise<T[]>;
    // ... specialized schema methods
}
```

## Configuration

Configuration is managed via `src/config/database.json`.

```json
{
    "providerPlugin": "database-mssql",
    "providerConfig": {
        "server": "@env.DB_SERVER",
        "database": "PrintCon",
        "options": {
            "encrypt": true
        }
    }
}
```

*   **providerPlugin**: The ID of the plugin to load (must be installed via `npm run plugin:install`).
*   **providerConfig**: Passed directly to the provider's factory function. Supports dynamic variables (starting with `@`).

## Usage for Plugins

Plugins **MUST NOT** import database drivers directly. They use the injected `PluginAPI`.

```typescript
export const initialize: PluginInitializer = async (api) => {
    const users = await api.database.query('SELECT * FROM Users WHERE Role = @role', {
        role: 'Admin'
    });
};
```

## Creating a Provider

1.  Create a plugin with `type: "databaseProvider"`.
2.  Implement the `IDatabaseProvider` interface.
3.  Export a factory function `create[Type]Provider(config)`.

```typescript
// plugins/databaseProviders/my-db/index.ts
export function createMyDbProvider(config: any): IDatabaseProvider {
    return new MyDbProvider(config);
}
```
