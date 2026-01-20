import React, { useState, useEffect } from 'react';
import {
    X,
    Printer,
    Search,
    Info,
    FileText,
    HardDrive,
    Shield,
    Cpu,
    Hash,
    Package,
    ChevronRight,
    Loader2,
    Code
} from 'lucide-react';
import { EventHub } from '../../../../src/core/events';

interface DriverModelsModalProps {
    isOpen: boolean;
    onClose: () => void;
    driver: {
        id: string;
        name: string;
        version: string;
        vendor: string;
        os: string;
    };
}

interface DriverDetails {
    name: string;
    version: string;
    date: string;
    provider: string;
    driverClass: 'v3' | 'v4' | 'universal';
    isolation: 'High' | 'Medium' | 'None';
    architectures: string[];
    models: Array<{ modelName: string; hardwareId: string }>;
    files: Array<{ name: string; compressed: boolean; size: number | null; diskId: string }>;
    hardwareIds: string[];
    stats: {
        modelCount: number;
        fileCount: number;
        compressedFileCount: number;
    };
    infContent?: string;
    infFileName?: string;
}

type TabType = 'overview' | 'models' | 'files' | 'hardware' | 'inf';

export default function DriverModelsModal({ isOpen, onClose, driver }: DriverModelsModalProps) {
    const [details, setDetails] = useState<DriverDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && driver) {
            fetchDetails();
        } else {
            setDetails(null);
            setSearchTerm('');
            setActiveTab('overview');
        }
    }, [isOpen, driver]);

    const fetchDetails = () => {
        setLoading(true);

        const handleResponse = (payload: any) => {
            if (payload.packageId === driver.id) {
                if (payload.success) {
                    setDetails(payload.details);
                } else {
                    console.error('Failed to fetch details:', payload.error);
                }
                setLoading(false);
                EventHub.off('RESPONSE_DRIVER_DETAILS', handleResponse);
            }
        };

        EventHub.on('RESPONSE_DRIVER_DETAILS', handleResponse);

        fetch('/api/system/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'REQUEST_DRIVER_DETAILS',
                pluginId: 'printer-drivers',
                data: { packageId: driver.id }
            })
        }).catch(() => {
            setLoading(false);
            EventHub.off('RESPONSE_DRIVER_DETAILS', handleResponse);
        });
    };

    const getDriverClassBadge = (driverClass: string) => {
        const badges = {
            'v4': { color: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Type 4 Driver' },
            'v3': { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', label: 'Type 3 Driver' },
            'universal': { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'Universal Driver' }
        };
        const badge = badges[driverClass as keyof typeof badges] || badges.v3;
        return <span className={`px-2 py-1 rounded text-xs font-semibold border ${badge.color}`}>{badge.label}</span>;
    };

    const getIsolationBadge = (isolation: string) => {
        const badges = {
            'High': { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Shield },
            'Medium': { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: Shield },
            'None': { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: Shield }
        };
        const badge = badges[isolation as keyof typeof badges] || badges.None;
        const Icon = badge.icon;
        return (
            <span className={`px-2 py-1 rounded text-xs font-semibold border ${badge.color} flex items-center gap-1`}>
                <Icon className="w-3 h-3" />
                {isolation} Isolation
            </span>
        );
    };

    // Filter models/hardware based on search
    const filteredModels = details?.models.filter(m =>
        m.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.hardwareId.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const filteredFiles = details?.files.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const filteredHardwareIds = details?.hardwareIds.filter(id =>
        id.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 rounded-t-2xl">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shrink-0">
                            <Package className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-white truncate">
                                {driver.name}
                            </h2>
                            <p className="text-xs text-slate-500 truncate">
                                {driver.vendor} • v{driver.version}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-4 shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-96 gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                        <p className="text-sm text-slate-500 font-medium">Analyzing driver package...</p>
                    </div>
                ) : details ? (
                    <>
                        {/* Tabs */}
                        <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-800 bg-slate-900/30">
                            {[
                                { id: 'overview', label: 'Overview', icon: Info },
                                { id: 'models', label: `Models (${details.stats.modelCount})`, icon: Printer },
                                { id: 'files', label: `Files (${details.stats.fileCount})`, icon: FileText },
                                { id: 'hardware', label: 'Hardware IDs', icon: Cpu },
                                { id: 'inf', label: 'INF File', icon: Code }
                            ].map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as TabType)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === tab.id
                                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search (for Models, Files, Hardware tabs) */}
                        {activeTab !== 'overview' && activeTab !== 'inf' && (
                            <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        placeholder={`Search ${activeTab}...`}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-300 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 placeholder:text-slate-600"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-950/30">
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    {/* Badges */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {getDriverClassBadge(details.driverClass)}
                                        {getIsolationBadge(details.isolation)}
                                        <span className="px-2 py-1 rounded text-xs font-semibold border bg-slate-800/50 text-slate-300 border-slate-700 flex items-center gap-1">
                                            <Cpu className="w-3 h-3" />
                                            {details.architectures.join(', ')}
                                        </span>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-800">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                                                <Printer className="w-3 h-3" />
                                                Supported Models
                                            </div>
                                            <div className="text-2xl font-bold text-white">{details.stats.modelCount}</div>
                                        </div>
                                        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-800">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                                                <FileText className="w-3 h-3" />
                                                Total Files
                                            </div>
                                            <div className="text-2xl font-bold text-white">{details.stats.fileCount}</div>
                                        </div>
                                        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-800">
                                            <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                                                <Package className="w-3 h-3" />
                                                Compressed
                                            </div>
                                            <div className="text-2xl font-bold text-white">{details.stats.compressedFileCount}</div>
                                        </div>
                                    </div>

                                    {/* Metadata */}
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Package Information</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between py-2 border-b border-slate-800/50">
                                                <span className="text-slate-500">Provider:</span>
                                                <span className="text-slate-200 font-mono">{details.provider}</span>
                                            </div>
                                            <div className="flex justify-between py-2 border-b border-slate-800/50">
                                                <span className="text-slate-500">Version:</span>
                                                <span className="text-slate-200 font-mono">{details.version}</span>
                                            </div>
                                            <div className="flex justify-between py-2 border-b border-slate-800/50">
                                                <span className="text-slate-500">Date:</span>
                                                <span className="text-slate-200 font-mono">{details.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'models' && (
                                <div className="space-y-1">
                                    {filteredModels.length > 0 ? filteredModels.map((model, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-lg hover:bg-slate-800/50 border border-transparent hover:border-slate-800 transition-colors group"
                                        >
                                            <div className="flex items-start gap-3">
                                                <Printer className="w-4 h-4 text-slate-600 mt-1 group-hover:text-indigo-400 transition-colors" />
                                                <div>
                                                    <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                                                        {model.modelName}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Hash className="w-3 h-3 text-slate-600" />
                                                        <code className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 group-hover:border-slate-700 group-hover:text-slate-400 transition-colors">
                                                            {model.hardwareId}
                                                        </code>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-12 text-slate-500">No models match your search</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'files' && (
                                <div className="space-y-1">
                                    {filteredFiles.length > 0 ? filteredFiles.map((file, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-lg hover:bg-slate-800/50 border border-transparent hover:border-slate-800 transition-colors group"
                                            title={file.compressed ? 'Compressed file (requires expansion)' : 'Regular file'}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                                    <span className="text-sm text-slate-200 font-mono group-hover:text-white transition-colors">
                                                        {file.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {file.compressed && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                            COMPRESSED
                                                        </span>
                                                    )}
                                                    {file.size && (
                                                        <span className="text-xs text-slate-500 font-mono">
                                                            {(file.size / 1024).toFixed(1)} KB
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-12 text-slate-500">No files match your search</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'hardware' && (
                                <div className="space-y-1">
                                    {filteredHardwareIds.length > 0 ? filteredHardwareIds.map((id, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-lg hover:bg-slate-800/50 border border-transparent hover:border-slate-800 transition-colors group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Hash className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                                <code className="text-sm font-mono text-slate-300 group-hover:text-white transition-colors">
                                                    {id}
                                                </code>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-12 text-slate-500">No hardware IDs match your search</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'inf' && (
                                <div className="h-full flex flex-col">
                                    {/* INF File Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Code className="w-4 h-4 text-indigo-400" />
                                            <span className="text-sm font-mono text-slate-300">
                                                {details.infFileName || 'driver.inf'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-500">
                                            {details.infContent?.split('\n').length || 0} lines
                                        </span>
                                    </div>

                                    {/* Code Editor Container */}
                                    <div className="flex-1 rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
                                        <div className="h-[400px] overflow-auto custom-scrollbar">
                                            <pre className="text-xs font-mono leading-relaxed">
                                                <code className="block">
                                                    {details.infContent?.split('\n').map((line, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="flex hover:bg-slate-800/50 transition-colors"
                                                        >
                                                            <span className="w-12 shrink-0 px-3 py-0.5 text-right text-slate-600 select-none border-r border-slate-800 bg-slate-900/50">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="flex-1 px-4 py-0.5 whitespace-pre text-slate-300">
                                                                {line || ' '}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </code>
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-slate-500">
                        <Info className="w-12 h-12 mb-4" />
                        <p>Failed to load driver details</p>
                    </div>
                )}

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl flex justify-between items-center text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <Info className="w-3 h-3" />
                        <span>Analyzed with INFpossible</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
