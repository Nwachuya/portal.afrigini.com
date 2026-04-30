import PocketBase from 'pocketbase';

type SalaryPaymentRequest = {
  id: string;
  org_id: string;
  placement_id: string;
  salary_amount_usd: number;
};

type Placement = {
  id: string;
  org_id: string;
  candidate_id: string;
  status: string;
};

type CandidatePayoutProfile = {
  id: string;
  candidate_id: string;
  status: string;
  currency: string;
};

export async function enqueueCandidatePayoutForSalaryRequest(
  adminPb: PocketBase,
  salaryPaymentRequestId: string
): Promise<{ enqueued: boolean; reason?: string; payoutId?: string }> {
  const existing = await adminPb.collection('candidate_payouts').getList(1, 1, {
    filter: `salary_payment_request_id = "${salaryPaymentRequestId}"`,
    requestKey: null,
  });
  if (existing.items.length) {
    return { enqueued: false, reason: 'already_exists' };
  }

  const salaryRequest = await adminPb
    .collection('salary_payment_requests')
    .getOne<SalaryPaymentRequest>(salaryPaymentRequestId, { requestKey: null });

  const placement = await adminPb.collection('placements').getOne<Placement>(salaryRequest.placement_id, {
    requestKey: null,
  });

  if (placement.status !== 'active') {
    return { enqueued: false, reason: 'placement_not_active' };
  }

  const profile = await adminPb.collection('candidate_payout_profiles').getFirstListItem<CandidatePayoutProfile>(
    `candidate_id = "${placement.candidate_id}" && status = "verified"`,
    { requestKey: null }
  ).catch(() => null);

  if (!profile?.id) {
    // Keep unpaid payout uncreated; ops can fix candidate payout profile first.
    return { enqueued: false, reason: 'missing_verified_profile' };
  }

  const amountUsd = Number(salaryRequest.salary_amount_usd || 0);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { enqueued: false, reason: 'invalid_amount' };
  }

  const payout = await adminPb.collection('candidate_payouts').create(
    {
      org_id: salaryRequest.org_id,
      placement_id: placement.id,
      salary_payment_request_id: salaryRequest.id,
      candidate_id: placement.candidate_id,
      payout_profile_id: profile.id,
      amount_usd: Math.round(amountUsd * 100) / 100,
      currency_local: profile.currency,
      amount_local: 0,
      fx_rate: 0,
      status: 'queued',
      provider: 'bridge',
      provider_ref: '',
      error_message: '',
      executed_at: '',
    },
    { requestKey: null }
  );

  return { enqueued: true, payoutId: payout.id };
}

