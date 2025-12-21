import React, { useState } from 'react';
import { X, Package, Check, AlertTriangle, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface PluginInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (id?: string) => void;
    targetPluginId?: string; // Optional: If upgrading a specific plugin
}

export function PluginInstallModal({ isOpen, onClose, onSuccess, targetPluginId }: PluginInstallModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isInstalling, setIsInstalling] = useState(false);

    if (!isOpen) return null;

    const handleInstall = async () => {
        if (!selectedFile) return;
        setIsInstalling(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const endpoint = targetPluginId
                ? '/api/system/plugins/upgrade'
                : '/api/system/plugins/upload';

            // If upgrading, pass the target ID for validation
            if (targetPluginId) {
                formData.append('targetPluginId', targetPluginId);
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.details || data.error || 'Operation failed');

            const actionVerb = targetPluginId ? 'Upgrade' : 'Installation';
            toast.success(`${actionVerb} started`, { description: data.message });

            if (onSuccess) onSuccess(data.pluginId);
            onClose();
        } catch (error: any) {
            console.error(error);
            const actionVerb = targetPluginId ? 'Upgrade' : 'Installation';
            toast.error(`${actionVerb} failed`, { description: error.message });
        } finally {
            setIsInstalling(false);
        }
    };

    const reset = () => {
        setSelectedFile(null);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-sky-500/10 p-2 rounded-lg border border-sky-500/20">
                            <Package className="w-5 h-5 text-sky-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight">
                                {targetPluginId ? `Update ${targetPluginId}` : 'Install Plugin'}
                            </h2>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">System Package Manager</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">

                    {/* File Selection */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">Upload Package</label>

                        {selectedFile ? (
                            <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <Check className="w-5 h-5 text-emerald-400" />
                                <div className="flex-1 overflow-hidden">
                                    <div className="text-xs font-bold text-white truncate">{selectedFile.name}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                                </div>
                                <button onClick={() => setSelectedFile(null)} className="text-xs font-bold text-emerald-400 hover:underline">Change</button>
                            </div>
                        ) : (
                            <label className="w-full py-8 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-sky-400 hover:border-sky-500/50 hover:bg-sky-500/5 transition-all cursor-pointer group">
                                <input
                                    type="file"
                                    accept=".plugin,.pd"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }}
                                />
                                <div className="p-3 mb-2 rounded-full bg-slate-900 group-hover:bg-slate-800 transition-colors">
                                    <Upload className="w-6 h-6" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-wider">Click to Upload .plugin File</span>
                                <span className="text-[10px] text-slate-600 mt-1">or drag and drop here</span>
                            </label>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                    <div className="text-[10px] text-slate-500 font-medium max-w-[200px]">
                        <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />
                        Only install plugins from trusted sources.
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 rounded-lg text-slate-400 text-xs font-bold hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleInstall}
                            disabled={!selectedFile || isInstalling}
                            className={`
                                flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-bold transition-all
                                ${!selectedFile || isInstalling
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-sky-500/20'
                                }
                            `}
                        >
                            {isInstalling
                                ? (targetPluginId ? 'Updating...' : 'Installing...')
                                : (targetPluginId ? 'Update Plugin' : 'Install Plugin')
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
