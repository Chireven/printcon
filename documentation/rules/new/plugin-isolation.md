# Plugin Isolation and API Route Rules

## Core Principle
**Plugins must NEVER be imported directly by API routes.** All communication between plugins and the frontend must go through the Event Hub via `/api/system/command`.

## Why This Matters

### Problem: Direct API Routes
```typescript
// ❌ WRONG - Violates plugin isolation
// File: /src/app/api/drivers/[id]/route.ts
import { PrinterService } from '../../../../../plugins/printers/printer-drivers/service';

export async function DELETE(req, context) {
    const { id } = await context.params;
    await PrinterService.deletePackage(id);  // Direct plugin access
    return NextResponse.json({ success: true });
}
```

**Issues:**
1. **Breaks Plugin Isolation**: API routes can access plugin internals
2. **Bypasses Database Broker**: Plugins should only access DB via `api.database`
3. **No Event Auditing**: Direct calls don't go through Event Hub logging
4. **Tight Coupling**: Changes to plugin structure break API routes

### Solution: Event Hub Pattern
```typescript
// ✅ CORRECT - Frontend calls Event Hub
const response = await fetch('/api/system/command', {
    method: 'POST',
    body: JSON.stringify({
        event: 'REQUEST_DELETE_DRIVER',
        pluginId: 'printer-drivers',
        data: { id }
    })
});

// ✅ CORRECT - Plugin handles event in isolation
api.events.on('REQUEST_DELETE_DRIVER', async (data) => {
    // Plugin uses api.database, never direct imports
    await PrinterService.deletePackage(data.id);
    api.events.emit('RESPONSE_DELETE_DRIVER', { success: true });
});
```

## Rules for API Routes

### Allowed
- ✅ System-level routes (e.g., `/api/system/command`, `/api/system/events`)
- ✅ Core routes (e.g., `/api/schema/validate`)
- ✅ Routes that don't import plugin code

### Forbidden
- ❌ Direct imports from `/plugins/**/*`
- ❌ Plugin-specific routes (e.g., `/api/drivers/[id]`)
- ❌ Routes that call plugin services directly

## Database Access Rules

### Plugin Context (CORRECT)
```typescript
// In plugin service.ts
export class PrinterService {
    private static async getDB() {
        if (this.api) {
            // ✅ Use PluginAPI database broker
            return this.api.database;
        } else {
            // ❌ Fallback for API routes - should not exist
            const { DatabaseBroker } = await import('../../../src/core/database-broker');
            await DatabaseBroker.initialize(dbConfig);
            return {
                query: (sql, params) => DatabaseBroker.query('printer-drivers', sql, params)
            };
        }
    }
}
```

**The fallback for API routes should be removed.** Services should only be called from plugin context.

### Correct Architecture
```
[Frontend] 
    → /api/system/command (Event Hub)
        → EventHub.emit('REQUEST_DELETE_DRIVER')
            → [Plugin index.ts Event Handler]
                → PrinterService.deletePackage()
                    → api.database.query() ✅
```

### Incorrect Architecture
```
[Frontend]
    → /api/drivers/[id] ❌
        → import PrinterService ❌
            → PrinterService.deletePackage()
                → DatabaseBroker.initialize() ❌ (bypasses plugin broker)
```

## Migration Guide

### Step 1: Identify Violating Routes
Find API routes that import plugin code:
```bash
rg "import.*from.*plugins" src/app/api
```

### Step 2: Create Event Handlers
In plugin `index.ts`:
```typescript
api.events.on('REQUEST_[ACTION]', async (data) => {
    const result = await MyService.[method](data);
    api.events.emit('RESPONSE_[ACTION]', { success: true, ...result });
});
```

### Step 3: Update Frontend
Replace direct API calls with Event Hub calls:
```typescript
// Before
await fetch(`/api/drivers/${id}`, { method: 'DELETE' });

// After
await fetch('/api/system/command', {
    method: 'POST',
    body: JSON.stringify({
        event: 'REQUEST_DELETE_DRIVER',
        pluginId: 'printer-drivers',
        data: { id }
    })
});
```

### Step 4: Delete API Route
```bash
rm src/app/api/drivers/[id]/route.ts
```

### Step 5: Remove Database Fallback
In plugin services, remove the `else` branch that initializes DatabaseBroker directly:
```typescript
private static async getDB() {
    if (!this.api) {
        throw new Error('Service must be initialized with PluginAPI');
    }
    return this.api.database;
}
```

## Checklist for New Features

Before implementing a new plugin feature:

- [ ] Does this require frontend interaction?
    - [ ] YES → Use Event Hub pattern
    - [ ] NO → Plugin can handle internally
- [ ] Does the feature need database access?
    - [ ] Use `api.database` only
    - [ ] Never import DatabaseBroker directly
- [ ] Does the feature modify files?
    - [ ] Use `api.storage` only
    - [ ] Never import StorageBroker directly
- [ ] Creating new events?
    - [ ] Follow `REQUEST_[ACTION]` / `RESPONSE_[ACTION]` naming
    - [ ] Always emit success/error in response
- [ ] Made changes to event handlers?
    - [ ] Restart dev server to register them

## Example: Correct Implementation

### Plugin Service (service.ts)
```typescript
export class MyService {
    private static api: PluginAPI | null = null;

    static initialize(api: PluginAPI): void {
        this.api = api;
    }

    private static async getDB() {
        if (!this.api) {
            throw new Error('Service not initialized');
        }
        return this.api.database;
    }

    public static async deleteItem(id: string) {
        const db = await this.getDB();
        await db.query('DELETE FROM [schema].Table WHERE Id = @id', { id });
        return { success: true };
    }
}
```

### Plugin Index (index.ts)
```typescript
export const initialize: PluginInitializer = async (api) => {
    MyService.initialize(api);

    api.events.on('REQUEST_DELETE_ITEM', async (data: any) => {
        try {
            const result = await MyService.deleteItem(data.id);
            api.events.emit('RESPONSE_DELETE_ITEM', {
                success: true,
                ...result
            });
        } catch (e: any) {
            api.events.emit('RESPONSE_DELETE_ITEM', {
                success: false,
                error: e.message
            });
        }
    });
};
```

### Frontend Component
```typescript
const handleDelete = async (id: string) => {
    try {
        const response = await fetch('/api/system/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'REQUEST_DELETE_ITEM',
                pluginId: 'my-plugin',
                data: { id }
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error);
        }

        toast.success('Item deleted successfully');
    } catch (error: any) {
        toast.error(`Failed to delete: ${error.message}`);
    }
};
```

## Common Mistakes

### Mistake 1: Using `payload` instead of `data`
```typescript
// ❌ Wrong
body: JSON.stringify({
    event: 'REQUEST_DELETE',
    pluginId: 'my-plugin',
    payload: { id }  // Will be undefined in plugin
})

// ✅ Correct
body: JSON.stringify({
    event: 'REQUEST_DELETE',
    pluginId: 'my-plugin',
    data: { id }
})
```

### Mistake 2: Not restarting after adding event handlers
Adding new event handlers requires a server restart. Hot-reload won't register them.

### Mistake 3: Missing success field in response
```typescript
// ❌ Wrong
api.events.emit('RESPONSE_DELETE', { id });

// ✅ Correct
api.events.emit('RESPONSE_DELETE', {
    success: true,
    id
});
```

### Mistake 4: Direct service imports in API routes
```typescript
// ❌ Wrong - API route importing plugin
import { MyService } from '../../../plugins/my-plugin/service';

// ✅ Correct - No API route at all, use Event Hub
```
