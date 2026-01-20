'use client';

import React, { useEffect, useState } from 'react';
import { Server, AlertCircle, Loader2, RefreshCw, Plus, Lock } from 'lucide-react';
import { useAuth } from '../../../../src/providers/MockAuthProvider';
import { ServerCard } from './ServerCard';
import { AddServerModal } from './AddServerModal';
import { ServerConfigPage } from './ServerConfigPage';

interface PrintServer {
  Id: string;
  Hostname: string;
  IPAddress?: string;
  Status: string;
}

export default function ServerDashboard() {
  const { hasPermission, user } = useAuth();
  const [servers, setServers] = useState<PrintServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<PrintServer | null>(null);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'REQUEST_SERVERS',
          pluginId: 'printers-printservers',
          userPermissions: user.permissions  // Pass permissions for server validation
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch servers: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle permission denied
      if (data.code === 'PERMISSION_DENIED') {
        setError(data.error || 'Access denied: You do not have permission to view print servers');
        setServers([]);
        return;
      }
      
      if (data.servers) {
        setServers(data.servers);
      } else {
        setServers([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch servers:', err);
      setError(err.message || 'Failed to load print servers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-sky-500" />
        <p>Loading Print Servers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-red-400">
        <AlertCircle className="w-10 h-10 mb-4" />
        <h3 className="text-lg font-bold">Failed to Load Servers</h3>
        <p className="text-sm opacity-80">{error}</p>
        <button
          onClick={fetchServers}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Show Server Configuration Page if a server is selected
  if (selectedServer) {
    return (
      <ServerConfigPage
        initialData={selectedServer}
        onBack={() => {
          setSelectedServer(null);
          fetchServers(); // Refresh server list when returning
        }}
      />
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/10 rounded-lg">
            <Server className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Print Servers</h2>
            <p className="text-xs text-slate-400">Manage your print server infrastructure</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchServers}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
            title="Refresh Servers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!hasPermission('printservers.create')}
            className={`px-4 py-2 border rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
              hasPermission('printservers.create')
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30'
                : 'bg-slate-800/50 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
            }`}
            title={
              hasPermission('printservers.create')
                ? 'Add New Server'
                : 'Permission Required: printservers.create'
            }
          >
            {hasPermission('printservers.create') ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            Add Server
          </button>
        </div>
      </div>

      {/* Server Grid */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-slate-900/30 border border-slate-700/50 rounded-lg">
          <Server className="w-16 h-16 mb-4 text-slate-400 opacity-30" />
          <h3 className="text-lg font-semibold mb-2">No Print Servers</h3>
          <p className="text-sm text-slate-400 mb-4">Get started by adding your first print server</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 hover:border-sky-500/30 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Your First Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <ServerCard 
              key={server.Id} 
              server={server}
              onManage={() => setSelectedServer(server)}
            />
          ))}
        </div>
      )}

      {/* Footer Stats */}
      {servers.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Showing {servers.length} print server{servers.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Add Server Modal */}
      <AddServerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchServers}
      />
    </div>
  );
}
