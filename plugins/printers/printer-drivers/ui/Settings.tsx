import React, { useState, useEffect } from 'react';
import { Folder, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
// @ts-ignore - Importing from src (outside plugin)
import { FilePicker } from '../../../../src/components/ui/FilePicker';

export default function PrinterDriverSettings() {
    const [repoPath, setRepoPath] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPicker, setShowPicker] = useState(false);

    // Load config
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch('/api/system/plugins/printer-drivers/config');
                const data = await res.json();
                if (data.status === 'success' && data.config?.repositoryPath) {
                    setRepoPath(data.config.repositoryPath);
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
        try {
            const res = await fetch('/api/system/plugins/printer-drivers/config', {
                method: 'POST',
                body: JSON.stringify({ repositoryPath: repoPath })
            });
            const data = await res.json();

            if (res.ok && data.status === 'success') {
                toast.success('Settings Saved', { description: 'Driver repository path updated.' });
            } else {
                toast.error('Save Failed', { description: data.message || 'Unknown server error' });
            }
        } catch (e: any) {
            toast.error('Save Failed', { description: e.message || 'Network error' });
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

                <div className="border-t border-slate-800 pt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold text-sm px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
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
