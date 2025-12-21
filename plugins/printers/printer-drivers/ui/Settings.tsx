import React, { useState, useEffect } from 'react';
import { Folder, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
// @ts-ignore - Importing from src (outside plugin)
import { FilePicker } from '../../../../src/components/ui/FilePicker';
import { Button } from '../../../../src/components/ui/Button';

export default function PrinterDriverSettings() {
    const [repoPath, setRepoPath] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPicker, setShowPicker] = useState(false);
    const [autoCleanupFolders, setAutoCleanupFolders] = useState<boolean | null>(null); // null until loaded from DB
    const [isSaving, setIsSaving] = useState(false);

    // Load config
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/system/plugins/printer-drivers/config');
                const data = await res.json();
                if (data.status === 'success' && data.config?.repositoryPath) {
                    setRepoPath(data.config.repositoryPath);
                }
                // Load autoCleanupFolders from config
                if (data.config?.autoCleanupFolders !== undefined) {
                    const value = data.config.autoCleanupFolders;
                    setAutoCleanupFolders(value === true || value === 'true');
                } else {
                    // Default to false if not set in database
                    setAutoCleanupFolders(false);
                }
            } catch (e) {
                console.error('Failed to load config', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_SAVE_SETTINGS',
                    pluginId: 'printer-drivers',
                    data: {
                        repositoryPath: repoPath,
                        autoCleanupFolders
                    }
                })
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Settings saved successfully');
            } else {
                toast.error('Save Failed', { description: data.message || 'Unknown server error' });
            }
        } catch (e: any) {
            toast.error('Save Failed', { description: e.message || 'Network error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-white">Printer Drivers</h1>
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mt-1">Configuration</p>
                </div>
                <div className="px-3 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono">
                    v1.0.0
                </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 space-y-6">
                {/* Repository Path */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Driver Repository Path</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={repoPath}
                            placeholder="No folder selected..."
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-mono"
                        />
                        <button
                            onClick={() => setShowPicker(true)}
                            className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg border border-slate-700 transition-colors"
                            title="Browse Folder"
                        >
                            <Folder className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                        This location will serve as the Driver Repository where Imported Drivers are stored.
                    </p>
                </div>

                {/* Auto-Cleanup Empty Folders Setting */}
                <label className="flex items-center justify-between cursor-pointer pt-4 border-t border-slate-800">
                    <div>
                        <span className="text-sm font-medium text-slate-200">Auto-Cleanup Empty Folders</span>
                        <p className="text-xs text-slate-500 mt-1">Automatically remove empty shard folders after deleting the last driver file</p>
                    </div>
                    <div
                        onClick={async () => {
                            const newValue = !autoCleanupFolders;
                            setAutoCleanupFolders(newValue);

                            // Auto-save this setting immediately
                            try {
                                await fetch('/api/system/command', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        event: 'REQUEST_SAVE_SETTINGS',
                                        pluginId: 'printer-drivers',
                                        data: {
                                            repositoryPath: repoPath,
                                            autoCleanupFolders: newValue
                                        }
                                    })
                                });
                                toast.success(newValue ? 'Auto-cleanup enabled' : 'Auto-cleanup disabled');
                            } catch (e) {
                                toast.error('Failed to save setting');
                                setAutoCleanupFolders(!newValue); // Revert on error
                            }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoCleanupFolders ? 'bg-sky-600' : 'bg-slate-700'
                            }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoCleanupFolders ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                    </div>
                </label>

                <div className="border-t border-slate-800 pt-6 flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        variant="primary"
                        size="md"
                        icon={Save}
                        loading={isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {showPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-2xl">
                        <FilePicker
                            selectionType="folder"
                            onSelect={(path) => {
                                setRepoPath(path);
                                setShowPicker(false);
                            }}
                            onCancel={() => setShowPicker(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
