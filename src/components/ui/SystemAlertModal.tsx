'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SystemEvent {
    id: string;
    type: string;
    status: 'success' | 'failure';
    data?: any;
}

import { useAuth } from '../../providers/MockAuthProvider';

export function SystemAlertModal({ onFix }: { onFix?: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [failingPlugins, setFailingPlugins] = useState<string[]>([]);
    const { hasPermission } = useAuth();

    useEffect(() => {
        const eventSource = new EventSource('/api/system/events');

        eventSource.onopen = () => {
            console.log('[SystemAlertModal] Connected to SSE');
        };

        // Check for existing alerts (Initial Sync)
        fetch('/api/system/status')
            .then(res => res.json())
            .then(statusMap => {
                const failures: string[] = [];
                Object.entries(statusMap).forEach(([pluginId, statuses]: [string, any]) => {
                    const schemaError = statuses.find((s: any) =>
                        s.severity === 'error' && (s.value === 'Schema Mismatch' || s.label === 'Database')
                    );
                    if (schemaError) {
                        failures.push(pluginId);
                    }
                });

                // Deduping logic
                if (failures.length > 0) {
                    setFailingPlugins(prev => Array.from(new Set([...prev, ...failures])));
                    setIsOpen(true);
                }
            })
            .catch(err => console.error('[SystemAlertModal] Failed to sync status:', err));

        eventSource.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);

                // Check for SYSTEM_ALERT type
                if (parsed.event === 'SYSTEM_ALERT' && parsed.data?.status === 'failure') {
                    // Check if it's a schema mismatch or critically relevant
                    if (parsed.data.title?.includes('Schema') || parsed.data.message?.includes('Schema')) {
                        const pid = parsed.data.pluginId; // Assuming pluginId is passed in data usually
                        // In previous step we passed pluginId in data.
                        if (pid) {
                            setFailingPlugins(prev => {
                                const next = Array.from(new Set([...prev, pid]));
                                // Only re-open if this is a NEW failure we haven't seen yet
                                if (!prev.includes(pid)) {
                                    setIsOpen(true);
                                }
                                return next;
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('[SystemAlertModal] Parse error:', e);
            }
        };

        return () => {
            eventSource.close();
        };
    }, []);

    if (!isOpen || failingPlugins.length === 0) return null;

    const canFix = hasPermission('system.database.upgrade');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-lg transform overflow-hidden rounded-xl bg-slate-950 border border-slate-800 shadow-2xl transition-all animate-in fade-in zoom-in duration-300">

                {/* Header / Accent */}
                <div className="h-1 lg:h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-500 to-red-600" />

                <div className="p-6 md:p-8">
                    <div className="flex items-start gap-5">
                        {/* Icon */}
                        <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full bg-red-950/30 border border-red-900/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-6 w-6 text-red-500"
                            >
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                            </svg>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-slate-100 tracking-tight mb-1">
                                Database Schema Mismatch
                            </h3>
                            <p className="text-xs font-medium text-red-500 uppercase tracking-wider mb-3">
                                {failingPlugins.length} Plugin{failingPlugins.length > 1 ? 's' : ''} Affected
                            </p>

                            <p className="text-sm text-slate-400 leading-relaxed mb-4">
                                The following plugins have detected inconsistencies between their code definitions and the database schema.
                                This must be resolved to ensure data integrity.
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {failingPlugins.map(pid => (
                                    <div key={pid} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        <span className="text-xs font-mono font-medium text-slate-300">
                                            {pid}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-8 flex justify-end gap-3">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400/20 rounded-lg"
                        >
                            Dismiss
                        </button>
                        {canFix && (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    if (onFix) onFix();
                                }}
                                className="group relative inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white transition-all duration-200 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg hover:from-red-500 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 focus:ring-offset-slate-950 shadow-lg shadow-red-900/20"
                            >
                                <span className="mr-2">Fix All Schemas</span>
                                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
