import React, { useState } from 'react';
import { Shield, Check, X, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../providers/MockAuthProvider';

interface PermissionEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

const AVAILABLE_PERMISSIONS = [
    { id: 'read:drivers', label: 'View Drivers' },
    { id: 'driver:install', label: 'Install Drivers' },
    { id: 'driver:remove', label: 'Remove Drivers' },
    { id: 'plugin.install', label: 'Install Plugins' },
    { id: 'plugin.delete', label: 'Delete Plugins' },
    { id: 'debugmode.activate', label: 'Activate Debug Mode' }
];

export default function PermissionEditor({ isOpen, onClose }: PermissionEditorProps) {
    const { user, hasPermission, togglePermission } = useAuth();

    // Safety check: Only accessible if user has debug rights (and isDebugMode active, checked by parent)
    if (!hasPermission('debugmode.activate')) return null;
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-20 right-8 z-[70] w-80 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-slate-900 border-2 border-amber-500/50 rounded-xl shadow-2xl shadow-amber-900/20 overflow-hidden">
                <div className="bg-amber-500/10 p-3 flex justify-between items-center border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-amber-500" />
                        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Debug Rights Manager</h3>
                    </div>
                    <button onClick={onClose} className="text-amber-500/50 hover:text-amber-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 bg-slate-950/80 backdrop-blur max-h-[400px] overflow-y-auto">
                    <div className="space-y-1">
                        {AVAILABLE_PERMISSIONS.map(perm => {
                            const active = hasPermission(perm.id);
                            return (
                                <div
                                    key={perm.id}
                                    onClick={() => togglePermission(perm.id)}
                                    className={`
                                        flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border
                                        ${active
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                                        }
                                    `}
                                >
                                    <span className="text-xs font-mono">{perm.id}</span>
                                    {active ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-2 bg-amber-950/30 border-t border-amber-500/20 text-[10px] text-amber-500/60 text-center flex items-center justify-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Audit logs are active. Changes strictly monitored.
                </div>
            </div>
        </div>
    );
}
