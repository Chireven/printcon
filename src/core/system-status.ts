import fs from 'fs';
import path from 'path';

/**
 * System Status Service
 * 
 * Maintains a persistent state of plugin health and system alerts.
 * Uses a JSON file ('status.json') for cross-process persistence.
 */
export class SystemStatus {
    private static get statusPath() {
        return path.join(process.cwd(), 'src', 'core', 'status.json');
    }

    private static getStatusKey(entityId: string): string {
        return `system.status.${entityId}`;
    }

    /**
     * Updates the status for a specific entity (e.g. pluginId).
     */
    static update(entityId: string, status: { label: string, value: string, severity?: 'error' | 'warning' | 'success' }[]) {
        const current = this.getAll();
        current[entityId] = status;

        try {
            fs.writeFileSync(this.statusPath, JSON.stringify(current, null, 2));
        } catch (e) {
            console.error('[SystemStatus] Failed to persist status:', e);
        }
    }

    /**
     * Retrieves all current statuses.
     */
    static getAll(): Record<string, any> {
        try {
            if (!fs.existsSync(this.statusPath)) {
                return {};
            }
            const content = fs.readFileSync(this.statusPath, 'utf8');
            return JSON.parse(content);
        } catch (e) {
            console.error('[SystemStatus] Failed to read status:', e);
            return {};
        }
    }
}
