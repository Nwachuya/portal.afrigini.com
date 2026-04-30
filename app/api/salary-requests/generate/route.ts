import { NextRequest, NextResponse } from 'next/server';
import { createAdminPb } from '@/lib/server/pb';
import { computePlatformFeeUsd, formatISODate, getDueDateForMonth, getMonthRange } from '@/lib/server/salary';

export const dynamic = 'force-dynamic';

type SalarySchedule = {
  id: string;
  org_id: string;
  placement_id: string;
  candidate_id: string;
  amount_usd: number;
  cadence: string;
  day_of_month: number;
  effective_from: string;
  effective_to?: string;
  status: string;
};

type Placement = {
  id: string;
  org_id: string;
  status: string;
  start_date: string;
  end_date?: string;
};

function isIsoBeforeOrEqual(a: string, b: string): boolean {
  return new Date(a).getTime() <= new Date(b).getTime();
}

function isIsoAfterOrEqual(a: string, b: string): boolean {
  return new Date(a).getTime() >= new Date(b).getTime();
}

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

    const now = new Date();
    const dayOfMonth = now.getUTCDate();
    const { start: periodStart, end: periodEnd } = getMonthRange(now);

    const adminPb = await createAdminPb();

    // 1) Mark overdue requests (small batch; rerun daily).
    const pending = await adminPb.collection('salary_payment_requests').getList(1, 200, {
      filter: `status = "pending_payment" && due_date < "${formatISODate(now)}"`,
      requestKey: null,
    }).catch(() => null);

    if (pending?.items?.length) {
      await Promise.all(
        pending.items.map((item: any) =>
          adminPb.collection('salary_payment_requests').update(item.id, { status: 'overdue' }, { requestKey: null })
        )
      );
    }

    // 2) Generate new requests for schedules that match today.
    const schedules = await adminPb.collection('salary_schedules').getFullList<SalarySchedule>({
      filter: `status = "active" && cadence = "monthly" && day_of_month = ${dayOfMonth}`,
      requestKey: null,
    });

    let created = 0;
    let skipped = 0;

    for (const schedule of schedules) {
      // Effective window check
      if (!schedule.effective_from || !isIsoBeforeOrEqual(schedule.effective_from, formatISODate(periodEnd))) {
        skipped += 1;
        continue;
      }
      if (schedule.effective_to && !isIsoAfterOrEqual(schedule.effective_to, formatISODate(periodStart))) {
        skipped += 1;
        continue;
      }

      let placement: Placement | null = null;
      try {
        placement = await adminPb.collection('placements').getOne<Placement>(schedule.placement_id, { requestKey: null });
      } catch {
        skipped += 1;
        continue;
      }

      if (placement.status !== 'active') {
        skipped += 1;
        continue;
      }

      const dueDate = getDueDateForMonth(now, schedule.day_of_month);

      // Ensure we don't create duplicates for the same schedule+month.
      const existing = await adminPb.collection('salary_payment_requests').getList(1, 1, {
        filter: `salary_schedule_id = "${schedule.id}" && period_start >= "${formatISODate(periodStart)}" && period_start <= "${formatISODate(periodEnd)}"`,
        requestKey: null,
      });

      if (existing.items.length) {
        skipped += 1;
        continue;
      }

      const salaryAmountUsd = Number(schedule.amount_usd || 0);
      const platformFeeUsd = computePlatformFeeUsd(salaryAmountUsd);
      const providerFeeUsd = 0;
      const totalDueUsd = Math.round((salaryAmountUsd + platformFeeUsd + providerFeeUsd) * 100) / 100;

      await adminPb.collection('salary_payment_requests').create(
        {
          org_id: schedule.org_id,
          placement_id: schedule.placement_id,
          salary_schedule_id: schedule.id,
          period_start: formatISODate(periodStart),
          period_end: formatISODate(periodEnd),
          due_date: formatISODate(dueDate),
          salary_amount_usd: salaryAmountUsd,
          platform_fee_usd: platformFeeUsd,
          provider_fee_usd: providerFeeUsd,
          total_due_usd: totalDueUsd,
          status: 'pending_payment',
          // payment_method chosen later
          stripe_session_id: '',
          stablecoin_deposit_id: '',
          paid_at: '',
        },
        { requestKey: null }
      );
      created += 1;
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (error) {
    console.error('salary-requests/generate error:', error);
    return NextResponse.json({ error: 'Failed to generate salary requests' }, { status: 500 });
  }
}
