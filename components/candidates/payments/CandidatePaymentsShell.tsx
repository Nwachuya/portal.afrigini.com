'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CandidatePaymentsShell({
  title,
  subtitle,
  rightLabel,
  rightValue,
  children,
}: {
  title: string;
  subtitle: string;
  rightLabel: string;
  rightValue: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: '/candidates/payments', label: 'Overview' },
    { href: '/candidates/payments/requests', label: 'Employer Funding' },
    { href: '/candidates/payments/payouts', label: 'Payout History' },
    { href: '/candidates/payments/profile', label: 'Payout Profile' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] text-brand-green uppercase">Placed Payments</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-brand-dark mt-2">{title}</h1>
            <p className="text-gray-500 mt-2 text-sm sm:text-base">{subtitle}</p>
          </div>
          <div className="bg-brand-green/10 border border-brand-green/20 rounded-2xl px-6 py-5 min-w-[220px]">
            <p className="text-xs font-bold tracking-[0.2em] text-brand-green uppercase">{rightLabel}</p>
            <p className="text-3xl font-bold text-brand-dark mt-1 break-words">{rightValue}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap border transition-colors ${
                  active
                    ? 'bg-brand-green text-white border-brand-green'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
