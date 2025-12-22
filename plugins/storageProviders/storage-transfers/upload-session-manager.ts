import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Upload Session Interface
 */
export interface UploadSession {
    sessionId: string;
    tempDir: string;
    createdAt: number;
    expiresAt: number;
    receivedChunks: Set<number>;
    files: Map<string, FileMetadata>;
}

interface FileMetadata {
    fileName: string;
    totalChunks: number;
    receivedChunks: Set<number>;
}

/**
 * Upload Session Manager
 * Manages chunked file upload sessions with automatic cleanup
 */
export class UploadSessionManager {
    private static instance: UploadSessionManager;
    private sessions: Map<string, UploadSession> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.startCleanupTimer();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): UploadSessionManager {
        if (!UploadSessionManager.instance) {
            UploadSessionManager.instance = new UploadSessionManager();
        }
        return UploadSessionManager.instance;
    }

    /**
     * Create a new upload session
     * @param tempBaseDir Optional custom temp directory (defaults to system temp)
     */
    public async createSession(tempBaseDir?: string): Promise<UploadSession> {
        const sessionId = crypto.randomBytes(16).toString('hex');
        const baseDir = tempBaseDir || os.tmpdir();
        const tempDir = path.join(baseDir, 'printcon-uploads', sessionId);

        // Create temp directory
        await fs.mkdir(tempDir, { recursive: true });

        const session: UploadSession = {
            sessionId,
            tempDir,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.SESSION_TIMEOUT,
            receivedChunks: new Set(),
            files: new Map()
        };

        this.sessions.set(sessionId, session);
        console.log(`[StorageTransfers] Created session: ${sessionId} in ${tempDir}`);

        return session;
    }

    /**
     * Get an existing session
     */
    public getSession(sessionId: string): UploadSession | null {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return null;
        }

        // Check expiration
        if (Date.now() > session.expiresAt) {
            this.cleanupSession(sessionId);
            return null;
        }

        return session;
    }

    /**
     * Save a chunk to the session
     * @returns true if chunk was new, false if it already existed (idempotency)
     */
    public async saveChunk(
        sessionId: string,
        fileName: string,
        chunkIndex: number,
        chunkData: Buffer,
        totalChunks?: number
    ): Promise<boolean> {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Ensure file metadata exists
        if (!session.files.has(fileName)) {
            session.files.set(fileName, {
                fileName,
                totalChunks: totalChunks || 0,
                receivedChunks: new Set()
            });
        }

        const fileMetadata = session.files.get(fileName)!;

        // Check if chunk already exists (idempotency)
        if (fileMetadata.receivedChunks.has(chunkIndex)) {
            console.log(`[StorageTransfers] Chunk ${chunkIndex} for ${fileName} already exists (idempotent)`);
            return false;
        }

        // Create file directory
        const fileDir = path.join(session.tempDir, fileName);
        await fs.mkdir(fileDir, { recursive: true });

        // Save chunk
        const chunkPath = path.join(fileDir, `chunk-${chunkIndex}`);
        await fs.writeFile(chunkPath, chunkData);

        // Update metadata
        fileMetadata.receivedChunks.add(chunkIndex);
        session.receivedChunks.add(chunkIndex);

        console.log(`[StorageTransfers] Saved chunk ${chunkIndex} for ${fileName} (${fileMetadata.receivedChunks.size}/${fileMetadata.totalChunks})`);

        return true;
    }

    /**
     * Assemble all chunks for a file into the final file
     */
    public async assembleFile(sessionId: string, fileName: string): Promise<string> {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const fileMetadata = session.files.get(fileName);
        if (!fileMetadata) {
            throw new Error(`File not found in session: ${fileName}`);
        }

        // Chunks are in: {tempDir}/{fileName}/chunk-*
        // Output goes to: {tempDir}/_assembled/{fileName}
        const fileDir = path.join(session.tempDir, fileName);
        const outputPath = path.join(session.tempDir, '_assembled', fileName);

        //  Ensure parent directory exists for nested paths (e.g., amd64/file.inf)
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Assemble chunks in order
        const writeStream = await fs.open(outputPath, 'w');

        try {
            for (let i = 0; i < fileMetadata.totalChunks; i++) {
                const chunkPath = path.join(fileDir, `chunk-${i}`);

                // Verify chunk exists
                try {
                    await fs.access(chunkPath);
                } catch {
                    throw new Error(`Missing chunk ${i} for ${fileName}`);
                }

                const chunkData = await fs.readFile(chunkPath);
                await writeStream.write(chunkData);
            }
        } finally {
            await writeStream.close();
        }

        // Clean up chunk directory
        await fs.rm(fileDir, { recursive: true, force: true });

        console.log(`[StorageTransfers] Assembled ${fileName} from ${fileMetadata.totalChunks} chunks`);

        return outputPath;
    }

    /**
     * Finalize session and return the temp directory path
     */
    public async finalizeSession(sessionId: string): Promise<string> {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        // Assemble all files
        for (const [fileName, metadata] of session.files) {
            await this.assembleFile(sessionId, fileName);
        }

        console.log(`[StorageTransfers] Finalized session: ${sessionId}`);

        // Return the _assembled directory where files are located
        return path.join(session.tempDir, '_assembled');
    }

    /**
     * Clean up a session (remove from memory and delete temp files)
     */
    public async cleanupSession(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);

        if (session) {
            // Delete temp directory
            try {
                await fs.rm(session.tempDir, { recursive: true, force: true });
                console.log(`[StorageTransfers] Cleaned up temp directory: ${session.tempDir}`);
            } catch (error: any) {
                console.error(`[StorageTransfers] Failed to delete temp directory: ${error.message}`);
            }

            // Remove from sessions map
            this.sessions.delete(sessionId);
            console.log(`[StorageTransfers] Removed session: ${sessionId}`);
        }
    }

    /**
     * Start automatic cleanup timer for expired sessions
     */
    private startCleanupTimer(): void {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            const expiredSessions: string[] = [];

            // Find expired sessions
            for (const [sessionId, session] of this.sessions) {
                if (now > session.expiresAt) {
                    expiredSessions.push(sessionId);
                }
            }

            // Clean up expired sessions
            for (const sessionId of expiredSessions) {
                console.log(`[StorageTransfers] Auto-cleaning expired session: ${sessionId}`);
                this.cleanupSession(sessionId);
            }

            if (expiredSessions.length > 0) {
                console.log(`[StorageTransfers] Cleaned up ${expiredSessions.length} expired session(s)`);
            }
        }, this.CLEANUP_INTERVAL);
    }

    /**
     * Shutdown manager and clean up all sessions
     */
    public async shutdown(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Clean up all sessions
        const sessionIds = Array.from(this.sessions.keys());
        for (const sessionId of sessionIds) {
            await this.cleanupSession(sessionId);
        }

        console.log('[StorageTransfers] Manager shutdown complete');
    }
}
