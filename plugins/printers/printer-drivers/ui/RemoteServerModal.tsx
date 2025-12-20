import React, { useState } from 'react';
import { X, Server, CheckCircle2, AlertCircle, Loader2, Network } from 'lucide-react';
import { toast } from 'sonner';

interface RemoteServerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConnect: (serverName: string) => void;
}

export default function RemoteServerModal({ isOpen, onClose, onConnect }: RemoteServerModalProps) {
    const [serverName, setServerName] = useState('');
    const [status, setStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    const handleTest = async () => {
        if (!serverName.trim()) return;

        setStatus('testing');
        setErrorMsg('');

        try {
            const res = await fetch('/api/system/test-remote-server', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverName: serverName.trim() })
            });
            const data = await res.json();

            if (data.online) {
                setStatus('online');
            } else {
                setStatus('offline');
                setErrorMsg(data.error || 'Server is unreachable');
            }
        } catch (e) {
            setStatus('offline');
            setErrorMsg('Failed to execute connectivity test');
        }
    };

    const handleConnect = () => {
        if (status === 'online') {
            onConnect(serverName.trim());
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg">
                            <Network className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Remote Server</h3>
                            <p className="text-xs text-slate-400">Connect to a remote print server</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                            Server Address
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={serverName}
                                onChange={(e) => {
                                    setServerName(e.target.value);
                                    setStatus('idle');
                                }}
                                placeholder="Hostname or IP (e.g. PRINT01)"
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                            />
                            <button
                                onClick={handleTest}
                                disabled={!serverName || status === 'testing'}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium text-xs transition-colors border border-slate-700 disabled:opacity-50"
                            >
                                {status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Test'}
                            </button>
                        </div>
                    </div>

                    {/* Status Display */}
                    {status !== 'idle' && (
                        <div className={`p-4 rounded-lg flex items-start gap-3 border ${status === 'online'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : status === 'testing'
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                            }`}>
                            {status === 'online' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                            {status === 'offline' && <AlertCircle className="w-5 h-5 shrink-0" />}
                            {status === 'testing' && <Loader2 className="w-5 h-5 shrink-0 animate-spin" />}

                            <div className="text-sm">
                                <p className="font-bold">
                                    {status === 'online' ? 'Connection Successful' : status === 'testing' ? 'Testing Connection...' : 'Connection Failed'}
                                </p>
                                {status === 'offline' && <p className="text-xs opacity-80 mt-1">{errorMsg}</p>}
                                {status === 'online' && <p className="text-xs opacity-80 mt-1">Found reachable server. Ready to browse drivers.</p>}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConnect}
                        disabled={status !== 'online'}
                        className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Connect
                    </button>
                </div>
            </div>
        </div>
    );
}
