# Decisions for Tomorrow

This document tracks architectural decisions, technical debt, and features that we have consciously deferred, along with the reasoning behind the current state and why we might want to revisit them.

---

## 1. Safe Plugin Deletion (Database Persistence)

**Status:** `Active Decision`  
**Related Script:** `scripts/delete.ts`

### The Current Behavior
When running `npm run plugin:delete <id>`, the system performs the following actions:
1.  **File Cleanup:** Deletes the physical files from `plugins/<category>/<id>`.
2.  **Registry Cleanup:** Removes the plugin entry from `src/core/registry.json`.
3.  **Event Emission:** Broadcasts a `PLUGIN_DELETED` event.

**Crucially, it DOES NOT remove the database schema** (`plg_<type>_<name>`) or any data associated with the plugin.

### Why it is this way
This is a **Safety-First** design choice.
*   **Preventing Catastrophic Data Loss:** It is far too easy to "delete a plugin" thinking you are just reinstalling or resetting the code. If we automatically `DROP SCHEMA`, a simple reinstall attempt could wipe specific business data (like years of print logs) instantly.
*   **Orphan > Loss:** It is better to have "orphaned" tables in the database (which can be cleaned up manually) than to accidentally delete critical data.

### Why we might want to change it (The Future)
During development or when genuinely retiring a feature, manually running SQL `DROP` commands is tedious.

**Proposed Solution:**
Update `scripts/delete.ts` to accept a widely-recognized "Shred" flag, such as:
*   `npm run plugin:delete my-plugin -- --cleanup-db`
*   `npm run plugin:delete my-plugin -- --shred`

This flag would trigger the `DatabaseBroker` to execute a schema drop. It should probably require an explicit confirmation prompt (e.g., "Type the plugin ID to confirm data destruction").
