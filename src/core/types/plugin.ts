/**
 * Core Plugin System Contracts
 * Based on .agent/rules/plugins.md
 */

export type PluginType = 'logonprovider' | 'loggingProvider' | 'feature' | 'printers' | 'databaseProvider' | 'storageProvider';

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
    /** Relative path to the Settings component (e.g., 'Settings.tsx') */
    settings?: string;
  };
  /** Database Schema Definition (Rule #2) */
  database?: {
    schema: string;
    tables: {
      name: string;
      columns: {
        name: string;
        type: string;
        nullable?: boolean;
        primaryKey?: boolean;
        identity?: boolean;
        defaultValue?: string;
      }[];
    }[];
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

  /** Storage operations routed through Core broker */
  storage: {
    /**
     * Writes a file to storage.
     * @param relativePath - Path relative to storage root (e.g., "12/abc123.pd")
     * @param buffer - File content
     */
    write(relativePath: string, buffer: Buffer): Promise<void>;

    /**
     * Reads a file from storage.
     * @param relativePath - Path relative to storage root
     * @returns File content as Buffer
     */
    read(relativePath: string): Promise<Buffer>;

    /**
     * Checks if a file exists in storage.
     * @param relativePath - Path relative to storage root
     * @returns True if file exists
     */
    exists(relativePath: string): Promise<boolean>;

    /**
     * Deletes a file from storage.
     * @param relativePath - Path relative to storage root
     */
    delete(relativePath: string): Promise<void>;

    /**
     * Lists files with a given prefix.
     * @param prefix - Path prefix (e.g., "12/" for shard 12)
     * @returns Array of relative paths
     */
    list(prefix: string): Promise<string[]>;
  };
  /**
   * Variable Resolution API
   * Allows plugins to publish their own variables and read variables from others.
   */
  variables: {
    /**
     * Publishes a variable to the system.
     * The key is automatically prefixed with the plugin ID (e.g. 'myPlugin.myKey').
     */
    publish(key: string, value: any): void;

    /**
     * Gets a variable from the system.
     */
    /**
     * Gets a variable from the system.
     */
    get<T>(key: string): Promise<T>;
  };

  /**
   * Database Access API
   * Routed through the Core DatabaseBroker.
   */
  database: {
    /**
     * Executes a query against the configured database.
     * @param query - SQL query string
     * @param params - Optional parameter object
     */
    query<T>(query: string, params?: Record<string, any>): Promise<T[]>;
  };
}

/**
 * Initializer function signature that every plugin must export.
 * Rule #6: Dependency Injection Only
 */
export type PluginInitializer = (api: PluginAPI) => Promise<void>;
