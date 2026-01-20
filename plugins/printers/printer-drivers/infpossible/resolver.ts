import { ParsedInf, InfSection } from './types';
import { InfParser } from './parser';

/**
 * String Substitution and Reference Resolver
 * 
 * Handles %StringID% substitution from [Strings] section
 * and resolves cross-references to other INF sections.
 */
export class InfResolver {
    /**
     * Resolves all %StringID% references in the parsed INF.
     * Modifies the ParsedInf in-place.
     * 
     * @param parsedInf - Parsed INF file
     */
    static resolveStrings(parsedInf: ParsedInf): void {
        // Build string substitution map from [Strings] section
        const stringsMap = this.buildStringsMap(parsedInf);

        // Apply substitution to all sections
        for (const section of parsedInf.sections) {
            for (const entry of section.entries) {
                entry.value = this.substituteString(entry.value, stringsMap);
            }
        }
    }

    /**
     * Builds a map of string substitutions from [Strings] section.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Map of string IDs to values (case-insensitive keys)
     */
    private static buildStringsMap(parsedInf: ParsedInf): Map<string, string> {
        const stringsMap = new Map<string, string>();
        const stringsSection = InfParser.getSection(parsedInf, 'Strings');

        if (!stringsSection) return stringsMap;

        for (const entry of stringsSection.entries) {
            if (entry.key) {
                // Store with lowercase key for case-insensitive lookup
                stringsMap.set(entry.key.toLowerCase(), entry.value);
            }
        }

        return stringsMap;
    }

    /**
     * Substitutes %StringID% references in a value.
     * 
     * @param value - Value to process
     * @param stringsMap - String substitution map
     * @returns Value with substitutions applied
     */
    private static substituteString(value: string, stringsMap: Map<string, string>): string {
        // Pattern: %StringID%
        return value.replace(/%([^%]+)%/g, (match, stringId) => {
            const replacement = stringsMap.get(stringId.toLowerCase());
            return replacement !== undefined ? replacement : match;
        });
    }

    /**
     * Resolves references to other sections (e.g., Include=other.inf).
     * 
     * @param parsedInf - Parsed INF file
     * @param sectionName - Section name to resolve
     * @returns Array of referenced section names
     */
    static resolveReferences(parsedInf: ParsedInf, sectionName: string): string[] {
        const section = InfParser.getSection(parsedInf, sectionName);
        if (!section) return [];

        const references: string[] = [];

        for (const entry of section.entries) {
            // Check for Include= directive
            if (entry.key.toLowerCase() === 'include') {
                references.push(entry.value);
            }

            // Check for Needs= directive (references install sections)
            if (entry.key.toLowerCase() === 'needs') {
                references.push(entry.value);
            }
        }

        return references;
    }

    /**
     * Expands a CopyFiles directive to get the list of files.
     * 
     * @param parsedInf - Parsed INF file
     * @param copyFilesValue - Value from CopyFiles= directive
     * @returns Array of filenames
     */
    static expandCopyFiles(parsedInf: ParsedInf, copyFilesValue: string): string[] {
        const files: string[] = [];

        // Parse comma-separated values
        const parts = copyFilesValue.split(',').map(p => p.trim());

        for (const part of parts) {
            // Check if it's a direct file reference (@filename)
            if (part.startsWith('@')) {
                files.push(part.substring(1));
                continue;
            }

            // Otherwise, it's a section name - look up that section
            const section = InfParser.getSection(parsedInf, part);
            if (section) {
                for (const entry of section.entries) {
                    // In file list sections, the key is often empty and value is the filename
                    const filename = entry.key || entry.value;
                    if (filename) files.push(filename);
                }
            }
        }

        return files;
    }
}
