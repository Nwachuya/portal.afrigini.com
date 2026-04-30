'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CandidatePaymentsShell from '@/components/candidates/payments/CandidatePaymentsShell';
import type { SalaryScheduleRecord } from '@/types';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function CandidateSalarySchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockedMessage, setBlockedMessage] = useState('');
  const [rows, setRows] = useState<SalaryScheduleRecord[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/candidates/payments?view=schedule', { credentials: 'include' });
        if (response.status === 401) return router.replace('/login');
        if (response.status === 403) return router.replace('/org/dashboard');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Failed to load schedules');
        if (!payload?.context?.eligible) {
          setBlockedMessage(payload?.context?.reason || 'Payments are available after placement.');
          return;
        }
        setRows((payload?.data || []) as SalaryScheduleRecord[]);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load salary schedules.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8 text-gray-500">Loading schedules...</div>;

  return (
    <CandidatePaymentsShell
      title="Salary Schedule"
      subtitle="Active salary schedule records for your placement."
      rightLabel="Schedules"
      rightValue={String(rows.length)}
    >
      {blockedMessage ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-600">{blockedMessage}</div>
      ) : error ? (
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-600">No salary schedules found.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="bg-white border border-gray-200 rounded-xl p-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="font-semibold text-brand-dark break-words">Cadence: {row.cadence}</p>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 w-fit">{row.status}</span>
              </div>
              <div className="mt-2 text-sm text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-2">
                <p>Amount: {money.format(row.amount_usd || 0)}</p>
                <p>Day of month: {row.day_of_month || '—'}</p>
                <p>From: {new Date(row.effective_from).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </CandidatePaymentsShell>
  );
}
