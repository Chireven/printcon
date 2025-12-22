
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Activity, Lock, Unlock, Package, Upload, Trash2, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../providers/MockAuthProvider';
import { PluginDeleteModal } from '../ui/PluginDeleteModal';
import { PluginInstallModal } from '../ui/PluginInstallModal';
import { PluginUnlockModal } from '../ui/PluginUnlockModal';

interface PluginConfigContainerProps {
    pluginId: string;
    action?: string | null;
    locked: boolean;
    active: boolean;
    pluginType?: string;
    onDeleteSuccess?: (id: string) => void;
    onStateChange?: () => void;
}

interface PluginManifest {
    id: string;
    name: string;
    version: string;
    type: string;
    ui?: {
        configPage?: string;
    };
}

export const PluginConfigContainer = ({
    pluginId,
    action,
    locked,
    active,
    pluginType,
    onDeleteSuccess,
    onStateChange
}: PluginConfigContainerProps) => {
    const { hasPermission } = useAuth();

    // Core (Infrastructure) Plugins cannot be Updated or Deleted via UI
    const isRestricted = ['databaseProvider', 'storageProvider', 'logonProvider'].includes(pluginType || '');

    // Modal States
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showUpdatePicker, setShowUpdatePicker] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);

    // Dynamic Config Page Loading
    const [ConfigComponent, setConfigComponent] = useState<React.ComponentType<any> | null>(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [configError, setConfigError] = useState<string | null>(null);

    // Load plugin manifest and config page dynamically
    useEffect(() => {
        const loadConfigPage = async () => {
            setIsLoadingConfig(true);
            setConfigError(null);

            try {
                // Fetch plugin registry to get manifest
                const registryRes = await fetch('/api/system/plugins/registry');
                const registry = await registryRes.json();

                const pluginEntry = registry.plugins?.find((p: any) => p.id === pluginId);

                if (!pluginEntry) {
                    throw new Error(`Plugin ${pluginId} not found in registry`);
                }

                // Fetch the actual manifest.json
                const manifestRes = await fetch(`/api/system/plugins/manifest?pluginId=${pluginId}`);
                const manifest: PluginManifest = await manifestRes.json();

                if (manifest.ui?.configPage) {
                    // Dynamically import the config page component
                    const configPath = manifest.ui.configPage.replace('.tsx', '').replace('.ts', '');

                    // Determine plugin directory based on type
                    let pluginDir = '';
                    if (manifest.type === 'databaseProvider') pluginDir = 'databaseProviders';
                    else if (manifest.type === 'storageProvider') pluginDir = 'storageProviders';
                    else if (manifest.type === 'logonProvider') pluginDir = 'logonProviders';
                    else pluginDir = 'printers'; // Default for feature plugins

                    // IMPORTANT: Add .tsx explicitly to prevent Turbopack from scanning .md files
                    const componentPath = `../../../plugins/${pluginDir}/${manifest.id}/${configPath}.tsx`;

                    console.log(`[PluginConfig] Loading config page: ${componentPath}`);

                    // Dynamically import using React.lazy  
                    const LazyComponent = lazy(() => import(/* @vite-ignore */ componentPath));
                    setConfigComponent(() => LazyComponent);
                } else {
                    // No config page defined
                    setConfigComponent(null);
                }
            } catch (e: any) {
                console.error('[PluginConfig] Failed to load config page:', e);
                setConfigError(e.message);
            } finally {
                setIsLoadingConfig(false);
            }
        };

        loadConfigPage();
    }, [pluginId]);

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

            {/* Dynamic Config Page Rendering */}
            {isLoadingConfig ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                </div>
            ) : configError ? (
                <div className="p-12 border-2 border-dashed border-red-800 rounded-xl flex flex-col items-center justify-center text-red-400 bg-red-900/20">
                    <Settings className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-medium">Failed to load configuration</p>
                    <p className="text-xs mt-2 font-mono bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-slate-500">{configError}</p>
                </div>
            ) : ConfigComponent ? (
                <Suspense fallback={
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                    </div>
                }>
                    <ConfigComponent initialAction={action} />
                </Suspense>
            ) : (
                <div className="p-12 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-600 bg-slate-900/20">
                    <Settings className="w-12 h-12 mb-4 opacity-50 animate-spin-slow" />
                    <p className="font-medium">No configuration UI available</p>
                    <p className="text-xs mt-2 font-mono bg-slate-900 px-3 py-1.5 rounded border border-slate-800 text-slate-500">
                        Add "ui.configPage" to manifest.json to enable configuration
                    </p>
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
