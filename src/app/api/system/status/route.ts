import { NextResponse } from 'next/server';
import { SystemStatus } from '../../../../core/system-status';

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(SystemStatus.getAll());
}
