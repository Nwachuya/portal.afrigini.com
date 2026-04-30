import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getRequestAuth } from '@/lib/server/request-auth';
import { createAdminPb, createUserPb } from '@/lib/server/pb';
import { assertOrgBillingAccess } from '@/lib/server/org-access';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const auth = await getRequestAuth(request);
    if (!auth?.pbToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userPb = createUserPb(auth.pbToken);
    let authenticatedUserId = auth.userId;
    let authenticatedEmail = auth.email;

    if (!authenticatedUserId) {
      const refreshed = await userPb.collection('users').authRefresh({ requestKey: null });
      authenticatedUserId = refreshed?.record?.id || '';
      authenticatedEmail = refreshed?.record?.email || authenticatedEmail;
    }

    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestId = params.id;
    if (!requestId) {
      return NextResponse.json({ error: 'Missing salary request id' }, { status: 400 });
    }

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

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-01-28.clover' });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Salary payment request',
            },
            unit_amount: Math.round(totalDueUsd * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        orgId,
        salary_payment_request_id: requestId,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/org/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/org/billing?canceled=true`,
      customer_email: authenticatedEmail || undefined,
    });

    const adminPb = await createAdminPb();
    await adminPb.collection('salary_payment_requests').update(
      requestId,
      { payment_method: 'stripe', stripe_session_id: session.id },
      { requestKey: null }
    );

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to start Stripe checkout';
    const status = message === 'FORBIDDEN' ? 403 : 500;
    if (status === 500) console.error('salary-requests pay stripe error:', error);
    return NextResponse.json({ error: status === 403 ? 'Forbidden' : message }, { status });
  }
}

