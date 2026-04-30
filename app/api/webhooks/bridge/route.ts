import { NextRequest, NextResponse } from 'next/server';
import { createAdminPb } from '@/lib/server/pb';
import { enqueueCandidatePayoutForSalaryRequest } from '@/lib/server/payouts';

export const dynamic = 'force-dynamic';

type Body = {
  depositId?: string;
  salaryPaymentRequestId?: string;
  status?: 'confirming' | 'confirmed' | 'failed';
  amountReceivedUsd?: number;
  txHash?: string;
  raw?: any;
};

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.STABLECOIN_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const provided = request.headers.get('x-webhook-secret') || '';
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const depositId = String(body.depositId || '');
    const salaryPaymentRequestId = String(body.salaryPaymentRequestId || '');

    if (!depositId || !salaryPaymentRequestId) {
      return NextResponse.json({ error: 'Missing depositId or salaryPaymentRequestId' }, { status: 400 });
    }

    const status = body.status === 'failed' ? 'failed' : body.status === 'confirming' ? 'confirming' : 'confirmed';
    const amountReceivedUsd = Number(body.amountReceivedUsd || 0);
    const txHash = String(body.txHash || '');

    const adminPb = await createAdminPb();
    await adminPb.collection('stablecoin_deposits').update(
      depositId,
      {
        status,
        amount_received_usd: Number.isFinite(amountReceivedUsd) && amountReceivedUsd > 0 ? amountReceivedUsd : undefined,
        tx_hash: txHash || undefined,
        raw_provider_event: body.raw ?? undefined,
      },
      { requestKey: null }
    );

    if (status === 'confirmed') {
      const deposit = await adminPb.collection('stablecoin_deposits').getOne(depositId, { requestKey: null });

      await adminPb.collection('salary_payment_requests').update(
        salaryPaymentRequestId,
        { status: 'paid', paid_at: new Date().toISOString() },
        { requestKey: null }
      );

      // Log to unified payments ledger
      await adminPb.collection('payments').create({
        org_id: deposit.org_id,
        amount: Number(deposit.amount_expected_usd) * 100, // Stored in cents in ledger
        status: 'allocated',
        payment_method: 'stablecoin',
        stablecoin_deposit_id: depositId,
        tx_hash: txHash || deposit.tx_hash,
        time_allocated: new Date().toISOString(),
      });

      await enqueueCandidatePayoutForSalaryRequest(adminPb, salaryPaymentRequestId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Bridge webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

