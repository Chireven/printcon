import React from 'react';
import { X, Moon, Sun, Monitor, Type } from 'lucide-react';
import { useSettings } from '../../providers/SettingsProvider';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { highContrast, setHighContrast } = useSettings();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[500px] shadow-2xl relative overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white">User Settings</h2>
                        <p className="text-xs text-slate-500 mt-1">Manage your interface preferences</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Appearance Section */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Appearance</h3>

                        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-slate-700 rounded-lg">
                                    <Type className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">High Contrast Mode</h4>
                                    <p className="text-xs text-slate-400 mt-1">Add borders to buttons for better visibility</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={highContrast}
                                    onChange={(e) => setHighContrast(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                            </label>
                        </div>
                    </div>

                    <div className="p-4 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-400">
                        <p>More settings coming soon.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
                    <p className="text-[10px] text-slate-600">PrintCon Core V2.0 • User Preference Module</p>
                </div>
            </div>
        </div>
    );
}
