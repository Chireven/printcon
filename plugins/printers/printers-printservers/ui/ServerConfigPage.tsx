'use client';

import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Radio, 
  Trash2, 
  ArrowLeft, 
  HardDrive, 
  Cable, 
  Printer,
  Activity,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../../../src/providers/MockAuthProvider';
import { toast } from 'sonner';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ServerDriversTab } from './ServerDriversTab';
import { ServerPortsTab } from './ServerPortsTab';
import { ServerDevicesTab } from './ServerDevicesTab';

interface ServerConfigPageProps {
  initialData: PrintServer;
  onBack: () => void;
}

type TabType = 'drivers' | 'ports' | 'devices';

interface PrintServer {
  Id: string;
  Hostname: string;
  IPAddress?: string;
  Status: string;
}

export function ServerConfigPage({ initialData, onBack }: ServerConfigPageProps) {
  const { hasPermission, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('drivers');
  const [server, setServer] = useState<PrintServer | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline'>(
    initialData.Status === 'Active' ? 'online' : 'offline'
  );
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Background refresh
    fetchServerDetails();
  }, [initialData.Id]);

  const fetchServerDetails = async () => {
    // Don't set loading=true here to avoid flickering. This is just a sync check.
    try {
      const response = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'REQUEST_SERVER_BY_ID',
          pluginId: 'printers-printservers',
          data: { id: initialData.Id },
          userPermissions: user.permissions
        })
      });

      const data = await response.json();

      if (data.code === 'PERMISSION_DENIED') {
        toast.error('Access Denied', {
          description: data.error || 'You do not have permission to view this server'
        });
        onBack();
        return;
      }

      if (data.success && data.server) {
        setServer(data.server);
        // TODO: Implement actual sync status check
        setSyncStatus(data.server.Status === 'Active' ? 'online' : 'offline');
      } else {
        toast.error('Server not found');
        onBack();
      }
    } catch (err: any) {
      console.error('Failed to fetch server details:', err);
      toast.error('Failed to load server details', {
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    if (!hasPermission('printservers.delete')) {
      toast.error('Access Denied', {
        description: 'You do not have permission to delete print servers'
      });
      return;
    }
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'REQUEST_DELETE_SERVER',
          pluginId: 'printers-printservers',
          data: { id: initialData.Id },
          userPermissions: user.permissions
        })
      });

      const result = await response.json();

      if (result.code === 'PERMISSION_DENIED') {
        toast.error('Access Denied', {
          description: result.error || 'You do not have permission to delete this server'
        });
        return;
      }

      if (result.success) {
        toast.success('Server deleted successfully');
        onBack();
      } else {
        toast.error('Failed to delete server', {
          description: result.error || 'An error occurred'
        });
      }
    } catch (err: any) {
      console.error('Failed to delete server:', err);
      toast.error('Failed to delete server', {
        description: err.message
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const tabs = [
    { id: 'drivers' as TabType, label: 'Drivers', icon: HardDrive, subtitle: 'The Foundation' },
    { id: 'ports' as TabType, label: 'Ports', icon: Cable, subtitle: 'The Plumbing' },
    { id: 'devices' as TabType, label: 'Devices', icon: Printer, subtitle: 'The Result' }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-sky-500" />
        <p>Loading Server Configuration...</p>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-red-400">
        <AlertCircle className="w-10 h-10 mb-4" />
        <h3 className="text-lg font-bold">Server Not Found</h3>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-white transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Servers
          </button>

          {hasPermission('printservers.delete') && (
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete Server"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-500/10 rounded-lg">
              <Server className="w-8 h-8 text-sky-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{server.Hostname}</h1>
              {server.IPAddress && (
                <p className="text-sm text-slate-400">{server.IPAddress}</p>
              )}
            </div>
          </div>

          {/* Sync Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
            <Activity className={`w-4 h-4 ${syncStatus === 'online' ? 'text-green-400' : 'text-red-400'}`} />
            <div>
              <p className="text-xs text-slate-500">Sync Status</p>
              <p className={`text-sm font-semibold ${syncStatus === 'online' ? 'text-green-400' : 'text-red-400'}`}>
                {syncStatus === 'online' ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-800 mb-6">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 transition-all
                  ${isActive
                    ? 'border-sky-500 text-sky-400 bg-sky-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <div className="text-left">
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className="text-xs opacity-60">{tab.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6 min-h-[400px]">
        {activeTab === 'drivers' && (
          <ServerDriversTab serverId={initialData.Id} />
        )}

        {activeTab === 'ports' && (
          <ServerPortsTab serverId={initialData.Id} />
        )}

        {activeTab === 'devices' && (
          <ServerDevicesTab serverId={initialData.Id} />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        serverName={server?.Hostname || ''}
        isDeleting={isDeleting}
      />
    </div>
  );
}
