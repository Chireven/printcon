'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, Download, Database, CheckCircle2, HardDrive, X } from 'lucide-react';

interface InboxDriver {
    oemInf: string;
    provider: string;
    className: string;
    version: string;
    date: string;
    signerName?: string;
}

interface LocalInboxDriverModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function LocalInboxDriverModal({ open, onClose, onSuccess }: LocalInboxDriverModalProps) {
    const [isOpen, setIsOpen] = useState(open);
    const [drivers, setDrivers] = useState<InboxDriver[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState<InboxDriver | null>(null);
    const [destination, setDestination] = useState<'repository' | 'folder'>('repository');
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        setIsOpen(open);
        if (open) {
            loadInboxDrivers();
        }
    }, [open]);

    const loadInboxDrivers = async () => {
        setLoading(true);
        setDrivers([]);

        try {
            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_LIST_INBOX_DRIVERS',
                    pluginId: 'printer-drivers'
                })
            });

            const result = await response.json();

            if (result.success) {
                setDrivers(result.drivers || []);
            } else {
                throw new Error(result.error || 'Failed to list inbox drivers');
            }
        } catch (err: any) {
            console.error('[LocalInboxDriverModal] Failed to load drivers:', err);
            toast.error(`Failed to load drivers: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExtract = async () => {
        if (!selectedDriver) {
            toast.error('No Driver Selected', {
                description: 'Please select a driver to extract.'
            });
            return;
        }

        setImporting(true);
        try {
            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_EXTRACT_INBOX_DRIVER',
                    pluginId: 'printer-drivers',
                    data: {
                        oemInf: selectedDriver?.oemInf,
                        importToRepository: destination === 'repository',
                        user: 'admin' // TODO: Get from session
                    }
                })
            });

            const result = await response.json();
            if (result.success) {
                if (result.imported) {
                    toast.success('Driver Imported', {
                        description: `${result.displayName} has been added to the repository.`,
                        icon: <CheckCircle2 className="h-5 w-5" />
                    });
                    onSuccess?.();
                } else {
                    toast.success('Driver Exported', {
                        description: `Driver exported to: ${result.exportPath}`,
                        icon: <CheckCircle2 className="h-5 w-5" />
                    });
                }
                onClose();
            } else {
                toast.error('Extraction Failed', {
                    description: result.error || 'Unknown error'
                });
            }
        } catch (error: any) {
            toast.error('Extraction Failed', {
                description: error.message
            });
        } finally {
            setImporting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex flex-col bg-slate-800/50">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <HardDrive className="w-6 h-6 text-indigo-400" />
                                Import Local Inbox Driver
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">
                                Extract printer drivers from local Windows DriverStore
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Action Selection */}
                <div className="p-4 bg-slate-800/30 border-b border-slate-800">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-semibold text-slate-300">Destination:</label>
                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="destination"
                                    value="repository"
                                    checked={destination === 'repository'}
                                    onChange={() => setDestination('repository')}
                                    className="cursor-pointer"
                                />
                                <Database className="h-4 w-4 text-slate-400" />
                                <span className="text-sm text-slate-300">Import to Repository</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="destination"
                                    value="folder"
                                    checked={destination === 'folder'}
                                    onChange={() => setDestination('folder')}
                                    className="cursor-pointer"
                                />
                                <Download className="h-4 w-4 text-slate-400" />
                                <span className="text-sm text-slate-300">Export to Folder</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Driver List */}
                <div className="flex-1 overflow-y-auto mb-6">
                    {loading && drivers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
                            <p className="text-slate-400">Loading installed drivers...</p>
                        </div>
                    ) : drivers.length === 0 ? (
                        <div className="text-center py-12">
                            <HardDrive className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">No printer drivers found in DriverStore</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {drivers.map((driver) => (
                                <div
                                    key={driver.oemInf}
                                    className={`p-4 cursor-pointer hover:bg-slate-800/50 transition-colors ${selectedDriver?.oemInf === driver.oemInf ? 'bg-indigo-500/10 border-l-4 border-indigo-500' : ''
                                        }`}
                                    onClick={() => setSelectedDriver(driver)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-semibold text-sm text-white">
                                                {driver.displayName || driver.provider}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                {driver.provider} • Version: {driver.version} • Date: {driver.date}
                                            </div>
                                            {driver.signerName && (
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Signed by: {driver.signerName}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono">
                                            {driver.oemInf}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={importing}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExtract}
                        disabled={!selectedDriver || importing}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {importing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {destination === 'repository' ? 'Importing...' : 'Exporting...'}
                            </>
                        ) : (
                            <>
                                {destination === 'repository' ? (
                                    <>
                                        <Database className="h-4 w-4" />
                                        Import to Repository
                                    </>
                                ) : (
                                    <>
                                        <Download className="h-4 w-4" />
                                        Export to Folder
                                    </>
                                )}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
