
import React, { useState } from 'react';
import { X, Plus, Lock } from 'lucide-react';
import { useAuth } from '../../providers/MockAuthProvider';
import { PluginInstallModal } from '../ui/PluginInstallModal';
import { PluginConfigContainer } from './PluginConfigContainer';
import SystemTasksView from './SystemTasksView';

interface PluginEntry {
    id: string;
    name: string;
    version: string;
    type: string;
    locked?: boolean;
    active?: boolean;
}

interface SystemSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    plugins: PluginEntry[];
}

export default function SystemSettingsModal({ isOpen, onClose, plugins }: SystemSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<string>('general');
    const [showInstallPlugin, setShowInstallPlugin] = useState(false);
    const { hasPermission } = useAuth();

    if (!isOpen) return null;

    // Group plugins with custom logic for Providers
    const groupedPlugins = plugins.reduce((acc, p) => {
        let groupName = p.type;

        // Aggregate providers
        const providerTypes = ['databaseProvider', 'storageProvider', 'logging', 'logonProvider'];
        if (providerTypes.includes(p.type)) {
            groupName = 'Core Providers';
        }

        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(p);
        return acc;
    }, {} as Record<string, PluginEntry[]>);

    // Sort types: Put 'Core Providers' first, then alphabetical
    const sortedTypes = Object.keys(groupedPlugins).sort((a, b) => {
        if (a === 'Core Providers') return -1;
        if (b === 'Core Providers') return 1;
        return a.localeCompare(b);
    });

    const formatType = (type: string) => {
        if (type === 'Core Providers') return type;
        // Handle camelCase and capitalize first letter
        const split = type.replace(/([A-Z])/g, ' $1');
        return split.charAt(0).toUpperCase() + split.slice(1);
    };

    const handlePluginDeleted = (deletedId: string) => {
        const deletedPlugin = plugins.find(p => p.id === deletedId);
        if (!deletedPlugin) {
            setActiveTab('general');
            return;
        }

        // Find plugins of same type
        const siblings = plugins.filter(p => p.type === deletedPlugin.type && p.id !== deletedId);

        // Navigate to next sibling or general
        if (siblings.length > 0) {
            // Sort by name to be consistent with UI
            siblings.sort((a, b) => a.name.localeCompare(b.name));
            setActiveTab(siblings[0].id);
        } else {
            setActiveTab('general');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-950 border border-slate-700 rounded-2xl w-[90vw] h-[85vh] shadow-2xl relative overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white">System Configuration</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Manage plugins and core system settings</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Main Content Area - Flex Row */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Menu */}
                    <div className="w-64 bg-slate-900/50 border-r border-slate-800 p-4 overflow-y-auto custom-scrollbar">
                        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 px-2">System</h2>
                        <div className="space-y-1 mb-6">
                            <button onClick={() => setActiveTab('general')} className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'general' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                                General Settings
                            </button>
                            <button onClick={() => setActiveTab('system-tasks')} className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'system-tasks' ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                                System Tasks
                            </button>
                        </div>


                        <div className="space-y-6">
                            {sortedTypes.map(type => (
                                <div key={type}>
                                    <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 px-2 border-b border-slate-800 pb-1">{formatType(type)}</h3>
                                    <div className="space-y-1">
                                        {groupedPlugins[type].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setActiveTab(p.id)}
                                                className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${activeTab === p.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                                            >
                                                <div className={`w-2 h-2 rounded-full mr-2 ${p.active !== false ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}></div>
                                                <span className={activeTab === p.id ? 'text-white' : ''}>{p.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Content Panel */}
                    <div className="flex-1 bg-slate-950 p-8 overflow-y-auto relative custom-scrollbar">
                        <div className="absolute inset-0 bg-grid-slate-900/[0.04] bg-[bottom_1px_center] pointer-events-none" style={{ backgroundSize: '24px 24px', maskImage: 'linear-gradient(to bottom, transparent, black)' }}></div>

                        {activeTab === 'general' ? (
                            <div className="relative">
                                <h1 className="text-2xl font-black text-white mb-8 tracking-tight">System Settings</h1>

                                <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-800">
                                        <h3 className="text-lg font-bold text-white">Plugins</h3>
                                    </div>
                                    <div className="p-6 flex items-center gap-6">
                                        <button
                                            onClick={() => setShowInstallPlugin(true)}
                                            disabled={!hasPermission('plugin.install')}
                                            className={`
                                                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all border shadow-sm
                                                ${hasPermission('plugin.install')
                                                    ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600'
                                                    : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                                                }
                                            `}
                                            title={!hasPermission('plugin.install') ? "Permission Required: plugin.install" : "Install New Plugin"}
                                        >
                                            {hasPermission('plugin.install') ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                                            Install Plugin
                                        </button>
                                        <p className="text-slate-400 text-sm font-medium">
                                            Plugins are modules that allow you to extend the functionality of the system.
                                        </p>
                                    </div>
                                </div>

                                <PluginInstallModal
                                    isOpen={showInstallPlugin}
                                    onClose={() => setShowInstallPlugin(false)}
                                    onSuccess={(pluginId) => {
                                        if (pluginId) setActiveTab(pluginId);
                                    }}
                                />
                            </div>
                        ) : activeTab === 'system-tasks' ? (
                            <SystemTasksView />
                        ) : (
                            <PluginConfigContainer
                                pluginId={activeTab}
                                locked={plugins.find(p => p.id === activeTab)?.locked || false}
                                active={plugins.find(p => p.id === activeTab)?.active !== false}
                                pluginType={plugins.find(p => p.id === activeTab)?.type}
                                onDeleteSuccess={handlePluginDeleted}
                                onStateChange={() => {
                                    // SSE handles updates
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 bg-slate-950 border-t border-slate-800 text-center">
                    <p className="text-[10px] text-slate-600">PrintCon Core Configuration • V1.2.0-beta</p>
                </div>
            </div>
        </div>
    );
}
