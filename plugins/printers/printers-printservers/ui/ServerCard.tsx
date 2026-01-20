'use client';

import React, { useEffect, useState } from 'react';
import { Server, Activity, HardDrive, Printer, ChevronRight, Loader2 } from 'lucide-react';

interface ServerCardProps {
  server: {
    Id: string;
    Hostname: string;
    IPAddress?: string;
    Status: string;
  };
  onManage: () => void;
}

interface HealthMetrics {
  drivers: number;
  ports: number;
  devices: number;
  loading: boolean;
}

export function ServerCard({ server, onManage }: ServerCardProps) {
  const [metrics, setMetrics] = useState<HealthMetrics>({
    drivers: 0,
    ports: 0,
    devices: 0,
    loading: true
  });

  useEffect(() => {
    fetchHealthMetrics();
  }, [server.Id]);

  const fetchHealthMetrics = async () => {
    setMetrics(prev => ({ ...prev, loading: true }));

    try {
      // Fetch driver count from printer-drivers plugin
      const driversResponse = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'REQUEST_DRIVER_COUNT_BY_SERVER',
          pluginId: 'printer-drivers',
          data: { serverId: server.Id }
        })
      }).catch(() => null);

      // Fetch port count from printer-ports plugin
      const portsResponse = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'REQUEST_PORT_COUNT_BY_SERVER',
          pluginId: 'printer-ports',
          data: { serverId: server.Id }
        })
      }).catch(() => null);

      // Fetch device count from printers-printDevices plugin
      const devicesResponse = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'REQUEST_DEVICE_COUNT_BY_SERVER',
          pluginId: 'printers-printDevices',
          data: { serverId: server.Id }
        })
      }).catch(() => null);

      const driversData = driversResponse ? await driversResponse.json() : { count: 0 };
      const portsData = portsResponse ? await portsResponse.json() : { count: 0 };
      const devicesData = devicesResponse ? await devicesResponse.json() : { count: 0 };

      setMetrics({
        drivers: driversData.count || 0,
        ports: portsData.count || 0,
        devices: devicesData.count || 0,
        loading: false
      });
    } catch (error) {
      console.error('Failed to fetch health metrics:', error);
      setMetrics({
        drivers: 0,
        ports: 0,
        devices: 0,
        loading: false
      });
    }
  };

  const isActive = server.Status === 'Active';

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6 hover:border-slate-600/50 transition-all hover:shadow-lg hover:shadow-slate-900/50">
      {/* Header: Hostname + Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isActive ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}>
            <Server className={`w-6 h-6 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{server.Hostname}</h3>
            {server.IPAddress && (
              <p className="text-xs text-slate-400 mt-0.5">{server.IPAddress}</p>
            )}
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-medium ${
          isActive 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : 'bg-slate-700/50 text-slate-400 border border-slate-600/50'
        }`}>
          {server.Status}
        </div>
      </div>

      {/* Health Indicators */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Drivers */}
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-slate-400">Drivers</span>
          </div>
          <div className="text-xl font-bold text-white">
            {metrics.loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              metrics.drivers
            )}
          </div>
        </div>

        {/* Ports */}
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Ports</span>
          </div>
          <div className="text-xl font-bold text-white">
            {metrics.loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              metrics.ports
            )}
          </div>
        </div>

        {/* Devices */}
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-2">
            <Printer className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-slate-400">Devices</span>
          </div>
          <div className="text-xl font-bold text-white">
            {metrics.loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            ) : (
              metrics.devices
            )}
          </div>
        </div>
      </div>

      {/* Manage Button */}
      <button
        onClick={onManage}
        className="w-full px-4 py-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-medium"
      >
        Manage Server
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
