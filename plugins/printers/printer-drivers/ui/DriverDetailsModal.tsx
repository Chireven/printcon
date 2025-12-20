import React, { useState, useEffect } from 'react';
import { X, Printer, FileText, Loader2, AlertCircle } from 'lucide-react';

interface DriverDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    driverArg: { Name: string, InfPath: string, Version: string, Provider: string } | null;
}

export default function DriverDetailsModal({ isOpen, onClose, driverArg }: DriverDetailsModalProps) {
    const [models, setModels] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && driverArg) {
            fetchDetails(driverArg.InfPath);
        } else {
            setModels([]);
            setError(null);
        }
    }, [isOpen, driverArg]);

    const fetchDetails = async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/system/drivers-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ infPath: path })
            });
            const data = await res.json();
            if (data.models) {
                setModels(data.models);
            } else {
                throw new Error(data.message || 'Failed to parse INF');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !driverArg) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-[500px] max-h-[70vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                    <div className="mr-4 overflow-hidden">
                        <h3 className="text-md font-bold text-white truncate" title={(!loading && models.length === 1) ? models[0] : driverArg.Name}>
                            {(!loading && models.length === 1) ? models[0] : driverArg.Name}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono truncate">{driverArg.Provider} • v{driverArg.Version}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-950/50">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Parsing INF...
                        </div>
                    ) : error ? (
                        <div className="flex items-center gap-2 text-red-400 text-sm p-4 bg-red-500/10 rounded border border-red-500/20">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Printer className="w-3 h-3" /> Supported Models ({models.length})
                            </h4>
                            {models.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No models found in INF.</p>
                            ) : (
                                <ul className="space-y-1">
                                    {models.map((m, i) => (
                                        <li key={i} className="text-sm text-slate-300 py-1 border-b border-slate-800/50 last:border-0 pl-2 hover:bg-slate-800/50 rounded-sm">
                                            {m}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-3 bg-slate-900 border-t border-slate-800 flex justify-end">
                    <button onClick={onClose} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded transition-colors border border-slate-700">Close</button>
                </div>
            </div>
        </div>
    );
}
