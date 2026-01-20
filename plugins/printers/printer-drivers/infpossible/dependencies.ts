import { ParsedInf, FileDependency, ValidationResult } from './types';
import { InfParser } from './parser';
import { InfResolver } from './resolver';
import { CompressionMapper } from './compression';

/**
 * File Dependency Tracker
 * 
 * Tracks and validates files referenced in INF files.
 */
export class DependencyTracker {
    /**
     * Builds a complete dependency graph from an INF file.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Array of file dependencies
     */
    static buildDependencyGraph(parsedInf: ParsedInf): FileDependency[] {
        const dependencies = new Map<string, FileDependency>();

        // Parse SourceDisksFiles
        const sourceFiles = this.parseSourceDisksFiles(parsedInf);
        for (const dep of sourceFiles) {
            dependencies.set(dep.fileName.toLowerCase(), dep);
        }

        // Parse CopyFiles directives
        const copyFiles = this.parseCopyFiles(parsedInf);
        for (const dep of copyFiles) {
            const existing = dependencies.get(dep.fileName.toLowerCase());
            if (existing) {
                // Merge information
                existing.destinationDir = existing.destinationDir || dep.destinationDir;
                existing.required = existing.required || dep.required;
            } else {
                dependencies.set(dep.fileName.toLowerCase(), dep);
            }
        }

        return Array.from(dependencies.values());
    }

    /**
     * Parses [SourceDisksFiles] section to get list of source files.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Array of file dependencies
     */
    static parseSourceDisksFiles(parsedInf: ParsedInf): FileDependency[] {
        const dependencies: FileDependency[] = [];

        // Look for SourceDisksFiles sections (may be architecture-specific)
        const sections = InfParser.getSectionsMatching(parsedInf, /^SourceDisksFiles/i);

        for (const section of sections) {
            for (const entry of section.entries) {
                // Format: filename = diskid[,subdir][,size]
                const filename = entry.key;
                if (!filename) continue;

                const dep: FileDependency = {
                    fileName: filename,
                    sourceSection: section.name,
                    required: true
                };

                // Check if this is a compressed file
                if (CompressionMapper.isCompressed(filename)) {
                    dep.compressedName = filename;
                    dep.fileName = CompressionMapper.mapExpandedName(filename);
                }

                dependencies.push(dep);
            }
        }

        return dependencies;
    }

    /**
     * Parses [DestinationDirs] section to map file destinations.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Map of section names to destination directories
     */
    static parseDestinationDirs(parsedInf: ParsedInf): Map<string, string> {
        const destinations = new Map<string, string>();
        const section = InfParser.getSection(parsedInf, 'DestinationDirs');

        if (!section) return destinations;

        for (const entry of section.entries) {
            // Format: SectionName = dirid[,subdir]
            if (entry.key) {
                destinations.set(entry.key.toLowerCase(), entry.value);
            }
        }

        return destinations;
    }

    /**
     * Parses CopyFiles directives from all install sections.
     * 
     * @param parsedInf - Parsed INF file
     * @returns Array of file dependencies
     */
    static parseCopyFiles(parsedInf: ParsedInf): FileDependency[] {
        const dependencies: FileDependency[] = [];
        const destinationDirs = this.parseDestinationDirs(parsedInf);

        // Scan all sections for CopyFiles directives
        for (const section of parsedInf.sections) {
            const copyFilesEntry = InfParser.getEntry(section, 'CopyFiles');
            if (!copyFilesEntry) continue;

            // Expand the CopyFiles directive
            const files = InfResolver.expandCopyFiles(parsedInf, copyFilesEntry.value);
            const destDir = destinationDirs.get(section.name.toLowerCase());

            for (const filename of files) {
                const dep: FileDependency = {
                    fileName: filename,
                    sourceSection: section.name,
                    destinationDir: destDir,
                    required: true
                };

                // Check for compression
                if (CompressionMapper.isCompressed(filename)) {
                    dep.compressedName = filename;
                    dep.fileName = CompressionMapper.mapExpandedName(filename);
                }

                dependencies.push(dep);
            }
        }

        return dependencies;
    }

    /**
     * Validates that all dependencies exist in the source path.
     * Checks for both compressed and expanded variants.
     * 
     * @param dependencies - Dependencies to validate
     * @param sourcePath - Path to driver source files
     * @returns Validation result
     */
    static async validateDependencies(
        dependencies: FileDependency[],
        sourcePath: string
    ): Promise<ValidationResult> {
        const missingFiles: string[] = [];
        const warnings: string[] = [];

        for (const dep of dependencies) {
            // Try to find the file (any variant)
            const found = await CompressionMapper.findFileVariants(dep.fileName, sourcePath);

            if (!found) {
                // Also check compressed name if different
                if (dep.compressedName && dep.compressedName !== dep.fileName) {
                    const foundCompressed = await CompressionMapper.findFileVariants(
                        dep.compressedName,
                        sourcePath
                    );
                    if (!foundCompressed) {
                        missingFiles.push(dep.fileName);
                    }
                } else {
                    missingFiles.push(dep.fileName);
                }
            } else if (CompressionMapper.isCompressed(found)) {
                warnings.push(`File '${dep.fileName}' found as compressed '${found}'`);
            }
        }

        return {
            valid: missingFiles.length === 0,
            missingFiles,
            warnings
        };
    }

    /**
     * Gets unique list of required files (deduplicates).
     * 
     * @param dependencies - Dependencies
     * @returns Array of unique filenames
     */
    static getUniqueFiles(dependencies: FileDependency[]): string[] {
        const files = new Set<string>();

        for (const dep of dependencies) {
            files.add(dep.fileName);
            if (dep.compressedName) {
                files.add(dep.compressedName);
            }
        }

        return Array.from(files);
    }

    /**
     * Filters dependencies to only those required for a specific model.
     * 
     * @param parsedInf - Parsed INF file
     * @param modelName - Model name to filter for
     * @returns Filtered dependencies
     */
    static filterForModel(
        parsedInf: ParsedInf,
        modelName: string
    ): FileDependency[] {
        // This is a simplified version - full implementation would trace
        // through install sections specific to the model
        const allDeps = this.buildDependencyGraph(parsedInf);

        // For now, return all dependencies
        // TODO: Implement model-specific filtering in Phase 4 (Driver Slimming)
        return allDeps;
    }
}
