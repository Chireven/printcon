/**
 * Plugin: Print Servers
 *
 * Rule #6: Dependency Injection Only.
 * This plugin receives the PluginAPI from the Core during initialization.
 */

import { PluginInitializer } from '../../../src/core/types/plugin';

export const initialize: PluginInitializer = async (api) => {
  api.log('Info', 'Plugin printers-printservers initialized');
  console.log('[Plugin] Print Servers initialized');

  // Subscribe to REQUEST_SERVERS
  api.events.on('REQUEST_SERVERS', async (data: any, context?: any) => {
    // Validate permission
    if (!context?.permissions?.includes('printservers.read')) {
      console.warn('[Plugin] Permission denied: printservers.read required');
      api.events.emit('RESPONSE_SERVERS', {
        success: false,
        error: 'Permission denied: printservers.read required',
        code: 'PERMISSION_DENIED',
        servers: []
      });
      return;
    }

    try {
      console.log('[Plugin] Fetching all servers');
      
      const db = api.database;
      const servers = await db.query(
        'SELECT Id, Hostname, IPAddress, Status, CreatedAt, ModifiedAt FROM [plg_printers_printservers].[Servers] ORDER BY Hostname',
        {}
      );

      console.log('[Plugin] Query result:', {
        serversCount: servers.length,
        servers: servers
      });

      api.events.emit('RESPONSE_SERVERS', {
        success: true,
        servers: servers
      });
    } catch (e: any) {
      console.error('[Plugin] Failed to fetch servers:', e);
      api.events.emit('RESPONSE_SERVERS', {
        success: false,
        error: e.message,
        servers: []
      });
    }
  });

  // Subscribe to REQUEST_SERVER_BY_ID
  api.events.on('REQUEST_SERVER_BY_ID', async (data: any, context?: any) => {
    // Validate permission
    if (!context?.permissions?.includes('printservers.read')) {
      console.warn('[Plugin] Permission denied: printservers.read required');
      api.events.emit('RESPONSE_SERVER_BY_ID', {
        success: false,
        error: 'Permission denied: printservers.read required',
        code: 'PERMISSION_DENIED',
        server: null
      });
      return;
    }

    try {
      console.log('[Plugin] Fetching server by ID:', data.id);
      
      const db = api.database;
      const servers = await db.query(
        'SELECT Id, Hostname, IPAddress, Status, CreatedAt, ModifiedAt FROM [plg_printers_printservers].[Servers] WHERE Id = @id',
        { id: data.id }
      );

      if (servers && servers.length > 0) {
        api.events.emit('RESPONSE_SERVER_BY_ID', {
          success: true,
          server: servers[0]
        });
      } else {
        api.events.emit('RESPONSE_SERVER_BY_ID', {
          success: false,
          error: 'Server not found',
          server: null
        });
      }
    } catch (e: any) {
      console.error('[Plugin] Failed to fetch server:', e);
      api.events.emit('RESPONSE_SERVER_BY_ID', {
        success: false,
        error: e.message,
        server: null
      });
    }
  });

  // Subscribe to REQUEST_CREATE_SERVER
  api.events.on('REQUEST_CREATE_SERVER', async (data: any, context?: any) => {
    // Validate permission
    if (!context?.permissions?.includes('printservers.create')) {
      console.warn('[Plugin] Permission denied: printservers.create required');
      api.events.emit('RESPONSE_CREATE_SERVER', {
        success: false,
        error: 'Permission denied: printservers.create required',
        code: 'PERMISSION_DENIED'
      });
      return;
    }

    try {
      console.log('[Plugin] Creating new server:', data);
      
      const db = api.database;
      
      // Insert the server
      await db.query(
        `INSERT INTO [plg_printers_printservers].[Servers] (Hostname, IPAddress, Status)
         VALUES (@hostname, @ipAddress, @status)`,
        {
          hostname: data.hostname,
          ipAddress: data.ipAddress,
          status: data.status || 'Active'
        }
      );

      console.log('[Plugin] Server created successfully');
      
      api.events.emit('RESPONSE_CREATE_SERVER', {
        success: true,
        message: 'Server created successfully'
      });
    } catch (e: any) {
      console.error('[Plugin] Failed to create server:', e);
      console.error('[Plugin] Error details:', {
        message: e.message,
        code: e.code,
        number: e.number,
        state: e.state
      });
      api.events.emit('RESPONSE_CREATE_SERVER', {
        success: false,
        error: e.message || 'Failed to create server'
      });
    }
  });

  // Subscribe to REQUEST_DELETE_SERVER
  api.events.on('REQUEST_DELETE_SERVER', async (data: any, context?: any) => {
    // Validate permission
    if (!context?.permissions?.includes('printservers.delete')) {
      console.warn('[Plugin] Permission denied: printservers.delete required');
      api.events.emit('RESPONSE_DELETE_SERVER', {
        success: false,
        error: 'Permission denied: printservers.delete required',
        code: 'PERMISSION_DENIED'
      });
      return;
    }

    try {
      console.log('[Plugin] Deleting server:', data.id);
      
      const db = api.database;
      
      // Delete the server
      await db.query(
        `DELETE FROM [plg_printers_printservers].[Servers] WHERE Id = @id`,
        { id: data.id }
      );

      console.log('[Plugin] Server deleted successfully');
      
      api.events.emit('RESPONSE_DELETE_SERVER', {
        success: true,
        message: 'Server deleted successfully'
      });
    } catch (e: any) {
      console.error('[Plugin] Failed to delete server:', e);
      api.events.emit('RESPONSE_DELETE_SERVER', {
        success: false,
        error: e.message || 'Failed to delete server'
      });
    }
  });

  console.log('[Plugin] Print Servers event handlers registered');
};
