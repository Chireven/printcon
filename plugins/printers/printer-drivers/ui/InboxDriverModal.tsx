import React, { useState, useEffect } from 'react';
import { X, Download, Server, Loader2, HardDrive, Database, Info } from 'lucide-react';
import { toast } from 'sonner';
import DriverDetailsModal from './DriverDetailsModal';

interface InboxDriverModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverName?: string | null;
}

interface ServerDriver {
    Name: string;
    Version: string;
    Provider: string;
    Source: 'Spooler' | 'DriverStore' | 'Spooler & Store';
    InfPath: string;
    ModelCount: number;
}

export default function InboxDriverModal({ isOpen, onClose, serverName }: InboxDriverModalProps) {
    const [drivers, setDrivers] = useState<ServerDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState('Initializing system link...');
    const [exporting, setExporting] = useState<string | null>(null);
    const [detailsDriver, setDetailsDriver] = useState<ServerDriver | null>(null);

    // Fetch
    useEffect(() => {
        if (isOpen) fetchDrivers();
    }, [isOpen]);

    // Handle Escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (detailsDriver) {
                    setDetailsDriver(null);
                } else {
                    onClose();
                }
            }
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, detailsDriver]);

    const fetchDrivers = async () => {
        setLoading(true);

        // Rotating messages
        const messages = [
            'Querying Registry for Print Spooler drivers...',
            'Accessing Windows Driver Store...',
            'Enumerating Driver Packages (this can take 10-20 seconds)...',
            'Filtering for Printer Class drivers...',
            'Cross-referencing Spooler and Store data...',
            'Finalizing driver list...'
        ];
        let msgIndex = 0;
        setLoadingMsg(messages[0]);

        const interval = setInterval(() => {
            msgIndex = (msgIndex + 1) % messages.length;
            if (msgIndex < messages.length) setLoadingMsg(messages[msgIndex]);
        }, 3000);

        try {
            const url = serverName
                ? `/api/system/drivers-inbox?serverName=${encodeURIComponent(serverName)}`
                : '/api/system/drivers-inbox';
            const res = await fetch(url);
            const data = await res.json();
            if (data.files) {
                setDrivers(data.files);
            }
        } catch (e) {
            toast.error('Failed to load server drivers');
        } finally {
            clearInterval(interval);
            setLoading(false);
        }
    };

    const handleExport = async (driver: ServerDriver) => {
        setExporting(driver.InfPath);
        const toastId = toast.loading('Packaging driver...');
        try {
            const res = await fetch('/api/system/drivers-export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    infPath: driver.InfPath,
                    name: driver.Name,
                    serverName: serverName || undefined
                })
            });

            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${driver.Name.replace(/[^a-z0-9]/gi, '_')}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.dismiss(toastId);
            toast.success('Download Complete', {
                description: `Successfully exported ${driver.Name}`,
                action: {
                    label: 'OK',
                    onClick: () => { } // Logic implies staying in modal
                }
            });
        } catch (e) {
            toast.dismiss(toastId);
            toast.error('Export Failed');
        } finally {
            setExporting(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Server className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                {serverName ? `Drivers from ${serverName}` : 'Inbox Server Drivers'}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {serverName ? `Remote print server drivers` : `Export drivers installed on this server`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-0">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-500 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                            <p className="text-sm animate-pulse font-medium">{loadingMsg}</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-slate-950 text-slate-400 font-medium sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3">Driver Name</th>
                                    <th className="px-6 py-3">Models</th>
                                    <th className="px-6 py-3">Version</th>
                                    <th className="px-6 py-3">Provider</th>
                                    <th className="px-6 py-3">Source</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {drivers.map((d, i) => (
                                    <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-3 text-slate-200 font-medium">{d.Name}</td>
                                        <td className="px-6 py-3 text-slate-400 font-mono text-center">
                                            <span className="px-2 py-0.5 bg-slate-800 rounded text-xs">{d.ModelCount}</span>
                                        </td>
                                        <td className="px-6 py-3 text-slate-500 font-mono text-xs">{d.Version}</td>
                                        <td className="px-6 py-3 text-slate-400">{d.Provider}</td>
                                        <td className="px-6 py-3">
                                            <button
                                                onClick={() => setDetailsDriver(d)}
                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors hover:brightness-110 cursor-pointer ${d.Source.includes('Spooler') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700'
                                                    }`}
                                                title="Click to view supported models"
                                            >
                                                {d.Source.includes('Spooler') ? <Database className="w-3 h-3" /> : <HardDrive className="w-3 h-3" />}
                                                {d.Source}
                                            </button>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => handleExport(d)}
                                                disabled={!!exporting}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs font-medium border border-slate-700 hover:border-slate-600 disabled:opacity-50"
                                            >
                                                {exporting === d.InfPath ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                                {exporting === d.InfPath ? 'Zipping...' : 'Export'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        <span>Drivers will be zipped and downloaded to your local machine.</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors">Close</button>
                    </div>
                </div>
            </div>

            <DriverDetailsModal
                isOpen={!!detailsDriver}
                onClose={() => setDetailsDriver(null)}
                driverArg={detailsDriver}
            />
        </div>
    );
}
