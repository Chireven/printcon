/**
 * Core Plugin System Contracts
 * Based on .agent/rules/plugins.md
 */

export type PluginType = 'logonprovider' | 'logging' | 'feature' | 'printers';

export interface PrinterDriver {
  id: string;
  name: string;
  version: string;
  os: string;
  vendor?: string;
}

export interface PluginManifest {
  /** Unique identifier for the plugin (e.g., 'printer-manager') */
  id: string;
  /** semantic versioning */
  version: string;
  /** Plugin category as defined in project architecture */
  type: PluginType;
  /** Range of compatible core versions (e.g., '^1.0.0') - Rule #7 */
  coreVersion: string;
  /** List of permissions or capabilities the plugin requires */
  requiredPermissions: string[];
  /** UI entry points or script paths (Rule #2 - Manifest First) */
  entryPoints?: {
    ui?: string;
    main: string;
  };
}

export interface PluginEventHub {
  /** Emit an event to other plugins - Rule #1 */
  emit(event: string, payload: any): void;
  /** Subscribe to events from other plugins - Rule #1 */
  on(event: string, callback: (payload: any) => void): void;
}

export type AllowedTools = 'powershell' | 'registry' | 'cmd';

export interface PluginAPI {
  /** Event Hub for cross-plugin communication */
  events: PluginEventHub;
  /** 
   * Structured execution tool for OS-level operations.
   * The Core handles the actual execution to keep plugins passive and secure.
   * Rule #3 & Rule #6
   * 
   * @param tool The specific OS tool to invoke.
   * @param scriptName The identifier for the script or command.
   * @param params Key-value pairs of parameters passed to the script.
   */
  execute(tool: AllowedTools, scriptName: string, params: Record<string, any>): Promise<any>;
  /** Logger provided by the Core - Rule #6 & Rule #9 */
  log(severity: 'Info' | 'Warn' | 'Error', message: string): void;
}

/**
 * Initializer function signature that every plugin must export.
 * Rule #6: Dependency Injection Only
 */
export type PluginInitializer = (api: PluginAPI) => Promise<void>;
