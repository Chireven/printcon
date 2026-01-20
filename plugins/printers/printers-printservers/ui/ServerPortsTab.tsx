'use client';

import React, { useEffect, useState } from 'react';
import { Cable, Plus, Loader2, AlertCircle, Network, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface ServerPortsTabProps {
  serverId: string;
}

interface PrinterPort {
  Id: string;
  Name: string;
  IPAddress: string;
  Protocol: 'Raw' | 'LPR';
  Status: string;
  PortNumber?: number;
}

export function ServerPortsTab({ serverId }: ServerPortsTabProps) {
  const [ports, setPorts] = useState<PrinterPort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPorts();
  }, [serverId]);

  const fetchPorts = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual event when backend is ready
      // Mock data fetch
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Mock Data (Empty for default state, or could populate for demo)
      setPorts([]); 
      
    } catch (err) {
      console.error('Failed to fetch ports:', err);
      toast.error('Failed to load ports');
    } finally {
      setLoading(false);
    }
  };

  const openPortCreator = () => {
    // This would trigger the printer-ports plugin creator
    toast.info('Port Creator', {
      description: 'This feature will open the Port Management wizard.'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-sky-500" />
        <p>Loading server ports...</p>
      </div>
    );
  }

  if (ports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500 bg-slate-900/30 border border-slate-800/50 rounded-lg border-dashed">
        <div className="p-4 bg-slate-800/50 rounded-full mb-4">
          <Cable className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No ports configured</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-md text-center">
          Create standard TCP/IP ports to communicate with network printers.
        </p>
        <button
          onClick={openPortCreator}
          className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Port
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Configured Ports</h3>
          <p className="text-sm text-slate-400">
            {ports.length} port{ports.length !== 1 ? 's' : ''} available on this server
          </p>
        </div>
        <button
          onClick={openPortCreator}
          className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Port
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/30">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-6 py-4 font-medium text-slate-300">Port Name</th>
              <th className="px-6 py-4 font-medium text-slate-300">IP Address</th>
              <th className="px-6 py-4 font-medium text-slate-300">Protocol</th>
              <th className="px-6 py-4 font-medium text-slate-300">Status</th>
              <th className="px-6 py-4 font-medium text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {ports.map((port) => (
              <tr 
                key={port.Id} 
                className="group hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Cable className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    <span className="font-medium text-slate-200">{port.Name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    {port.IPAddress}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-slate-400">{port.Protocol}</span>
                  {port.PortNumber && <span className="text-slate-600 ml-2">({port.PortNumber})</span>}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    port.Status === 'Active' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {port.Status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    className="text-slate-500 hover:text-red-400 transition-colors text-xs font-medium"
                    title="Delete Port"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
