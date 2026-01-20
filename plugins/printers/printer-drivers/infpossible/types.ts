/**
 * INFpossible Type Definitions
 * 
 * Core TypeScript interfaces for Windows INF file parsing and analysis.
 */

/**
 * Represents a single entry (key-value pair) within an INF section.
 */
export interface InfEntry {
    key: string;
    value: string;
    rawValue: string; // Before string substitution
    lineNumber: number;
    comment?: string;
}

/**
 * Represents a section in an INF file (e.g., [Version], [Strings]).
 */
export interface InfSection {
    name: string;
    entries: InfEntry[];
    startLine: number;
    endLine: number;
}

/**
 * Represents a fully parsed INF file.
 */
export interface ParsedInf {
    sections: InfSection[];
    rawContent: string;
    fileName?: string;
}

/**
 * Extracted driver metadata from INF analysis.
 */
export interface InfMetadata {
    displayName: string;
    version: string;
    manufacturer: string;
    architecture: string[];
    hardwareIds: string[];
    models: string[];
    driverClass: 'v3' | 'v4' | 'universal';
    driverIsolation: 'High' | 'Medium' | 'None' | 'Unknown';
}

/**
 * Represents a file dependency referenced in the INF.
 */
export interface FileDependency {
    fileName: string;
    compressedName?: string; // e.g., unidrv.dl_ for unidrv.dll
    sourceSection?: string; // Section where it was referenced
    destinationDir?: string; // Where it should be installed
    required: boolean;
}

/**
 * Result of dependency validation.
 */
export interface ValidationResult {
    valid: boolean;
    missingFiles: string[];
    warnings: string[];
}

/**
 * Represents an inbox driver from Windows DriverStore.
 */
export interface InboxDriver {
    oemInf: string; // OEM inf name (e.g., oem42.inf)
    provider: string;
    className: string;
    version: string;
    date: string;
    displayName?: string;  // Friendly driver name (e.g., "Microsoft PCL6 Class Driver")
    signerName?: string;
}

/**
 * Slimming mode options for driver package optimization.
 */
export type SlimmingMode = 'Original' | 'Slim' | 'Skinny';
