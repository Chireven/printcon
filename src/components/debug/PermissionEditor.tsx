import React, { useState } from 'react';
import { Shield, Check, X, Lock, Unlock, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../../providers/MockAuthProvider';

interface PermissionEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

const PERMISSION_GROUPS = [
    {
        title: 'Drivers',
        permissions: [
            { id: 'drivers:read', label: 'View Drivers' },
            { id: 'driver:upload', label: 'Upload Drivers' },
            { id: 'driver:remove', label: 'Remove Drivers' }
        ]
    },
    {
        title: 'Plugins',
        permissions: [
            { id: 'plugin.install', label: 'Install Plugins' },
            { id: 'plugin.pack', label: 'Pack Plugins' },
            { id: 'plugin.delete', label: 'Delete Plugins' },
            { id: 'plugin.update', label: 'Update Plugins' },
            { id: 'plugin.lock', label: 'Lock/Unlock Plugins' }
        ]
    },
    {
        title: 'Printers',
        permissions: [
            { id: 'read:printers', label: 'View Printers' },
            { id: 'printer:manage', label: 'Manage Printers' }
        ]
    },
    {
        title: 'System',
        permissions: [
            { id: 'debugmode.activate', label: 'Activate Debug Mode' },
            { id: 'system.database.upgrade', label: 'Upgrade Database Schema' },
            { id: 'system.settings.read', label: 'View Settings' },
            { id: 'system.settings.write', label: 'Edit Settings' }
        ]
    }
];

export default function PermissionEditor({ isOpen, onClose }: PermissionEditorProps) {
    const { user, hasPermission, togglePermission } = useAuth();
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['System']); // Default expand System for visibility

    // Safety check: Only accessible if user has debug rights
    if (!hasPermission('debugmode.activate')) return null;
    if (!isOpen) return null;

    const toggleGroup = (title: string) => {
        setExpandedGroups(prev =>
            prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
        );
    };

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

                <div className="bg-slate-950/80 backdrop-blur max-h-[500px] overflow-y-auto custom-scrollbar">
                    {PERMISSION_GROUPS.map(group => {
                        const isExpanded = expandedGroups.includes(group.title);
                        const activeCount = group.permissions.filter(p => hasPermission(p.id)).length;

                        return (
                            <div key={group.title} className="border-b border-slate-800 last:border-0">
                                <button
                                    onClick={() => toggleGroup(group.title)}
                                    className="w-full flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-900 transition-colors"
                                >
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group.title}</span>
                                    <div className="flex items-center gap-2">
                                        {activeCount > 0 && (
                                            <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                                                {activeCount}/{group.permissions.length}
                                            </span>
                                        )}
                                        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="p-2 space-y-1 bg-black/20">
                                        {group.permissions.map(perm => {
                                            const active = hasPermission(perm.id);
                                            return (
                                                <div
                                                    key={perm.id}
                                                    onClick={() => togglePermission(perm.id)}
                                                    className={`
                                                        flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border
                                                        ${active
                                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                            : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-800'
                                                        }
                                                    `}
                                                >
                                                    <span className="text-xs font-mono">{perm.id}</span>
                                                    {active ? <Unlock className="w-3 h-3 opacity-70" /> : <Lock className="w-3 h-3 opacity-30" />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-2 bg-amber-950/30 border-t border-amber-500/20 text-[10px] text-amber-500/60 text-center flex items-center justify-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Audit logs are active. Changes strictly monitored.
                </div>
            </div>
        </div>
    );
}
