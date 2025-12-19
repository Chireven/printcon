import React, { useState, useEffect } from 'react';
import {
    Folder,
    File,
    ChevronLeft,
    HardDrive,
    FileCode,
    X,
    Check
} from 'lucide-react';

interface FileSystemItem {
    name: string;
    type: 'folder' | 'file';
    children?: FileSystemItem[]; // For folders
    ext?: string; // For files
}

// Mock File System Structure
const MOCK_FS: FileSystemItem = {
    name: 'D:',
    type: 'folder',
    children: [
        {
            name: 'Drivers',
            type: 'folder',
            children: [
                {
                    name: 'HP_Universal_v6',
                    type: 'folder',
                    children: [
                        { name: 'hp_universal.inf', type: 'file', ext: 'inf' },
                        { name: 'hp_print.dll', type: 'file', ext: 'dll' },
                        { name: 'readme.txt', type: 'file', ext: 'txt' }
                    ]
                },
                {
                    name: 'Canon_Generic_Plus',
                    type: 'folder',
                    children: [
                        { name: 'canon_ufr.inf', type: 'file', ext: 'inf' },
                        { name: 'setup.exe', type: 'file', ext: 'exe' }
                    ]
                },
                {
                    name: 'Brother_Series',
                    type: 'folder',
                    children: [
                        { name: 'br_hll2350.inf', type: 'file', ext: 'inf' }
                    ]
                },
                {
                    name: 'Downloads',
                    type: 'folder',
                    children: [
                        { name: 'installer.msi', type: 'file', ext: 'msi' }
                    ]
                }
            ]
        },
        {
            name: 'System',
            type: 'folder',
            children: []
        }
    ]
};

interface FilePickerProps {
    onSelect: (path: string) => void;
    onCancel: () => void;
}

export const FilePicker: React.FC<FilePickerProps> = ({ onSelect, onCancel }) => {
    // Current navigation stack (path)
    const [pathStack, setPathStack] = useState<FileSystemItem[]>([MOCK_FS]);
    const [currentFolder, setCurrentFolder] = useState<FileSystemItem>(MOCK_FS);

    // Derived state
    const currentPathString = pathStack.map(item => item.name).join('\\');

    // Check if the current folder is valid for selection (contains .inf)
    const hasInf = currentFolder.children?.some(child => child.type === 'file' && child.ext === 'inf') || false;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);

    const handleNavigate = (folder: FileSystemItem) => {
        if (folder.type !== 'folder') return;
        setPathStack([...pathStack, folder]);
        setCurrentFolder(folder);
    };

    const handleUp = () => {
        if (pathStack.length <= 1) return;
        const newStack = pathStack.slice(0, -1);
        setPathStack(newStack);
        setCurrentFolder(newStack[newStack.length - 1]);
    };

    return (
        <div className="flex flex-col h-[500px] bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-200 font-medium overflow-hidden">
                    <HardDrive className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className="truncate text-xs font-mono">{currentPathString}</span>
                </div>
                <button onClick={onCancel} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Browser */}
            <div className="flex-1 overflow-y-auto p-2">
                {/* Up Button */}
                {pathStack.length > 1 && (
                    <div
                        onClick={handleUp}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm">.. (Parent Directory)</span>
                    </div>
                )}

                {/* Items */}
                {currentFolder.children?.map((item, idx) => (
                    <div
                        key={idx}
                        onClick={() => handleNavigate(item)}
                        className={`
                            flex items-center gap-3 p-3 rounded-lg transition-colors
                            ${item.type === 'folder' ? 'cursor-pointer hover:bg-slate-800 text-slate-200 hover:text-white' : 'text-slate-500 cursor-default'}
                        `}
                    >
                        {item.type === 'folder' ? (
                            <Folder className="w-5 h-5 text-sky-500" />
                        ) : item.ext === 'inf' ? (
                            <FileCode className="w-5 h-5 text-emerald-500" />
                        ) : (
                            <File className="w-5 h-5" />
                        )}
                        <span className="text-sm">{item.name}</span>
                    </div>
                ))}

                {currentFolder.children?.length === 0 && (
                    <div className="text-center p-8 text-slate-600 text-xs italic">
                        This folder is empty.
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="bg-slate-800 p-4 border-t border-slate-700 flex justify-between items-center gap-4">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                    {hasInf ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 H-3" /> Valid Driver Found (.inf)
                        </span>
                    ) : (
                        <span className="text-amber-500/80">
                            No .inf file in this folder
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
                        onClick={() => onSelect(currentPathString)}
                        disabled={!hasInf}
                        className="px-6 py-2 rounded-lg bg-sky-500 text-slate-900 text-xs font-bold hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-sky-500/20"
                    >
                        Select Folder
                    </button>
                </div>
            </div>
        </div>
    );
};
