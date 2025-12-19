import { SystemEvent } from './types/events';

// Global Event Bus (Singleton via globalThis)
// Rule: EventHub must be accessible to both instrumentation (Node) and API routes (Edge/Node)
// We attach it to the global scope to survive HMR and module reloads in Dev.

declare global {
    var systemEventListeners: Map<string, Array<(payload: any) => void>>;
}

export class EventHub {
    private static get listeners(): Map<string, Array<(payload: any) => void>> {
        if (!global.systemEventListeners) {
            global.systemEventListeners = new Map();
        }
        return global.systemEventListeners;
    }

    static async emit(
        event: SystemEvent['event'],
        pluginId: string,
        status: 'success' | 'failure' = 'success',
        payloadOrPin?: any
    ): Promise<void> {
        // Flexible Payload Handling:
        // If the 4th arg is an object, merge it. If string, treat as PIN (legacy).
        let eventData: any = { pluginId, status };

        if (typeof payloadOrPin === 'object' && payloadOrPin !== null) {
            eventData = { ...eventData, ...payloadOrPin };
        } else if (payloadOrPin !== undefined) {
            eventData.pin = payloadOrPin;
        }

        const payload = { event, data: eventData };
        console.log(`[EventHub] Emitting: ${event} (Listeners: ${this.listeners.get(event)?.length || 0})`);

        // Server-Side: Notify local listeners (Request-Response Pattern)
        if (this.listeners.has(event)) {
            console.log(`[EventHub] Invoking local listeners for ${event}`);
            this.listeners.get(event)?.forEach(callback => callback(payload.data));
        }

        // Broadcast to SSE (Client-Side) via API
        try {
            // Note: In production, use a proper message queue.
            // For this mock, we fetch the events endpoint to broadcast.
            // But wait, the API route imports 'broadcastSystemEvent'.
            // Here we need to tell the API layer to broadcast.
            // We can't import API logic into Core.
            // The API layer hooks into this EventHub?
            // Actually, the command route emits to EventHub, but who broadcasts to SSE?
            // The command route does: `broadcastSystemEvent`.
            // So EventHub is purely for BACKEND internal communication (Loader <-> API).
            // It doesn't need to fetch anything.
        } catch (e) {
            console.error('[EventHub] Broadcast failed', e);
        }
    }

    static on(event: string, callback: (payload: any) => void): void {
        console.log(`[EventHub] Subscribing to: ${event}`);
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);
    }
}
