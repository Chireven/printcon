'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cable, 
  X, 
  Globe, 
  Check, 
  Loader2, 
  Settings2 
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickCreatePortModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPortCreated: (port: { Id: string; Name: string; IPAddress: string; Protocol: string }) => void;
}

export function QuickCreatePortModal({ 
  isOpen, 
  onClose, 
  onPortCreated 
}: QuickCreatePortModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ipAddress: '',
    portName: '',
    protocol: 'Raw' as 'Raw' | 'LPR',
    portNumber: 9100
  });

  // Auto-generate port name from IP
  useEffect(() => {
    if (formData.ipAddress && !formData.portName.startsWith('IP_')) {
       // Only auto-generate if user hasn't typed a custom name (simple heuristic)
       // Or just update it if the previous name matched the previous pattern
       // For simplicity, let's just update prompt name if it's empty
    }
    if (formData.ipAddress && formData.portName === '') {
        setFormData(prev => ({ ...prev, portName: `IP_${formData.ipAddress}` }));
    }
  }, [formData.ipAddress]);

  // Update logic for auto-name: if name is IP_ + oldIP, update to IP_ + newIP
  const handleIpChange = (newIp: string) => {
    setFormData(prev => {
        const isAutoNamed = prev.portName === '' || prev.portName === `IP_${prev.ipAddress}`;
        return {
            ...prev,
            ipAddress: newIp,
            portName: isAutoNamed ? `IP_${newIp}` : prev.portName
        };
    });
  };

  const handleProtocolChange = (protocol: 'Raw' | 'LPR') => {
    setFormData(prev => ({
        ...prev,
        protocol,
        portNumber: protocol === 'Raw' ? 9100 : 515
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ipAddress) {
        toast.error('IP Address is required');
        return;
    }
    if (!formData.portName) {
        toast.error('Port Name is required');
        return;
    }

    setLoading(true);
    try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        const newPort = {
            Id: `new_port_${Date.now()}`,
            Name: formData.portName,
            IPAddress: formData.ipAddress,
            Protocol: formData.protocol
        };

        toast.success('Port Created Successfully');
        onPortCreated(newPort);
        onClose();
    } catch (error) {
        toast.error('Failed to create port');
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop - darker and higher z-index to sit on top of wizard */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 rounded-t-xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-500/10 rounded-lg">
                        <Cable className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Create Port</h3>
                        <p className="text-xs text-slate-400">Standard TCP/IP Port</p>
                    </div>
                </div>
                <button 
                    type="button"
                    onClick={onClose} 
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Target Host / IP Address <span className="text-red-400">*</span></label>
                    <div className="relative">
                        <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input 
                            type="text" 
                            value={formData.ipAddress}
                            onChange={(e) => handleIpChange(e.target.value)}
                            placeholder="e.g. 192.168.1.100"
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Port Name <span className="text-red-400">*</span></label>
                    <input 
                        type="text" 
                        value={formData.portName}
                        onChange={(e) => setFormData(prev => ({ ...prev, portName: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Protocol</label>
                        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                            <button
                                type="button"
                                onClick={() => handleProtocolChange('Raw')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${formData.protocol === 'Raw' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Raw
                            </button>
                            <button
                                type="button"
                                onClick={() => handleProtocolChange('LPR')}
                                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${formData.protocol === 'LPR' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                LPR
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Port Number</label>
                        <div className="relative">
                            <Settings2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                            <input 
                                type="number" 
                                value={formData.portNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, portNumber: parseInt(e.target.value) || 0 }))}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-end gap-3">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-all shadow-lg shadow-sky-900/20 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                        </>
                    ) : (
                        <>
                            Create Port
                        </>
                    )}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
