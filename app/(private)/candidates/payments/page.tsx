'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CandidatePaymentsShell from '@/components/candidates/payments/CandidatePaymentsShell';
import type { PlacedPaymentsOverview } from '@/types';

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function CandidatePaymentsOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockedMessage, setBlockedMessage] = useState('');
  const [overview, setOverview] = useState<PlacedPaymentsOverview | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/candidates/payments?view=overview', { credentials: 'include' });
        if (response.status === 401) return router.replace('/login');
        if (response.status === 403) return router.replace('/org/dashboard');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Failed to load overview');
        setOverview(payload?.data as PlacedPaymentsOverview);
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load payments overview.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router]);

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8 text-gray-500">Loading payments...</div>;

  if (error || !overview) {
    return (
      <CandidatePaymentsShell
        title="Payments Overview"
        subtitle="Track placement payments once your placement is active."
        rightLabel="Status"
        rightValue="Error"
      >
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center text-red-700">{error || 'No data'}</div>
      </CandidatePaymentsShell>
    );
  }

  const cards = [
    { label: 'Pending Requests', value: overview.pendingRequests },
    { label: 'Funded Requests', value: overview.fundedRequests },
    { label: 'Queued Payouts', value: overview.queuedPayouts },
    { label: 'Completed Payouts', value: overview.completedPayouts },
  ];

  return (
    <CandidatePaymentsShell
      title="Payments Overview"
      subtitle="Read-only visibility into your placement payment lifecycle."
      rightLabel="Latest Request"
      rightValue={formatDate(overview.latestRequestAt)}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5 min-w-0">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-brand-dark">{card.value}</p>
          </div>
        ))}
      </div>
    </CandidatePaymentsShell>
  );
}
