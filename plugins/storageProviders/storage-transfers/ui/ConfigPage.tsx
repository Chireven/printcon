import React, { useState, useEffect } from 'react';
import { FolderOpen, Save, AlertCircle, CheckCircle2, Loader2, FolderPlus } from 'lucide-react';
import { toast } from 'sonner';
import { FilePicker } from '../../../../src/components/ui/FilePicker';

export default function ConfigPage() {
    const [tempDirectory, setTempDirectory] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Load current config
    useEffect(() => {
        const loadConfig = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/api/system/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'REQUEST_GET_CONFIG',
                        pluginId: 'storage-transfers'
                    })
                });

                const result = await response.json();

                if (result.success && result.config) {
                    setTempDirectory(result.config.tempDirectory || '');
                }
            } catch (e: any) {
                console.error('Failed to load config:', e);
                toast.error('Failed to load configuration');
            } finally {
                setIsLoading(false);
            }
        };

        loadConfig();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_SAVE_CONFIG',
                    pluginId: 'storage-transfers',
                    data: {
                        tempDirectory
                    }
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to save configuration');
            }

            toast.success('Configuration saved');
            setIsDirty(false);
        } catch (e: any) {
            toast.error('Failed to save configuration', { description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePathChange = (path: string) => {
        setTempDirectory(path);
        setIsDirty(true);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            </div>
        );
    }

    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="border-b border-slate-700 pb-4">
                    <h2 className="text-2xl font-bold text-white">Storage Transfers Configuration</h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Configure server-side storage settings for file uploads and transfers
                    </p>
                </div>

                {/* Temporary Directory Setting */}
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <FolderOpen className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white">Temporary Upload Directory</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Server-side location where uploaded files are temporarily stored during processing.
                                Defaults to system temp directory if not specified.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                            Directory Path
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={tempDirectory}
                                onChange={(e) => handlePathChange(e.target.value)}
                                placeholder="Leave empty for system default (e.g., C:\\Temp\\printcon-uploads)"
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <button
                                type="button"
                                onClick={() => setIsPickerOpen(true)}
                                className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-sm transition-colors border border-slate-700 flex items-center gap-2"
                            >
                                <FolderPlus className="w-4 h-4" />
                                Browse
                            </button>
                        </div>

                        {!tempDirectory && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Using system default temp directory
                            </div>
                        )}

                        {tempDirectory && (
                            <div className="flex items-center gap-2 text-xs text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Custom directory configured
                            </div>
                        )}
                    </div>

                    {/* Info Box */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                            <div className="text-xs text-slate-400 space-y-1">
                                <p><strong className="text-white">Note:</strong> The directory must be writable by the PrintCon service account.</p>
                                <p>Session files are automatically cleaned up after 30 minutes of inactivity.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!isDirty || isSaving}
                        className="px-6 py-2.5 rounded-lg bg-sky-500 text-slate-900 text-sm font-bold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Configuration
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* File Picker Modal */}
            {isPickerOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[800px] max-h-[600px] overflow-hidden">
                        <FilePicker
                            selectionType="folder"
                            onSelect={(path) => {
                                handlePathChange(path);
                                setIsPickerOpen(false);
                            }}
                            onCancel={() => setIsPickerOpen(false)}
                            allowedExtensions={[]}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
