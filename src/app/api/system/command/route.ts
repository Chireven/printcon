import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { broadcastSystemEvent } from '../events/route';

// In-memory store for active unlock challenges
const activeChallenges = new Map<string, string>();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, pluginId, pin, event, data } = body;

        const registryPath = path.join(process.cwd(), 'src/core/registry.json');
        let registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

        // Case 1: Generic Event (Bridge for install/delete/etc)
        if (event) {
            broadcastSystemEvent({ event, data, timestamp: new Date().toISOString() });
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
