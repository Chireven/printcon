# PrintCon Plugin Subsystem Specification

This document serves as the master technical specification and Single Source of Truth for the PrintCon plugin architecture as per **Rule #20**.

## 1. Architectural Intent

The PrintCon architecture is **Modular-First** and **Contract-Based**. The core objective is to maintain a strict separation of concerns between the **Core Engine** and **Extension Plugins**.

- **Isolation**: Plugins are sandboxed units of logic that cannot directly access the Core's internals or other plugins.
- **Passive Nature**: Plugins do not "run" the system; they are initialized by the Core and respond to state changes or user interactions via defined interfaces.
- **Contract Enforcement**: All interactions are governed by TypeScript interfaces (defined in `@core/types`) ensuring that as long as the contract is honored, the system remains stable.

## 2. The Toolchain (CLI)

The lifecycle of a plugin is managed through a suite of standardized CLI commands:

- **`new` (Scaffolding)**: Generates a boilerplate plugin structure, including a compliant `manifest.json` and a passive `index.ts` entry point. (Rule #2, #6).
- **`pack` (Distribution)**: Bundles the plugin into a standard ZIP archive with a `.plugin` extension. It automatically names the file `[plugin-id]-[version].plugin` (Rule #15) and verifies manifest integrity (Rule #2).
- **`install` (Deployment)**: Handles extraction, environment validation (Rule #5), and registration. It routes plugins to their categorized directories (`features`, `logging`, `logonproviders`) and updates the central `registry.json`.
- **`delete` (Cleanup)**: Safely removes the plugin folder from disk and purges its entry from the central registry to prevent orphans.

## 3. The Identity System (Manifest)

The `manifest.json` is the "Identity Card" of every plugin (Rule #2). If a feature or permission isn't declared in the manifest, it does not exist to the Core.

### Required Fields:
- `id`: Unique kebab-case identifier.
- `version`: SemVer string.
- `type`: `feature`, `logging`, `logonprovider`, or `printers`.
- `coreVersion`: Compatibility range (Rule #7).
- `entryPoints`: Paths to the UI and Main logic files.

## 4. The Communication Layer

### API Bridge (`execute()`)
To maintain **Security** and **Cross-Platform Compatibility**, plugins never execute OS commands directly. Instead, they use the Core’s `execute()` method.
- **Allowed Tools**: `powershell`, `registry`, `cmd`.
- **Safety**: The Core validates parameters and sanitizes inputs before passing them to the high-privilege execution environment.

### Event Hub
The system uses a **Standardized Event Hub** for real-time reactivity (Rule #18).
- **Reserved Events**: System lifecycle events like `PLUGIN_INSTALLED`.
- **Custom Events**: Plugins can define their own "vocabulary" for cross-plugin communication, provided they are declared in the manifest.
- **Server-Side Subscriptions**: Plugins can subscribe to events (`PluginAPI.events.on`) during server initialization, enabling a full **Request-Response** pattern without new API routes.
- **Hybrid Approach**: Allows the Core to remain simple while enabling plugins to "invent" their own language.

## 6. Server-Side Plugin Loader

To adhere to the "Passive Plugin" rule while supporting event listeners, the system uses a **Singleton Plugin Loader**:
- **Initialization**: Powered by Next.js `instrumentation.ts` hook.
- **Lifecycle**: On server start, the loader reads `registry.json` and invokes the `initialize(api)` function of every active plugin.
- **Isolation**: Plugins remain in their own directories and only interact with the system via the injected `PluginAPI`.

## 7. Notification Schema

To ensure visual consistency across the management console, all system events are mapped to standardized UI notifications (Toasts) via **Sonner**.

| Event Category | Sonner Type | Icon (Lucide) | Context |
| :--- | :--- | :--- | :--- |
| **Plugin Success** | `toast.success` | `PackageCheck` | New installs or successful packs. |
| **Plugin Removal** | `toast.error` | `PackageX` | Deletions or uninstalls. |
| **Hardware Sync** | `toast.info` | `Printer` | Printer, Port, or Driver updates. |
| **System Logic** | `toast.message` | `Terminal` | New plugin creation (`plugin:new`). |

> [!IMPORTANT]
> **The "Super Toast" Override**: Regardless of the event category, if the event payload contains `status: 'failure'`, the UI MUST use `toast.error` to alert the administrator immediately (Rule #4).

## 7. Protection Locks & Live Challenges (Rule #23)

To prevent accidental deletion of critical infrastructure plugins, the system implements a **Physical Challenge** protocol.

1.  **Locking**: Admins can flag a plugin as `locked: true` in the registry.
2.  **Protected Deletion**: The `plugin:delete` command will abort if the target plugin is locked.
3.  **Live Challenge**: Unlocking requires a dynamic PIN.
    - The CLI generates a random 4-digit PIN.
    - The PIN is broadcast via the **WebSocket Event Hub** but never stored on disk.
    - The Admin must read the PIN from the **Debug Console** in the browser and enter it back into the terminal.

## 8. JIT Event Architecture

To simplify the development environment, the system utilizes a **Just-in-Time (JIT)** event server.

- **Self-Hosting**: CLI scripts automatically check if port 8080 is available and host a temporary WebSocket server if necessary.
- **Persistent Listeners**: The Browser UI aggressively attempts to reconnect to `localhost:8080` every 2 seconds, ensuring zero-configuration event visibility.

## 5. Development Mode (Mocking)

Following **Rule #10 (Mock-First)**, the system is designed to be functional even without a live Windows environment.

- **Environment Gating**: The execution engine checks `process.env.APP_ENV` (or `NODE_ENV`).
- **Data Mocking**: In `development` mode, the `execution.ts` service returns predefined mock objects (e.g., fake printers, ports, or drivers) instead of calling expensive or intrusive OS scripts.
- **Testing Logic**: This allows UI developers to build and test complex workflows using only the mock data, ensuring high velocity and safety.

---

## 9. Configuration UI

To allow plugins to expose settings to the system administrator, the architecture supports a dedicated **System Settings** view.

1.  **Manifest Declaration**:
    The plugin must specify a `settings` entry point in `manifest.json`:
    ```json
    "entryPoints": {
      "main": "server/index.js",
      "settings": "ui/Settings.tsx"
    }
    ```

2.  **Core Discovery**:
    The Core engine reads the registry, identifies plugins with a valid `settings` entry point, and lists them in the **System Settings > Plugins** navigation menu.

3.  **Local Configuration Persistence**:
    To comply with data isolation rules, plugins must store their configuration **locally** within their own directory (`plugins/category/id/config.json`).
    
    The Core provides a standardized API for this:
    - **GET** `/api/system/plugins/[pluginId]/config`: Reads `config.json`.
    - **POST** `/api/system/plugins/[pluginId]/config`: Writes `config.json`.
    
    Plugin UI components should use this API to fetch and save their state, rather than relying on global environment variables or external databases.

---
*Last Updated: 2025-12-19*
