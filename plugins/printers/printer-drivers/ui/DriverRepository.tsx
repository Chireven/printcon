'use client';



import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, Download, AlertCircle, Loader2, RefreshCw, Database, Factory, Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PrinterDriver } from '../../../../src/core/types/plugin';
import { EventHub } from '../../../../src/core/events';
import { GuardedButton } from '../../../../src/components/ui/GuardedButton';
import { useSettings } from '../../../../src/providers/SettingsProvider';
import { ConfirmationModal } from '../../../../src/components/ui/ConfirmationModal';
import AddDriverModal from './AddDriverModal';
import EditDriverModal from './EditDriverModal';


/**
 * Driver Repository UI
 * 
 * Fetches available drivers via the System Command Gateway (Rule #10 Mock Support).
 */
export default function DriverRepository() {
    const [drivers, setDrivers] = useState<PrinterDriver[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [driverToDelete, setDriverToDelete] = useState<{ id: string, name: string } | null>(null);
    const [driverWithMissingFile, setDriverWithMissingFile] = useState<{ id: string, name: string } | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [driverToEdit, setDriverToEdit] = useState<PrinterDriver | null>(null);
    const { highContrast } = useSettings();

    const handleEdit = (driver: PrinterDriver) => {
        setDriverToEdit(driver);
        setIsEditModalOpen(true);
    };

    const handleSaveDriver = async (updatedDriver: PrinterDriver) => {
        setDrivers(prev => prev.map(d => d.id === updatedDriver.id ? updatedDriver : d));

        try {
            console.log('[UI] Updating driver:', updatedDriver);

            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_UPDATE_DRIVER',
                    pluginId: 'printer-drivers',
                    data: {
                        id: updatedDriver.id,
                        metadata: {
                            displayName: updatedDriver.name,
                            version: updatedDriver.version,
                            vendor: updatedDriver.vendor
                        }
                    }
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Update failed');
            }

            toast.success(`Driver ${updatedDriver.name} saved successfully`);
        } catch (error: any) {
            console.error('Save failed:', error);
            toast.error(`Failed to save: ${error.message}`);
            fetchDrivers();
        }
    };

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

    // ... imports

    const handleDownload = async (driverId: string, driverName?: string) => {
        setDownloading(driverId);
        console.log(`Downloading ${driverId}...`);

        try {
            // Use Event Hub pattern
            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_DOWNLOAD_DRIVER',
                    pluginId: 'printer-drivers',
                    data: {
                        id: driverId,
                        filename: driverName ? `${driverName}.zip` : `${driverId}.zip`
                    }
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Download failed');
            }

            // Decode base64 to binary
            const binaryString = atob(result.buffer);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Create blob and trigger download
            const blob = new Blob([bytes], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('Driver downloaded successfully');
        } catch (e: any) {
            console.error("Download failed", e);
            toast.error(`Download failed: ${e.message}`);
        } finally {
            setTimeout(() => setDownloading(null), 1000);
        }
    };

    const handleRemove = (driverId: string, driverName: string) => {
        setDriverToDelete({ id: driverId, name: driverName });
    };

    const executeDelete = async (forceDbOnly: boolean = false) => {
        if (!driverToDelete) return;
        const driverId = driverToDelete.id;
        const driverName = driverToDelete.name;

        console.log('[DriverRepository] Deleting driver:', { driverId, driverName, forceDbOnly });

        // Close modal
        setDriverToDelete(null);

        try {
            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_DELETE_DRIVER',
                    pluginId: 'printer-drivers',
                    data: {
                        id: driverId,
                        forceDbOnly
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to delete driver');
            }

            const result = await response.json();

            // Handle file missing scenario
            if (!result.success && result.fileMissing) {
                // Show custom modal instead of browser confirm
                setDriverWithMissingFile({ id: driverId, name: driverName });
                return;
            }

            if (!result.success) {
                throw new Error(result.error || 'Delete failed');
            }

            // Show appropriate success message
            if (result.fileMissing) {
                toast.warning(`Driver "${driverName}" removed from repository. Physical file was missing.`);
            } else if (result.fileDeleted === false) {
                toast.warning(`Driver "${driverName}" removed, but the file was preserved (shared by another driver).`);
            } else {
                toast.success(`Driver "${driverName}" deleted successfully`);
            }

            // Refresh list
            fetchDrivers();
        } catch (error: any) {
            console.error('Delete failed:', error);
            toast.error(error.message || 'Failed to delete driver');
        }
    };

    // Helper function to execute force delete
    const executeDeleteForce = async (driverId: string, driverName: string) => {
        try {
            const response = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'REQUEST_DELETE_DRIVER',
                    pluginId: 'printer-drivers',
                    data: {
                        id: driverId,
                        forceDbOnly: true
                    }
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Force delete failed');
            }

            toast.warning(`Driver "${driverName}" removed from repository. Physical file was missing.`);
            fetchDrivers();
        } catch (error: any) {
            console.error('Force delete failed:', error);
            toast.error(error.message || 'Failed to force delete driver');
        }
    };

    const handleAddDriver = (newDriver: any) => {
        // Refresh the list to show the new driver with correct database ID
        fetchDrivers();
    };

    const normalizeVendor = (vendor: string) => {
        if (!vendor) return 'Unknown';
        const v = vendor.toLowerCase().replace(/[^a-z]/g, '');
        if (v === 'hp' || v.includes('hewlett')) return 'HP';
        return vendor;
    };

    const uniqueVendors = new Set(drivers.map(d => normalizeVendor(d.vendor))).size;

    // Emit stats to EventHub for Sidebar usage
    useEffect(() => {
        if (drivers.length > 0) {
            EventHub.emit('plugin:status:update', 'printer-drivers', 'success', {
                rows: [
                    { label: 'Total Drivers', value: drivers.length },
                    { label: 'Manufacturers', value: uniqueVendors }
                ]
            });
        }
    }, [drivers, uniqueVendors]);

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


    return (
        <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-800 relative">

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
                        requiredPermission="driver:upload"
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
                                        requiredPermission="driver:upload"
                                        onClick={() => handleDownload(driver.id, driver.name)}
                                        disabled={downloading === driver.id}
                                        variant="ghost-blue"
                                        className="!w-8 !h-8 !p-0 items-center justify-center flex"
                                        title="Download Driver"
                                    >
                                        {downloading === driver.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Download size={16} className="text-sky-400" />
                                        )}
                                    </GuardedButton>

                                    <GuardedButton
                                        requiredPermission="driver:upload"
                                        onClick={() => handleEdit(driver)}
                                        variant="default"
                                        className="!w-8 !h-8 !p-0 !bg-amber-500/10 !text-amber-400 !border-amber-500/20 hover:!bg-amber-500/20 hover:!border-amber-500/30 hover:shadow-amber-500/10 items-center justify-center flex"
                                        title="Edit Driver"
                                    >
                                        <Pencil size={16} />
                                    </GuardedButton>

                                    <GuardedButton
                                        requiredPermission="driver:remove"
                                        onClick={() => handleRemove(driver.id, driver.name)}
                                        variant="destructive"
                                        className="!w-8 !h-8 !p-0 !bg-red-500/10 !text-red-400 !border-red-500/20 hover:!bg-red-500/20 hover:!border-red-500/30 hover:shadow-red-500/10 items-center justify-center flex"
                                        title="Remove Driver"
                                    >
                                        <Trash2 size={16} />
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

            <EditDriverModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveDriver}
                driver={driverToEdit}
            />

            <ConfirmationModal
                isOpen={!!driverToDelete}
                onClose={() => setDriverToDelete(null)}
                onConfirm={executeDelete}
                title="Delete Driver"
                description={`Are you sure you want to delete ${driverToDelete?.name}? This action cannot be undone.`}
                confirmLabel="Yes, Delete Driver"
                variant="destructive"
            />

            <ConfirmationModal
                isOpen={!!driverWithMissingFile}
                onClose={() => {
                    setDriverWithMissingFile(null);
                    toast.info('Delete cancelled - driver entry preserved');
                }}
                onConfirm={() => {
                    if (driverWithMissingFile) {
                        executeDeleteForce(driverWithMissingFile.id, driverWithMissingFile.name);
                        setDriverWithMissingFile(null);
                    }
                }}
                title="Driver File Missing"
                description={`The driver package file for "${driverWithMissingFile?.name}" is missing from storage. The database entry can still be removed, but the physical driver file cannot be deleted. Do you want to remove the driver entry from the repository anyway?`}
                confirmLabel="Yes, Remove Entry"
                variant="destructive"
            />

        </div>
    );
}
