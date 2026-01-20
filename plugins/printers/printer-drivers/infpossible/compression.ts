/**
 * Windows File Compression Mapping
 * 
 * Handles compressed file naming conventions used in Windows drivers.
 * Maps between expanded (.dll) and compressed (.dl_) filenames.
 */
export class CompressionMapper {
    /**
     * Maps an expanded filename to its compressed equivalent.
     * 
     * @param filename - Expanded filename (e.g., "unidrv.dll")
     * @returns Compressed filename (e.g., "unidrv.dl_")
     */
    static mapCompressedName(filename: string): string {
        const ext = this.getExtension(filename);
        if (!ext) return filename;

        const base = filename.substring(0, filename.length - ext.length);
        const compressedExt = this.compressExtension(ext);

        return base + compressedExt;
    }

    /**
     * Maps a compressed filename to its expanded equivalent.
     * 
     * @param filename - Compressed filename (e.g., "mxdwdrv.dl_")
     * @returns Expanded filename (e.g., "mxdwdrv.dll")
     */
    static mapExpandedName(filename: string): string {
        const ext = this.getExtension(filename);
        if (!ext || !ext.endsWith('_')) return filename;

        const base = filename.substring(0, filename.length - ext.length);
        const expandedExt = this.expandExtension(ext);

        return base + expandedExt;
    }

    /**
     * Searches for a file in both compressed and expanded forms.
     * 
     * @param filename - Filename to search for
     * @param sourcePath - Directory to search in
     * @returns Found filename variant or null
     */
    static async findFileVariants(filename: string, sourcePath: string): Promise<string | null> {
        const fs = await import('fs/promises');
        const path = await import('path');

        // Try exact match first
        const exactPath = path.join(sourcePath, filename);
        if (await this.fileExists(exactPath)) {
            return filename;
        }

        // Try compressed variant
        const compressedName = this.mapCompressedName(filename);
        if (compressedName !== filename) {
            const compressedPath = path.join(sourcePath, compressedName);
            if (await this.fileExists(compressedPath)) {
                return compressedName;
            }
        }

        // Try expanded variant
        const expandedName = this.mapExpandedName(filename);
        if (expandedName !== filename) {
            const expandedPath = path.join(sourcePath, expandedName);
            if (await this.fileExists(expandedPath)) {
                return expandedName;
            }
        }

        return null;
    }

    /**
     * Compresses a file extension (e.g., ".dll" → ".dl_").
     * 
     * @param ext - Extension to compress (with leading dot)
     * @returns Compressed extension
     */
    private static compressExtension(ext: string): string {
        if (ext.length === 0) return ext;

        // Remove leading dot
        const extNoDot = ext.substring(1);

        // Replace last character with underscore
        if (extNoDot.length > 0) {
            return '.' + extNoDot.substring(0, extNoDot.length - 1) + '_';
        }

        return ext;
    }

    /**
     * Expands a compressed extension (e.g., ".dl_" → ".dll").
     * 
     * @param ext - Compressed extension (with leading dot)
     * @returns Expanded extension
     */
    private static expandExtension(ext: string): string {
        if (!ext.endsWith('_')) return ext;

        // Remove leading dot and trailing underscore
        const extNoDot = ext.substring(1, ext.length - 1);

        // Common mappings
        const knownMappings: Record<string, string> = {
            'dl': 'dll',
            'ex': 'exe',
            'sy': 'sys',
            'in': 'inf',
            'ca': 'cat',
            'gp': 'gpd',
            'pp': 'ppd',
            'tx': 'txt',
            'xm': 'xml'
        };

        const expanded = knownMappings[extNoDot];
        if (expanded) {
            return '.' + expanded;
        }

        // Generic: duplicate last character
        if (extNoDot.length > 0) {
            const lastChar = extNoDot.charAt(extNoDot.length - 1);
            return '.' + extNoDot + lastChar;
        }

        return ext;
    }

    /**
     * Gets the file extension (with leading dot).
     * 
     * @param filename - Filename
     * @returns Extension or empty string
     */
    private static getExtension(filename: string): string {
        const lastDot = filename.lastIndexOf('.');
        if (lastDot === -1) return '';
        return filename.substring(lastDot);
    }

    /**
     * Checks if a file exists.
     * 
     * @param filePath - Path to check
     * @returns True if exists
     */
    private static async fileExists(filePath: string): Promise<boolean> {
        const fs = await import('fs/promises');
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Checks if a filename appears to be compressed.
     * 
     * @param filename - Filename to check
     * @returns True if compressed
     */
    static isCompressed(filename: string): boolean {
        return filename.endsWith('_');
    }

    /**
     * Gets all possible variants of a filename (original, compressed, expanded).
     * 
     * @param filename - Base filename
     * @returns Array of filename variants
     */
    static getVariants(filename: string): string[] {
        const variants = new Set<string>();
        variants.add(filename);

        const compressed = this.mapCompressedName(filename);
        if (compressed !== filename) variants.add(compressed);

        const expanded = this.mapExpandedName(filename);
        if (expanded !== filename) variants.add(expanded);

        return Array.from(variants);
    }
}
