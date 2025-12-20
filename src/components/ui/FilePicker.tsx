import React, { useState, useEffect } from 'react';
import {
    Folder,
    File,
    ChevronLeft,
    HardDrive,
    FileCode,
    X,
    Check,
    Loader2,
    AlertCircle
} from 'lucide-react';

interface FileSystemItem {
    name: string;
    type: 'folder' | 'file';
    ext?: string;
    path: string; // Absolute path
}

interface FilePickerProps {
    onSelect: (path: string) => void;
    onCancel: () => void;
    selectionType?: 'folder' | 'file';
}

export const FilePicker: React.FC<FilePickerProps> = ({ onSelect, onCancel, selectionType = 'file' }) => {
    const [currentPath, setCurrentPath] = useState<string>(''); // Empty = Root/Drives
    const [pathStack, setPathStack] = useState<string[]>([]); // History
    const [items, setItems] = useState<FileSystemItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch Content
    useEffect(() => {
        const fetchLevel = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/system/filesystem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: currentPath })
                });
                const data = await res.json();

                if (data.status === 'success') {
                    setItems(data.items);
                } else {
                    setError(data.message);
                }
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLevel();
    }, [currentPath]);

    // Validation
    const hasInf = items.some(i => i.type === 'file' && i.ext === 'inf');
    const isValid = selectionType === 'folder'
        ? currentPath !== '' // Valid if inside a drive/folder (not at drive root options? Actually drives are valid roots, but empty string is root-list)
        : hasInf;

    // For Select Folder button: If we are at root (Drives list), we probably can't select "Root". User must select a drive.
    // If currentPath is empty, we are viewing list of drives. Can't select "System".
    const canSelect = isValid && currentPath !== '';

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);


    const handleNavigate = (item: FileSystemItem) => {
        if (item.type !== 'folder') return;
        setPathStack([...pathStack, currentPath]);
        setCurrentPath(item.path);
    };

    const handleUp = () => {
        if (currentPath === '') return;

        // Complex logic: Going up from "D:\" should go to "" (Drive List).
        // Or we use pathStack history.
        if (pathStack.length > 0) {
            const prev = pathStack[pathStack.length - 1];
            setPathStack(pathStack.slice(0, -1));
            setCurrentPath(prev);
        } else {
            // Fallback
            setCurrentPath('');
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-200 font-medium overflow-hidden">
                    <HardDrive className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="truncate text-xs font-mono">{currentPath || 'My PC'}</span>
                </div>
                <button onClick={onCancel} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Browser */}
            <div className="flex-1 overflow-y-auto p-2">
                {loading ? (
                    <div className="h-full flex items-center justify-center text-sky-500 gap-2">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-sm font-bold">Loading...</span>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center text-red-400 gap-2">
                        <AlertCircle className="w-8 h-8" />
                        <span className="text-sm font-bold">{error}</span>
                        <button onClick={() => setCurrentPath('')} className="bg-slate-800 px-4 py-2 rounded text-xs text-white mt-2">Go to Root</button>
                    </div>
                ) : (
                    <>
                        {/* Up Button */}
                        {currentPath !== '' && (
                            <div
                                onClick={handleUp}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer text-slate-400 hover:text-white transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                <span className="text-sm">.. (Parent Directory)</span>
                            </div>
                        )}

                        {items.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleNavigate(item)}
                                className={`
                                    flex items-center gap-3 p-3 rounded-lg transition-colors
                                    ${item.type === 'folder' ? 'cursor-pointer hover:bg-slate-800 text-slate-200 hover:text-white' : 'text-slate-500 cursor-default'}
                                `}
                            >
                                {item.type === 'folder' ? (
                                    currentPath === '' ? <HardDrive className="w-5 h-5 text-sky-400" /> : <Folder className="w-5 h-5 text-sky-500" />
                                ) : item.ext === 'inf' ? (
                                    <FileCode className="w-5 h-5 text-emerald-500" />
                                ) : (
                                    <File className="w-5 h-5" />
                                )}
                                <span className="text-sm">{item.name}</span>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="bg-slate-800 p-4 border-t border-slate-700 flex justify-between items-center gap-4">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                    {selectionType === 'file' ? (
                        hasInf ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 H-3" /> Valid Driver Found (.inf)
                            </span>
                        ) : (
                            <span className="text-amber-500/80">No .inf file</span>
                        )
                    ) : (
                        <span className="text-sky-400 flex items-center gap-1">
                            {currentPath || 'Select a Drive'}
                        </span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSelect(currentPath)}
                        disabled={!canSelect}
                        className="px-6 py-2 rounded-lg bg-sky-500 text-slate-900 text-xs font-bold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-500/20"
                    >
                        {selectionType === 'folder' ? 'Select Folder' : 'Select Package'}
                    </button>
                </div>
            </div>
        </div>
    );
};
