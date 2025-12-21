
/**
 * Core Logger Service
 * Provides standardized, color-coded logging for the plugin system.
 */

// ANSI Color Codes
const AC = {
    Reset: "\x1b[0m",
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",

    // Foreground
    Red: "\x1b[31m",
    Green: "\x1b[32m",
    Yellow: "\x1b[33m",
    Blue: "\x1b[34m",
    Magenta: "\x1b[35m",
    Cyan: "\x1b[36m",
    White: "\x1b[37m",
    Gray: "\x1b[90m",
};

// Plugin Type -> Color Mapping
export const PluginColors: Record<string, string> = {
    'databaseProvider': AC.Magenta, // Database = Magenta
    'DatabaseBroker': AC.Magenta,   // Broker matches Provider
    'storageProvider': AC.Yellow,   // Storage = Yellow
    'StorageBroker': AC.Yellow,     // Broker matches Provider
    'logonProvider': AC.Red,        // Security = Red
    'feature': AC.Cyan,             // Features = Cyan
    'printers': AC.Green,           // Printers = Green
    'PrinterDrivers': AC.Green,     // Driver Plugin Class
    'system': AC.Blue,              // System = Blue (Standardized)
    'loader': AC.Blue,              // Loader = Blue (Matches System)
    'EventHub': AC.Green,           // EventHub = Green
    'VariableService': AC.Cyan,     // Variables = Cyan
    'loggingProvider': AC.Blue,     // Logging = Blue
};

export class Logger {

    /**
     * Logs an info message with a color-coded prefix.
     * Format: [Type:Name] Message
     */
    static info(type: string, name: string, message: string) {
        const color = PluginColors[type] || AC.Gray;
        // Example: [printers:printer-drivers] Published DriverRepository...
        console.log(`${color}[${type}:${name}]${AC.Reset} ${message}`);
    }

    /**
     * Logs a warning message (Yellow text for message)
     */
    static warn(type: string, name: string, message: string) {
        const color = PluginColors[type] || AC.Gray;
        console.warn(`${color}[${type}:${name}]${AC.Reset} ${AC.Yellow}WARN: ${message}${AC.Reset}`);
    }

    /**
     * Logs an error message (Red text for message)
     */
    static error(type: string, name: string, message: string, error?: any) {
        const color = PluginColors[type] || AC.Gray;
        console.error(`${color}[${type}:${name}]${AC.Reset} ${AC.Red}ERROR: ${message}${AC.Reset}`, error || '');
    }

    /**
     * Logs a system-level message
     */
    static system(message: string) {
        this.info('system', 'core', message);
    }
}
