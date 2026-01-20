'use client';

import React, { useEffect, useState } from 'react';
import { Printer, Plus, Loader2, AlertCircle, Share2, HardDrive, Cable } from 'lucide-react';
import { toast } from 'sonner';
import { DeviceProvisioningWizard } from './DeviceProvisioningWizard';

interface ServerDevicesTabProps {
  serverId: string;
}

interface PrintDevice {
  Id: string;
  Name: string;
  SharedName?: string;
  DriverName: string;
  PortName: string;
  Status: string;
}

export function ServerDevicesTab({ serverId }: ServerDevicesTabProps) {
  const [devices, setDevices] = useState<PrintDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, [serverId]);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual event when backend is ready
      // Mock data fetch
      await new Promise(resolve => setTimeout(resolve, 700));
      
      // Mock Data (Empty for default state)
      setDevices([]); 
      
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const openProvisioningWizard = () => {
    setIsWizardOpen(true);
  };

  const handleProvisionComplete = () => {
    fetchDevices();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-sky-500" />
        <p>Loading print devices...</p>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500 bg-slate-900/30 border border-slate-800/50 rounded-lg border-dashed">
        <div className="p-4 bg-slate-800/50 rounded-full mb-4">
          <Printer className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No devices hosted</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-md text-center">
          Deploy print queues to this server by combining an installed driver and a configured port.
        </p>
        <button
          onClick={openProvisioningWizard}
          className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Deploy New Device
        </button>
        
        <DeviceProvisioningWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          serverId={serverId}
          onProvisionComplete={handleProvisionComplete}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Hosted Print Devices</h3>
          <p className="text-sm text-slate-400">
            {devices.length} queue{devices.length !== 1 ? 's' : ''} active on this server
          </p>
        </div>
        <button
          onClick={openProvisioningWizard}
          className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Deploy New Device
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/30">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-6 py-4 font-medium text-slate-300">Device Name</th>
              <th className="px-6 py-4 font-medium text-slate-300">Shared Name</th>
              <th className="px-6 py-4 font-medium text-slate-300">Associated Driver</th>
              <th className="px-6 py-4 font-medium text-slate-300">Associated Port</th>
              <th className="px-6 py-4 font-medium text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {devices.map((device) => (
              <tr 
                key={device.Id} 
                className="group hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Printer className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
                    <div>
                      <div className="font-medium text-slate-200">{device.Name}</div>
                      {device.SharedName && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Share2 className="w-3 h-3" />
                          Shared
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-400">
                  {device.SharedName || <span className="text-slate-600 italic">Not Shared</span>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                    {device.DriverName}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Cable className="w-3.5 h-3.5 text-slate-500" />
                    {device.PortName}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    className="text-slate-500 hover:text-red-400 transition-colors text-xs font-medium"
                    title="Remove Device"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DeviceProvisioningWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        serverId={serverId}
        onProvisionComplete={handleProvisionComplete}
      />
    </div>
  );
}
