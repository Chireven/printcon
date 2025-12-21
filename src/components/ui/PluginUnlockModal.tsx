import React, { useState } from 'react';
import { X, Unlock, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PluginUnlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    pluginId: string;
}

export const PluginUnlockModal = ({ isOpen, onClose, onSuccess, pluginId }: PluginUnlockModalProps) => {
    const [step, setStep] = useState<'init' | 'verify'>('init');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);

    // Reset state on open
    React.useEffect(() => {
        if (isOpen) {
            setStep('init');
            setPin('');
            setLoading(false);
        }
    }, [isOpen]);

    const handleInitiate = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock-init', pluginId })
            });
            const data = await res.json();

            if (res.ok) {
                setStep('verify');
                toast.info('Security Challenge Initiated', { description: 'A PIN has been broadcast to the Debug Console.' });
            } else {
                toast.error('Failed to initiate unlock', { description: data.error });
            }
        } catch (e: any) {
            toast.error('Error', { description: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!pin || pin.length < 4) return;
        setLoading(true);
        try {
            const res = await fetch('/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unlock-verify', pluginId, pin })
            });

            if (res.ok) {
                toast.success('Plugin Unlocked Successfully');
                onSuccess();
                onClose();
            } else {
                const data = await res.json();
                toast.error('Verification Failed', { description: data.error });
                setPin(''); // Clear pin on failure
            }
        } catch (e: any) {
            toast.error('Error', { description: e.message });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                            <Lock className="w-5 h-5 text-amber-500" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Unlock Plugin</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {step === 'init' ? (
                        <div className="text-center space-y-6">
                            <div className="flex justify-center">
                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700">
                                    <AlertCircle className="w-8 h-8 text-slate-500" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg mb-2">Security Challenge Required</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    This plugin is locked to prevent accidental modification. To unlock it, you must complete a security challenge.
                                </p>
                            </div>
                            <button
                                onClick={handleInitiate}
                                disabled={loading}
                                className="w-full py-3 bg-sky-500 text-slate-900 font-bold rounded-xl hover:bg-sky-400 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Contacting Server...' : 'Initiate Challenge'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                            <div className="text-center">
                                <h3 className="text-white font-bold text-lg mb-2">Enter Security PIN</h3>
                                <p className="text-slate-400 text-xs">
                                    Please enter the 4-digit PIN broadcast to the event stream.
                                </p>
                            </div>

                            <div className="flex justify-center">
                                <input
                                    type="text"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                                    className="bg-slate-950 border border-slate-700 text-white text-3xl font-mono text-center tracking-[1em] w-48 h-16 rounded-xl focus:outline-none focus:border-sky-500 transition-colors"
                                    placeholder="0000"
                                    autoFocus
                                />
                            </div>

                            <button
                                onClick={handleVerify}
                                disabled={loading || pin.length !== 4}
                                className="w-full py-3 bg-emerald-500 text-slate-900 font-bold rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Verifying...' : 'Unlock Plugin'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
