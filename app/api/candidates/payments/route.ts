import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/request-auth';
import { createAdminPb, createUserPb } from '@/lib/server/pb';
import type {
  CandidateDepositRow,
  CandidatePaymentRequestRow,
  CandidatePayoutProfileRecord,
  CandidatePayoutRecord,
  CandidatePayoutRow,
  CandidatePlacementEligibility,
  CandidateProfileRecord,
  PlacementRecord,
  PlacedPaymentsOverview,
  SalaryPaymentRequestRecord,
  SalaryScheduleRecord,
  StablecoinDepositRecord,
} from '@/types';

export const dynamic = 'force-dynamic';

function esc(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

type View = 'eligibility' | 'overview' | 'schedule' | 'requests' | 'deposits' | 'payouts' | 'profile';

async function resolveCandidateContext(pb: any, userId: string): Promise<CandidatePlacementEligibility> {
  let candidate;
  try {
    candidate = await pb.collection('candidates').getFirstListItem<CandidateProfileRecord>(
      `user = "${esc(userId)}"`,
      { requestKey: null }
    );
  } catch (err) {
    return {
      eligible: false,
      candidateId: '',
      reason: 'Please complete your profile to access payment features.',
    };
  }

  const activePlacements = await pb.collection('placements').getFullList<PlacementRecord>({
    filter: `candidate_id = "${esc(candidate.id)}" && status = "active"`,
    sort: '-created',
    requestKey: null,
  });

  if (!activePlacements.length) {
    return {
      eligible: false,
      candidateId: candidate.id,
      reason: 'Payments become available after an active placement is created.',
    };
  }

  const placement = activePlacements[0];
  return {
    eligible: true,
    candidateId: candidate.id,
    placementId: placement.id,
    orgId: placement.org_id,
  };
}

async function getOverview(pb: any, candidateId: string, placementId: string): Promise<PlacedPaymentsOverview> {
  const requests = await pb.collection('salary_payment_requests').getFullList<SalaryPaymentRequestRecord>({
    filter: `placement_id = "${esc(placementId)}"`,
    sort: '-created',
    requestKey: null,
  });
  const payouts = await pb.collection('candidate_payouts').getFullList<CandidatePayoutRecord>({
    filter: `candidate_id = "${esc(candidateId)}" && placement_id = "${esc(placementId)}"`,
    sort: '-created',
    requestKey: null,
  });

  return {
    pendingRequests: requests.filter((x: any) => x.status === 'pending_payment' || x.status === 'overdue').length,
    fundedRequests: requests.filter((x: any) => x.status === 'paid').length,
    queuedPayouts: payouts.filter((x: any) => x.status === 'queued' || x.status === 'processing').length,
    completedPayouts: payouts.filter((x: any) => x.status === 'paid').length,
    latestRequestAt: requests[0]?.created,
    latestPayoutAt: payouts[0]?.created,
  };
}

async function getSchedules(pb: any, candidateId: string, placementId: string): Promise<SalaryScheduleRecord[]> {
  return pb.collection('salary_schedules').getFullList<SalaryScheduleRecord>({
    filter: `candidate_id = "${esc(candidateId)}" && placement_id = "${esc(placementId)}"`,
    sort: '-created',
    requestKey: null,
  });
}

async function getRequests(pb: any, placementId: string): Promise<CandidatePaymentRequestRow[]> {
  const requests = await pb.collection('salary_payment_requests').getFullList<SalaryPaymentRequestRecord>({
    filter: `placement_id = "${esc(placementId)}"`,
    sort: '-created',
    requestKey: null,
  });
  const requestIds = requests.map((request) => request.id);
  const deposits = requestIds.length
    ? await pb.collection('stablecoin_deposits').getFullList<StablecoinDepositRecord>({
        filter: requestIds.map((id) => `salary_payment_request_id = "${esc(id)}"`).join(' || '),
        sort: '-created',
        requestKey: null,
      })
    : [];

  const unifiedPayments = requestIds.length
    ? await pb.collection('payments').getFullList<any>({
        filter: requestIds.map((id) => `salary_payment_request_id = "${esc(id)}"`).join(' || '),
        sort: '-created',
        requestKey: null,
      })
    : [];

  const depositsByRequestId = new Map(deposits.map((deposit) => [deposit.salary_payment_request_id, deposit]));
  const paymentsByRequestId = new Map(unifiedPayments.map((p) => [p.salary_payment_request_id, p]));

  return requests.map((request) => {
    const deposit = depositsByRequestId.get(request.id);
    const payment = paymentsByRequestId.get(request.id);

    return {
      id: request.id,
      periodStart: request.period_start,
      periodEnd: request.period_end,
      dueDate: request.due_date,
      totalDueUsd: request.total_due_usd,
      salaryAmountUsd: request.salary_amount_usd,
      paymentMethod: request.payment_method || 'stripe',
      requestStatus: request.status,
      depositStatus: deposit?.status || (payment ? 'paid' : null),
      depositId: deposit?.id || payment?.id || null,
    };
  });
}

async function getDeposits(pb: any, placementId: string): Promise<CandidateDepositRow[]> {
  const requests = await pb.collection('salary_payment_requests').getFullList<SalaryPaymentRequestRecord>({
    filter: `placement_id = "${esc(placementId)}"`,
    sort: '-created',
    requestKey: null,
  });
  const requestIds = requests.map((request) => request.id);
  const deposits = requestIds.length
    ? await pb.collection('stablecoin_deposits').getFullList<StablecoinDepositRecord>({
        filter: requestIds.map((id) => `salary_payment_request_id = "${esc(id)}"`).join(' || '),
        sort: '-created',
        requestKey: null,
      })
    : [];

  return deposits.map((deposit) => ({
    id: deposit.id,
    requestId: deposit.salary_payment_request_id,
    asset: deposit.asset,
    chain: deposit.chain,
    provider: deposit.provider,
    expectedUsd: deposit.amount_expected_usd,
    receivedUsd: deposit.amount_received_usd || null,
    txHash: deposit.tx_hash || null,
    status: deposit.status,
    created: deposit.created,
  }));
}

async function getPayouts(pb: any, candidateId: string, placementId: string): Promise<CandidatePayoutRow[]> {
  const rows = await pb.collection('candidate_payouts').getFullList<CandidatePayoutRecord>({
    filter: `candidate_id = "${esc(candidateId)}" && placement_id = "${esc(placementId)}"`,
    sort: '-created',
    requestKey: null,
  });

  return rows.map((row) => ({
    id: row.id,
    salaryPaymentRequestId: row.salary_payment_request_id,
    amountUsd: row.amount_usd,
    amountLocal: row.amount_local,
    currencyLocal: row.currency_local,
    status: row.status,
    provider: row.provider,
    providerRef: row.provider_ref || null,
    executedAt: row.executed_at || null,
    created: row.created,
  }));
}

async function getCandidateProfile(pb: any, candidateId: string): Promise<CandidatePayoutProfileRecord | null> {
  try {
    return await pb.collection('candidate_payout_profiles').getFirstListItem<CandidatePayoutProfileRecord>(
      `candidate_id = "${esc(candidateId)}"`,
      { requestKey: null }
    );
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth?.pbToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPb = createUserPb(auth.pbToken);
    let authenticatedUserId = auth.userId;
    if (!authenticatedUserId) {
      const refresh = await userPb.collection('users').authRefresh({ requestKey: null });
      authenticatedUserId = refresh.record?.id || '';
    }

    const me = await userPb.collection('users').getOne(authenticatedUserId, { requestKey: null });
    if (me?.role !== 'Applicant') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // IMPORTANT: If candidates cannot see stablecoin_deposits or salary_schedules yet due to rules,
    // we use an admin client for these SPECIFIC retrievals.
    // However, for profile, placements, payments, and payouts, the candidate client is sufficient.
    const adminPb = await createAdminPb();
    const view = (request.nextUrl.searchParams.get('view') || 'overview') as View;
    const context = await resolveCandidateContext(userPb, authenticatedUserId);

    if (view === 'eligibility') {
      return NextResponse.json({ context });
    }

    const candidateId = context.candidateId || '';
    const placementId = context.placementId || '';

    switch (view) {
      case 'overview':
        if (!candidateId || !placementId) return NextResponse.json({ context, data: { pendingRequests: 0, fundedRequests: 0, queuedPayouts: 0, completedPayouts: 0 } });
        return NextResponse.json({ context, data: await getOverview(userPb, candidateId, placementId) });
      case 'schedule':
        if (!candidateId || !placementId) return NextResponse.json({ context, data: [] });
        // Schedules might still need admin auth if rules aren't updated yet
        return NextResponse.json({ context, data: await getSchedules(adminPb, candidateId, placementId) });
      case 'requests':
        if (!placementId) return NextResponse.json({ context, data: [] });
        return NextResponse.json({ context, data: await getRequests(adminPb, placementId) });
      case 'deposits':
        if (!placementId) return NextResponse.json({ context, data: [] });
        return NextResponse.json({ context, data: await getDeposits(adminPb, placementId) });
      case 'payouts':
        if (!candidateId || !placementId) return NextResponse.json({ context, data: [] });
        return NextResponse.json({ context, data: await getPayouts(userPb, candidateId, placementId) });
      case 'profile':
        if (!candidateId) return NextResponse.json({ context, data: null });
        return NextResponse.json({ context, data: await getCandidateProfile(userPb, candidateId) });
      default:
        return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
    }
  } catch (error) {
    console.error('Candidate payments API error:', error);
    return NextResponse.json({ error: 'Failed to load candidate payments data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth?.pbToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPb = createUserPb(auth.pbToken);
    let authenticatedUserId = auth.userId;
    if (!authenticatedUserId) {
      const refresh = await userPb.collection('users').authRefresh({ requestKey: null });
      authenticatedUserId = refresh.record?.id || '';
    }

    const body = await request.json();
    const { method, country, currency, details } = body;

    if (!method || !country || !currency || !details) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const candidate = await userPb.collection('candidates').getFirstListItem(
      `user = "${esc(authenticatedUserId)}"`,
      { requestKey: null }
    );

    let existingProfile = await getCandidateProfile(userPb, candidate.id);

    let result;
    if (existingProfile) {
      result = await userPb.collection('candidate_payout_profiles').update(existingProfile.id, {
        method,
        country,
        currency,
        details,
        status: 'draft', // Reset to draft for re-verification
      });
    } else {
      result = await userPb.collection('candidate_payout_profiles').create({
        candidate_id: candidate.id,
        user_id: authenticatedUserId,
        method,
        country,
        currency,
        details,
        status: 'draft',
      });
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Candidate payments profile update error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update payout profile' }, { status: 500 });
  }
}
