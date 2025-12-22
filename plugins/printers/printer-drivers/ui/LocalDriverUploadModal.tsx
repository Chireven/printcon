import React, { useState, useEffect } from 'react';
import { X, FolderOpen, Upload, CheckCircle2, AlertCircle, Loader2, WifiOff, Wifi } from 'lucide-react';
import { toast } from 'sonner';

interface LocalDriverUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface FileEntry {
    file: File;
    relativePath: string;
}

interface UploadProgress {
    sessionId: string;
    folderName: string;
    totalFiles: number;
    totalSize: number;
    uploadedSize: number;
    currentFile: string;
    currentChunk: number;
    totalChunks: number;
    retryAttempt: number;
}

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const MAX_RETRIES = 3;

export default function LocalDriverUploadModal({ isOpen, onClose, onSuccess }: LocalDriverUploadModalProps) {
    const [selectedFolder, setSelectedFolder] = useState<FileSystemDirectoryHandle | null>(null);
    const [folderName, setFolderName] = useState<string>('');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [hasInfFile, setHasInfFile] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
    const [isPaused, setIsPaused] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [abortController, setAbortController] = useState<AbortController | null>(null);

    // Server-side processing states
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStage, setProcessingStage] = useState<string>('');
    const [processingMessage, setProcessingMessage] = useState<string>('');

    // Monitor network status
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            if (isPaused && uploadProgress) {
                toast.info('Connection restored, resuming upload...');
                setIsPaused(false);
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            if (isUploading) {
                toast.warning('Connection lost. Upload will resume when reconnected.');
                setIsPaused(true);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isPaused, uploadProgress, isUploading]);

    // Establish EventSource connection when modal opens (not when processing starts)
    // This ensures we're listening BEFORE server emits upload events
    useEffect(() => {
        if (!isOpen) return;

        console.log('[Upload] 🔌 Establishing EventSource (isOpen:', isOpen, ')');
        const eventSource = new EventSource('/api/system/events');

        eventSource.onopen = () => {
            console.log('[Upload] ✅ EventSource connected and ready');
        };

        eventSource.onerror = (err) => {
            console.error('[Upload] ❌ EventSource error:', err);
        };

        // Listen for all SSE messages and filter by event type
        eventSource.onmessage = (e) => {
            console.log('[Upload] 📨 Received:', e.data.substring(0, 100));
            try {
                const payload = JSON.parse(e.data);
                console.log('[Upload] 📦 Event:', payload.event);

                if (payload.event === 'UPLOAD_PROGRESS') {
                    setProcessingStage(payload.data?.stage || '');
                    setProcessingMessage(payload.data?.message || '');
                } else if (payload.event === 'UPLOAD_COMPLETE') {
                    if (payload.data?.success) {
                        toast.success('Driver package created!', {
                            description: payload.data.displayName
                        });

                        // Auto-close after 2 seconds
                        setTimeout(() => {
                            setIsProcessing(false);
                            onSuccess();
                            onClose();
                        }, 2000);
                    }
                } else if (payload.event === 'PACKAGE_BUILD_FAILED') {
                    setIsProcessing(false);
                    toast.error('Package build failed', {
                        description: payload.data?.error || 'Unknown error'
                    });
                }
            } catch (err) {
                // Ignore parse errors (heartbeats, etc)
            }
        };

        return () => {
            console.log('[Upload] 🔌 Closing EventSource');
            eventSource.close();
        };
    }, [isOpen]); // Only reconnect when modal opens/closes

    /**
     * Recursively read all files from a directory
     */
    async function readAllFiles(dirHandle: FileSystemDirectoryHandle, basePath: string = ''): Promise<FileEntry[]> {
        const fileEntries: FileEntry[] = [];

        for await (const entry of dirHandle.values()) {
            const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

            if (entry.kind === 'file') {
                const file = await (entry as FileSystemFileHandle).getFile();
                fileEntries.push({ file, relativePath });
            } else if (entry.kind === 'directory') {
                const subFiles = await readAllFiles(entry as FileSystemDirectoryHandle, relativePath);
                fileEntries.push(...subFiles);
            }
        }

        return fileEntries;
    }

    /**
     * Handle folder selection
     */
    const handleSelectFolder = async () => {
        try {
            // Check browser support
            if (!('showDirectoryPicker' in window)) {
                toast.error('Browser not supported', {
                    description: 'Please use Chrome or Edge to upload from your computer.'
                });
                return;
            }

            const dirHandle = await (window as any).showDirectoryPicker();
            setSelectedFolder(dirHandle);
            setFolderName(dirHandle.name);
            setIsScanning(true);

            // Read all files
            const fileEntries = await readAllFiles(dirHandle);
            setFiles(fileEntries);

            // Check for INF file
            const hasInf = fileEntries.some(f => f.file.name.toLowerCase().endsWith('.inf'));
            setHasInfFile(hasInf);

            setIsScanning(false);

            if (!hasInf) {
                toast.warning('No .inf file found', {
                    description: 'This folder may not be a valid printer driver.'
                });
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Failed to select folder:', error);
                toast.error('Failed to select folder', { description: error.message });
            }
            setIsScanning(false);
        }
    };

    /**
     * Upload a single chunk with retry logic
     */
    async function uploadChunkWithRetry(
        sessionId: string,
        fileName: string,
        chunkIndex: number,
        chunkData: ArrayBuffer,
        totalChunks: number,
        attempt: number = 0
    ): Promise<void> {
        try {
            // Update progress
            setUploadProgress(prev => prev ? {
                ...prev,
                currentFile: fileName,
                currentChunk: chunkIndex,
                totalChunks,
                retryAttempt: attempt
            } : null);

            const base64Chunk = btoa(
                new Uint8Array(chunkData).reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: abortController?.signal,
                body: JSON.stringify({
                    event: 'REQUEST_UPLOAD_CHUNK',
                    pluginId: 'storage-transfers',
                    data: {
                        sessionId,
                        fileName,
                        chunkIndex,
                        chunkData: base64Chunk,
                        totalChunks
                    }
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Chunk upload failed');
            }

            // Save progress to localStorage
            saveUploadProgress(sessionId, fileName, chunkIndex);

        } catch (error: any) {
            if (attempt < MAX_RETRIES - 1) {
                // Exponential backoff: 1s, 2s, 4s
                const delay = 1000 * Math.pow(2, attempt);
                console.log(`Chunk ${chunkIndex} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return uploadChunkWithRetry(sessionId, fileName, chunkIndex, chunkData, totalChunks, attempt + 1);
            } else {
                throw new Error(`Failed after ${MAX_RETRIES} attempts: ${error.message}`);
            }
        }
    }

    /**
     * Upload a single file in chunks
     */
    async function uploadFileInChunks(sessionId: string, fileEntry: FileEntry): Promise<void> {
        const totalChunks = Math.ceil(fileEntry.file.size / CHUNK_SIZE);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            // Check if paused
            while (isPaused) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileEntry.file.size);
            const chunk = fileEntry.file.slice(start, end);
            const chunkData = await chunk.arrayBuffer();

            await uploadChunkWithRetry(sessionId, fileEntry.relativePath, chunkIndex, chunkData, totalChunks);

            // Update uploaded size
            setUploadProgress(prev => prev ? {
                ...prev,
                uploadedSize: prev.uploadedSize + chunkData.byteLength
            } : null);
        }
    }

    /**
     * Cancel upload and cleanup
     */
    const handleCancel = async () => {
        if (!uploadProgress) return;

        const { sessionId } = uploadProgress;

        // Abort ongoing fetch requests
        if (abortController) {
            abortController.abort();
            setAbortController(null);
        }

        toast.loading('Cancelling upload...');

        try {
            // Request cleanup from storage-transfers
            await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_CLEANUP_SESSION',
                    pluginId: 'storage-transfers',
                    data: { sessionId }
                })
            });

            toast.dismiss();
            toast.info('Upload cancelled');
        } catch (e: any) {
            console.error('Failed to cleanup session:', e);
            toast.dismiss();
            toast.warning('Upload cancelled (cleanup may have failed)');
        } finally {
            // Reset state
            setIsUploading(false);
            setUploadProgress(null);
            setIsPaused(false);
        }
    };

    /**
     * Main upload function
     */
    const handleUpload = async () => {
        if (!selectedFolder || files.length === 0) {
            toast.error('No folder selected');
            return;
        }

        setIsUploading(true);

        // Create AbortController for cancellation
        const controller = new AbortController();
        setAbortController(controller);

        const toastId = toast.loading('Initializing upload...');

        try {
            // Step 1: Initialize upload session
            const initResponse = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_INIT_UPLOAD',
                    pluginId: 'storage-transfers'
                })
            });

            const initResult = await initResponse.json();

            if (!initResult.success) {
                throw new Error(initResult.error || 'Failed to initialize upload');
            }

            const sessionId = initResult.sessionId;
            const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

            // Initialize progress
            setUploadProgress({
                sessionId,
                folderName,
                totalFiles: files.length,
                totalSize,
                uploadedSize: 0,
                currentFile: '',
                currentChunk: 0,
                totalChunks: 0,
                retryAttempt: 0
            });

            toast.dismiss(toastId);
            toast.info(`Uploading ${files.length} files...`);

            // Step 2: Upload all files in chunks
            for (const fileEntry of files) {
                await uploadFileInChunks(sessionId, fileEntry);
            }

            // Step 3: Switch to server processing mode
            toast.dismiss(toastId);
            toast.info('Processing on server...');

            // Enable processing overlay (activates EventSource listener)
            setIsUploading(false);
            setUploadProgress(null);
            setIsProcessing(true);
            setProcessingStage('assembling');
            setProcessingMessage('Starting file assembly...');

            // Finalize upload (triggers server-side processing)
            const finalizeResponse = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_FINALIZE_UPLOAD',
                    pluginId: 'storage-transfers',
                    data: {
                        sessionId
                    }
                })
            });

            // Clean up localStorage
            cleanupUploadProgress(sessionId);

            // Note: EventSource listener handles completion
            // Modal will auto-close after UPLOAD_COMPLETE event

        } catch (error: any) {
            toast.dismiss();
            toast.error('Upload failed', { description: error.message });
            setIsProcessing(false);
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
            setAbortController(null);
        }
    };

    /**
     * Save upload progress to localStorage
     */
    function saveUploadProgress(sessionId: string, fileName: string, chunkIndex: number) {
        const key = `upload-progress-${sessionId}`;
        const existing = localStorage.getItem(key);
        const progress = existing ? JSON.parse(existing) : { completedChunks: {} };

        if (!progress.completedChunks[fileName]) {
            progress.completedChunks[fileName] = [];
        }

        progress.completedChunks[fileName].push(chunkIndex);
        localStorage.setItem(key, JSON.stringify(progress));
    }

    /**
     * Clean up upload progress from localStorage
     */
    function cleanupUploadProgress(sessionId: string) {
        localStorage.removeItem(`upload-progress-${sessionId}`);
    }

    /**
     * Format bytes for display
     */
    function formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    if (!isOpen) return null;

    const progressPercent = uploadProgress
        ? Math.round((uploadProgress.uploadedSize / uploadProgress.totalSize) * 100)
        : 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white">Upload from Computer</h3>
                        <p className="text-xs text-slate-500">Select a driver folder from your local machine</p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className="text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto space-y-4">
                    {!isUploading ? (
                        <>
                            {/* Folder Selection */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                    Selected Folder
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                                        <FolderOpen className="w-4 h-4 text-slate-600 shrink-0" />
                                        <span className={folderName ? 'text-emerald-400' : 'text-slate-600 italic'}>
                                            {folderName || 'No folder selected'}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSelectFolder}
                                        disabled={isScanning}
                                        className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-sm transition-colors border border-slate-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isScanning ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Scanning...
                                            </>
                                        ) : (
                                            'Select Folder'
                                        )}
                                    </button>
                                </div>

                                {/* Validation Status */}
                                {files.length > 0 && (
                                    <div className="flex items-center gap-2 text-xs">
                                        {hasInfFile ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                <span className="text-emerald-400">
                                                    Valid driver folder ({files.length} files, {formatBytes(files.reduce((sum, f) => sum + f.file.size, 0))})
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="w-4 h-4 text-amber-400" />
                                                <span className="text-amber-400">
                                                    No .inf file found ({files.length} files)
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Upload Progress */
                        uploadProgress && (
                            <div className="space-y-4">
                                {/* Network Status */}
                                <div className="flex items-center gap-2">
                                    {isOnline ? (
                                        <Wifi className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                        <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
                                    )}
                                    <span className={`text-xs ${isOnline ? 'text-slate-400' : 'text-amber-400'}`}>
                                        {isOnline ? 'Connected' : 'Connection lost, waiting...'}
                                    </span>
                                </div>

                                {/* Overall Progress */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Overall Progress</span>
                                        <span className="text-white font-mono">{progressPercent}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-sky-500 transition-all duration-300"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>{formatBytes(uploadProgress.uploadedSize)} / {formatBytes(uploadProgress.totalSize)}</span>
                                        <span>{uploadProgress.totalFiles} files</span>
                                    </div>
                                </div>

                                {/* Current File */}
                                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                                    <div className="text-xs text-slate-500">Currently uploading:</div>
                                    <div className="text-sm text-white font-mono truncate">{uploadProgress.currentFile}</div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Chunk {uploadProgress.currentChunk + 1} / {uploadProgress.totalChunks}</span>
                                        {uploadProgress.retryAttempt > 0 && (
                                            <span className="text-amber-400">Retry {uploadProgress.retryAttempt + 1}/{MAX_RETRIES}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* Server-Side Processing Overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6 animate-in fade-in duration-300">
                            <Loader2 className="w-16 h-16 animate-spin text-sky-500" />

                            <div className="text-center space-y-3 px-4">
                                <p className="text-2xl font-bold text-white">
                                    {processingStage === 'assembling' && '📁 Assembling Files'}
                                    {processingStage === 'building' && '📦 Building Package'}
                                    {processingStage === 'saving' && '💾 Saving to Repository'}
                                    {!processingStage && '⏳ Processing'}
                                </p>
                                <p className="text-sm text-slate-400 max-w-md">
                                    {processingMessage || 'Processing on server... Please wait'}
                                </p>
                            </div>

                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
                                Server processing
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-900/80 backdrop-blur-sm flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={isUploading ? handleCancel : onClose}
                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        {isUploading ? 'Cancel Upload' : 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={!selectedFolder || !hasInfFile || isUploading || isScanning || isProcessing}
                        className="px-6 py-2.5 rounded-lg bg-sky-500 text-slate-900 text-sm font-bold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing on server...
                            </>
                        ) : isUploading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4" />
                                Upload & Build Package
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
