'use client';

import React, { useState, useEffect } from 'react';
import DriverRepository from '../../plugins/printers/printer-drivers/ui/DriverRepository';
// @ts-ignore - Plugins outside src
// @ts-ignore - Plugins outside src
import MssqlSettings from '../../plugins/databaseProviders/database-mssql/ui/Settings';
// @ts-ignore - Plugins outside src
import PrinterDriverSettings from '../../plugins/printers/printer-drivers/ui/Settings';
import { EventHub } from '../core/events';
import { useSettings } from '../providers/SettingsProvider';
import {
    Printer,
    Shield,
    Activity,
    Plus,
    Settings,
    RefreshCw,
    ChevronRight,
    Database,
    LayoutDashboard,
    Search,
    Bell,
    Terminal,
    Bug,
    Package,
    PackageCheck,
    PackageX,
    Upload,
    Trash2,
    Lock,
    Unlock,
    AlertCircle
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import registryData from '../core/registry.json';
import { useKonamiCode } from '../hooks/useKonamiCode';
import { SettingsProvider } from '../providers/SettingsProvider';
import { MockAuthProvider, useAuth } from '../providers/MockAuthProvider';
import SettingsModal from '../components/settings/SettingsModal';
import PermissionEditor from '../components/debug/PermissionEditor';
import { SystemAlertModal } from '../components/ui/SystemAlertModal';
import { PluginDeleteModal } from '../components/ui/PluginDeleteModal';
import { FilePicker } from '../components/ui/FilePicker';
import { PluginInstallModal } from '../components/ui/PluginInstallModal';
import { PluginUnlockModal } from '../components/ui/PluginUnlockModal';

// --- Type Definitions ---
interface PluginEntry {
    id: string;
    name: string;
    version: string;
    type: string;
    locked?: boolean;
    active?: boolean;
}

// --- Components ---

const Header = ({ onOpenSettings }: { onOpenSettings: () => void }) => (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 sticky top-0 z-30">
        <div className="flex items-center gap-4">
            <div className="bg-sky-500/10 p-2 rounded-lg border border-sky-500/20">
                <Shield className="text-sky-400 w-6 h-6" />
            </div>
            <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                    PrintCon <span className="bg-sky-500 text-[10px] px-1.5 py-0.5 rounded text-slate-900 uppercase tracking-tighter">Core</span>
                </h1>
            </div>
        </div>

        <div className="flex-1 max-w-xl px-12 hidden md:block">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-sky-400 transition-colors" />
                <input
                    type="text"
                    placeholder="Search plugins or devices..."
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all text-slate-300"
                />
            </div>
        </div>

        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">Status: Live</span>
            </div>
            <div className="h-4 w-[1px] bg-slate-700"></div>
            <button className="text-slate-400 hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-sky-500 rounded-full border-2 border-slate-900"></div>
            </button>
            <button
                onClick={onOpenSettings}
                className="text-slate-400 hover:text-white transition-colors"
            >
                <Settings className="w-5 h-5" />
            </button>
            <div
                onClick={onOpenSettings}
                className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center font-bold text-slate-900 text-xs shadow-lg shadow-sky-500/20 cursor-pointer hover:scale-105 transition-transform"
            >
                JD
            </div>
        </div>
    </header>
);

const NavItem = ({ icon: Icon, label, isActive, onClick, disabled = false }: {
    icon: any,
    label: string,
    isActive?: boolean,
    onClick?: () => void,
    disabled?: boolean
}) => (
    <div
        onClick={!disabled ? onClick : undefined}
        className={`
      flex items-center justify-between group px-4 py-3 rounded-xl cursor-pointer transition-all duration-200
      ${isActive
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/10'
                : disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            }
    `}
    >
        <div className="flex items-center gap-3">
            <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-sky-400 transition-colors'}`} />
            <span className="text-sm font-semibold">{label}</span>
        </div>
        {isActive && <ChevronRight className="w-4 h-4 text-white/70" />}
    </div>
);

const Sidebar = ({ plugins, activePlugin, onSelect }: {
    plugins: PluginEntry[],
    activePlugin: string | null,
    onSelect: (id: string) => void
}) => {
    const [statsMap, setStatsMap] = useState<Record<string, { label: string, value: string | number }[]>>({});
    const { highContrast } = useSettings();

    useEffect(() => {
        const handleStatusUpdate = (payload: any) => {
            if (payload && payload.pluginId && payload.rows) {
                setStatsMap(prev => ({
                    ...prev,
                    [payload.pluginId]: payload.rows
                }));
            }
        };

        EventHub.on('plugin:status:update', handleStatusUpdate);
    }, []);

    const currentStats = activePlugin ? statsMap[activePlugin] : undefined;

    return (
        <aside className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 flex flex-col z-40">
            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar space-y-10">

                <div>
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-4 mb-4">Dashboard</h2>
                    <nav className="space-y-1">
                        <NavItem icon={LayoutDashboard} label="Overview" />
                        <NavItem icon={Activity} label="System Health" />
                    </nav>
                </div>

                <div>
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-4 mb-4">Management Plugins</h2>
                    <nav className="space-y-1">
                        {plugins.filter(p => p.type === 'feature').map(plugin => (
                            <NavItem
                                key={plugin.id}
                                icon={Printer}
                                label={plugin.name}
                                isActive={activePlugin === plugin.id}
                                onClick={() => onSelect(plugin.id)}
                            />
                        ))}
                    </nav>
                </div>

                <div>
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-4 mb-4">Device Management</h2>
                    <nav className="space-y-1">
                        {plugins.filter(p => p.type === 'printers').map(plugin => (
                            <NavItem
                                key={plugin.id}
                                icon={Printer}
                                label={plugin.name}
                                isActive={activePlugin === plugin.id}
                                onClick={() => onSelect(plugin.id)}
                            />
                        ))}
                    </nav>
                </div>

                <div>
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-4 mb-4">Infrastructure</h2>
                    <nav className="space-y-1">
                        {plugins.filter(p => ['logging', 'logonprovider', 'databaseProvider'].includes(p.type)).map(plugin => (
                            <NavItem
                                key={plugin.id}
                                icon={['logging', 'databaseProvider'].includes(plugin.type) ? Database : Shield}
                                label={plugin.name}
                                disabled
                            />
                        ))}
                    </nav>
                </div>
            </div>

            <div className={`p-6 border-t ${highContrast ? 'border-white bg-black' : 'border-slate-800 bg-slate-900/50'} backdrop-blur-sm sticky bottom-0`}>
                {currentStats ? (
                    <div className="w-full animate-in fade-in slide-in-from-bottom-2">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Plugin Status</h3>
                        <div className={`w-full overflow-hidden rounded-lg border ${highContrast ? 'border-white' : 'border-slate-700'}`}>
                            <table className="w-full text-xs">
                                <tbody>
                                    {currentStats.map((row, i) => (
                                        <tr key={i} className={`border-b last:border-0 ${highContrast ? 'border-white/20' : 'border-slate-700/50'}`}>
                                            <td className={`bg-slate-900/50 p-2 font-medium ${highContrast ? 'text-white' : 'text-slate-400'}`}>
                                                {row.label}
                                            </td>
                                            <td className="p-2 text-right font-bold text-white tabular-nums bg-black/20">
                                                {row.value}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="w-full flex items-center justify-center p-4 rounded-xl border border-dashed border-slate-800 text-slate-600 text-[10px] uppercase font-bold tracking-wider">
                        No Active Status
                    </div>
                )}
            </div>
        </aside>
    );
};

const PrintersView = () => {
    const [printers, setPrinters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPrinters = async () => {
            setLoading(true);
            await new Promise(r => setTimeout(r, 1000));

            const mockPrinters = [
                { "id": "1", "name": "HR-LaserJet", "status": "Online", "jobs": 0, "location": "Floor 2, Room 204" },
                { "id": "2", "name": "Marketing-Color", "status": "Paper Jam", "jobs": 4, "location": "Marketing Hub" },
                { "id": "3", "name": "Warehouse-Labels", "status": "Offline", "jobs": 0, "location": "East Warehouse" }
            ];

            setPrinters(mockPrinters);
            setLoading(false);
        };

        fetchPrinters();
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="relative flex items-center justify-center">
                <div className="absolute w-12 h-12 border-4 border-sky-500/20 rounded-full"></div>
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
                <p className="text-white font-bold text-lg animate-pulse">Initializing Printer Manager</p>
                <p className="text-slate-500 text-sm italic">Accessing background PowerShell service...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Printer className="w-5 h-5 text-sky-400" />
                        <span className="text-xs font-bold text-sky-500 uppercase tracking-widest">Active Feature</span>
                    </div>
                    <h2 className="text-3xl font-black text-white">Printer Fleet</h2>
                    <p className="text-slate-500 text-sm mt-1">Found <span className="text-slate-300 font-bold">3 active network endpoints</span> across the organization.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 font-bold text-sm hover:bg-slate-700 transition-all shadow-sm">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button className="bg-sky-500 text-slate-900 px-6 py-2.5 rounded-xl font-black text-sm hover:bg-sky-400 transition-all shadow-lg shadow-sky-500/20 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Printer
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                <th className="px-8 py-5">Device ID</th>
                                <th className="px-8 py-5">Printer Name & Location</th>
                                <th className="px-8 py-5">Network Status</th>
                                <th className="px-8 py-5 text-center">Active Jobs</th>
                                <th className="px-8 py-5">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {printers.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{p.id}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div>
                                            <p className="font-bold text-slate-900">{p.name}</p>
                                            <p className="text-xs text-slate-400 block mt-0.5">{p.location}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`
                      inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight
                      ${p.status === 'Online' ? 'bg-emerald-100 text-emerald-700' :
                                                p.status === 'Offline' ? 'bg-slate-100 text-slate-600' :
                                                    'bg-amber-100 text-amber-700'}
                    `}>
                                            <span className={`w-2 h-2 rounded-full ${p.status === 'Online' ? 'bg-emerald-500' :
                                                p.status === 'Offline' ? 'bg-slate-400' :
                                                    'bg-amber-500 animate-pulse'
                                                }`}></span>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`font-black ${p.jobs > 0 ? 'text-sky-500' : 'text-slate-300'}`}>
                                            {p.jobs}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <button className="text-sky-600 hover:text-sky-700 font-bold text-sm transition-colors invisible group-hover:visible hover:underline decoration-2 underline-offset-4">
                                            Manage Setup
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-between items-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        Data provided by PowerShell PluginAPI
                    </p>
                    <div className="flex gap-2 text-[10px] font-bold">
                        <span className="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-tighter">Verified</span>
                        <span className="text-sky-600 bg-sky-100 px-2 py-0.5 rounded uppercase tracking-tighter">API V1.0</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmptyState = ({ pluginId, plugins }: { pluginId: string, plugins: PluginEntry[] }) => {
    const name = plugins.find(p => p.id === pluginId)?.name || 'Plugin';
    return (
        <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-6 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-slate-800 rounded-[2.5rem] flex items-center justify-center border-2 border-slate-700 shadow-2xl transform transition-transform hover:rotate-6">
                <Shield className="text-sky-400 w-10 h-10" />
            </div>
            <div>
                <h3 className="text-2xl font-black text-white mb-2">Mounting {name}</h3>
                <p className="text-slate-500 leading-relaxed italic border-l-2 border-sky-500 pl-4 py-1">
                    "The Core is currently resolving manifest entries and injecting the execution bridge into the plugin sandbox."
                </p>
            </div>
            <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}></div>
                ))}
            </div>
        </div>
    );
};

import SystemTasksView from '../components/settings/SystemTasksView';

// ... (existing imports)

const SystemSettingsView = ({ plugins }: { plugins: PluginEntry[] }) => {
    const [activeTab, setActiveTab] = useState<string>('general');

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

    const [showInstallPlugin, setShowInstallPlugin] = useState(false);
    const { hasPermission } = useAuth();

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
        <div className="flex bg-white rounded-xl shadow-2xl shadow-black/50 border border-slate-800 h-[calc(100vh-140px)] overflow-hidden">
            {/* Menu Bar */}
            <div className="w-64 bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto custom-scrollbar">
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

            {/* Content Area */}
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
                            // Refresh plugins list to reflect status change
                            // Since plugins are passed as prop effectively from DashboardContent, 
                            // we need a way to trigger refresh up the chain or reliance on SSE.
                            // DashboardContent listens to REGISTRY_UPDATED via SSE which triggers fetchPlugins.
                            // The POST route updates registry.json -> SSE Watcher fires -> DashboardContent fetches -> New props passed down.
                            // So actually, we might not need to do anything manual here if SSE works!
                            // But for instant feedback, we can't easily update props from here without a callback from DashboardContent.
                            // For now, let's assume SSE will handle it.
                        }}
                    />
                )}
            </div>
        </div>
    );
};

const PluginConfigContainer = ({ pluginId, action, locked, active, pluginType, onDeleteSuccess, onStateChange }: { pluginId: string, action?: string | null, locked: boolean, active: boolean, pluginType?: string, onDeleteSuccess?: (id: string) => void, onStateChange?: () => void }) => {
    const { hasPermission } = useAuth();

    // Core (Infrastructure) Plugins cannot be Updated or Deleted via UI
    const isRestricted = ['databaseProvider', 'storageProvider', 'logonProvider'].includes(pluginType || '');

    // Modal States
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showUpdatePicker, setShowUpdatePicker] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);

    const handlePowerToggle = async () => {
        toast.info(active ? 'Deactivating...' : 'Activating...', { description: 'Updating registry...' });
        try {
            const res = await fetch('/api/system/plugins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pluginId, active: !active })
            });

            if (res.ok) {
                toast.success(active ? 'Plugin Disabled' : 'Plugin Enabled');
                if (onStateChange) onStateChange();
            } else {
                const data = await res.json();
                toast.error('Operation Failed', { description: data.error });
            }
        } catch (e: any) {
            toast.error('Error', { description: e.message });
        }
    };

    const handleLockToggle = async () => {
        if (locked) {
            // Initiate Unlock Flow
            setShowUnlockModal(true);
        } else {
            // Lock immediately
            toast.info('Locking Plugin...', { description: 'Updating security policy...' });
            try {
                const res = await fetch('/api/system/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'lock', pluginId })
                });

                if (res.ok) {
                    toast.success('Plugin Locked Safe');
                } else {
                    const data = await res.json();
                    toast.error('Lock Failed', { description: data.error });
                }
            } catch (e: any) {
                toast.error('Error', { description: e.message });
            }
        }
    };

    const handlePack = async () => {
        toast.info('Packing Plugin...', { description: `Creating ${pluginId} archive...` });
        try {
            const res = await fetch('/api/system/plugins/pack', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pluginId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Plugin Packed', {
                    description: `Saved to dist/plugins/${pluginId}.plugin`,
                    duration: 5000
                });
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            toast.error('Pack Failed', { description: e.message });
        }
    };

    const confirmDelete = async () => {
        setShowDeleteModal(false);
        toast.info('Deleting Plugin...', { description: 'Please wait...' });
        try {
            const res = await fetch('/api/system/plugins/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pluginId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Plugin Deleted', { description: data.message });
                if (onDeleteSuccess) onDeleteSuccess(pluginId);
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            toast.error('Delete Failed', { description: e.message });
        }
    };




    return (
        <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-8 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div>
                    <h1 className="text-xl font-black text-white tracking-tight">{pluginId}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono">
                            v1.0.1
                        </div>
                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Configuration</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* POWER */}
                    {!isRestricted && (
                        <button
                            onClick={handlePowerToggle}
                            disabled={locked} // Cannot toggle if locked
                            className={`
                                flex items-center justify-center w-8 h-8 rounded-lg transition-all border shadow-lg
                                ${active
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500 shadow-emerald-500/20 hover:bg-emerald-500/20'
                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                                }
                                ${locked && 'opacity-50 cursor-not-allowed grayscale'}
                            `}
                            title={locked ? "Plugin is Locked" : (active ? "Disable Plugin" : "Enable Plugin")}
                        >
                            <div className="relative">
                                <div className={`absolute inset-0 bg-white rounded-full blur-sm opacity-50 ${active ? 'animate-pulse' : 'hidden'}`}></div>
                                <Activity className="w-4 h-4 relative z-10" />
                            </div>
                        </button>
                    )}

                    {/* LOCK / UNLOCK */}
                    <button
                        onClick={handleLockToggle}
                        disabled={!hasPermission('plugin.lock')}
                        className={`
                            flex items-center justify-center w-8 h-8 rounded-lg transition-all border
                            ${locked
                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 hover:bg-amber-500/20 shadow-sm shadow-amber-500/10'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                            }
                            ${!hasPermission('plugin.lock') && 'opacity-50 cursor-not-allowed'}
                        `}
                        title={!hasPermission('plugin.lock') ? "Permission Required: plugin.lock" : (locked ? "Unlock Plugin" : "Lock Plugin")}
                    >
                        {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </button>

                    {/* PACK */}
                    <button
                        onClick={handlePack}
                        disabled={!hasPermission('plugin.pack')}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                            ${hasPermission('plugin.pack')
                                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50'
                                : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                            }
                        `}
                        title={!hasPermission('plugin.pack') ? "Permission Required: plugin.pack" : "Pack Plugin"}
                    >
                        {hasPermission('plugin.pack') ? <Package className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                        PACK
                    </button>

                    {/* UPDATE */}
                    {!isRestricted && (
                        <button
                            onClick={() => setShowUpdatePicker(true)}
                            disabled={!hasPermission('plugin.update') || locked}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                                ${hasPermission('plugin.update') && !locked
                                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-sky-500/20 hover:text-sky-400 hover:border-sky-500/50'
                                    : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                                }
                            `}
                            title={
                                !hasPermission('plugin.update') ? "Permission Required: plugin.update" :
                                    locked ? "Plugin is Locked (Rule #23)" :
                                        "Update Plugin"
                            }
                        >
                            {hasPermission('plugin.update') && !locked ? <Upload className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                            UPDATE
                        </button>
                    )}

                    {/* DELETE */}
                    {!isRestricted && (
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            disabled={!hasPermission('plugin.delete') || locked}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                                ${hasPermission('plugin.delete') && !locked
                                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50'
                                    : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                                }
                            `}
                            title={
                                !hasPermission('plugin.delete') ? "Permission Required: plugin.delete" :
                                    locked ? "Plugin is Locked (Rule #23)" :
                                        "Delete Plugin"
                            }
                        >
                            {hasPermission('plugin.delete') && !locked ? <Trash2 className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                            DELETE
                        </button>
                    )}
                </div>
            </div>

            {pluginId === 'database-mssql' ? (
                <MssqlSettings initialAction={action} />
            ) : pluginId === 'printer-drivers' ? (
                <PrinterDriverSettings />
            ) : (
                <div className="p-12 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 bg-slate-900/20">
                    <Settings className="w-12 h-12 mb-4 opacity-50 animate-spin-slow" />
                    <p className="font-medium">Plugin configuration UI</p>
                    <p className="text-xs mt-2 font-mono bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-slate-500">Target: plugins/*/{pluginId}/Settings.tsx</p>
                </div>
            )}

            <PluginDeleteModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={confirmDelete}
                pluginId={pluginId}
            />

            <PluginInstallModal
                isOpen={showUpdatePicker}
                onClose={() => setShowUpdatePicker(false)}
                targetPluginId={pluginId}
            />

            <PluginUnlockModal
                isOpen={showUnlockModal}
                onClose={() => setShowUnlockModal(false)}
                onSuccess={() => {/* State updates via SSE */ }}
                pluginId={pluginId}
            />
        </div>
    );
};

// --- Mock Authentication ---
const MOCK_USER = {
    name: 'Joe Demo',
    email: 'joe@printcon.enterprise',
    permissions: ['plugin.install', 'plugin.delete', 'debugmode.activate']
};

export default function DashboardPage() {
    return (
        <MockAuthProvider>
            <SettingsProvider>
                <DashboardContent />
            </SettingsProvider>
        </MockAuthProvider>
    );
}

function DashboardContent() {
    const [activePlugin, setActivePlugin] = useState<string | null>('printer-manager');
    const [pluginAction, setPluginAction] = useState<string | null>(null);
    const [plugins, setPlugins] = useState<PluginEntry[]>([]);
    const [isDebugMode, setIsDebugMode] = useState(true);

    // Modal States
    const [showSettings, setShowSettings] = useState(false);
    const [showDebugPermissions, setShowDebugPermissions] = useState(false);

    const { hasPermission } = useAuth(); // Use new auth hook for logic

    const fetchPlugins = async () => {
        try {
            const res = await fetch('/api/system/plugins', { cache: 'no-store' });
            const data = await res.json();
            setPlugins(data);
        } catch (e) {
            console.error('Failed to fetch plugins:', e);
        }
    };

    useEffect(() => {
        fetchPlugins();
    }, []);

    useKonamiCode(() => {
        // Now using dynamic checking via Context (though requires user to have permission initially to activate)
        if (hasPermission('debugmode.activate')) {
            setIsDebugMode(!isDebugMode);
        }
    });

    useEffect(() => {
        if (!isDebugMode) return;

        console.log('[System] Connecting to SSE event stream...');
        const eventSource = new EventSource('/api/system/events');

        eventSource.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                handlePayload(payload);
            } catch (e) {
                // Silent error Rule #4
            }
        };

        const handlePayload = (payload: any) => {
            const { event, data } = payload;
            const timestamp = new Date().toLocaleTimeString();
            const config = {
                description: `Plugin: ${data?.pluginId || 'unknown'} • ${timestamp}`,
                duration: 5000,
            };

            // Enhanced Console Logging
            const logEvent = (type: 'error' | 'warning' | 'success', msg: string, meta?: any) => {
                const styles = {
                    error: 'background: #ef4444; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
                    warning: 'background: #eab308; color: black; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
                    success: 'background: #22c55e; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;',
                };
                console.log(`%c ${type.toUpperCase()} %c ${msg}`, styles[type], 'font-weight: bold; color: inherit;', meta || '');
            };

            if (data?.status === 'failure') {
                logEvent('error', event, data);
                toast.error(event, { ...config, icon: <AlertCircle className="w-4 h-4" /> });
                return;
            }

            // Refresh registry on system changes
            if (event.startsWith('system:plugin:') || event.startsWith('PLUGIN_') || event === 'REGISTRY_UPDATED') {
                fetchPlugins();
            }

            switch (event) {
                case 'PLUGIN_INSTALLED':
                case 'PLUGIN_PACKED':
                    logEvent('success', event, data);
                    toast.success(event, { ...config, icon: <PackageCheck className="w-4 h-4" /> });
                    break;
                case 'PLUGIN_DELETED':
                    logEvent('error', event, data);
                    toast.error(event, { ...config, icon: <PackageX className="w-4 h-4" /> });
                    break;
                case 'PLUGIN_CREATED':
                    logEvent('success', event, data);
                    toast.message(event, { ...config, icon: <Terminal className="w-4 h-4" /> });
                    break;
                case 'SYSTEM_ALERT':
                    logEvent('error', event, data);
                    toast.error(data?.title || 'System Alert', {
                        ...config,
                        description: data?.message || 'Critical system event occurred.',
                        icon: <AlertCircle className="w-5 h-5 text-red-500" />,
                        duration: 10000 // Long duration for alerts
                    });
                    break;
                case 'PLUGIN_UNLOCK_CHALLENGE':
                    logEvent('warning', event, data);
                    toast(event, {
                        ...config,
                        description: `Security Challenge: Enter PIN [${data?.pin}] in your terminal.`,
                        icon: <Lock className="w-4 h-4 text-amber-500" />,
                        duration: 30000,
                    });
                    break;
                case 'PLUGIN_LOCKED':
                    logEvent('warning', event, data);
                    toast.info(event, { ...config, icon: <Lock className="w-4 h-4" /> });
                    break;
                case 'PLUGIN_UNLOCKED':
                    logEvent('success', event, data);
                    toast.success(event, { ...config, icon: <Unlock className="w-4 h-4" /> });
                    break;
                default:
                    logEvent('warning', event, config);
                    toast.info(event, config);
            }
        };

        return () => eventSource.close();
    }, [isDebugMode]);

    const handlePluginDeleted = (deletedId: string) => {
        if (activePlugin !== deletedId) return;

        const deletedPlugin = plugins.find(p => p.id === deletedId);
        if (!deletedPlugin) {
            setActivePlugin(null); // Go to dashboard root
            return;
        }

        // Find plugins of same type
        const siblings = plugins.filter(p => p.type === deletedPlugin.type && p.id !== deletedId);

        // Navigate or Reset
        if (siblings.length > 0) {
            siblings.sort((a, b) => a.name.localeCompare(b.name));
            setActivePlugin(siblings[0].id);
        } else {
            setActivePlugin('system-settings'); // Fallback to System Settings
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-slate-900 overflow-hidden">
            <Header onOpenSettings={() => setActivePlugin('system-settings')} />
            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    plugins={plugins}
                    activePlugin={activePlugin}
                    onSelect={(id) => {
                        setActivePlugin(id);
                        setPluginAction(null); // Reset action on manual manual nav
                    }}
                />

                <main className="flex-1 ml-72 overflow-y-auto bg-slate-950 px-12 py-10 custom-scrollbar relative">
                    <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
                    <div className="fixed bottom-0 left-[300px] w-[500px] h-[500px] bg-sky-500/3 rounded-full blur-[120px] pointer-events-none -z-10"></div>

                    <div className="max-w-6xl mx-auto h-full min-h-[500px]">
                        {activePlugin === 'printer-manager' ? (
                            <PrintersView />
                        ) : activePlugin === 'printer-drivers' ? (
                            <DriverRepository />
                        ) : activePlugin === 'system-settings' ? (
                            <SystemSettingsView plugins={plugins} />
                        ) : activePlugin ? (
                            <PluginConfigContainer
                                pluginId={activePlugin}
                                action={pluginAction}
                                locked={plugins.find(p => p.id === activePlugin)?.locked || false}
                                active={plugins.find(p => p.id === activePlugin)?.active !== false}
                                pluginType={plugins.find(p => p.id === activePlugin)?.type}
                                onDeleteSuccess={handlePluginDeleted}
                                onStateChange={() => {
                                    // SSE handles refresh
                                }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-600 font-black uppercase tracking-[0.3em] text-sm animate-pulse">
                                System Awaiting Selection
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <div className="fixed inset-0 pointer-events-none -z-50 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#38bdf8 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>

            {isDebugMode && (
                <div
                    onClick={() => setShowDebugPermissions(true)}
                    className="fixed bottom-8 right-8 z-50 flex items-center gap-3 bg-red-500 text-white px-4 py-2 rounded-full font-black text-xs shadow-2xl shadow-red-500/40 animate-pulse border-2 border-white/20 cursor-pointer hover:bg-red-600 transition-colors"
                    title="Click to Manage Debug Permissions"
                >
                    <Bug className="w-4 h-4" />
                    DEBUG MODE ACTIVE
                </div>
            )}

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
            <PermissionEditor isOpen={showDebugPermissions} onClose={() => setShowDebugPermissions(false)} />
            <SystemAlertModal onFix={() => {
                const dbPlugin = plugins.find(p => p.type === 'databaseProvider');
                if (dbPlugin) {
                    setActivePlugin(dbPlugin.id);
                    setPluginAction('test-schema');
                } else {
                    toast.error("No Database Provider found to configure.");
                }
            }} />

            <Toaster richColors position="top-right" theme="dark" />
        </div>
    );
}

