'use client';

import React, { useState, useEffect } from 'react';
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
    PackageCheck,
    PackageX,
    AlertCircle,
    Lock,
    Unlock
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import registryData from '../core/registry.json';
import { useKonamiCode } from '../hooks/useKonamiCode';

// --- Type Definitions ---
interface PluginEntry {
    id: string;
    name: string;
    version: string;
    type: string;
}

// --- Components ---

const Header = () => (
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
            <button className="text-slate-400 hover:text-white transition-colors">
                <Settings className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center font-bold text-slate-900 text-xs shadow-lg shadow-sky-500/20 cursor-pointer hover:scale-105 transition-transform">
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
                    <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest px-4 mb-4">Infrastructure</h2>
                    <nav className="space-y-1">
                        {plugins.filter(p => ['logging', 'logonprovider'].includes(p.type)).map(plugin => (
                            <NavItem
                                key={plugin.id}
                                icon={plugin.type === 'logging' ? Database : Shield}
                                label={plugin.name}
                                disabled
                            />
                        ))}
                    </nav>
                </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky bottom-0">
                <button className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-xs font-bold border border-slate-700 shadow-sm">
                    <Plus className="w-4 h-4 text-sky-400" />
                    Add Extensions
                </button>
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

// --- Mock Authentication ---
const MOCK_USER = {
    name: 'Joe Demo',
    email: 'joe@printcon.enterprise',
    permissions: ['plugin.install', 'plugin.delete', 'debugmode.activate']
};

export default function DashboardPage() {
    const [activePlugin, setActivePlugin] = useState<string | null>('printer-manager');
    const [plugins] = useState<PluginEntry[]>(registryData as PluginEntry[]);
    const [isDebugMode, setIsDebugMode] = useState(false);

    useKonamiCode(() => {
        if (MOCK_USER.permissions.includes('debugmode.activate')) {
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

            if (data?.status === 'failure') {
                toast.error(event, { ...config, icon: <AlertCircle className="w-4 h-4" /> });
                return;
            }

            switch (event) {
                case 'PLUGIN_INSTALLED':
                case 'PLUGIN_PACKED':
                    toast.success(event, { ...config, icon: <PackageCheck className="w-4 h-4" /> });
                    break;
                case 'PLUGIN_DELETED':
                    toast.error(event, { ...config, icon: <PackageX className="w-4 h-4" /> });
                    break;
                case 'PLUGIN_CREATED':
                    toast.message(event, { ...config, icon: <Terminal className="w-4 h-4" /> });
                    break;
                case 'PLUGIN_UNLOCK_CHALLENGE':
                    toast(event, {
                        ...config,
                        description: `Security Challenge: Enter PIN [${data?.pin}] in your terminal.`,
                        icon: <Lock className="w-4 h-4 text-amber-500" />,
                        duration: 30000,
                    });
                    break;
                case 'PLUGIN_LOCKED':
                    toast.info(event, { ...config, icon: <Lock className="w-4 h-4" /> });
                    break;
                case 'PLUGIN_UNLOCKED':
                    toast.success(event, { ...config, icon: <Unlock className="w-4 h-4" /> });
                    break;
                default:
                    toast.info(event, config);
            }
        };

        return () => eventSource.close();
    }, [isDebugMode]);

    return (
        <div className="flex flex-col h-screen w-full bg-slate-900 overflow-hidden">
            <Header />
            <div className="flex flex-1 overflow-hidden relative">
                <Sidebar
                    plugins={plugins}
                    activePlugin={activePlugin}
                    onSelect={setActivePlugin}
                />

                <main className="flex-1 ml-72 overflow-y-auto bg-slate-950 px-12 py-10 custom-scrollbar relative">
                    <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none -z-10"></div>
                    <div className="fixed bottom-0 left-[300px] w-[500px] h-[500px] bg-sky-500/3 rounded-full blur-[120px] pointer-events-none -z-10"></div>

                    <div className="max-w-6xl mx-auto h-full min-h-[500px]">
                        {activePlugin === 'printer-manager' ? (
                            <PrintersView />
                        ) : activePlugin ? (
                            <EmptyState pluginId={activePlugin} plugins={plugins} />
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
                <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 bg-red-500 text-white px-4 py-2 rounded-full font-black text-xs shadow-2xl shadow-red-500/40 animate-pulse border-2 border-white/20">
                    <Bug className="w-4 h-4" />
                    DEBUG MODE ACTIVE
                </div>
            )}

            <Toaster richColors position="top-right" theme="dark" />
        </div>
    );
}
