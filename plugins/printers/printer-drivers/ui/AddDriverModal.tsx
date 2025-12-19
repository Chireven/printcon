import React, { useState, useEffect } from 'react';
import {
    X,
    UploadCloud,
    FolderSearch,
    Info,
    Lock,
    PlusCircle,
    CheckCircle2
} from 'lucide-react';
import { FilePicker } from '../../../../src/components/ui/FilePicker';
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

    // Handle Escape Key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({
            name,
            version: '1.0.0', // Default for new upload
            os: 'Windows x64',
            vendor
        });
        onClose();
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
                            src={printerDriverInstallImg.src || printerDriverInstallImg}
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
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 appearance-none cursor-pointer hover:bg-slate-900 transition-colors"
                                                >
                                                    {vendors.map(v => (
                                                        <option key={v} value={v}>{v}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
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
                                            placeholder="e.g. LaserJet Pro"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all placeholder:text-slate-600"
                                            required
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
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                        <Info className="w-3 h-3" />
                                        Folder must contain a valid <code className="bg-slate-800 px-1 py-0.5 rounded text-slate-300">.inf</code> file.
                                    </p>
                                </div>
                            </form>
                        )}

                        {/* Footer - Fixed at bottom */}
                        {!isPickerOpen && (
                            <div
                                className="w-full p-4 border-t border-slate-700 bg-slate-900/80 backdrop-blur-sm flex flex-row items-center gap-3"
                                style={{ display: 'flex', justifyContent: 'flex-end' }}
                            >
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
                                    disabled={!name || !path}
                                    className="px-6 py-2.5 rounded-lg bg-sky-500 text-slate-900 text-sm font-bold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 active:scale-95 transition-all"
                                >
                                    Add Driver
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
