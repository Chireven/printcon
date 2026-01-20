'use client';

import React, { useEffect, useState } from 'react';
import { HardDrive, Plus, Loader2, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ServerDriversTabProps {
  serverId: string;
}

interface InstalledDriver {
  Id: string;
  Name: string;
  Environment: string;
  Version: string;
  VersionDate: string;
}

export function ServerDriversTab({ serverId }: ServerDriversTabProps) {
  const [drivers, setDrivers] = useState<InstalledDriver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrivers();
  }, [serverId]);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual event when backend is ready
      // For now, we simulate a fetch that returns empty or mock data
      // const response = await fetch('/api/system/command', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     event: 'REQUEST_SERVER_DRIVERS',
      //     pluginId: 'printers-printservers',
      //     data: { serverId }
      //   })
      // });
      // const data = await response.json();
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock data for demonstration (Empty by default as per requirements implies typically empty start)
      setDrivers([]); 
      
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
      toast.error('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const openDriverSelector = () => {
    // This would trigger the printer-drivers plugin selector
    toast.info('Driver Selector', {
      description: 'This feature will open the Global Driver Repository selector.'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-sky-500" />
        <p>Loading installed drivers...</p>
      </div>
    );
  }

  if (drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500 bg-slate-900/30 border border-slate-800/50 rounded-lg border-dashed">
        <div className="p-4 bg-slate-800/50 rounded-full mb-4">
          <HardDrive className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No drivers installed</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-md text-center">
          Install a driver to begin hosting devices on this server.
          Drivers are deployed from the Global Repository.
        </p>
        <button
          onClick={openDriverSelector}
          className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Install Driver
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Installed Drivers</h3>
          <p className="text-sm text-slate-400">
            {drivers.length} driver{drivers.length !== 1 ? 's' : ''} installed on this server
          </p>
        </div>
        <button
          onClick={openDriverSelector}
          className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Install Driver
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/30">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-6 py-4 font-medium text-slate-300">Driver Name</th>
              <th className="px-6 py-4 font-medium text-slate-300">Environment</th>
              <th className="px-6 py-4 font-medium text-slate-300">Version Date</th>
              <th className="px-6 py-4 font-medium text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {drivers.map((driver) => (
              <tr 
                key={driver.Id} 
                className="group hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition-colors" />
                    <span className="font-medium text-slate-200">{driver.Name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    {driver.Environment}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400">
                  {new Date(driver.VersionDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    className="text-slate-500 hover:text-red-400 transition-colors text-xs font-medium"
                    title="Uninstall Driver"
                  >
                    Uninstall
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
