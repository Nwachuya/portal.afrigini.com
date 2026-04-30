import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/request-auth';
import { createAdminPb, createUserPb } from '@/lib/server/pb';
import { assertOrgBillingAccess } from '@/lib/server/org-access';
import { getStablecoinChain, getStablecoinDepositAddress } from '@/lib/server/stablecoin';

export const dynamic = 'force-dynamic';

type Body = { asset?: 'USDC' | 'USDT' };

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth?.pbToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPb = createUserPb(auth.pbToken);
    let authenticatedUserId = auth.userId;
    if (!authenticatedUserId) {
      const refreshed = await userPb.collection('users').authRefresh({ requestKey: null });
      authenticatedUserId = refreshed?.record?.id || '';
    }
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestId = params.id;
    if (!requestId) {
      return NextResponse.json({ error: 'Missing salary request id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const asset = body.asset === 'USDT' ? 'USDT' : 'USDC';

    const salaryRequest = await userPb.collection('salary_payment_requests').getOne(requestId, { requestKey: null });
    const orgId = String(salaryRequest?.org_id || '');
    const status = String(salaryRequest?.status || '');
    const totalDueUsd = Number(salaryRequest?.total_due_usd || 0);

    if (!orgId) {
      return NextResponse.json({ error: 'Invalid salary request' }, { status: 400 });
    }

    await assertOrgBillingAccess(userPb, authenticatedUserId, orgId);

    if (status !== 'pending_payment') {
      return NextResponse.json({ error: 'Salary request is not payable' }, { status: 409 });
    }

    if (!Number.isFinite(totalDueUsd) || totalDueUsd <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const depositAddress = getStablecoinDepositAddress(asset);
    const chain = getStablecoinChain();

    const adminPb = await createAdminPb();
    const deposit = await adminPb.collection('stablecoin_deposits').create(
      {
        org_id: orgId,
        salary_payment_request_id: requestId,
        asset,
        chain,
        provider: 'bridge',
        deposit_address: depositAddress,
        amount_expected_usd: Math.round(totalDueUsd * 100) / 100,
        status: 'awaiting_payment',
      },
      { requestKey: null }
    );

    await adminPb.collection('salary_payment_requests').update(
      requestId,
      { payment_method: 'stablecoin', stablecoin_deposit_id: deposit.id },
      { requestKey: null }
    );

    return NextResponse.json({
      depositId: deposit.id,
      asset,
      chain,
      address: depositAddress,
      amountUsd: Math.round(totalDueUsd * 100) / 100,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to create deposit';
    const status = message === 'FORBIDDEN' ? 403 : 500;
    if (status === 500) console.error('salary-requests pay stablecoin error:', error);
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : message }, { status });
  }
}

