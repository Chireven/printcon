
import React, { useState, useEffect } from 'react';
import {
    X,
    Save,
    RotateCcw,
    CheckCircle2,
    Lock,
    Cpu,
    HardDrive,
    AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { PrinterDriver } from '../../../../src/core/types/plugin';
import printerDriverInstallImg from '../assets/printer-driverinstall.png';
import { Button } from '../../../../src/components/ui/Button';

interface EditDriverModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedDriver: PrinterDriver) => Promise<void>;
    driver: PrinterDriver | null;
}

const DEFAULT_VENDORS = ['HP', 'Canon', 'Epson', 'Brother', 'Kyocera', 'Xerox'];

export default function EditDriverModal({ isOpen, onClose, onSave, driver }: EditDriverModalProps) {
    const [name, setName] = useState('');
    const [vendor, setVendor] = useState('');
    const [version, setVersion] = useState('');
    const [os, setOs] = useState('Windows x64');
    const [customVendor, setCustomVendor] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize state from driver prop
    useEffect(() => {
        if (driver) {
            setName(driver.name);
            setVendor(driver.vendor || 'Unknown');
            setVersion(driver.version);
            setOs(driver.os);

            // Check if vendor is in default list
            if (driver.vendor && !DEFAULT_VENDORS.includes(driver.vendor)) {
                setCustomVendor(true);
            } else {
                setCustomVendor(false);
            }

            setHasChanges(false);
        }
    }, [driver, isOpen]);

    // Handle Escape Key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSaving) onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, isSaving]);

    // Track changes
    useEffect(() => {
        if (!driver) return;
        const changed =
            name !== driver.name ||
            vendor !== driver.vendor ||
            version !== driver.version ||
            os !== driver.os;
        setHasChanges(changed);
    }, [name, vendor, version, os, driver]);

    if (!isOpen || !driver) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !vendor || !version) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSaving(true);
        try {
            await onSave({
                ...driver,
                name,
                vendor,
                version,
                os
            });
            onClose();
        } catch (error: any) {
            toast.error('Failed to save changes', { description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div style={{ width: '60vw', minWidth: '800px' }} className="bg-slate-900 border border-amber-500/20 rounded-xl shadow-2xl relative flex flex-col max-h-[90vh] resize overflow-hidden">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute z-50 text-slate-400 hover:text-white transition-colors"
                    style={{ top: '16px', right: '16px' }}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-row h-full">
                    {/* Left: Image Placeholder with "Maintenance" styling */}
                    <div className="w-[300px] bg-slate-950 flex items-center justify-center border-r border-slate-800 relative overflow-hidden shrink-0 group">

                        {/* Background effect */}
                        <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors duration-500" />
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />

                        {/* Status Badge */}
                        <div className="absolute top-4 left-4 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold border border-amber-500/30 flex items-center gap-2 backdrop-blur-md z-20">
                            <RotateCcw className="w-3 h-3 animate-spin-slow" />
                            EDIT MODE
                        </div>

                        <img
                            src={(printerDriverInstallImg as any).src || printerDriverInstallImg}
                            alt="Driver Maintenance"
                            className="relative z-10 max-w-[85%] max-h-[85%] object-contain drop-shadow-2xl grayscale sepia-[.5] brightness-90 contrast-125 transition-all duration-700 group-hover:scale-105"
                        />

                        {/* Tech details overlay */}
                        <div className="absolute bottom-6 left-6 right-6 space-y-2 z-20">
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono uppercase">
                                <span>Pkg ID:</span>
                                <span className="text-slate-400">{driver.id.substring(0, 8)}...</span>
                            </div>
                            <div className="h-0.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full w-2/3 bg-amber-500/50 animate-pulse" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-slate-900">
                        <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-3">
                                <span className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                                    <Cpu className="w-5 h-5" />
                                </span>
                                Edit Driver Details
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 ml-11">
                                Update metadata for <span className="text-slate-300 font-medium">{driver.name}</span>
                            </p>
                        </div>

                        <form id="edit-driver-form" onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-6">
                                {/* Vendor */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex justify-between">
                                        Vendor
                                        <button
                                            type="button"
                                            onClick={() => setCustomVendor(!customVendor)}
                                            className="text-amber-500 hover:text-amber-400 text-[10px]"
                                        >
                                            {customVendor ? 'Select from List' : 'Custom'}
                                        </button>
                                    </label>
                                    {customVendor ? (
                                        <input
                                            type="text"
                                            value={vendor}
                                            onChange={(e) => setVendor(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                                            placeholder="Enter Vendor Name"
                                        />
                                    ) : (
                                        <select
                                            value={vendor}
                                            onChange={(e) => setVendor(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors appearance-none"
                                        >
                                            {DEFAULT_VENDORS.map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* OS */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                        Operating System
                                    </label>
                                    <input
                                        type="text"
                                        value={os}
                                        onChange={(e) => setOs(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Driver Name (Full Width) */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                    Driver Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors font-medium"
                                />
                            </div>

                            {/* Version and Class */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                        Version
                                    </label>
                                    <input
                                        type="text"
                                        value={version}
                                        onChange={(e) => setVersion(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-colors font-mono"
                                    />
                                </div>
                                <div className="space-y-2 opacity-60 pointer-events-none">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                                        Driver Class
                                        <Lock className="w-3 h-3" />
                                    </label>
                                    <input
                                        type="text"
                                        value="Version 4 (v4)"
                                        readOnly
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-500"
                                    />
                                </div>
                            </div>

                            {/* Read-Only Files Section */}
                            <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-4 mt-2">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                                        <HardDrive className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-medium text-slate-300 flex items-center justify-between">
                                            Driver Package Details
                                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">READ ONLY</span>
                                        </h4>
                                        <p className="text-xs text-slate-500 mt-1">
                                            The underlying driver files (.inf, .sys, .cat) cannot be modified directly to ensure code signing integrity. To update files, upload a new version.
                                        </p>
                                        <div className="mt-3 flex items-center gap-2 text-xs font-mono text-slate-600 bg-slate-950 py-1.5 px-3 rounded border border-slate-900/50">
                                            <span>SHA-256:</span>
                                            <span className="truncate">{driver.id}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm flex justify-between items-center">
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                {hasChanges ? (
                                    <span className="text-amber-500 flex items-center gap-1.5 animate-pulse">
                                        <AlertTriangle className="w-3 h-3" />
                                        Unsaved changes
                                    </span>
                                ) : (
                                    <span>No changes made</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <Button
                                    type="submit"
                                    form="edit-driver-form"
                                    disabled={!hasChanges || isSaving}
                                    variant="gold"
                                    size="md"
                                    icon={Save}
                                    loading={isSaving}
                                >
                                    {isSaving ? 'Updating...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
