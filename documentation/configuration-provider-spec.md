
# Configuration Provider Specification (Variable Resolution)

## Overview

The **Configuration Provider** subsystem, powered by the **Variable Resolution Service**, decouples the Core system from plugin-specific environments. It allows Core services to be configured dynamically at runtime without hardcoding paths or credentials.

## Core Concepts

### 1. The Variable Service
*   **Location**: `src/core/variables.ts`
*   **Role**: A central in-memory registry for key-value pairs.
*   **Features**:
    *   **Async Resolution**: Consumers can wait for values to appear (critical for startup handling).
    *   **Hot Reloading**: Emits events when values change.
    *   **Scoped Security**: Enforces `pluginId.key` namespacing.

### 2. Provider Configuration Files
Core services (Storage, Database) utilize JSON configuration files in `src/config/`. These files support **Variable References**.

**Syntax**: Values starting with `@` are treated as variable keys.

```json
// src/config/storage.json
{
    "providerConfig": {
        "repositoryPath": "@printer-drivers.DriverRepository"
    }
}
```

### 3. Plugin Publishing
Plugins publish their configuration during initialization via the `PluginAPI`.

```typescript
// plugins/printer-drivers/index.ts
api.variables.publish('DriverRepository', 'C:\\Drivers');
```

*   **Result**: The variable is stored as `printer-drivers.DriverRepository`.

## Workflow

1.  **Core Startup**: `StorageBroker` reads `storage.json`.
2.  **Detection**: It sees `"@printer-drivers.DriverRepository"`.
3.  **Resolution**: It calls `VariableService.get('printer-drivers.DriverRepository')`.
    *   If the variable is not yet published, it **waits**.
4.  **Plugin Load**: `printer-drivers` initializes and publishes the path.
5.  **Completion**: `StorageBroker` receives the value and finishes initialization.

## Environment Variables
Environment variables can be exposed as system variables (e.g., `env.DB_SERVER`) to bridge `.env` files into this dynamic system.

## Best Practices

1.  **Publish Early**: Plugins should publish variables as the very first step in their `initialize` function.
2.  **Use Defaults**: Plugins should have sensible defaults if their local config is missing.
3.  **Namespace**: Always rely on the automatic namespacing. Do not try to publish to global keys.
