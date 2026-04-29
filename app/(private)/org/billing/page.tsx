'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink, RefreshCcw } from 'lucide-react';
import pb from '@/lib/pocketbase';
import { OrgRole, UserRecord } from '@/types';
import { canAccessBilling, getDefaultOrgPath } from '@/lib/access';
import { getCurrentOrgMembership } from '@/lib/org-membership';

interface Plan {
  id: string;
  plan: string;
  cost: number;
  credit: number;
  price_id: string;
  payment_link?: string;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  invoice_url: string;
  created: string;
  payer_email: string;
}

type OrgAdminRecord = {
  id: string;
  job_credit?: number;
};

type BannerState = {
  text: string;
  type: '' | 'success' | 'error' | 'info';
};

type PaymentLoadState = {
  error: string;
  loading: boolean;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getCheckoutMode(plan: Plan) {
  if (plan.price_id) {
    return {
      label: 'App Checkout',
      tone: 'border-brand-green/15 bg-brand-green/10 text-brand-green',
    };
  }

  if (plan.payment_link) {
    return {
      label: 'Legacy Link',
      tone: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    };
  }

  return {
    label: 'Needs Setup',
    tone: 'border-red-200 bg-red-50 text-red-700',
  };
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [banner, setBanner] = useState<BannerState>({ text: '', type: '' });

  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [memberRole, setMemberRole] = useState<OrgRole | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [credits, setCredits] = useState<number>(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansError, setPlansError] = useState('');
  const [orgError, setOrgError] = useState('');

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [paymentLoadState, setPaymentLoadState] = useState<PaymentLoadState>({
    error: '',
    loading: false,
  });

  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  const perPage = 5;
  const totalPages = Math.ceil(totalPayments / perPage);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setBanner({
        text: 'Payment completed. Credits are processed separately and may take a moment to appear below.',
        type: 'success',
      });
    } else if (searchParams.get('canceled') === 'true') {
      setBanner({
        text: 'Payment was canceled before checkout completed.',
        type: 'error',
      });
    }
  }, [searchParams]);

  useEffect(() => {
    void loadBilling(true);
  }, [router]);

  useEffect(() => {
    if (!orgId) {
      return;
    }

    void loadPayments(orgId, paymentsPage);
  }, [orgId, paymentsPage]);

  const loadBilling = async (initial = false) => {
    if (!initial) {
      setRefreshing(true);
    }

    try {
      setOrgError('');
      setPlansError('');

      const user = pb.authStore.model as unknown as UserRecord;
      if (!user) {
        router.push('/login');
        return;
      }

      setUserEmail(user.email || '');

      const memberRes = await getCurrentOrgMembership(user.id, 'organization');

      if (!(memberRes && memberRes.organization && canAccessBilling(memberRes.role))) {
        if (memberRes?.role) {
          router.replace(getDefaultOrgPath(memberRes.role));
          return;
        }

        setOrgError('No billing-enabled organization membership was found for your account.');
        return;
      }

      const organizationId = memberRes.organization;
      setOrgId(organizationId);
      setMemberRole(memberRes.role ?? null);

      let resolvedOrgName = 'Organization';
      let resolvedCredits = 0;
      const expandedOrg = memberRes.expand?.organization as
        | { id?: string; name?: string }
        | undefined;

      if (expandedOrg?.name) {
        resolvedOrgName = expandedOrg?.name || resolvedOrgName;
      } else {
        try {
          const organization = await pb.collection('orgs').getOne(organizationId, {
            requestKey: null,
          });
          resolvedOrgName = organization.name || resolvedOrgName;
        } catch (error) {
          console.error('Error loading organization details for billing:', error);
        }
      }

      try {
        const orgAdmin = await pb.collection('org_admin').getFirstListItem<OrgAdminRecord>(
          `org = "${organizationId}"`,
          { requestKey: null }
        );
        resolvedCredits = orgAdmin?.job_credit || 0;
      } catch (error) {
        console.error('Error loading organization credit details for billing:', error);
      }

      setOrgName(resolvedOrgName);
      setCredits(resolvedCredits);

      try {
        const plansRes = await pb.collection('plans').getFullList<Plan>({
          sort: 'cost',
          requestKey: null,
        });
        setPlans(plansRes);
      } catch (error) {
        console.error('Error loading plans:', error);
        setPlans([]);
        setPlansError('We could not load available credit packs right now.');
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
      setOrgError('We could not load your billing workspace. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPayments = async (organizationId: string, page: number) => {
    setPaymentLoadState({ error: '', loading: true });

    try {
      const res = await pb.collection('payments').getList<Payment>(page, perPage, {
        filter: `org_id = "${organizationId}"`,
        sort: '-created',
        requestKey: null,
      });
      setPayments(res.items);
      setTotalPayments(res.totalItems);
      setPaymentLoadState({ error: '', loading: false });
    } catch (error) {
      console.error('Error loading payments:', error);
      setPayments([]);
      setTotalPayments(0);
      setPaymentLoadState({
        error: 'We could not load payment history right now.',
        loading: false,
      });
    }
  };

  const handleBuyCredits = async (plan: Plan) => {
    if (!orgId) {
      setBanner({
        text: 'Your organization could not be resolved for checkout.',
        type: 'error',
      });
      return;
    }

    if (!canAccessBilling(memberRole)) {
      setBanner({
        text: 'Your current role does not have permission to purchase credits.',
        type: 'error',
      });
      return;
    }

    if (!plan.price_id && !plan.payment_link) {
      setBanner({
        text: 'This plan is not configured for checkout yet.',
        type: 'error',
      });
      return;
    }

    setProcessing(plan.id);
    setBanner({ text: '', type: '' });

    try {
      if (plan.payment_link && !plan.price_id) {
        window.location.assign(plan.payment_link);
        return;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (pb.authStore.token) {
        headers.Authorization = `Bearer ${pb.authStore.token}`;
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({
          orgId,
          priceId: plan.price_id,
          userEmail,
          orgName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      window.location.assign(data.url);
    } catch (err: any) {
      console.error('Checkout error:', err);
      setBanner({
        text: err.message || 'Failed to start checkout.',
        type: 'error',
      });
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500">
        Loading billing...
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800">
          {orgError || 'Could not load organization.'}
        </div>
      </div>
    );
  }

  const balanceStatus =
    credits > 0
      ? 'You have credits available for new job posts.'
      : 'You have no credits available. Purchase a pack to post new roles.';
  const canPurchaseCredits = canAccessBilling(memberRole);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-brand-green/10 bg-white px-6 py-7 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-brand-green font-bold tracking-[0.2em] uppercase text-xs">Organization</span>
          <h1 className="mt-2 text-3xl font-bold text-brand-dark">Billing</h1>
          <p className="mt-1 text-gray-500">
            Manage credits and payment history for{' '}
            <span className="font-semibold text-brand-dark">{orgName}</span>.
          </p>
          {memberRole && (
            <p className="mt-3 inline-flex rounded-full border border-brand-green/15 bg-brand-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-green">
              {memberRole} access
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void loadBilling(false)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-green/20 bg-white px-4 py-2.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-green/5 disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {banner.text && (
        <div
          className={`rounded-xl border px-5 py-4 text-sm font-medium ${
            banner.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : banner.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-brand-green/15 bg-brand-green/5 text-brand-dark'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-gray-500">Current Balance</p>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-5xl font-bold text-brand-dark">{credits}</span>
              <span className="text-sm font-medium text-gray-500">Job Credits</span>
            </div>
            <p className="mt-3 text-sm text-gray-500">{balanceStatus}</p>
          </div>

          <div className="rounded-2xl border border-brand-green/10 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-gray-500">Billing Context</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-gray-500">Organization</dt>
                <dd className="text-right font-medium text-brand-dark">{orgName}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-gray-500">Access role</dt>
                <dd className="text-right font-medium capitalize text-brand-dark">{memberRole || 'Unknown'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-gray-500">Checkout email</dt>
                <dd className="max-w-[170px] break-words text-right font-medium text-brand-dark">{userEmail}</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className="space-y-8">
          <section className="rounded-2xl border border-brand-green/10 bg-white shadow-sm">
            <div className="border-b border-brand-green/10 p-6">
              <h2 className="text-lg font-semibold text-brand-dark">Purchase More Credits</h2>
              <p className="mt-1 text-sm text-gray-500">
                Billing and owner roles can purchase credit packs for this organization.
              </p>
            </div>

            <div className="p-6">
              {plansError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {plansError}
                </div>
              ) : plans.length === 0 ? (
                <div className="rounded-xl border border-brand-green/10 bg-brand-green/5 px-4 py-8 text-center text-sm text-gray-600">
                  No credit packs are available right now.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {plans.map((plan, index) => (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col rounded-2xl border p-5 shadow-sm ${
                        index === plans.length - 1
                          ? 'border-brand-green bg-brand-green/5'
                          : 'border-brand-green/10 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold text-brand-dark">{plan.plan}</h3>
                        {index === plans.length - 1 && (
                          <span className="rounded-full bg-brand-green px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                            Best Value
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{plan.credit} Credits</p>

                      <span
                        className={`mt-4 inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getCheckoutMode(plan).tone}`}
                      >
                        {getCheckoutMode(plan).label}
                      </span>

                      <p className="mt-6 text-3xl font-bold text-brand-dark">
                        {formatCurrency(plan.cost)}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        ${(plan.cost / Math.max(plan.credit, 1) / 100).toFixed(2)} per credit
                      </p>
                      {!plan.price_id && (
                        <p className="mt-3 text-sm text-yellow-700">
                          This pack needs a Stripe price id before credits can be allocated automatically.
                        </p>
                      )}

                      <button
                        onClick={() => handleBuyCredits(plan)}
                        disabled={processing !== null || !canPurchaseCredits || (!plan.price_id && !plan.payment_link)}
                        className="mt-6 w-full rounded-lg bg-brand-green px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-60"
                      >
                        {processing === plan.id
                          ? 'Redirecting...'
                          : plan.payment_link && !plan.price_id
                            ? 'Open Checkout'
                            : 'Purchase'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-brand-green/10 bg-white shadow-sm">
            <div className="border-b border-brand-green/10 p-6">
              <h2 className="text-lg font-semibold text-brand-dark">Payment History</h2>
              <p className="mt-1 text-sm text-gray-500">
                Previous Stripe payments and available receipts for this organization.
              </p>
            </div>

            <div className="p-6">
              {paymentLoadState.loading ? (
                <p className="py-4 text-center text-gray-500">Loading payments...</p>
              ) : paymentLoadState.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {paymentLoadState.error}
                </div>
              ) : payments.length === 0 ? (
                <div className="rounded-xl border border-brand-green/10 bg-brand-green/5 px-4 py-8 text-center text-sm text-gray-600">
                  No payments yet.
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full">
                      <thead className="border-b border-brand-green/10 bg-brand-green/5 text-left text-sm text-gray-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Payer</th>
                          <th className="px-4 py-3 text-right font-medium">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brand-green/10">
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-brand-green/5 transition-colors">
                            <td className="px-4 py-4 text-sm text-brand-dark">{formatDate(payment.created)}</td>
                            <td className="px-4 py-4 text-sm font-medium text-brand-dark">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="px-4 py-4">
                              <PaymentStatus status={payment.status} />
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-500">{payment.payer_email || '—'}</td>
                            <td className="px-4 py-4 text-right">
                              {payment.invoice_url ? (
                                <button
                                  onClick={() => setInvoiceUrl(payment.invoice_url)}
                                  className="text-sm font-medium text-brand-green hover:text-green-800"
                                >
                                  View Receipt
                                </button>
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-4 md:hidden">
                    {payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-2xl border border-brand-green/10 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-gray-500">{formatDate(payment.created)}</p>
                            <p className="mt-1 text-lg font-semibold text-brand-dark">
                              {formatCurrency(payment.amount)}
                            </p>
                          </div>
                          <PaymentStatus status={payment.status} />
                        </div>
                        <p className="mt-3 text-sm text-gray-500">
                          {payment.payer_email || 'No payer email recorded'}
                        </p>
                        {payment.invoice_url && (
                          <button
                            onClick={() => setInvoiceUrl(payment.invoice_url)}
                            className="mt-4 text-sm font-medium text-brand-green hover:text-green-800"
                          >
                            View Receipt
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-6 flex flex-col gap-3 border-t border-brand-green/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-gray-500">
                        Showing {((paymentsPage - 1) * perPage) + 1} to{' '}
                        {Math.min(paymentsPage * perPage, totalPayments)} of {totalPayments}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPaymentsPage((page) => Math.max(1, page - 1))}
                          disabled={paymentsPage === 1}
                          className="rounded-lg border border-brand-green/20 px-3 py-1.5 text-sm text-brand-dark transition-colors hover:bg-brand-green/5 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setPaymentsPage((page) => Math.min(totalPages, page + 1))}
                          disabled={paymentsPage === totalPages}
                          className="rounded-lg border border-brand-green/20 px-3 py-1.5 text-sm text-brand-dark transition-colors hover:bg-brand-green/5 disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {invoiceUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-brand-green/10 p-4">
              <div>
                <h3 className="font-semibold text-brand-dark">Receipt</h3>
                <p className="text-sm text-gray-500">Preview the Stripe receipt below or open it in a new tab.</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-brand-green/20 px-3 py-2 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-green/5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
                <button
                  onClick={() => setInvoiceUrl(null)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-50 p-4">
              <iframe
                src={invoiceUrl}
                className="h-full w-full rounded-xl border border-brand-green/10 bg-white"
                title="Receipt"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentStatus({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className =
    normalized === 'allocated'
      ? 'border-green-200 bg-green-50 text-green-700'
      : 'border-yellow-200 bg-yellow-50 text-yellow-700';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${className}`}>
      {status}
    </span>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-gray-500">
          Loading billing...
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
