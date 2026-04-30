'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CandidatePaymentsShell from '@/components/candidates/payments/CandidatePaymentsShell';
import type { CandidatePayoutRow } from '@/types';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function CandidatePayoutsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockedMessage, setBlockedMessage] = useState('');
  const [rows, setRows] = useState<CandidatePayoutRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/candidates/payments?view=payouts', { credentials: 'include' });
        if (response.status === 401) return router.replace('/login');
        if (response.status === 403) return router.replace('/org/dashboard');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Failed to load payouts');
        setRows((payload?.data || []) as CandidatePayoutRow[]);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load payouts.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8 text-gray-500">Loading payouts...</div>;

  return (
    <CandidatePaymentsShell
      title="Payout History"
      subtitle="Read-only payout lifecycle for your active placement."
      rightLabel="Payouts"
      rightValue={String(rows.length)}
    >
      {error ? (
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-600">No payouts found.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="bg-white border border-gray-200 rounded-xl p-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="font-semibold text-brand-dark break-words">Request {row.salaryPaymentRequestId}</p>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 w-fit">{row.status}</span>
              </div>
              <div className="mt-2 text-sm text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-2">
                <p>USD: {money.format(row.amountUsd || 0)}</p>
                <p>Local: {row.amountLocal || 0} {row.currencyLocal || ''}</p>
                <p>Provider: {row.provider}</p>
              </div>
              <p className="mt-2 text-xs text-gray-500 break-all">
                Ref: {row.providerRef || 'n/a'}{row.executedAt ? ` • Executed ${new Date(row.executedAt).toLocaleDateString()}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </CandidatePaymentsShell>
  );
}
