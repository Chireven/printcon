import { ParsedInf, InfMetadata, InfSection } from './types';
import { InfParser } from './parser';
import { InfResolver } from './resolver';

/**
 * INF Metadata Analyzer
 * 
 * Extracts meaningful driver metadata from parsed INF files.
 */
export class InfAnalyzer {
    /**
     * Extracts complete driver metadata from a parsed INF.
     * 
     * @param parsedInf - Parsed INF file (should have strings resolved)
     * @returns Extracted metadata
     */
    static extractDriverMetadata(parsedInf: ParsedInf): InfMetadata {
        return {
            displayName: this.extractDisplayName(parsedInf),
            version: this.extractVersion(parsedInf),
            manufacturer: this.extractManufacturer(parsedInf),
            architecture: this.extractArchitecture(parsedInf),
            hardwareIds: this.extractHardwareIds(parsedInf),
            models: this.extractSupportedModels(parsedInf),
            driverClass: this.detectDriverClass(parsedInf),
            driverIsolation: this.extractDriverIsolation(parsedInf)
        };
    }

    /**
     * Extracts the driver version from [Version] section.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Driver version string
     */
    static extractVersion(parsedInf: ParsedInf): string {
        const versionSection = InfParser.getSection(parsedInf, 'Version');
        if (!versionSection) return '1.0.0';

        // Look for DriverVer line
        const driverVerEntry = InfParser.getEntry(versionSection, 'DriverVer');
        if (driverVerEntry) {
            // Format: DriverVer=MM/DD/YYYY,1.0.0.0
            const match = driverVerEntry.value.match(/,\s*([0-9.]+)/);
            if (match) return match[1];
        }

        return '1.0.0';
    }

    /**
     * Extracts the manufacturer name.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Manufacturer name
     */
    static extractManufacturer(parsedInf: ParsedInf): string {
        const versionSection = InfParser.getSection(parsedInf, 'Version');

        // Try Provider field first
        if (versionSection) {
            const providerEntry = InfParser.getEntry(versionSection, 'Provider');
            if (providerEntry) {
                return providerEntry.value.replace(/"/g, '');
            }
        }

        // Try [Manufacturer] section
        const mfgSection = InfParser.getSection(parsedInf, 'Manufacturer');
        if (mfgSection && mfgSection.entries.length > 0) {
            // First entry is usually the manufacturer name
            const firstEntry = mfgSection.entries[0];
            return firstEntry.key || firstEntry.value;
        }

        return 'Unknown';
    }

    /**
     * Extracts supported architectures from section names.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Array of architecture strings
     */
    static extractArchitecture(parsedInf: ParsedInf): string[] {
        const architectures = new Set<string>();

        // Scan all section names for architecture markers
        for (const section of parsedInf.sections) {
            const name = section.name.toLowerCase();

            if (name.includes('ntamd64') || name.includes('amd64')) {
                architectures.add('amd64');
            }
            if (name.includes('ntx86') || name.includes('x86')) {
                architectures.add('x86');
            }
            if (name.includes('ntarm64') || name.includes('arm64')) {
                architectures.add('arm64');
            }
            if (name.includes('.nt') && !name.includes('ntamd64') && !name.includes('ntx86') && !name.includes('ntarm64')) {
                architectures.add('x64'); // Generic NT usually means x64
            }
        }

        // If no architecture found, default to x64
        return architectures.size > 0 ? Array.from(architectures) : ['x64'];
    }

    /**
     * Extracts hardware IDs (PnP IDs) from manufacturer sections.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Array of hardware IDs
     */
    static extractHardwareIds(parsedInf: ParsedInf): string[] {
        const hardwareIds = new Set<string>();

        // Find manufacturer model sections
        const modelSections = this.findManufacturerModelSections(parsedInf);

        for (const section of modelSections) {
            for (const entry of section.entries) {
                // Format: "Model Name" = InstallSection, HWID
                // or: Model Name = InstallSection, HWID
                const parts = entry.value.split(',');
                if (parts.length >= 2) {
                    const hwid = parts[1].trim();
                    if (hwid) hardwareIds.add(hwid);
                }
            }
        }

        return hardwareIds.size > 0 ? Array.from(hardwareIds) : ['UNKNOWN'];
    }

    /**
     * Extracts supported model names from manufacturer sections.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Array of model names
     */
    static extractSupportedModels(parsedInf: ParsedInf): string[] {
        const models = new Set<string>();

        // Find manufacturer model sections
        const modelSections = this.findManufacturerModelSections(parsedInf);

        for (const section of modelSections) {
            for (const entry of section.entries) {
                // The key is usually the model name, or it's in quotes as part of the value
                let modelName = entry.key;

                if (!modelName && entry.value) {
                    // Try to extract from value
                    const match = entry.value.match(/^"([^"]+)"/);
                    if (match) {
                        modelName = match[1];
                    }
                }

                if (modelName && !modelName.startsWith('[')) {
                    // Strip quotes if present
                    modelName = modelName.replace(/^["']|["']$/g, '');
                    models.add(modelName);
                }
            }
        }

        return models.size > 0 ? Array.from(models) : ['Unknown Model'];
    }

    /**
     * Extracts a display name for the driver.
     * Uses the first model name or filename as fallback.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Display name
     */
    static extractDisplayName(parsedInf: ParsedInf): string {
        const models = this.extractSupportedModels(parsedInf);
        if (models.length > 0 && models[0] !== 'Unknown Model') {
            return models[0];
        }

        // Fallback to filename
        if (parsedInf.fileName) {
            return parsedInf.fileName.replace(/\.inf$/i, '');
        }

        return 'Unknown Driver';
    }

    /**
     * Detects the driver class (v3, v4, or universal).
     * 
     * @param parsedInf - Parsed INF file
     * @returns Driver class
     */
    static detectDriverClass(parsedInf: ParsedInf): 'v3' | 'v4' | 'universal' {
        const versionSection = InfParser.getSection(parsedInf, 'Version');
        if (!versionSection) return 'v3';

        // Check for Class = Printer
        const classEntry = InfParser.getEntry(versionSection, 'Class');
        const isPrinter = classEntry?.value.toLowerCase() === 'printer';

        if (!isPrinter) return 'v3'; // Not a printer driver

        // Check for DriverPackageType (indicates v4/universal)
        const driverTypeEntry = InfParser.getEntry(versionSection, 'DriverPackageType');
        if (driverTypeEntry) {
            const value = driverTypeEntry.value.toLowerCase();
            if (value.includes('plugandplay')) return 'v4';
            if (value.includes('universal')) return 'universal';
        }

        // Check for PrinterDriverAttributes (v4 specific)
        const sections = InfParser.getSectionsMatching(parsedInf, /DriverAttributes/i);
        if (sections.length > 0) return 'v4';

        // Default to v3 (legacy)
        return 'v3';
    }

    /**
     * Extracts driver isolation compatibility (for Type 3 drivers).
     * 
     * @param parsedInf - Parsed INF file
     * @returns Driver isolation level
     */
    static extractDriverIsolation(parsedInf: ParsedInf): 'High' | 'Medium' | 'None' | 'Unknown' {
        // Only relevant for v3 drivers
        const driverClass = this.detectDriverClass(parsedInf);
        if (driverClass === 'v4' || driverClass === 'universal') {
            return 'High'; // v4 and universal drivers are always isolated
        }

        // Look for DriverIsolation directive in any section
        for (const section of parsedInf.sections) {
            const isolationEntry = InfParser.getEntry(section, 'DriverIsolation');
            if (isolationEntry) {
                const value = isolationEntry.value.toLowerCase();
                if (value === '2') return 'High';
                if (value === '1') return 'Medium';
                if (value === '0') return 'None';
            }
        }

        // Check for known isolation-aware DLLs
        const content = parsedInf.rawContent.toLowerCase();
        const isolationAwareDLLs = [
            'unidrvui.dll',
            'pscript5ui.dll',
            'prntvpt.dll'
        ];

        for (const dll of isolationAwareDLLs) {
            if (content.includes(dll)) {
                return 'Medium'; // Likely isolation-aware
            }
        }

        return 'Unknown';
    }

    /**
     * Finds manufacturer model sections (e.g., [HP.NTamd64.6.1]).
     * 
     * @param parsedInf - Parsed INF file
     * @returns Array of model sections
     */
    private static findManufacturerModelSections(parsedInf: ParsedInf): InfSection[] {
        const sections: InfSection[] = [];
        const manufacturer = this.extractManufacturer(parsedInf);
        const mfgPrefix = manufacturer.substring(0, 5).toLowerCase();

        for (const section of parsedInf.sections) {
            const name = section.name.toLowerCase();

            // Match sections like [HP], [HP.NTamd64], [HP.NTx86.10.0]
            if (name.includes(mfgPrefix) ||
                name.includes('models') ||
                name.match(/\.(nt|ntamd64|ntx86|ntarm)/)) {
                sections.push(section);
            }
        }

        return sections;
    }
}
