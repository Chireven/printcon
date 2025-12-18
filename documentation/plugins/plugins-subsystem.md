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
- `type`: `feature`, `logging`, or `logonprovider`.
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
- **Hybrid Approach**: Allows the Core to remain simple while enabling plugins to "invent" their own language.

## 5. Development Mode (Mocking)

Following **Rule #10 (Mock-First)**, the system is designed to be functional even without a live Windows environment.

- **Environment Gating**: The execution engine checks `process.env.APP_ENV` (or `NODE_ENV`).
- **Data Mocking**: In `development` mode, the `execution.ts` service returns predefined mock objects (e.g., fake printers, ports, or drivers) instead of calling expensive or intrusive OS scripts.
- **Testing Logic**: This allows UI developers to build and test complex workflows using only the mock data, ensuring high velocity and safety.

---
*Last Updated: 2025-12-17*
