/**
 * Global Event Hub Utility (Next.js Enterprise Edition)
 * 
 * Rule #18: All CLI scripts must emit a standardized event.
 * Simplified: All emissions now route through the Next.js Command API.
 */

export type ReservedSystemEvent = 'PLUGIN_CREATED' | 'PLUGIN_PACKED' | 'PLUGIN_INSTALLED' | 'PLUGIN_DELETED';

export interface SystemEvent {
    event: ReservedSystemEvent | string;
    timestamp: string;
    data: {
        pluginId: string;
        status: 'success' | 'failure';
        message?: string;
        pin?: string;
    };
}

export class EventHub {
    /**
     * Broadcasts a system event from CLI scripts via the Next.js API.
     */
    static async emit(
        event: SystemEvent['event'],
        pluginId: string,
        status: 'success' | 'failure' = 'success',
        pin?: string
    ): Promise<void> {
        const payload = { event, data: { pluginId, status, pin } };

        try {
            // CLI Context: Simple Fetch to the Next.js Control Plane
            const response = await fetch('http://localhost:3000/api/system/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            console.log(`\n[Event Hub] Event ${event} successfully routed to Control Plane.`);
        } catch (err) {
            console.error(`\n[Error] System Offline. Start the application with 'npm run dev' to manage plugins.`);
            process.exit(1);
        }
    }

    /**
     * No-op in SSE architecture (handled by Next.js request lifecycle)
     */
    static async close(): Promise<void> {
        // No global server to close in the CLI context anymore.
    }
}

/**
 * Backward compatibility wrapper.
 */
export async function emitSystemEvent(
    event: SystemEvent['event'],
    pluginId: string,
    status: 'success' | 'failure' = 'success',
    pin?: string
): Promise<void> {
    return EventHub.emit(event, pluginId, status, pin);
}
