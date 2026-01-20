import { ParsedInf, InfSection, InfEntry } from './types';

/**
 * INF File Parser
 * 
 * Parses Windows INF files into structured data.
 * Uses line-by-line processing to handle large files efficiently.
 */
export class InfParser {
    /**
     * Parses an INF file from string content.
     * 
     * @param content - Raw INF file content
     * @param fileName - Optional filename for debugging
     * @returns Parsed INF structure
     */
    static parseInfFile(content: string, fileName?: string): ParsedInf {
        const lines = content.split('\n');
        const sections: InfSection[] = [];

        let currentSection: InfSection | null = null;
        let lineNumber = 0;

        for (const rawLine of lines) {
            lineNumber++;
            const line = rawLine.trim();

            // Skip empty lines
            if (!line) continue;

            // Skip comment-only lines
            if (line.startsWith(';')) continue;

            // Check for section header [SectionName]
            const sectionMatch = line.match(/^\[([^\]]+)\]$/);
            if (sectionMatch) {
                // Save previous section
                if (currentSection) {
                    currentSection.endLine = lineNumber - 1;
                    sections.push(currentSection);
                }

                // Start new section
                currentSection = {
                    name: sectionMatch[1].trim(),
                    entries: [],
                    startLine: lineNumber,
                    endLine: lineNumber
                };
                continue;
            }

            // Parse key-value entry
            if (currentSection) {
                const entry = this.parseEntry(line, lineNumber);
                if (entry) {
                    currentSection.entries.push(entry);
                }
            }
        }

        // Save last section
        if (currentSection) {
            currentSection.endLine = lineNumber;
            sections.push(currentSection);
        }

        return {
            sections,
            rawContent: content,
            fileName
        };
    }

    /**
     * Parses a single INF entry line.
     * 
     * @param line - Line to parse
     * @param lineNumber - Line number in file
     * @returns Parsed entry or null if invalid
     */
    private static parseEntry(line: string, lineNumber: number): InfEntry | null {
        // Remove inline comments
        const commentIndex = line.indexOf(';');
        let cleanLine = line;
        let comment: string | undefined;

        if (commentIndex !== -1) {
            cleanLine = line.substring(0, commentIndex).trim();
            comment = line.substring(commentIndex + 1).trim();
        }

        if (!cleanLine) return null;

        // Parse key = value
        const equalsIndex = cleanLine.indexOf('=');
        if (equalsIndex === -1) {
            // Some INF entries are just values (e.g., in CopyFiles sections)
            return {
                key: '',
                value: cleanLine,
                rawValue: cleanLine,
                lineNumber,
                comment
            };
        }

        let key = cleanLine.substring(0, equalsIndex).trim();
        const rawValue = cleanLine.substring(equalsIndex + 1).trim();

        // Remove quotes from key if present
        if (key.startsWith('"') && key.endsWith('"')) {
            key = key.slice(1, -1);
        }

        // Remove quotes from value if present
        let value = rawValue;
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
        }

        return {
            key,
            value,
            rawValue,
            lineNumber,
            comment
        };
    }

    /**
     * Gets all sections from parsed INF.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Array of all sections
     */
    static getSections(parsedInf: ParsedInf): InfSection[] {
        return parsedInf.sections;
    }

    /**
     * Gets a specific section by name (case-insensitive).
     * 
     * @param parsedInf - Parsed INF file
     * @param name - Section name to find
     * @returns Section if found, null otherwise
     */
    static getSection(parsedInf: ParsedInf, name: string): InfSection | null {
        const lowerName = name.toLowerCase();
        return parsedInf.sections.find(s => s.name.toLowerCase() === lowerName) || null;
    }

    /**
     * Gets all sections matching a pattern (e.g., "Manufacturer.*").
     * 
     * @param parsedInf - Parsed INF file
     * @param pattern - Regex pattern to match section names
     * @returns Array of matching sections
     */
    static getSectionsMatching(parsedInf: ParsedInf, pattern: RegExp): InfSection[] {
        return parsedInf.sections.filter(s => pattern.test(s.name));
    }

    /**
     * Gets a specific entry from a section.
     * 
     * @param section - Section to search
     * @param key - Entry key to find
     * @returns Entry if found, null otherwise
     */
    static getEntry(section: InfSection, key: string): InfEntry | null {
        const lowerKey = key.toLowerCase();
        return section.entries.find(e => e.key.toLowerCase() === lowerKey) || null;
    }
}
