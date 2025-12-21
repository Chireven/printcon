import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { EventHub } from '../../../../core/events';
import { SystemStatus } from '../../../../core/system-status';

// In-memory store for connected SSE clients
const clients = new Set<(data: string) => void>();

// Connect Global EventHub to SSE
EventHub.setBroadcaster(broadcastSystemEvent);

// Singleton Watcher
let isWatching = false;
const registryPath = path.join(process.cwd(), 'src', 'core', 'registry.json');
const statusPath = path.join(process.cwd(), 'src', 'core', 'status.json');

function setupWatcher() {
    if (isWatching) return;

    // Watch Registry
    if (fs.existsSync(registryPath)) {
        let regTimer: NodeJS.Timeout;
        fs.watch(registryPath, (eventType) => {
            if (eventType === 'change') {
                clearTimeout(regTimer);
                regTimer = setTimeout(() => {
                    console.log('[SSE] Registry changed, broadcasting update...');
                    broadcastSystemEvent({
                        event: 'REGISTRY_UPDATED',
                        data: { timestamp: Date.now() }
                    });
                }, 500);
            }
        });
    }

    // Watch Status (for cross-process alerts)
    if (fs.existsSync(statusPath)) {
        let statusTimer: NodeJS.Timeout;
        fs.watch(statusPath, (eventType) => {
            if (eventType === 'change') {
                clearTimeout(statusTimer);
                statusTimer = setTimeout(() => {
                    // Re-scan for new errors
                    try {
                        const content = fs.readFileSync(statusPath, 'utf8');
                        const allStatus = JSON.parse(content);
                        Object.entries(allStatus).forEach(([pluginId, statusList]) => {
                            if (Array.isArray(statusList)) {
                                statusList.forEach((s: any) => {
                                    // Broadcast CRITICAL updates immediately
                                    // We might broadcast duplicates here, but better safe than sorry for alerts.
                                    // Frontend shows multiple toasts or dedupe? Sonner dedupes by ID if provided.
                                    // We aren't providing ID.
                                    if (s.severity === 'error') {
                                        broadcastSystemEvent({
                                            event: 'SYSTEM_ALERT',
                                            data: {
                                                pluginId,
                                                title: 'System Alert',
                                                message: `${s.value} (Live Update)`,
                                                status: 'failure'
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    } catch (e) {
                        console.error('[SSE] Status read error', e);
                    }
                }, 1000);
            }
        });
    }

    isWatching = true;
    console.log('[SSE] Watchers started');
}

export async function GET(req: NextRequest) {
    setupWatcher(); // Ensure watcher is running
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = (data: any) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        writer.write(encoder.encode(payload));
    };

    clients.add(sendEvent);

    // [Replay] Push any active system alerts to the new client
    try {
        const allStatus = SystemStatus.getAll();
        Object.entries(allStatus).forEach(([pluginId, statusList]) => {
            if (Array.isArray(statusList)) {
                statusList.forEach((s: any) => {
                    if (s.severity === 'error') {
                        console.log(`[SSE] Replaying Alert for ${pluginId}: ${s.value}`);
                        sendEvent({
                            event: 'SYSTEM_ALERT',
                            data: {
                                pluginId,
                                title: s.label === 'Database' ? 'Database Schema Mismatch' : 'System Alert',
                                message: `Review Required: ${s.value}`,
                                status: 'failure'
                            }
                        });
                    }
                });
            }
        });
    } catch (e) {
        console.error('[SSE] Failed to replay alerts:', e);
    }

    // Keep the connection alive
    const heartbeat = setInterval(() => {
        writer.write(encoder.encode(': heartbeat\n\n'));
    }, 15000);

    req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        clients.delete(sendEvent);
        writer.close();
    });

    return new Response(responseStream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}

// Global broadcast function for the API layer to use
export function broadcastSystemEvent(event: any) {
    clients.forEach((send) => send(event));
}
