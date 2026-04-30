'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CandidatePaymentsShell from '@/components/candidates/payments/CandidatePaymentsShell';
import type { CandidatePaymentRequestRow } from '@/types';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function CandidatePaymentRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockedMessage, setBlockedMessage] = useState('');
  const [rows, setRows] = useState<CandidatePaymentRequestRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/candidates/payments?view=requests', { credentials: 'include' });
        if (response.status === 401) return router.replace('/login');
        if (response.status === 403) return router.replace('/org/dashboard');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Failed to load requests');
        setRows((payload?.data || []) as CandidatePaymentRequestRow[]);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load payment requests.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8 text-gray-500">Loading payment requests...</div>;

  return (
    <CandidatePaymentsShell
      title="Payment Requests"
      subtitle="Salary payment requests created for your active placement."
      rightLabel="Requests"
      rightValue={String(rows.length)}
    >
      {error ? (
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-600">No payment requests yet.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="bg-white border border-gray-200 rounded-xl p-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="font-semibold text-brand-dark break-words">
                  {new Date(row.periodStart).toLocaleDateString()} — {new Date(row.periodEnd).toLocaleDateString()}
                </p>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 w-fit">{row.requestStatus}</span>
              </div>
              <div className="mt-2 text-sm text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-2">
                <p>Total: {money.format(row.totalDueUsd || 0)}</p>
                <p>Salary: {money.format(row.salaryAmountUsd || 0)}</p>
                <p>Method: {row.paymentMethod}</p>
              </div>
              <p className="mt-2 text-xs text-gray-500 break-words">
                Deposit status: {row.depositStatus || 'n/a'} {row.depositId ? `• Deposit ${row.depositId}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </CandidatePaymentsShell>
  );
}
