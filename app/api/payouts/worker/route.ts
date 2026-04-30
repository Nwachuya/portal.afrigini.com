import { NextRequest, NextResponse } from 'next/server';
import { createAdminPb } from '@/lib/server/pb';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const provided = request.headers.get('x-cron-secret') || '';
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Placeholder worker: we enqueue payouts on payment, but actual Bridge payout execution
    // depends on provider credentials and recipient schema.
    const enabled = process.env.PAYOUTS_ENABLED === 'true';
    if (!enabled) {
      return NextResponse.json({ ok: true, processed: 0, skipped: 'PAYOUTS_ENABLED is not true' });
    }

    const adminPb = await createAdminPb();
    const queued = await adminPb.collection('candidate_payouts').getList(1, 50, {
      filter: `status = "queued"`,
      requestKey: null,
    });

    // Until Bridge payout integration is wired, leave queued payouts as-is.
    return NextResponse.json({ ok: true, queued: queued.items.length, processed: 0 });
  } catch (error) {
    console.error('Payout worker error:', error);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}

