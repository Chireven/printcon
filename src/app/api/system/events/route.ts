import { NextRequest } from 'next/server';

// In-memory store for connected SSE clients
const clients = new Set<(data: string) => void>();

export async function GET(req: NextRequest) {
    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    const sendEvent = (data: any) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        writer.write(encoder.encode(payload));
    };

    clients.add(sendEvent);

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
