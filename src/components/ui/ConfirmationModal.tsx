import React from 'react';
import { Trash2, AlertTriangle, X, Info } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'destructive' | 'default';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = 'default'
}) => {
    if (!isOpen) return null;

    const isDestructive = variant === 'destructive';

    // Theme colors based on variant
    const colors = isDestructive ? {
        border: 'border-red-900/50',
        bg: 'bg-slate-950',
        headerBg: 'bg-red-950/30',
        headerBorder: 'border-red-900/30',
        iconColor: 'text-red-500',
        iconBg: 'bg-red-500/10',
        iconBorder: 'border-red-500/20',
        confirmBtn: 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
    } : {
        border: 'border-slate-800',
        bg: 'bg-slate-950',
        headerBg: 'bg-slate-900/50',
        headerBorder: 'border-slate-800',
        iconColor: 'text-sky-500',
        iconBg: 'bg-sky-500/10',
        iconBorder: 'border-sky-500/20',
        confirmBtn: 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full max-w-md ${colors.bg} border-2 ${colors.border} rounded-xl overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className={`${colors.headerBg} p-4 border-b ${colors.headerBorder} flex items-center justify-between`}>
                    <div className={`flex items-center gap-2 ${colors.iconColor} font-bold`}>
                        {isDestructive ? <Trash2 className="w-5 h-5" /> : <Info className="w-5 h-5" />}
                        <span>{title}</span>
                    </div>
                    <button onClick={onClose} className={`${colors.iconColor} opacity-50 hover:opacity-100 transition-opacity`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex items-start gap-4 mb-6">
                        <div className={`p-3 ${colors.iconBg} rounded-full border ${colors.iconBorder} shrink-0`}>
                            {isDestructive ? (
                                <AlertTriangle className={`w-6 h-6 ${colors.iconColor}`} />
                            ) : (
                                <Info className={`w-6 h-6 ${colors.iconColor}`} />
                            )}
                        </div>
                        <div>
                            {typeof description === 'string' ? (
                                <p className="text-slate-300 text-sm leading-relaxed">{description}</p>
                            ) : (
                                description
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={() => onConfirm()}
                            className={`px-4 py-2 rounded-lg text-white text-sm font-bold shadow-lg transition-all active:scale-95 ${colors.confirmBtn}`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
