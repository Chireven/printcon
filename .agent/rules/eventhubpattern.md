---
trigger: always_on
---

# Plugin Event Hub Communication Pattern

## Overview
All plugin communication with the UI must use the Event Hub pattern via `/api/system/command`. Direct API routes that import plugin code violate the strict isolation principle and must not be used.

## REQUEST_/RESPONSE_ Pattern

### Event Naming Convention
All events that require a response must follow this naming pattern:
- **Request Event**: `REQUEST_[ACTION]` (e.g., `REQUEST_DRIVERS`, `REQUEST_UPDATE_DRIVER`)
- **Response Event**: `RESPONSE_[ACTION]` (e.g., `RESPONSE_DRIVERS`, `RESPONSE_UPDATE_DRIVER`)

The `/api/system/command` route automatically implements a 2-second timeout waiting for the response event when it detects the `REQUEST_` prefix.

### Frontend Implementation

**Correct:**
```typescript
const response = await fetch('/api/system/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        event: 'REQUEST_DELETE_DRIVER',
        pluginId: 'printer-drivers',
        data: { id: driverId }  // Use 'data', not 'payload'
    })
});

const result = await response.json();
if (!result.success) {
    throw new Error(result.error);
}
```

**Incorrect:**
```typescript
// ❌ Direct API route - violates plugin isolation
const response = await fetch(`/api/drivers/${driverId}`, {
    method: 'DELETE'
});
```

### Plugin Implementation

**Event Handler Registration (in plugin index.ts):**
```typescript
export const initialize: PluginInitializer = async (api) => {
    // Subscribe to REQUEST_DELETE_DRIVER
    api.events.on('REQUEST_DELETE_DRIVER', async (data: any) => {
        try {
            console.log('[Plugin] Deleting driver:', data.id);
            const result = await MyService.deletePackage(data.id);
            
            // Emit response
            api.events.emit('RESPONSE_DELETE_DRIVER', {
                success: true,
                fileDeleted: result.fileDeleted
            });
        } catch (e: any) {
            console.error('[Plugin] Failed to delete driver:', e);
            api.events.emit('RESPONSE_DELETE_DRIVER', {
                success: false,
                error: e.message
            });
        }
    });
};
```

## Critical Implementation Details

### 1. Data Field Name
The `/api/system/command` route passes the request body's `data` field to the plugin event handler, **not** `payload`.

**Correct:**
```typescript
body: JSON.stringify({
    event: 'REQUEST_UPDATE_DRIVER',
    pluginId: 'printer-drivers',
    data: { id, metadata }  // ✅ Use 'data'
})
```

**Incorrect:**
```typescript
body: JSON.stringify({
    event: 'REQUEST_UPDATE_DRIVER',
    pluginId: 'printer-drivers',
    payload: { id, metadata }  // ❌ Will be undefined in plugin
})
```

### 2. Response Structure
Always include `success` boolean in the response:

```typescript
api.events.emit('RESPONSE_[ACTION]', {
    success: true | false,
    error?: string,  // Include if success is false
    // ... other data
});
```

### 3. Server Restart Required
**Important:** Event handlers are registered during plugin initialization at server startup. Changes to event handlers in `index.ts` require a **full server restart** to take effect. Hot-reload does NOT re-register event handlers.

## Common Patterns

### Read Operation (List/Get)
```typescript
// Frontend
const response = await fetch('/api/system/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        event: 'REQUEST_DRIVERS',
        pluginId: 'printer-drivers'
    })
});
const { drivers } = await response.json();

// Plugin
api.events.on('REQUEST_DRIVERS', async () => {
    const drivers = await MyService.listPackages();
    api.events.emit('RESPONSE_DRIVERS', { drivers });
});
```

### Write Operation (Create/Update)
```typescript
// Frontend
const response = await fetch('/api/system/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        event: 'REQUEST_UPDATE_DRIVER',
        pluginId: 'printer-drivers',
        data: { id, metadata }
    })
});

// Plugin
api.events.on('REQUEST_UPDATE_DRIVER', async (data: any) => {
    await MyService.updatePackage(data.id, data.metadata);
    api.events.emit('RESPONSE_UPDATE_DRIVER', {
        success: true,
        id: data.id
    });
});
```

### Delete Operation
```typescript
// Frontend
const response = await fetch('/api/system/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        event: 'REQUEST_DELETE_DRIVER',
        pluginId: 'printer-drivers',
        data: { id }
    })
});

// Plugin
api.events.on('REQUEST_DELETE_DRIVER', async (data: any) => {
    const result = await MyService.deletePackage(data.id);
    api.events.emit('RESPONSE_DELETE_DRIVER', {
        success: true,
        fileDeleted: result.fileDeleted
    });
});
```

## Debugging

### Check Event Listener Count
If you see `(Listeners: 0)` in the logs:
```
[EventHub] Emitting: REQUEST_DELETE_DRIVER (Listeners: 0)
```
This means the plugin hasn't registered the event handler. **Restart the dev server**.

### Check Data Payload
If the plugin receives `undefined`:
```
[Plugin] Deleting driver: undefined
```
Ensure the frontend uses `data:` not `payload:` in the request body.

### Timeout Errors
```
[API] Timeout waiting for RESPONSE_DELETE_DRIVER
```
- Check that the plugin emits the response event
- Verify the response event name matches exactly (case-sensitive)
- Ensure the plugin code doesn't have errors preventing emission

## Migration Checklist

When converting direct API routes to Event Hub pattern:

- [ ] Rename events to `REQUEST_[ACTION]` / `RESPONSE_[ACTION]`
- [ ] Change frontend to use `/api/system/command`
- [ ] Use `data:` field in request body, not `payload:`
- [ ] Add event handlers to plugin `index.ts`
- [ ] Always emit response with `success` boolean
- [ ] Delete direct API route files (e.g., `/api/drivers/[id]/route.ts`)
- [ ] Restart dev server to register new handlers
- [ ] Test with console logs to verify data flow
