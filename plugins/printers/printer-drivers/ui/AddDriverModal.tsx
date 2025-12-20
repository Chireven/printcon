import React, { useState, useEffect } from 'react';
import {
    X,
    UploadCloud,
    Download,
    FolderSearch,
    Info,
    Lock,
    PlusCircle,
    CheckCircle2,
    Network,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { FilePicker } from '../../../../src/components/ui/FilePicker';
import InboxDriverModal from './InboxDriverModal';
import RemoteServerModal from './RemoteServerModal';
import printerDriverInstallImg from '../assets/printer-driverinstall.png';

interface AddDriverModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (driver: any) => void;
}

const DEFAULT_VENDORS = ['HP', 'Canon', 'Epson', 'Brother', 'Kyocera', 'Xerox'];

export default function AddDriverModal({ isOpen, onClose, onAdd }: AddDriverModalProps) {
    const [name, setName] = useState('');
    const [vendor, setVendor] = useState(DEFAULT_VENDORS[0]);
    const [vendors, setVendors] = useState(DEFAULT_VENDORS);
    const [path, setPath] = useState('');
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [isNewVendorMode, setIsNewVendorMode] = useState(false);
    const [newVendorName, setNewVendorName] = useState('');
    const [isInboxOpen, setIsInboxOpen] = useState(false);
    const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
    const [remoteServerName, setRemoteServerName] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // INF Validation State
    const [isValidInf, setIsValidInf] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Handle Escape Key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            // Only close if Picker is NOT open AND Inbox is NOT open
            if (e.key === 'Escape' && !isPickerOpen && !isInboxOpen) onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, isPickerOpen, isInboxOpen]);

    // Validate INF path whenever it changes
    useEffect(() => {
        const validatePath = async () => {
            if (!path) {
                setIsValidInf(false);
                setValidationError(null);
                setName('');
                setVendor(DEFAULT_VENDORS[0]);
                return;
            }

            setIsValidating(true);
            setValidationError(null);

            try {
                const response = await fetch('/api/validate-inf-path', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: path })
                });

                const result = await response.json();

                if (result.valid) {
                    setIsValidInf(true);
                    setValidationError(null);
                    // Auto-set name from path as placeholder (will be overwritten by manifest)
                    const folderName = path.split('\\').pop() || 'Driver';
                    setName(folderName);
                } else {
                    setIsValidInf(false);
                    setValidationError(result.error || 'Invalid INF path');
                    setName('');
                }
            } catch (error: any) {
                setIsValidInf(false);
                setValidationError(error.message || 'Validation failed');
                setName('');
            } finally {
                setIsValidating(false);
            }
        };

        validatePath();
    }, [path]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!path || !isValidInf) {
            toast.error('Please select a valid driver folder with INF file');
            return;
        }

        setIsUploading(true);
        const toastId = toast.loading('Building .pd package from INF folder...');

        try {
            // Build and upload .pd package from INF folder
            const response = await fetch('/api/build-pd-package', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourcePath: path,
                    user: 'admin' // TODO: Get from auth context
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Package build failed');
            }

            const result = await response.json();

            toast.dismiss(toastId);
            toast.success('Driver package created successfully', {
                description: `${result.manifest.displayName} v${result.manifest.version} - ${result.manifest.supportedModels} models`
            });

            // Call onAdd to refresh the list
            onAdd({
                name: result.manifest.displayName,
                version: result.manifest.version,
                os: 'Windows',
                vendor: vendor
            });

            onClose();
        } catch (error: any) {
            toast.dismiss(toastId);
            toast.error('Package build failed', {
                description: error.message || 'An unknown error occurred'
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddVendor = () => {
        if (newVendorName.trim()) {
            setVendors([...vendors, newVendorName].sort());
            setVendor(newVendorName);
            setIsNewVendorMode(false);
            setNewVendorName('');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div style={{ width: '60vw', minWidth: '800px' }} className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl relative flex flex-col max-h-[90vh] resize overflow-hidden">

                {/* Close Button (Hidden if Picker is Open to prevent accidental close) */}
                {!isPickerOpen && (
                    <button
                        onClick={onClose}
                        className="absolute z-50 text-slate-400 hover:text-white transition-colors"
                        style={{ top: '16px', right: '16px' }}
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                <div className="flex flex-row h-full">
                    {/* Left: Image Placeholder */}
                    <div className="w-[300px] bg-slate-800 flex items-center justify-center border-r border-slate-700 relative overflow-hidden shrink-0">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />
                        <img
                            src={(printerDriverInstallImg as any).src || printerDriverInstallImg}
                            alt="Driver Installation"
                            className="relative z-10 max-w-[90%] max-h-[90%] object-contain drop-shadow-lg"
                        />
                    </div>

                    <div className="flex-1 flex flex-col">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-lg font-bold text-white">Upload New Driver</h3>
                            <p className="text-xs text-slate-500">Add a new device to the repository</p>
                        </div>

                        {isPickerOpen ? (
                            <div className="p-6 flex-1 bg-slate-950/30">
                                <FilePicker
                                    onSelect={(selectedPath) => {
                                        setPath(selectedPath);
                                        setIsPickerOpen(false);
                                    }}
                                    onCancel={() => setIsPickerOpen(false)}
                                />
                            </div>
                        ) : (
                            <form id="add-driver-form" onSubmit={handleSubmit} className="p-6 space-y-6 flex-1 overflow-y-auto">
                                <div className="flex gap-4">
                                    {/* Vendor Selection (First - 35%) */}
                                    <div className="w-1/2 space-y-2">
                                        <label className="h-5 flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wide">
                                            <span>Vendor</span>
                                            {!isNewVendorMode && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsNewVendorMode(true)}
                                                    className="text-sky-500 hover:text-sky-400 flex items-center gap-1 text-[10px]"
                                                >
                                                    <PlusCircle className="w-3 h-3" /> New
                                                </button>
                                            )}
                                        </label>

                                        {isNewVendorMode ? (
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newVendorName}
                                                    onChange={(e) => setNewVendorName(e.target.value)}
                                                    placeholder="Vendor Name"
                                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 min-w-0"
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddVendor}
                                                    className="bg-sky-500 text-slate-900 px-2 py-2 rounded-lg hover:bg-sky-400 shrink-0 flex items-center justify-center"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsNewVendorMode(false)}
                                                    className="bg-slate-800 text-slate-400 px-2 py-2 rounded-lg hover:text-white shrink-0 flex items-center justify-center"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <select
                                                    value={vendor}
                                                    onChange={(e) => setVendor(e.target.value)}
                                                    disabled
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2.5 text-sm text-slate-500 focus:outline-none appearance-none cursor-not-allowed opacity-60"
                                                >
                                                    {vendors.map(v => (
                                                        <option key={v} value={v}>{v}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
                                                    <Lock className="w-3 h-3" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Driver Name (Second - Flex Fill) */}
                                    <div className="flex-1 space-y-2">
                                        <label className="h-5 flex items-center text-xs font-bold text-slate-400 uppercase tracking-wide">
                                            Driver Name
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Auto-detected from INF"
                                            disabled
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-500 focus:outline-none cursor-not-allowed opacity-60 placeholder:text-slate-600"
                                        />
                                    </div>
                                </div>

                                {/* Driver Path */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                        Source Path (Folder)
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-400 flex items-center gap-2 overflow-hidden">
                                            <FolderSearch className="w-4 h-4 text-slate-600 shrink-0" />
                                            <span className={path ? 'text-emerald-400' : 'text-slate-600 italic'}>
                                                {path || 'No folder selected'}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsPickerOpen(true)}
                                            className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-sm transition-colors border border-slate-700"
                                        >
                                            Browse...
                                        </button>
                                    </div>
                                    {isValidating && (
                                        <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Validating INF file...
                                        </p>
                                    )}
                                    {!isValidating && isValidInf && (
                                        <p className="text-[10px] text-emerald-400 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Valid printer driver INF detected
                                        </p>
                                    )}
                                    {!isValidating && validationError && (
                                        <p className="text-[10px] text-red-400 flex items-center gap-1.5">
                                            <X className="w-3 h-3" />
                                            {validationError}
                                        </p>
                                    )}
                                    {!path && (
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                            <Info className="w-3 h-3" />
                                            Folder must contain a valid <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">.inf</code> file.
                                        </p>
                                    )}
                                </div>
                            </form>
                        )}

                        {/* Footer - Fixed at bottom */}
                        {!isPickerOpen && (
                            <div
                                className="w-full p-4 border-t border-slate-700 bg-slate-900/80 backdrop-blur-sm flex flex-row items-center justify-between gap-3"
                            >
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsInboxOpen(true)}
                                        className="px-4 py-2.5 rounded-lg text-sm font-medium text-indigo-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 border border-slate-700/50 hover:border-indigo-500/50"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export Server Driver
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsRemoteModalOpen(true)}
                                        className="p-2.5 rounded-lg text-indigo-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700/50 hover:border-indigo-500/50"
                                        title="Connect to Remote Server"
                                    >
                                        <Network className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        form="add-driver-form"
                                        disabled={!path || !isValidInf || isUploading || isValidating}
                                        className="px-6 py-2.5 rounded-lg bg-sky-500 text-slate-900 text-sm font-bold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Building Package...
                                            </>
                                        ) : isValidating ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Validating...
                                            </>
                                        ) : (
                                            'Add Driver'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        <InboxDriverModal
                            isOpen={isInboxOpen}
                            onClose={() => setIsInboxOpen(false)}
                            serverName={remoteServerName}
                        />

                        <RemoteServerModal
                            isOpen={isRemoteModalOpen}
                            onClose={() => setIsRemoteModalOpen(false)}
                            onConnect={(serverName) => {
                                setRemoteServerName(serverName);
                                setIsRemoteModalOpen(false);
                                setIsInboxOpen(true);
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
