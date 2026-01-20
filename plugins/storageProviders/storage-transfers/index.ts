/**
 * Plugin: Storage Transfers
 *
 * Infrastructure plugin providing file transfer capabilities (upload/download)
 * for all PrintCon plugins.
 *
 * Rule #6: Dependency Injection Only.
 * This plugin receives the PluginAPI from the Core during initialization.
 */

import type { PluginInitializer } from '../../../src/core/types/plugin';
import { UploadSessionManager } from './upload-session-manager';
import { Logger } from '../../../src/core/logger';
import path from 'path';

export const initialize: PluginInitializer = async (api) => {
  console.log('[StorageTransfers] Initializing plugin');

  // Initialize session manager
  const sessionManager = UploadSessionManager.getInstance();

  // ========================================
  // Upload Event Handlers
  // ========================================

  // REQUEST_INIT_UPLOAD - Start new upload session
  api.events.on('REQUEST_INIT_UPLOAD', async (payload: any) => {
    try {
      console.log('[StorageTransfers] Initializing upload session');

      // Load config to get custom temp directory
      const path = await import('path');
      const fs = await import('fs/promises');

      let tempDirectory = '';
      try {
        const configPath = path.join(process.cwd(), 'plugins/storageProviders/storage-transfers/config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);
        tempDirectory = config.tempDirectory || '';
        console.log('[StorageTransfers] Using temp directory:', tempDirectory || 'system default');
      } catch (e) {
        console.log('[StorageTransfers] Config not found, using system default temp directory');
      }

      // Create session with custom temp directory if configured
      const session = await sessionManager.createSession(tempDirectory || undefined);

      api.events.emit('RESPONSE_INIT_UPLOAD', {
        success: true,
        sessionId: session.sessionId
      });
    } catch (e: any) {
      console.error('[StorageTransfers] Failed to initialize upload session:', e);
      api.events.emit('RESPONSE_INIT_UPLOAD', {
        success: false,
        error: e.message
      });
    }
  });

  // REQUEST_UPLOAD_CHUNK - Upload individual chunk (idempotent)
  api.events.on('REQUEST_UPLOAD_CHUNK', async (payload: any) => {
    try {
      const { sessionId, fileName, chunkIndex, chunkData, totalChunks } = payload;

      console.log(`[StorageTransfers] Uploading chunk ${chunkIndex} for ${fileName}`);

      // Decode base64 chunk data
      const buffer = Buffer.from(chunkData, 'base64');

      // Save chunk (idempotent - returns false if already exists)
      const isNew = await sessionManager.saveChunk(
        sessionId,
        fileName,
        chunkIndex,
        buffer,
        totalChunks
      );

      api.events.emit('RESPONSE_UPLOAD_CHUNK', {
        success: true,
        isNew: isNew, // false if duplicate (idempotent)
        chunkIndex: chunkIndex
      });
    } catch (e: any) {
      console.error('[StorageTransfers] Failed to upload chunk:', e);
      api.events.emit('RESPONSE_UPLOAD_CHUNK', {
        success: false,
        error: e.message
      });
    }
  });

  // REQUEST_FINALIZE_UPLOAD - Complete upload and assemble files
  // REQUEST_FINALIZE_UPLOAD - Complete upload and assemble files
  api.events.on('REQUEST_FINALIZE_UPLOAD', async (payload: any) => {
    try {
      const { sessionId } = payload;

      console.log('[StorageTransfers] Finalizing upload session:', sessionId);

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const totalFiles = session.files.size;
      let currentFile = 0;

      // Assemble each file with progress updates
      for (const [fileName, metadata] of session.files) {
        currentFile++;

        // Emit progress event
        api.events.emit('UPLOAD_PROGRESS', {
          stage: 'assembling',
          message: `Assembling ${fileName}`,
          current: currentFile,
          total: totalFiles,
          fileName: fileName
        });

        await sessionManager.assembleFile(sessionId, fileName);
      }

      // Get the assembled directory path
      const tempPath = path.join(session.tempDir, '_assembled');

      console.log('[StorageTransfers] ✅ Upload finalized. Temp path:', tempPath);

      // Emit completion event for downstream plugins (e.g., printer-drivers)
      api.events.emit('UPLOAD_COMPLETED', {
        success: true,
        tempPath: tempPath,
        sessionId: sessionId
      });

      api.events.emit('RESPONSE_FINALIZE_UPLOAD', {
        success: true,
        tempPath: tempPath,
        sessionId: sessionId
      });
    } catch (e: any) {
      console.error('[StorageTransfers] Failed to finalize upload:', e);
      api.events.emit('RESPONSE_FINALIZE_UPLOAD', {
        success: false,
        error: e.message
      });
    }
  });

  // REQUEST_CLEANUP_SESSION - Clean up session (called by consumer after processing)
  api.events.on('REQUEST_CLEANUP_SESSION', async (payload: any) => {
    try {
      const { sessionId } = payload;

      console.log('[StorageTransfers] Cleaning up session:', sessionId);
      await sessionManager.cleanupSession(sessionId);

      api.events.emit('RESPONSE_CLEANUP_SESSION', {
        success: true
      });
    } catch (e: any) {
      console.error('[StorageTransfers] Failed to cleanup session:', e);
      api.events.emit('RESPONSE_CLEANUP_SESSION', {
        success: false,
        error: e.message
      });
    }
  });

  // ========================================
  // Configuration Management
  // ========================================

  // REQUEST_GET_CONFIG - Load configuration
  api.events.on('REQUEST_GET_CONFIG', async () => {
    try {
      const path = await import('path');
      const fs = await import('fs/promises');

      const configPath = path.join(process.cwd(), 'plugins/storageProviders/storage-transfers/config.json');

      let config = { tempDirectory: '' };

      try {
        const configData = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(configData);
      } catch (e) {
        console.log('[StorageTransfers] Using default config');
      }

      api.events.emit('RESPONSE_GET_CONFIG', {
        success: true,
        config
      });
    } catch (e: any) {
      console.error('[StorageTransfers] Failed to load config:', e);
      api.events.emit('RESPONSE_GET_CONFIG', {
        success: false,
        error: e.message
      });
    }
  });

  // REQUEST_SAVE_CONFIG - Save configuration
  api.events.on('REQUEST_SAVE_CONFIG', async (payload: any) => {
    try {
      const path = await import('path');
      const fs = await import('fs/promises');

      const configPath = path.join(process.cwd(), 'plugins/storageProviders/storage-transfers/config.json');
      const config = {
        tempDirectory: payload.tempDirectory || ''
      };

      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

      console.log('[StorageTransfers] Configuration saved:', config);

      api.events.emit('RESPONSE_SAVE_CONFIG', {
        success: true
      });
    } catch (e: any) {
      console.error('[StorageTransfers] Failed to save config:', e);
      api.events.emit('RESPONSE_SAVE_CONFIG', {
        success: false,
        error: e.message
      });
    }
  });

  console.log('[StorageTransfers] Plugin initialized successfully');
};
