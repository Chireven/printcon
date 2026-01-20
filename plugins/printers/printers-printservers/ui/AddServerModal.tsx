'use client';

import React, { useState } from 'react';
import { X, Server } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../../src/providers/MockAuthProvider';

interface AddServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddServerModal({ isOpen, onClose, onSuccess }: AddServerModalProps) {
  const { user } = useAuth();
  const [hostname, setHostname] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [status, setStatus] = useState('Active');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hostname.trim()) {
      toast.error('Hostname is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/system/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'REQUEST_CREATE_SERVER',
          pluginId: 'printers-printservers',
          data: {
            hostname: hostname.trim(),
            ipAddress: ipAddress.trim() || null,
            status: status
          },
          userPermissions: user.permissions  // Pass permissions for server validation
        })
      });

      const result = await response.json();

      // Handle permission denied
      if (result.code === 'PERMISSION_DENIED') {
        toast.error('Access Denied', {
          description: result.error || 'You do not have permission to create print servers'
        });
        onClose();
        return;
      }

      if (result.success) {
        toast.success('Print server added successfully');
        setHostname('');
        setIpAddress('');
        setStatus('Active');
        onSuccess();
        onClose();
      } else {
        toast.error('Failed to add server', {
          description: result.error || 'An error occurred'
        });
      }
    } catch (error: any) {
      console.error('Failed to create server:', error);
      toast.error('Failed to add server', {
        description: error.message || 'An error occurred'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg">
              <Server className="w-5 h-5 text-sky-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Add Print Server</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Hostname */}
          <div>
            <label htmlFor="hostname" className="block text-sm font-medium text-slate-300 mb-2">
              Hostname <span className="text-red-400">*</span>
            </label>
            <input
              id="hostname"
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="PS-01"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
              required
            />
          </div>

          {/* IP Address */}
          <div>
            <label htmlFor="ipAddress" className="block text-sm font-medium text-slate-300 mb-2">
              IP Address
            </label>
            <input
              id="ipAddress"
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            />
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-300 mb-2">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            >
              <option value="Active">Active</option>
              <option value="Offline">Offline</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors rounded-lg"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
