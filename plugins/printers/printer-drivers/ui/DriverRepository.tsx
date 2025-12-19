'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, Download, AlertCircle, Loader2, RefreshCw, Database, Factory } from 'lucide-react';
import { PrinterDriver } from '../../../../src/core/types/plugin';
import { GuardedButton } from '../../../../src/components/ui/GuardedButton';
import { useSettings } from '../../../../src/providers/SettingsProvider';
import AddDriverModal from './AddDriverModal';
import { Plus } from 'lucide-react';

/**
 * Driver Repository UI
 * 
 * Fetches available drivers via the System Command Gateway (Rule #10 Mock Support).
 */
export default function DriverRepository() {
    const [drivers, setDrivers] = useState<PrinterDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [installing, setInstalling] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const { highContrast } = useSettings();

    useEffect(() => {
        fetchDrivers();
    }, []);

    const fetchDrivers = async () => {
        setLoading(true);
        setError(null);

        try {
            // Rule #1: Use the Gateway (Sync-over-Async)
            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_DRIVERS',
                    pluginId: 'printer-drivers' // Fix: Report identity for Toast Log
                })
            });

            if (response.status === 504) {
                throw new Error('Repository Unreachable');
            }

            if (!response.ok) {
                throw new Error(`System Error: ${response.status}`);
            }

            const data = await response.json();
            // The API wrapper returns the data payload directly
            if (data.drivers) {
                setDrivers(data.drivers);
            } else {
                // Fallback if payload structure is flattened or different
                setDrivers([]);
            }

        } catch (err: any) {
            setError(err.message || 'Failed to load drivers');
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = (driverId: string) => {
        setInstalling(driverId);
        console.log(`Installing ${driverId}...`);

        // Mock install delay
        setTimeout(() => {
            setInstalling(null);
            alert(`Driver ${driverId} installed successfully (Mock).`);
        }, 1500);
    };

    const handleAddDriver = (newDriver: any) => {
        // Optimistic UI update
        const driver: PrinterDriver = {
            id: `local-${Date.now()}`,
            name: newDriver.name,
            version: newDriver.version,
            os: newDriver.os
        };
        setDrivers([driver, ...drivers]);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-sky-500" />
                <p>Contacting Driver Repository...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-red-400">
                <AlertCircle className="w-10 h-10 mb-4" />
                <h3 className="text-lg font-bold">Connection Failed</h3>
                <p className="text-sm opacity-80">{error}</p>
                <button
                    onClick={fetchDrivers}
                    className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-white transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    const uniqueVendors = new Set(drivers.filter(d => d.vendor).map(d => d.vendor)).size;

    return (
        <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800 pb-32 relative">

            <div className="flex items-center justify-between mb-6">
                {/* Left: Title */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Package className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Driver Repository</h2>
                        <p className="text-xs text-slate-400">Official Printer Drivers for Windows x64</p>
                    </div>
                </div>


                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchDrivers}
                        className={`p-2 rounded-lg transition-colors ${highContrast
                            ? 'bg-slate-800 text-white border-2 border-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700'
                            }`}
                        title="Refresh Drivers"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <GuardedButton
                        requiredPermission="driver:install"
                        onClick={() => setIsAddModalOpen(true)}
                        className={`p-2 rounded-lg transition-colors shadow-none ${highContrast
                            ? 'bg-slate-800 text-white border-2 border-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700'
                            }`}
                        title="Add New Driver"
                    >
                        <Plus className="w-4 h-4" />
                    </GuardedButton>
                </div>
            </div>

            <div className={`overflow-hidden rounded-lg border border-slate-700/50 mt-8 transition-all ${highContrast ? 'border-white/50 shadow-none' : ''}`}>
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/50 text-slate-400 font-medium">
                        <tr>
                            <th className="px-4 py-3">Driver Name</th>
                            <th className="px-4 py-3">Version</th>
                            <th className="px-4 py-3">Manufacturer</th>
                            <th className="px-4 py-3">OS</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {drivers.map((driver) => (
                            <tr key={driver.id} className="group hover:bg-slate-800/30 transition-colors">
                                <td className="px-4 py-3 text-slate-200 font-medium">{driver.name}</td>
                                <td className="px-4 py-3 text-slate-400">{driver.version}</td>
                                <td className="px-4 py-3 text-slate-400">{driver.vendor}</td>
                                <td className="px-4 py-3 text-slate-500">{driver.os}</td>
                                <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                                    <GuardedButton
                                        requiredPermission="driver:install"
                                        onClick={() => handleInstall(driver.id)}
                                        disabled={installing === driver.id}
                                        variant="primary"
                                        className="text-xs"
                                    >
                                        {installing === driver.id ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                Installing...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-3.5 h-3.5" />
                                                Install
                                            </>
                                        )}
                                    </GuardedButton>

                                    <GuardedButton
                                        requiredPermission="driver:remove"
                                        variant="destructive"
                                        className="text-xs"
                                        title="Remove Driver"
                                    >
                                        Remove
                                    </GuardedButton>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 text-center">
                <p className="text-xs text-slate-500">
                    Showing {drivers.length} available drivers.
                </p>
            </div>

            <AddDriverModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddDriver}
            />

            {/* Floating Stats Bar - Sticky Bottom */}
            {!isAddModalOpen && (
                <div
                    className={`z-[100] bg-slate-900 border rounded-full py-2 px-10 shadow-2xl flex items-center gap-12 ring-1 ring-white/10 ${highContrast ? 'border-white' : 'border-slate-700/50'}`}
                    style={{
                        position: 'sticky',
                        bottom: '24px',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        width: 'fit-content'
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-sky-500/10 rounded-full">
                            <Database className="w-4 h-4 text-sky-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500 leading-tight">Total Drivers</span>
                            <span className="text-sm font-bold text-white leading-none tabular-nums">{drivers.length}</span>
                        </div>
                    </div>

                    {/* Dot Separator */}
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />

                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-violet-500/10 rounded-full">
                            <Factory className="w-4 h-4 text-violet-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-slate-500 leading-tight">Manufacturers</span>
                            <span className="text-sm font-bold text-white leading-none tabular-nums">{uniqueVendors}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
