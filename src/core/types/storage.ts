/**
 * Storage Provider Interface
 * 
 * Core interface that all storage provider plugins must implement.
 * This allows swappable storage backends (local disk, S3, Azure, etc.)
 */
export interface IStorageProvider {
    /**
     * Writes a file to storage at the specified path.
     * 
     * @param relativePath - Relative path within the storage (e.g., "12/123456....pd")
     * @param buffer - File content as Buffer
     * @returns Promise that resolves when write is complete
     */
    write(relativePath: string, buffer: Buffer): Promise<void>;

    /**
     * Reads a file from storage.
     * 
     * @param relativePath - Relative path within the storage
     * @returns Promise that resolves with file content as Buffer
     * @throws Error if file not found
     */
    read(relativePath: string): Promise<Buffer>;

    /**
     * Checks if a file exists at the specified path.
     * 
     * @param relativePath - Relative path within the storage
     * @returns Promise that resolves to true if file exists, false otherwise
     */
    exists(relativePath: string): Promise<boolean>;

    /**
     * Deletes a file from storage.
     * 
     * @param relativePath - Relative path within the storage
     * @returns Promise that resolves when deletion is complete
     */
    delete(relativePath: string): Promise<void>;

    /**
     * Lists all files with a given prefix.
     * 
     * @param prefix - Path prefix to filter by (e.g., "12/" for all files in shard 12)
     * @returns Promise that resolves with array of relative paths
     */
    list(prefix: string): Promise<string[]>;

    /**
     * Gets the total number of files in storage.
     * Used for capacity monitoring.
     * 
     * @returns Promise that resolves with file count
     */
    getFileCount(): Promise<number>;
}
