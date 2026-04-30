import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminPb } from '@/lib/server/pb';
import { enqueueCandidatePayoutForSalaryRequest } from '@/lib/server/payouts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !stripeWebhookSecret) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-01-28.clover' });

  let event: Stripe.Event;
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') || '';
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const salaryPaymentRequestId = String(session?.metadata?.salary_payment_request_id || '');

      if (salaryPaymentRequestId) {
        const adminPb = await createAdminPb();
        const orgId = String(session?.metadata?.orgId || '');
        
        await adminPb.collection('salary_payment_requests').update(
          salaryPaymentRequestId,
          { status: 'paid', paid_at: new Date().toISOString() },
          { requestKey: null }
        );

        // Log to unified payments ledger
        await adminPb.collection('payments').create({
          org_id: orgId,
          amount: session.amount_total || 0,
          status: 'allocated',
          payment_method: 'stripe',
          payment_id: String(session.payment_intent || ''),
          payer_email: session.customer_details?.email || '',
          invoice_url: '', // Stripe handles receipts via payment intent/invoice objects later
          time_allocated: new Date().toISOString(),
          salary_payment_request_id: salaryPaymentRequestId,
        });

        await enqueueCandidatePayoutForSalaryRequest(adminPb, salaryPaymentRequestId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

