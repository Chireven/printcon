import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface PluginDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    pluginId: string;
}

export const PluginDeleteModal: React.FC<PluginDeleteModalProps> = ({ isOpen, onClose, onConfirm, pluginId }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-950 border-2 border-red-900/50 rounded-xl overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-red-950/30 p-4 border-b border-red-900/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-500 font-bold">
                        <Trash2 className="w-5 h-5" />
                        <span>Delete Plugin</span>
                    </div>
                    <button onClick={onClose} className="text-red-500/50 hover:text-red-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-red-500/10 rounded-full border border-red-500/20 shrink-0">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">Are you absolutely sure?</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                You are about to delete the plugin <span className="font-mono text-red-400 bg-red-950/30 px-1 rounded">{pluginId}</span>.
                            </p>
                            <div className="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-400 space-y-1">
                                <p>This process will permanently remove:</p>
                                <ul className="list-disc list-inside text-slate-500">
                                    <li>Plugin files and configuration</li>
                                    <li>Associated database tables</li>
                                    <li>Local storage data</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-500 shadow-lg shadow-red-600/20 transition-all active:scale-95"
                        >
                            Yes, Delete Plugin
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
