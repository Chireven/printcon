import React, { useState, useEffect } from 'react';
import {
    X,
    Printer,
    Search,
    Cpu,
    Hash,
    Info
} from 'lucide-react';
import { EventHub } from '../../../../src/core/events';

interface DriverModelsModalProps {
    isOpen: boolean;
    onClose: () => void;
    driver: {
        id: string; // This is the PackageId (string/hash) or Database ID? Usually DB ID in UI list
        // Wait, in DriverRepository.tsx list, 'id' is usually the DB ID.
        // Let's verify what `driver` object passes.
        // Assuming it matches the list item from DriverRepository.
        name: string;
        version: string;
        vendor: string;
        os: string;
    };
}

interface ModelEntry {
    modelName: string;
    hardwareId: string;
}

export default function DriverModelsModal({ isOpen, onClose, driver }: DriverModelsModalProps) {
    const [models, setModels] = useState<ModelEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && driver) {
            fetchModels();
        } else {
            setModels([]);
            setSearchTerm('');
        }
    }, [isOpen, driver]);

    const fetchModels = () => {
        setLoading(true);

        // Subscribe to response
        const handleResponse = (payload: any) => {
            if (payload.packageId === driver.id) { // Match by ID
                if (payload.success) {
                    setModels(payload.models);
                } else {
                    console.error('Failed to fetch models:', payload.error);
                }
                setLoading(false);
                EventHub.off('RESPONSE_DRIVER_MODELS', handleResponse);
            }
        };

        EventHub.on('RESPONSE_DRIVER_MODELS', handleResponse);

        // Send request
        fetch('/api/system/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'REQUEST_DRIVER_MODELS',
                pluginId: 'printer-drivers',
                data: { packageId: driver.id }
            })
        }).catch(() => {
            setLoading(false);
            EventHub.off('RESPONSE_DRIVER_MODELS', handleResponse);
        });
    };

    // Filter models
    const filteredModels = models.filter(m =>
        m.modelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.hardwareId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <Printer className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                Supported Models
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700">
                                    {models.length}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500">
                                {driver.name} <span className="text-slate-600">•</span> {driver.version}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/30 flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search models or hardware IDs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-1.5 pl-9 pr-4 text-sm text-slate-300 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 placeholder:text-slate-600"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-[300px] p-2 custom-scrollbar bg-slate-950/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3">
                            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-slate-500 font-medium">Loading hardware definitions...</p>
                        </div>
                    ) : filteredModels.length > 0 ? (
                        <div className="space-y-1">
                            {filteredModels.map((model, idx) => (
                                <div
                                    key={idx}
                                    className="p-3 rounded-lg hover:bg-slate-800/50 border border-transparent hover:border-slate-800 transition-colors group"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <Printer className="w-4 h-4 text-slate-600 mt-1 group-hover:text-purple-400 transition-colors" />
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
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
                            <Search className="w-8 h-8 text-slate-600 mb-2" />
                            <p className="font-medium">No models found</p>
                            <p className="text-xs">Try adjusting your search terms</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl flex justify-between items-center text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <Info className="w-3 h-3" />
                        <span>Hardware IDs represent PnP signatures from the driver INF</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
