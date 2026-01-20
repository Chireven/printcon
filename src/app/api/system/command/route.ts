import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { broadcastSystemEvent } from '../events/route';

// In-memory store for active unlock challenges
const activeChallenges = new Map<string, string>();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, pluginId, pin, event, data, userPermissions } = body;

        // Extract user context for permission validation
        // TODO: In production, get permissions from server-side session/JWT
        // For now, accept from client (mock auth system)
        const userContext = {
            permissions: userPermissions || []
        };

        const registryPath = path.join(process.cwd(), 'src/core/registry.json');
        let registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

        // Case 1: Generic Event (Bridge for install/delete/etc)
        if (event) {
            broadcastSystemEvent({
                event,
                data: { ...(data || {}), pluginId: pluginId || 'unknown' }, // Propagate identity safely
                timestamp: new Date().toISOString()
            });

            // Request-Response Pattern: If the event starts with REQUEST_, wait for response.
            if (event.startsWith('REQUEST_')) {
                const responseEvent = event.replace('REQUEST_', 'RESPONSE_');

                // Import dynamically to avoid circular dependency on load if necessary, 
                // but here we know EventHub is in core.
                // Note: We need to import EventHub. We'll add the import at top of file.
                // Since I can't add imports in this chunk easily without getting the whole file,
                // I will rely on the verify step or a separate edit to add the import if needed.
                // Wait, I should add the import first. But let's proceed with logic.
                // Actually, I'll use a dynamic import for EventHub to be safe and clean.
                const { EventHub } = await import('../../../../core/events');

                console.log(`[API] Waiting for ${responseEvent}...`);

                // Dynamic timeout based on operation type
                let timeoutMs = 5000; // Increased to 5 seconds default for better reliability

                // Long-running operations get extended timeout
                if (event === 'REQUEST_BUILD_PACKAGE') {
                    timeoutMs = 60000; // 60s for build
                } else if (event === 'REQUEST_FINALIZE_UPLOAD') {
                    timeoutMs = 60000; // 60s for upload
                } else if (event === 'REQUEST_DOWNLOAD_DRIVER') {
                    timeoutMs = 15000; 
                } else if (event === 'REQUEST_FIX_SCHEMA' || event === 'REQUEST_VALIDATE_SCHEMA') {
                    timeoutMs = 15000;
                }

                return new Promise<NextResponse>((resolve) => {
                    let isResolved = false;

                    const cleanup = () => {
                        if (!isResolved) return; // Should not happen if logic is correct
                        EventHub.off(responseEvent, listener);
                    };

                    const timeout = setTimeout(() => {
                        if (isResolved) return;
                        isResolved = true;
                        console.warn(`[API] Timeout waiting for ${responseEvent} after ${timeoutMs}ms`);
                        
                        // Cleanup listener
                        EventHub.off(responseEvent, listener);
                        
                        resolve(NextResponse.json({ 
                            error: 'Gateway Timeout - Plugin did not respond in time',
                            code: 'TIMEOUT'
                        }, { status: 504 }));
                    }, timeoutMs);

                    const listener = (payload: any) => {
                        if (isResolved) return;
                        
                        // Suppress noisy chunk upload logs
                        if (responseEvent !== 'RESPONSE_UPLOAD_CHUNK') {
                            console.log(`[API] Received ${responseEvent}, resolving.`, payload);
                        }
                        
                        isResolved = true;
                        clearTimeout(timeout);
                        
                        // Cleanup listener immediately
                        EventHub.off(responseEvent, listener);
                        
                        resolve(NextResponse.json(payload));
                    };

                    EventHub.on(responseEvent, listener);

                    // Emit to internal listeners (Server-Side Loader) with user context
                    EventHub.emit(event, pluginId, 'success', data, userContext);
                });
            }

            return NextResponse.json({ success: true });
        }

        // Case 2: Specialized Actions (Lock/Unlock)
        switch (action) {
            case 'lock': {
                const index = registry.findIndex((p: any) => p.id === pluginId);
                if (index !== -1) {
                    registry[index].locked = true;
                    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
                    broadcastSystemEvent({
                        event: 'PLUGIN_LOCKED',
                        data: { pluginId, status: 'success' },
                        timestamp: new Date().toISOString()
                    });
                    return NextResponse.json({ success: true });
                }
                return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
            }

            case 'unlock-init': {
                const newPin = Math.floor(1000 + Math.random() * 9000).toString();
                activeChallenges.set(pluginId, newPin);

                broadcastSystemEvent({
                    event: 'PLUGIN_UNLOCK_CHALLENGE',
                    data: { pluginId, pin: newPin, status: 'success' },
                    timestamp: new Date().toISOString()
                });

                return NextResponse.json({ success: true, challengeInitiated: true });
            }

            case 'unlock-verify': {
                const expectedPin = activeChallenges.get(pluginId);
                if (pin === expectedPin) {
                    const index = registry.findIndex((p: any) => p.id === pluginId);
                    if (index !== -1) {
                        registry[index].locked = false;
                        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
                        activeChallenges.delete(pluginId);

                        broadcastSystemEvent({
                            event: 'PLUGIN_UNLOCKED',
                            data: { pluginId, status: 'success' },
                            timestamp: new Date().toISOString()
                        });

                        return NextResponse.json({ success: true });
                    }
                }
                return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
