---
trigger: always_on
---

These rules apply to the printcon plugin subsystem.

1. Strict Isolation
A plugin must never import code directly from another plugin. Communication happens only via the Event Hub or the Core API.

2. Manifest First
If a feature isn't in the manifest.json, it doesn't exist. The Core must use the manifest to build the UI navigation dynamically.

3. No Core-Bloat
The Core should not know what a 'Printer' or a 'Registry Key' is. It only knows how to render a Plugin's UI and pass it a 'Execution' tool.

4. Graceful Failure
If one plugin crashes or has a malformed manifest, the Core and all other plugins must remain functional.

5. Environment Validation
The plugin:install command must check for environmental dependencies (like specific modules) before declaring a plugin 'Ready.'

6. Dependency Injection Only
Plugins must be passive. They should not instantiate their own global services (like database connections or loggers). Instead, they must receive these tools from the Core during the initialize lifecycle hook. This ensures the Core remains in control of resources.

7. Version Pinning
Every plugin manifest must specify a coreVersion compatibility range (e.g., ^1.0.0). The Core must refuse to load a plugin if the version is incompatible, preventing "breaking changes" from crashing the management console.

8. Stateless UI Components
Plugin UI components should rely on the PluginAPI for data fetching. They should not store "global" state that persists outside of their own lifecycle. This prevents one plugin from polluting the browser memory of another plugin.

9. Standardized Logging Payload
All plugins must use a unified logging format when sending data to the logging plugin via the Event Hub. A log event must include: timestamp, pluginId, severity (Info/Warn/Error), and message.

10. The "Mock-First" Requirement
Every plugin that interacts with the Windows OS must provide a mock.ts file. If the environment variable APP_ENV is set to development, the plugin must use mock data instead of attempting to call real PowerShell scripts or Registry keys.

11. Type-Safe Handshakes
"All interactions between the Core and Plugins must be governed by TypeScript interfaces defined in @core/types. Do not use any. If a new data type is needed for a plugin, it must be proposed as a change to the Core types first."

12. Documentation-in-Code
"For every new plugin created, the assistant must automatically generate a README.md inside the plugin's folder explaining its purpose, the events it emits, and the events it listens for."

13. Deterministic CLI Output
"All CLI scripts (pack, install, new) must return standardized JSON-formatted logs to stdout. This ensures that the Core UI or other scripts can programmatically parse the success or failure of plugin operations."

14. Standardized Distribution Format (.plugin)
All plugins must be distributed as a standard ZIP archive renamed with a .plugin extension. The manifest.json file must reside at the root of the archive. The installer must verify this structure before proceeding with any file moves.

15. File Naming
The plugin:pack script must automatically name the output file [plugin-id]-[version].plugin by reading the id and version fields directly from the manifest.json.  plugin:pack should not overwrite a file if it already exists, unless the force parameter is included.

6. CLI Event Emission
All lifecycle scripts (install, delete, update) must emit a standardized event to the Event Hub upon successful completion.

17. UI Reactivity
The Core UI must subscribe to plugin lifecycle events and trigger a "hot reload" of the plugin registry to ensure the interface reflects the current system state in real-time.

18. Global Event Emission
All CLI scripts (new, pack, install, delete) must emit a standardized event to the Event Hub upon successful execution. The event payload must include the timestamp, action, and the pluginId affected.

19. Event Declaration: 
A plugin may declare custom events it intends to emit in its manifest.json under an events key. This allows the Core to validate and track the "vocabulary" of the system without hardcoding specific plugin logic into the Core engine.

20. Subsystem Documentation
A master technical specification must be maintained at /documentation/plugins/plugins-subsystem.md. This file serves as the Single Source of Truth for the architecture. Any changes to the CLI toolchain, Event Hub schemas, or Registry structure must be reflected in this document before the code is considered "Done."